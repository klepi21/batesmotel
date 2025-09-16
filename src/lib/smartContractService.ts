import {
  ApiNetworkProvider,
  SmartContractController,
  Address,
  AbiRegistry,
  Transaction
} from '@multiversx/sdk-core';

// Farms contract address
const FARMS_CONTRACT_ADDRESS = 'erd1qqqqqqqqqqqqqpgql6dxenaameqn2uyyru3nmmpf7e95zmlxu7zskzpdcw';

// Import the ABI
import farmsAbi from '../contracts/farms.abi.json';

export interface Farm {
  id: string;
  creator: string;
  creation_epoch: number;
  staked_token: string;
  reward_token: string;
}

export interface FarmInfo {
  farm: Farm;
  stakingToken: string;
  totalStaked: string;
  totalRewards: string;
  isActive: boolean;
  lpPrice?: number;
  totalStakedUSD?: number;
  rewardTokens?: string[]; // For multi-reward farms
  isMultiReward?: boolean;
  calculatedAPR?: number; // For multi-farm APR calculation
}

export interface UserFarmInfo {
  farmId: string;
  stakedToken: string;
  stakedBalance: string;
  unbondingEpoch: number;
}

export interface UserRewardsInfo {
  rewardToken: string;
  farmId: string;
  harvestableAmount: string;
  earnedAmount: string;
}

export interface MultiFarmRewardsLeft {
  farmId: string;
  token: string;
  amount: string;
}

export interface LPPair {
  lpname: string;
  lpidentifier: string;
  lpprice: string;
  token1lp: string;
  token2lp: string;
}

export interface TokenPair {
  tokenA: string;
  tokenAprice: string;
  tokenB: string | null;
  tokenBprice: string | null;
  contract: string | null;
}

export class SmartContractService {
  private apiNetworkProvider: ApiNetworkProvider;
  private controller: SmartContractController;
  private contractAddress: Address;
  private abiRegistry: AbiRegistry;
  private lpPairs: LPPair[] = [];
  private tokenPairs: TokenPair[] = [];
  private multifarmRewardsLeftCache: MultiFarmRewardsLeft[] | null = null;
  private farmsCache: FarmInfo[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  constructor() {
    // Initialize the network provider for mainnet
    this.apiNetworkProvider = new ApiNetworkProvider('https://api.multiversx.com');
    
    // Create ABI registry from the imported ABI
    this.abiRegistry = AbiRegistry.create(farmsAbi);
    
    // Define the smart contract address
    this.contractAddress = Address.newFromBech32(FARMS_CONTRACT_ADDRESS);
    
    // Initialize the SmartContractController with ABI
    this.controller = new SmartContractController({ 
      chainID: '1', // Mainnet chain ID
      networkProvider: this.apiNetworkProvider,
      abi: this.abiRegistry
    });
  }

  async fetchLPPairs(): Promise<LPPair[]> {
    try {
      console.log('Fetching LP pairs from API...');
      const response = await fetch('https://api.web3ninja.eu/api/lppairs.php');
      const data = await response.json();
      this.lpPairs = data;
      console.log('LP pairs loaded:', this.lpPairs.length, 'pairs');
      return data;
    } catch (error) {
      console.error('Error fetching LP pairs:', error);
      return [];
    }
  }

  async fetchTokenPairs(): Promise<TokenPair[]> {
    try {
      console.log('🔄 Fetching token prices from MultiversX API...');
      const response = await fetch('https://api.multiversx.com/tokens?size=400');
      const tokens = await response.json();
      
      // Convert MultiversX API format to our TokenPair format
      const tokenPairs: (TokenPair & { decimals?: number })[] = tokens
        .filter((token: any) => token.price && token.price > 0)
        .map((token: any) => ({
          tokenA: token.identifier,
          tokenB: 'USDC-8d4068', // Using USDC as base pair
          tokenAprice: token.price.toString(),
          tokenBprice: '1.00',
          decimals: token.decimals || 18 // Store decimals for each token
        }));
      
      this.tokenPairs = tokenPairs;
      console.log(`✅ Token prices loaded: ${tokenPairs.length} tokens with prices`);
      
      // Log specific tokens we're interested in
      const interestingTokens = ['RARE-99e8b0', 'BATES-bb3dd6', 'DBATES-78f441'];
      interestingTokens.forEach(tokenId => {
        const token = tokens.find((t: any) => t.identifier === tokenId);
        if (token) {
          console.log(`💰 ${tokenId}: $${token.price}`);
        } else {
          console.log(`⚠️ ${tokenId}: No price data available`);
        }
      });
      
      return tokenPairs;
    } catch (error) {
      console.error('❌ Error fetching token prices from MultiversX API, using fallback prices:', error);
      
      // Fallback hardcoded prices for known tokens
      const fallbackPrices: TokenPair[] = [
        {
          tokenA: 'RARE-99e8b0',
          tokenB: 'USDC-8d4068',
          tokenAprice: '0.001', // Example price
          tokenBprice: '1.00',
          contract: null
        },
        {
          tokenA: 'BATES-bb3dd6',
          tokenB: 'USDC-8d4068', 
          tokenAprice: '0.0005', // Example price
          tokenBprice: '1.00',
          contract: null
        },
        {
          tokenA: 'DBATES-78f441',
          tokenB: 'USDC-8d4068',
          tokenAprice: '0.0003', // Example price
          tokenBprice: '1.00',
          contract: null
        }
      ];
      
      this.tokenPairs = fallbackPrices;
      console.log('Using fallback token prices:', fallbackPrices);
      return fallbackPrices;
    }
  }

  findLPPair(stakingToken: string): LPPair | null {
    // Try to find exact match first
    let lpPair = this.lpPairs.find(pair => pair.lpidentifier === stakingToken);
    
    if (!lpPair) {
      // Try to find by lpname if it contains the token identifier
      const tokenId = stakingToken.split('-')[0]; // Get the token name part
      lpPair = this.lpPairs.find(pair => 
        pair.lpname.includes(tokenId) || 
        pair.token1lp.includes(tokenId) || 
        pair.token2lp.includes(tokenId)
      );
    }
    
    return lpPair || null;
  }

  findTokenPrice(stakingToken: string): TokenPair | null {
    // Try to find exact match first
    let tokenPair = this.tokenPairs.find(pair => pair.tokenA === stakingToken);
    
    if (!tokenPair) {
      // Try to find by token name if it contains the token identifier
      const tokenId = stakingToken.split('-')[0]; // Get the token name part
      tokenPair = this.tokenPairs.find(pair => 
        pair.tokenA && pair.tokenA.includes(tokenId)
      );
    }
    
    return tokenPair || null;
  }

  calculateTotalStakedUSD(totalStaked: string, lpPrice: number): number {
    const totalStakedNum = parseFloat(totalStaked) / Math.pow(10, 18);
    return totalStakedNum * lpPrice;
  }

  calculateTotalStakedUSDSingleToken(totalStaked: string, tokenPrice: number): number {
    const totalStakedNum = parseFloat(totalStaked) / Math.pow(10, 18);
    return totalStakedNum * tokenPrice;
  }

  calculateTotalStakedUSDSingleTokenWithDecimals(totalStaked: string, tokenPrice: number, decimals: number = 18): number {
    const totalStakedNum = parseFloat(totalStaked) / Math.pow(10, decimals);
    return totalStakedNum * tokenPrice;
  }

  formatBalanceDollar(balance: { balance: string; decimals: number }, price: number): number {
    // Handle large numbers properly by using string manipulation
    const balanceStr = balance.balance;
    const decimals = balance.decimals;
    
    // Convert to proper decimal format by moving decimal point
    if (balanceStr.length <= decimals) {
      // If balance is smaller than decimals, pad with zeros
      const paddedBalance = balanceStr.padStart(decimals + 1, '0');
      const integerPart = paddedBalance.slice(0, -decimals);
      const decimalPart = paddedBalance.slice(-decimals);
      const balanceNum = parseFloat(`${integerPart}.${decimalPart}`);
      return balanceNum * price;
    } else {
      // Split the balance string at the decimal position
      const integerPart = balanceStr.slice(0, -decimals);
      const decimalPart = balanceStr.slice(-decimals);
      const balanceNum = parseFloat(`${integerPart}.${decimalPart}`);
      return balanceNum * price;
    }
  }

  // Get token decimals from MultiversX API data
  getTokenDecimals(tokenIdentifier: string): number {
    // Try to find the token in our cached data
    const token = this.tokenPairs.find(pair => pair.tokenA === tokenIdentifier);
    if (token && (token as any).decimals) {
      return (token as any).decimals;
    }
    
    // Fallback to common decimals for known tokens
    const knownDecimals: { [key: string]: number } = {
      'RARE-99e8b0': 18,
      'BATES-bb3dd6': 18,
      'DBATES-78f441': 18,
      'HYPE-619661': 18,
      'FEDUP-0994a9': 18,
      'USDC-8d4068': 6,
      'EGLD': 18
    };
    
    return knownDecimals[tokenIdentifier] || 18; // Default to 18 if unknown
  }

  // Get epochs remaining for a farm
  async getEpochsRemainingForFarm(farmId: string): Promise<number> {
    try {
      // Use lastRewardedEpoch endpoint to get the last epoch with rewards
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'lastRewardedEpoch',
        arguments: [farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);

      if (farmId === '115') {
        console.log(`📅 Farm ${farmId} lastRewardedEpoch result:`, result);
      }

      if (result) {
        const lastRewardedEpoch = result.toNumber ? result.toNumber() : parseInt(result.toString() || '0');
        
        // Get current epoch from network
        const currentEpoch = await this.getCurrentEpoch();
        
        // Calculate epoch difference using the correct formula
        // epochDifference = lastRewardedEpoch + 1 - currentEpoch
        const epochDifference = Math.max(1, lastRewardedEpoch + 1 - currentEpoch);
        
        if (farmId === '115') {
          console.log(`📅 Farm ${farmId} epochs info:`, {
            lastRewardedEpoch,
            currentEpoch,
            epochDifference
          });
        }
        
        return epochDifference;
      }

      // Fallback: assume 30 days (30 epochs) if no data found
      console.log(`⚠️ No lastRewardedEpoch data found for farm ${farmId}, using fallback of 30 epochs`);
      return 30;
      
    } catch (error) {
      console.error(`Error getting epochs remaining for farm ${farmId}:`, error);
      // Fallback: assume 30 days (30 epochs)
      return 30;
    }
  }

  // Get current epoch from network stats
  async getCurrentEpoch(): Promise<number> {
    try {
      // Use the BlastAPI endpoint to get network stats
      const response = await fetch('https://multiversx-api.blastapi.io/8be44138-082f-489f-8c13-d65058567ca4/stats');
      const stats = await response.json();
      const currentEpoch = stats?.epoch || 1000;
      console.log(`🌐 Current epoch from BlastAPI: ${currentEpoch}`);
      return currentEpoch;
    } catch (error) {
      console.error('Error getting current epoch from BlastAPI, using fallback:', error);
      return 1000; // Fallback
    }
  }

  async calculateMultiFarmAPR(farmId: string, stakingToken: string, totalStaked: string): Promise<number> {
    try {
      // Only log for farm 115
      if (farmId === '115') {
        console.log(`🔍 CALCULATING APR FOR MULTI-FARM ${farmId}:`);
      }
      
      // Fetch multi-farm rewards left
      const multifarmRewardsLeft = await this.fetchMultiFarms2RewardsLeft();
      const farmRewardsLeft = multifarmRewardsLeft.filter(r => r.farmId === farmId);
      
      if (farmId === '115') {
        console.log(`📊 ALL MULTIFARM REWARDS LEFT:`, multifarmRewardsLeft);
        console.log(`🎯 FARM ${farmId} REWARDS LEFT:`, farmRewardsLeft);
      }
      
      if (farmRewardsLeft.length === 0) {
        if (farmId === '115') {
          console.log(`❌ No rewards left for farm ${farmId}`);
        }
        return 0;
      }

      // Log each reward token in detail only for farm 115
      if (farmId === '115') {
        console.log(`💰 DETAILED REWARD BREAKDOWN FOR FARM ${farmId}:`);
        for (const reward of farmRewardsLeft) {
          console.log(`  Token: ${reward.token}`);
          console.log(`  Amount: ${reward.amount}`);
          console.log(`  Farm ID: ${reward.farmId}`);
          console.log(`  ---`);
        }
      }

      // Use cached price data if available - only fetch what we need
      if (this.tokenPairs.length === 0) {
        await this.fetchTokenPairs();
      }
      
      // Calculate rewards dollar value
      let rewardsDollarValue = 0;
      for (const reward of farmRewardsLeft) {
        const tokenPair = this.findTokenPrice(reward.token);
        
        if (farmId === '115') {
          console.log(`🔍 Looking for price of token ${reward.token}:`, tokenPair);
        }
        
        if (tokenPair && tokenPair.tokenAprice) {
          const tokenPrice = parseFloat(tokenPair.tokenAprice);
          const decimals = this.getTokenDecimals(reward.token);
          const dollarValue = this.formatBalanceDollar(
            { balance: reward.amount, decimals },
            tokenPrice
          );
          rewardsDollarValue += dollarValue;
          
          // Show the actual conversion calculation using proper string manipulation only for farm 115
          if (farmId === '115') {
            const balanceStr = reward.amount;
            let adjustedAmount: number;
            
            if (balanceStr.length <= decimals) {
              const paddedBalance = balanceStr.padStart(decimals + 1, '0');
              const integerPart = paddedBalance.slice(0, -decimals);
              const decimalPart = paddedBalance.slice(-decimals);
              adjustedAmount = parseFloat(`${integerPart}.${decimalPart}`);
            } else {
              const integerPart = balanceStr.slice(0, -decimals);
              const decimalPart = balanceStr.slice(-decimals);
              adjustedAmount = parseFloat(`${integerPart}.${decimalPart}`);
            }
            
            const calculatedValue = adjustedAmount * tokenPrice;
            
            console.log(`💎 Reward token ${reward.token}:`, {
              rawAmount: reward.amount,
              decimals: decimals,
              adjustedAmount: adjustedAmount.toFixed(6),
              price: tokenPrice,
              dollarValue: calculatedValue.toFixed(6),
              formatBalanceDollarResult: dollarValue.toFixed(6)
            });
          }
        } else {
          if (farmId === '115') {
            console.log(`⚠️ No price found for reward token: ${reward.token}`);
            console.log(`📊 Available token pairs:`, this.tokenPairs.map(p => ({ token: p.tokenA, price: p.tokenAprice })));
          }
        }
      }

      // Calculate staked dollar value
      const stakingTokenPair = this.findTokenPrice(stakingToken);
      
      if (farmId === '115') {
        console.log(`🔍 Looking for price of staking token ${stakingToken}:`, stakingTokenPair);
      }
      
      let stakedDollarValue = 0;
      if (stakingTokenPair && stakingTokenPair.tokenAprice) {
        const stakingTokenPrice = parseFloat(stakingTokenPair.tokenAprice);
        const decimals = this.getTokenDecimals(stakingToken);
        stakedDollarValue = this.formatBalanceDollar(
          { balance: totalStaked, decimals },
          stakingTokenPrice
        );
        
        // Show the actual conversion calculation for staking token only for farm 115
        if (farmId === '115') {
          const rawStakedAmount = parseFloat(totalStaked);
          const adjustedStakedAmount = rawStakedAmount / Math.pow(10, decimals);
          const calculatedStakedValue = adjustedStakedAmount * stakingTokenPrice;
          
          console.log(`💰 Staking token ${stakingToken}:`, {
            rawAmount: totalStaked,
            decimals: decimals,
            adjustedAmount: adjustedStakedAmount.toFixed(6),
            price: stakingTokenPrice,
            dollarValue: calculatedStakedValue.toFixed(6),
            formatBalanceDollarResult: stakedDollarValue.toFixed(6)
          });
        }
      } else {
        if (farmId === '115') {
          console.log(`⚠️ No price found for staking token: ${stakingToken}`);
        }
      }

      if (farmId === '115') {
        console.log(`📈 APR CALCULATION VALUES FOR FARM ${farmId}:`, {
          rewardsDollarValue: rewardsDollarValue.toFixed(6),
          stakedDollarValue: stakedDollarValue.toFixed(6),
          rewardsCount: farmRewardsLeft.length,
          stakingToken: stakingToken
        });
      }

      if (stakedDollarValue === 0) {
        if (farmId === '115') {
          console.log(`⚠️ Staked dollar value is 0 for farm ${farmId}`);
        }
        return 0;
      }

      if (rewardsDollarValue === 0) {
        if (farmId === '115') {
          console.log(`⚠️ Rewards dollar value is 0 for farm ${farmId}`);
        }
        return 0;
      }

      // Get epochs remaining for this farm
      const epochsRemaining = await this.getEpochsRemainingForFarm(farmId);
      
      if (farmId === '115') {
        console.log(`⏰ EPOCHS REMAINING FOR FARM ${farmId}: ${epochsRemaining}`);
      }
      
      if (epochsRemaining <= 0) {
        if (farmId === '115') {
          console.log(`⚠️ No epochs remaining for farm ${farmId}`);
        }
        return 0;
      }
      
      // APR = (Rewards Value / Staked Value) × 100 × 365 / Epochs Remaining
      const apr = ((rewardsDollarValue / stakedDollarValue) * 100 * 365) / epochsRemaining;
      
      if (farmId === '115') {
        console.log(`🧮 APR CALCULATION BREAKDOWN:`, {
          rewardsValue: rewardsDollarValue,
          stakedValue: stakedDollarValue,
          ratio: (rewardsDollarValue / stakedDollarValue).toFixed(6),
          annualized: ((rewardsDollarValue / stakedDollarValue) * 100 * 365).toFixed(2),
          epochsRemaining: epochsRemaining,
          finalAPR: apr.toFixed(2)
        });
      }
      
      if (farmId === '115') {
        console.log(`🎯 CALCULATED APR FOR FARM ${farmId}: ${Math.round(apr)}%`);
      }
      return Math.round(apr); // Return actual APR without decimals
      
    } catch (error) {
      console.error(`❌ Error calculating multi-farm APR for farm ${farmId}:`, error);
      return 0;
    }
  }

  async getAllFarms(): Promise<FarmInfo[]> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.farmsCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        console.log('Using cached farms data');
        return this.farmsCache;
      }

      console.log('Calling getAllFarms on contract:', FARMS_CONTRACT_ADDRESS);
      
      // Only fetch token pairs if we don't have them cached (LP pairs not needed for farm 115)
      if (this.tokenPairs.length === 0) {
        await this.fetchTokenPairs();
      }
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getAllFarms',
        arguments: []
      });

      const response = await this.controller.runQuery(query);
      
      // Raw query response processed silently

      const [result] = this.controller.parseQueryResponse(response);
      // Parsed result processed silently

      const farms: FarmInfo[] = [];
      
      if (result && Array.isArray(result)) {
        // Processing farms silently
        
        for (let i = 0; i < result.length; i++) {
          const farmData = result[i];
          
          if (farmData && typeof farmData === 'object') {
            const farm = farmData.field0;
            const stakingToken = farmData.field1;
            const totalStaked = farmData.field2;
            const totalRewards = farmData.field3;
            let isActive = farmData.field4;
            
            // Silent processing for farm 115
            
            // Silent processing for farms 112 and 115
            
            if (farm) {
              const stakingTokenStr = stakingToken?.toString() || '';
              const totalStakedStr = totalStaked?.toString() || '0';
              const rewardTokenStr = farm.reward_token?.toString() || '';
              
              // Check if this is a multi-reward farm (empty reward token)
              const isMultiReward = !rewardTokenStr || rewardTokenStr === '';
              let rewardTokens: string[] = [];
              let calculatedAPR = 0;
              
              if (isMultiReward) {
                // Fetch multi-reward tokens
                rewardTokens = await this.getMultifarmRewardTokens(farm.id?.toString() || '0');
                
                // Silent processing for farm 115
                
                // For multi-reward farms, check if there are actually deposited rewards
                // If there are reward tokens but no rewards left, consider it inactive
                if (rewardTokens.length > 0) {
                  try {
                    // Use the same rewards left data that will be used for APR calculation
                    const rewardsLeft = await this.getMultifarmsRewardsLeft();
                    const farmRewardsLeft = rewardsLeft.filter(r => r.farmId === farm.id?.toString());
                    const hasDepositedRewards = farmRewardsLeft.some(r => r.amount !== '0');
                    
                    // Silent processing for farm 115
                    
                    // Override isActive based on whether rewards are actually deposited
                    if (hasDepositedRewards) {
                      isActive = true;
                      
                      // Calculate proper APR for multi-farm using dollar values
                      calculatedAPR = await this.calculateMultiFarmAPR(
                        farm.id?.toString() || '0',
                        stakingTokenStr,
                        totalStakedStr
                      );
                    }
                  } catch (error) {
                    console.error(`Error checking rewards left for farm ${i + 1}:`, error);
                  }
                }
              }
              
              // Check if this is an LP token (contains USDC)
              const isLPToken = stakingTokenStr.includes('USDC');
              let lpPrice = 0;
              let totalStakedUSD = 0;
              
              if (isLPToken) {
                // Use LP pair data for LP tokens
                const lpPair = this.findLPPair(stakingTokenStr);
                lpPrice = lpPair ? parseFloat(lpPair.lpprice) : 0;
                totalStakedUSD = lpPrice > 0 ? this.calculateTotalStakedUSD(totalStakedStr, lpPrice) : 0;
              } else {
                // Use token pair data for single tokens
                const tokenPair = this.findTokenPrice(stakingTokenStr);
                const tokenPrice = tokenPair ? parseFloat(tokenPair.tokenAprice) : 0;
                
                // Special handling for farm 112 with LOKD-ff8f08 (6 decimals)
                const isLOKDToken = stakingTokenStr === 'LOKD-ff8f08';
                const decimals = isLOKDToken ? 6 : 18;
                
                totalStakedUSD = tokenPrice > 0 ? this.calculateTotalStakedUSDSingleTokenWithDecimals(totalStakedStr, tokenPrice, decimals) : 0;
              }
              
              // Silent processing for farm 115 price data
              
              const farmInfo: FarmInfo = {
                farm: {
                  id: farm.id?.toString() || '0',
                  creator: farm.creator?.toString() || '',
                  creation_epoch: farm.creation_epoch?.toNumber() || 0,
                  staked_token: farm.staked_token?.toString() || '',
                  reward_token: rewardTokenStr
                },
                stakingToken: stakingTokenStr,
                totalStaked: totalStakedStr,
                totalRewards: totalRewards?.toString() || '0',
                isActive: Boolean(isActive?.valueOf()) || false,
                lpPrice: isLPToken ? lpPrice : undefined,
                totalStakedUSD,
                rewardTokens: isMultiReward ? rewardTokens : undefined,
                isMultiReward,
                calculatedAPR: isMultiReward ? calculatedAPR : undefined
              };
              
              // Silent processing for farm 115 final info
              
              // Silent processing for farm 112 final info

              // Silent processing for farm 115 final info
              
              farms.push(farmInfo);
            }
          }
        }
      }

      // Cache the result
      this.farmsCache = farms;
      this.cacheTimestamp = Date.now();
      
      return farms;
      
    } catch (error) {
      console.error('Error calling getAllFarms:', error);
      
      console.log('Returning mock farms data due to error');
      return [
        {
          farm: {
            id: '1',
            creator: 'erd1qqqqqqqqqqqqqpgql6dxenaameqn2uyyru3nmmpf7e95zmlxu7zskzpdcw',
            creation_epoch: 123456,
            staked_token: 'EGLD',
            reward_token: 'MEX'
          },
          stakingToken: 'EGLD',
          totalStaked: '1000000000000000000',
          totalRewards: '500000000000000000',
          isActive: true
        }
      ];
    }
  }

  async getUserFarmInfo(address: string): Promise<UserFarmInfo[]> {
    try {
      console.log('Calling getUserFarmInfo for address:', address);
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getUserFarmInfo',
        arguments: [address]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      console.log('User farm info result:', result);

      const userFarms: UserFarmInfo[] = [];
      
      if (result && Array.isArray(result)) {
        for (const farmData of result) {
          if (farmData && typeof farmData === 'object') {
            const farmId = farmData.field0;
            const stakedToken = farmData.field1;
            const stakingData = farmData.field2; // List<BigUint> [stakedBalance, unbondingEpoch]
            
            if (farmId && stakedToken && stakingData && Array.isArray(stakingData) && stakingData.length >= 2) {
              const userFarm: UserFarmInfo = {
                farmId: farmId.toString(),
                stakedToken: stakedToken.toString(),
                stakedBalance: stakingData[0]?.toString() || '0',
                unbondingEpoch: stakingData[1]?.toNumber() || 0
              };
              
              userFarms.push(userFarm);
            }
          }
        }
      }

      console.log('Processed user farms:', userFarms);
      return userFarms;
      
    } catch (error) {
      console.error('Error calling getUserFarmInfo:', error);
      return [];
    }
  }

  async getUserRewardsInfo(address: string): Promise<UserRewardsInfo[]> {
    try {
      console.log('Calling getUserRewardsInfo for address:', address);
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getUserRewardsInfo',
        arguments: [address]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      console.log('User rewards info result:', result);

      const userRewards: UserRewardsInfo[] = [];
      
      if (result && Array.isArray(result)) {
        for (const rewardData of result) {
          if (rewardData && typeof rewardData === 'object') {
            const rewardToken = rewardData.field0;
            const rewardsData = rewardData.field1; // List<BigUint> [farmId, harvestableAmount, earnedAmount]
            
            if (rewardToken && rewardsData && Array.isArray(rewardsData) && rewardsData.length >= 3) {
              const userReward: UserRewardsInfo = {
                rewardToken: rewardToken.toString(),
                farmId: rewardsData[0]?.toString() || '0',
                harvestableAmount: rewardsData[1]?.toString() || '0',
                earnedAmount: rewardsData[2]?.toString() || '0'
              };
              
              userRewards.push(userReward);
            }
          }
        }
      }

      console.log('Processed user rewards:', userRewards);
      return userRewards;
      
    } catch (error) {
      console.error('Error calling getUserRewardsInfo:', error);
      return [];
    }
  }

  async getMultifarmsRewardsLeft(): Promise<MultiFarmRewardsLeft[]> {
    try {
      // Return cached data if available
      if (this.multifarmRewardsLeftCache) {
        return this.multifarmRewardsLeftCache;
      }

      // Fetching multifarm rewards left
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getMultifarmsRewardsLeft',
        arguments: []
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      // Process multifarms rewards left silently

      const rewardsLeft: MultiFarmRewardsLeft[] = [];
      
      if (result && Array.isArray(result)) {
        for (const rewardData of result) {
          if (rewardData && typeof rewardData === 'object') {
            const farmId = rewardData.field0;
            const tokenPayments = rewardData.field1; // List<EsdtTokenPayment>
            
            if (farmId && tokenPayments && Array.isArray(tokenPayments)) {
              for (const payment of tokenPayments) {
                if (payment && typeof payment === 'object') {
                  const rewardLeft: MultiFarmRewardsLeft = {
                    farmId: farmId.toString(),
                    token: payment.token_identifier?.toString() || '',
                    amount: payment.amount?.toString() || '0'
                  };
                  
                  rewardsLeft.push(rewardLeft);
                }
              }
            }
          }
        }
      }

      // Cache the result
      this.multifarmRewardsLeftCache = rewardsLeft;
      return rewardsLeft;
      
    } catch (error) {
      console.error('Error calling getMultifarmsRewardsLeft:', error);
      return [];
    }
  }

  async fetchMultiFarms2RewardsLeft(): Promise<MultiFarmRewardsLeft[]> {
    // Use the cached multifarm rewards left data
    return this.getMultifarmsRewardsLeft();
  }

  // Method to clear cache when needed
  clearCache(): void {
    this.multifarmRewardsLeftCache = null;
    this.farmsCache = null;
    this.lpPairs = [];
    this.tokenPairs = [];
    this.cacheTimestamp = 0;
    console.log('🗑️ Cache cleared');
  }

  async getLastRewardedEpoch(farmId: string): Promise<number> {
    try {
      console.log('Calling lastRewardedEpoch for farm:', farmId);
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'lastRewardedEpoch',
        arguments: [farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      console.log('Last rewarded epoch result:', result);
      
      return result?.toNumber() || 0;
      
    } catch (error) {
      console.error('Error calling lastRewardedEpoch:', error);
      return 0;
    }
  }

  async getFarmById(farmId: string): Promise<FarmInfo | null> {
    try {
      const farms = await this.getAllFarms();
      return farms.find(farm => farm.farm.id === farmId) || null;
    } catch (error) {
      console.error('Error getting farm by ID:', error);
      throw error;
    }
  }

  async getFarmsCount(): Promise<number> {
    try {
      const farms = await this.getAllFarms();
      return farms.length;
    } catch (error) {
      console.error('Error getting farms count:', error);
      throw error;
    }
  }

  async getMultifarmRewardTokens(farmId: string): Promise<string[]> {
    try {
      console.log('Calling multifarmRewardTokens for farm:', farmId);
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'multifarmRewardTokens',
        arguments: [farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      console.log('Multifarm reward tokens result:', result);

      const rewardTokens: string[] = [];
      
      if (result && Array.isArray(result)) {
        for (const token of result) {
          if (token) {
            rewardTokens.push(token.toString());
          }
        }
      }

      console.log('Processed multifarm reward tokens:', rewardTokens);
      return rewardTokens;
      
    } catch (error) {
      console.error('Error calling multifarmRewardTokens:', error);
      return [];
    }
  }

  // Transaction methods for staking functionality
  createStakeTransaction(farmId: string, amount: string, stakingToken: string, userAddress: string, chainId: string = '1'): Transaction {
    console.log('Creating stake transaction:', { farmId, amount, stakingToken, userAddress });
    
    // Convert amount to BigInt (assuming 18 decimals for most tokens, 6 for LOKD)
    const decimals = stakingToken === 'LOKD-ff8f08' ? 6 : 18;
    const tokenAmount = BigInt(parseFloat(amount) * Math.pow(10, decimals));
    
    // Create ESDT transfer data
    const tokenIdentifierHex = Buffer.from(stakingToken).toString('hex');
    const amountHex = tokenAmount.toString(16).padStart(64, '0');
    const functionName = Buffer.from('stake').toString('hex');
    const farmIdHex = BigInt(farmId).toString(16).padStart(64, '0');
    
    const data = `ESDTTransfer@${tokenIdentifierHex}@${amountHex}@${functionName}@${farmIdHex}`;
    
    return new Transaction({
      sender: new Address(userAddress),
      receiver: this.contractAddress,
      value: BigInt(0),
      data: new Uint8Array(Buffer.from(data)),
      gasLimit: BigInt(80000000), // 80M gas limit
      chainID: chainId
    });
  }

  createUnstakeTransaction(farmId: string, amount: string, userAddress: string, chainId: string = '1'): Transaction {
    console.log('Creating unstake transaction:', { farmId, amount, userAddress });
    
    // Convert amount to BigInt (18 decimals for most tokens)
    const tokenAmount = BigInt(parseFloat(amount) * Math.pow(10, 18));
    
    const functionName = Buffer.from('unstake').toString('hex');
    const farmIdHex = BigInt(farmId).toString(16).padStart(64, '0');
    const amountHex = tokenAmount.toString(16).padStart(64, '0');
    
    const data = `${functionName}@${farmIdHex}@${amountHex}`;
    
    return new Transaction({
      sender: new Address(userAddress),
      receiver: this.contractAddress,
      value: BigInt(0),
      data: new Uint8Array(Buffer.from(data)),
      gasLimit: BigInt(80000000), // 80M gas limit
      chainID: chainId
    });
  }

  createHarvestTransaction(farmId: string, userAddress: string, chainId: string = '1'): Transaction {
    console.log('Creating harvest transaction:', { farmId, userAddress });
    
    const functionName = Buffer.from('harvest').toString('hex');
    const farmIdHex = BigInt(farmId).toString(16).padStart(64, '0');
    
    const data = `${functionName}@${farmIdHex}`;
    
    return new Transaction({
      sender: new Address(userAddress),
      receiver: this.contractAddress,
      value: BigInt(0),
      data: new Uint8Array(Buffer.from(data)),
      gasLimit: BigInt(80000000), // 80M gas limit
      chainID: chainId
    });
  }

  // Helper method to get user's harvestable rewards for a specific farm
  async calcHarvestableRewards(userAddress: string, farmId: string): Promise<string> {
    try {
      console.log('Calling calcHarvestableRewards for address:', userAddress, 'farm:', farmId);
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'calcHarvestableRewards',
        arguments: [userAddress, farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      console.log('Harvestable rewards result:', result);

      // The result should be a list of token/amount pairs
      if (result && Array.isArray(result) && result.length > 0) {
        // For single reward farms, take the first amount
        const firstReward = result[0];
        if (firstReward && typeof firstReward === 'object') {
          return firstReward.field1?.toString() || '0';
        }
      }

      return '0';
      
    } catch (error) {
      console.error('Error calling calcHarvestableRewards:', error);
      return '0';
    }
  }
}

// Export a singleton instance
export const smartContractService = new SmartContractService();

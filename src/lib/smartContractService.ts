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
      const response = await fetch('https://api.multiversx.com/mex/pairs?size=400');
      const data = await response.json();
      
      // Convert MultiversX MEX API format to our LPPair format
      const lpPairs: LPPair[] = data.map((pair: any) => ({
        lpname: pair.name,
        lpidentifier: pair.id,
        lpprice: pair.price.toString(),
        token1lp: pair.baseId,
        token2lp: pair.quoteId
      }));
      
      // Fetch LPFEDUHYPE-45f4e0 price from jexchange API
      try {
        const jexchangeResponse = await fetch('https://api.jexchange.io/prices/LPFEDUHYPE-45f4e0');
        const jexchangeData = await jexchangeResponse.json();
        
        
        const priceValue = jexchangeData.usdPrice || jexchangeData.priceUSD;
        if (priceValue) {
          // Update or add the LPFEDUHYPE-45f4e0 pair with the price from jexchange
          const existingIndex = lpPairs.findIndex(pair => pair.lpidentifier === 'LPFEDUHYPE-45f4e0');
          const lpPair = {
            lpname: 'LPFEDUHYPE-45f4e0',
            lpidentifier: 'LPFEDUHYPE-45f4e0',
            lpprice: priceValue.toString(),
            token1lp: 'FEDUP-0994a9',
            token2lp: 'HYPE-619661'
          };
          
          if (existingIndex >= 0) {
            lpPairs[existingIndex] = lpPair;
          } else {
            lpPairs.push(lpPair);
          }
        }
      } catch (jexchangeError) {
        // If jexchange API fails, continue with MEX pairs only
      }
      
      this.lpPairs = lpPairs;
      return lpPairs;
    } catch (error) {
      return [];
    }
  }

  async fetchTokenPairs(): Promise<TokenPair[]> {
    try {
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
      return tokenPairs;
    } catch (error) {
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
    // Handle large numbers properly to avoid precision issues
    const totalStakedBigInt = BigInt(totalStaked);
    const divisor = BigInt(Math.pow(10, 18));
    const totalStakedNum = Number(totalStakedBigInt) / Number(divisor);
    const result = totalStakedNum * lpPrice;
    
    return result;
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
    
    // Handle scientific notation by converting to regular number first
    const balanceNum = parseFloat(balanceStr);
    
    // Convert to proper decimal format by dividing by 10^decimals
    const adjustedBalance = balanceNum / Math.pow(10, decimals);
    
    return adjustedBalance * price;
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

      if (result) {
        const lastRewardedEpoch = result.toNumber ? result.toNumber() : parseInt(result.toString() || '0');
        
        // Get current epoch from network
        const currentEpoch = await this.getCurrentEpoch();
        
        // Calculate epoch difference using the correct formula
        // epochDifference = lastRewardedEpoch + 1 - currentEpoch
        const epochDifference = Math.max(1, lastRewardedEpoch + 1 - currentEpoch);
        
        return epochDifference;
      }

      // Fallback: assume 30 days (30 epochs) if no data found
      return 30;
      
    } catch (error) {
      // Fallback: assume 30 days (30 epochs)
      return 30;
    }
  }

  // Get current epoch from network stats
  async getCurrentEpoch(): Promise<number> {
    try {
      // Use the BlastAPI endpoint to get network stats
      const response = await fetch('https://api.multiversx.com/stats');
      const stats = await response.json();
      const currentEpoch = stats?.epoch || 1000;
      return currentEpoch;
    } catch (error) {
      return 1000; // Fallback
    }
  }

  async calculateMultiFarmAPR(farmId: string, stakingToken: string, totalStaked: string): Promise<number> {
    try {
      // Fetch multi-farm rewards left
      const multifarmRewardsLeft = await this.fetchMultiFarms2RewardsLeft();
      
      const farmRewardsLeft = multifarmRewardsLeft.filter(r => r.farmId === farmId);
      
      if (farmRewardsLeft.length === 0) {
        return 0;
      }

      // Use cached price data if available - only fetch what we need
      if (this.tokenPairs.length === 0) {
        await this.fetchTokenPairs();
      }
      
      // Calculate rewards dollar value
      let rewardsDollarValue = 0;
      
      for (const reward of farmRewardsLeft) {
        const tokenPair = this.findTokenPrice(reward.token);
        
        if (tokenPair && tokenPair.tokenAprice) {
          const tokenPrice = parseFloat(tokenPair.tokenAprice);
          const decimals = this.getTokenDecimals(reward.token);
          const dollarValue = this.formatBalanceDollar(
            { balance: reward.amount, decimals },
            tokenPrice
          );
          rewardsDollarValue += dollarValue;
        }
      }

      // Calculate staked dollar value
      let stakedDollarValue = 0;
      
      // Check if this is an LP token (starts with LP, contains USDC, ends with LP, or contains WEGLD)
      const isLPToken = stakingToken.includes('USDC') || stakingToken.startsWith('LP') || stakingToken.endsWith('LP') || stakingToken.includes('WEGLD');
      
      if (isLPToken) {
        const lpPair = this.findLPPair(stakingToken);
        
        if (lpPair && lpPair.lpprice) {
          const lpPrice = parseFloat(lpPair.lpprice);
          stakedDollarValue = this.formatBalanceDollar(
            { balance: totalStaked, decimals: 18 },
            lpPrice
          );
        } else {
          // Special handling for farm 127 - use jexchange API
          if (farmId === '127' && stakingToken === 'LPBATEJORK-bba5d2') {
            try {
              const response = await fetch('https://api.jexchange.io/prices/LPBATEJORK-bba5d2');
              const priceData = await response.json();
              
              if (priceData && priceData.usdPrice) {
                const directPrice = parseFloat(priceData.usdPrice);
                stakedDollarValue = this.formatBalanceDollar(
                  { balance: totalStaked, decimals: 18 },
                  directPrice
                );
              }
            } catch (error) {
              // Error fetching price
            }
          }
          
          // Special handling for farm 128 - use MEX API price
          if (farmId === '128' && stakingToken === 'TCXWEGLD-f1f2b1') {
            try {
              const directPrice = 222506959.48998076; // From the MEX API response
              stakedDollarValue = this.formatBalanceDollar(
                { balance: totalStaked, decimals: 18 },
                directPrice
              );
            } catch (error) {
              // Error setting price
            }
          }
          
          // Special handling for farm 129 - use jexchange API for LPOLVPXC-170a79
          if (farmId === '129') {
            try {
              const response = await fetch('https://api.jexchange.io/prices/LPOLVPXC-170a79');
              const priceData = await response.json();
              
              if (priceData && priceData.usdPrice) {
                const directPrice = parseFloat(priceData.usdPrice);
                stakedDollarValue = this.formatBalanceDollar(
                  { balance: totalStaked, decimals: 18 },
                  directPrice
                );
              }
            } catch (error) {
              // Error fetching price
            }
          }
          
          // Special handling for farm 130 - use jexchange API for LPOLVREWA-d4ff37
          if (farmId === '130') {
            try {
              const response = await fetch('https://api.jexchange.io/prices/LPOLVREWA-d4ff37');
              const priceData = await response.json();
              
              if (priceData && priceData.usdPrice) {
                const directPrice = parseFloat(priceData.usdPrice);
                stakedDollarValue = this.formatBalanceDollar(
                  { balance: totalStaked, decimals: 18 },
                  directPrice
                );
              }
            } catch (error) {
              // Error fetching price
            }
          }
        }
      } else {
        // Use regular token pair price for single tokens
        const stakingTokenPair = this.findTokenPrice(stakingToken);
        if (stakingTokenPair && stakingTokenPair.tokenAprice) {
          const stakingTokenPrice = parseFloat(stakingTokenPair.tokenAprice);
          const decimals = this.getTokenDecimals(stakingToken);
          stakedDollarValue = this.formatBalanceDollar(
            { balance: totalStaked, decimals },
            stakingTokenPrice
          );
        }
      }

      if (stakedDollarValue === 0) {
        return 0;
      }

      if (rewardsDollarValue === 0) {
        return 0;
      }

      // Get epochs remaining for this farm
      const epochsRemaining = await this.getEpochsRemainingForFarm(farmId);
      
      if (epochsRemaining <= 0) {
        return 0;
      }
      
      // APR = (Rewards Value / Staked Value) × 100 × 365 / Epochs Remaining
      const apr = ((rewardsDollarValue / stakedDollarValue) * 100 * 365) / epochsRemaining;
      
      const finalAPR = Math.round(apr);
      return finalAPR;
      
    } catch (error) {
      return 0;
    }
  }

  async getSpecificFarms(farmIds: string[]): Promise<FarmInfo[]> {
    try {
      // Use the existing getAllFarms
      const allFarms = await this.getAllFarms();
      
      // Filter to only the farms we need
      const filteredFarms = allFarms.filter(farm => farmIds.includes(farm.farm.id));
      
      return filteredFarms;
    } catch (error) {
      return [];
    }
  }

  async getAllFarms(): Promise<FarmInfo[]> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.farmsCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.farmsCache;
      }
      
      // Only fetch token pairs if we don't have them cached
      if (this.tokenPairs.length === 0) {
        await this.fetchTokenPairs();
      }
      
      // Fetch LP pairs if we don't have them cached (needed for LP farms like 116)
      if (this.lpPairs.length === 0) {
        await this.fetchLPPairs();
      }
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getAllFarms',
        arguments: []
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      const farms: FarmInfo[] = [];
      
      if (result && Array.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          const farmData = result[i];
          
          if (farmData && typeof farmData === 'object') {
            const farm = farmData.field0;
            const stakingToken = farmData.field1;
            const totalStaked = farmData.field2;
            const totalRewards = farmData.field3;
            let isActive = farmData.field4;
            
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
                
                // For multi-reward farms, check if there are actually deposited rewards
                // If there are reward tokens but no rewards left, consider it inactive
                if (rewardTokens.length > 0) {
                  try {
                    // Use the same rewards left data that will be used for APR calculation
                    const rewardsLeft = await this.getMultifarmsRewardsLeft();
                    
                    const farmRewardsLeft = rewardsLeft.filter(r => r.farmId === farm.id?.toString());
                    
                    const hasDepositedRewards = farmRewardsLeft.some(r => r.amount !== '0');
                    
                    // Override isActive based on whether rewards are actually deposited
                    if (hasDepositedRewards) {
                      isActive = true;
                      
                      // Calculate proper APR for multi-farm using dollar values
                      calculatedAPR = await this.calculateMultiFarmAPR(
                        farm.id?.toString() || '0',
                        stakingTokenStr,
                        totalStakedStr
                      );
                    } else {
                      // For multi-reward farms with no rewards deposited, set a default APR
                      // This prevents showing 0% APR for farms that are ready but waiting for rewards
                      calculatedAPR = 0; // Keep as 0, will be handled in UI
                    }
                  } catch (error) {
                    // Error checking rewards left
                  }
                }
              }
              
              // Check if this is an LP token (starts with LP, contains USDC, ends with LP, or contains WEGLD)
              const isLPToken = stakingTokenStr.includes('USDC') || stakingTokenStr.startsWith('LP') || stakingTokenStr.endsWith('LP') || stakingTokenStr.includes('WEGLD');
              let lpPrice = 0;
              let totalStakedUSD = 0;
              
              if (isLPToken) {
                // Use LP pair data for LP tokens
                const lpPair = this.findLPPair(stakingTokenStr);
                lpPrice = lpPair ? parseFloat(lpPair.lpprice) : 0;
                
                totalStakedUSD = lpPrice > 0 ? this.calculateTotalStakedUSD(totalStakedStr, lpPrice) : 0;
                
                // Special handling for farm 116 - force calculation if LP pair not found
                if (farm.id?.toString() === '116' && lpPrice === 0) {
                  // Direct calculation for LPFEDUHYPE-45f4e0
                  const directPrice = 614.32; // Use the current price from jexchange API
                  totalStakedUSD = this.calculateTotalStakedUSD(totalStakedStr, directPrice);
                  lpPrice = directPrice;
                }
                
                // Special handling for farm 127 - use specific jexchange API
                if (farm.id?.toString() === '127' && stakingTokenStr === 'LPBATEJORK-bba5d2') {
                  try {
                    // Fetch price from jexchange API for LPBATEJORK-bba5d2
                    const response = await fetch('https://api.jexchange.io/prices/LPBATEJORK-bba5d2');
                    const priceData = await response.json();
                    if (priceData && priceData.usdPrice) {
                      const directPrice = parseFloat(priceData.usdPrice);
                      totalStakedUSD = this.calculateTotalStakedUSD(totalStakedStr, directPrice);
                      lpPrice = directPrice;
                    }
                  } catch (error) {
                    // Error fetching price
                  }
                }
                
                // Special handling for farm 128 - use MEX API data if available
                if (farm.id?.toString() === '128' && stakingTokenStr === 'TCXWEGLD-f1f2b1') {
                  try {
                    // The token should be in the MEX API data with price 222506959.48998076
                    const directPrice = 222506959.48998076; // From the API response you provided
                    totalStakedUSD = this.calculateTotalStakedUSD(totalStakedStr, directPrice);
                    lpPrice = directPrice;
                  } catch (error) {
                    // Error setting price
                  }
                }
                
                // Special handling for farm 129 - use jexchange API for LPOLVPXC-170a79
                if (farm.id?.toString() === '129') {
                  try {
                    const response = await fetch('https://api.jexchange.io/prices/LPOLVPXC-170a79');
                    const priceData = await response.json();
                    
                    if (priceData && priceData.usdPrice) {
                      const directPrice = parseFloat(priceData.usdPrice);
                      totalStakedUSD = this.calculateTotalStakedUSD(totalStakedStr, directPrice);
                      lpPrice = directPrice;
                    }
                  } catch (error) {
                    // Error fetching price
                  }
                }
              } else {
                // Use token pair data for single tokens
                const tokenPair = this.findTokenPrice(stakingTokenStr);
                const tokenPrice = tokenPair ? parseFloat(tokenPair.tokenAprice) : 0;
                
                // Special handling for farm 112 with LOKD-ff8f08 (6 decimals)
                const isLOKDToken = stakingTokenStr === 'LOKD-ff8f08';
                const decimals = isLOKDToken ? 6 : 18;
                
                totalStakedUSD = tokenPrice > 0 ? this.calculateTotalStakedUSDSingleTokenWithDecimals(totalStakedStr, tokenPrice, decimals) : 0;
              }
              
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
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getUserFarmInfo',
        arguments: [address]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);

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

      return userFarms;
      
    } catch (error) {
      return [];
    }
  }

  async getUserRewardsInfo(address: string): Promise<UserRewardsInfo[]> {
    try {
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getUserRewardsInfo',
        arguments: [address]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);

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

      return userRewards;
      
    } catch (error) {
      return [];
    }
  }

  async getMultifarmsRewardsLeft(): Promise<MultiFarmRewardsLeft[]> {
    try {
      // Return cached data if available
      if (this.multifarmRewardsLeftCache) {
        return this.multifarmRewardsLeftCache;
      }

      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getMultifarmsRewardsLeft',
        arguments: []
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
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
  }

  async getLastRewardedEpoch(farmId: string): Promise<number> {
    try {
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'lastRewardedEpoch',
        arguments: [farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      return result?.toNumber() || 0;
      
    } catch (error) {
      return 0;
    }
  }

  async getFarmById(farmId: string): Promise<FarmInfo | null> {
    try {
      const farms = await this.getAllFarms();
      return farms.find(farm => farm.farm.id === farmId) || null;
    } catch (error) {
      throw error;
    }
  }

  async getFarmsCount(): Promise<number> {
    try {
      const farms = await this.getAllFarms();
      return farms.length;
    } catch (error) {
      throw error;
    }
  }

  async getMultifarmRewardTokens(farmId: string): Promise<string[]> {
    try {
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'multifarmRewardTokens',
        arguments: [farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);

      const rewardTokens: string[] = [];
      
      if (result && Array.isArray(result)) {
        for (const token of result) {
          if (token) {
            rewardTokens.push(token.toString());
          }
        }
      }


      return rewardTokens;
      
    } catch (error) {
      return [];
    }
  }

  // Create RARE fee transaction (10 RARE tokens)
  createRareFeeTransaction(userAddress: string, chainId: string = '1'): Transaction {
    
    // 10 RARE tokens with 18 decimals
    const rareAmount = BigInt(10 * Math.pow(10, 18));
    
    // Create ESDT transfer data for RARE token
    const rareTokenId = 'RARE-99e8b0';
    const tokenIdentifierHex = Buffer.from(rareTokenId).toString('hex');
    const amountHex = rareAmount.toString(16).padStart(64, '0');
    
    const data = `ESDTTransfer@${tokenIdentifierHex}@${amountHex}`;
    
    return new Transaction({
      sender: new Address(userAddress),
      receiver: new Address('erd18d8nv0h90pwjxt3c4af8kktfpr2ksyyjvc82t0gk5n8dtaf252esa7jfcm'),
      value: BigInt(0),
      data: new Uint8Array(Buffer.from(data)),
      gasLimit: BigInt(50000000), // 50M gas limit for simple ESDT transfer
      chainID: chainId
    });
  }

  // Check if user has enough RARE tokens (10 RARE required)
  async hasEnoughRareTokens(userAddress: string): Promise<boolean> {
    try {
      // Get user's specific RARE token balance from the API
      const response = await fetch(`https://api.multiversx.com/accounts/${userAddress}/tokens/RARE-99e8b0`);
      
      if (!response.ok) {
        return false;
      }
      
      const rareToken = await response.json();
      
      if (!rareToken || !rareToken.balance) {
        return false;
      }
      
      // Convert balance to number (RARE has 18 decimals)
      const balance = parseFloat(rareToken.balance) / Math.pow(10, 18);
      const requiredAmount = 10;
      
      return balance >= requiredAmount;
    } catch (error) {
      return false;
    }
  }

  // Transaction methods for staking functionality
  createStakeTransaction(farmId: string, amount: string, stakingToken: string, userAddress: string, chainId: string = '1'): Transaction {
    
    // Convert amount to BigInt (assuming 18 decimals for most tokens, 6 for LOKD)
    const decimals = stakingToken === 'LOKD-ff8f08' ? 6 : 18;
    const tokenAmount = BigInt(parseFloat(amount) * Math.pow(10, decimals));
    
    // Create ESDT transfer data
    const tokenIdentifierHex = Buffer.from(stakingToken).toString('hex');
    // Ensure even-length hex for amount
    const amountHexRaw = tokenAmount.toString(16);
    const amountHex = amountHexRaw.length % 2 === 1 ? `0${amountHexRaw}` : amountHexRaw;
    const functionName = Buffer.from('stake').toString('hex'); // Hex encode the function name
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
    
    // Convert amount to BigInt (18 decimals for most tokens)
    const tokenAmount = BigInt(parseFloat(amount) * Math.pow(10, 18));
    
    const functionName = 'unstake'; // Use plain function name for unstake
    const farmIdHex = BigInt(farmId).toString(16).padStart(2, '0'); // 2 hex digits for farm ID
    // Ensure amount hex has even length (prepend a leading 0 if odd)
    const amountHexRaw = tokenAmount.toString(16);
    const amountHex = amountHexRaw.length % 2 === 1 ? `0${amountHexRaw}` : amountHexRaw;
    
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
    
    // Use plain function name for harvest
    const functionName = 'harvest';
    const farmIdHex = BigInt(farmId).toString(16).padStart(2, '0'); // 2 hex digits for farm ID
    
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
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'calcHarvestableRewards',
        arguments: [userAddress, farmId]
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);

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
      return '0';
    }
  }
}

// Export a singleton instance
export const smartContractService = new SmartContractService();

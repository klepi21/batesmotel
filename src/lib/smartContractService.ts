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
      console.log('Fetching token pairs from API...');
      const response = await fetch('https://api.web3ninja.eu/api/pairs.php');
      const data = await response.json();
      this.tokenPairs = data;
      console.log('Token pairs loaded:', this.tokenPairs.length, 'pairs');
      return data;
    } catch (error) {
      console.error('Error fetching token pairs:', error);
      return [];
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

  async getAllFarms(): Promise<FarmInfo[]> {
    try {
      console.log('Calling getAllFarms on contract:', FARMS_CONTRACT_ADDRESS);
      
      // Fetch both LP pairs and token pairs
      await Promise.all([
        this.fetchLPPairs(),
        this.fetchTokenPairs()
      ]);
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getAllFarms',
        arguments: []
      });

      const response = await this.controller.runQuery(query);
      
      console.log('Raw query response:', response);

      const [result] = this.controller.parseQueryResponse(response);
      console.log('Parsed result with ABI:', result);

      const farms: FarmInfo[] = [];
      
      if (result && Array.isArray(result)) {
        console.log('Processing', result.length, 'farms...');
        
        for (let i = 0; i < result.length; i++) {
          const farmData = result[i];
          console.log(`Farm ${i + 1} raw data:`, farmData);
          
          if (farmData && typeof farmData === 'object') {
            const farm = farmData.field0;
            const stakingToken = farmData.field1;
            const totalStaked = farmData.field2;
            const totalRewards = farmData.field3;
            const isActive = farmData.field4;
            
            console.log(`Farm ${i + 1} parsed:`, {
              farm,
              stakingToken: stakingToken?.toString(),
              totalStaked: totalStaked?.toString(),
              totalRewards: totalRewards?.toString(),
              isActive: isActive?.valueOf()
            });
            
            // Special debugging for farm 112
            if (farm && farm.id?.toString() === '112') {
              console.log('🔍 FARM 112 DEBUG:', {
                farmId: farm.id?.toString(),
                stakingToken: stakingToken?.toString(),
                isActiveRaw: isActive,
                isActiveType: typeof isActive,
                isActiveValue: isActive?.valueOf(),
                isActiveBoolean: Boolean(isActive?.valueOf())
              });
            }
            
            if (farm) {
              const stakingTokenStr = stakingToken?.toString() || '';
              const totalStakedStr = totalStaked?.toString() || '0';
              const rewardTokenStr = farm.reward_token?.toString() || '';
              
              // Check if this is a multi-reward farm (empty reward token)
              const isMultiReward = !rewardTokenStr || rewardTokenStr === '';
              let rewardTokens: string[] = [];
              
              if (isMultiReward) {
                // Fetch multi-reward tokens
                rewardTokens = await this.getMultifarmRewardTokens(farm.id?.toString() || '0');
                console.log(`Farm ${i + 1} is multi-reward with tokens:`, rewardTokens);
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
              
              console.log(`Farm ${i + 1} price data:`, {
                stakingToken: stakingTokenStr,
                isLPToken,
                lpPrice,
                tokenPrice: isLPToken ? 'N/A' : (this.findTokenPrice(stakingTokenStr)?.tokenAprice || 'N/A'),
                totalStakedUSD
              });
              
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
                isActive: isActive?.valueOf() || false,
                lpPrice: isLPToken ? lpPrice : undefined,
                totalStakedUSD,
                rewardTokens: isMultiReward ? rewardTokens : undefined,
                isMultiReward
              };
              
              console.log(`Farm ${i + 1} final:`, farmInfo);
              
              // Special debugging for farm 112 final info
              if (farmInfo.farm.id === '112') {
                console.log('🔍 FARM 112 FINAL INFO:', {
                  id: farmInfo.farm.id,
                  stakingToken: farmInfo.stakingToken,
                  isActive: farmInfo.isActive,
                  totalStakedUSD: farmInfo.totalStakedUSD
                });
              }
              
              farms.push(farmInfo);
            }
          }
        }
      }

      console.log('Processed farms:', farms);
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
      console.log('Calling getMultifarmsRewardsLeft');
      
      const query = this.controller.createQuery({
        contract: this.contractAddress,
        function: 'getMultifarmsRewardsLeft',
        arguments: []
      });

      const response = await this.controller.runQuery(query);
      const [result] = this.controller.parseQueryResponse(response);
      
      console.log('Multifarms rewards left result:', result);

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

      console.log('Processed multifarms rewards left:', rewardsLeft);
      return rewardsLeft;
      
    } catch (error) {
      console.error('Error calling getMultifarmsRewardsLeft:', error);
      return [];
    }
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
      gasLimit: BigInt(10000000), // 10M gas limit
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
      gasLimit: BigInt(8000000), // 8M gas limit
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
      gasLimit: BigInt(6000000), // 6M gas limit
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

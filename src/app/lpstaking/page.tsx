'use client';

import { useEffect, useState } from 'react';
import { motion } from "motion/react";
import Image from 'next/image';
import { useGetAccountInfo, useGetIsLoggedIn, useGetNetworkConfig, UnlockPanelManager } from '@/lib';
import { AuthRedirectWrapper } from '@/wrappers';
import { smartContractService, FarmInfo, UserFarmInfo, UserRewardsInfo } from '@/lib/smartContractService';
import { StakingModal } from '@/components/ui/staking-modal';
import { signAndSendTransactions } from '@/helpers';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

const LpStakingPage = () => {
  const { address } = useGetAccountInfo();
  const isLoggedIn = useGetIsLoggedIn();
  const { network } = useGetNetworkConfig();
  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [userFarms, setUserFarms] = useState<UserFarmInfo[]>([]);
  const [userRewards, setUserRewards] = useState<UserRewardsInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stake' | 'unstake'>('stake');
  const [selectedFarm, setSelectedFarm] = useState<FarmInfo | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all farms
      const farmsData = await smartContractService.getAllFarms();
      setFarms(farmsData);

      // Fetch user-specific data if logged in
      if (isLoggedIn && address) {
        try {
          const userFarmsData = await smartContractService.getUserFarmInfo(address);
          setUserFarms(userFarmsData);

          const userRewardsData = await smartContractService.getUserRewardsInfo(address);
          setUserRewards(userRewardsData);
        } catch (userError) {
          console.error('Error fetching user data:', userError);
        }
      }
    } catch (err) {
      console.error('Error fetching farms data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch farms data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isLoggedIn, address]);

  // Helper function to format balance
  const formatBalance = (balance: string, decimals: number = 18) => {
    const num = parseFloat(balance) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    });
  };

  // Helper function to get user's staked balance for a farm
  const getUserStakedBalance = (farmId: string) => {
    const userFarm = userFarms.find(uf => uf.farmId === farmId);
    return userFarm ? formatBalance(userFarm.stakedBalance) : '0';
  };

  // Helper function to get user's harvestable rewards for a farm
  const getUserHarvestableRewards = (farmId: string) => {
    const userReward = userRewards.find(ur => ur.farmId === farmId);
    return userReward ? formatBalance(userReward.harvestableAmount) : '0';
  };

  // Helper function to calculate simple APR (placeholder - would need price data for real calculation)
  const calculateAPR = (farm: FarmInfo) => {
    const totalStaked = parseFloat(farm.totalStaked) / Math.pow(10, 18);
    const totalRewards = parseFloat(farm.totalRewards) / Math.pow(10, 18);
    
    if (totalStaked > 0) {
      return ((totalRewards / totalStaked) * 100).toFixed(2);
    }
    return '0.00';
  };

  // Generate a color based on farm ID for consistent styling
  const getFarmColor = (farmId: string) => {
    const colors = ['#8A2BE2', '#FF6B35', '#FF69B4', '#00CED1', '#32CD32', '#FFD700'];
    const index = parseInt(farmId) % colors.length;
    return colors[index];
  };

  // Handler functions for staking actions
  const handleStakeClick = (farm: FarmInfo) => {
    if (!isLoggedIn) {
      toast.error('Please connect your wallet first');
      return;
    }
    setSelectedFarm(farm);
    setModalType('stake');
    setModalOpen(true);
  };

  const handleUnstakeClick = (farm: FarmInfo) => {
    if (!isLoggedIn) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    const stakedBalance = getUserStakedBalance(farm.farm.id);
    if (parseFloat(stakedBalance) <= 0) {
      toast.error('No tokens staked in this farm');
      return;
    }
    
    setSelectedFarm(farm);
    setModalType('unstake');
    setModalOpen(true);
  };

  const handleHarvestClick = async (farm: FarmInfo) => {
    if (!isLoggedIn || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Check harvestable rewards
      const harvestableAmount = await smartContractService.calcHarvestableRewards(address, farm.farm.id);
      const harvestableNum = parseFloat(harvestableAmount) / Math.pow(10, 18);
      
      if (harvestableNum <= 0) {
        toast.error('No rewards available to harvest');
        return;
      }

      const transaction = smartContractService.createHarvestTransaction(
        farm.farm.id,
        address,
        network.chainId
      );

      const { sessionId } = await signAndSendTransactions({
        transactions: [transaction],
        transactionsDisplayInfo: {
          processingMessage: 'Processing harvest transaction',
          errorMessage: 'Error during harvest',
          successMessage: 'Successfully harvested rewards!'
        }
      });

      if (sessionId) {
        toast.success('Harvest transaction submitted successfully!');
        // Refresh data after successful harvest
        await fetchData();
      }
    } catch (error) {
      console.error('Error during harvest:', error);
      toast.error('Failed to harvest rewards');
    }
  };

  const handleModalSuccess = async () => {
    // Refresh data after successful transaction
    await fetchData();
  };

  // Wallet connection handler
  const handleConnectWallet = () => {
    const unlockPanelManager = UnlockPanelManager.init({
      loginHandler: () => {
        console.log('User logged in successfully');
        // Data will be refreshed automatically via useEffect dependency on isLoggedIn
      },
      onClose: () => {
        console.log('Unlock panel closed');
      }
    });
    
    unlockPanelManager.openUnlockPanel();
  };

  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="min-h-screen bg-black relative">
        {/* Mobile Background Image */}
        <div className="absolute inset-0 sm:hidden -z-10">
          <Image
            src="/assets/img/mob/LP Roommob.png"
            alt="LP Staking Rooms Mobile Background"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-black bg-opacity-70"></div>
        </div>
        <Toaster 
          theme="dark" 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              color: 'white',
            },
          }}
        />
        {/* Header */}
        <div className="bg-black/90 backdrop-blur-md border-b-2 border-purple-500/50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="text-center">
              <motion.h1
                className="text-3xl md:text-4xl lg:text-5xl font-bold text-purple-500 font-mono mb-2 tracking-wider"
                style={{ 
                  textShadow: '0 0 10px #8A2BE2, 0 0 20px #8A2BE2',
                  letterSpacing: '0.2em'
                }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                LP STAKING ROOMS
              </motion.h1>
              <motion.p
                className="text-lg text-gray-400 font-mono tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Stake your LP tokens and earn higher rewards
              </motion.p>
              <motion.div
                className="text-sm text-gray-500 mt-2 font-mono tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                {isLoggedIn && address ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Smart Contract Data Display */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Connection Status */}
          {!isLoggedIn && (
            <div className="mb-8">
              <motion.div
                className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/50 rounded-lg p-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h3 className="text-xl font-bold text-purple-400 font-mono mb-2 tracking-wide">
                  Connect Your Wallet
                </h3>
                <p className="text-gray-300 font-mono tracking-wide mb-4">
                  Connect your wallet to view real-time staking data and interact with the smart contract.
                </p>
                <motion.button
                  onClick={handleConnectWallet}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold font-mono tracking-wider border-2 border-purple-400 rounded-lg transition-all duration-300"
                  style={{
                    boxShadow: '0 0 20px rgba(147, 51, 234, 0.5), 0 0 40px rgba(147, 51, 234, 0.3)',
                    textShadow: '0 0 10px rgba(147, 51, 234, 0.8)',
                    imageRendering: 'pixelated'
                  }}
                  whileHover={{
                    boxShadow: '0 0 30px rgba(147, 51, 234, 0.7), 0 0 60px rgba(147, 51, 234, 0.5)',
                    scale: 1.05
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  CONNECT WALLET
                </motion.button>
              </motion.div>
            </div>
          )}

          {/* Smart Contract Farms */}
          <div className="mb-8">
            {loading && (
              <div className="text-center py-8">
                <div className="text-yellow-400 font-mono tracking-wide">Loading farms from blockchain...</div>
              </div>
            )}
            
            {error && (
              <div className="text-center py-8">
                <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 mb-4">
                  <div className="text-red-400 font-mono tracking-wide mb-2">Smart Contract Error</div>
                  <div className="text-gray-300 font-mono tracking-wide text-sm">{error}</div>
                </div>
              </div>
            )}
            
            {!loading && !error && farms.length > 0 && (
              <div className="bg-gray-900 border border-purple-500 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {/* Filter farms to show only USDC farms and hide farm #43 */}
                  {farms
                    .filter(farm => farm.stakingToken.includes('USDC'))
                    .filter(farm => farm.farm.id !== '43')
                    .map((farm, index) => {
                    const farmColor = getFarmColor(farm.farm.id);
                    return (
                      <motion.div
                        key={farm.farm.id}
                        className="relative bg-gradient-to-b from-gray-900 to-black border-4 p-6 font-mono"
                        style={{
                          borderColor: farmColor,
                          boxShadow: `0 0 20px ${farmColor}20, inset 0 0 20px ${farmColor}10`,
                          imageRendering: 'pixelated',
                          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                        }}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                      >
                        {/* Farm Header */}
                        <div className="text-center mb-6">
                          <h3 className="text-xl font-bold text-white font-mono mb-2 tracking-wide" style={{ 
                            textShadow: `0 0 5px ${farmColor}`,
                            letterSpacing: '0.1em'
                          }}>
                            Farm #{farm.farm.id}
                          </h3>
                          <div className="text-3xl font-bold font-mono tracking-wider" style={{ 
                            color: farmColor,
                            textShadow: `0 0 10px ${farmColor}, 0 0 20px ${farmColor}`,
                            letterSpacing: '0.1em'
                          }}>
                            {calculateAPR(farm)}% APR
                          </div>
                          <div className="text-sm text-gray-400 font-mono tracking-wide mt-1">
                            <div className="flex items-center justify-center space-x-2">
                              {/* For LP tokens, show the underlying tokens */}
                              {(() => {
                                // Find the LP pair to get token1lp and token2lp
                                const lpPair = farms.find(f => f.stakingToken === farm.stakingToken)?.lpPrice ? 
                                  smartContractService.findLPPair(farm.stakingToken) : null;
                                
                                if (lpPair) {
                                  // Show the two underlying tokens on the left, reward tokens on the right
                                  return (
                                    <>
                                      <img 
                                        src={`https://tools.multiversx.com/assets-cdn/tokens/${lpPair.token1lp}/icon.png`}
                                        alt={lpPair.token1lp}
                                        className="w-6 h-6 rounded-full"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                      <img 
                                        src={`https://tools.multiversx.com/assets-cdn/tokens/${lpPair.token2lp}/icon.png`}
                                        alt={lpPair.token2lp}
                                        className="w-6 h-6 rounded-full"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                      <span>/</span>
                                      {/* Show multiple reward tokens for multi-reward farms */}
                                      {farm.isMultiReward && farm.rewardTokens ? (
                                        <div className="flex space-x-1">
                                          {farm.rewardTokens.map((token: string, index: number) => (
                                            <img 
                                              key={index}
                                              src={`https://tools.multiversx.com/assets-cdn/tokens/${token}/icon.png`}
                                              alt={token}
                                              className="w-6 h-6 rounded-full"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <img 
                                          src={`https://tools.multiversx.com/assets-cdn/tokens/${farm.farm.reward_token}/icon.png`}
                                          alt={farm.farm.reward_token}
                                          className="w-6 h-6 rounded-full"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      )}
                                    </>
                                  );
                                } else {
                                  // Fallback to original staking token
                                  return (
                                    <>
                                      <img 
                                        src={`https://tools.multiversx.com/assets-cdn/tokens/${farm.stakingToken}/icon.png`}
                                        alt={farm.stakingToken}
                                        className="w-6 h-6 rounded-full"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                      <span>/</span>
                                      {/* Show multiple reward tokens for multi-reward farms */}
                                      {farm.isMultiReward && farm.rewardTokens ? (
                                        <div className="flex space-x-1">
                                          {farm.rewardTokens.map((token: string, index: number) => (
                                            <img 
                                              key={index}
                                              src={`https://tools.multiversx.com/assets-cdn/tokens/${token}/icon.png`}
                                              alt={token}
                                              className="w-6 h-6 rounded-full"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                              }}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <img 
                                          src={`https://tools.multiversx.com/assets-cdn/tokens/${farm.farm.reward_token}/icon.png`}
                                          alt={farm.farm.reward_token}
                                          className="w-6 h-6 rounded-full"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      )}
                                    </>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Farm Stats */}
                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">Total Staked:</span>
                            <span className="text-white font-mono tracking-wide">
                              {farm.totalStakedUSD && farm.totalStakedUSD > 0 
                                ? `$${farm.totalStakedUSD.toFixed(2)}` 
                                : formatBalance(farm.totalStaked)
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">My Staked:</span>
                            <span className="text-white font-mono tracking-wide">
                              {formatBalance(getUserStakedBalance(farm.farm.id))}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">My Rewards:</span>
                            <span className="text-yellow-400 font-mono tracking-wide">
                              {formatBalance(getUserHarvestableRewards(farm.farm.id))}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">Status:</span>
                            <span className={`font-mono tracking-wide ${farm.isActive ? 'text-green-400' : 'text-red-400'}`}>
                              {farm.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                          <button
                            onClick={() => handleStakeClick(farm)}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold transition-colors font-mono border-2 border-green-500 tracking-wide"
                            style={{ imageRendering: 'pixelated' }}
                          >
                            STAKE
                          </button>
                          <button
                            onClick={() => handleUnstakeClick(farm)}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold transition-colors font-mono border-2 border-red-500 tracking-wide"
                            style={{ imageRendering: 'pixelated' }}
                          >
                            UNSTAKE
                          </button>
                          <button
                            onClick={() => handleHarvestClick(farm)}
                            className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold transition-colors font-mono border-2 border-yellow-500 tracking-wide"
                            style={{ imageRendering: 'pixelated' }}
                          >
                            HARVEST
                          </button>
                        </div>

                        {/* Pixel Art Border Effect */}
                        <div
                          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                          style={{
                            background: `repeating-linear-gradient(
                              0deg,
                              transparent,
                              transparent 2px,
                              ${farmColor}20 2px,
                              ${farmColor}20 4px
                            )`,
                            boxShadow: `0 0 30px ${farmColor}40, inset 0 0 20px ${farmColor}20`
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
                
                {/* Enter Elevator Button */}
                <div className="text-center mt-8">
                  <motion.button
                    onClick={() => window.location.href = '/motel'}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold font-mono tracking-wider border-2 border-purple-400 rounded-lg transition-all duration-300 transform hover:scale-105"
                    style={{
                      boxShadow: '0 0 20px rgba(147, 51, 234, 0.5), 0 0 40px rgba(147, 51, 234, 0.3)',
                      textShadow: '0 0 10px rgba(147, 51, 234, 0.8)',
                      imageRendering: 'pixelated'
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    whileHover={{
                      boxShadow: '0 0 30px rgba(147, 51, 234, 0.7), 0 0 60px rgba(147, 51, 234, 0.5)',
                      scale: 1.05
                    }}
                  >
                    ENTER ELEVATOR
                  </motion.button>
                </div>
              </div>
            )}
            
            {!loading && !error && farms.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 font-mono tracking-wide">No farms found in the smart contract.</div>
              </div>
            )}
          </div>
        </div>

        {/* Staking Modal */}
        {selectedFarm && (
          <StakingModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            modalType={modalType}
            farmId={selectedFarm.farm.id}
            stakingToken={selectedFarm.stakingToken}
            userStakedBalance={getUserStakedBalance(selectedFarm.farm.id)}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </AuthRedirectWrapper>
  );
};

export default LpStakingPage;


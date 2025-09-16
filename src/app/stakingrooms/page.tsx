"use client"

import React, { useState, useEffect } from 'react';
import { motion } from "motion/react";
import Image from 'next/image';
import { AuthRedirectWrapper } from '@/wrappers';
import { useGetAccountInfo, useGetIsLoggedIn, useGetNetworkConfig, UnlockPanelManager } from '@/lib';
import { smartContractService, FarmInfo, UserFarmInfo, UserRewardsInfo } from '@/lib/smartContractService';
import { StakingModal } from '@/components/ui/staking-modal';
import { signAndSendTransactions } from '@/helpers';
import { toast } from 'sonner';
import { Toaster } from 'sonner';

const StakingRoomsPage = () => {
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccountInfo();
  const { network } = useGetNetworkConfig();
  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFarms, setUserFarms] = useState<UserFarmInfo[]>([]);
  const [userRewards, setUserRewards] = useState<UserRewardsInfo[]>([]);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stake' | 'unstake'>('stake');
  const [selectedFarm, setSelectedFarm] = useState<FarmInfo | null>(null);

  const fetchData = async () => {
    try {
        setLoading(true);
        setError(null);

        // Fetch all farms data
        const farmsData = await smartContractService.getAllFarms();
        
        // Log farm 115 specifically from the fetched data
        const farm115 = farmsData.find(farm => farm.farm.id === '115');
        if (farm115) {
          console.log('🔍 STAKING PAGE - FARM 115 FROM FETCH:', farm115);
        } else {
          console.log('🔍 STAKING PAGE - FARM 115 NOT FOUND in fetched data');
          console.log('Available farms:', farmsData.map(f => f.farm.id));
        }
        
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
  const formatBalance = (balance: string, decimals: number = 18): string => {
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
      } else {
        return num.toFixed(2);
      }
    } catch {
      return '0';
    }
  };

  // Helper function to get user staked balance for a specific farm
  const getUserStakedBalance = (farmId: string): string => {
    const userFarm = userFarms.find(uf => uf.farmId === farmId);
    return userFarm ? userFarm.stakedBalance : '0';
  };

  // Helper function to get user harvestable rewards for a specific farm
  const getUserHarvestableRewards = (farmId: string): string => {
    const userReward = userRewards.find(ur => ur.farmId === farmId);
    return userReward ? userReward.harvestableAmount : '0';
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

  // APR calculation - use calculated APR for multi-farms, simple calculation for others
  const calculateAPR = (farm: FarmInfo): number => {
    try {
      // For multi-farm pools, use the calculated APR from smart contract service
      if (farm.isMultiReward && farm.calculatedAPR !== undefined) {
        console.log(`Using calculated APR for farm ${farm.farm.id}:`, farm.calculatedAPR);
        return farm.calculatedAPR;
      }
      
      // For regular farms, use simple calculation
      const totalStaked = parseFloat(farm.totalStaked) / Math.pow(10, 18);
      const totalRewards = parseFloat(farm.totalRewards) / Math.pow(10, 18);
      
      if (totalStaked === 0) return 0;
      
      // Simple APR calculation (annualized)
      const apr = (totalRewards / totalStaked) * 100 * 365;
      return Math.min(apr, 999); // Cap at 999%
    } catch {
      return 0;
    }
  };

  // Get unique color for each farm
  const getFarmColor = (farmId: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    const index = parseInt(farmId) % colors.length;
    return colors[index];
  };

  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="min-h-screen bg-black relative">
        {/* Mobile Background Image */}
        <div className="absolute inset-0 sm:hidden -z-10">
          <Image
            src="/assets/img/mob/Staking Roommob.png"
            alt="Staking Rooms Mobile Background"
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
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="text-center">
              <motion.h1
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-purple-500 font-mono mb-1 sm:mb-2 tracking-wider"
                style={{ 
                  textShadow: '0 0 10px #8A2BE2, 0 0 20px #8A2BE2',
                  letterSpacing: '0.2em'
                }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                STAKING ROOMS
              </motion.h1>
              <motion.p
                className="text-sm sm:text-lg text-gray-400 font-mono tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Single token staking pools
              </motion.p>
              <motion.div
                className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 font-mono tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                {isLoggedIn && address ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          {/* Connection Status */}
          {!isLoggedIn && (
            <div className="mb-6 sm:mb-8">
              <motion.div
                className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/50 rounded-lg p-4 sm:p-6 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h3 className="text-lg sm:text-xl font-bold text-purple-400 font-mono mb-2 tracking-wide">
                  Connect Your Wallet
                </h3>
                <p className="text-sm sm:text-base text-gray-300 font-mono tracking-wide mb-3 sm:mb-4">
                  Connect your wallet to view real-time staking data and interact with the staking pools.
                </p>
                <motion.button
                  onClick={handleConnectWallet}
                  className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold font-mono tracking-wider border-2 border-purple-400 rounded-lg transition-all duration-300 text-sm sm:text-base"
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
              <div className="bg-gray-900 border border-purple-500 rounded-lg p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {/* Filter farms to show ONLY farm 115 */}
                  {farms
                    .filter(farm => farm.farm.id === '115')
                    .map((farm, index) => {
                    const farmColor = getFarmColor(farm.farm.id);
                    
                    // Detailed logging for farm 115
                    console.log('🔍 STAKING PAGE - FARM 115 DETAILED INFO:', {
                      farmId: farm.farm.id,
                      stakingToken: farm.stakingToken,
                      totalStaked: farm.totalStaked,
                      totalRewards: farm.totalRewards,
                      isActive: farm.isActive,
                      isMultiReward: farm.isMultiReward,
                      rewardTokens: farm.rewardTokens,
                      totalStakedUSD: farm.totalStakedUSD,
                      farm: farm.farm,
                      fullFarmObject: farm
                    });
                    
                    return (
                      <motion.div
                        key={farm.farm.id}
                        className="relative bg-gradient-to-b from-gray-900 to-black border-2 sm:border-4 p-4 sm:p-6 font-mono"
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
                        <div className="text-center mb-4 sm:mb-6">
                          <h3 className="text-lg sm:text-xl font-bold text-white font-mono mb-1 sm:mb-2 tracking-wide" style={{ 
                            textShadow: `0 0 5px ${farmColor}`,
                            letterSpacing: '0.1em'
                          }}>
                            Farm #{farm.farm.id}
                          </h3>
                          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-wider" style={{ 
                            color: farmColor,
                            textShadow: `0 0 10px ${farmColor}, 0 0 20px ${farmColor}`,
                            letterSpacing: '0.1em'
                          }}>
                            {calculateAPR(farm)}% APR
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400 font-mono tracking-wide mt-1">
                            <div className="flex items-center justify-center space-x-2">
                              {/* For single token staking, show staking token and reward token */}
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
                            </div>
                          </div>
                        </div>

                        {/* Farm Stats */}
                        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">Total Staked:</span>
                            <span className="text-white font-mono tracking-wide">
                              {farm.totalStakedUSD && farm.totalStakedUSD > 0 
                                ? `$${farm.totalStakedUSD.toFixed(2)}` 
                                : formatBalance(farm.totalStaked, farm.stakingToken === 'LOKD-ff8f08' ? 6 : 18)
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">My Staked:</span>
                            <span className="text-white font-mono tracking-wide">
                              {formatBalance(getUserStakedBalance(farm.farm.id), farm.stakingToken === 'LOKD-ff8f08' ? 6 : 18)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">My Rewards:</span>
                            <span className="text-yellow-400 font-mono tracking-wide">
                              {formatBalance(getUserHarvestableRewards(farm.farm.id), farm.stakingToken === 'LOKD-ff8f08' ? 6 : 18)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">Status:</span>
                            <span className={`font-mono tracking-wide ${farm.isActive ? 'text-green-400' : 'text-red-400'}`}>
                              {farm.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 sm:space-y-3">
                          <button
                            onClick={() => handleStakeClick(farm)}
                            className="w-full py-2 sm:py-3 bg-green-600 hover:bg-green-700 text-white font-bold transition-colors font-mono border-2 border-green-500 tracking-wide text-xs sm:text-sm"
                            style={{ imageRendering: 'pixelated' }}
                          >
                            STAKE
                          </button>
                          <button
                            onClick={() => handleUnstakeClick(farm)}
                            className="w-full py-2 sm:py-3 bg-red-600 hover:bg-red-700 text-white font-bold transition-colors font-mono border-2 border-red-500 tracking-wide text-xs sm:text-sm"
                            style={{ imageRendering: 'pixelated' }}
                          >
                            UNSTAKE
                          </button>
                          <button
                            onClick={() => handleHarvestClick(farm)}
                            className="w-full py-2 sm:py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold transition-colors font-mono border-2 border-yellow-500 tracking-wide text-xs sm:text-sm"
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
                <div className="text-center mt-6 sm:mt-8">
                  <motion.button
                    onClick={() => window.location.href = '/motel'}
                    className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold font-mono tracking-wider border-2 border-purple-400 rounded-lg transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
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

export default StakingRoomsPage;

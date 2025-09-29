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
import { useRouter, useSearchParams } from 'next/navigation';
import { RouteNamesEnum } from '@/localConstants';

const StakingRoomsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccountInfo();
  const { network } = useGetNetworkConfig();
  // Dev-only override via query: ?forcetest=erd1...
  const forcedAddressParam = searchParams?.get('forcetest');
  const forcedAddress = forcedAddressParam && forcedAddressParam.startsWith('erd1') ? forcedAddressParam : null;
  const effectiveAddress = forcedAddress || address;
  const effectiveIsLoggedIn = !!(forcedAddress || isLoggedIn);

  const [farms, setFarms] = useState<FarmInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFarms, setUserFarms] = useState<UserFarmInfo[]>([]);
  const [userRewards, setUserRewards] = useState<UserRewardsInfo[]>([]);
  const [hasEnoughRare, setHasEnoughRare] = useState<boolean>(false);
  
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
        
        // Filter to show only farm IDs: 117, 118, 119, 120, 121
        const allowedFarmIds = ['117', '118', '119', '120', '121'];
        const filteredFarms = farmsData.filter(farm => allowedFarmIds.includes(farm.farm.id));
        
        setFarms(filteredFarms);

        // Fetch user-specific data if logged in
        if (effectiveIsLoggedIn && effectiveAddress) {
          try {
            const userFarmsData = await smartContractService.getUserFarmInfo(effectiveAddress);
            setUserFarms(userFarmsData);

            const userRewardsData = await smartContractService.getUserRewardsInfo(effectiveAddress);
            setUserRewards(userRewardsData);

            // Check if user has enough RARE tokens (10 RARE required)
            const hasRare = await smartContractService.hasEnoughRareTokens(effectiveAddress);
            setHasEnoughRare(hasRare);
          } catch (userError) {
            // Error fetching user data
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch farms data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isLoggedIn, address, forcedAddress]);

  // Helper function to format balance
  const formatBalance = (balance: string, decimals: number = 18): string => {
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      return num.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 18 
      });
    } catch {
      return '0';
    }
  };

  // Helper function to get token image URL with manual fallbacks
  const getTokenImageUrl = (tokenIdentifier: string): string => {
    // Manual token identifiers for specific farms - use CDN URLs with specific identifiers
    const manualTokenIdentifiers: { [key: string]: string } = {
      'DBATES-78f441': 'https://tools.multiversx.com/assets-cdn/tokens/DBATES-78f441/icon.png',
      'BATES-bb3dd6': 'https://tools.multiversx.com/assets-cdn/tokens/BATES-bb3dd6/icon.png'
    };

    // Use manual identifier if available, otherwise use the original
    if (manualTokenIdentifiers[tokenIdentifier]) {
      return manualTokenIdentifiers[tokenIdentifier];
    }

    return `https://tools.multiversx.com/assets-cdn/tokens/${tokenIdentifier}/icon.png`;
  };

  // Helper functions for address actions
  const copyAddressToClipboard = async () => {
    if (effectiveAddress) {
      try {
        await navigator.clipboard.writeText(effectiveAddress);
        toast.success('Address copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy address');
      }
    }
  };

  const openAddressInExplorer = () => {
    if (effectiveAddress) {
      const explorerUrl = `${network.explorerAddress}/accounts/${effectiveAddress}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const handleDisconnect = () => {
    // Redirect to logout page using router
    router.push(RouteNamesEnum.logout);
  };

  // Helper function to get user staked balance for a specific farm
  const getUserStakedBalance = (farmId: string, stakingToken?: string): string => {
    const userFarm = userFarms.find(uf => uf.farmId === farmId);
    if (!userFarm) return '0';
    
    // Use correct decimals for the staking token
    let decimals = 18; // Default to 18 decimals
    
    if (stakingToken) {
      // Check for specific tokens with different decimals
      if (stakingToken === 'LOKD-ff8f08') {
        decimals = 6;
      } else if (stakingToken === 'TCX-8d448d') {
        decimals = 8; // TCX has 8 decimals
      } else if (stakingToken === 'TCXWEGLD-f1f2b1') {
        decimals = 18; // TCXWEGLD LP token has 18 decimals
      } else if (stakingToken.includes('USDC') || stakingToken.includes('USDT')) {
        decimals = 6; // USDC/USDT typically have 6 decimals
      }
    }
    
    return formatBalance(userFarm.stakedBalance, decimals);
  };

  // Helper function to get user harvestable rewards for a specific farm
  const getUserHarvestableRewards = (farmId: string): string => {
    const userReward = userRewards.find(ur => ur.farmId === farmId);
    return userReward ? userReward.harvestableAmount : '0';
  };

  // Helper: get all rewards per token for a farm (for multi-reward farms)
  const getUserRewardsByFarm = (farmId: string): { token: string; amount: string; decimals: number }[] => {
    const rewards = userRewards.filter(ur => ur.farmId === farmId);
    return rewards.map(r => ({ token: r.rewardToken, amount: r.harvestableAmount, decimals: smartContractService.getTokenDecimals(r.rewardToken) }));
  };

  // Handler functions for staking actions
  const handleStakeClick = (farm: FarmInfo) => {
    if (!isLoggedIn) {
      toast.error('Please connect your wallet first');
      return;
    }
    if (!hasEnoughRare) {
      toast.error('You need at least 10 RARE tokens to perform this action');
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
    if (!hasEnoughRare) {
      toast.error('You need at least 10 RARE tokens to perform this action');
      return;
    }
    
    const stakedBalance = getUserStakedBalance(farm.farm.id, farm.stakingToken);
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
    if (!hasEnoughRare) {
      toast.error('You need at least 10 RARE tokens to perform this action');
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

      // Create RARE fee transaction first
      const rareFeeTransaction = smartContractService.createRareFeeTransaction(
        address,
        network.chainId
      );

      // Create harvest transaction
      const harvestTransaction = smartContractService.createHarvestTransaction(
        farm.farm.id,
        address,
        network.chainId
      );

      const { sessionId } = await signAndSendTransactions({
        transactions: [rareFeeTransaction, harvestTransaction],
        transactionsDisplayInfo: {
          processingMessage: 'Processing harvest transaction with RARE fee',
          errorMessage: 'Error during harvest',
          successMessage: 'Successfully harvested rewards! (10 RARE fee paid)'
        }
      });

      if (sessionId) {
        toast.success('Harvest transaction submitted successfully! (10 RARE fee paid)');
        // Refresh data after successful harvest
        await fetchData();
      }
    } catch (error) {
      // Error during harvest
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
        // User logged in successfully
        // Data will be refreshed automatically via useEffect dependency on isLoggedIn
      },
      onClose: () => {
        // Unlock panel closed
      }
    });
    
    unlockPanelManager.openUnlockPanel();
  };

  // APR calculation - use calculated APR for multi-farms, simple calculation for others
  const calculateAPR = (farm: FarmInfo): number => {
    try {
      // For multi-farm pools, use the calculated APR from smart contract service
      if (farm.isMultiReward && farm.calculatedAPR !== undefined) {
        // Using calculated APR
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

  // Get token symbol from token identifier
  const getTokenSymbol = (tokenIdentifier: string): string => {
    return tokenIdentifier.split('-')[0];
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
                className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 font-mono tracking-wide flex items-center justify-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <span>
                  {effectiveIsLoggedIn && effectiveAddress ? `Connected: ${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}` : 'Not connected'}
                </span>
                {effectiveIsLoggedIn && effectiveAddress && (
                  <div className="flex items-center gap-1 ml-2">
                    {/* Copy Address Button */}
                    <button
                      onClick={copyAddressToClipboard}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Copy address to clipboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    
                    {/* Open in Explorer Button */}
                    <button
                      onClick={openAddressInExplorer}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Open address in explorer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    
                    {/* Disconnect Button */}
                    <button
                      onClick={handleDisconnect}
                      className="p-1 hover:bg-red-700 rounded transition-colors"
                      title="Disconnect wallet"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </div>
                )}
              </motion.div>
              {effectiveIsLoggedIn && (
                <motion.div
                  className="text-xs text-gray-500 mt-1 font-mono tracking-wide flex items-center justify-center space-x-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  <span>RARE Fee Status: {hasEnoughRare ? '✅ Ready (≥10 RARE)' : '❌ Insufficient (<10 RARE)'}</span>
                  <button
                    onClick={async () => {
                      if (effectiveAddress) {
                        const hasRare = await smartContractService.hasEnoughRareTokens(effectiveAddress);
                        setHasEnoughRare(hasRare);
                      }
                    }}
                    className="text-purple-400 hover:text-purple-300 underline"
                  >
                    🔄
                  </button>
                </motion.div>
              )}
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
                  {/* Filter farms to show ONLY farm IDs 117, 118, 119, 120, 121 */}
                  {farms
                    .filter(farm => ['117', '118', '119', '120', '121'].includes(farm.farm.id))
                    .map((farm, index) => {
                    const farmColor = getFarmColor(farm.farm.id);
                    
                    // Debug logging for farm tokens
                    if (farm.farm.id === '118' || farm.farm.id === '120') {
                      console.log(`Farm ${farm.farm.id} staking token:`, farm.stakingToken);
                    }
                    
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
                                src={getTokenImageUrl(farm.stakingToken)}
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
                            <div className="flex items-center space-x-2 text-white font-mono tracking-wide">
                              {farm.totalStakedUSD && farm.totalStakedUSD > 0 ? (
                                <>
                                  <span>${farm.totalStakedUSD.toFixed(2)}</span>
                                  <span className="text-gray-400">(</span>
                                  <div className="flex items-center space-x-1">
                                    <img 
                                      src={getTokenImageUrl(farm.stakingToken)}
                                      alt={farm.stakingToken}
                                      className="w-4 h-4 rounded-full"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <span>{formatBalance(farm.totalStaked, farm.stakingToken === 'LOKD-ff8f08' ? 6 : 18)}</span>
                                  </div>
                                  <span className="text-gray-400">)</span>
                                </>
                              ) : (
                                  <div className="flex items-center space-x-1">
                                    <img 
                                      src={getTokenImageUrl(farm.stakingToken)}
                                      alt={farm.stakingToken}
                                      className="w-4 h-4 rounded-full"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <span>{formatBalance(farm.totalStaked, farm.stakingToken === 'LOKD-ff8f08' ? 6 : 18)}</span>
                                  </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">My Staked:</span>
                            <span className="text-white font-mono tracking-wide">
                              {getUserStakedBalance(farm.farm.id, farm.stakingToken)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">My Rewards:</span>
                            <span className="text-yellow-400 font-mono tracking-wide">
                              {!farm.isMultiReward ? (
                                formatBalance(getUserHarvestableRewards(farm.farm.id), farm.stakingToken === 'LOKD-ff8f08' ? 6 : 18)
                              ) : (
                                <span className="block text-right">
                                  {getUserRewardsByFarm(farm.farm.id).length === 0 && '0'}
                                  {getUserRewardsByFarm(farm.farm.id).map((r, idx) => (
                                    <span key={r.token + idx} className="flex items-center justify-end gap-1">
                                      <img
                                        src={`https://tools.multiversx.com/assets-cdn/tokens/${r.token}/icon.png`}
                                        alt={r.token}
                                        className="w-4 h-4 rounded-full"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <span>{formatBalance(r.amount, r.decimals)}</span>
                                      <span className="text-gray-400">{r.token.split('-')[0]}</span>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">Status:</span>
                            <span className={`font-mono tracking-wide ${farm.isActive ? 'text-green-400' : 'text-red-400'}`}>
                              {farm.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 font-mono tracking-wide">Fee Required:</span>
                            <span className={`font-mono tracking-wide ${hasEnoughRare ? 'text-green-400' : 'text-red-400'}`}>
                              {hasEnoughRare ? '10 RARE ✓' : '10 RARE ✗'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 sm:space-y-3">
                          <button
                            onClick={() => handleStakeClick(farm)}
                            disabled={!hasEnoughRare}
                            className={`w-full py-2 sm:py-3 font-bold transition-colors font-mono border-2 tracking-wide text-xs sm:text-sm ${
                              !hasEnoughRare
                                ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white border-green-500'
                            }`}
                            style={{ imageRendering: 'pixelated' }}
                            title={!hasEnoughRare ? 'You need at least 10 RARE tokens to stake' : ''}
                          >
                            STAKE
                          </button>
                          
                          {/* Unstake Button - Disabled if no tokens staked or no RARE */}
                          <button
                            onClick={() => handleUnstakeClick(farm)}
                            disabled={parseFloat(getUserStakedBalance(farm.farm.id, farm.stakingToken)) <= 0 || !hasEnoughRare}
                            className={`w-full py-2 sm:py-3 font-bold transition-colors font-mono border-2 tracking-wide text-xs sm:text-sm ${
                              parseFloat(getUserStakedBalance(farm.farm.id, farm.stakingToken)) <= 0 || !hasEnoughRare
                                ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white border-red-500'
                            }`}
                            style={{ imageRendering: 'pixelated' }}
                            title={
                              !hasEnoughRare 
                                ? 'You need at least 10 RARE tokens to unstake'
                                : parseFloat(getUserStakedBalance(farm.farm.id, farm.stakingToken)) <= 0
                                ? 'No tokens staked in this farm'
                                : ''
                            }
                          >
                            UNSTAKE
                          </button>
                          
                          {/* Harvest Button - Disabled if no rewards available or no RARE */}
                          <button
                            onClick={() => handleHarvestClick(farm)}
                            disabled={parseFloat(getUserHarvestableRewards(farm.farm.id)) <= 0 || !hasEnoughRare}
                            className={`w-full py-2 sm:py-3 font-bold transition-colors font-mono border-2 tracking-wide text-xs sm:text-sm ${
                              parseFloat(getUserHarvestableRewards(farm.farm.id)) <= 0 || !hasEnoughRare
                                ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed'
                                : 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-500'
                            }`}
                            style={{ imageRendering: 'pixelated' }}
                            title={
                              !hasEnoughRare 
                                ? 'You need at least 10 RARE tokens to harvest'
                                : parseFloat(getUserHarvestableRewards(farm.farm.id)) <= 0
                                ? 'No rewards available to harvest'
                                : ''
                            }
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
            userStakedBalance={getUserStakedBalance(selectedFarm.farm.id, selectedFarm.stakingToken)}
            addressOverride={effectiveAddress || undefined}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </AuthRedirectWrapper>
  );
};

export default StakingRoomsPage;

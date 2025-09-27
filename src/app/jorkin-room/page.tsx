'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from "motion/react";
import Image from 'next/image';
import { useGetAccountInfo, useGetIsLoggedIn, useGetNetworkConfig, UnlockPanelManager } from '@/lib';
import { AuthRedirectWrapper } from '@/wrappers';
import { smartContractService, FarmInfo, UserFarmInfo, UserRewardsInfo } from '@/lib/smartContractService';
import { StakingModal } from '@/components/ui/staking-modal';
import { signAndSendTransactions } from '@/helpers';
import { toast, Toaster } from 'sonner';
import { useRouter } from 'next/navigation';
import { RouteNamesEnum } from '@/localConstants';

const JorkinRoomPage = () => {
  const router = useRouter();
  const { address } = useGetAccountInfo();
  const isLoggedIn = useGetIsLoggedIn();
  const { network } = useGetNetworkConfig();

  const [farm116, setFarm116] = useState<FarmInfo | null>(null);
  const [userFarms, setUserFarms] = useState<UserFarmInfo[]>([]);
  const [userRewards, setUserRewards] = useState<UserRewardsInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasEnoughRare, setHasEnoughRare] = useState<boolean>(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'stake' | 'unstake'>('stake');
  const [selectedFarm, setSelectedFarm] = useState<FarmInfo | null>(null);

  // Click game state
  const [clickCount, setClickCount] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0); // milliseconds
  const timerRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);
  const clickCountRef = useRef<number>(0);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clickAreaRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [emojiBursts, setEmojiBursts] = useState<Array<{ id: number; x: number; y: number; vx: number; vy: number; rot: number; char: string; size: number; duration: number; delay: number }>>([]);
  const EMOJIS = ["🍆","🍑","😩","👉","👌","💦","🔞","🤤","🍌","👙","🍑","👙"];

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const farmsData = await smartContractService.getAllFarms();
      
      const only127 = farmsData.find(f => f.farm.id === '127') || null;
      
      // Debug logging for farm 127
      if (only127) {
        console.log('=== JORKIN ROOM - FARM 127 DATA ===');
        console.log('Farm 127 complete data:', only127);
        console.log('Farm 127 isMultiReward:', only127.isMultiReward);
        console.log('Farm 127 rewardTokens:', only127.rewardTokens);
        console.log('Farm 127 calculatedAPR:', only127.calculatedAPR);
        console.log('Farm 127 totalStaked:', only127.totalStaked);
        console.log('Farm 127 totalRewards:', only127.totalRewards);
        console.log('Farm 127 stakingToken:', only127.stakingToken);
        console.log('Farm 127 isActive:', only127.isActive);
      }
      
      setFarm116(only127);

      if (isLoggedIn && address) {
        try {
          const userFarmsData = await smartContractService.getUserFarmInfo(address);
          setUserFarms(userFarmsData);

          const userRewardsData = await smartContractService.getUserRewardsInfo(address);
          
          
          setUserRewards(userRewardsData);

          const hasRare = await smartContractService.hasEnoughRareTokens(address);
          setHasEnoughRare(hasRare);
        } catch (userError) {
          // ignore user-specific errors here
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
  }, [isLoggedIn, address]);

  function formatBalance(balance: string, decimals: number = 18) {
    const num = parseFloat(balance) / Math.pow(10, decimals);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  function getUserStakedBalance(farmId: string) {
    const userFarm = userFarms.find(uf => uf.farmId === farmId);
    return userFarm ? formatBalance(userFarm.stakedBalance) : '0';
  }

  function getUserHarvestableRewards(farmId: string) {
    const userReward = userRewards.find(ur => ur.farmId === farmId);
    return userReward ? formatBalance(userReward.harvestableAmount) : '0';
  }

  // Per-token rewards for multi-reward farms
  function getUserRewardsByFarm(farmId: string): { token: string; amount: string; decimals: number }[] {
    return userRewards
      .filter(ur => ur.farmId === farmId)
      .map(r => ({ token: r.rewardToken, amount: r.harvestableAmount, decimals: smartContractService.getTokenDecimals(r.rewardToken) }));
  }

  // Helper function to get token image URL with manual fallbacks
  const getTokenImageUrl = (tokenIdentifier: string): string => {
    // Manual token identifiers for specific farms - use CDN URLs with specific identifiers
    const manualTokenIdentifiers: { [key: string]: string } = {
      'DBATES-78f441': 'https://tools.multiversx.com/assets-cdn/tokens/DBATES-78f441/icon.png',
      'BATES-bb3dd6': 'https://tools.multiversx.com/assets-cdn/tokens/BATES-bb3dd6/icon.png',
      'JORKIN-7d6f75': 'https://tools.multiversx.com/assets-cdn/tokens/JORKIN-7d6f75/icon.png'
    };

    // Use manual identifier if available, otherwise use the original
    if (manualTokenIdentifiers[tokenIdentifier]) {
      return manualTokenIdentifiers[tokenIdentifier];
    }

    return `https://tools.multiversx.com/assets-cdn/tokens/${tokenIdentifier}/icon.png`;
  };

  // Helper function to get LP pair tokens for farm 127
  const getLPPairTokens = (farmId: string, stakingToken: string): { token1: string; token2: string } | null => {
    // Special handling for farm 127
    if (farmId === '127') {
      return { token1: 'BATES-bb3dd6', token2: 'JORKIN-7d6f75' };
    }
    
    // For other farms, use the LP pair data
    const lpPair = smartContractService.findLPPair(stakingToken);
    if (lpPair) {
      return { token1: lpPair.token1lp, token2: lpPair.token2lp };
    }
    
    return null;
  };

  function calculateAPR(farm: FarmInfo): number {
    try {
      if (farm.isMultiReward && farm.calculatedAPR !== undefined) {
        return farm.calculatedAPR;
      }
      
      const totalStakedNum = parseFloat(farm.totalStaked) / Math.pow(10, 18);
      const totalRewardsNum = parseFloat(farm.totalRewards) / Math.pow(10, 18);
      if (totalStakedNum === 0) return 0;
      const apr = (totalRewardsNum / totalStakedNum) * 100 * 365;
      return Math.round(apr);
    } catch (error) {
      return 0;
    }
  }

  function getFarmColor(farmId: string) {
    const colors = ['#8A2BE2', '#FF6B35', '#FF69B4', '#00CED1', '#32CD32', '#FFD700'];
    const index = parseInt(farmId) % colors.length;
    return colors[index];
  }

  // Helper functions for address actions
  const copyAddressToClipboard = async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        toast.success('Address copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy address');
      }
    }
  };

  const openAddressInExplorer = () => {
    if (address) {
      const explorerUrl = `${network.explorerAddress}/accounts/${address}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const handleDisconnect = () => {
    router.push(RouteNamesEnum.logout);
  };

  function handleStakeClick(farm: FarmInfo) {
    if (!isLoggedIn) { toast.error('Please connect your wallet first'); return; }
    if (!hasEnoughRare) { toast.error('You need at least 10 RARE tokens to perform staking operations'); return; }
    setSelectedFarm(farm); setModalType('stake'); setModalOpen(true);
  }

  function handleUnstakeClick(farm: FarmInfo) {
    if (!isLoggedIn) { toast.error('Please connect your wallet first'); return; }
    if (!hasEnoughRare) { toast.error('You need at least 10 RARE tokens to perform staking operations'); return; }
    const stakedBalance = getUserStakedBalance(farm.farm.id);
    if (parseFloat(stakedBalance) <= 0) { toast.error('No tokens staked in this farm'); return; }
    setSelectedFarm(farm); setModalType('unstake'); setModalOpen(true);
  }

  async function handleHarvestClick(farm: FarmInfo) {
    if (!isLoggedIn || !address) { toast.error('Please connect your wallet first'); return; }
    if (!hasEnoughRare) { toast.error('You need at least 10 RARE tokens to perform staking operations'); return; }
    try {
      const harvestableAmount = await smartContractService.calcHarvestableRewards(address, farm.farm.id);
      const harvestableNum = parseFloat(harvestableAmount) / Math.pow(10, 18);
      if (harvestableNum <= 0) { toast.error('No rewards available to harvest'); return; }
      const rareFeeTransaction = smartContractService.createRareFeeTransaction(address, network.chainId);
      const harvestTransaction = smartContractService.createHarvestTransaction(farm.farm.id, address, network.chainId);
      const { sessionId } = await signAndSendTransactions({
        transactions: [rareFeeTransaction, harvestTransaction],
        transactionsDisplayInfo: {
          processingMessage: 'Processing harvest transaction (including 10 RARE fee)',
          errorMessage: 'Error during harvest',
          successMessage: 'Successfully harvested rewards! (10 RARE fee paid)'
        }
      });
      if (sessionId) { toast.success('Harvest transaction submitted successfully!'); await fetchData(); }
    } catch {
      toast.error('Failed to harvest rewards');
    }
  }

  async function handleModalSuccess() { await fetchData(); }

  function handleConnectWallet() {
    const unlockPanelManager = UnlockPanelManager.init({
      loginHandler: () => {},
      onClose: () => {}
    });
    unlockPanelManager.openUnlockPanel();
  }

  // Click game logic
  function startGame() {
    if (isPlaying) return;
    setClickCount(0);
    setTimeLeftMs(8000);
    setIsPlaying(true);
    setShowResult(false);

    endTimeRef.current = Date.now() + 8000;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setInterval(() => {
      if (!endTimeRef.current) return;
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        endTimeRef.current = null;
        setIsPlaying(false);
        setResultCount(clickCountRef.current);
        setShowResult(true);
      }
    }, 50);
  }

  // Handle clicks only while playing
  function handleClickGame(e: React.MouseEvent<HTMLButtonElement>) {
    if (!isPlaying || showResult) return;
    setClickCount(prev => prev + 1);
    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(() => {});
        }
      } catch {}
    }
    // Emoji bursts: 3-4 per click, spawn on circular edge and fly outward
    const mediaEl = buttonRef.current;
    if (!mediaEl) return;
    const rect = mediaEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.min(rect.width, rect.height) / 2;
    const count = 3 + Math.floor(Math.random() * 2); // 3-4
    const speedMin = 700;
    const speedMax = 1300;
    const newEmojis: Array<{ id: number; x: number; y: number; vx: number; vy: number; rot: number; char: string; size: number; duration: number; delay: number }> = [];

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const x = cx + Math.cos(theta) * (radius + 12);
      const y = cy + Math.sin(theta) * (radius + 12);
      const vx = Math.cos(theta) * speed;
      const vy = Math.sin(theta) * speed;
      const id = Date.now() + Math.random();
      const rot = (Math.random() - 0.5) * 240;
      const char = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const size = 20 + Math.random() * 12;
      const duration = 900 + Math.random() * 1300;
      const delay = Math.random() * 80;
      newEmojis.push({ id, x, y, vx, vy, rot, char, size, duration, delay });
    }

    newEmojis.forEach(({ id, duration, delay }) => {
      setTimeout(() => {
        setEmojiBursts(prev => prev.filter(ei => ei.id !== id));
      }, duration + delay + 100);
    });
    setEmojiBursts(prev => [...prev, ...newEmojis]);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Keep latest click count in a ref for timer end use
  useEffect(() => {
    clickCountRef.current = clickCount;
  }, [clickCount]);

  const farmColor = useMemo(() => (farm116 ? getFarmColor(farm116.farm.id) : '#8A2BE2'), [farm116]);

  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="min-h-screen bg-black relative">
        <Toaster 
          theme="dark" 
          position="bottom-right"
          toastOptions={{
            style: { background: '#1A1A1A', border: '1px solid rgba(147, 51, 234, 0.3)', color: 'white' }
          }}
        />

        {/* Header */}
        <div className="bg-black/90 backdrop-blur-md border-b-2 border-purple-500/50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="text-center">
              <motion.h1
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-purple-500 font-mono mb-1 sm:mb-2 tracking-wider"
                style={{ textShadow: '0 0 10px #8A2BE2, 0 0 20px #8A2BE2', letterSpacing: '0.2em' }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                JORKIN ROOM
              </motion.h1>
              <motion.p
                className="text-sm sm:text-lg text-gray-400 font-mono tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                Stake LP on the left. Click game on the right.
              </motion.p>
              <motion.div
                className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 font-mono tracking-wide flex items-center justify-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <span>
                  {isLoggedIn && address ? `Connected: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                </span>
                {isLoggedIn && address && (
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
            </div>
          </div>
        </div>

        {/* Split layout */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
          {/* RARE Fee Status */}
          {isLoggedIn && address && (
            <div className="mb-4 sm:mb-6">
              <motion.div
                className="bg-gradient-to-r from-orange-900/50 to-red-900/50 border border-orange-500/50 rounded-lg p-3 sm:p-4 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                  <span className="text-sm sm:text-base font-mono text-orange-300">
                    RARE Fee Status: {hasEnoughRare ? '✅ Ready (≥10 RARE)' : '❌ Insufficient (<10 RARE)'}
                  </span>
                  <button
                    onClick={async () => {
                      if (address) {
                        const hasRare = await smartContractService.hasEnoughRareTokens(address);
                        setHasEnoughRare(hasRare);
                      }
                    }}
                    className="text-orange-400 hover:text-orange-300 underline text-xs sm:text-sm font-mono"
                  >
                    Refresh Balance
                  </button>
                </div>
              </motion.div>
            </div>
          )}

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
                  Connect your wallet to view real-time staking data and interact with the smart contract.
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Farm 116 */}
            <div>
              {loading && (
                <div className="text-center py-8">
                  <div className="text-yellow-400 font-mono tracking-wide">Loading farm...</div>
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

              {!loading && !error && farm116 && (
                <motion.div
                  className="relative bg-gradient-to-b from-gray-900 to-black border-2 sm:border-4 p-4 sm:p-6 font-mono"
                  style={{
                    borderColor: farmColor,
                    boxShadow: `0 0 20px ${farmColor}20, inset 0 0 20px ${farmColor}10`,
                    imageRendering: 'pixelated',
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="text-center mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white font-mono mb-1 sm:mb-2 tracking-wide" style={{ textShadow: `0 0 5px ${farmColor}`, letterSpacing: '0.1em' }}>
                      Farm #{farm116.farm.id}
                    </h3>
                    <div className="text-2xl sm:text-3xl font-bold font-mono tracking-wider" style={{ color: farmColor, textShadow: `0 0 10px ${farmColor}, 0 0 20px ${farmColor}`, letterSpacing: '0.1em' }}>
                      {farm116.isMultiReward && calculateAPR(farm116) === 0 ? 'Rewards Pending' : `${calculateAPR(farm116)}% APR`}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400 font-mono tracking-wide mt-1">
                      <div className="flex items-center justify-center space-x-2">
                        {/* For LP tokens, show the underlying tokens using new MEX pairs API */}
                        {(() => {
                          // Get LP pair tokens (with special handling for farm 127)
                          const lpPairTokens = getLPPairTokens(farm116.farm.id, farm116.stakingToken);
                          
                          if (lpPairTokens) {
                            // Show the two underlying tokens on the left, reward tokens on the right
                            return (
                              <>
                                <img 
                                  src={getTokenImageUrl(lpPairTokens.token1)}
                                  alt={lpPairTokens.token1}
                                  className="w-6 h-6 rounded-full"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <img 
                                  src={getTokenImageUrl(lpPairTokens.token2)}
                                  alt={lpPairTokens.token2}
                                  className="w-6 h-6 rounded-full"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <span>/</span>
                                {/* Show multiple reward tokens for multi-reward farms */}
                                {farm116.isMultiReward && farm116.rewardTokens ? (
                                  <div className="flex space-x-1">
                                    {farm116.rewardTokens.map((token: string, index: number) => (
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
                                    src={`https://tools.multiversx.com/assets-cdn/tokens/${farm116.farm.reward_token}/icon.png`}
                                    alt={farm116.farm.reward_token}
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
                                  src={getTokenImageUrl(farm116.stakingToken)}
                                  alt={farm116.stakingToken}
                                  className="w-6 h-6 rounded-full"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <span>/</span>
                                {/* Show multiple reward tokens for multi-reward farms */}
                                {farm116.isMultiReward && farm116.rewardTokens ? (
                                  <div className="flex space-x-1">
                                    {farm116.rewardTokens.map((token: string, index: number) => (
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
                                    src={`https://tools.multiversx.com/assets-cdn/tokens/${farm116.farm.reward_token}/icon.png`}
                                    alt={farm116.farm.reward_token}
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

                  <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 font-mono tracking-wide">Total Staked:</span>
                      <span className="text-white font-mono tracking-wide">
                        {farm116.totalStakedUSD && farm116.totalStakedUSD > 0 ? `$${farm116.totalStakedUSD.toFixed(2)}` : formatBalance(farm116.totalStaked)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 font-mono tracking-wide">My Staked:</span>
                      <span className="text-white font-mono tracking-wide">{formatBalance(getUserStakedBalance(farm116.farm.id))}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 font-mono tracking-wide">My Rewards:</span>
                      <span className="text-yellow-400 font-mono tracking-wide">
                        {!farm116.isMultiReward ? (
                          formatBalance(getUserHarvestableRewards(farm116.farm.id))
                        ) : (
                          <span className="block text-right">
                            {(() => {
                              const rewards = getUserRewardsByFarm(farm116.farm.id);
                              if (rewards.length === 0) {
                                return '0';
                              }
                              return rewards.map((r, idx) => (
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
                              ));
                            })()}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 font-mono tracking-wide">Status:</span>
                      <span className={`font-mono tracking-wide ${farm116.isActive ? 'text-green-400' : 'text-red-400'}`}>{farm116.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-400 font-mono tracking-wide">Fee Required:</span>
                      <span className={`font-mono tracking-wide ${hasEnoughRare ? 'text-green-400' : 'text-red-400'}`}>
                        {hasEnoughRare ? '10 RARE ✓' : '10 RARE ✗'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <button
                      onClick={() => handleStakeClick(farm116)}
                      disabled={!hasEnoughRare}
                      className={`w-full py-2 sm:py-3 font-bold transition-colors font-mono border-2 tracking-wide text-xs sm:text-sm ${!hasEnoughRare ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white border-green-500'}`}
                      style={{ imageRendering: 'pixelated' }}
                      title={!hasEnoughRare ? 'You need at least 10 RARE tokens to stake' : ''}
                    >
                      STAKE
                    </button>
                    <button
                      onClick={() => handleUnstakeClick(farm116)}
                      disabled={parseFloat(getUserStakedBalance(farm116.farm.id)) <= 0 || !hasEnoughRare}
                      className={`w-full py-2 sm:py-3 font-bold transition-colors font-mono border-2 tracking-wide text-xs sm:text-sm ${parseFloat(getUserStakedBalance(farm116.farm.id)) <= 0 || !hasEnoughRare ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white border-red-500'}`}
                      style={{ imageRendering: 'pixelated' }}
                      title={!hasEnoughRare ? 'You need at least 10 RARE tokens to unstake' : parseFloat(getUserStakedBalance(farm116.farm.id)) <= 0 ? 'No tokens staked' : ''}
                    >
                      UNSTAKE
                    </button>
                    <button
                      onClick={() => handleHarvestClick(farm116)}
                      disabled={parseFloat(getUserHarvestableRewards(farm116.farm.id)) <= 0 || !hasEnoughRare}
                      className={`w-full py-2 sm:py-3 font-bold transition-colors font-mono border-2 tracking-wide text-xs sm:text-sm ${parseFloat(getUserHarvestableRewards(farm116.farm.id)) <= 0 || !hasEnoughRare ? 'bg-gray-600 text-gray-400 border-gray-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-500'}`}
                      style={{ imageRendering: 'pixelated' }}
                      title={!hasEnoughRare ? 'You need at least 10 RARE tokens to harvest' : parseFloat(getUserHarvestableRewards(farm116.farm.id)) <= 0 ? 'No rewards available' : ''}
                    >
                      HARVEST
                    </button>
                  </div>

                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${farmColor}20 2px, ${farmColor}20 4px)`,
                      boxShadow: `0 0 30px ${farmColor}40, inset 0 0 20px ${farmColor}20`
                    }}
                  />
                </motion.div>
              )}

              {!loading && !error && !farm116 && (
                <div className="text-center py-8">
                  <div className="text-gray-400 font-mono tracking-wide">Farm 116 not found.</div>
                </div>
              )}
            </div>

            {/* Right: Click counter game */}
            <div>
              <div className="bg-gray-900 border border-purple-500 rounded-lg p-4 sm:p-6 h-full flex flex-col items-center justify-center">
                <div className="text-center mb-3 sm:mb-4">
                  <div className="text-lg sm:text-xl font-bold text-purple-400 font-mono tracking-wider">Speed Jorkin</div>
                  <div className="text-3xl sm:text-4xl font-bold text-white font-mono mt-1">{clickCount}</div>
                </div>


                <div ref={clickAreaRef} className="relative w-full flex justify-center">
                  {/* Full-screen emoji burst layer */}
                  <div className="pointer-events-none fixed inset-0 z-10">
                    {emojiBursts.map(em => (
                      <span
                        key={em.id}
                        style={{
                          position: 'absolute',
                          left: `${em.x}px`,
                          top: `${em.y}px`,
                          fontSize: `${em.size}px`,
                          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
                          animation: `emojiBurst ${em.duration}ms ease-out forwards`,
                          animationDelay: `${em.delay}ms`,
                          '--vx': `${em.vx}px`,
                          '--vy': `${em.vy}px`,
                          '--rot': `${em.rot}deg`
                        } as CSSProperties}
                      >{em.char}</span>
                    ))}
                  </div>
                  <motion.button
                    ref={buttonRef}
                    onClick={handleClickGame}
                    disabled={!isPlaying}
                    className={`relative w-44 h-44 sm:w-64 sm:h-64 border-2 rounded-full overflow-hidden group p-1.5 sm:p-2 bg-black ${!isPlaying ? 'cursor-not-allowed opacity-60' : 'border-purple-500'}`}
                    whileTap={isPlaying ? { scale: 0.98 } : undefined}
                  >
                    <video
                      ref={videoRef}
                      src="/assets/img/jorking.mp4"
                      preload="auto"
                      playsInline
                      muted
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 sm:w-40 sm:h-40 object-contain bg-black transform -scale-x-100"
                    />
                    <div className="absolute inset-0 ring-0 group-active:ring-4 ring-purple-500/50 pointer-events-none" />
                  </motion.button>

                  {/* Start/Restart overlay above media (not nested inside disabled button) */}
                  {!isPlaying && !showResult && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                      <motion.button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startGame(); }}
                        className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-mono font-bold border-2 border-purple-400 rounded-lg shadow-lg"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                      >
                          {timeLeftMs === 0 ? 'Jork' : 'Jork'}
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Timer below media, outside the square */}
                {isPlaying && (
                  <div className="mt-2 text-center">
                    <div className="text-white font-mono font-bold text-3xl sm:text-4xl">
                      {(timeLeftMs / 1000).toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 font-mono mt-3">{isPlaying ? 'Jorkin as fast as you can!' : timeLeftMs === 0 ? 'Press Start to play (8s)' : 'Time up! Press Restart'}</div>
                <style jsx>{`
                  @keyframes emojiBurst {
                    0% {
                      transform: translate(0, 0) rotate(0deg) scale(0.9);
                      opacity: 1;
                    }
                    100% {
                      transform: translate(var(--vy, 0px), var(--vx, 0px)) rotate(var(--rot, 0deg)) scale(1.1);
                      opacity: 0;
                    }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>

        {/* Result Modal */}
        {showResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative z-10 max-w-sm w-[90%] bg-gray-900 border-2 border-purple-500 rounded-xl p-5 text-center shadow-2xl">
              <div className="text-2xl font-mono font-bold text-white mb-2">Congratulations!</div>
              <div className="text-gray-300 font-mono mb-3">you jorked <span className="text-purple-400 font-bold">{resultCount}</span> times</div>
              <div className="text-gray-400 font-mono mb-5">you can always jork faster and better</div>
              <button
                onClick={() => setShowResult(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-mono font-bold border-2 border-purple-400 rounded-lg"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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

export default JorkinRoomPage;



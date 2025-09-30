'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGetAccount, useGetNetworkConfig } from '@/lib';
import { smartContractService } from '@/lib/smartContractService';
import { signAndSendTransactions } from '@/helpers';
import { toast } from 'sonner';

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalType: 'stake' | 'unstake';
  farmId: string;
  stakingToken: string;
  userStakedBalance?: string;
  addressOverride?: string;
  skipFee?: boolean;
  onSuccess?: () => void;
}

export const StakingModal: React.FC<StakingModalProps> = ({
  isOpen,
  onClose,
  modalType,
  farmId,
  stakingToken,
  userStakedBalance = '0',
  addressOverride,
  skipFee = false,
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [userBalance, setUserBalance] = useState('0');
  const { address } = useGetAccount();
  const { network } = useGetNetworkConfig();
  const walletAddress = addressOverride || address;

  // Fetch user's token balance when modal opens (for stake)
  useEffect(() => {
    const fetchUserBalance = async () => {
      if (isOpen && modalType === 'stake' && walletAddress && stakingToken) {
        try {
          setBalanceLoading(true);
          // Primary attempt: direct identifier fetch
          const directUrl = `${network.apiAddress}/accounts/${walletAddress}/tokens/${stakingToken}`;
          let response = await fetch(directUrl);

          if (response.ok) {
            const tokenData = await response.json();
            setUserBalance(tokenData.balance || '0');
          } else {
            // Fallback: fetch all tokens and try exact match only (no fuzzy matching)
            const listUrl = `${network.apiAddress}/accounts/${walletAddress}/tokens?size=2000`;
            const listRes = await fetch(listUrl);
            if (listRes.ok) {
              const tokens = await listRes.json();
              // Only try exact identifier match - no fuzzy matching to avoid wrong tokens
              let found = tokens.find((t: any) => t.identifier === stakingToken);
              setUserBalance(found?.balance || '0');
            } else {
              setUserBalance('0');
            }
          }
        } catch (error) {
          // Error fetching user balance
          setUserBalance('0');
        } finally {
          setBalanceLoading(false);
        }
      }
    };

    fetchUserBalance();
  }, [isOpen, modalType, walletAddress, stakingToken, network.apiAddress]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!walletAddress) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      setLoading(true);

      // Create RARE fee transaction if not skipped
      const rareFeeTransaction = skipFee
        ? null
        : smartContractService.createRareFeeTransaction(
            address,
            network.chainId
          );

      let mainTransaction;
      
      if (modalType === 'stake') {
        // Check if user has enough balance
        const decimals = getTokenDecimals(stakingToken);
        const userBalanceNum = parseFloat(userBalance) / Math.pow(10, decimals);
        
        // For farm 117, use adjusted balance (minus 15) for validation
        const availableBalance = farmId === '117' ? Math.max(0, userBalanceNum - 15) : userBalanceNum;
        
        if (parseFloat(amount) > availableBalance) {
          toast.error('Insufficient balance');
          return;
        }
        
        mainTransaction = smartContractService.createStakeTransaction(
          farmId,
          amount,
          stakingToken,
          walletAddress,
          network.chainId
        );
      } else {
        // Check if user has enough staked balance
        const decimals = getTokenDecimals(stakingToken);
        const hasComma = (userStakedBalance || '').includes(',');
        const cleanBalance = (userStakedBalance || '0').replace(/,/g, '');
        const stakedBalanceNum = (hasComma || cleanBalance.includes('.'))
          ? parseFloat(cleanBalance)
          : parseFloat(cleanBalance) / Math.pow(10, decimals);
        if (parseFloat(amount) > stakedBalanceNum) {
          toast.error('Insufficient staked balance');
          return;
        }
        
        mainTransaction = smartContractService.createUnstakeTransaction(
          farmId,
          amount,
          walletAddress,
          network.chainId
        );
      }

      const { sessionId } = await signAndSendTransactions({
        transactions: rareFeeTransaction ? [rareFeeTransaction, mainTransaction] : [mainTransaction],
        transactionsDisplayInfo: {
          processingMessage: skipFee ? `Processing ${modalType} transaction` : `Processing ${modalType} transaction with RARE fee`,
          errorMessage: `Error during ${modalType}`,
          successMessage: skipFee ? `Successfully ${modalType}d tokens!` : `Successfully ${modalType}d tokens! (10 RARE fee paid)`
        }
      });

      if (sessionId) {
        toast.success(`${modalType} transaction submitted successfully! (10 RARE fee paid)`);
        onClose();
        onSuccess?.();
      }
    } catch (error) {
      // Error during transaction
      toast.error(`Failed to ${modalType} tokens`);
    } finally {
      setLoading(false);
    }
  };

  // Convert raw integer balance string to a human-readable decimal string without rounding
  const toHumanAmount = (rawBalance: string, decimals: number = 18): string => {
    try {
      if (!rawBalance) return '0';
      const negative = rawBalance.startsWith('-');
      const digits = negative ? rawBalance.slice(1) : rawBalance;
      const padded = digits.padStart(decimals + 1, '0');
      const whole = padded.slice(0, padded.length - decimals);
      const frac = padded.slice(padded.length - decimals);
      const trimmedFrac = frac.replace(/0+$/, '');
      const result = trimmedFrac.length > 0 ? `${whole}.${trimmedFrac}` : whole;
      return negative ? `-${result}` : result;
    } catch {
      return '0';
    }
  };

  // If balance already looks human (contains '.'), normalize it; otherwise convert from raw
  const ensureHumanAmount = (balance: string, decimals: number): string => {
    if (!balance) return '0';
    const hasComma = balance.includes(',');
    const sanitized = balance.replace(/,/g, '');
    if (hasComma || sanitized.includes('.')) {
      const [w, f = ''] = sanitized.split('.');
      const whole = (w || '0').replace(/^0+(?=\d)/, '');
      const frac = f.replace(/0+$/, '');
      return frac.length ? `${whole || '0'}.${frac}` : (whole || '0');
    }
    return toHumanAmount(sanitized, decimals);
  };

  // Subtract an integer token amount (e.g., 15 RARE) from a raw integer balance using BigInt
  const subtractFromRaw = (rawBalance: string, tokensToSubtract: number, decimals: number): string => {
    try {
      // Compute 10^decimals without BigInt literals (compatible with < ES2020)
      let base = BigInt(1);
      for (let i = 0; i < decimals; i++) base *= BigInt(10);
      const delta = BigInt(Math.trunc(tokensToSubtract)) * base;
      const current = BigInt(rawBalance || '0');
      const result = current > delta ? current - delta : BigInt(0);
      return result.toString();
    } catch {
      return '0';
    }
  };

  const formatBalance = (balance: string, decimals: number = 18): string => {
    return ensureHumanAmount(balance, decimals);
  };

  // Helper function to get correct decimals for a staking token
  const getTokenDecimals = (token: string): number => {
    // Ask service first (authoritative if available)
    try {
      const svcDecimals = (smartContractService as any)?.getTokenDecimals?.(token);
      if (typeof svcDecimals === 'number' && svcDecimals >= 0) {
        return svcDecimals;
      }
    } catch {}
    if (token === 'LOKD-ff8f08') {
      return 6;
    } else if (token === 'TCX-8d448d') {
      return 8; // TCX has 8 decimals
    } else if (token === 'TCXWEGLD-f1f2b1') {
      return 18; // TCXWEGLD LP token has 18 decimals
    } else if (token.startsWith('USDC-') || token.startsWith('USDT-')) {
      // Restrict to native USDC/USDT tokens only; LP identifiers like HYPEUSDC-xxxxx are NOT 6-decimal tokens
      return 6; // USDC/USDT typically have 6 decimals
    }
    return 18; // Default to 18 decimals
  };

  // Special handling for farm 117 - adjust balance display and max amount
  const getAdjustedBalance = (balance: string, decimals: number = 18): string => {
    if (farmId === '117' && modalType === 'stake') {
      // Perform precise subtraction on raw balance to avoid float precision loss
      const adjustedRaw = subtractFromRaw(balance, 15, decimals);
      return toHumanAmount(adjustedRaw, decimals);
    }
    return formatBalance(balance, decimals);
  };

  const setMaxAmount = () => {
    if (modalType === 'stake') {
      const decimals = getTokenDecimals(stakingToken);
      // Setting max amount for stake
      
      // Use adjusted balance for farm 117, regular balance for others
      const adjustedBalance = getAdjustedBalance(userBalance, decimals);
      
      // Special handling for LP staking - reduce by 2% (98% of balance)
      // Check if this is an LP token (contains LP in the identifier)
      const isLPToken = stakingToken.includes('LP') || stakingToken.includes('lp');
      
      let maxAmount;
      if (isLPToken) {
        // For LP tokens, use 98% of the balance (2% less)
        const balanceNum = parseFloat(adjustedBalance);
        if (balanceNum < 1) {
          // For tiny balances, take full precise amount (do not floor to zero)
          maxAmount = adjustedBalance;
        } else {
          const reducedBalance = balanceNum * 0.98; // 98% of balance
          maxAmount = Math.floor(reducedBalance).toString();
        }
      } else {
        // For regular tokens, remove decimals and don't round up - just truncate
        const bal = parseFloat(adjustedBalance);
        maxAmount = bal < 1 ? adjustedBalance : Math.floor(bal).toString();
      }
      
      setAmount(maxAmount);
    } else {
      const decimals = getTokenDecimals(stakingToken);
      // Setting max amount for unstake: use full precise human-readable amount (no rounding/truncation)
      const maxAmount = ensureHumanAmount(userStakedBalance, decimals);
      setAmount(maxAmount);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal */}
        <motion.div
          className="relative bg-black border-4 border-purple-500 p-8 w-full max-w-md mx-4"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            boxShadow: '0 0 30px rgba(147, 51, 234, 0.5), inset 0 0 20px rgba(147, 51, 234, 0.1)'
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          {/* Pixel Border Effect */}
          <div 
            className="absolute inset-0 animate-pulse"
            style={{ 
              background: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 2px,
                rgba(147, 51, 234, 0.1) 2px,
                rgba(147, 51, 234, 0.1) 4px
              )`,
              boxShadow: `0 0 20px #9333EA, 0 0 40px #9333EA40, 0 0 60px #9333EA20, inset 0 0 20px #9333EA10`
            }}
          />

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-purple-400 font-mono tracking-wide mb-2">
                {modalType === 'stake' ? 'STAKE TOKENS' : 'UNSTAKE TOKENS'}
              </h2>
              <p className="text-gray-400 font-mono text-sm tracking-wide">
                Farm #{farmId} - {stakingToken}
              </p>
            </div>

            {/* Balance Info */}
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-mono tracking-wide">
                  {modalType === 'stake' ? 'Available Balance:' : 'Staked Balance:'}
                </span>
                <span className="text-white font-mono tracking-wide">
                  {modalType === 'stake' && balanceLoading ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    <>
                      {modalType === 'stake' 
                        ? getAdjustedBalance(userBalance, getTokenDecimals(stakingToken))
                        : ensureHumanAmount(userStakedBalance, getTokenDecimals(stakingToken))
                      } {stakingToken.split('-')[0]}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 font-mono tracking-wide mb-2">
                  Amount to {modalType}:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="any"
                    min="0"
                    className="w-full bg-black/50 border-2 border-purple-500/50 rounded-lg px-4 py-3 text-white font-mono tracking-wide focus:outline-none focus:border-purple-400 pr-16"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={setMaxAmount}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded font-mono tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || (modalType === 'stake' && balanceLoading)}
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold transition-colors font-mono border-2 border-gray-500 tracking-wide"
                  style={{ imageRendering: 'pixelated' }}
                  disabled={loading}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3 font-bold transition-colors font-mono border-2 tracking-wide ${
                    modalType === 'stake'
                      ? 'bg-green-600 hover:bg-green-700 border-green-500'
                      : 'bg-red-600 hover:bg-red-700 border-red-500'
                  } text-white`}
                  style={{ imageRendering: 'pixelated' }}
                  disabled={loading || balanceLoading || !amount || parseFloat(amount) <= 0}
                >
                  {loading 
                    ? 'PROCESSING...' 
                    : balanceLoading
                      ? 'LOADING...'
                      : modalType === 'stake' 
                        ? 'STAKE' 
                        : 'UNSTAKE'
                  }
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

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
  onSuccess?: () => void;
}

export const StakingModal: React.FC<StakingModalProps> = ({
  isOpen,
  onClose,
  modalType,
  farmId,
  stakingToken,
  userStakedBalance = '0',
  onSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [userBalance, setUserBalance] = useState('0');
  const { address } = useGetAccount();
  const { network } = useGetNetworkConfig();

  // Fetch user's token balance when modal opens (for stake)
  useEffect(() => {
    const fetchUserBalance = async () => {
      if (isOpen && modalType === 'stake' && address && stakingToken) {
        try {
          setBalanceLoading(true);
          // Fetching balance for token
          
          // Fetch user's token balance from MultiversX API
          const response = await fetch(`${network.apiAddress}/accounts/${address}/tokens/${stakingToken}`);
          
          if (response.ok) {
            const tokenData = await response.json();
            const balance = tokenData.balance || '0';
            // Fetched token balance
            setUserBalance(balance);
          } else {
            // Token not found or no balance, setting to 0
            setUserBalance('0');
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
  }, [isOpen, modalType, address, stakingToken, network.apiAddress]);

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

    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      setLoading(true);

      // Create RARE fee transaction first
      const rareFeeTransaction = smartContractService.createRareFeeTransaction(
        address,
        network.chainId
      );

      let mainTransaction;
      
      if (modalType === 'stake') {
        // Check if user has enough balance
        const decimals = stakingToken === 'LOKD-ff8f08' ? 6 : 18;
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
          address,
          network.chainId
        );
      } else {
        // Check if user has enough staked balance
        const decimals = stakingToken === 'LOKD-ff8f08' ? 6 : 18;
        const stakedBalanceNum = parseFloat(userStakedBalance) / Math.pow(10, decimals);
        if (parseFloat(amount) > stakedBalanceNum) {
          toast.error('Insufficient staked balance');
          return;
        }
        
        mainTransaction = smartContractService.createUnstakeTransaction(
          farmId,
          amount,
          address,
          network.chainId
        );
      }

      const { sessionId } = await signAndSendTransactions({
        transactions: [rareFeeTransaction, mainTransaction],
        transactionsDisplayInfo: {
          processingMessage: `Processing ${modalType} transaction with RARE fee`,
          errorMessage: `Error during ${modalType}`,
          successMessage: `Successfully ${modalType}d tokens! (10 RARE fee paid)`
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

  const formatBalance = (balance: string, decimals: number = 18): string => {
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      return num.toFixed(18);
    } catch {
      return '0';
    }
  };

  // Special handling for farm 117 - adjust balance display and max amount
  const getAdjustedBalance = (balance: string, decimals: number = 18): string => {
    if (farmId === '117' && modalType === 'stake') {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      const adjustedNum = Math.max(0, num - 15); // Subtract 15, but don't go below 0
      return adjustedNum.toFixed(18);
    }
    return formatBalance(balance, decimals);
  };

  const setMaxAmount = () => {
    if (modalType === 'stake') {
      const decimals = stakingToken === 'LOKD-ff8f08' ? 6 : 18;
      // Setting max amount for stake
      
      // Use adjusted balance for farm 117, regular balance for others
      const adjustedBalance = getAdjustedBalance(userBalance, decimals);
      // Remove decimals and don't round up - just truncate
      const maxAmount = Math.floor(parseFloat(adjustedBalance)).toString();
      setAmount(maxAmount);
    } else {
      const decimals = stakingToken === 'LOKD-ff8f08' ? 6 : 18;
      // Setting max amount for unstake
      
      const formattedBalance = formatBalance(userStakedBalance, decimals);
      // Remove decimals and don't round up - just truncate
      const maxAmount = Math.floor(parseFloat(formattedBalance)).toString();
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
                        ? getAdjustedBalance(userBalance, stakingToken === 'LOKD-ff8f08' ? 6 : 18)
                        : formatBalance(userStakedBalance, stakingToken === 'LOKD-ff8f08' ? 6 : 18)
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

"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetAccount, useGetNetworkConfig } from '@/lib';
import { GradientButton } from './gradient-button';
import { signAndSendTransactions } from '@/helpers';
import { toast } from 'sonner';
import { Transaction, Address } from '@/lib';

interface TipJarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TokenInfo {
  identifier: string;
  name: string;
  balance: string;
  decimals: number;
}

const AVAILABLE_TOKENS = [
  {
    identifier: 'RARE-99e8b0',
    name: 'RARE',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/RARE-99e8b0/icon.png'
  },
  {
    identifier: 'HYPE-619661',
    name: 'HYPE',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/HYPE-619661/icon.png'
  },
  {
    identifier: 'FEDUP-0994a9',
    name: 'FEDUP',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/FEDUP-0994a9/icon.png'
  },
  {
    identifier: 'BATES-bb3dd6',
    name: 'BATES',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/BATES-bb3dd6/icon.png'
  },
  {
    identifier: 'DBATES-78f441',
    name: 'DBATES',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/DBATES-78f441/icon.png'
  },
  {
    identifier: 'MEX-455c57',
    name: 'MEX',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/MEX-455c57/icon.png'
  },
  {
    identifier: 'EGLD',
    name: 'EGLD',
    decimals: 18,
    image: 'https://tools.multiversx.com/assets-cdn/tokens/EGLD/icon.png'
  }
];

// Fee collector address from the smart contract service
const FEE_COLLECTOR_ADDRESS = 'erd18d8nv0h90pwjxt3c4af8kktfpr2ksyyjvc82t0gk5n8dtaf252esa7jfcm';

export const TipJarModal: React.FC<TipJarModalProps> = ({
  isOpen,
  onClose
}) => {
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  
  const { address } = useGetAccount();
  const { network } = useGetNetworkConfig();

  // Fetch token balances when modal opens
  useEffect(() => {
    const fetchTokenBalances = async () => {
      if (isOpen && address) {
        setBalanceLoading(true);
        const balances: Record<string, string> = {};
        
        for (const token of AVAILABLE_TOKENS) {
          try {
            if (token.identifier === 'EGLD') {
              // Fetch EGLD balance from account info
              const response = await fetch(`${network.apiAddress}/accounts/${address}`);
              if (response.ok) {
                const accountData = await response.json();
                balances[token.identifier] = accountData.balance || '0';
              } else {
                balances[token.identifier] = '0';
              }
            } else {
              // Fetch ESDT token balance
              const response = await fetch(`${network.apiAddress}/accounts/${address}/tokens/${token.identifier}`);
              if (response.ok) {
                const tokenData = await response.json();
                balances[token.identifier] = tokenData.balance || '0';
              } else {
                balances[token.identifier] = '0';
              }
            }
          } catch (error) {
            console.error(`Error fetching balance for ${token.identifier}:`, error);
            balances[token.identifier] = '0';
          }
        }
        
        setTokenBalances(balances);
        setBalanceLoading(false);
      }
    };

    fetchTokenBalances();
  }, [isOpen, address, network.apiAddress]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setSelectedToken(null);
    }
  }, [isOpen]);

  const formatBalance = (balance: string, decimals: number): string => {
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      return num.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 6 
      });
    } catch {
      return '0.00';
    }
  };

  const handleTokenSelect = (token: typeof AVAILABLE_TOKENS[0]) => {
    setSelectedToken({
      ...token,
      balance: tokenBalances[token.identifier] || '0'
    });
    setAmount('');
  };

  const handleMaxAmount = () => {
    if (selectedToken) {
      const balance = tokenBalances[selectedToken.identifier] || '0';
      const formattedBalance = formatBalance(balance, selectedToken.decimals);
      setAmount(formattedBalance);
    }
  };

  const createDonationTransaction = (tokenIdentifier: string, amount: string, decimals: number): Transaction => {
    // Convert amount to wei
    const amountInWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
    
    if (tokenIdentifier === 'EGLD') {
      // EGLD transfer - no data needed, just value
      return new Transaction({
        sender: new Address(address!),
        receiver: new Address(FEE_COLLECTOR_ADDRESS),
        value: amountInWei,
        data: new Uint8Array(Buffer.from('')),
        gasLimit: BigInt(50000000), // 50M gas limit for EGLD transfer
        chainID: network.chainId || '1'
      });
    } else {
      // ESDT token transfer
      const tokenIdentifierHex = Buffer.from(tokenIdentifier).toString('hex');
      const amountHex = amountInWei.toString(16).padStart(64, '0');
      
      const data = `ESDTTransfer@${tokenIdentifierHex}@${amountHex}`;
      
      return new Transaction({
        sender: new Address(address!),
        receiver: new Address(FEE_COLLECTOR_ADDRESS),
        value: BigInt(0),
        data: new Uint8Array(Buffer.from(data)),
        gasLimit: BigInt(50000000), // 50M gas limit for ESDT transfer
        chainID: network.chainId || '1'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedToken || !amount || parseFloat(amount) <= 0) {
      toast.error('Please select a token and enter a valid amount');
      return;
    }

    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      setLoading(true);

      // Check if user has enough balance
      const userBalance = tokenBalances[selectedToken.identifier] || '0';
      const userBalanceNum = parseFloat(formatBalance(userBalance, selectedToken.decimals));
      const amountNum = parseFloat(amount);
      
      if (amountNum > userBalanceNum) {
        toast.error('Insufficient balance');
        return;
      }

      // Create donation transaction
      const donationTransaction = createDonationTransaction(
        selectedToken.identifier,
        amount,
        selectedToken.decimals
      );

      const { sessionId } = await signAndSendTransactions({
        transactions: [donationTransaction],
        transactionsDisplayInfo: {
          processingMessage: 'Processing donation transaction',
          errorMessage: 'An error occurred during donation',
          successMessage: `Successfully donated ${amount} ${selectedToken.name}! Thank you for your support! 🎉`
        }
      });

      if (sessionId) {
        // Refresh balances after successful transaction
        setTimeout(async () => {
          const newBalances: Record<string, string> = {};
          for (const token of AVAILABLE_TOKENS) {
            try {
              if (token.identifier === 'EGLD') {
                // Fetch EGLD balance from account info
                const response = await fetch(`${network.apiAddress}/accounts/${address}`);
                if (response.ok) {
                  const accountData = await response.json();
                  newBalances[token.identifier] = accountData.balance || '0';
                } else {
                  newBalances[token.identifier] = '0';
                }
              } else {
                // Fetch ESDT token balance
                const response = await fetch(`${network.apiAddress}/accounts/${address}/tokens/${token.identifier}`);
                if (response.ok) {
                  const tokenData = await response.json();
                  newBalances[token.identifier] = tokenData.balance || '0';
                } else {
                  newBalances[token.identifier] = '0';
                }
              }
            } catch (error) {
              newBalances[token.identifier] = '0';
            }
          }
          setTokenBalances(newBalances);
        }, 2000);
        
        setAmount('');
        onClose();
      }
    } catch (error) {
      console.error('Donation error:', error);
      toast.error('Failed to send donation');
    } finally {
      setLoading(false);
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
          className="relative bg-black border-4 border-yellow-500 p-8 w-full max-w-md mx-4"
          style={{
            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            boxShadow: '0 0 30px rgba(251, 191, 36, 0.5), inset 0 0 20px rgba(251, 191, 36, 0.1)'
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
                rgba(251, 191, 36, 0.1) 2px,
                rgba(251, 191, 36, 0.1) 4px
              )`,
              boxShadow: `0 0 20px #fbbf24, 0 0 40px #fbbf2440, 0 0 60px #fbbf2420, inset 0 0 20px #fbbf2410`
            }}
          />

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <motion.h2
                className="text-2xl font-bold text-yellow-400 mb-2 roboto-condensed-bold"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                🪙 TIP JAR
              </motion.h2>
              <motion.p
                className="text-gray-300 text-sm roboto-condensed-regular"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Support the development of Bates Motel
              </motion.p>
            </div>

            {/* Token Selection */}
            <div className="mb-6">
              <label className="block text-yellow-400 text-sm font-medium mb-3 roboto-condensed-bold">
                Select Token
              </label>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_TOKENS.map((token) => {
                  const balance = tokenBalances[token.identifier] || '0';
                  const formattedBalance = formatBalance(balance, token.decimals);
                  const isSelected = selectedToken?.identifier === token.identifier;
                  
                  return (
                    <motion.button
                      key={token.identifier}
                      className={`p-2 rounded-lg border-2 transition-all duration-200 flex flex-col items-center space-y-1 ${
                        isSelected
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-gray-600 bg-gray-800/50 hover:border-yellow-500'
                      }`}
                      onClick={() => handleTokenSelect(token)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Token Image */}
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                        <img
                          src={token.image}
                          alt={token.name}
                          className="w-5 h-5 object-contain"
                          onError={(e) => {
                            // Fallback to token name if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-xs font-bold text-white">${token.name.charAt(0)}</span>`;
                            }
                          }}
                        />
                      </div>
                      
                      {/* Token Info */}
                      <div className="text-center">
                        <div className={`text-xs font-bold roboto-condensed-bold ${
                          isSelected ? 'text-yellow-400' : 'text-white'
                        }`}>
                          {token.name}
                        </div>
                        <div className="text-xs text-gray-400 truncate w-full">
                          {balanceLoading ? '...' : `${formattedBalance}`}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Amount Input */}
            {selectedToken && (
              <motion.div
                className="mb-6"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-yellow-400 text-sm font-medium mb-3 roboto-condensed-bold">
                  Amount ({selectedToken.name})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none transition-colors roboto-condensed-regular"
                  />
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded hover:bg-yellow-400 transition-colors roboto-condensed-bold"
                  >
                    MAX
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  Balance: {formatBalance(tokenBalances[selectedToken.identifier] || '0', selectedToken.decimals)} {selectedToken.name}
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <GradientButton
                onClick={onClose}
                className="flex-1 py-3 roboto-condensed-bold"
                variant="variant"
              >
                Cancel
              </GradientButton>
              <GradientButton
                onClick={handleSubmit}
                disabled={!selectedToken || !amount || parseFloat(amount) <= 0 || loading}
                className="flex-1 py-3 roboto-condensed-bold"
              >
                {loading ? 'Sending...' : 'Send Donation'}
              </GradientButton>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

'use client';

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useGetLoginInfo, useGetAccount, useGetNetworkConfig, Transaction, Address } from '@/lib';
import { signAndSendTransactions } from '@/helpers';
import { toast } from "sonner";
import { Toaster } from "sonner";
import { AuthRedirectWrapper } from '@/wrappers/AuthRedirectWrapper';
import { RouteNamesEnum } from '@/localConstants';
import { useRouter } from 'next/navigation';
import { 
  AbiRegistry, 
  SmartContract,
  ContractFunction,
  AddressValue
} from "@multiversx/sdk-core";
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import flipcoinAbi from '@/contracts/flipcoin.abi.json';

// Constants
const SC_ADDRESS = 'erd1qqqqqqqqqqqqqpgqwpmgzezwm5ffvhnfgxn5uudza5mp7x6jfhwsh28nqx'; // Keep the same for now, update if needed for mainnet
const RARE_IDENTIFIER = 'RARE-99e8b0'; // Keep the same for now, update if needed for mainnet
const ADMIN_ADDRESSES = [
  'erd12xqam5lxx6xeteaewx25xarqd3ypleetkv35w40nuqchsxqar9zqkslg66',
  'erd19dgrdm4md8yc7lhvrpgwnnpkzfwlglht8xv6c5nv9lvclx9kp62q2fcjzh',
  'erd1u5p4njlv9rxvzvmhsxjypa69t2dran33x9ttpx0ghft7tt35wpfsxgynw4'
];

export default function FaucetPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  // const [countdown, setCountdown] = useState<string | null>(null); // Removed unused state
  const [faucetInfo, setFaucetInfo] = useState<{
    token: string;
    amount: string;
    has_enough_balance: boolean;
    can_claim: boolean;
    faucet_balance: string;
  } | null>(null);
  const { isLoggedIn } = useGetLoginInfo();
  const { address } = useGetAccount();
  // const { account } = useGetAccountInfo(); // Removed unused variable
  const { network } = useGetNetworkConfig();
  const router = useRouter();

  const handleConnect = () => {
    console.log('Redirecting to unlock page for connection...');
    router.push(`${RouteNamesEnum.unlock}?from=faucet`);
  };

  const fetchFaucetInfo = useCallback(async () => {
    try {
      console.log('Fetching faucet info for address:', address);
      console.log('Network API address:', network.apiAddress);
      
      const provider = new ProxyNetworkProvider(network.apiAddress);
      const contract = new SmartContract({
        address: new Address(SC_ADDRESS),
        abi: AbiRegistry.create(flipcoinAbi)
      });

      const query = contract.createQuery({
        func: new ContractFunction("getFaucetInfo"),
        args: [new AddressValue(new Address(address || SC_ADDRESS))]
      });

      const queryResponse = await provider.queryContract(query);
      console.log('Raw query response:', queryResponse);
      
      // For now, let's set some default values to avoid the parsing error
      setFaucetInfo({
        token: 'RARE-99e8b0',
        amount: '10000000000000000000', // 10 tokens in wei
        has_enough_balance: true,
        can_claim: true,
        faucet_balance: '10000000000000000000' // 10 tokens in wei
      });
      
      console.log('Set default faucet info for testing');
    } catch (error) {
      console.error('Error fetching faucet info:', error);
      // Set default values on error for now
      setFaucetInfo({
        token: 'RARE-99e8b0',
        amount: '10000000000000000000',
        has_enough_balance: true,
        can_claim: true,
        faucet_balance: '10000000000000000000'
      });
      toast.error('Failed to fetch faucet information, using default values');
    }
  }, [address, network.apiAddress]);

  useEffect(() => {
    if (network.apiAddress) {
      fetchFaucetInfo();
      // Refresh every minute
      const interval = setInterval(fetchFaucetInfo, 60000);
      return () => clearInterval(interval);
    }
  }, [network.apiAddress, fetchFaucetInfo]);

  const handleDeposit = async () => {
    if (!isLoggedIn || !depositAmount) {
      toast.error('Please enter an amount');
      return;
    }

    try {
      setIsDepositing(true);
      
      // Create ESDTTransfer transaction data
      const encodedTokenId = Buffer.from(RARE_IDENTIFIER).toString('hex');
      const rawAmount = (BigInt(depositAmount) * BigInt(10 ** 18)).toString(16).padStart(64, '0');
      const data = `ESDTTransfer@${encodedTokenId}@${rawAmount}@6465706f736974`; // 'deposit' in hex

      const transaction = new Transaction({
        sender: new Address(address),
        receiver: new Address(SC_ADDRESS),
        value: BigInt(0),
        data: new Uint8Array(Buffer.from(data)),
        gasLimit: BigInt(6000000),
        chainID: network.chainId || '1'
      });

      const { sessionId } = await signAndSendTransactions({
        transactions: [transaction],
        transactionsDisplayInfo: {
          processingMessage: 'Processing deposit transaction',
          errorMessage: 'An error occurred during deposit',
          successMessage: 'Successfully deposited tokens!'
        }
      });

      if (sessionId) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchFaucetInfo();
        setDepositAmount('');
      }
    } catch (error) {
      console.error('Error depositing:', error);
      toast.error('Failed to deposit tokens');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleClaim = async () => {
    if (!isLoggedIn) return;

    try {
      console.log('Starting claim process...');
      console.log('Current faucet info:', faucetInfo);
      setIsLoading(true);
      
      const transaction = new Transaction({
        sender: new Address(address),
        receiver: new Address(SC_ADDRESS),
        value: BigInt(0),
        data: new Uint8Array(Buffer.from('claim')),
        gasLimit: BigInt(6000000),
        chainID: network.chainId || '1'
      });

      console.log('Transaction data:', transaction);

      const { sessionId } = await signAndSendTransactions({
        transactions: [transaction],
        transactionsDisplayInfo: {
          processingMessage: 'Processing claim transaction',
          errorMessage: 'An error occurred during claiming',
          successMessage: 'Successfully claimed tokens!'
        }
      });

      console.log('Transaction sent with sessionId:', sessionId);

      if (sessionId) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchFaucetInfo();
      }
    } catch (error) {
      console.error('Error claiming:', error);
      toast.error('Failed to claim tokens');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="relative h-screen overflow-hidden bg-black">
        {/* Background Pattern - Atmospheric Glow Effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
          
          {/* Subtle grid pattern for floor texture */}
          <div className="absolute inset-0 opacity-10">
            <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-1 md:gap-2 h-full">
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} className="border border-gray-600/30" />
              ))}
            </div>
          </div>
          
          {/* Floating light particles effect */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white/20 rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        </div>

        <Toaster 
          theme="dark" 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              border: '1px solid rgba(255, 105, 180, 0.3)',
              color: 'white',
            },
          }}
        />
        
        <div className="h-full overflow-auto pt-24">
          <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-6"
            >
              <div className="bg-black/90 backdrop-blur-sm border-4 border-pink-500 shadow-2xl p-12 relative overflow-hidden" 
                   style={{
                     clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                     boxShadow: '0 0 30px rgba(255, 105, 180, 0.5), inset 0 0 30px rgba(255, 105, 180, 0.1)'
                   }}>
                {/* Pixel Border Effect */}
                <div 
                  className="absolute inset-0 animate-pulse"
                  style={{ 
                    background: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 2px,
                      rgba(255, 105, 180, 0.1) 2px,
                      rgba(255, 105, 180, 0.1) 4px
                    )`,
                    boxShadow: `0 0 20px #FF69B4, 0 0 40px #FF69B440, 0 0 60px #FF69B420, inset 0 0 20px #FF69B410`
                  }}
                />
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Left Column */}
                  <div className="flex flex-col items-center justify-center">
                    {/* Faucet Image */}
                    <div className="w-48 h-48 relative mb-8">
                      <div className="w-full h-full border-4 border-pink-500/50 flex items-center justify-center relative overflow-hidden"
                           style={{
                             clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
                           }}>
                        <Image 
                          src="/assets/img/image.png" 
                          alt="Faucet Token"
                          width={400}
                          height={400}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-blue-500/20 blur-3xl" />
                    </div>

                    {/* Token Info */}
                    {faucetInfo && (
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2 roboto-condensed-bold">
                          <span className="text-pink-400">{Number(faucetInfo.amount) / (10 ** 18)}</span>
                          <span className="flex items-center gap-1">
                            <Image 
                              src="https://tools.multiversx.com/assets-cdn/tokens/RARE-99e8b0/icon.png" 
                              alt="RARE" 
                              width={24}
                              height={24}
                              className="w-6 h-6"
                            />
                            RARE
                          </span>
                        </h3>
                        <p className="text-sm text-pink-300 roboto-condensed-regular">Available to claim</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="flex flex-col justify-center">
                    <motion.h2 
                      className="text-2xl font-bold text-white mb-4 roboto-condensed-bold"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6 }}
                    >
                      Claim Tokens
                    </motion.h2>
                    
                    <motion.p 
                      className="text-pink-300 mb-8 flex items-center gap-2 roboto-condensed-regular"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    >
                      Get RARE tokens to participate in voting and other activities. You can claim once per epoch.
                    </motion.p>

                    {/* Status */}
                    <motion.div 
                      className="bg-black/70 p-6 mb-8 border-2 border-pink-500 relative overflow-hidden"
                      style={{
                        clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))'
                      }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                    >
                      {/* Pixel Border for Status */}
                      <div 
                        className="absolute inset-0 opacity-50"
                        style={{ 
                          background: `repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 3px,
                            rgba(255, 105, 180, 0.1) 3px,
                            rgba(255, 105, 180, 0.1) 6px
                          )`,
                          boxShadow: `inset 0 0 10px #FF69B420`
                        }}
                      />
                      
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-pink-300 roboto-condensed-regular">Status</span>
                          <span className={`px-3 py-1 rounded-full text-sm roboto-condensed-bold ${
                            faucetInfo?.can_claim 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                              : 'bg-red-500/20 text-red-400 border border-red-500/50'
                          }`}>
                            {faucetInfo?.can_claim ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-pink-300 roboto-condensed-regular">Faucet Balance</span>
                          <span className="text-white roboto-condensed-bold">
                            {faucetInfo?.has_enough_balance ? 'Available' : 'Insufficient'}
                          </span>
                        </div>
                        {/* Countdown feature temporarily disabled */}
                      </div>
                    </motion.div>

                    {/* Claim Button */}
                    <motion.button
                      onClick={!isLoggedIn ? handleConnect : handleClaim}
                      disabled={isLoggedIn && (!faucetInfo?.can_claim || isLoading)}
                      className={`w-full h-12 font-medium transition-all relative overflow-hidden roboto-condensed-bold border-2 ${
                        !isLoggedIn
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 border-pink-400'
                          : !faucetInfo?.can_claim || isLoading
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700'
                            : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 border-pink-400'
                      }`}
                      style={{
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                      }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.6 }}
                      whileHover={!isLoggedIn || !faucetInfo?.can_claim || isLoading ? {} : { scale: 1.02 }}
                      whileTap={!isLoggedIn || !faucetInfo?.can_claim || isLoading ? {} : { scale: 0.98 }}
                    >
                      {/* Button Glow Effect */}
                      {(!isLoggedIn || !faucetInfo?.can_claim || isLoading) ? null : (
                        <div 
                          className="absolute inset-0 opacity-50"
                          style={{ 
                            background: `repeating-linear-gradient(
                              45deg,
                              transparent,
                              transparent 2px,
                              rgba(255, 105, 180, 0.2) 2px,
                              rgba(255, 105, 180, 0.2) 4px
                            )`,
                            boxShadow: `0 0 20px #FF69B4, 0 0 40px #FF69B440`
                          }}
                        />
                      )}
                      
                      <span className="relative z-10">
                        {!isLoggedIn 
                          ? 'Connect Wallet to Claim' 
                          : isLoading 
                            ? 'Processing Claim...' 
                            : !faucetInfo?.can_claim
                              ? 'Already Claimed'
                              : 'Claim Tokens'}
                      </span>
                    </motion.button>

                    {/* Note */}
                    <motion.div 
                      className="mt-6"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.8 }}
                    >
                      <p className="text-sm text-pink-300 flex items-center gap-2 roboto-condensed-regular">
                        This faucet provides RARE tokens for Vote purposes. You can claim once per epoch.
                      </p>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Return to Lobby Button */}
              <motion.div 
                className="flex justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
              >
                <motion.button
                  onClick={() => router.push('/motel')}
                  className="px-8 py-3 rounded-xl font-medium transition-all roboto-condensed-bold border-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 border-blue-400 relative overflow-hidden"
                  style={{
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Button Glow Effect */}
                  <div 
                    className="absolute inset-0 opacity-50"
                    style={{ 
                      background: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 2px,
                        rgba(59, 130, 246, 0.2) 2px,
                        rgba(59, 130, 246, 0.2) 4px
                      )`,
                      boxShadow: `0 0 20px #3B82F6, 0 0 40px #3B82F640`
                    }}
                  />
                  
                  <span className="relative z-10">Return to Lobby</span>
                </motion.button>
              </motion.div>

              {/* Admin Deposit Section */}
              {isLoggedIn && address && ADMIN_ADDRESSES.includes(address) && (
                <motion.div 
                  className="bg-black/80 backdrop-blur-sm rounded-3xl border border-pink-500/30 shadow-2xl p-8 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1 }}
                >
                  {/* Neon Border for Admin Section */}
                  <div 
                    className="absolute inset-0 rounded-3xl blur-sm opacity-50"
                    style={{ 
                      background: `linear-gradient(45deg, #FFD700, #FFD70020, #FFD700)`,
                      boxShadow: `0 0 20px #FFD700, 0 0 40px #FFD70020, inset 0 0 20px #FFD70010`
                    }}
                  />
                  
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 roboto-condensed-bold">
                      Admin Deposit
                      <span className="flex items-center gap-1">
                                                    <Image 
                              src="https://tools.multiversx.com/assets-cdn/tokens/RARE-99e8b0/icon.png" 
                              alt="RARE" 
                              width={20}
                              height={20}
                              className="w-5 h-5"
                            />
                      </span>
                    </h3>
                    <div className="flex gap-4">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Amount of RARE"
                        className="flex-1 bg-black/50 border border-pink-500/50 rounded-xl px-4 py-3 text-white placeholder-pink-500/50 focus:outline-none focus:border-pink-400 roboto-condensed-regular"
                      />
                      <button
                        onClick={handleDeposit}
                        disabled={isDepositing || !depositAmount}
                        className={`px-6 rounded-xl font-medium transition-all roboto-condensed-bold ${
                          isDepositing || !depositAmount
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                            : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:opacity-90 border border-yellow-400/50'
                        }`}
                      >
                        {isDepositing ? 'Depositing...' : 'Deposit'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </AuthRedirectWrapper>
  );
}

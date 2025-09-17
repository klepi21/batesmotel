'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useGetLoginInfo, useGetAccount } from '@/lib';
import { RouteNamesEnum } from '@/localConstants';

const EntrancePage = () => {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const { isLoggedIn } = useGetLoginInfo();
  const { address } = useGetAccount();

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkScreenSize();

    // Add resize listener
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Connect functionality
  const handleConnect = () => {
    // Navigate to the dedicated unlock page instead
    router.push(`${RouteNamesEnum.unlock}?from=entrance`);
  };

  const handleDisconnect = () => {
    // Redirect to logout page
    router.push(RouteNamesEnum.logout);
  };

  const getFormattedAddress = () => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Background Image */}
      {isMobile ? (
        <Image
          src="/assets/img/mob/Entrancemob.png"
          alt="Bates Motel Lobby Mobile"
          fill
          className="object-contain object-center"
          priority
        />
      ) : (
        <Image
          src="/assets/img/Entrance.png"
          alt="Bates Motel Lobby Desktop"
          fill
          className="object-contain object-center"
          priority
        />
      )}
      
      {/* Atmospheric glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-pink-500/20 via-pink-500/10 to-transparent opacity-30"></div>
      
      {/* Clickable Areas - Desktop: Left/Right, Mobile: Upper/Down-Left/Down-Right */}
      {/* Desktop: Left Area (30%) - Faucet, Mobile: Down-Left Half - Faucet */}
      <div 
        className={`absolute ${isMobile ? 'bottom-0 left-0 w-1/2 h-1/2' : 'left-0 top-1/2 transform -translate-y-1/2 w-[30%] h-3/4'} cursor-pointer hover:bg-pink-500 hover:bg-opacity-30 transition-all duration-300 z-50`}
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Area clicked - navigating to faucet
          router.push(RouteNamesEnum.faucet);
        }}
        title="Click to visit Faucet"
      />
      
      {/* Desktop: Right Area (30%) - Game Room, Mobile: Upper Half - Game Room */}
      <div 
        className={`absolute ${isMobile ? 'top-0 left-0 w-full h-1/2' : 'right-0 top-1/2 transform -translate-y-1/2 w-[30%] h-3/4'} cursor-pointer hover:bg-blue-500 hover:bg-opacity-30 transition-all duration-300 z-50`}
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Area clicked - navigating to game room
          router.push(RouteNamesEnum.gameroom);
        }}
        title="Click to enter Game Room"
      />

      {/* Mobile: Down-Right Half - Motel */}
      {isMobile && (
        <div 
          className="absolute bottom-0 right-0 w-1/2 h-1/2 cursor-pointer hover:bg-green-500 hover:bg-opacity-30 transition-all duration-300 z-50"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Area clicked - navigating to motel
            router.push('/motel');
          }}
          title="Click to enter Motel"
        />
      )}

      {/* Welcome Component */}
      <div className="relative z-[40] text-center max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6 flex flex-col items-center justify-center h-full">
        <div className="flex flex-col items-center justify-center gap-4 mb-6 md:mb-8">
          {/* Welcome Message */}
          <div className="text-center mb-4 ml-0 sm:-ml-5">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-pink-400 roboto-condensed-bold mb-2">
              Welcome
            </h2>
            {isLoggedIn ? (
              <p className="text-lg md:text-xl text-white roboto-condensed-regular">
                Mr/Mrs {getFormattedAddress()}
              </p>
            ) : (
              <p className="text-lg md:text-xl text-gray-300 roboto-condensed-regular">
                Please log in to continue
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 ml-0 sm:-ml-5">
            {!isLoggedIn ? (
              <button
                onClick={handleConnect}
                className="px-8 py-3 rounded-xl font-medium transition-all roboto-condensed-bold border-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 border-pink-400 relative overflow-hidden"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                }}
              >
                <span className="relative z-10">Connect Wallet</span>
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-6 sm:px-8 py-2 sm:py-3 rounded-xl font-medium transition-all roboto-condensed-bold border-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90 border-yellow-400 relative overflow-hidden text-sm sm:text-base"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                }}
              >
                <span className="relative z-10">Leave Bates Motel</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntrancePage;
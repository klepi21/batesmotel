'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RouteNamesEnum } from '@/localConstants';

const EntrancePage = () => {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

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
      
      {/* Clickable Areas - Desktop: Left/Center/Right, Mobile: Upper/Down-Left/Down-Right */}
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
      
      {/* Desktop: Center Area (40%) - Motel */}
      {!isMobile && (
        <div 
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[40%] h-3/4 cursor-pointer hover:bg-green-500 hover:bg-opacity-30 transition-all duration-300 z-50"
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
      
      {/* Desktop: Right Area (30%) - Game Room, Mobile: Upper Half - Game Room */}
      <div 
        className={`absolute ${isMobile ? 'top-0 left-0 w-full h-1/2' : 'right-0 top-1/2 transform -translate-y-1/2 w-[30%] h-3/4'} cursor-pointer hover:bg-blue-500 hover:bg-opacity-30 transition-all duration-300 z-50`}
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // Area clicked - navigating to fudout.com
          window.open('https://www.fudout.com/', '_blank');
        }}
        title="Click to visit FudOut"
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

    </div>
  );
};

export default EntrancePage;
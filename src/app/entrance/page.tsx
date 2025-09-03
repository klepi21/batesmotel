'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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

  const handleEnterMotel = () => {
    router.push('/motel');
  };

  return (
    <div 
      className="relative w-full h-screen bg-black cursor-pointer overflow-hidden"
      onClick={handleEnterMotel}
    >
      {/* Conditional Background Image */}
      {isMobile ? (
        <Image
          src="/assets/img/mob/Entrancemob.png"
          alt="Bates Motel Entrance Mobile"
          fill
          className="object-contain object-center"
          priority
          onError={(e) => console.error('Mobile image failed to load:', e)}
          onLoad={() => console.log('Mobile image loaded successfully')}
        />
      ) : (
        <Image
          src="/assets/img/1stLobby.png"
          alt="Bates Motel Entrance"
          fill
          className="object-contain object-center"
          priority
          onError={(e) => console.error('Desktop image failed to load:', e)}
          onLoad={() => console.log('Desktop image loaded successfully')}
        />
      )}
      
      {/* Overlay for better text visibility */}
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      
      {/* Click to Enter Text */}
      <div className={`absolute inset-0 flex items-center justify-center py-4 ${isMobile ? 'translate-x-[30px] translate-y-[70px]' : 'translate-x-0 translate-y-0'}`}>
        <div className="text-center text-white">

          <p className="text-xl md:text-2xl drop-shadow-lg animate-pulse pr-16">
            Click to Enter
          </p>
        </div>
      </div>
      
      {/* Subtle hover effect */}
      <div className="absolute inset-0 bg-white bg-opacity-0 hover:bg-opacity-5 transition-all duration-300"></div>
    </div>
  );
};

export default EntrancePage;

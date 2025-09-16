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
          onError={(e) => {}}
          onLoad={() => {}}
        />
      ) : (
        <Image
          src="/assets/img/1stLobby.png"
          alt="Bates Motel Entrance"
          fill
          className="object-contain object-center"
          priority
          onError={(e) => {}}
          onLoad={() => {}}
        />
      )}
      
      {/* Overlay for better text visibility */}
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      
      {/* Click to Enter Text - Mobile only */}
      {isMobile && (
        <div className="absolute">
          <div className="text-center text-white" style={{ marginLeft: '210px', marginTop: '600px' }}>
            <p className="text-xl drop-shadow-lg animate-pulse">
              Click to Enter
            </p>
          </div>
        </div>
      )}
      
      {/* Subtle hover effect */}
      <div className="absolute inset-0 bg-white bg-opacity-0 hover:bg-opacity-5 transition-all duration-300"></div>
    </div>
  );
};

export default EntrancePage;

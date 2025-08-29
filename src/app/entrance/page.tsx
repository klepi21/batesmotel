'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const EntrancePage = () => {
  const router = useRouter();

  const handleEnterMotel = () => {
    router.push('/motel');
  };

  return (
    <div 
      className="relative w-full h-screen bg-black cursor-pointer overflow-hidden"
      onClick={handleEnterMotel}
    >
      {/* Background Image */}
      <Image
        src="/assets/img/Entrance.png"
        alt="Bates Motel Entrance"
        fill
        className="object-contain object-center"
        priority
      />
      
      {/* Overlay for better text visibility */}
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      
      {/* Click to Enter Text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white">

          <p className="text-xl md:text-2xl drop-shadow-lg animate-pulse">
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

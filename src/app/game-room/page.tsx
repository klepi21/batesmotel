'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { AuthRedirectWrapper } from '@/wrappers/AuthRedirectWrapper';


const GameRoomPage = () => {
  const router = useRouter();

  const handleReturnToLobby = () => {
    router.push('/motel');
  };

  return (
    <AuthRedirectWrapper requireAuth={false}>
      <div className="relative w-full h-screen bg-black overflow-hidden">
        {/* Desktop Background Image */}
        <Image
          src="/assets/img/GameRoom.png"
          alt="Game Room"
          fill
          className="object-contain object-center hidden sm:block"
          priority
        />
        
        {/* Mobile Background Image - Full Layout */}
        <Image
          src="/assets/img/mob/GameRoommob.png"
          alt="Game Room Mobile"
          fill
          className="object-contain object-center block sm:hidden"
          priority
        />
        
        {/* Overlay for better contrast */}
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        
        {/* Return to Lobby Button */}
        <motion.div 
          className="absolute top-8 left-8 z-50"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.button
            onClick={handleReturnToLobby}
            className="px-6 py-3 rounded-xl font-medium transition-all roboto-condensed-bold border-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90 border-blue-400 relative overflow-hidden"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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
            
            <span className="relative z-10">← Return to Lobby</span>
          </motion.button>
        </motion.div>

        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-400/60 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0.6, 1, 0.6],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>
      </div>
    </AuthRedirectWrapper>
  );
};

export default GameRoomPage;

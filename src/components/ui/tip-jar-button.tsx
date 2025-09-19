"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetLoginInfo } from '@/lib';
import { TipJarModal } from './tip-jar-modal';

export const TipJarButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isLoggedIn } = useGetLoginInfo();

  // Don't show the button if user is not logged in
  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      {/* Floating Tip Jar Button Container */}
      <div 
        className="fixed bottom-6 right-6 z-50"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          left: 'auto',
          top: 'auto'
        }}
      >
        <motion.button
          className="w-16 h-20 bg-gradient-to-b from-amber-600 via-amber-700 to-amber-800 rounded-t-2xl rounded-b-lg shadow-2xl border-2 border-amber-500 flex flex-col items-center justify-end group relative overflow-hidden"
          style={{
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: 'spring', 
          stiffness: 260, 
          damping: 20,
          delay: 0.5 
        }}
        whileHover={{ 
          scale: 1.05,
          boxShadow: '0 12px 40px rgba(245, 158, 11, 0.6), 0 0 0 1px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
        }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Jar Body */}
        <div className="w-full h-full relative">
          {/* Jar Opening */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-3 bg-gradient-to-b from-amber-400 to-amber-500 rounded-t-xl border-2 border-amber-300 border-b-0" />
          
          {/* Jar Content - Coins */}
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-0.5">
            {/* Coin Stack */}
            <motion.div
              className="flex flex-col items-center space-y-0.5"
              animate={{ 
                y: [0, -1, 0],
                rotate: [0, 1, -1, 0]
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                repeatDelay: 2
              }}
            >
              {/* Top Coin */}
              <div className="w-4 h-4 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full border border-yellow-200 shadow-sm" />
              {/* Middle Coin */}
              <div className="w-3.5 h-3.5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border border-yellow-300 shadow-sm" />
              {/* Bottom Coin */}
              <div className="w-3 h-3 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-full border border-yellow-400 shadow-sm" />
            </motion.div>
          </div>
          
          {/* Jar Label */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-10 h-6 bg-gradient-to-b from-amber-200 to-amber-300 rounded border border-amber-400 flex items-center justify-center">
            <span className="text-amber-800 text-xs font-bold roboto-condensed-bold">TIPS</span>
          </div>
          
          {/* Shine Effect */}
          <div className="absolute top-1 left-1 w-6 h-8 bg-gradient-to-br from-white/30 to-transparent rounded-full opacity-60" />
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 bg-amber-400 opacity-0 group-hover:opacity-20 blur-sm transition-opacity duration-300 rounded-t-2xl rounded-b-lg" />
        
        {/* Tooltip */}
        <motion.div
          className="absolute right-full mr-3 px-3 py-2 bg-black/90 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          initial={{ x: 10, opacity: 0 }}
          whileHover={{ x: 0, opacity: 1 }}
        >
          Tip Jar
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-black/90 border-t-4 border-t-transparent border-b-4 border-b-transparent" />
        </motion.div>
        </motion.button>
      </div>

      {/* Tip Jar Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <TipJarModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

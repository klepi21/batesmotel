"use client" 

import * as React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Menu, X } from "lucide-react"
import { useRouter } from 'next/navigation';
import { useGetIsLoggedIn } from '@/lib';
import { RouteNamesEnum } from '@/localConstants';
import { GradientButton } from '@/components/ui/gradient-button';
import { ConnectButton } from '@/components/Layout/Header/components';

const Navbar1 = () => {
  const [isOpen, setIsOpen] = useState(false)
  const isLoggedIn = useGetIsLoggedIn();
  const router = useRouter();

  const toggleMenu = () => setIsOpen(!isOpen)

  const handleDisconnect = () => {
    router.push(RouteNamesEnum.logout);
  };

  const menuItems = ["Home", "About", "Features", "Contact"];

  return (
    <div className="flex justify-center w-full py-6 px-4">
      <div className="flex items-center justify-between px-6 py-3 bg-white/10 backdrop-blur-md rounded-full shadow-lg w-full max-w-3xl relative z-10 border border-white/20">
        <div className="flex items-center">
          <motion.div
            className="w-8 h-8 mr-6 cursor-pointer"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            whileHover={{ rotate: 10 }}
            transition={{ duration: 0.3 }}
            onClick={() => router.push(RouteNamesEnum.home)}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="16" fill="url(#paint0_linear)" />
              <defs>
                <linearGradient id="paint0_linear" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7234BB" />
                  <stop offset="1" stopColor="#080854" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
          <motion.div
            className="text-white roboto-condensed-bold text-lg"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            BatesMote
          </motion.div>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="flex items-center space-x-8">
          {menuItems.map((item) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.05 }}
            >
              <a href="#" className="text-sm text-white hover:text-purple-300 transition-colors roboto-condensed-regular">
                {item}
              </a>
            </motion.div>
          ))}
        </nav>

        {/* Desktop CTA Button */}
        <motion.div
          className="block"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
        >
          {isLoggedIn ? (
            <GradientButton
              onClick={handleDisconnect}
              className="roboto-condensed-regular min-w-[120px] px-5 py-2 text-sm"
            >
              Disconnect
            </GradientButton>
          ) : (
            <ConnectButton />
          )}
        </motion.div>

        {/* Mobile Menu Button */}
        <motion.button className="md:hidden flex items-center" onClick={toggleMenu} whileTap={{ scale: 0.9 }}>
          <Menu className="h-6 w-6 text-white" />
        </motion.button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 pt-24 px-6 md:hidden"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <motion.button
              className="absolute top-6 right-6 p-2"
              onClick={toggleMenu}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <X className="h-6 w-6 text-white" />
            </motion.button>
            <div className="flex flex-col space-y-6">
              {menuItems.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.1 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <a href="#" className="text-base text-white roboto-condensed-regular" onClick={toggleMenu}>
                    {item}
                  </a>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                exit={{ opacity: 0, y: 20 }}
                className="pt-6"
              >
                {isLoggedIn ? (
                  <GradientButton
                    onClick={() => {
                      handleDisconnect();
                      toggleMenu();
                    }}
                    className="roboto-condensed-regular w-full px-5 py-3 text-base"
                  >
                    Disconnect
                  </GradientButton>
                ) : (
                  <div onClick={toggleMenu}>
                    <ConnectButton />
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { Navbar1 }

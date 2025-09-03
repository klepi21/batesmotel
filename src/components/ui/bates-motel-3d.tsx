"use client"

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from "motion/react";
import Image from 'next/image';
import { useGetLoginInfo, useGetAccount } from '@/lib';
import { useRouter } from 'next/navigation';
import { RouteNamesEnum } from '@/localConstants';

interface FloorData {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  color: string;
  icon: string;
}

const BatesMotel3D = () => {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize with a reasonable default based on window size if available
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const { scrollYProgress } = useScroll();
  const { isLoggedIn } = useGetLoginInfo();
  const { address } = useGetAccount();
  const router = useRouter();
  
  // Check if device is mobile
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
    };

    // Check immediately
    checkScreenSize();

    // Add resize listener
    window.addEventListener('resize', checkScreenSize);

    // Force a check after a short delay to ensure it's correct
    const timeoutId = setTimeout(checkScreenSize, 100);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
      clearTimeout(timeoutId);
    };
  }, []);
  
  // Debug login state - removed to prevent rate limiting
  
  // Get connected address (first 6 and last 4 characters)
  const getFormattedAddress = () => {
    // Return empty if not logged in
    if (!isLoggedIn || !address) return "";
    
    if (address && address.length > 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const floors: FloorData[] = [
    {
      id: 6,
      name: "SRB PENTHOUSE",
      subtitle: "",
      description: "",
      features: ["Premium Amenities", "Exclusive Access", "Luxury Suite"],
      color: "#FFD700",
      icon: ""
    },
    {
      id: 5,
      name: "BUILDERS ONLY",
      subtitle: "",
      description: "",
      features: ["Developer Access", "Advanced Tools", "Exclusive Features"],
      color: "#FFA500",
      icon: ""
    },
    {
      id: 4,
      name: "MOTEL FLOOR",
      subtitle: "",
      description: "",
      features: ["Standard Rooms", "Basic Amenities", "Comfortable Stay"],
      color: "#FF6B35",
      icon: ""
    },
    {
      id: 3,
      name: "RUGGED FLOOR",
      subtitle: "",
      description: "",
      features: ["Gone Click", "Flickering Lights", "xPortal Wallet Connect"],
      color: "#FF6B35",
      icon: ""
    },
    {
      id: 1,
      name: "LP ROOMS",
      subtitle: "",
      description: "",
      features: ["HYPE/USDC", "RARE/Room", "FEDUP/HYPE"],
      color: "#8A2BE2",
      icon: ""
    },
    {
      id: 2,
      name: "STAKING ROOMS",
      subtitle: "",
      description: "",
      features: ["Staking Pools", "Yield Farming", "Rewards System"],
      color: "#8A2BE2",
      icon: ""
    },
    {
      id: 0,
      name: "LOBBY",
      subtitle: "RETRO DESK",
      description: "LUCKY LEVER",
      features: isLoggedIn ? ["Welcome to Bates Hotel\nMr/Mrs " + getFormattedAddress(), "Leave Bates Hotel"] : ["Welcome to Bates Motel, please log in to continue"],
      color: "#FF69B4",
      icon: ""
    },
    {
      id: -1,
      name: "THE VAULT",
      subtitle: "",
      description: "",
      features: ["Secure Storage", "Premium Access", "Exclusive Content"],
      color: "#00CED1",
      icon: ""
    }
  ];
  
  // Calculate which floor should be active based on scroll
  const floorProgress = useTransform(scrollYProgress, [0, 1], [6, -1]);

  useEffect(() => {
    const unsubscribe = floorProgress.on("change", (latest) => {
      const floorNumber = Math.round(latest);
      setCurrentFloor(floorNumber);
    });

    return () => unsubscribe();
  }, [floorProgress]);

  // Auto-scroll to floor 0 (Lobby) when component mounts
  useEffect(() => {
    const scrollToLobby = () => {
      // Go to floor 0 (Lobby)
      const lobbySection = document.querySelector('[data-floor="0"]');
      if (lobbySection) {
        lobbySection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    };

    const timer = setTimeout(scrollToLobby, 2500); // Much longer delay for ultra-smooth experience

    return () => clearTimeout(timer);
  }, []);

  // Handle responsive button display
  useEffect(() => {
    const handleResize = () => {
      const desktopButtons = document.querySelectorAll('[data-desktop-button]');
      const floorSelect = document.querySelector('[data-floor-select]');
      
      desktopButtons.forEach((button) => {
        if (window.innerWidth > 600) {
          (button as HTMLElement).style.display = 'block';
        } else {
          (button as HTMLElement).style.display = 'none';
        }
      });

      // Always show floor select on all devices
      if (floorSelect) {
        (floorSelect as HTMLElement).style.display = 'block';
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Connect functionality
  const handleConnect = () => {
    console.log('handleConnect called, isLoggedIn:', isLoggedIn);
    
    // Navigate to the dedicated unlock page instead
    router.push(`${RouteNamesEnum.unlock}?from=lobby`);
  };

  // Disconnect functionality
  const handleDisconnect = () => {
    // Redirect to logout page
    router.push(RouteNamesEnum.logout);
  };

  return (
    <div className="relative w-full bg-black">
      {/* Main Content */}
      <div className="relative">
        {/* Floor Sections - Lobby at Bottom */}
        <div>
          {floors.map((floor) => (
            <motion.section
              key={`${floor.id}-${isMobile ? 'mobile' : 'desktop'}`}
              className="relative h-screen flex items-center justify-center overflow-hidden cursor-pointer"
              data-floor={floor.id}
              data-mobile={isMobile}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              onClick={() => {
                // Don't handle clicks for lobby floor (floor 0) as it has custom clickable areas
                if (floor.id === 0) {
                  return;
                }
                
                // Handle floor-specific navigation
                if (floor.id === 1) {
                  router.push(RouteNamesEnum.lpstaking);
                } else if (floor.id === 2) {
                  router.push(RouteNamesEnum.stakingrooms);
                }
                // Add more floor navigation as needed
              }}
              whileHover={{
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
            >
              {/* Background Pattern - Atmospheric Glow Effects */}
              <div className="absolute inset-0">
                {/* Base dark background - removed for floors with images */}
                {floor.id === -1 || floor.id === 0 || floor.id === 1 || floor.id === 2 || floor.id === 3 || floor.id === 4 || floor.id === 5 || floor.id === 6 ? (
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black" />
                ) : null}
                
                {/* Atmospheric glow effects for each floor */}
                {floor.id === -1 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/TheVaultmob.png"
                          alt="The Vault Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/The Vault.png"
                          alt="The Vault Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-cyan-500/20 via-cyan-500/10 to-transparent opacity-30"></div>
                  </>
                )}

                {floor.id === 0 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/Entrancemob.png"
                          alt="Lobby Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/loby.jpg"
                          alt="Lobby Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-pink-500/20 via-pink-500/10 to-transparent opacity-30"></div>
                    
                    {/* Clickable Left Area (35%) - Faucet */}
                    <div 
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 w-[35%] h-3/4 cursor-pointer hover:bg-pink-500 hover:bg-opacity-30 transition-all duration-300 z-50"
                      style={{ pointerEvents: 'auto' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Left area clicked - navigating to faucet');
                        router.push(RouteNamesEnum.faucet);
                      }}
                      title="Click to visit Faucet"
                    />
                    
                    {/* Clickable Right Area (35%) - Game Room */}
                    <div 
                      className="absolute right-0 top-1/2 transform -translate-y-1/2 w-[35%] h-3/4 cursor-pointer hover:bg-blue-500 hover:bg-opacity-30 transition-all duration-300 z-50"
                      style={{ pointerEvents: 'auto' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Right area clicked - navigating to game room');
                        router.push(RouteNamesEnum.gameroom);
                      }}
                      title="Click to enter Game Room"
                    />
                  </>
                )}

                {floor.id === 1 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/LP Roommob.png"
                          alt="LP Rooms Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/LP Rooms.png"
                          alt="LP Rooms Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-purple-500/20 via-purple-500/10 to-transparent opacity-30"></div>
                  </>
                )}

                {floor.id === 2 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/Staking Roommob.png"
                          alt="Staking Rooms Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/Staking Rooms.png"
                          alt="Staking Rooms Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-purple-500/20 via-purple-500/10 to-transparent opacity-30"></div>
                  </>
                )}

                {floor.id === 3 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/RuggedRoommob.png"
                          alt="Rugged Floor Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/Rugged Floor.png"
                          alt="Rugged Floor Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-orange-500/20 via-orange-500/10 to-transparent opacity-30"></div>
                  </>
                )}

                {floor.id === 4 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/MotelFloormob.png"
                          alt="Motel Floor Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/Motel Floor.png"
                          alt="Motel Floor Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-orange-500/20 via-orange-500/10 to-transparent opacity-30"></div>
                  </>
                )}

                {floor.id === 5 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/Builder's Roommob.png"
                          alt="Builders Only Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/BuildersOnly.png"
                          alt="Builders Only Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-orange-400/20 via-orange-400/10 to-transparent opacity-60"></div>
                  </>
                )}

                {floor.id === 6 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/Penthousemob.png"
                          alt="Penthouse Mobile"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    {/* Desktop Background */}
                    {!isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/SRB Penthouse.png"
                          alt="Penthouse Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-yellow-500/20 via-yellow-500/10 to-transparent opacity-60"></div>
                  </>
                )}
                
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

              {/* Floor Content */}
              <div className="relative z-10 text-center max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6">
                {/* Floor Title - Only show for lobby */}
                {floor.id === 0 && false && (
                  <motion.h2
                    className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 roboto-condensed-bold"
                    style={{ color: floor.color }}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                  >
                    {floor.name}
                  </motion.h2>
                )}

                {/* Floor Subtitle - Only show for lobby */}
                {floor.id === 0 && false && (
                  <motion.h3
                    className="text-lg md:text-xl lg:text-2xl text-white mb-1 md:mb-2 roboto-condensed-regular"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    viewport={{ once: true }}
                  >
                    {floor.subtitle}
                  </motion.h3>
                )}

                {/* Floor Description - Only show for lobby */}
                {floor.id === 0 && false && (
                  <motion.p
                    className="text-sm md:text-base lg:text-lg text-gray-300 mb-6 md:mb-8 roboto-condensed-regular"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    viewport={{ once: true }}
                  >
                    {floor.description}
                  </motion.p>
                )}

                {/* Floor Features - Motel Room Doors - Only show for lobby */}
                {floor.id === 0 && (
                  <motion.div
                    className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-6 lg:gap-8 mb-6 md:mb-8"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    viewport={{ once: true }}
                  >
                    {floor.features.map((feature, featureIndex) => (
                      <motion.div
                        key={featureIndex}
                        className="relative cursor-pointer w-20 h-30 md:w-30 md:h-45"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2 }}
                        onClick={isLoggedIn ? 
                          (feature.includes("Leave Bates Hotel") ? handleDisconnect : undefined) : 
                          (feature === "Welcome to Bates Motel, please log in to continue" ? handleConnect : undefined)}
                      >
                        {/* Neon Border Effect */}
                        <div 
                          className="absolute inset-0 rounded-lg blur-sm animate-pulse"
                          style={{ 
                            background: `linear-gradient(45deg, ${floor.color}, ${floor.color}40, ${floor.color})`,
                            boxShadow: `0 0 20px ${floor.color}, 0 0 40px ${floor.color}40, 0 0 60px ${floor.color}20, inset 0 0 20px ${floor.color}10`
                          }}
                        />
                        
                        {/* Room Door */}
                        <div
                          className="relative bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border-2 shadow-2xl transition-all duration-300 hover:shadow-2xl w-20 h-30 md:w-30 md:h-45"
                          style={{ 
                            borderColor: floor.color,
                            boxShadow: `inset 0 0 20px ${floor.color}20, 0 0 15px ${floor.color}40, 0 0 30px ${floor.color}20`
                          }}
                        >
                          {/* Door Handle */}
                          <div className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2">
                            <div 
                              className="w-1 md:w-2 h-6 md:h-8 rounded-full"
                              style={{ 
                                background: `linear-gradient(to bottom, ${floor.color}, ${floor.color}80)`,
                                boxShadow: `0 0 10px ${floor.color}, 0 0 20px ${floor.color}40`
                              }}
                            />
                          </div>
                          
                          {/* Room Number */}
                          <div className="absolute left-2 md:left-4 top-2 md:top-4">
                            <div 
                              className="w-6 md:w-8 h-6 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-bold"
                              style={{ 
                                background: `linear-gradient(45deg, ${floor.color}, ${floor.color}80)`,
                                boxShadow: `0 0 10px ${floor.color}, 0 0 20px ${floor.color}40`
                              }}
                            >
                              {featureIndex + 1}
                            </div>
                          </div>
                          
                          {/* Room Name */}
                          <div className="absolute inset-0 flex items-center justify-center px-2 md:px-4">
                            <span className="text-white roboto-condensed-regular text-center text-xs md:text-sm leading-tight">
                              {feature.split('\n').map((line, idx) => {
                                if (line.includes("Leave Bates Hotel")) {
                                  return (
                                    <span key={idx} className="block mt-2 text-yellow-300 font-bold text-sm md:text-base border border-yellow-300/50 rounded px-2 py-1 bg-yellow-300/10 hover:bg-yellow-300/20 transition-colors drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">
                                      Leave Bates Hotel
                                    </span>
                                  );
                                }
                                return <span key={idx} className="block drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">{line}</span>;
                              })}
                            </span>
                          </div>
                          
                          {/* Neon Glow on Hover */}
                          <div 
                            className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"
                            style={{ 
                              background: `linear-gradient(45deg, ${floor.color}30, transparent, ${floor.color}30)`,
                              boxShadow: `0 0 30px ${floor.color}80, inset 0 0 20px ${floor.color}20`
                            }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Floor Number Indicator */}
              <motion.div
                className="absolute bottom-4 md:bottom-8 right-4 md:right-8 text-3xl md:text-5xl lg:text-6xl font-bold opacity-20"
                style={{ color: floor.color }}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 0.2, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                {floor.id}
              </motion.div>
            </motion.section>
          ))}
        </div>



        {/* Clickable Elevator Number Pad */}
        <motion.div
          className="fixed top-16 md:top-18 lg:top-20 right-2 md:right-2 lg:right-4 z-50 bg-black/80 backdrop-blur-md border border-pink-500/30 rounded-lg p-2 md:p-3 lg:p-4"
          data-floor-select
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="text-center">
            <div className="text-xs md:text-sm text-gray-400 roboto-condensed-regular mb-2">FLOOR SELECT</div>
            <div className="grid grid-cols-2 gap-1 md:gap-2">
              {floors.map((floor) => (
                <motion.button
                  key={floor.id}
                  className="w-8 h-8 md:w-10 md:h-10 bg-black/50 border border-pink-500/30 rounded text-xs md:text-sm font-bold text-pink-500 hover:bg-pink-500/20 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    // const targetFloor = floors.length - 1 - floor.id; // Removed unused variable
                    const targetSection = document.querySelector(`[data-floor="${floor.id}"]`);
                    if (targetSection) {
                      targetSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  {floor.id === -1 ? "V" : floor.id === 0 ? "L" : floor.id}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Welcome Message at Bottom */}
        <motion.div
          className="fixed bottom-4 md:bottom-6 lg:bottom-8 left-4 md:left-6 lg:left-8 z-40 bg-black/80 backdrop-blur-md border border-pink-500/30 rounded-lg p-2 md:p-3 lg:p-4"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
        >
          <div className="text-center">
            <div className="text-xs md:text-sm text-yellow-400 roboto-condensed-regular">WELCOME TO</div>
            <div className="text-sm md:text-base lg:text-lg font-bold text-pink-500 roboto-condensed-bold">BATES MOTEL</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export { BatesMotel3D };
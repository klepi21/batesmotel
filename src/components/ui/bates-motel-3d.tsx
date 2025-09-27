"use client"

import React, { useState, useEffect } from 'react';
import { motion } from "motion/react";
import Image from 'next/image';
import { useGetLoginInfo, useGetAccount } from '@/lib';
import { useRouter } from 'next/navigation';
import { RouteNamesEnum } from '@/localConstants';
import { smartContractService } from '@/lib/smartContractService';

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
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize with a reasonable default based on window size if available
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [currentFloor, setCurrentFloor] = useState<number>(0); // Track current floor for gauge
  const [totalTVL, setTotalTVL] = useState<number>(0); // Total Value Locked across all farms
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

  // Track current floor for gauge
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -20% 0px',
      threshold: 0.5
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const floorId = entry.target.getAttribute('data-floor');
          if (floorId) {
            setCurrentFloor(parseInt(floorId));
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // Observe all floor sections
    const floorElements = document.querySelectorAll('[data-floor]');
    floorElements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Fetch and calculate total TVL from displayed farms only
  useEffect(() => {
    const fetchTVL = async () => {
      try {
        const farms = await smartContractService.getAllFarms();
        let totalValue = 0;
        
        // Only calculate TVL from farms we actually display:
        // Simple staking: 117, 118, 119, 120, 121
        // LP staking: 122, 123, 124, 125, 126
        // Jorkin room: 127
        const displayedFarmIds = ['117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127'];
        
        farms.forEach((farm) => {
          if (displayedFarmIds.includes(farm.farm.id) && farm.totalStakedUSD && farm.totalStakedUSD > 0) {
            totalValue += farm.totalStakedUSD;
          }
        });
        
        setTotalTVL(totalValue);
      } catch (error) {
        console.error('Error fetching TVL:', error);
        setTotalTVL(0);
      }
    };

    fetchTVL();
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
      id: 2,
      name: "STAKING ROOMS",
      subtitle: "",
      description: "",
      features: ["Staking Pools", "Yield Farming", "Rewards System"],
      color: "#8A2BE2",
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
      name: "BASEMENT -1",
      subtitle: "",
      description: "",
      features: ["Coming Soon", "Exclusive Area", "Special Access"],
      color: "#00B3A4",
      icon: ""
    },
    {
      id: -2,
      name: "THE VAULT",
      subtitle: "",
      description: "",
      features: ["Secure Storage", "Premium Access", "Exclusive Content"],
      color: "#00CED1",
      icon: ""
    }
  ];
  


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
    // handleConnect called
    
    // Navigate to the dedicated unlock page but stay on motel
    router.push(`${RouteNamesEnum.unlock}?from=motel`);
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
                // Handle lobby floor (floor 0) - navigate to entrance
                if (floor.id === 0) {
                  router.push('/entrance');
                  return;
                }
                
                // Handle floor-specific navigation
                if (floor.id === -1) {
                  router.push(RouteNamesEnum.jorkinroom);
                } else if (floor.id === 1) {
                  router.push(RouteNamesEnum.lpstaking);
                } else if (floor.id === 2) {
                  router.push(RouteNamesEnum.stakingrooms);
                } else if (floor.id === 3 || floor.id === 4 || floor.id === 6 || floor.id === -2) {
                  // Show under construction message
                  alert('🚧 This floor is under construction. Please check back later! 🚧');
                } else if (floor.id === 5) {
                  // Open Telegram link in new tab
                  window.open('https://t.me/+-s1nbywYn5RiZGFh', '_blank');
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
                {floor.id === -2 && (
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

                {floor.id === -1 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/jorkinAssetmob.png"
                          alt="Basement -1 Mobile"
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
                          src="/assets/img/jorkinAsset.png"
                          alt="Basement -1 Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-radial from-teal-500/20 via-teal-500/10 to-transparent opacity-30"></div>
                  </>
                )}

                {floor.id === 0 && (
                  <>
                    <div className="absolute inset-0 bg-black" />
                    {/* Mobile Background */}
                    {isMobile && (
                      <div className="absolute inset-0">
                        <Image
                          src="/assets/img/mob/Lobby.png"
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
                          src="/assets/img/1stLobby.png"
                          alt="Entrance Desktop"
                          fill
                          className="object-contain object-center"
                          priority
                        />
                      </div>
                    )}
                    
                    {/* Subtle hover effect */}
                    <div className="absolute inset-0 bg-white bg-opacity-0 hover:bg-opacity-5 transition-all duration-300"></div>
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
                    
                    {/* TVL Display */}
                    <div className="absolute top-2 left-2 md:top-8 md:left-8 z-20">
                      <motion.div
                        className="bg-black/80 backdrop-blur-md border border-yellow-500/30 rounded p-2 md:p-4 shadow-2xl"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                      >
                        <div className="text-center">
                          <div className="text-xs text-yellow-400 font-mono tracking-wider md:tracking-widest font-medium mb-0.5 md:mb-1">
                            TVL
                          </div>
                          <div className="text-sm md:text-2xl text-yellow-300 font-mono font-bold"
                               style={{ 
                                 textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(251, 191, 36, 0.6)' 
                               }}>
                            ${totalTVL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5 md:mt-1">
                            Farms
                          </div>
                        </div>
                      </motion.div>
                    </div>
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
              <div className="relative z-[60] text-center max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6">
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



        {/* Vintage Elevator Control Panel */}
        <motion.div
          className="fixed top-16 md:top-18 lg:top-20 right-2 md:right-2 lg:right-4 z-50 scale-25 md:scale-100 origin-top-right"
          data-floor-select
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="relative bg-gradient-to-br from-amber-800 via-amber-900 to-yellow-900 border-2 border-amber-700 rounded-xl p-2 md:p-5 shadow-2xl"
               style={{
                 background: 'linear-gradient(145deg, #92400e 0%, #78350f 30%, #451a03 70%, #1c1917 100%)',
                 boxShadow: '0 12px 40px rgba(0,0,0,0.8), inset 0 2px 4px rgba(251, 191, 36, 0.2), inset 0 -2px 4px rgba(0,0,0,0.3)'
               }}>
            
            {/* Floor Indicator Gauge */}
            <div className="relative mb-2 md:mb-5">
              <div className="text-center mb-1 md:mb-3">
                <div className="text-xs md:text-sm text-amber-100 font-mono tracking-widest font-medium">FLOOR</div>
              <div className="text-amber-100 font-mono text-lg md:text-2xl font-bold mt-0 md:mt-1"
                     style={{ 
                       textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(251, 191, 36, 0.6)' 
                     }}>
                  {currentFloor === -2 ? "V" : currentFloor === 0 ? "L" : currentFloor}
                </div>
              </div>
              
              {/* Semi-circular gauge */}
              <div className="relative w-16 h-8 md:w-24 md:h-14 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 100 60" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
                  {/* Semi-circle background with gradient */}
                  <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#451a03" />
                      <stop offset="50%" stopColor="#292524" />
                      <stop offset="100%" stopColor="#1c1917" />
                    </linearGradient>
                  </defs>
                  
                  <path
                    d="M 10 45 A 40 40 0 0 1 90 45"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="8"
                  />
                  
                  
                  {/* Needle pointing to current floor */}
                  <g stroke="#fbbf24" strokeWidth="4" fill="#fbbf24" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }}>
                    {(() => {
                      // Calculate needle position based on current floor - proper arc movement
                      const centerX = 50;
                      const centerY = 45;
                      const radius = 25;
                      
                      // Floor positions in degrees (starting from left, going right in arc)
                      const floorAngles: Record<string, number> = {
                        '-2': 150, // Vault - far left
                        '-1': 130, // Basement -1
                        '0': 115,  // Lobby (L) - left
                        '1': 95,   // Floor 1 - center-left
                        '2': 75,   // Floor 2 - center
                        '3': 55,   // Floor 3 - center-right
                        '4': 35    // Floor 4 - right
                      };
                      
                      const angle = floorAngles[currentFloor.toString()] || floorAngles['0'];
                      const radians = (angle * Math.PI) / 180;
                      
                      const needleX = centerX + radius * Math.cos(radians);
                      const needleY = centerY - radius * Math.sin(radians);
                      
                      return (
                        <>
                          <path 
                            d={`M ${centerX} ${centerY} L ${needleX} ${needleY}`} 
                            strokeLinecap="round" 
                          />
                          <circle cx={centerX} cy={centerY} r="3" />
                        </>
                      );
                    })()}
                  </g>
                </svg>
                
              </div>
            </div>
            
            {/* Call Buttons */}
            <div className="flex justify-center space-x-2 md:space-x-4">
              {/* Down Button */}
              <motion.button
                className="w-6 h-6 md:w-10 md:h-10 bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-500 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  boxShadow: '0 6px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(251, 191, 36, 0.3), inset 0 -2px 4px rgba(0,0,0,0.3)'
                }}
                whileHover={{ 
                  scale: 1.1,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.6), inset 0 2px 4px rgba(251, 191, 36, 0.4)'
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  // Navigate to lower floor (higher floor number in array)
                  const currentIndex = floors.findIndex(f => f.id === currentFloor);
                  if (currentIndex < floors.length - 1) {
                    const targetFloor = floors[currentIndex + 1];
                    const targetSection = document.querySelector(`[data-floor="${targetFloor.id}"]`);
                    if (targetSection) {
                      targetSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
              >
                <svg className="w-3 h-3 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </motion.button>
              
              {/* Up Button */}
              <motion.button
                className="w-6 h-6 md:w-10 md:h-10 bg-gradient-to-b from-amber-600 to-amber-800 border-2 border-amber-500 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  boxShadow: '0 6px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(251, 191, 36, 0.3), inset 0 -2px 4px rgba(0,0,0,0.3)'
                }}
                whileHover={{ 
                  scale: 1.1,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.6), inset 0 2px 4px rgba(251, 191, 36, 0.4)'
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  // Navigate to upper floor (lower floor number in array)
                  const currentIndex = floors.findIndex(f => f.id === currentFloor);
                  if (currentIndex > 0) {
                    const targetFloor = floors[currentIndex - 1];
                    const targetSection = document.querySelector(`[data-floor="${targetFloor.id}"]`);
                    if (targetSection) {
                      targetSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
              >
                <svg className="w-3 h-3 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                </svg>
              </motion.button>
            </div>
            
            {/* Vintage screws for decoration */}
            <div className="absolute top-1 left-1 md:top-3 md:left-3 w-1 h-1 md:w-1.5 md:h-1.5 bg-amber-300 rounded-full shadow-sm"></div>
            <div className="absolute top-1 right-1 md:top-3 md:right-3 w-1 h-1 md:w-1.5 md:h-1.5 bg-amber-300 rounded-full shadow-sm"></div>
            <div className="absolute bottom-1 left-1 md:bottom-3 md:left-3 w-1 h-1 md:w-1.5 md:h-1.5 bg-amber-300 rounded-full shadow-sm"></div>
            <div className="absolute bottom-1 right-1 md:bottom-3 md:right-3 w-1 h-1 md:w-1.5 md:h-1.5 bg-amber-300 rounded-full shadow-sm"></div>
          </div>
        </motion.div>

        {/* Hotel Check-In Button */}
        <motion.div
          className="fixed top-4 md:top-6 lg:top-8 left-0 right-0 z-50 flex justify-center"
          style={{
            paddingLeft: '120px',
            paddingRight: '120px'
          }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
            <motion.button
              className={`relative border-2 rounded-lg p-2 md:p-4 shadow-2xl group ${
                isLoggedIn 
                  ? 'bg-gradient-to-br from-red-600 via-red-700 to-red-800 border-red-500' 
                  : 'bg-gradient-to-br from-green-600 via-green-700 to-green-800 border-green-500'
              }`}
              style={{
                background: isLoggedIn 
                  ? 'linear-gradient(145deg, #dc2626 0%, #b91c1c 30%, #991b1b 70%, #7f1d1d 100%)'
                  : 'linear-gradient(145deg, #059669 0%, #047857 30%, #065f46 70%, #064e3b 100%)',
                boxShadow: isLoggedIn
                  ? '0 8px 32px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : '0 8px 32px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
              whileHover={{ 
                scale: 1.05,
                boxShadow: isLoggedIn
                  ? '0 12px 40px rgba(239, 68, 68, 0.6), 0 0 0 1px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  : '0 12px 40px rgba(16, 185, 129, 0.6), 0 0 0 1px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
              }}
              whileTap={{ scale: 0.95 }}
              onClick={isLoggedIn ? handleDisconnect : handleConnect}
            >
              {/* Icon */}
              <div className="flex items-center space-x-1 md:space-x-3">
                <motion.div
                  className={`text-sm md:text-xl ${
                    isLoggedIn ? 'text-red-200' : 'text-green-200'
                  }`}
                  animate={{ 
                    rotate: [0, -5, 5, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 4
                  }}
                >
                  {isLoggedIn ? '🚪' : '🗝️'}
                </motion.div>
                
                <div className="text-center">
                  <div className={`text-xs md:text-sm font-mono tracking-wider md:tracking-widest font-medium roboto-condensed-bold ${
                    isLoggedIn ? 'text-red-100' : 'text-green-100'
                  }`}>
                    {isLoggedIn ? 'CHECK-OUT' : 'CHECK-IN'}
                  </div>
                  <div className={`text-xs roboto-condensed-regular ${
                    isLoggedIn ? 'text-red-200' : 'text-green-200'
                  }`}>
                    {isLoggedIn ? getFormattedAddress() : 'Connect'}
                  </div>
                </div>
              </div>
              
              {/* Glow effect */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 blur-sm transition-opacity duration-300 rounded-lg ${
                isLoggedIn ? 'bg-red-400' : 'bg-green-400'
              }`} />
              
              {/* Vintage screws for decoration */}
              <div className={`absolute top-0.5 left-0.5 md:top-2 md:left-2 w-0.5 h-0.5 md:w-1.5 md:h-1.5 rounded-full shadow-sm ${
                isLoggedIn ? 'bg-red-300' : 'bg-green-300'
              }`}></div>
              <div className={`absolute top-0.5 right-0.5 md:top-2 md:right-2 w-0.5 h-0.5 md:w-1.5 md:h-1.5 rounded-full shadow-sm ${
                isLoggedIn ? 'bg-red-300' : 'bg-green-300'
              }`}></div>
              <div className={`absolute bottom-0.5 left-0.5 md:bottom-2 md:left-2 w-0.5 h-0.5 md:w-1.5 md:h-1.5 rounded-full shadow-sm ${
                isLoggedIn ? 'bg-red-300' : 'bg-green-300'
              }`}></div>
              <div className={`absolute bottom-0.5 right-0.5 md:bottom-2 md:right-2 w-0.5 h-0.5 md:w-1.5 md:h-1.5 rounded-full shadow-sm ${
                isLoggedIn ? 'bg-red-300' : 'bg-green-300'
              }`}></div>
            </motion.button>
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
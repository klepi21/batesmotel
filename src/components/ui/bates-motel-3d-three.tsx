"use client"

import React, { useState } from 'react';
// import { Canvas } from '@react-three/fiber';
// import { OrbitControls, Box } from '@react-three/drei';

// Simple Floor Component - commented out due to missing dependencies
// const Floor = ({ position, color, onClick }: { 
//   position: [number, number, number]; 
//   color: string;
//   onClick: () => void;
// }) => {
//   return (
//     <Box 
//       args={[10, 2, 8]} 
//       position={position}
//       onClick={onClick}
//     >
//       <meshStandardMaterial color={color} />
//     </Box>
//   );
// };

// Main Component
const BatesMotel3DThree = () => {
  const [selectedFloor] = useState<number | null>(null);

  // const handleFloorClick = (floorNumber: number) => {
  //   setSelectedFloor(floorNumber);
  //   console.log(`Floor ${floorNumber} clicked!`);
  // };

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <h1 className="text-2xl font-bold mb-4">3D Three.js Component</h1>
        <p className="text-gray-400">Three.js dependencies not available in build</p>
        {selectedFloor && (
          <div className="mt-4 bg-black bg-opacity-75 text-white p-4 rounded">
            <h3 className="text-xl font-bold">Floor {selectedFloor}</h3>
            <p>Click to explore rooms</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { BatesMotel3DThree };

'use client';

import { UnlockPanelManager } from '@/lib';
import { GradientButton } from '@/components/ui/gradient-button';

export const ConnectButton = () => {
  // const { isLoggedIn } = useGetLoginInfo(); // Removed unused variable

  const handleClick = () => {
    const unlockPanelManager = UnlockPanelManager.init({
      loginHandler: () => {
        // User successfully logged in
        console.log('User logged in successfully');
      },
      onClose: () => {
        // Modal closed
        console.log('Unlock panel closed');
      }
    });
    
    unlockPanelManager.openUnlockPanel();
  };

  return (
    <GradientButton
      onClick={handleClick}
      className='min-w-[100px] px-6 py-2 text-sm'
    >
      Connect
    </GradientButton>
  );
};

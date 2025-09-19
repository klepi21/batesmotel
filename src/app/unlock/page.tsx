'use client';
import { UnlockPanelManager, useGetLoginInfo } from '@/lib';
import { RouteNamesEnum } from '@/localConstants';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Unlock() {
  const router = useRouter();
  const { isLoggedIn } = useGetLoginInfo();

  // Check if user came from specific pages
  const isFromFaucet = typeof window !== 'undefined' && window.location.search.includes('from=faucet');
  const isFromLobby = typeof window !== 'undefined' && window.location.search.includes('from=lobby');
  const isFromMotel = typeof window !== 'undefined' && window.location.search.includes('from=motel');

  const unlockPanelManager = UnlockPanelManager.init({
    loginHandler: () => {
      // Redirect back to the page they came from
      if (isFromFaucet) {
        router.push(RouteNamesEnum.faucet);
      } else if (isFromLobby) {
        router.push(RouteNamesEnum.home);
      } else if (isFromMotel) {
        router.push('/motel');
      } else {
        router.push(RouteNamesEnum.home);
      }
    },
    onClose: () => {
      // Redirect back to the page they came from
      if (isFromFaucet) {
        router.replace(RouteNamesEnum.faucet);
      } else if (isFromLobby) {
        router.replace(RouteNamesEnum.home);
      } else if (isFromMotel) {
        router.replace('/motel');
      } else {
        router.replace(RouteNamesEnum.home);
      }
    }
  });

  const handleOpenUnlockPanel = () => {
    unlockPanelManager.openUnlockPanel();
  };

  useEffect(() => {
    if (isLoggedIn) {
      if (isFromMotel) {
        router.replace('/motel');
      } else {
        router.replace(RouteNamesEnum.home);
      }
      return;
    }

    handleOpenUnlockPanel();
  }, [isLoggedIn]);

  return null;
}

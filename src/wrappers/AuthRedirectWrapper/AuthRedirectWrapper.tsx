'use client';
import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { useGetIsLoggedIn } from '@/lib';
import { RouteNamesEnum } from '@/localConstants';
import { useRouter } from 'next/navigation';

interface AuthRedirectWrapperPropsType extends PropsWithChildren {
  requireAuth?: boolean;
}

export const AuthRedirectWrapper = ({
  children,
  requireAuth = true
}: AuthRedirectWrapperPropsType) => {
  const isLoggedIn = useGetIsLoggedIn();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if user is not logged in and auth is required
    if (!isLoggedIn && requireAuth) {
      router.push(RouteNamesEnum.home);
    }
  }, [isLoggedIn, requireAuth, router]);

  return <>{children}</>;
};

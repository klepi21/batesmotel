'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to entrance page
    router.push('/entrance');
  }, [router]);

  return null; // This page will redirect immediately
}

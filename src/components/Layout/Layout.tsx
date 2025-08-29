'use client';

import { ReactNode } from 'react';
import { Footer } from './Footer';

interface LayoutType {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutType) => {
  return (
    <div className='flex min-h-screen flex-col'>
      <main className='flex-1'>
        {children}
      </main>
      <Footer />
    </div>
  );
};

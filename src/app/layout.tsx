import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Metadata } from 'next';
import { Roboto_Condensed } from 'next/font/google';
import { Layout } from '@/components/Layout';
import App from './index';
import { InitAppWrapper } from '@/wrappers';

const robotoCondensed = Roboto_Condensed({ 
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-roboto-condensed'
});

export const metadata: Metadata = {
  title: 'Bates Motel',
  description:
    'Bates Motel - A MultiversX dApp with authentication, staking, LP, and on-chain interactions.',
  viewport: {
    width: 'device-width',
    initialScale: 1
  },
  icons: {
    icon: '/favicon.ico'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' className={robotoCondensed.className}>
      <body>
        <InitAppWrapper>
          <App>
            <Suspense>
              <Layout>{children}</Layout>
            </Suspense>
          </App>
        </InitAppWrapper>
      </body>
    </html>
  );
}

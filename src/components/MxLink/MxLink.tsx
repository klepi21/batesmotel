import { PropsWithChildren } from 'react';
import Link from 'next/link';
import { WithClassnameType } from '@/types';

interface MxLinkType extends WithClassnameType, PropsWithChildren {
  to: string;
}

export const MxLink = ({
  children,
  to,
  className = 'inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 bg-primary-purple text-white hover:bg-primary-darkBlue ml-2 mr-0 transition-colors duration-200'
}: MxLinkType) => {
  return (
    <Link href={to} className={className}>
      {children}
    </Link>
  );
};

import type { PropsWithChildren, MouseEvent } from 'react';
import { WithClassnameType } from '@/types';

interface ButtonType extends WithClassnameType, PropsWithChildren {
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  id?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const Button = ({
  children,
  onClick,
  disabled = false,
  type = 'button',
  id,
  className = 'inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 bg-primary-purple text-white hover:bg-primary-darkBlue mr-0 disabled:bg-gray-200 disabled:text-black disabled:cursor-not-allowed transition-colors duration-200',
  ...otherProps
}: ButtonType) => {
  return (
    <button
      id={id}
      data-testid={otherProps['data-testid']}
      disabled={disabled}
      onClick={onClick}
      className={className}
      type={type}
    >
      {children}
    </button>
  );
};

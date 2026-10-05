import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SpinnerIcon } from './icons';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg motion-safe:transition-all motion-safe:duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

  const variants = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm border border-indigo-700/20',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/60',
    outline:
      'border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-xs',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm border border-red-700/20',
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[32px]',
    md: 'text-sm px-4 py-2 gap-2 min-h-[40px]',
    lg: 'text-base px-6 py-2.5 gap-2.5 min-h-[44px]',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <SpinnerIcon className="w-4 h-4 text-current mr-0.5" />}
      {children}
    </button>
  );
};

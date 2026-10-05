import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertCircleIcon, RefreshIcon } from './icons';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
  className,
}) => {
  return (
    <div
      role="alert"
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center p-6 text-center rounded-xl border border-red-200 bg-red-50/50 text-red-900',
          className
        )
      )}
    >
      <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3 shadow-2xs">
        <AlertCircleIcon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="gap-2 border border-slate-300 text-slate-800 hover:bg-white bg-white shadow-2xs"
        >
          <RefreshIcon className="w-3.5 h-3.5 text-slate-600" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
};

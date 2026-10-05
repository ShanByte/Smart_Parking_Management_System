import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { StarIcon } from './icons';

export interface RecommendedBadgeProps {
  label?: string;
  className?: string;
}

export const RecommendedBadge: React.FC<RecommendedBadgeProps> = ({
  label = 'Recommended',
  className,
}) => {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-2xs select-none',
          className
        )
      )}
    >
      <StarIcon className="w-3 h-3 text-amber-300 fill-amber-300" />
      <span>{label}</span>
    </span>
  );
};

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatTileProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  icon,
  description,
  className,
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-start justify-between gap-4 motion-safe:transition-shadow hover:shadow-xs',
          className
        )
      )}
    >
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span className="text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight">
          {value}
        </span>
        {description && (
          <span className="text-xs text-slate-400 mt-1.5">{description}</span>
        )}
      </div>
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
};

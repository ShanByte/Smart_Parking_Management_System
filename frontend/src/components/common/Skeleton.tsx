import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className,
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'rounded h-4 w-full',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
  };

  const inlineStyles: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style,
  };

  return (
    <div
      role="status"
      aria-label="Loading..."
      className={twMerge(
        clsx(
          'animate-pulse motion-reduce:animate-none bg-slate-200/80',
          variantStyles[variant],
          className
        )
      )}
      style={inlineStyles}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

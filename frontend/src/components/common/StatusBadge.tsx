import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SlotStatus, BookingStatus } from '../../types/contract';
import {
  CheckCircleIcon,
  ClockIcon,
  CarIcon,
  BanIcon,
  AlertCircleIcon,
  XCircleIcon,
} from './icons';

interface StatusBadgeProps {
  status: SlotStatus | BookingStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className,
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      // SlotStatus & BookingStatus: AVAILABLE / CONFIRMED
      case 'AVAILABLE':
        return {
          label: 'Available',
          icon: CheckCircleIcon,
          colors: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        };
      case 'HELD':
        return {
          label: 'Held (5m)',
          icon: ClockIcon,
          colors: 'bg-amber-100 text-amber-950 border-amber-300',
        };
      case 'RESERVED':
        return {
          label: 'Reserved',
          icon: CarIcon,
          colors: 'bg-blue-100 text-blue-900 border-blue-300',
        };
      case 'OCCUPIED':
        return {
          label: 'Occupied',
          icon: BanIcon,
          colors: 'bg-red-100 text-red-900 border-red-300',
        };
      // Booking specific statuses
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          icon: CheckCircleIcon,
          colors: 'bg-blue-100 text-blue-900 border-blue-300',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          icon: CheckCircleIcon,
          colors: 'bg-slate-100 text-slate-800 border-slate-300',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          icon: XCircleIcon,
          colors: 'bg-slate-100 text-slate-700 border-slate-300',
        };
      case 'EXPIRED':
        return {
          label: 'Expired',
          icon: ClockIcon,
          colors: 'bg-slate-100 text-slate-700 border-slate-300',
        };
      case 'NO_SHOW':
        return {
          label: 'No Show',
          icon: AlertCircleIcon,
          colors: 'bg-rose-100 text-rose-900 border-rose-300',
        };
      default:
        return {
          label: status,
          icon: AlertCircleIcon,
          colors: 'bg-slate-100 text-slate-800 border-slate-300',
        };
    }
  };

  const { label: configLabel, icon: Icon, colors } = getBadgeConfig();
  const displayLabel = label || configLabel;

  const sizeClasses =
    size === 'sm' ? 'text-xs px-2 py-0.5 gap-1 font-medium' : 'text-xs font-semibold px-2.5 py-1 gap-1.5';

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-full border shadow-2xs select-none',
          colors,
          sizeClasses,
          className
        )
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 flex-shrink-0' : 'w-3.5 h-3.5 flex-shrink-0'} />
      <span>{displayLabel}</span>
    </span>
  );
};

import React from 'react';
import {
  CheckCircle2,
  Clock,
  Car,
  Ban,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SlotStatus, BookingStatus } from '../../types/contract';

interface StatusBadgeProps {
  status: SlotStatus | BookingStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      // SlotStatus & BookingStatus: AVAILABLE / CONFIRMED
      case 'AVAILABLE':
        return {
          label: 'Available',
          icon: CheckCircle2,
          colors: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'HELD':
        return {
          label: 'Held (5m)',
          icon: Clock,
          colors: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      case 'RESERVED':
        return {
          label: 'Reserved',
          icon: Car,
          colors: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'OCCUPIED':
        return {
          label: 'Occupied',
          icon: Ban,
          colors: 'bg-red-100 text-red-800 border-red-300',
        };
      // Booking specific statuses
      case 'CONFIRMED':
        return {
          label: 'Confirmed',
          icon: CheckCircle2,
          colors: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          icon: CheckCircle2,
          colors: 'bg-slate-100 text-slate-800 border-slate-300',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          icon: XCircle,
          colors: 'bg-slate-100 text-slate-600 border-slate-300',
        };
      case 'EXPIRED':
        return {
          label: 'Expired',
          icon: Clock,
          colors: 'bg-slate-100 text-slate-600 border-slate-300',
        };
      case 'NO_SHOW':
        return {
          label: 'No Show',
          icon: AlertCircle,
          colors: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      default:
        return {
          label: status,
          icon: AlertCircle,
          colors: 'bg-slate-100 text-slate-800 border-slate-300',
        };
    }
  };

  const { label, icon: Icon, colors } = getBadgeConfig();

  const sizeClasses =
    size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs font-semibold px-2.5 py-1 gap-1.5';

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-full border',
          colors,
          sizeClasses,
          className
        )
      )}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
};

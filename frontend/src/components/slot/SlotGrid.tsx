import React from 'react';
import { SlotView, Booking } from '../../types/contract';
import {
  CheckCircleIcon,
  ClockIcon,
  CarIcon,
  BanIcon,
  CheckIcon,
} from '../common/icons';
import { ErrorState } from '../common/ErrorState';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common/Skeleton';

export interface SlotGridProps {
  slots?: SlotView[];
  selectedSlotId?: string | null;
  userBookings?: Booking[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onSelectSlot: (slot: SlotView) => void;
  recentlyUpdatedSlotId?: string | null;
}

export const SlotGrid: React.FC<SlotGridProps> = ({
  slots,
  selectedSlotId,
  userBookings = [],
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  onSelectSlot,
  recentlyUpdatedSlotId = null,
}) => {
  // Check if slot has a confirmed or held booking by the current user
  const isUserBooking = (slotId: string) => {
    return userBookings.some(
      (b) =>
        b.slotId === slotId &&
        (b.status === 'CONFIRMED' || b.status === 'HELD')
    );
  };

  // 1. Loading State with Fixed-Height Skeletons to prevent layout shift
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading parking slots"
        className="space-y-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between p-3"
            >
              <Skeleton variant="text" width={32} height={16} />
              <div className="flex justify-center w-full">
                <Skeleton variant="rectangular" width={64} height={20} className="rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State with Retry
  if (isError) {
    return (
      <ErrorState
        title="Failed to load parking slots"
        message={errorMessage || 'Unable to fetch real-time slot states. Please try again.'}
        onRetry={onRetry}
        retryLabel="Retry"
      />
    );
  }

  // 3. Empty State
  if (!slots || slots.length === 0) {
    return (
      <EmptyState
        icon={<CarIcon className="w-6 h-6 text-slate-400" />}
        title="No Slots Configured"
        description="This parking lot has no designated slots available in this time window."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual Status Legend (Color + Icon + Text + Shape) */}
      <div
        aria-label="Slot status indicators"
        className="flex flex-wrap items-center gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200/90 text-xs shadow-2xs select-none"
      >
        <span className="font-semibold text-slate-700 mr-1">Slot Status:</span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-900 border-emerald-300 font-medium">
          <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span>Available</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-amber-50 text-amber-950 border-amber-300 font-medium">
          <ClockIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>Held (5m)</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-blue-50 text-blue-900 border-blue-300 font-medium">
          <CarIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span>Reserved (Yours)</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-red-50 text-red-900 border-red-300 font-medium pattern-diagonal-hatch">
          <BanIcon className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
          <span>Occupied</span>
        </span>
      </div>

      {/* Grid of Interactive Parking Bay Shaped Cells */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {slots.map((slot) => {
          const isSelected = selectedSlotId === slot.id;
          const userOwns = isUserBooking(slot.id);
          const isRecentlyUpdated = recentlyUpdatedSlotId === slot.id;

          // Determine Visual Mode per C2, D7, and Redesign brief:
          // AVAILABLE: green
          // HELD: amber
          // RESERVED: blue when user's own booking, red/occupied for others
          // OCCUPIED: red with diagonal hatch
          let statusText = 'Available';
          let StatusIcon = CheckCircleIcon;
          let containerClasses =
            'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-400 cursor-pointer text-emerald-950 active:scale-[0.98] shadow-2xs';
          let badgeClasses = 'bg-emerald-100 text-emerald-900 border-emerald-300';
          let isClickable = true;

          if (slot.status === 'HELD') {
            statusText = 'Held';
            StatusIcon = ClockIcon;
            containerClasses =
              'border-amber-300 bg-amber-50/50 text-amber-950 cursor-not-allowed opacity-85';
            badgeClasses = 'bg-amber-100 text-amber-950 border-amber-300';
            isClickable = false;
          } else if (slot.status === 'RESERVED') {
            if (userOwns) {
              statusText = 'Reserved (Yours)';
              StatusIcon = CarIcon;
              containerClasses =
                'border-blue-400 bg-blue-50/70 text-blue-950 ring-2 ring-blue-300 cursor-default shadow-2xs';
              badgeClasses = 'bg-blue-100 text-blue-900 border-blue-400';
              isClickable = false;
            } else {
              // Reserved by another user appears occupied
              statusText = 'Occupied';
              StatusIcon = BanIcon;
              containerClasses =
                'border-slate-300 bg-slate-100 pattern-diagonal-hatch text-red-950 cursor-not-allowed opacity-75';
              badgeClasses = 'bg-red-100 text-red-900 border-red-300';
              isClickable = false;
            }
          } else if (slot.status === 'OCCUPIED') {
            statusText = 'Occupied';
            StatusIcon = BanIcon;
            containerClasses =
              'border-slate-300 bg-slate-100 pattern-diagonal-hatch text-red-950 cursor-not-allowed opacity-75';
            badgeClasses = 'bg-red-100 text-red-900 border-red-300';
            isClickable = false;
          }

          if (isSelected) {
            containerClasses =
              'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 shadow-md text-indigo-950';
          }

          const highlightClass = isRecentlyUpdated
            ? 'ring-4 ring-amber-400 motion-safe:animate-pulse'
            : '';

          return (
            <div
              key={slot.id}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              aria-label={`Slot ${slot.slotNumber}, ${statusText.toLowerCase()}`}
              aria-disabled={!isClickable}
              onClick={() => {
                if (isClickable) onSelectSlot(slot);
              }}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectSlot(slot);
                }
              }}
              className={`relative flex flex-col items-center justify-between p-3 rounded-xl border-2 motion-safe:transition-all motion-safe:duration-150 motion-reduce:transition-none select-none min-h-[102px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${containerClasses} ${highlightClass}`}
            >
              {/* Parking Bay Indicator Header */}
              <div className="flex items-center justify-between w-full">
                <span className="font-mono font-bold text-base tracking-wide text-slate-900">
                  {slot.slotNumber}
                </span>
                {isSelected && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    <CheckIcon className="w-2.5 h-2.5 stroke-[3]" />
                    Selected
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div
                className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${badgeClasses}`}
              >
                <StatusIcon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{statusText}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

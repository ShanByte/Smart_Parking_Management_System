import React from 'react';
import { SlotView, Booking } from '../../types/contract';
import {
  CheckCircle2,
  Clock,
  Car,
  Ban,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../common/Button';

export interface SlotGridProps {
  slots?: SlotView[];
  selectedSlotId?: string | null;
  userBookings?: Booking[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  onSelectSlot: (slot: SlotView) => void;
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
}) => {
  // Check if slot has a confirmed or active booking by the current user
  const isUserBooking = (slotId: string) => {
    return userBookings.some(
      (b) =>
        b.slotId === slotId &&
        (b.status === 'CONFIRMED' || b.status === 'HELD')
    );
  };

  // 1. Loading State
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
              className="h-24 rounded-xl bg-slate-100 border border-slate-200 animate-pulse flex flex-col justify-between p-3"
            >
              <div className="h-4 w-8 bg-slate-200 rounded"></div>
              <div className="h-4 w-14 bg-slate-200 rounded-full mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (isError) {
    return (
      <div
        role="alert"
        className="p-8 bg-red-50 border border-red-200 rounded-xl text-center space-y-3"
      >
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
        <h4 className="text-base font-bold text-red-900">
          Failed to load parking slots
        </h4>
        <p className="text-xs text-red-700 max-w-md mx-auto">
          {errorMessage || 'Unable to fetch real-time slot states. Please try again.'}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (!slots || slots.length === 0) {
    return (
      <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
        <Car className="w-10 h-10 text-slate-300 mx-auto" />
        <h4 className="text-sm font-semibold text-slate-700">No Slots Configured</h4>
        <p className="text-xs text-slate-500">
          This parking lot has no designated slots available in this time window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Visual Legend (Color + Icon + Text) */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
        <span className="font-semibold text-slate-700">Slot Status:</span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-300 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Available</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-300 font-medium">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Held (5m)</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-blue-50 text-blue-800 border-blue-300 font-medium">
          <Car className="w-3.5 h-3.5 text-blue-600" />
          <span>Reserved (Yours)</span>
        </span>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-red-50 text-red-800 border-red-300 font-medium">
          <Ban className="w-3.5 h-3.5 text-red-600" />
          <span>Occupied</span>
        </span>
      </div>

      {/* Grid of Interactive Slots */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {slots.map((slot) => {
          const isSelected = selectedSlotId === slot.id;
          const userOwns = isUserBooking(slot.id);

          // Determine Visual Mode per C2 & D7:
          // AVAILABLE: green
          // HELD: yellow
          // RESERVED: blue when it is the user's own booking, red/occupied for others
          // OCCUPIED: red
          let statusText = 'Available';
          let StatusIcon = CheckCircle2;
          let containerClasses =
            'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 hover:border-emerald-400 cursor-pointer text-emerald-900';
          let badgeClasses = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          let isClickable = true;

          if (slot.status === 'HELD') {
            statusText = 'Held (5m)';
            StatusIcon = Clock;
            containerClasses =
              'border-amber-300 bg-amber-50/60 text-amber-900 cursor-not-allowed opacity-85';
            badgeClasses = 'bg-amber-100 text-amber-800 border-amber-300';
            isClickable = false;
          } else if (slot.status === 'RESERVED') {
            if (userOwns) {
              statusText = 'Reserved (Yours)';
              StatusIcon = Car;
              containerClasses =
                'border-blue-400 bg-blue-50 text-blue-900 ring-2 ring-blue-300 cursor-default shadow-xs';
              badgeClasses = 'bg-blue-100 text-blue-800 border-blue-400';
              isClickable = false;
            } else {
              // Reserved by another user appears occupied (D7)
              statusText = 'Occupied';
              StatusIcon = Ban;
              containerClasses =
                'border-red-200 bg-red-50/50 text-red-900 cursor-not-allowed opacity-75';
              badgeClasses = 'bg-red-100 text-red-800 border-red-300';
              isClickable = false;
            }
          } else if (slot.status === 'OCCUPIED') {
            statusText = 'Occupied';
            StatusIcon = Ban;
            containerClasses =
              'border-red-200 bg-red-50/50 text-red-900 cursor-not-allowed opacity-75';
            badgeClasses = 'bg-red-100 text-red-800 border-red-300';
            isClickable = false;
          }

          if (isSelected) {
            containerClasses =
              'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500 shadow-md text-indigo-950';
          }

          return (
            <div
              key={slot.id}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              aria-label={`Slot ${slot.slotNumber}, ${statusText}`}
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
              className={`relative flex flex-col items-center justify-between p-3 rounded-xl border-2 transition-all select-none min-h-[102px] ${containerClasses}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-extrabold text-base tracking-wide">
                  {slot.slotNumber}
                </span>
                {isSelected && (
                  <span className="text-[9px] font-bold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-2xs">
                    Selected
                  </span>
                )}
              </div>

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

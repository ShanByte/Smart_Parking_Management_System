import React, { useState } from 'react';
import { GuardBoardSlot } from '../../../types/contract';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { NoShowCountdown } from './NoShowCountdown';
import {
  Car,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Radio,
  Cpu,
  Smartphone,
  UserCheck,
} from 'lucide-react';

interface GuardGateBoardProps {
  slots: GuardBoardSlot[];
  onSelectSlot: (slot: GuardBoardSlot) => void;
}

export const GuardGateBoard: React.FC<GuardGateBoardProps> = ({
  slots,
  onSelectSlot,
}) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredSlots = slots.filter((s) => {
    if (filter === 'ALL') return true;
    return s.status === filter;
  });

  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;
  const reservedCount = slots.filter((s) => s.status === 'RESERVED').length;
  const occupiedCount = slots.filter((s) => s.status === 'OCCUPIED').length;
  const heldCount = slots.filter((s) => s.status === 'HELD').length;

  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'APP':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded">
            <Smartphone className="w-3 h-3 text-blue-700" /> App
          </span>
        );
      case 'GUARD':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
            <UserCheck className="w-3 h-3 text-amber-700" /> Walk-In
          </span>
        );
      case 'SENSOR':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-900 bg-purple-100 border border-purple-300 px-1.5 py-0.5 rounded">
            <Radio className="w-3 h-3 text-purple-700" /> Sensor
          </span>
        );
      case 'SIM':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded">
            <Cpu className="w-3 h-3 text-slate-600" /> Sim
          </span>
        );
    }
  };

  const formatTimeWindow = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const e = new Date(endIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${s} – ${e}`;
    } catch {
      return 'Time Window Active';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs / Quick Stats Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`h-11 px-4 text-xs font-bold rounded-lg transition-colors border-2 flex items-center gap-1.5 ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          <span>All Slots</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-white text-[10px]">
            {slots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('AVAILABLE')}
          className={`h-11 px-4 text-xs font-bold rounded-lg transition-colors border-2 flex items-center gap-1.5 ${
            filter === 'AVAILABLE'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
          }`}
        >
          <span>Available</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 text-[10px]">
            {availableCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('RESERVED')}
          className={`h-11 px-4 text-xs font-bold rounded-lg transition-colors border-2 flex items-center gap-1.5 ${
            filter === 'RESERVED'
              ? 'bg-blue-700 text-white border-blue-800'
              : 'bg-white text-blue-800 border-blue-300 hover:bg-blue-50'
          }`}
        >
          <span>Reserved</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-200 text-blue-900 text-[10px]">
            {reservedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('OCCUPIED')}
          className={`h-11 px-4 text-xs font-bold rounded-lg transition-colors border-2 flex items-center gap-1.5 ${
            filter === 'OCCUPIED'
              ? 'bg-red-700 text-white border-red-800'
              : 'bg-white text-red-800 border-red-300 hover:bg-red-50'
          }`}
        >
          <span>Occupied</span>
          <span className="px-1.5 py-0.2 rounded-full bg-red-200 text-red-900 text-[10px]">
            {occupiedCount}
          </span>
        </button>

        {heldCount > 0 && (
          <button
            type="button"
            onClick={() => setFilter('HELD')}
            className={`h-11 px-4 text-xs font-bold rounded-lg transition-colors border-2 flex items-center gap-1.5 ${
              filter === 'HELD'
                ? 'bg-amber-700 text-white border-amber-800'
                : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
            }`}
          >
            <span>Held (Cart)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px]">
              {heldCount}
            </span>
          </button>
        )}
      </div>

      {/* Gate Board Grid */}
      {filteredSlots.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl">
          <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No slots matching filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSlots.map((slot) => {
            const isBooked = !!slot.booking;
            const isArrived = !!slot.booking?.checkedInAt;

            return (
              <div
                key={slot.slotId}
                onClick={() => onSelectSlot(slot)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSlot(slot);
                  }
                }}
                className={`relative flex flex-col justify-between p-4 bg-white rounded-xl border-2 transition-all cursor-pointer shadow-sm hover:shadow-md ${
                  slot.status === 'AVAILABLE'
                    ? 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/20'
                    : slot.status === 'RESERVED'
                    ? 'border-blue-400 hover:border-blue-600 bg-blue-50/20'
                    : slot.status === 'OCCUPIED'
                    ? 'border-red-300 hover:border-red-500 bg-red-50/10'
                    : 'border-amber-300 hover:border-amber-500 bg-amber-50/20'
                }`}
              >
                {/* Header: Slot Number, Status Badge & Source */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Slot
                    </span>
                    <h3 className="text-2xl font-black text-slate-900">
                      {slot.slotNumber}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={slot.status} size="sm" />
                    {renderSourceBadge(slot.source)}
                  </div>
                </div>

                {/* Booking Information (When Slot Has Active Reservation) */}
                {isBooked && slot.booking && (
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Code:</span>
                      <span className="font-mono font-black text-sm text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 tracking-wider">
                        {slot.booking.bookingCode}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-600 flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-slate-500" /> Plate:
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {slot.booking.vehicleNumber || '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Window:</span>
                      <span className="font-medium text-slate-700">
                        {formatTimeWindow(slot.booking.startTime, slot.booking.endTime)}
                      </span>
                    </div>

                    {/* Arrival Status & Countdown */}
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between gap-2">
                      {isArrived ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Arrived</span>
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Awaiting</span>
                          </span>
                          <NoShowCountdown
                            startTime={slot.booking.startTime}
                            isArrived={isArrived}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer Quick Action Hint */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium">
                    {slot.status === 'AVAILABLE'
                      ? 'Tap to mark walk-in'
                      : slot.status === 'OCCUPIED'
                      ? 'Tap to release slot'
                      : 'Protected reservation'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

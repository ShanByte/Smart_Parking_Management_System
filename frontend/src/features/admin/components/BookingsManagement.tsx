import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { BookingStatus } from '../../../types/contract';
import { BookingView } from '../types';
import { Card } from '../../../components/common/Card';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Button } from '../../../components/common/Button';
import { ConfirmationModal } from './ConfirmationModal';
import {
  CalendarCheck,
  Ban,
  Car,
  AlertCircle,
  X,
  IndianRupee,
} from 'lucide-react';

interface BookingsManagementProps {
  bookings: BookingView[];
  activeStatusFilter: string;
  onChangeStatusFilter: (status: string) => void;
  onRefresh: () => void;
}

export const BookingsManagement: React.FC<BookingsManagementProps> = ({
  bookings,
  activeStatusFilter,
  onChangeStatusFilter,
  onRefresh,
}) => {
  const [bookingToCancel, setBookingToCancel] = useState<BookingView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const statuses = [
    { label: 'All Bookings', value: 'ALL' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Held (Cart)', value: 'HELD' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Cancelled', value: 'CANCELLED' },
    { label: 'No-Show', value: 'NO_SHOW' },
  ];

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.delete(`/bookings/${bookingToCancel.id}`);
      setSuccessMessage(`Booking ${bookingToCancel.bookingCode} cancelled successfully.`);
      setBookingToCancel(null);
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to cancel booking.'
        );
      } else {
        setErrorMessage('Failed to cancel booking.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            System Bookings & Audit
          </h2>
          <p className="text-xs text-slate-500">
            Inspect all driver reservations and cancel stuck or disputed holds
          </p>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-medium flex items-center justify-between"
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-900 text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-slate-200">
        {statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChangeStatusFilter(s.value)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
              activeStatusFilter === s.value
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      {bookings.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50">
          <CalendarCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No bookings found</p>
          <p className="text-xs text-slate-500 mt-1">
            No bookings match the status filter "{activeStatusFilter}".
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Slot</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Time Window</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => {
                const canCancel = b.status === 'CONFIRMED' || b.status === 'HELD';
                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {b.bookingCode}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {b.slotId}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={b.status as BookingStatus} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      {b.vehicleNumber ? (
                        <span className="flex items-center gap-1 font-mono font-semibold text-slate-800">
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          {b.vehicleNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col text-[11px] text-slate-600">
                        <span>{formatDateTime(b.startTime)}</span>
                        <span className="text-slate-400">to {formatDateTime(b.endTime)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span className="flex items-center">
                        <IndianRupee className="w-3 h-3 text-slate-500" />
                        {(b.amountPaise / 100).toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canCancel && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setBookingToCancel(b)}
                          className="h-8 px-2.5 text-[11px] font-bold border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!bookingToCancel}
        title="Cancel Booking"
        message={`Are you sure you want to cancel booking "${bookingToCancel?.bookingCode}"? This will immediately release the slot and initiate refund processing if already paid.`}
        confirmLabel="Cancel Booking"
        isDestructive={true}
        isLoading={isLoading}
        onConfirm={handleCancelBooking}
        onCancel={() => setBookingToCancel(null)}
      />
    </div>
  );
};

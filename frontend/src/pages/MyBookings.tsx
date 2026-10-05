import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Booking, ParkingLot } from '../types/contract';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import {
  CalendarIcon,
  ClockIcon,
  CarIcon,
  XCircleIcon,
  NavigationIcon,
  TicketIcon,
} from '../components/common/icons';

export const MyBookings: React.FC = () => {
  const queryClient = useQueryClient();

  // 1. Fetch user bookings
  const { data: bookings, isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['bookings-my'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>('/bookings/my');
      return res.data.data;
    },
  });

  // 2. Fetch parking lots to derive coordinates for the Navigate button
  const { data: parkingLots = [] } = useQuery<ParkingLot[]>({
    queryKey: ['parking-lots'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ParkingLot[] }>('/parking-lots');
      return res.data.data;
    },
  });

  // 3. Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await api.delete<{ success: boolean; data: Booking }>(`/bookings/${bookingId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] });
      queryClient.invalidateQueries({ queryKey: ['parking-slots'] });
    },
  });

  // Helper to resolve coordinates for a booking's slot
  const getDestinationCoords = (slotId: string): string => {
    const matchedLot = parkingLots.find(
      (lot) => slotId.startsWith(lot.id) || slotId.includes(lot.id)
    );
    const lat = matchedLot?.latitude ?? (parkingLots[0]?.latitude ?? 18.5204);
    const lng = matchedLot?.longitude ?? (parkingLots[0]?.longitude ?? 73.8415);
    return `${lat},${lng}`;
  };

  // Helper to determine status display
  const getStatusInfo = (booking: Booking) => {
    if (booking.checkedInAt) {
      return { label: 'Checked In', statusKey: 'checked in' };
    }
    if (booking.status === 'CONFIRMED') {
      return { label: 'Confirmed', statusKey: 'confirmed' };
    }
    if (booking.status === 'NO_SHOW') {
      return { label: 'No Show', statusKey: 'no-show' };
    }
    if (booking.status === 'CANCELLED') {
      return { label: 'Cancelled', statusKey: 'cancelled' };
    }
    if (booking.status === 'HELD') {
      return { label: 'Held', statusKey: 'held' };
    }
    if (booking.status === 'EXPIRED') {
      return { label: 'Expired', statusKey: 'expired' };
    }
    return { label: 'Completed', statusKey: 'completed' };
  };

  // Partition bookings into Active/Upcoming vs Past/Completed
  const activeBookings = (bookings || []).filter(
    (b) => (b.status === 'CONFIRMED' || b.status === 'HELD') && !['NO_SHOW', 'CANCELLED', 'EXPIRED'].includes(b.status)
  );
  const pastBookings = (bookings || []).filter(
    (b) => ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED'].includes(b.status)
  );

  const renderBookingCard = (booking: Booking) => {
    const canCancel =
      (booking.status === 'HELD' || booking.status === 'CONFIRMED') &&
      !booking.checkedInAt;

    const coords = getDestinationCoords(booking.slotId);
    const statusInfo = getStatusInfo(booking);

    return (
      <Card
        key={booking.id}
        className="border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200"
        data-testid={`booking-card-${booking.id}`}
      >
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Badge with label */}
              <StatusBadge
                status={booking.status}
                label={statusInfo.label}
              />

              {/* Prominent Booking Code */}
              <span
                data-testid="booking-code"
                className="inline-flex items-center gap-1 text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg border border-indigo-200 tracking-wider shadow-sm"
              >
                <TicketIcon className="w-3.5 h-3.5 text-indigo-500" />
                Code: {booking.bookingCode}
              </span>

              {/* Vehicle Number */}
              <span
                data-testid="vehicle-number"
                className="text-xs text-slate-700 flex items-center gap-1.5 font-mono font-semibold bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200"
              >
                <CarIcon className="w-3.5 h-3.5 text-slate-400" />
                {booking.vehicleNumber ? booking.vehicleNumber : 'Vehicle: None'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                {new Date(booking.startTime).toLocaleDateString()}
              </span>
              <span className="text-slate-300" aria-hidden="true">&bull;</span>
              <span className="flex items-center gap-1.5 font-medium">
                <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                {new Date(booking.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -{' '}
                {new Date(booking.endTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {booking.checkedInAt && (
                <>
                  <span className="text-slate-300" aria-hidden="true">&bull;</span>
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Checked In at {new Date(booking.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className="text-left md:text-right pr-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Amount</span>
              <span className="text-lg font-black text-slate-900">
                ₹{(booking.amountPaise / 100).toFixed(0)}
              </span>
            </div>

            {/* One-tap Navigate button */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${coords}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Navigate to parking lot for booking ${booking.bookingCode}`}
            >
              <Button variant="secondary" size="sm" className="font-semibold shadow-sm">
                <NavigationIcon className="w-3.5 h-3.5 mr-1.5" />
                Navigate
              </Button>
            </a>

            {/* Cancel button */}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 hover:bg-red-50 border-red-200 font-medium"
                isLoading={
                  cancelMutation.isPending &&
                  cancelMutation.variables === booking.id
                }
                onClick={() => cancelMutation.mutate(booking.id)}
                aria-label={`Cancel booking ${booking.bookingCode}`}
              >
                <XCircleIcon className="w-3.5 h-3.5 mr-1 text-red-500" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-8">
      <PageHeader
        title="My Parking Bookings"
        subtitle="View your active reservations, check-in codes, and past parking history"
      />

      {bookingsLoading && (
        <div className="space-y-4" role="status" aria-label="Loading bookings">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {bookings && bookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          description="You don't have any parking reservations."
          action={
            <a href="/">
              <Button variant="primary" size="md">
                Find a Spot
              </Button>
            </a>
          }
        />
      )}

      {bookings && bookings.length > 0 && (
        <div className="space-y-8">
          {/* Active & Upcoming Section */}
          {activeBookings.length > 0 && (
            <section aria-labelledby="active-reservations-heading" className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                <h2 id="active-reservations-heading" className="text-base font-bold text-slate-900 tracking-tight">
                  Active & Upcoming Reservations ({activeBookings.length})
                </h2>
              </div>
              <div className="space-y-3">
                {activeBookings.map(renderBookingCard)}
              </div>
            </section>
          )}

          {/* Past Bookings Section */}
          {pastBookings.length > 0 && (
            <section aria-labelledby="past-reservations-heading" className="space-y-3">
              <h2 id="past-reservations-heading" className="text-base font-bold text-slate-700 tracking-tight">
                Past Bookings ({pastBookings.length})
              </h2>
              <div className="space-y-3 opacity-95">
                {pastBookings.map(renderBookingCard)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default MyBookings;

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Booking, ParkingLot } from '../types/contract';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Calendar, Clock, Car, XCircle, Navigation } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          My Parking Bookings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          View your active reservations, check-in codes, and past parking history
        </p>
      </div>

      {bookingsLoading && (
        <div className="space-y-3" role="status" aria-label="Loading bookings">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {bookings && bookings.length === 0 && (
        <Card className="text-center py-12">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No bookings yet</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            You don't have any parking reservations.
          </p>
          <a href="/">
            <Button variant="primary" size="sm">
              Find a Spot
            </Button>
          </a>
        </Card>
      )}

      {bookings && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const canCancel =
              (booking.status === 'HELD' || booking.status === 'CONFIRMED') &&
              !booking.checkedInAt;

            const coords = getDestinationCoords(booking.slotId);
            const statusInfo = getStatusInfo(booking);

            return (
              <Card
                key={booking.id}
                className="border-slate-200 hover:shadow-sm transition-shadow"
                data-testid={`booking-card-${booking.id}`}
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Status Badge with label */}
                      <StatusBadge
                        status={booking.status}
                        label={statusInfo.label}
                      />

                      {/* Prominent Booking Code */}
                      <span
                        data-testid="booking-code"
                        className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-200 tracking-wider"
                      >
                        Code: {booking.bookingCode}
                      </span>

                      {/* Vehicle Number */}
                      <span
                        data-testid="vehicle-number"
                        className="text-xs text-slate-600 flex items-center gap-1 font-mono font-medium"
                      >
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        {booking.vehicleNumber ? booking.vehicleNumber : 'Vehicle: None'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(booking.startTime).toLocaleDateString()} &bull;{' '}
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
                        <span className="text-emerald-600 font-medium">
                          &bull; Checked in at {new Date(booking.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Amount</span>
                      <span className="text-base font-bold text-slate-900">
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
                      <Button variant="secondary" size="sm">
                        <Navigation className="w-3.5 h-3.5 mr-1" />
                        Navigate
                      </Button>
                    </a>

                    {/* Cancel button */}
                    {canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 border-red-200"
                        isLoading={
                          cancelMutation.isPending &&
                          cancelMutation.variables === booking.id
                        }
                        onClick={() => cancelMutation.mutate(booking.id)}
                        aria-label={`Cancel booking ${booking.bookingCode}`}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookings;

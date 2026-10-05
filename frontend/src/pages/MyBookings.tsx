import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Booking } from '../types/contract';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Calendar, Clock, Car, XCircle } from 'lucide-react';

export const MyBookings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings-my'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>('/bookings/my');
      return res.data.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await api.delete<{ success: boolean; data: Booking }>(`/bookings/${bookingId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] });
    },
  });

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

      {isLoading && (
        <div className="space-y-3">
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
              booking.status === 'HELD' || booking.status === 'CONFIRMED';

            return (
              <Card key={booking.id} className="border-slate-200 hover:shadow-sm transition-shadow">
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={booking.status} />
                      <span className="text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                        Code: {booking.bookingCode}
                      </span>
                      {booking.vehicleNumber && (
                        <span className="text-xs text-slate-600 flex items-center gap-1 font-mono">
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          {booking.vehicleNumber}
                        </span>
                      )}
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
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Amount</span>
                      <span className="text-base font-bold text-slate-900">
                        ₹{(booking.amountPaise / 100).toFixed(0)}
                      </span>
                    </div>

                    {canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 border-red-200"
                        isLoading={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(booking.id)}
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

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Booking } from '../types/contract';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { useBookingStore } from '../stores/bookingStore';
import { Clock, ShieldCheck, Navigation, CreditCard, CheckCircle2 } from 'lucide-react';

export const BookingConfirmation: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    activeBooking,
    selectedLot,
    holdSecondsRemaining,
    decrementHoldSeconds,
    setActiveBooking,
  } = useBookingStore();

  // Fetch / verify booking
  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>('/bookings/my');
      const found = res.data.data.find((b) => b.id === bookingId);
      if (found) return found;
      if (activeBooking && activeBooking.id === bookingId) return activeBooking;
      throw new Error('Booking not found');
    },
    initialData: activeBooking && activeBooking.id === bookingId ? activeBooking : undefined,
  });

  // 5-minute countdown interval
  useEffect(() => {
    if (booking?.status !== 'HELD') return;

    const timer = setInterval(() => {
      decrementHoldSeconds();
    }, 1000);

    return () => clearInterval(timer);
  }, [booking?.status, decrementHoldSeconds]);

  // Demo payment confirmation mutation (C7/D7)
  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: Booking }>('/payments/demo-confirm', {
        bookingId,
      });
      return res.data.data;
    },
    onSuccess: (updatedBooking) => {
      setActiveBooking(updatedBooking);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] });
    },
  });

  const minutes = Math.floor(holdSecondsRemaining / 60);
  const seconds = holdSecondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  if (isLoading && !booking) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center text-slate-500">
        Loading booking details...
      </div>
    );
  }

  const isConfirmed = booking?.status === 'CONFIRMED';
  const isHeld = booking?.status === 'HELD';

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="text-center border-b pb-6">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isConfirmed ? 'Booking Confirmed!' : 'Slot Temporarily Held'}
          </CardTitle>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={booking?.status || 'HELD'} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Prominent Booking Code Callout (C3, D7) */}
          <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">
              Your 6-Character Guard Booking Code
            </p>
            <div className="text-4xl font-black font-mono tracking-widest text-indigo-900 my-2">
              {booking?.bookingCode || '------'}
            </div>
            <p className="text-xs text-indigo-600 font-medium flex items-center justify-center gap-1.5 mt-2">
              <ShieldCheck className="w-4 h-4" />
              Show this code to the guard upon arrival for gate check-in
            </p>
          </div>

          {/* 5-minute Hold Countdown Notice (D5, D8) */}
          {isHeld && (
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                <div>
                  <div className="text-sm font-semibold">5-Minute Hold Window</div>
                  <div className="text-xs text-amber-700">
                    Complete your payment before the timer expires to secure your spot
                  </div>
                </div>
              </div>
              <div className="font-mono text-xl font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-lg">
                {timeFormatted}
              </div>
            </div>
          )}

          {/* Booking Summary Details */}
          <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Vehicle Number</span>
              <span className="font-semibold text-slate-800 font-mono">
                {booking?.vehicleNumber || 'Not specified'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Total Amount</span>
              <span className="font-bold text-slate-900 text-base">
                ₹{((booking?.amountPaise || 4000) / 100).toFixed(0)}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Start Time</span>
              <span className="text-xs font-medium text-slate-700">
                {booking?.startTime ? new Date(booking.startTime).toLocaleTimeString() : 'Now'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">End Time</span>
              <span className="text-xs font-medium text-slate-700">
                {booking?.endTime ? new Date(booking.endTime).toLocaleTimeString() : '1 hour later'}
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between bg-slate-50/80">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => navigate('/bookings')}
          >
            My Bookings
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            {selectedLot && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLot.latitude},${selectedLot.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <Button variant="secondary" className="w-full">
                  <Navigation className="w-4 h-4 mr-1.5" />
                  Navigate
                </Button>
              </a>
            )}

            {isHeld && (
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                isLoading={payMutation.isPending}
                onClick={() => payMutation.mutate()}
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Demo Pay (₹{((booking?.amountPaise || 4000) / 100).toFixed(0)})
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BookingConfirmation;

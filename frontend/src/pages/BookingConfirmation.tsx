import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Booking, PaymentOrderResponse } from '../types/contract';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { useBookingStore } from '../stores/bookingStore';
import { useAuthStore } from '../stores/authStore';
import { Clock, ShieldCheck, Navigation, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export const BookingConfirmation: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const {
    activeBooking,
    selectedLot,
    setActiveBooking,
  } = useBookingStore();

  const [paymentError, setPaymentError] = useState<string | null>(null);

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

  // Calculate remaining seconds from heldUntil per C3/D5
  const calculateRemaining = useCallback((heldUntil: string | null | undefined): number => {
    if (!heldUntil) return 0;
    const diff = new Date(heldUntil).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  }, []);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return calculateRemaining(booking?.heldUntil);
  });

  // 5-minute countdown timer
  useEffect(() => {
    if (booking?.status !== 'HELD') return;

    // Initial check
    const currentRemaining = calculateRemaining(booking?.heldUntil);
    setSecondsRemaining(currentRemaining);

    const timer = setInterval(() => {
      const remaining = calculateRemaining(booking?.heldUntil);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [booking?.status, booking?.heldUntil, calculateRemaining]);

  // Demo payment confirmation mutation (C7/D7)
  const demoPayMutation = useMutation({
    mutationFn: async () => {
      setPaymentError(null);
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
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Payment confirmation failed.';
      setPaymentError(msg);
    },
  });

  // Razorpay verify payment mutation (Security Rule 6)
  const verifyPaymentMutation = useMutation({
    mutationFn: async (payload: {
      bookingId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      const res = await api.post<{ success: boolean; data: Booking }>('/payments/verify', payload);
      return res.data.data;
    },
    onSuccess: (updatedBooking) => {
      setActiveBooking(updatedBooking);
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Payment verification failed.';
      setPaymentError(msg);
    },
  });

  // Razorpay Checkout flow
  const [isRazorpayLoading, setIsRazorpayLoading] = useState(false);

  const handleRazorpayCheckout = async () => {
    if (!booking) return;
    setPaymentError(null);
    setIsRazorpayLoading(true);

    try {
      // 1. Create Order on backend (Security Rule 6)
      const orderRes = await api.post<{ success: boolean; data: PaymentOrderResponse }>(
        '/payments/create-order',
        { bookingId: booking.id }
      );
      const orderData = orderRes.data.data;

      // 2. Ensure Razorpay checkout script is loaded
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
          document.body.appendChild(script);
        });
      }

      // 3. Open Razorpay Checkout modal
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency,
        name: 'Smart Parking System',
        description: `Reservation for Booking ${booking.bookingCode}`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          await verifyPaymentMutation.mutateAsync({
            bookingId: booking.id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: '#4f46e5',
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Could not initiate Razorpay checkout.';
      setPaymentError(msg);
    } finally {
      setIsRazorpayLoading(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isConfirmed = booking?.status === 'CONFIRMED';
  const isHeld = booking?.status === 'HELD';
  const isExpired = isHeld && secondsRemaining <= 0;

  // Check if Demo Pay is enabled in environment (Absent unless enabled)
  const isDemoPayEnabled = import.meta.env.VITE_DEMO_PAY_ENABLED === 'true';

  // Lot coordinates for Google Maps directions
  const lotLatitude = selectedLot?.latitude ?? 18.5204;
  const lotLongitude = selectedLot?.longitude ?? 73.8415;
  const destinationCoordinates = `${lotLatitude},${lotLongitude}`;

  if (isLoading && !booking) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center text-slate-500">
        Loading booking details...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="text-center border-b pb-6">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
              isConfirmed
                ? 'bg-emerald-100 text-emerald-600'
                : isExpired
                ? 'bg-rose-100 text-rose-600'
                : 'bg-indigo-100 text-indigo-600'
            }`}
          >
            {isConfirmed ? (
              <CheckCircle2 className="w-7 h-7" />
            ) : isExpired ? (
              <AlertCircle className="w-7 h-7" />
            ) : (
              <Clock className="w-7 h-7" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {isConfirmed
              ? 'Booking Confirmed!'
              : isExpired
              ? 'Slot Hold Expired'
              : 'Slot Temporarily Held'}
          </CardTitle>
          <div className="mt-2 flex justify-center">
            <StatusBadge status={isExpired ? 'EXPIRED' : booking?.status || 'HELD'} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {paymentError && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          {/* Prominent Booking Code Callout (C3, D7) with exact text "Show this code to the guard" */}
          <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-1">
              Guard Booking Code
            </p>
            <div
              data-testid="booking-code"
              className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-indigo-900 my-2"
            >
              {booking?.bookingCode || '------'}
            </div>
            <p className="text-sm font-semibold text-indigo-700 mt-2 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Show this code to the guard
            </p>
          </div>

          {/* 5-minute Hold Countdown Notice (D5, D8) */}
          {isHeld && !isExpired && (
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
              <div
                data-testid="countdown-timer"
                className="font-mono text-xl font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-lg"
              >
                {timeFormatted}
              </div>
            </div>
          )}

          {/* Expired Notice */}
          {isExpired && (
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div>
                <p className="font-semibold">Slot hold expired.</p>
                <p className="text-xs text-rose-700">
                  Payment is disabled because the 5-minute hold time has lapsed. Please return to the map to reserve another slot.
                </p>
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

          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
            {/* One-tap Navigate button */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destinationCoordinates}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
              aria-label="Navigate to parking lot"
            >
              <Button variant="secondary" className="w-full">
                <Navigation className="w-4 h-4 mr-1.5" />
                Navigate
              </Button>
            </a>

            {/* Razorpay Online Checkout */}
            {isHeld && !isExpired && (
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                isLoading={isRazorpayLoading || verifyPaymentMutation.isPending}
                onClick={handleRazorpayCheckout}
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Pay ₹{((booking?.amountPaise || 4000) / 100).toFixed(0)}
              </Button>
            )}

            {/* Demo Pay Button - MUST BE ABSENT UNLESS VITE_DEMO_PAY_ENABLED=true */}
            {isDemoPayEnabled && isHeld && !isExpired && (
              <Button
                variant="outline"
                className="w-full sm:w-auto border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                isLoading={demoPayMutation.isPending}
                onClick={() => demoPayMutation.mutate()}
                data-testid="demo-pay-button"
              >
                Demo Pay (₹{((booking?.amountPaise || 4000) / 100).toFixed(0)})
              </Button>
            )}

            {/* If expired, disable payment action */}
            {isExpired && (
              <Button variant="outline" disabled className="w-full sm:w-auto opacity-50 cursor-not-allowed">
                Hold Expired
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default BookingConfirmation;

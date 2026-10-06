import React, { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { ParkingLot, SlotView, Booking } from '../types/contract';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { SlotGrid } from '../components/slot/SlotGrid';
import { TimeWindowSelector, TimeWindow } from '../components/slot/TimeWindowSelector';
import { BusyChart } from '../features/stats/BusyChart';
import { AvailabilityBadge } from '../components/lot/AvailabilityBadge';
import { useArrivalAvailability } from '../hooks/useArrivalAvailability';
import { blendArrivalAvailability, indiaTimeParts } from '@smart-parking/shared';
import { formatLotName, formatArrivalLabel } from '../utils/lotUtils';
import { useAuthStore } from '../stores/authStore';
import { useBookingStore } from '../stores/bookingStore';
import { validateVehicleNumber } from '../schemas/bookingSchemas';
import { useLotSocket } from '../services/socket';
import {
  MapPinIcon,
  NavigationIcon,
  ChevronLeftIcon,
  ClockIcon,
  CarIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from '../components/common/icons';

const AvailabilityPatternChart = lazy(
  () => import('../features/stats/AvailabilityPatternChart')
);

export const LotDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { setSelectedLot, setSelectedSlot, setActiveBooking } = useBookingStore();

  const [selectedSlotLocal, setSelectedSlotLocal] = useState<SlotView | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to real-time slot and lot updates via WebSocket (C9)
  useLotSocket(id);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialFrom = searchParams.get('from');

  // Time window state for C7 GET /parking-lots/:id/slots?from=&to=
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    if (initialFrom) {
      const parsed = new Date(initialFrom);
      if (!isNaN(parsed.getTime()) && parsed.getTime() >= Date.now() - 30 * 1000) {
        return {
          from: parsed.toISOString(),
          to: new Date(parsed.getTime() + 3600 * 1000).toISOString(),
          durationHours: 1,
        };
      }
    }
    return {
      from: new Date().toISOString(),
      to: new Date(Date.now() + 3600 * 1000).toISOString(),
      durationHours: 1,
    };
  });

  const handleTimeWindowChange = useCallback((tw: TimeWindow) => {
    setTimeWindow(tw);
    // Clear slot selection if window changes
    setSelectedSlotLocal(null);
    setSearchParams({ from: tw.from }, { replace: true });
  }, [setSearchParams]);

  // 1. Fetch Lot Details with React Query
  const {
    data: lot,
    isLoading: lotLoading,
    isError: lotError,
  } = useQuery<ParkingLot>({
    queryKey: ['parking-lot', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ParkingLot }>(`/parking-lots/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  // 2. Fetch User's Own Bookings with React Query (to color own RESERVED slots blue)
  const { data: userBookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings-my'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Booking[] }>('/bookings/my');
      return res.data.data;
    },
    enabled: isAuthenticated,
  });

  // 3. Fetch Slots with Time Window query params with React Query
  const {
    data: slots,
    isLoading: slotsLoading,
    isError: slotsError,
    error: slotsErrorObj,
    refetch: refetchSlots,
  } = useQuery<SlotView[]>({
    queryKey: ['parking-slots', id, timeWindow.from, timeWindow.to],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SlotView[] }>(
        `/parking-lots/${id}/slots`,
        {
          params: {
            from: timeWindow.from,
            to: timeWindow.to,
          },
        }
      );
      return res.data.data;
    },
    enabled: !!id,
    refetchInterval: 10000,
  });

  // 4. Hold Slot Mutation (POST /bookings)
  const holdSlotMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlotLocal) throw new Error('Please select a slot');
      setErrorMessage(null);

      // Ensure startTime has not drifted into the past while browsing the page
      const startDate = new Date(timeWindow.from);
      const endDate = new Date(timeWindow.to);
      const now = Date.now();

      let effectiveStart = timeWindow.from;
      let effectiveEnd = timeWindow.to;

      if (isNaN(startDate.getTime()) || startDate.getTime() < now) {
        const durationMs = !isNaN(endDate.getTime()) && !isNaN(startDate.getTime())
          ? Math.max(15 * 60 * 1000, endDate.getTime() - startDate.getTime())
          : 60 * 60 * 1000;
        const freshStart = new Date();
        const freshEnd = new Date(freshStart.getTime() + durationMs);
        effectiveStart = freshStart.toISOString();
        effectiveEnd = freshEnd.toISOString();
      }

      const res = await api.post<{ success: boolean; data: Booking }>(
        '/bookings',
        {
          slotId: selectedSlotLocal.id,
          startTime: effectiveStart,
          endTime: effectiveEnd,
          vehicleNumber: vehicleNumber.trim() ? vehicleNumber.toUpperCase() : undefined,
        },
        {
          headers: {
            'Idempotency-Key': `hold-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          },
        }
      );
      return res.data.data;
    },
    onSuccess: (booking) => {
      if (lot && selectedSlotLocal) {
        setSelectedLot(lot);
        setSelectedSlot(selectedSlotLocal);
        setActiveBooking(booking);
      }
      queryClient.invalidateQueries({ queryKey: ['parking-slots', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] });
      navigate(`/booking/confirm/${booking.id}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { code?: string; message?: string };
        };
      };
      if (
        axiosErr?.response?.status === 409 ||
        axiosErr?.response?.data?.code === 'SLOT_UNAVAILABLE' ||
        axiosErr?.response?.data?.message?.toLowerCase().includes('just taken')
      ) {
        setErrorMessage('Slot just taken. Please select another slot.');
        setSelectedSlotLocal(null);
        queryClient.invalidateQueries({ queryKey: ['parking-slots', id] });
      } else {
        const msg =
          axiosErr?.response?.data?.message || 'Slot could not be held. It may have just been reserved.';
        setErrorMessage(msg);
      }
    },
  });

  // 5. Fetch arrival availability for the chosen window's start time
  const { data: availabilityData } = useArrivalAvailability(timeWindow.from);

  const { arrivalScore, arrivalPattern } = useMemo(() => {
    if (!lot || !availabilityData?.lots) {
      return { arrivalScore: null, arrivalPattern: [] };
    }
    const apiItem = availabilityData.lots.find((l) => l.parkingLotId === lot.id);
    if (!apiItem) {
      return { arrivalScore: null, arrivalPattern: [] };
    }
    const currentFreePercent =
      lot.totalSlots > 0 ? (100 * lot.freeCount) / lot.totalSlots : 0;
    const score = blendArrivalAvailability(
      apiItem.historical.expectedAvailablePercentAtArrival,
      apiItem.historical.expectedAvailablePercentNow,
      currentFreePercent,
      new Date(timeWindow.from),
      new Date()
    );
    return {
      arrivalScore: score,
      arrivalPattern: apiItem.pattern,
    };
  }, [lot, availabilityData, timeWindow.from]);

  const handleHoldClick = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/lots/${id}` } } });
      return;
    }
    const valResult = validateVehicleNumber(vehicleNumber);
    if (!valResult.isValid) {
      setErrorMessage(valResult.error || 'Invalid vehicle number');
      return;
    }
    setErrorMessage(null);
    holdSlotMutation.mutate();
  };

  if (lotLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading lot details">
        <Skeleton variant="text" width={240} height={32} />
        <Skeleton variant="rectangular" width="100%" height={260} className="rounded-2xl" />
      </div>
    );
  }

  if (lotError || !lot) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
        <p className="text-slate-700 font-semibold text-lg">Parking lot not found or unavailable.</p>
        <p className="text-slate-500 text-sm mt-1">Please return to the map to choose an active parking facility.</p>
        <Button variant="primary" className="mt-5" onClick={() => navigate(`/?from=${encodeURIComponent(timeWindow.from)}`)}>
          Return to Map
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/?from=${encodeURIComponent(timeWindow.from)}`)}
            className="p-2 min-h-[40px] min-w-[40px]"
            aria-label="Back to map"
          >
            <ChevronLeftIcon className="w-5 h-5 text-slate-700" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatLotName(lot.name)}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
              <MapPinIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>{lot.address}</span>
            </p>
          </div>
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lot.latitude},${lot.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="gap-1.5">
            <NavigationIcon className="w-4 h-4 text-indigo-600" />
            Directions
          </Button>
        </a>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="hold-error-alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-900 text-sm shadow-2xs"
        >
          <AlertCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Pricing and Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Hourly Rate
          </span>
          <span className="text-xl font-bold text-indigo-600 font-mono">
            ₹{(lot.pricePerHourPaise / 100).toFixed(0)} / hr
          </span>
        </Card>
        <Card className="p-4 flex items-center justify-between shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Free Spots
          </span>
          <span className="text-xl font-bold text-emerald-600 font-mono">
            {lot.freeCount} / {lot.totalSlots}
          </span>
        </Card>
        <Card className="p-4 flex items-center justify-between shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operating Status
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 flex items-center gap-1 border border-emerald-200">
            <CheckCircleIcon className="w-3 h-3 text-emerald-700" />
            Open 24/7 &bull; Realtime
          </span>
        </Card>
      </div>

      {/* Estimated Arrival Availability Badge */}
      <AvailabilityBadge
        score={arrivalScore}
        arrivalTimeLabel={formatArrivalLabel(new Date(timeWindow.from))}
      />

      {/* Time Window Selector */}
      <TimeWindowSelector
        value={timeWindow}
        initialFrom={initialFrom || undefined}
        pricePerHourPaise={lot.pricePerHourPaise}
        onChange={handleTimeWindowChange}
      />

      {/* Slot Grid Container */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Slot Availability Grid
        </h2>

        <SlotGrid
          slots={slots}
          selectedSlotId={selectedSlotLocal?.id}
          userBookings={userBookings}
          isLoading={slotsLoading}
          isError={slotsError}
          errorMessage={(slotsErrorObj as Error)?.message}
          onRetry={() => refetchSlots()}
          onSelectSlot={(slot) => setSelectedSlotLocal(slot)}
        />

        {/* Action Panel for Selected Slot */}
        {selectedSlotLocal && (
          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/70 p-5 rounded-2xl border border-indigo-200 shadow-xs">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Selected Slot:{' '}
                <span className="text-indigo-600 font-extrabold text-lg font-mono">
                  {selectedSlotLocal.slotNumber}
                </span>
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
                Reserves a 5-minute hold for {timeWindow.durationHours} hr
                {timeWindow.durationHours > 1 ? 's' : ''} parking
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Vehicle No (e.g. MH12AB1234)"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                maxLength={15}
                aria-label="Vehicle registration number"
                className="w-full sm:w-56 px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 uppercase font-mono shadow-2xs"
              />
              <Button
                variant="primary"
                onClick={handleHoldClick}
                isLoading={holdSlotMutation.isPending}
                className="w-full sm:w-auto whitespace-nowrap font-semibold gap-1.5"
              >
                <CarIcon className="w-4 h-4" />
                Hold Slot & Proceed
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Availability Pattern Around Arrival */}
      {arrivalPattern.length > 0 && (
        <div className="mt-8">
          <Suspense fallback={<div className="h-44 bg-slate-100 rounded-xl animate-pulse" />}>
            <AvailabilityPatternChart
              pattern={arrivalPattern}
              arrivalHour={indiaTimeParts(new Date(timeWindow.from)).hourOfDay}
              lotName={formatLotName(lot.name)}
              isLimitedData={arrivalScore === null}
            />
          </Suspense>
        </div>
      )}

      {/* Occupancy Analytics (BusyChart by Member 4) */}
      <div id="busy-chart-mount-point" className="mt-8">
        <BusyChart lotId={lot.id} />
      </div>
    </div>
  );
};

export default LotDetails;

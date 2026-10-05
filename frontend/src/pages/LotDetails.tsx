import React, { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { ParkingLot, SlotView, Booking } from '../types/contract';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { SlotGrid } from '../components/slot/SlotGrid';
import { TimeWindowSelector, TimeWindow } from '../components/slot/TimeWindowSelector';
import { BusyChart } from '../features/stats/BusyChart';
import { AvailabilityBadge } from '../components/lot/AvailabilityBadge';
import { useArrivalAvailability } from '../hooks/useArrivalAvailability';
import { blendArrivalAvailability, indiaTimeParts } from '@smart-parking/shared';
import { useAuthStore } from '../stores/authStore';
import { useBookingStore } from '../stores/bookingStore';
import { validateVehicleNumber } from '../schemas/bookingSchemas';
import { useLotSocket } from '../services/socket';
import { MapPin, Navigation, ArrowLeft, Clock, Car, AlertCircle } from 'lucide-react';

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

  const [searchParams] = useSearchParams();
  const initialFrom = searchParams.get('from');

  // Time window state for C7 GET /parking-lots/:id/slots?from=&to=
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    if (initialFrom) {
      const parsed = new Date(initialFrom);
      if (!isNaN(parsed.getTime())) {
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
  }, []);

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

      const res = await api.post<{ success: boolean; data: Booking }>(
        '/bookings',
        {
          slotId: selectedSlotLocal.id,
          startTime: timeWindow.from,
          endTime: timeWindow.to,
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
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (lotError || !lot) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 font-semibold">Parking lot not found or unavailable.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
          Return to Map
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="p-2"
            aria-label="Back to map"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{lot.name}</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {lot.address}
            </p>
          </div>
        </div>

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lot.latitude},${lot.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            <Navigation className="w-4 h-4 mr-1.5" />
            Directions
          </Button>
        </a>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="hold-error-alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Pricing and Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Hourly Rate</span>
          <span className="text-lg font-bold text-indigo-600">
            ₹{(lot.pricePerHourPaise / 100).toFixed(0)} / hr
          </span>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Free Spots</span>
          <span className="text-lg font-bold text-emerald-600">
            {lot.freeCount} / {lot.totalSlots}
          </span>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Operating Status</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
            Open 24/7 &bull; Realtime
          </span>
        </Card>
      </div>

      {/* Estimated Arrival Availability Badge */}
      <AvailabilityBadge
        score={arrivalScore}
        arrivalTimeLabel={new Date(timeWindow.from).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      />

      {/* Time Window Selector (React Query dependency) */}
      <TimeWindowSelector
        pricePerHourPaise={lot.pricePerHourPaise}
        onChange={handleTimeWindowChange}
      />

      {/* Slot Grid Container */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">
          Slot Availability Grid
        </h3>

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
                <span className="text-indigo-600 font-extrabold text-lg">
                  {selectedSlotLocal.slotNumber}
                </span>
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
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
                className="w-full sm:w-56 px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
              />
              <Button
                variant="primary"
                onClick={handleHoldClick}
                isLoading={holdSlotMutation.isPending}
                className="w-full sm:w-auto whitespace-nowrap font-semibold"
              >
                <Car className="w-4 h-4 mr-1.5" />
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
              lotName={lot.name}
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

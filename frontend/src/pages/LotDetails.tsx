import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { ParkingLot, SlotView, Booking } from '../types/contract';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { SlotCell } from '../components/common/SlotCell';
import { StatusBadge } from '../components/common/StatusBadge';
import { BusyChart } from '../features/stats/BusyChart';
import { useAuthStore } from '../stores/authStore';
import { useBookingStore } from '../stores/bookingStore';
import { MapPin, Navigation, ArrowLeft, Clock, Car, AlertCircle } from 'lucide-react';

export const LotDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { setSelectedLot, setSelectedSlot, setActiveBooking } = useBookingStore();

  const [selectedSlotLocal, setSelectedSlotLocal] = useState<SlotView | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Lot Details
  const { data: lot, isLoading: lotLoading } = useQuery<ParkingLot>({
    queryKey: ['parking-lot', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ParkingLot }>(`/parking-lots/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  // 2. Fetch Slots for this lot
  const { data: slots, isLoading: slotsLoading } = useQuery<SlotView[]>({
    queryKey: ['parking-slots', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SlotView[] }>(`/parking-lots/${id}/slots`);
      return res.data.data;
    },
    enabled: !!id,
    refetchInterval: 5000, // Poll every 5s for live status updates in mock mode
  });

  // 3. Mutation: Hold Slot (POST /bookings)
  const holdSlotMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlotLocal) throw new Error('Please select a slot');
      setErrorMessage(null);

      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour booking

      const res = await api.post<{ success: boolean; data: Booking }>(
        '/bookings',
        {
          slotId: selectedSlotLocal.id,
          startTime,
          endTime,
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
      navigate(`/booking/confirm/${booking.id}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Slot could not be held. It may have just been taken.';
      setErrorMessage(msg);
    },
  });

  const handleHoldClick = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/lots/${id}` } } });
      return;
    }
    holdSlotMutation.mutate();
  };

  if (lotLoading || slotsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Parking lot not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
          Back to Lots
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="p-2"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lot.name}</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5" />
            {lot.address}
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lot Info Card */}
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
          <span className="text-xs font-medium text-slate-500">Directions</span>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lot.latitude},${lot.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
          >
            <Navigation className="w-3.5 h-3.5" />
            Open Maps
          </a>
        </Card>
      </div>

      {/* Slot Status Legend (D3) */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
        <span className="font-semibold text-slate-700 mr-2">Slot Legend:</span>
        <StatusBadge status="AVAILABLE" size="sm" />
        <StatusBadge status="HELD" size="sm" />
        <StatusBadge status="RESERVED" size="sm" />
        <StatusBadge status="OCCUPIED" size="sm" />
      </div>

      {/* Interactive Slot Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Select an Available Slot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {slots?.map((slot) => (
              <SlotCell
                key={slot.id}
                slot={slot}
                isSelected={selectedSlotLocal?.id === slot.id}
                onSelect={(selected) => setSelectedSlotLocal(selected)}
              />
            ))}
          </div>

          {/* Action Footer for Slot Reservation */}
          {selectedSlotLocal && (
            <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Selected Slot:{' '}
                  <span className="text-indigo-600 font-bold text-base">
                    {selectedSlotLocal.slotNumber}
                  </span>
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Holding this slot gives you a 5-minute countdown window to complete payment
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Vehicle No (e.g. MH12AB1234)"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="w-full sm:w-56 px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                />
                <Button
                  variant="primary"
                  onClick={handleHoldClick}
                  isLoading={holdSlotMutation.isPending}
                  className="w-full sm:w-auto whitespace-nowrap"
                >
                  <Car className="w-4 h-4 mr-1.5" />
                  Hold Slot & Proceed
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Occupancy Analytics (BusyChart by Member 4) */}
      <div id="busy-chart-mount-point" className="mt-8">
        <BusyChart lotId={lot.id} />
      </div>
    </div>
  );
};

export default LotDetails;

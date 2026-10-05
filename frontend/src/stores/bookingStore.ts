import { create } from 'zustand';
import { Booking, ParkingLot, SlotView } from '../types/contract';

interface BookingState {
  selectedLot: ParkingLot | null;
  selectedSlot: SlotView | null;
  activeBooking: Booking | null;
  vehicleNumber: string;
  holdSecondsRemaining: number;
  isHolding: boolean;

  setSelectedLot: (lot: ParkingLot | null) => void;
  setSelectedSlot: (slot: SlotView | null) => void;
  setVehicleNumber: (vehicleNumber: string) => void;
  setActiveBooking: (booking: Booking | null) => void;
  setHoldSecondsRemaining: (seconds: number) => void;
  decrementHoldSeconds: () => void;
  resetBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedLot: null,
  selectedSlot: null,
  activeBooking: null,
  vehicleNumber: '',
  holdSecondsRemaining: 300, // 5-minute hold window (C3/D5)
  isHolding: false,

  setSelectedLot: (selectedLot) => set({ selectedLot }),
  setSelectedSlot: (selectedSlot) => set({ selectedSlot }),
  setVehicleNumber: (vehicleNumber) => set({ vehicleNumber }),
  setActiveBooking: (activeBooking) =>
    set({
      activeBooking,
      isHolding: activeBooking?.status === 'HELD',
      holdSecondsRemaining: 300,
    }),
  setHoldSecondsRemaining: (holdSecondsRemaining) =>
    set({ holdSecondsRemaining, isHolding: holdSecondsRemaining > 0 }),
  decrementHoldSeconds: () =>
    set((state) => {
      const remaining = Math.max(0, state.holdSecondsRemaining - 1);
      return {
        holdSecondsRemaining: remaining,
        isHolding: remaining > 0,
      };
    }),
  resetBooking: () =>
    set({
      selectedLot: null,
      selectedSlot: null,
      activeBooking: null,
      vehicleNumber: '',
      holdSecondsRemaining: 0,
      isHolding: false,
    }),
}));

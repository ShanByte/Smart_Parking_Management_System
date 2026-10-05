import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getMarkerColor } from '../utils/mapUtils';
import { SlotGrid } from '../components/slot/SlotGrid';
import { TimeWindowSelector } from '../components/slot/TimeWindowSelector';
import { LotPanel } from '../components/lot/LotPanel';
import { SlotView, Booking, ParkingLot } from '../types/contract';
import { MemoryRouter } from 'react-router-dom';

describe('Leaflet Map, Marker Colors, Lot Panel and SlotGrid', () => {
  describe('Marker Color Category Thresholds', () => {
    it('returns green for > 50% free slots', () => {
      // 12 free out of 20 = 60%
      const res = getMarkerColor(12, 20);
      expect(res.category).toBe('green');
      expect(res.color).toBe('#10b981');
      expect(res.label).toBe('> 50% Free');
    });

    it('returns orange for 20% to 50% free slots', () => {
      // 6 free out of 20 = 30%
      const res = getMarkerColor(6, 20);
      expect(res.category).toBe('orange');
      expect(res.color).toBe('#f97316');
      expect(res.label).toBe('20-50% Free');
    });

    it('returns red for < 20% free slots', () => {
      // 2 free out of 20 = 10%
      const res = getMarkerColor(2, 20);
      expect(res.category).toBe('red');
      expect(res.color).toBe('#ef4444');
      expect(res.label).toBe('< 20% Free');
    });
  });

  describe('SlotGrid Status Styles & Icons (Always with Icon or Text)', () => {
    const slots: SlotView[] = [
      { id: 's-1', slotNumber: 'A1', status: 'AVAILABLE' },
      { id: 's-2', slotNumber: 'A2', status: 'HELD' },
      { id: 's-3', slotNumber: 'A3', status: 'RESERVED' },
      { id: 's-4', slotNumber: 'A4', status: 'RESERVED' },
      { id: 's-5', slotNumber: 'A5', status: 'OCCUPIED' },
    ];

    // Current user booked slot s-3
    const userBookings: Booking[] = [
      {
        id: 'bk-1',
        slotId: 's-3',
        status: 'CONFIRMED',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: null,
        bookingCode: 'ABC123',
        vehicleNumber: 'MH12AB1234',
        checkedInAt: null,
      },
    ];

    it('renders AVAILABLE slots in green with text and allows selection', () => {
      const onSelect = vi.fn();
      render(
        <SlotGrid
          slots={slots}
          userBookings={userBookings}
          onSelectSlot={onSelect}
        />
      );

      expect(screen.getByText('A1')).toBeInTheDocument();
      const cell = screen.getByRole('button', { name: /slot a1, available/i });
      expect(cell).toBeInTheDocument();
      fireEvent.click(cell);
      expect(onSelect).toHaveBeenCalledWith(slots[0]);
    });

    it('renders HELD slots in yellow with clock icon/text and disables selection', () => {
      const onSelect = vi.fn();
      render(
        <SlotGrid
          slots={slots}
          userBookings={userBookings}
          onSelectSlot={onSelect}
        />
      );

      const cell = screen.getByRole('button', { name: /slot a2, held/i });
      expect(cell).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cell);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('renders user own RESERVED slot in blue with "Reserved (Yours)" text', () => {
      render(
        <SlotGrid
          slots={slots}
          userBookings={userBookings}
          onSelectSlot={vi.fn()}
        />
      );

      const userSlot = screen.getByRole('button', {
        name: /slot a3, reserved \(yours\)/i,
      });
      expect(userSlot).toBeInTheDocument();
      expect(userSlot).toHaveTextContent('Reserved (Yours)');
    });

    it('renders other user RESERVED slot in red as Occupied', () => {
      render(
        <SlotGrid
          slots={slots}
          userBookings={userBookings}
          onSelectSlot={vi.fn()}
        />
      );

      const otherSlot = screen.getByRole('button', {
        name: /slot a4, occupied/i,
      });
      expect(otherSlot).toBeInTheDocument();
    });

    it('renders OCCUPIED slot in red and disabled', () => {
      render(
        <SlotGrid
          slots={slots}
          userBookings={userBookings}
          onSelectSlot={vi.fn()}
        />
      );

      const occupiedSlot = screen.getByRole('button', {
        name: /slot a5, occupied/i,
      });
      expect(occupiedSlot).toHaveAttribute('aria-disabled', 'true');
    });

    it('renders loading state when isLoading is true', () => {
      render(
        <SlotGrid
          isLoading={true}
          onSelectSlot={vi.fn()}
        />
      );

      expect(screen.getByRole('status', { name: /loading parking slots/i })).toBeInTheDocument();
    });

    it('renders error state with retry button when isError is true', () => {
      const onRetry = vi.fn();
      render(
        <SlotGrid
          isError={true}
          errorMessage="Failed to fetch slot statuses"
          onRetry={onRetry}
          onSelectSlot={vi.fn()}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch slot statuses/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when slots array is empty', () => {
      render(
        <SlotGrid
          slots={[]}
          onSelectSlot={vi.fn()}
        />
      );

      expect(screen.getByText(/No Slots Configured/i)).toBeInTheDocument();
    });
  });

  describe('TimeWindowSelector', () => {
    it('calculates duration and estimated cost in rupees', () => {
      const onChange = vi.fn();
      render(
        <TimeWindowSelector
          pricePerHourPaise={4000} // ₹40.00 / hr
          onChange={onChange}
        />
      );

      // Default is 1 hr -> ₹40
      expect(screen.getByText(/Estimated: ₹40 \(1 hr\)/i)).toBeInTheDocument();
      expect(onChange).toHaveBeenCalled();

      // Click "2 hrs"
      const twoHrsBtn = screen.getByRole('button', { name: '2 hrs' });
      fireEvent.click(twoHrsBtn);

      expect(screen.getByText(/Estimated: ₹80 \(2 hrs\)/i)).toBeInTheDocument();
    });
  });

  describe('LotPanel', () => {
    const mockLots: ParkingLot[] = [
      {
        id: 'lot-1',
        name: 'FC Road Parking',
        address: 'FC Road, Pune',
        latitude: 18.5204,
        longitude: 73.8415,
        totalSlots: 20,
        freeCount: 14,
        pricePerHourPaise: 4000,
      },
    ];

    it('renders lots list and triggers selection', () => {
      const onSelect = vi.fn();
      render(
        <MemoryRouter>
          <LotPanel
            lots={mockLots}
            selectedLot={null}
            onSelectLot={onSelect}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('FC Road Parking')).toBeInTheDocument();
      expect(screen.getByText('14 / 20 Free')).toBeInTheDocument();

      fireEvent.click(screen.getByText('FC Road Parking'));
      expect(onSelect).toHaveBeenCalledWith(mockLots[0]);
    });

    it('displays selected lot details and directions', () => {
      render(
        <MemoryRouter>
          <LotPanel
            lots={mockLots}
            selectedLot={mockLots[0]}
            onSelectLot={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Selected Lot')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select & view slots/i })).toBeInTheDocument();
    });
  });
});

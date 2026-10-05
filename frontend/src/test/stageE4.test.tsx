import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LotPanel } from '../components/lot/LotPanel';
import { SlotGrid } from '../components/slot/SlotGrid';
import { SlotLegend } from '../components/common/SlotLegend';
import { ParkingLot, SlotView, Booking } from '../types/contract';

describe('Stage E4: Home, Map, Lot Cards, and Slot Grid Suite', () => {
  const mockLots: ParkingLot[] = [
    {
      id: 'lot-1',
      name: 'FC Road Central Parking',
      address: 'Deccan Gymkhana, FC Road, Pune',
      latitude: 18.5204,
      longitude: 73.8415,
      totalSlots: 50,
      freeCount: 35,
      pricePerHourPaise: 4000,
    },
    {
      id: 'lot-2',
      name: 'JM Road Municipal Complex',
      address: 'Shivajinagar, JM Road, Pune',
      latitude: 18.5304,
      longitude: 73.8515,
      totalSlots: 100,
      freeCount: 15,
      pricePerHourPaise: 5000,
    },
  ];

  const mockSlots: SlotView[] = [
    { id: 'slot-1', slotNumber: 'A1', status: 'AVAILABLE' },
    { id: 'slot-2', slotNumber: 'A2', status: 'HELD' },
    { id: 'slot-3', slotNumber: 'A3', status: 'RESERVED' },
    { id: 'slot-4', slotNumber: 'A4', status: 'OCCUPIED' },
  ];

  const mockBookings: Booking[] = [
    {
      id: 'b-1',
      slotId: 'slot-3',
      status: 'CONFIRMED',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      amountPaise: 4000,
      heldUntil: null,
      bookingCode: 'CONF123',
      vehicleNumber: 'MH12AB1234',
      checkedInAt: null,
    },
  ];

  describe('Lot Card & LotPanel Content', () => {
    it('renders lot cards with name, address, price, and occupancy stats', () => {
      render(
        <MemoryRouter>
          <LotPanel
            lots={mockLots}
            selectedLot={null}
            onSelectLot={vi.fn()}
            scoresByLotId={{ 'lot-1': 85, 'lot-2': 40 }}
            recommendedLotId="lot-1"
            distancesByLotId={{ 'lot-1': 1.2, 'lot-2': 3.4 }}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
      expect(screen.getByText('JM Road Municipal Complex')).toBeInTheDocument();
      expect(screen.getByText(/35 \/ 50 Free/i)).toBeInTheDocument();
      expect(screen.getByText('₹40/hr')).toBeInTheDocument();
      expect(screen.getByText('₹50/hr')).toBeInTheDocument();
      expect(screen.getByText(/1.2 km/i)).toBeInTheDocument();
    });

    it('renders selected lot card with directions link and view slots button', () => {
      const onSelect = vi.fn();
      render(
        <MemoryRouter>
          <LotPanel
            lots={mockLots}
            selectedLot={mockLots[0]}
            onSelectLot={onSelect}
            scoresByLotId={{ 'lot-1': 85 }}
            recommendedLotId="lot-1"
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Selected Lot')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select & view slots/i })).toBeInTheDocument();
      const directionsLink = screen.getByRole('link', { name: /directions to fc road central parking/i });
      expect(directionsLink).toHaveAttribute('href', expect.stringContaining('google.com/maps/dir'));
    });

    it('renders empty state when filtered lots list is empty', () => {
      render(
        <MemoryRouter>
          <LotPanel lots={[]} selectedLot={null} onSelectLot={vi.fn()} />
        </MemoryRouter>
      );

      expect(screen.getByText(/no parking lots found/i)).toBeInTheDocument();
    });
  });

  describe('Slot Grid States, Keyboard Navigation, and Realtime Highlight', () => {
    it('renders all slot status badges and parking bay numbers', () => {
      render(
        <SlotGrid
          slots={mockSlots}
          userBookings={mockBookings}
          onSelectSlot={vi.fn()}
        />
      );

      expect(screen.getByText('A1')).toBeInTheDocument();
      expect(screen.getByText('A2')).toBeInTheDocument();
      expect(screen.getByText('A3')).toBeInTheDocument();
      expect(screen.getByText('A4')).toBeInTheDocument();

      expect(screen.getByRole('button', { name: /slot a1, available/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slot a2, held/i })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: /slot a3, reserved \(yours\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slot a4, occupied/i })).toHaveAttribute('aria-disabled', 'true');
    });

    it('supports selecting an available slot using Enter and Space keys', () => {
      const onSelect = vi.fn();
      render(
        <SlotGrid
          slots={mockSlots}
          userBookings={mockBookings}
          onSelectSlot={onSelect}
        />
      );

      const cell = screen.getByRole('button', { name: /slot a1, available/i });
      fireEvent.keyDown(cell, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledWith(mockSlots[0]);

      fireEvent.keyDown(cell, { key: ' ' });
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('prevents keyboard selection on disabled occupied or held slots', () => {
      const onSelect = vi.fn();
      render(
        <SlotGrid
          slots={mockSlots}
          userBookings={mockBookings}
          onSelectSlot={onSelect}
        />
      );

      const occupiedCell = screen.getByRole('button', { name: /slot a4, occupied/i });
      fireEvent.keyDown(occupiedCell, { key: 'Enter' });
      fireEvent.click(occupiedCell);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('renders selected badge indicator when selectedSlotId matches', () => {
      render(
        <SlotGrid
          slots={mockSlots}
          selectedSlotId="slot-1"
          userBookings={mockBookings}
          onSelectSlot={vi.fn()}
        />
      );

      expect(screen.getByText(/selected/i)).toBeInTheDocument();
    });

    it('renders pulse highlight ring when recentlyUpdatedSlotId matches', () => {
      render(
        <SlotGrid
          slots={mockSlots}
          recentlyUpdatedSlotId="slot-1"
          userBookings={mockBookings}
          onSelectSlot={vi.fn()}
        />
      );

      const cell = screen.getByRole('button', { name: /slot a1, available/i });
      expect(cell).toHaveClass('ring-4');
    });
  });

  describe('Slot Legend Component', () => {
    it('renders clear descriptions for all four slot states', () => {
      render(<SlotLegend />);
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Ready to reserve')).toBeInTheDocument();
      expect(screen.getByText('Held')).toBeInTheDocument();
      expect(screen.getByText(/5m grace/i)).toBeInTheDocument();
      expect(screen.getByText('Reserved')).toBeInTheDocument();
      expect(screen.getByText('Occupied')).toBeInTheDocument();
    });
  });
});

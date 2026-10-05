import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuardCheckIn } from '../features/guard/components/GuardCheckIn';
import { GuardGateBoard } from '../features/guard/components/GuardGateBoard';
import { AdminOverview } from '../features/admin/components/AdminOverview';
import { BookingsManagement } from '../features/admin/components/BookingsManagement';
import { BusyChart } from '../features/stats/BusyChart';
import { GuardBoardSlot } from '../types/contract';
import { BookingView } from '../features/admin/types';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Stage E6: Guard Console, Admin Dashboard, and Busy Chart Redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Guard Console UI & Privacy', () => {
    it('verifies touch target >= 48px and privacy protection on GuardCheckIn', () => {
      renderWithProviders(<GuardCheckIn onCheckInSuccess={vi.fn()} />);

      // Privacy banner present
      expect(screen.getByText(/Driver Privacy Protected/i)).toBeInTheDocument();

      // Check-in button has min-h-[48px] / h-12 touch target
      const verifyBtn = screen.getByRole('button', { name: /verify & check in/i });
      expect(verifyBtn).toBeInTheDocument();
      expect(verifyBtn.className).toMatch(/h-12|min-h-\[48px\]/);

      // Input has min-h-[48px] / h-12 touch target
      const input = screen.getByRole('textbox', { name: /booking code/i });
      expect(input).toBeInTheDocument();
      expect(input.className).toMatch(/h-12|min-h-\[48px\]/);

      // Ensure no fields for customer name, email, or phone exist
      expect(screen.queryByLabelText(/customer name|email|phone/i)).not.toBeInTheDocument();
    });

    it('verifies GuardGateBoard touch targets >= 48px and ensures driver name/email are never displayed', () => {
      const mockSlots: GuardBoardSlot[] = [
        {
          slotId: 's-101',
          slotNumber: 'A1',
          status: 'RESERVED',
          source: 'APP',
          booking: {
            bookingId: 'bk-99',
            bookingCode: 'CONF99',
            vehicleNumber: 'MH12XX9999',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 3600000).toISOString(),
            status: 'CONFIRMED',
            checkedInAt: null,
          },
        },
        {
          slotId: 's-102',
          slotNumber: 'A2',
          status: 'AVAILABLE',
          source: 'SENSOR',
          booking: null,
        },
      ];

      renderWithProviders(<GuardGateBoard slots={mockSlots} onSelectSlot={vi.fn()} />);

      // Filter buttons have touch targets >= 48px
      const allFilterBtn = screen.getByRole('button', { name: /^all slots/i });
      expect(allFilterBtn.className).toMatch(/h-12|min-h-\[48px\]/);

      const availableFilterBtn = screen.getByRole('button', { name: /^available/i });
      expect(availableFilterBtn.className).toMatch(/h-12|min-h-\[48px\]/);

      // Booking details rendered correctly
      expect(screen.getByText('CONF99')).toBeInTheDocument();
      expect(screen.getByText('MH12XX9999')).toBeInTheDocument();

      // Privacy verification: booker personal identifiers must never appear in the DOM
      expect(screen.queryByText(/john doe|user@example\.com|\+91/i)).not.toBeInTheDocument();
    });
  });

  describe('Admin Dashboard Redesign', () => {
    it('renders overview summary metric tiles with icons and manage navigation', () => {
      const onNavigateTab = vi.fn();
      renderWithProviders(
        <AdminOverview
          lotsCount={5}
          slotsCount={120}
          bookingsCount={42}
          devicesCount={8}
          onNavigateTab={onNavigateTab}
        />
      );

      expect(screen.getByText('Parking Lots')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();

      expect(screen.getByText('Total Slots')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();

      expect(screen.getByText('Active Bookings')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();

      expect(screen.getByText('Hardware & Sim Devices')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();

      // Clicking a card navigates to the tab
      fireEvent.click(screen.getByText('Parking Lots'));
      expect(onNavigateTab).toHaveBeenCalledWith('lots');
    });

    it('renders BookingsManagement table with sticky headers and status badges', () => {
      const mockBookings: BookingView[] = [
        {
          id: 'bk-adm-1',
          bookingCode: 'ADM123',
          slotId: 'slot-1',
          status: 'CONFIRMED',
          vehicleNumber: 'MH14AA1111',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          amountPaise: 5000,
          heldUntil: null,
          checkedInAt: null,
        },
      ];

      const { container } = renderWithProviders(
        <BookingsManagement
          bookings={mockBookings}
          activeStatusFilter="ALL"
          onChangeStatusFilter={vi.fn()}
          onRefresh={vi.fn()}
        />
      );

      // Verify sticky thead
      const thead = container.querySelector('thead');
      expect(thead).toBeInTheDocument();
      expect(thead?.className).toContain('sticky');
      expect(thead?.className).toContain('top-0');

      // Verify row content
      expect(screen.getByText('ADM123')).toBeInTheDocument();
      expect(screen.getByText('slot-1')).toBeInTheDocument();
      expect(screen.getByText('MH14AA1111')).toBeInTheDocument();
    });
  });

  describe('BusyChart Container & Accessibility', () => {
    it('renders BusyChart container and accessible table breakdown fallback', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            parkingLotId: 'lot-test-1',
            totalSlots: 30,
            hours: [
              { hourOfDay: 8, averageOccupiedPercent: 20, samples: 10 },
              { hourOfDay: 9, averageOccupiedPercent: 65, samples: 15 },
              { hourOfDay: 10, averageOccupiedPercent: 85, samples: 20 },
            ],
          },
        },
      });

      renderWithProviders(<BusyChart lotId="lot-test-1" />);

      // Heading and peak badge
      expect(await screen.findByText(/Popular Times & Typical Occupancy/i)).toBeInTheDocument();
      expect(screen.getByText(/Peak: 10 AM/i)).toBeInTheDocument();

      // Accessible table fallback exists with sr-only class
      const accessibleTable = screen.getByRole('table', {
        name: /occupancy breakdown by hour/i,
      });
      expect(accessibleTable).toBeInTheDocument();
      expect(accessibleTable.closest('.sr-only') || accessibleTable.className.includes('sr-only')).toBeTruthy();
    });
  });
});

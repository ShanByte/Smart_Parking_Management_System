import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SlotGrid } from '../components/slot/SlotGrid';
import { BookingConfirmation } from '../pages/BookingConfirmation';
import { LotDetails } from '../pages/LotDetails';
import { MyBookings } from '../pages/MyBookings';
import { useAuthStore } from '../stores/authStore';
import { useBookingStore } from '../stores/bookingStore';
import { api } from '../services/api';
import { SlotView, Booking, ParkingLot } from '../types/contract';
import { validateVehicleNumber } from '../schemas/bookingSchemas';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Booking & Payment Slice Tests', () => {
  const mockLot: ParkingLot = {
    id: 'lot-1',
    name: 'FC Road Central Parking',
    address: 'Fergusson College Road, Shivajinagar, Pune',
    latitude: 18.5204,
    longitude: 73.8415,
    totalSlots: 20,
    freeCount: 12,
    pricePerHourPaise: 4000,
  };

  const sampleSlots: SlotView[] = [
    { id: 'slot-1-1', slotNumber: 'A1', status: 'AVAILABLE' },
    { id: 'slot-1-2', slotNumber: 'A2', status: 'HELD' },
    { id: 'slot-1-3', slotNumber: 'A3', status: 'RESERVED' },
    { id: 'slot-1-4', slotNumber: 'A4', status: 'OCCUPIED' },
  ];

  const sampleBookings: Booking[] = [
    {
      id: 'bk-user-1',
      slotId: 'slot-1-3',
      status: 'CONFIRMED',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      amountPaise: 4000,
      heldUntil: null,
      bookingCode: 'BK7788',
      vehicleNumber: 'MH12AB1234',
      checkedInAt: null,
    },
  ];

  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'usr-1',
        name: 'Rohan Sharma',
        email: 'rohan@example.com',
        role: 'USER',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    useBookingStore.getState().resetBooking();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. SlotGrid Component Tests
  // --------------------------------------------------------------------------
  describe('SlotGrid Component', () => {
    it('renders all slot status categories with icons and accessible labels', () => {
      const onSelect = vi.fn();
      render(
        <SlotGrid
          slots={sampleSlots}
          selectedSlotId={null}
          userBookings={sampleBookings}
          onSelectSlot={onSelect}
        />
      );

      // Check slot numbers
      expect(screen.getByText('A1')).toBeInTheDocument();
      expect(screen.getByText('A2')).toBeInTheDocument();
      expect(screen.getByText('A3')).toBeInTheDocument();
      expect(screen.getByText('A4')).toBeInTheDocument();

      // Check statuses rendered with text
      expect(screen.getByRole('button', { name: /slot a1, available/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slot a2, held/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slot a3, reserved \(yours\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /slot a4, occupied/i })).toBeInTheDocument();
    });

    it('allows selection of AVAILABLE slots only', () => {
      const onSelect = vi.fn();
      render(
        <SlotGrid
          slots={sampleSlots}
          selectedSlotId={null}
          userBookings={sampleBookings}
          onSelectSlot={onSelect}
        />
      );

      const availableSlot = screen.getByRole('button', { name: /slot a1, available/i });
      fireEvent.click(availableSlot);
      expect(onSelect).toHaveBeenCalledWith(sampleSlots[0]);

      // Click on HELD slot - should NOT fire onSelect
      onSelect.mockClear();
      const heldSlot = screen.getByRole('button', { name: /slot a2, held/i });
      fireEvent.click(heldSlot);
      expect(onSelect).not.toHaveBeenCalled();

      // Click on OCCUPIED slot - should NOT fire onSelect
      const occupiedSlot = screen.getByRole('button', { name: /slot a4, occupied/i });
      fireEvent.click(occupiedSlot);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Vehicle Number Validation
  // --------------------------------------------------------------------------
  describe('Vehicle Number Validation', () => {
    it('accepts valid 4-15 uppercase alphanumeric formats', () => {
      expect(validateVehicleNumber('MH12AB1234').isValid).toBe(true);
      expect(validateVehicleNumber('KA01C1234').isValid).toBe(true);
      expect(validateVehicleNumber('DL01').isValid).toBe(true);
      expect(validateVehicleNumber('123456789012345').isValid).toBe(true);
    });

    it('allows empty/whitespace input because vehicle number is optional', () => {
      expect(validateVehicleNumber('').isValid).toBe(true);
      expect(validateVehicleNumber('   ').isValid).toBe(true);
    });

    it('rejects vehicle numbers shorter than 4 chars or containing invalid characters', () => {
      expect(validateVehicleNumber('AB').isValid).toBe(false);
      expect(validateVehicleNumber('MH-12-AB').isValid).toBe(false);
      expect(validateVehicleNumber('MH12@#$').isValid).toBe(false);
      expect(validateVehicleNumber('VERYLONGVEHICLENUMBEREXCEEDING15').isValid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Conflict Message (409 SLOT_UNAVAILABLE -> "Slot just taken")
  // --------------------------------------------------------------------------
  describe('409 Conflict Message', () => {
    it('displays "Slot just taken" clearly when booking a slot that was taken', async () => {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url.includes('/slots')) {
          return {
            data: {
              success: true,
              data: [
                { id: 'slot-conflict-id', slotNumber: 'C1', status: 'AVAILABLE' },
              ],
            },
          } as never;
        }
        if (url.includes('/stats')) {
          return {
            data: {
              success: true,
              data: {
                parkingLotId: 'lot-1',
                totalSlots: 20,
                hours: [
                  { hourOfDay: 9, averageOccupiedPercent: 50, samples: 10 },
                ],
              },
            },
          } as never;
        }
        if (url.includes('/parking-lots/lot-1')) {
          return { data: { success: true, data: mockLot } } as never;
        }
        if (url.includes('/bookings/my')) {
          return { data: { success: true, data: [] } } as never;
        }
        return { data: { success: true, data: null } } as never;
      });

      // Mock POST /bookings rejecting with 409 SLOT_UNAVAILABLE
      vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
        if (url === '/bookings') {
          const err = new Error('Request failed with status code 409') as Error & {
            response: {
              status: number;
              data: { success: boolean; code: string; message: string };
            };
          };
          err.response = {
            status: 409,
            data: {
              success: false,
              code: 'SLOT_UNAVAILABLE',
              message: 'Slot just taken',
            },
          };
          throw err;
        }
        return { data: { success: true, data: null } } as never;
      });

      renderWithProviders(
        <Routes>
          <Route path="/lots/:id" element={<LotDetails />} />
        </Routes>,
        '/lots/lot-1'
      );

      // Wait for lot details to render
      await waitFor(() => {
        expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
      });

      // Click slot C1
      const slotButton = await screen.findByRole('button', { name: /slot c1, available/i });
      fireEvent.click(slotButton);

      // Click "Hold Slot & Proceed"
      const holdButton = screen.getByRole('button', { name: /hold slot & proceed/i });
      fireEvent.click(holdButton);

      // Verify that the conflict message "Slot just taken" appears
      const alert = await screen.findByTestId('hold-error-alert');
      expect(alert).toHaveTextContent(/slot just taken/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Countdown Timer Reaching Zero
  // --------------------------------------------------------------------------
  describe('Countdown Timer Expiration', () => {
    it('disables payment and displays expiration message when hold reaches zero', async () => {
      // HeldUntil set in the past (0 seconds remaining)
      const pastHeldUntil = new Date(Date.now() - 5000).toISOString();
      const mockExpiredBooking: Booking = {
        id: 'bk-expired',
        slotId: 'slot-1-1',
        status: 'HELD',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: pastHeldUntil,
        bookingCode: 'EXP000',
        vehicleNumber: 'MH12AB1234',
        checkedInAt: null,
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: [mockExpiredBooking],
        },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-expired'
      );

      await waitFor(() => {
        expect(screen.getByTestId('booking-code')).toHaveTextContent('EXP000');
      });

      // Check that expired state and message are shown
      expect(screen.getByRole('heading', { name: /slot hold expired/i })).toBeInTheDocument();
      expect(screen.getByText(/payment is disabled because the 5-minute hold time has lapsed/i)).toBeInTheDocument();

      // Verify payment action is disabled
      const expiredBtn = screen.getByRole('button', { name: /hold expired/i });
      expect(expiredBtn).toBeDisabled();
    });

    it('displays active 5-minute countdown window when hold is unexpired', async () => {
      const futureHeldUntil = new Date(Date.now() + 300000).toISOString(); // 5 minutes ahead
      const mockActiveBooking: Booking = {
        id: 'bk-active',
        slotId: 'slot-1-1',
        status: 'HELD',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: futureHeldUntil,
        bookingCode: 'ACT555',
        vehicleNumber: null,
        checkedInAt: null,
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: [mockActiveBooking],
        },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-active'
      );

      await waitFor(() => {
        expect(screen.getByTestId('booking-code')).toHaveTextContent('ACT555');
      });

      expect(screen.getByText(/5-Minute Hold Window/i)).toBeInTheDocument();
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Demo Pay Button Conditional Presence
  // --------------------------------------------------------------------------
  describe('Demo Pay Button Visibility', () => {
    const mockHeldBooking: Booking = {
      id: 'bk-demo-check',
      slotId: 'slot-1-1',
      status: 'HELD',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      amountPaise: 4000,
      heldUntil: new Date(Date.now() + 300000).toISOString(), // 5 mins ahead
      bookingCode: 'DEMO99',
      vehicleNumber: 'MH12AB1234',
      checkedInAt: null,
    };

    it('renders Demo Pay button when VITE_DEMO_PAY_ENABLED=true', async () => {
      vi.stubEnv('VITE_DEMO_PAY_ENABLED', 'true');

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: [mockHeldBooking],
        },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-demo-check'
      );

      await waitFor(() => {
        expect(screen.getByTestId('booking-code')).toHaveTextContent('DEMO99');
      });

      const demoBtn = screen.getByTestId('demo-pay-button');
      expect(demoBtn).toBeInTheDocument();
      expect(demoBtn).toHaveTextContent(/Demo Pay/i);
    });

    it('ensures Demo Pay button is completely ABSENT when VITE_DEMO_PAY_ENABLED=false', async () => {
      vi.stubEnv('VITE_DEMO_PAY_ENABLED', 'false');

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: [mockHeldBooking],
        },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-demo-check'
      );

      await waitFor(() => {
        expect(screen.getByTestId('booking-code')).toHaveTextContent('DEMO99');
      });

      // Must be completely absent from the DOM
      expect(screen.queryByTestId('demo-pay-button')).not.toBeInTheDocument();
      expect(screen.queryByText(/Demo Pay/i)).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Booking Confirmation: Large Code & "Show this code to the guard"
  // --------------------------------------------------------------------------
  describe('Booking Confirmation Code Presentation', () => {
    it('shows the booking code in large type with exact text "Show this code to the guard"', async () => {
      const mockBooking: Booking = {
        id: 'bk-guard-text',
        slotId: 'slot-1-1',
        status: 'CONFIRMED',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: null,
        bookingCode: 'GUARD7',
        vehicleNumber: 'MH12AB1234',
        checkedInAt: null,
      };

      vi.spyOn(api, 'get').mockResolvedValue({
        data: {
          success: true,
          data: [mockBooking],
        },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-guard-text'
      );

      await waitFor(() => {
        const codeElement = screen.getByTestId('booking-code');
        expect(codeElement).toHaveTextContent('GUARD7');
      });

      // Verify EXACT required text
      expect(screen.getByText('Show this code to the guard')).toBeInTheDocument();

      // Verify Navigate button
      const navButton = screen.getByRole('link', { name: /navigate to parking lot/i });
      expect(navButton).toHaveAttribute(
        'href',
        expect.stringContaining('https://www.google.com/maps/dir/?api=1&destination=')
      );
    });
  });

  // --------------------------------------------------------------------------
  // 7. MyBookings: Code, Vehicle Number, Statuses, Navigate & Cancel
  // --------------------------------------------------------------------------
  describe('MyBookings Management & Navigation', () => {
    const multiBookings: Booking[] = [
      {
        id: 'bk-conf',
        slotId: 'slot-1-1',
        status: 'CONFIRMED',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: null,
        bookingCode: 'CONF01',
        vehicleNumber: 'MH12AB1234',
        checkedInAt: null,
      },
      {
        id: 'bk-checkin',
        slotId: 'slot-1-2',
        status: 'CONFIRMED',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: null,
        bookingCode: 'CHKD02',
        vehicleNumber: 'DL01XY9999',
        checkedInAt: new Date().toISOString(),
      },
      {
        id: 'bk-noshow',
        slotId: 'slot-1-3',
        status: 'NO_SHOW',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: null,
        bookingCode: 'NOSH03',
        vehicleNumber: null,
        checkedInAt: null,
      },
      {
        id: 'bk-canc',
        slotId: 'slot-1-4',
        status: 'CANCELLED',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 3600000).toISOString(),
        amountPaise: 4000,
        heldUntil: null,
        bookingCode: 'CANC04',
        vehicleNumber: 'MH14CD5678',
        checkedInAt: null,
      },
    ];

    it('renders codes, vehicle numbers, statuses, navigate links, and cancellation', async () => {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/bookings/my') {
          return { data: { success: true, data: multiBookings } } as never;
        }
        if (url === '/parking-lots') {
          return { data: { success: true, data: [mockLot] } } as never;
        }
        return { data: { success: true, data: null } } as never;
      });

      const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({
        data: {
          success: true,
          data: { ...multiBookings[0], status: 'CANCELLED' },
        },
      } as never);

      renderWithProviders(<MyBookings />, '/bookings');

      await waitFor(() => {
        expect(screen.getByText('Code: CONF01')).toBeInTheDocument();
      });

      // Verify codes
      expect(screen.getByText('Code: CONF01')).toBeInTheDocument();
      expect(screen.getByText('Code: CHKD02')).toBeInTheDocument();
      expect(screen.getByText('Code: NOSH03')).toBeInTheDocument();
      expect(screen.getByText('Code: CANC04')).toBeInTheDocument();

      // Verify vehicle numbers
      expect(screen.getByText('MH12AB1234')).toBeInTheDocument();
      expect(screen.getByText('DL01XY9999')).toBeInTheDocument();
      expect(screen.getByText('Vehicle: None')).toBeInTheDocument();
      expect(screen.getByText('MH14CD5678')).toBeInTheDocument();

      // Verify status labels
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Checked In')).toBeInTheDocument();
      expect(screen.getByText('No Show')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();

      // Verify Navigate button
      const navLinks = screen.getAllByRole('link', { name: /navigate to parking lot/i });
      expect(navLinks.length).toBeGreaterThan(0);
      expect(navLinks[0]).toHaveAttribute(
        'href',
        `https://www.google.com/maps/dir/?api=1&destination=${mockLot.latitude},${mockLot.longitude}`
      );

      // Verify Cancel action on confirmed booking
      const cancelBtn = screen.getByRole('button', { name: /cancel booking conf01/i });
      expect(cancelBtn).toBeInTheDocument();
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith('/bookings/bk-conf');
      });
    });
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingConfirmation } from '../pages/BookingConfirmation';
import { MyBookings } from '../pages/MyBookings';
import { Login } from '../pages/Login';
import { Signup } from '../pages/Signup';
import { api } from '../services/api';
import { Booking, ParkingLot } from '../types/contract';
import { useAuthStore } from '../stores/authStore';
import { useBookingStore } from '../stores/bookingStore';

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

describe('Stage E5: Booking / Checkout, My Bookings, Login / Signup Redesign', () => {
  const mockLot: ParkingLot = {
    id: 'lot-fc',
    name: 'FC Road Deccan Parking',
    address: 'Deccan Gymkhana, Pune',
    latitude: 18.518,
    longitude: 73.842,
    totalSlots: 30,
    freeCount: 15,
    pricePerHourPaise: 4000,
  };

  const activeBooking: Booking = {
    id: 'bk-act-10',
    slotId: 'lot-fc-s1',
    status: 'HELD',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    amountPaise: 4000,
    heldUntil: new Date(Date.now() + 290000).toISOString(),
    bookingCode: 'HOLD12',
    vehicleNumber: 'MH12CD5678',
    checkedInAt: null,
  };

  const confirmedBooking: Booking = {
    id: 'bk-conf-20',
    slotId: 'lot-fc-s2',
    status: 'CONFIRMED',
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    amountPaise: 5000,
    heldUntil: null,
    bookingCode: 'CONF99',
    vehicleNumber: null,
    checkedInAt: null,
  };

  const pastBooking: Booking = {
    id: 'bk-past-30',
    slotId: 'lot-fc-s3',
    status: 'COMPLETED',
    startTime: new Date(Date.now() - 7200000).toISOString(),
    endTime: new Date(Date.now() - 3600000).toISOString(),
    amountPaise: 4000,
    heldUntil: null,
    bookingCode: 'PAST88',
    vehicleNumber: 'MH14XY1122',
    checkedInAt: new Date(Date.now() - 7000000).toISOString(),
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'usr-e5',
        name: 'Aarav Patel',
        email: 'aarav@example.com',
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

  describe('Booking Confirmation UI & Ticket Presentation', () => {
    it('renders 4-step progress stepper and circular hold countdown timer', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: { success: true, data: [activeBooking] },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-act-10'
      );

      await waitFor(() => {
        expect(screen.getByTestId('booking-code')).toHaveTextContent('HOLD12');
      });

      // 4-step progress stepper
      expect(screen.getByRole('navigation', { name: /booking progress/i })).toBeInTheDocument();
      expect(screen.getByText('Select Slot')).toBeInTheDocument();
      expect(screen.getByText('Hold Slot')).toBeInTheDocument();
      expect(screen.getByText('Pay Amount')).toBeInTheDocument();
      expect(screen.getByText('Confirmed')).toBeInTheDocument();

      // Hold countdown timer
      expect(screen.getByText('5-Minute Hold Window')).toBeInTheDocument();
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
      expect(screen.getByText(/complete your payment before the timer expires/i)).toBeInTheDocument();
    });

    it('renders confirmed booking ticket with large code, shield icon, and copy button', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: { success: true, data: [confirmedBooking] },
      } as never);

      renderWithProviders(
        <Routes>
          <Route path="/booking/confirm/:bookingId" element={<BookingConfirmation />} />
        </Routes>,
        '/booking/confirm/bk-conf-20'
      );

      await waitFor(() => {
        expect(screen.getByTestId('booking-code')).toHaveTextContent('CONF99');
      });

      // Ticket aesthetics & verification text
      expect(screen.getByText('Guard Verification Code')).toBeInTheDocument();
      expect(screen.getByText('Show this code to the guard')).toBeInTheDocument();

      // Copy Code button
      const copyBtn = screen.getByRole('button', { name: /copy booking code/i });
      expect(copyBtn).toBeInTheDocument();
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(screen.getByText('Code Copied!')).toBeInTheDocument();
      });

      // Navigation Link
      const navLink = screen.getByRole('link', { name: /navigate to parking lot/i });
      expect(navLink).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
    });
  });

  describe('MyBookings Grouping & Categorization', () => {
    it('partitions bookings into Active & Upcoming vs Past Bookings with full metadata', async () => {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/bookings/my') {
          return { data: { success: true, data: [activeBooking, confirmedBooking, pastBooking] } } as never;
        }
        if (url === '/parking-lots') {
          return { data: { success: true, data: [mockLot] } } as never;
        }
        return { data: { success: true, data: null } } as never;
      });

      renderWithProviders(<MyBookings />, '/bookings');

      await waitFor(() => {
        expect(screen.getByText('Code: HOLD12')).toBeInTheDocument();
      });

      // Section headings
      expect(screen.getByText(/active & upcoming reservations/i)).toBeInTheDocument();
      expect(screen.getByText(/past bookings/i)).toBeInTheDocument();

      // Codes & vehicles
      expect(screen.getByText('Code: CONF99')).toBeInTheDocument();
      expect(screen.getByText('Code: PAST88')).toBeInTheDocument();
      expect(screen.getByText('MH12CD5678')).toBeInTheDocument();
      expect(screen.getByText('Vehicle: None')).toBeInTheDocument();
      expect(screen.getByText('MH14XY1122')).toBeInTheDocument();

      // Navigate buttons
      const navLinks = screen.getAllByRole('link', { name: /navigate to parking lot/i });
      expect(navLinks.length).toBe(3);
    });

    it('renders clean empty state with action link when user has no bookings', async () => {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/bookings/my') {
          return { data: { success: true, data: [] } } as never;
        }
        return { data: { success: true, data: [] } } as never;
      });

      renderWithProviders(<MyBookings />, '/bookings');

      await waitFor(() => {
        expect(screen.getByText('No bookings yet')).toBeInTheDocument();
      });

      expect(screen.getByText(/you don't have any parking reservations/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /find a spot/i })).toBeInTheDocument();
    });
  });

  describe('Login & Signup Show/Hide Password Toggle & Showcase', () => {
    it('toggles password visibility between masked and plain text in Login', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      );

      // Desktop brand showcase
      expect(screen.getByText(/parking made effortless across the city/i)).toBeInTheDocument();
      expect(screen.getByText(/real-time occupancy/i)).toBeInTheDocument();

      // Show/Hide Password Toggle
      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: /show value/i });
      fireEvent.click(toggleBtn);

      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: /hide value/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /hide value/i }));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('toggles password visibility in Signup and displays brand showcase', () => {
      render(
        <MemoryRouter initialEntries={['/signup']}>
          <Signup />
        </MemoryRouter>
      );

      // Desktop brand showcase
      expect(screen.getByText(/join pune's smartest parking network/i)).toBeInTheDocument();
      expect(screen.getByText(/reserve before leaving/i)).toBeInTheDocument();

      // Password input and toggle
      const passwordInput = screen.getByPlaceholderText(/at least 8 characters/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: /show value/i });
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.click(screen.getByRole('button', { name: /hide value/i }));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });
});

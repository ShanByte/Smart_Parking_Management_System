import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GuardRoutes from './GuardRoutes';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { GuardBoard } from '../../types/contract';

const mockBoardData: GuardBoard = {
  lot: {
    id: 'lot-1',
    name: 'FC Road Central Parking',
    totalSlots: 20,
  },
  slots: [
    {
      slotId: 'slot-1-1',
      slotNumber: 'A1',
      status: 'AVAILABLE',
      source: 'SENSOR',
      booking: null,
    },
    {
      slotId: 'slot-1-2',
      slotNumber: 'A2',
      status: 'RESERVED',
      source: 'APP',
      booking: {
        bookingId: 'bk-101',
        bookingCode: 'KP4M9X',
        vehicleNumber: 'MH12AB1234',
        startTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 65 * 60 * 1000).toISOString(),
        status: 'CONFIRMED',
        checkedInAt: null,
      },
    },
    {
      slotId: 'slot-1-3',
      slotNumber: 'A3',
      status: 'OCCUPIED',
      source: 'GUARD',
      booking: null,
    },
  ],
};

function renderGuardConsole(initialRoute = '/guard') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <GuardRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Guard Console UI Suite (Stage 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-guard-1',
        name: 'Gate Guard',
        email: 'guard@example.com',
        role: 'GUARD',
        assignedLotId: 'lot-1',
      },
      role: 'GUARD',
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });
  });

  it('renders loading state initially', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {})); // pending promise
    renderGuardConsole();
    expect(screen.getByText(/loading gate board slots/i)).toBeInTheDocument();
  });

  it('renders error state with retry button on network failure', async () => {
    vi.spyOn(api, 'get').mockRejectedValue({
      response: { data: { message: 'Database unreachable' } },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText(/failed to load guard board/i)).toBeInTheDocument();
      expect(screen.getByText(/database unreachable/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('renders gate board with slots, status badges, and booking metadata', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: mockBoardData },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    // Verify slot cards
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('A3')).toBeInTheDocument();

    // Verify status badges
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reserved').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Occupied').length).toBeGreaterThanOrEqual(1);

    // Verify booking details on A2
    expect(screen.getByText('KP4M9X')).toBeInTheDocument();
    expect(screen.getByText('MH12AB1234')).toBeInTheDocument();
    expect(screen.getByText('Awaiting')).toBeInTheDocument();
  });

  it('successfully checks in a valid booking code', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: mockBoardData },
    });

    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'bk-101',
          slotId: 'slot-1-2',
          bookingCode: 'KP4M9X',
          vehicleNumber: 'MH12AB1234',
          checkedInAt: new Date().toISOString(),
          status: 'CONFIRMED',
        },
      },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/booking code/i);
    fireEvent.change(codeInput, { target: { value: 'kp4m9x' } });

    // Verifies auto-uppercase
    expect(codeInput).toHaveValue('KP4M9X');

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/check-in confirmed: code KP4M9X/i)).toBeInTheDocument();
      expect(api.post).toHaveBeenCalledWith('/guard/check-in', { bookingCode: 'KP4M9X' });
    });
  });

  it('displays clear 404 error when booking code is not found', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: mockBoardData },
    });

    vi.spyOn(api, 'post').mockRejectedValue({
      response: {
        status: 404,
        data: { success: false, code: 'NOT_FOUND', message: 'Booking not found' },
      },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/booking code/i);
    fireEvent.change(codeInput, { target: { value: '999999' } });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/check-in rejected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/booking code not found or belongs to another parking lot/i)
      ).toBeInTheDocument();
    });
  });

  it('displays 409 error when booking is already checked in or ineligible', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: mockBoardData },
    });

    vi.spyOn(api, 'post').mockRejectedValue({
      response: {
        status: 409,
        data: {
          success: false,
          code: 'BOOKING_NOT_ELIGIBLE',
          message: 'Booking has already checked in',
        },
      },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    const codeInput = screen.getByLabelText(/booking code/i);
    fireEvent.change(codeInput, { target: { value: 'KP4M9X' } });

    const submitBtn = screen.getByRole('button', { name: /verify & check in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/booking has already checked in/i)).toBeInTheDocument();
    });
  });

  it('opens walk-in modal on available slot and confirms OCCUPIED', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: mockBoardData },
    });

    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: true,
        data: { slotId: 'slot-1-1', status: 'OCCUPIED', source: 'GUARD' },
      },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText('A1')).toBeInTheDocument();
    });

    // Click on Slot A1 (Available)
    const slotA1 = screen.getByText('A1').closest('div[role="button"]')!;
    fireEvent.click(slotA1);

    // Verify modal appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/manage slot A1/i)).toBeInTheDocument();
      expect(screen.getByText(/confirm occupied/i)).toBeInTheDocument();
    });

    // Confirm walk-in
    const confirmBtn = screen.getByRole('button', { name: /confirm occupied/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/guard/slots/slot-1-1/walk-in', {
        status: 'OCCUPIED',
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('prevents walk-in override on reserved slot and displays protected warning', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: mockBoardData },
    });

    renderGuardConsole();

    await waitFor(() => {
      expect(screen.getByText('A2')).toBeInTheDocument();
    });

    // Click on Slot A2 (Reserved)
    const slotA2 = screen.getByText('A2').closest('div[role="button"]')!;
    fireEvent.click(slotA2);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/protected slot \(RESERVED\)/i)).toBeInTheDocument();
      expect(screen.getByText(/cannot override customer bookings/i)).toBeInTheDocument();
      // Ensure Confirm Occupied button is NOT present for protected slots
      expect(screen.queryByRole('button', { name: /confirm occupied/i })).not.toBeInTheDocument();
    });
  });

  it('displays warning when guard user has no assigned parking lot', () => {
    useAuthStore.setState({
      user: {
        id: 'usr-guard-unassigned',
        name: 'Unassigned Guard',
        email: 'guard2@example.com',
        role: 'GUARD',
        assignedLotId: null,
      },
    });

    renderGuardConsole();

    expect(screen.getByText(/no parking lot assigned/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your guard account is currently not assigned to any parking gate/i)
    ).toBeInTheDocument();
  });
});

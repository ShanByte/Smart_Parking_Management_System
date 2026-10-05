import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminRoutes from './AdminRoutes';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { ParkingLot } from '../../types/contract';
import { BookingView, UserView, DeviceView, AuditLogView } from './types';

function mockResponse<T>(data: T): AxiosResponse<{ success: boolean; data: T }> {
  return {
    data: { success: true, data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as unknown as AxiosResponse['config'],
  };
}

const mockLots: ParkingLot[] = [
  {
    id: 'lot-1',
    name: 'FC Road Central Parking',
    address: 'Fergusson College Rd, Pune',
    latitude: 18.5204,
    longitude: 73.8415,
    totalSlots: 20,
    freeCount: 12,
    pricePerHourPaise: 4000,
  },
];

const mockBookings: BookingView[] = [
  {
    id: 'bk-101',
    slotId: 'slot-1-1',
    bookingCode: 'KP4M9X',
    vehicleNumber: 'MH12AB1234',
    startTime: '2026-10-05T12:00:00.000Z',
    endTime: '2026-10-05T13:00:00.000Z',
    amountPaise: 4000,
    status: 'CONFIRMED',
    heldUntil: null,
    checkedInAt: null,
  },
];

const mockUsers: UserView[] = [
  {
    id: 'usr-1',
    name: 'Admin Alice',
    email: 'admin@example.com',
    role: 'ADMIN',
    assignedLotId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'usr-2',
    name: 'Guard Bob',
    email: 'bob@example.com',
    role: 'GUARD',
    assignedLotId: 'lot-1',
    createdAt: '2026-10-02T00:00:00.000Z',
  },
];

const mockDevices: DeviceView[] = [
  {
    id: 'dev-1',
    name: 'Gate Exit Sensor',
    kind: 'SENSOR',
    parkingLotId: 'lot-1',
    isActive: true,
    revokedAt: null,
    createdAt: '2026-10-03T00:00:00.000Z',
  },
];

const mockAuditLogs: AuditLogView[] = [
  {
    id: 'aud-1',
    adminId: 'usr-1',
    action: 'CREATE_LOT',
    targetType: 'ParkingLot',
    targetId: 'lot-1',
    details: { name: 'FC Road Central Parking' },
    createdAt: '2026-10-03T10:00:00.000Z',
  },
];

function renderAdminConsole(initialRoute = '/admin') {
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
        <AdminRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Admin Operations Console Suite (Stage 7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'usr-admin-1',
        name: 'Super Admin',
        email: 'superadmin@example.com',
        role: 'ADMIN',
        assignedLotId: null,
      },
      role: 'ADMIN',
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });

    // Default mock responses for admin endpoints
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/parking-lots')) {
        return mockResponse(mockLots);
      }
      if (url.includes('/admin/bookings')) {
        return mockResponse(mockBookings);
      }
      if (url.includes('/admin/users')) {
        return mockResponse(mockUsers);
      }
      if (url.includes('/admin/devices')) {
        return mockResponse(mockDevices);
      }
      if (url.includes('/admin/audit-log')) {
        return mockResponse(mockAuditLogs);
      }
      return mockResponse([]);
    });
  });

  it('renders admin console header and overview summary metrics', async () => {
    renderAdminConsole();

    await waitFor(() => {
      expect(screen.getByText(/admin operations console/i)).toBeInTheDocument();
      expect(screen.getByText(/superadmin@example.com/i)).toBeInTheDocument();
      // Overview metric cards
      expect(screen.getByText('Parking Lots')).toBeInTheDocument();
      expect(screen.getByText('Total Slots')).toBeInTheDocument();
      expect(screen.getByText('Active Bookings')).toBeInTheDocument();
      expect(screen.getByText('Hardware & Sim Devices')).toBeInTheDocument();
    });
  });

  it('manages lots: views lot cards and opens create lot modal', async () => {
    renderAdminConsole();

    // Switch to Lots tab
    const lotsTab = screen.getByRole('button', { name: /lots & slots/i });
    fireEvent.click(lotsTab);

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
      expect(screen.getByText('20 Slots')).toBeInTheDocument();
    });

    // Open create lot modal
    const createBtn = screen.getByRole('button', { name: /create parking lot/i });
    fireEvent.click(createBtn);

    expect(screen.getByText('Create New Parking Lot')).toBeInTheDocument();
  });

  it('submits create lot request successfully', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: mockLots[0] },
    });

    renderAdminConsole();

    const lotsTab = screen.getByRole('button', { name: /lots & slots/i });
    fireEvent.click(lotsTab);

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /create parking lot/i });
    fireEvent.click(createBtn);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Pune Central Mall/i), {
      target: { value: 'Amanora Town Parking' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Shivaji Nagar/i), {
      target: { value: 'Hadapsar, Pune' },
    });

    const submitBtn = screen.getByRole('button', { name: /^create lot$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/admin/lots',
        expect.objectContaining({
          name: 'Amanora Town Parking',
          address: 'Hadapsar, Pune',
        })
      );
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
    });
  });

  it('generates slots for an existing lot', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, data: { count: 10, slots: [] } },
    });

    renderAdminConsole();

    const lotsTab = screen.getByRole('button', { name: /lots & slots/i });
    fireEvent.click(lotsTab);

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /generate slots/i });
    fireEvent.click(generateBtn);

    expect(screen.getByText(/generate slots: FC Road Central Parking/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /^generate$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/lots/lot-1/generate-slots', {
        count: 10,
      });
      expect(screen.getByText(/generated 10 slots/i)).toBeInTheDocument();
    });
  });

  it('deactivates lot via confirmation modal', async () => {
    vi.spyOn(api, 'delete').mockResolvedValue({
      data: { success: true, data: { deactivated: true, lotId: 'lot-1' } },
    });

    renderAdminConsole();

    const lotsTab = screen.getByRole('button', { name: /lots & slots/i });
    fireEvent.click(lotsTab);

    await waitFor(() => {
      expect(screen.getByText('FC Road Central Parking')).toBeInTheDocument();
    });

    const deactivateBtn = screen.getByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateBtn);

    // Verify confirmation modal appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/deactivate parking lot/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /deactivate lot/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/admin/lots/lot-1');
      expect(screen.getByText(/deactivated/i)).toBeInTheDocument();
    });
  });

  it('manages bookings: renders table and cancels booking with confirmation', async () => {
    vi.spyOn(api, 'delete').mockResolvedValue({
      data: { success: true, data: { cancelled: true } },
    });

    renderAdminConsole();

    const bookingsTab = screen.getByRole('button', { name: /^bookings$/i });
    fireEvent.click(bookingsTab);

    await waitFor(() => {
      expect(screen.getByText('KP4M9X')).toBeInTheDocument();
      expect(screen.getByText('MH12AB1234')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelBtn);

    // Verify confirmation modal
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cancel booking/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /cancel booking/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/bookings/bk-101');
      expect(screen.getByText(/cancelled successfully/i)).toBeInTheDocument();
    });
  });

  it('manages users: changes role to GUARD enforcing assignedLotId', async () => {
    vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, data: mockUsers[0] },
    });

    renderAdminConsole();

    const usersTab = screen.getByRole('button', { name: /users & roles/i });
    fireEvent.click(usersTab);

    await waitFor(() => {
      expect(screen.getByText('Admin Alice')).toBeInTheDocument();
      expect(screen.getByText('Guard Bob')).toBeInTheDocument();
    });

    const changeRoleBtns = screen.getAllByRole('button', { name: /change role/i });
    fireEvent.click(changeRoleBtns[0]); // Alice

    expect(screen.getByText(/update role: Admin Alice/i)).toBeInTheDocument();

    const roleSelect = screen.getByRole('combobox');
    fireEvent.change(roleSelect, { target: { value: 'GUARD' } });

    // Verify assigned lot selector appears for GUARD role
    expect(screen.getByText(/assigned parking lot \*/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /save role/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/admin/users/usr-1/role',
        expect.objectContaining({
          role: 'GUARD',
          assignedLotId: 'lot-1',
        })
      );
      expect(screen.getByText(/successfully updated to GUARD/i)).toBeInTheDocument();
    });
  });

  it('registers device and displays single-view raw key with copy button', async () => {
    const rawKey = 'c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ff';
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          device: {
            id: 'dev-new',
            name: 'Gate 2 Camera',
            kind: 'SENSOR',
            parkingLotId: 'lot-1',
            isActive: true,
            revokedAt: null,
            createdAt: new Date().toISOString(),
          },
          rawKey,
        },
      },
    });

    renderAdminConsole();

    const devicesTab = screen.getByRole('button', { name: /^devices$/i });
    fireEvent.click(devicesTab);

    await waitFor(() => {
      expect(screen.getByText('Gate Exit Sensor')).toBeInTheDocument();
    });

    const registerBtn = screen.getByRole('button', { name: /register device/i });
    fireEvent.click(registerBtn);

    const input = screen.getByPlaceholderText(/e\.g\. Entry Gate Camera 1/i);
    fireEvent.change(input, {
      target: { value: 'Gate 2 Camera' },
    });

    const submitBtn = screen.getByRole('button', { name: /issue key/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Verify raw key presentation banner is shown once
      expect(screen.getByText(/device secret key generated/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(rawKey)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy key/i })).toBeInTheDocument();
      expect(screen.getByText(/exactly once/i)).toBeInTheDocument();
    });
  });

  it('revokes device credentials via confirmation modal', async () => {
    vi.spyOn(api, 'delete').mockResolvedValue({
      data: { success: true, data: { revoked: true, deviceId: 'dev-1' } },
    });

    renderAdminConsole();

    const devicesTab = screen.getByRole('button', { name: /^devices$/i });
    fireEvent.click(devicesTab);

    await waitFor(() => {
      expect(screen.getByText('Gate Exit Sensor')).toBeInTheDocument();
    });

    const revokeBtn = screen.getByRole('button', { name: /^revoke$/i });
    fireEvent.click(revokeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/revoke device credentials/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /revoke device/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/admin/devices/dev-1');
      expect(screen.getByText(/has been revoked/i)).toBeInTheDocument();
    });
  });

  it('renders audit log entries with action badges and details', async () => {
    renderAdminConsole();

    const auditTab = screen.getByRole('button', { name: /audit log/i });
    fireEvent.click(auditTab);

    await waitFor(() => {
      expect(screen.getByText(/system security audit log/i)).toBeInTheDocument();
      expect(screen.getByText('CREATE_LOT')).toBeInTheDocument();
      expect(screen.getByText('usr-1')).toBeInTheDocument();
      expect(screen.getByText('ParkingLot')).toBeInTheDocument();
    });
  });
});

import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { ParkingLot } from '../../types/contract';
import {
  BookingView,
  UserView,
  DeviceView,
  AuditLogView as AuditLogItem,
} from './types';
import { AdminOverview } from './components/AdminOverview';
import { LotsManagement } from './components/LotsManagement';
import { BookingsManagement } from './components/BookingsManagement';
import { UsersManagement } from './components/UsersManagement';
import { DevicesManagement } from './components/DevicesManagement';
import { AuditLogView } from './components/AuditLogView';
import { Button } from '../../components/common/Button';
import {
  DashboardIcon,
  BuildingIcon,
  CalendarCheckIcon,
  UsersIcon,
  CpuIcon,
  HistoryIcon,
  RefreshIcon,
  ShieldIcon,
  AlertTriangleIcon,
} from '../../components/common/icons';

type AdminTab = 'overview' | 'lots' | 'bookings' | 'users' | 'devices' | 'audit';

const AdminRoutes: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');

  // 1. Fetch Lots
  const {
    data: lots = [],
    isLoading: isLotsLoading,
    isError: isLotsError,
    error: lotsError,
    refetch: refetchLots,
  } = useQuery<ParkingLot[]>({
    queryKey: ['admin', 'lots'],
    queryFn: async () => {
      const res = await api.get('/parking-lots');
      return res.data?.data ?? [];
    },
  });

  // 2. Fetch Bookings
  const {
    data: bookings = [],
    isLoading: isBookingsLoading,
    refetch: refetchBookings,
  } = useQuery<BookingView[]>({
    queryKey: ['admin', 'bookings', bookingStatusFilter],
    queryFn: async () => {
      const queryParam = bookingStatusFilter !== 'ALL' ? `?status=${bookingStatusFilter}` : '';
      const res = await api.get(`/admin/bookings${queryParam}`);
      return res.data?.data ?? [];
    },
  });

  // 3. Fetch Users
  const {
    data: users = [],
    isLoading: isUsersLoading,
    refetch: refetchUsers,
  } = useQuery<UserView[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data?.data ?? [];
    },
  });

  // 4. Fetch Devices
  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    refetch: refetchDevices,
  } = useQuery<DeviceView[]>({
    queryKey: ['admin', 'devices'],
    queryFn: async () => {
      const res = await api.get('/admin/devices');
      return res.data?.data ?? [];
    },
  });

  // 5. Fetch Audit Logs
  const {
    data: auditLogs = [],
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useQuery<AuditLogItem[]>({
    queryKey: ['admin', 'audit-log'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-log');
      return res.data?.data ?? [];
    },
  });

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    refetchLots();
    refetchBookings();
    refetchUsers();
    refetchDevices();
    refetchAudit();
  };

  const totalSlotsCount = lots.reduce((acc, l) => acc + (l.totalSlots || 0), 0);

  const navTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: DashboardIcon },
    { id: 'lots', label: 'Lots & Slots', icon: BuildingIcon },
    { id: 'bookings', label: 'Bookings', icon: CalendarCheckIcon },
    { id: 'users', label: 'Users & Roles', icon: UsersIcon },
    { id: 'devices', label: 'Devices', icon: CpuIcon },
    { id: 'audit', label: 'Audit Log', icon: HistoryIcon },
  ];

  const isGlobalLoading =
    isLotsLoading && isBookingsLoading && isUsersLoading && isDevicesLoading && isAuditLoading;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
            <ShieldIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Admin Operations Console
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                FULL ACCESS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Logged in as: <strong className="text-slate-200">{user?.email || 'admin@example.com'}</strong>
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleRefreshAll}
          className="h-10 px-4 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl"
        >
          <RefreshIcon className="w-3.5 h-3.5 mr-2 text-slate-400" />
          Refresh Data
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Panels */}
      {isGlobalLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm"
        >
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading admin data...</p>
        </div>
      ) : isLotsError ? (
        <div
          role="alert"
          className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-2 text-red-900"
        >
          <AlertTriangleIcon className="w-8 h-8 text-red-600 mx-auto" />
          <p className="text-sm font-bold">Failed to load admin resources</p>
          <p className="text-xs text-red-700">
            {axios.isAxiosError(lotsError)
              ? (lotsError.response?.data as { message?: string })?.message || lotsError.message
              : lotsError instanceof Error
              ? lotsError.message
              : 'Network error'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleRefreshAll}
            className="mt-2 text-xs font-bold border-red-300 text-red-800 hover:bg-red-100 rounded-xl"
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
          {activeTab === 'overview' && (
            <AdminOverview
              lotsCount={lots.length}
              slotsCount={totalSlotsCount}
              bookingsCount={bookings.length}
              devicesCount={devices.length}
              onNavigateTab={(tab) => setActiveTab(tab as AdminTab)}
            />
          )}

          {activeTab === 'lots' && (
            <LotsManagement
              lots={lots}
              onRefresh={handleRefreshAll}
            />
          )}

          {activeTab === 'bookings' && (
            <BookingsManagement
              bookings={bookings}
              activeStatusFilter={bookingStatusFilter}
              onChangeStatusFilter={setBookingStatusFilter}
              onRefresh={handleRefreshAll}
            />
          )}

          {activeTab === 'users' && (
            <UsersManagement
              users={users}
              lots={lots}
              onRefresh={handleRefreshAll}
            />
          )}

          {activeTab === 'devices' && (
            <DevicesManagement
              devices={devices}
              lots={lots}
              onRefresh={handleRefreshAll}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogView logs={auditLogs} />
          )}
        </div>
      )}
    </div>
  );
};

export default AdminRoutes;

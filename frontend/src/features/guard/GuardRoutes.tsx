import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { api, validateResponse } from '../../services/api';
import { GuardBoard, GuardBoardSlot } from '../../types/contract';
import { useLotSocket, LotSocketEvent } from '../../hooks/useLotSocket';
import { GuardCheckIn } from './components/GuardCheckIn';
import { GuardGateBoard } from './components/GuardGateBoard';
import { WalkInModal } from './components/WalkInModal';
import { Card, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
  ShieldIcon,
  RadioIcon,
  RefreshIcon,
  BuildingIcon,
  AlertCircleIcon,
  MapPinIcon,
} from '../../components/common/icons';
import { z } from 'zod';

// GuardBoard validation schema matching Frozen Contract
const GuardBoardSchema = z.object({
  lot: z.object({
    id: z.string(),
    name: z.string(),
    totalSlots: z.number(),
  }),
  slots: z.array(
    z.object({
      slotId: z.string(),
      slotNumber: z.string(),
      status: z.enum(['AVAILABLE', 'HELD', 'RESERVED', 'OCCUPIED']),
      source: z.enum(['SIM', 'SENSOR', 'APP', 'GUARD']),
      booking: z
        .object({
          bookingId: z.string(),
          bookingCode: z.string(),
          vehicleNumber: z.string().nullable().optional(),
          startTime: z.string(),
          endTime: z.string(),
          status: z.enum(['HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW']),
          checkedInAt: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
  ),
});

const GuardRoutes: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Active lot: assignedLotId for guards, or default fallback / selector
  const [selectedLotId, setSelectedLotId] = useState<string>(
    user?.assignedLotId || 'lot-1'
  );
  const activeLotId = user?.assignedLotId || selectedLotId;

  const [selectedSlotForModal, setSelectedSlotForModal] = useState<GuardBoardSlot | null>(
    null
  );

  // Realtime WebSocket integration via useLotSocket (C9)
  const handleSocketEvent = useCallback(
    (_event: LotSocketEvent) => {
      // Invalidate guard board query whenever a slot or lot changes
      queryClient.invalidateQueries({ queryKey: ['guardBoard', activeLotId] });
    },
    [queryClient, activeLotId]
  );

  const { isConnected } = useLotSocket(activeLotId, handleSocketEvent);

  // Fetch guard board via api instance
  const {
    data: guardBoard,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<GuardBoard>({
    queryKey: ['guardBoard', activeLotId],
    queryFn: async () => {
      const res = await api.get(`/guard/lots/${activeLotId}/board`);
      // res.data is ApiSuccessResponse<GuardBoard>
      const rawData = res.data?.data ?? res.data;
      return validateResponse(GuardBoardSchema, rawData) as unknown as GuardBoard;
    },
    enabled: !!activeLotId,
    refetchInterval: 15000, // Poll every 15s as backup to socket
  });

  const handleActionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['guardBoard', activeLotId] });
    refetch();
  };

  // If guard has no assigned lot
  if (user?.role === 'GUARD' && !user?.assignedLotId) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card className="border-2 border-amber-300 bg-amber-50 shadow-md rounded-2xl">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircleIcon className="w-12 h-12 text-amber-600 mx-auto" />
            <h2 className="text-xl font-bold text-amber-950">
              No Parking Lot Assigned
            </h2>
            <p className="text-sm text-amber-800">
              Your guard account is currently not assigned to any parking gate.
              Please ask a system administrator to set your assigned lot.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Top Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-inner">
            <ShieldIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {guardBoard?.lot?.name || 'Gate Operator Console'}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}
              >
                <RadioIcon className={`w-3 h-3 ${isConnected ? 'animate-pulse text-emerald-400' : 'text-red-400'}`} />
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5 font-medium">
              <MapPinIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Lot ID: {activeLotId}</span>
              {guardBoard?.lot?.totalSlots && (
                <span>• {guardBoard.lot.totalSlots} Total Slots</span>
              )}
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2.5">
          {user?.role === 'ADMIN' && (
            <div className="flex items-center gap-1.5 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
              <BuildingIcon className="w-4 h-4 text-slate-400 ml-1" />
              <input
                type="text"
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                placeholder="Lot ID"
                aria-label="Active Lot ID"
                className="w-24 px-2.5 py-1 text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="min-h-[48px] h-12 px-4 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl"
          >
            <RefreshIcon className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Gate Check-In Component */}
      <GuardCheckIn onCheckInSuccess={handleActionSuccess} />

      {/* Main Board Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Real-Time Gate Board
          </h2>
          <span className="text-xs font-medium text-slate-500">
            Tap an available slot to register a walk-in car
          </span>
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm"
          >
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Loading gate board slots...</p>
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="p-6 bg-red-50 border border-red-300 rounded-2xl text-center space-y-2 text-red-900 shadow-sm"
          >
            <AlertCircleIcon className="w-8 h-8 text-red-600 mx-auto" />
            <p className="text-sm font-bold text-red-950">Failed to load guard board</p>
            <p className="text-xs text-red-700">
              {axios.isAxiosError(error)
                ? (error.response?.data as { message?: string })?.message || error.message
                : error instanceof Error
                ? error.message
                : 'Network error'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetch()}
              className="mt-2 text-xs font-bold border-red-300 text-red-800 hover:bg-red-100 min-h-[48px] h-12 px-6 rounded-xl"
            >
              Retry
            </Button>
          </div>
        ) : guardBoard ? (
          <GuardGateBoard
            slots={guardBoard.slots}
            onSelectSlot={(slot) => setSelectedSlotForModal(slot)}
          />
        ) : null}
      </div>

      {/* Walk-in Confirmation Modal */}
      <WalkInModal
        slot={selectedSlotForModal}
        onClose={() => setSelectedSlotForModal(null)}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
};

export default GuardRoutes;

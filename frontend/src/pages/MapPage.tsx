import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { ParkingLot } from '../types/contract';
import { ParkingMap } from '../components/map/ParkingMap';
import { LotPanel } from '../components/lot/LotPanel';
import { Button } from '../components/common/Button';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { useLotSocket } from '../services/socket';

export const MapPage: React.FC = () => {
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);

  // Subscribe to real-time lot updates to update map pins and counts (C9)
  useLotSocket();

  // React Query for live parking lots (per C7)
  const {
    data: lots = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ParkingLot[]>({
    queryKey: ['parking-lots'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ParkingLot[] }>('/parking-lots');
      return res.data.data;
    },
    refetchInterval: 15000, // Background poll every 15s to update pin colors and counts
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Find Parking in Pune
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Click on any parking marker or select a lot from the list to view slots & directions
          </p>
        </div>

        {/* Global summary badge */}
        {lots.length > 0 && (
          <div className="flex items-center gap-3 text-xs bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-semibold text-slate-700">Total Lots: {lots.length}</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600 font-bold">
              {lots.reduce((acc, curr) => acc + curr.freeCount, 0)} Total Spots Free
            </span>
          </div>
        )}
      </div>

      {/* Error State */}
      {isError && (
        <div
          role="alert"
          className="p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-red-800"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Unable to connect to parking service</h4>
              <p className="text-xs text-red-700">
                {(error as Error)?.message || 'Failed to fetch parking lot coordinates.'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Main Map & Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Leaflet Map (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <ParkingMap
            lots={lots}
            selectedLotId={selectedLot?.id}
            onSelectLot={(lot) => setSelectedLot(lot)}
            className="h-[520px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200"
          />
        </div>

        {/* Right Column: Lot Information Panel (4 cols) */}
        <div className="lg:col-span-4">
          <LotPanel
            lots={lots}
            selectedLot={selectedLot}
            onSelectLot={(lot) => setSelectedLot(lot)}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPage;

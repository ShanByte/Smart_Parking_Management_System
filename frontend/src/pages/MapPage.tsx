import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { ParkingLot } from '../types/contract';
import { ParkingMap } from '../components/map/ParkingMap';
import { LotPanel } from '../components/lot/LotPanel';
import {
  ArrivalTimeSelector,
  UserCoordinates,
} from '../components/lot/ArrivalTimeSelector';
import { useArrivalAvailability } from '../hooks/useArrivalAvailability';
import { Button } from '../components/common/Button';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { useLotSocket } from '../services/socket';
import {
  blendArrivalAvailability,
  LotAvailabilityItem,
  AvailabilityHourPatternItem,
} from '@smart-parking/shared';
import {
  computeRecommendation,
  haversineDistanceKm,
  LotWithArrivalScore,
} from '../utils/recommendation';

export const MapPage: React.FC = () => {
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);

  // Selected Arrival state
  const [arrivalIso, setArrivalIso] = useState<string>(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString();
  });
  const [isArrivalNow, setIsArrivalNow] = useState<boolean>(true);
  const [arrivalLabel, setArrivalLabel] = useState<string>('Now');
  const [userCoords, setUserCoords] = useState<UserCoordinates | null>(null);

  // Subscribe to real-time lot updates to update map pins and counts (C9)
  useLotSocket();

  // React Query for live parking lots (per C7)
  const {
    data: lots = [],
    isLoading: lotsLoading,
    isError: lotsError,
    error: lotsErrorObj,
    refetch: refetchLots,
  } = useQuery<ParkingLot[]>({
    queryKey: ['parking-lots'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ParkingLot[] }>('/parking-lots');
      return res.data.data;
    },
    refetchInterval: 15000, // Background poll every 15s to update pin colors and counts
  });

  // React Query for Arrival Availability per Feature A
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    isError: availabilityError,
    error: availabilityErrorObj,
    refetch: refetchAvailability,
  } = useArrivalAvailability(arrivalIso);

  // Realtime derivation of scores and recommendations using useMemo
  // Directly updates whenever live lot freeCount updates via socket (no extra API calls!)
  const {
    scoresByLotId,
    patternByLotId,
    recommendedLotId,
    recommendedReason,
    isAllLimited,
    mostSpacesLotId,
    noEligibleNote,
  } = useMemo(() => {
    const scores: Record<string, number | null> = {};
    const patterns: Record<string, AvailabilityHourPatternItem[]> = {};
    const lotsWithScores: LotWithArrivalScore[] = [];

    const arrivalDate = new Date(arrivalIso);
    const nowDate = new Date();

    const apiLotsMap = new Map<string, LotAvailabilityItem>();
    if (availabilityData?.lots) {
      for (const item of availabilityData.lots) {
        apiLotsMap.set(item.parkingLotId, item);
      }
    }

    for (const lot of lots) {
      const apiItem = apiLotsMap.get(lot.id);
      let blendedScore: number | null = null;

      if (apiItem) {
        patterns[lot.id] = apiItem.pattern;
        const currentFreePercent =
          lot.totalSlots > 0 ? (100 * lot.freeCount) / lot.totalSlots : 0;

        blendedScore = blendArrivalAvailability(
          apiItem.historical.expectedAvailablePercentAtArrival,
          apiItem.historical.expectedAvailablePercentNow,
          currentFreePercent,
          arrivalDate,
          nowDate
        );
      }

      scores[lot.id] = blendedScore;

      let distanceKm: number | null = null;
      if (userCoords) {
        distanceKm = haversineDistanceKm(
          userCoords.latitude,
          userCoords.longitude,
          lot.latitude,
          lot.longitude
        );
      }

      lotsWithScores.push({
        lot,
        score: blendedScore,
        distanceKm,
      });
    }

    const recResult = computeRecommendation(
      lotsWithScores,
      isArrivalNow,
      arrivalLabel
    );

    return {
      scoresByLotId: scores,
      patternByLotId: patterns,
      recommendedLotId: recResult.recommendedLotId,
      recommendedReason: recResult.recommendedReason,
      isAllLimited: recResult.isAllLimited,
      mostSpacesLotId: recResult.mostSpacesLotId,
      noEligibleNote: recResult.noEligibleNote,
    };
  }, [lots, availabilityData, arrivalIso, isArrivalNow, arrivalLabel, userCoords]);

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

      {/* Arrival Time & Geolocation Control */}
      <ArrivalTimeSelector
        arrivalIso={arrivalIso}
        onChange={(iso, isNow, label) => {
          setArrivalIso(iso);
          setIsArrivalNow(isNow);
          setArrivalLabel(label);
        }}
        userCoords={userCoords}
        onLocationChange={(coords) => setUserCoords(coords)}
      />

      {/* API Availability Error Banner (if schema mismatch or network failure) */}
      {availabilityError && (
        <div
          role="alert"
          data-testid="availability-error-alert"
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Arrival availability service is temporarily unavailable (
              {availabilityErrorObj?.message || 'schema mismatch'}). Showing live counts.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchAvailability()}>
            Retry
          </Button>
        </div>
      )}

      {/* Lot Error State */}
      {lotsError && (
        <div
          role="alert"
          className="p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-red-800"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Unable to connect to parking service</h4>
              <p className="text-xs text-red-700">
                {(lotsErrorObj as Error)?.message || 'Failed to fetch parking lot coordinates.'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchLots()}>
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
            recommendedLotId={recommendedLotId}
            className="h-[520px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200"
          />
        </div>

        {/* Right Column: Lot Information Panel (4 cols) */}
        <div className="lg:col-span-4">
          <LotPanel
            lots={lots}
            selectedLot={selectedLot}
            onSelectLot={(lot) => setSelectedLot(lot)}
            isLoading={lotsLoading || availabilityLoading}
            arrivalIso={arrivalIso}
            arrivalLabel={arrivalLabel}
            scoresByLotId={scoresByLotId}
            recommendedLotId={recommendedLotId}
            recommendedReason={recommendedReason}
            isAllLimited={isAllLimited}
            mostSpacesLotId={mostSpacesLotId}
            noEligibleNote={noEligibleNote}
            patternByLotId={patternByLotId}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPage;

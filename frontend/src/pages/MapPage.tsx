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
import { StatTile } from '../components/common/StatTile';
import {
  SearchIcon,
  CloseIcon,
  CarIcon,
  CheckCircleIcon,
  StarIcon,
  AlertCircleIcon,
} from '../components/common/icons';
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

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
    refetchInterval: 15000,
  });

  // Client-side search filter by name or address
  const filteredLots = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return lots;
    return lots.filter(
      (lot) =>
        lot.name.toLowerCase().includes(query) ||
        lot.address.toLowerCase().includes(query)
    );
  }, [lots, searchQuery]);

  // React Query for Arrival Availability per Feature A
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
    isError: availabilityError,
    error: availabilityErrorObj,
    refetch: refetchAvailability,
  } = useArrivalAvailability(arrivalIso);

  // Realtime derivation of scores, distances, and recommendations using useMemo
  const {
    scoresByLotId,
    patternByLotId,
    distancesByLotId,
    recommendedLotId,
    recommendedReason,
    isAllLimited,
    mostSpacesLotId,
    noEligibleNote,
  } = useMemo(() => {
    const scores: Record<string, number | null> = {};
    const patterns: Record<string, AvailabilityHourPatternItem[]> = {};
    const distances: Record<string, number | null> = {};
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
      distances[lot.id] = distanceKm;

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
      distancesByLotId: distances,
      recommendedLotId: recResult.recommendedLotId,
      recommendedReason: recResult.recommendedReason,
      isAllLimited: recResult.isAllLimited,
      mostSpacesLotId: recResult.mostSpacesLotId,
      noEligibleNote: recResult.noEligibleNote,
    };
  }, [lots, availabilityData, arrivalIso, isArrivalNow, arrivalLabel, userCoords]);

  // Quick availability summary computed ONLY from real data
  const summaryMetrics = useMemo(() => {
    const totalLotsCount = lots.length;
    const totalFreeCount = lots.reduce((acc, curr) => acc + curr.freeCount, 0);
    const totalSlotsCount = lots.reduce((acc, curr) => acc + curr.totalSlots, 0);
    const goodOrBetterLotsCount = lots.filter((lot) => {
      const s = scoresByLotId[lot.id];
      return s !== null && s !== undefined && s >= 50;
    }).length;

    return {
      totalLotsCount,
      totalFreeCount,
      totalSlotsCount,
      goodOrBetterLotsCount,
    };
  }, [lots, scoresByLotId]);

  return (
    <div className="space-y-6">
      {/* 1. Hero / Search Section */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Find your parking spot before you arrive.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Find Parking in Pune. See live availability, compare lots, reserve a slot and navigate directly.
          </p>
        </div>

        {/* Client-side Search Box & Destination Filter */}
        <div className="relative max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parking lots by name or address (e.g. FC Road, JM Road)..."
            aria-label="Filter parking lots by name or address"
            className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              aria-label="Clear search input"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Real-time Summary Statistics Tiles (Zero fake numbers) */}
        {lots.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
            <StatTile
              label="Total Facilities"
              value={summaryMetrics.totalLotsCount}
              icon={<CarIcon className="w-5 h-5" />}
              description="Active in Pune central"
            />
            <StatTile
              label="Available Spots"
              value={summaryMetrics.totalFreeCount}
              icon={<CheckCircleIcon className="w-5 h-5 text-emerald-600" />}
              description={`Out of ${summaryMetrics.totalSlotsCount} total bays`}
            />
            <StatTile
              label="High Availability"
              value={summaryMetrics.goodOrBetterLotsCount}
              icon={<StarIcon className="w-5 h-5 text-amber-500 fill-amber-500" />}
              description="Lots rated Good (≥50%) or better"
            />
            <StatTile
              label="Selected Arrival"
              value={arrivalLabel}
              icon={<CarIcon className="w-5 h-5 text-indigo-600" />}
              description="Forecasted availability target"
            />
          </div>
        )}
      </section>

      {/* 2. Arrival Time & Geolocation Control */}
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

      {/* API Availability Error Banner */}
      {availabilityError && (
        <div
          role="alert"
          data-testid="availability-error-alert"
          className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-amber-600 flex-shrink-0" />
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

      {/* Lot Query Error Banner */}
      {lotsError && (
        <div
          role="alert"
          className="p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-red-900 shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <AlertCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Unable to connect to parking service</h4>
              <p className="text-xs text-red-700">
                {(lotsErrorObj as Error)?.message || 'Failed to fetch parking lot coordinates.'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchLots()}>
            Retry
          </Button>
        </div>
      )}

      {/* Mobile Tab Toggle (< 1024px) */}
      <div className="flex lg:hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
        <button
          onClick={() => setMobileTab('map')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
            mobileTab === 'map'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Interactive Map
        </button>
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
            mobileTab === 'list'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Parking Lots List ({filteredLots.length})
        </button>
      </div>

      {/* 3. Main Map & Responsive Side Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Map Column: Desktop 8 cols, Mobile conditionally visible or top */}
        <div
          className={`lg:col-span-8 space-y-4 ${
            mobileTab === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          <ParkingMap
            lots={filteredLots}
            selectedLotId={selectedLot?.id}
            onSelectLot={(lot) => {
              setSelectedLot(lot);
              // On mobile, switch to list view to highlight selected lot card
              if (window.innerWidth < 1024) {
                setMobileTab('list');
              }
            }}
            recommendedLotId={recommendedLotId}
            className="h-[360px] sm:h-[460px] lg:h-[560px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200"
          />
        </div>

        {/* Side Panel Column: Desktop 4 cols, Mobile list */}
        <div
          className={`lg:col-span-4 ${
            mobileTab === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          <LotPanel
            lots={filteredLots}
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
            distancesByLotId={distancesByLotId}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPage;

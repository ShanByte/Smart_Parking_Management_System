import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParkingLot } from '../../types/contract';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { getMarkerColor } from '../../utils/mapUtils';
import {
  MapPinIcon,
  NavigationIcon,
  CarIcon,
  ArrowRightIcon,
  CloseIcon,
} from '../common/icons';
import { AvailabilityBadge } from './AvailabilityBadge';
import { AvailabilityHourPatternItem, indiaTimeParts } from '@smart-parking/shared';
import { formatLotName } from '../../utils/lotUtils';

// Lazy-load pattern chart to isolate Recharts into its own chunk
const AvailabilityPatternChart = lazy(
  () => import('../../features/stats/AvailabilityPatternChart')
);

export interface LotPanelProps {
  lots: ParkingLot[];
  selectedLot: ParkingLot | null;
  onSelectLot: (lot: ParkingLot | null) => void;
  isLoading?: boolean;
  arrivalIso?: string;
  arrivalLabel?: string;
  scoresByLotId?: Record<string, number | null>;
  recommendedLotId?: string | null;
  recommendedReason?: string | null;
  isAllLimited?: boolean;
  mostSpacesLotId?: string | null;
  noEligibleNote?: string | null;
  patternByLotId?: Record<string, AvailabilityHourPatternItem[]>;
  distancesByLotId?: Record<string, number | null>;
}

export const LotPanel: React.FC<LotPanelProps> = ({
  lots,
  selectedLot,
  onSelectLot,
  isLoading = false,
  arrivalIso,
  arrivalLabel = 'your arrival',
  scoresByLotId = {},
  recommendedLotId = null,
  recommendedReason = null,
  isAllLimited = false,
  mostSpacesLotId = null,
  noEligibleNote = null,
  patternByLotId = {},
  distancesByLotId = {},
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading parking lots">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton variant="text" width={140} height={20} />
              <Skeleton variant="rectangular" width={60} height={20} className="rounded" />
            </div>
            <Skeleton variant="text" width={200} height={14} />
            <Skeleton variant="rectangular" width="100%" height={32} className="rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <EmptyState
        icon={<CarIcon className="w-6 h-6 text-slate-400" />}
        title="No parking lots found"
        description="No parking facilities match your search criteria in this area."
      />
    );
  }

  const arrivalDate = arrivalIso ? new Date(arrivalIso) : new Date();
  const arrivalParts = indiaTimeParts(arrivalDate);

  const handleSelectAndViewSlots = (lotId: string) => {
    if (arrivalIso) {
      navigate(`/lots/${lotId}?from=${encodeURIComponent(arrivalIso)}`);
    } else {
      navigate(`/lots/${lotId}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Calm notice when availability is tight across all lots */}
      {noEligibleNote && (
        <div
          role="note"
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium"
        >
          {noEligibleNote}
        </div>
      )}

      {/* Selected Lot Focused Card */}
      {selectedLot && (
        <Card className="border-2 border-indigo-500 shadow-md bg-indigo-50/20">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  Selected Lot
                </span>
                {(() => {
                  const { category, label } = getMarkerColor(
                    selectedLot.freeCount,
                    selectedLot.totalSlots
                  );
                  const badgeColorClass =
                    category === 'green'
                      ? 'bg-emerald-600 text-white'
                      : category === 'orange'
                      ? 'bg-orange-500 text-white'
                      : 'bg-red-600 text-white';
                  return (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColorClass}`}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 mt-1.5">
                {formatLotName(selectedLot.name)}
              </CardTitle>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPinIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span>{selectedLot.address}</span>
                {distancesByLotId[selectedLot.id] !== undefined &&
                  distancesByLotId[selectedLot.id] !== null && (
                    <span className="text-indigo-600 font-semibold ml-1">
                      &bull; {distancesByLotId[selectedLot.id]?.toFixed(1)} km away
                    </span>
                  )}
              </p>
            </div>
            <button
              onClick={() => onSelectLot(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              aria-label="Close selected lot panel"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 block">Available Slots</span>
                <span className="text-lg font-bold text-emerald-600">
                  {selectedLot.freeCount}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {selectedLot.totalSlots}
                  </span>
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Hourly Pricing</span>
                <span className="text-lg font-bold text-indigo-600">
                  ₹{(selectedLot.pricePerHourPaise / 100).toFixed(0)}
                  <span className="text-xs font-normal text-slate-400"> / hr</span>
                </span>
              </div>
            </div>

            {/* Occupancy SVG Progress Bar (No inline styles!) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Real-time Occupancy</span>
                <span>
                  {selectedLot.totalSlots > 0
                    ? Math.round(
                        ((selectedLot.totalSlots - selectedLot.freeCount) /
                          selectedLot.totalSlots) *
                          100
                      )
                    : 0}
                  % full
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                <svg className="w-full h-2" preserveAspectRatio="none" viewBox="0 0 100 8">
                  <rect
                    x="0"
                    y="0"
                    width={
                      selectedLot.totalSlots > 0
                        ? Math.max(
                            0,
                            Math.min(
                              100,
                              ((selectedLot.totalSlots - selectedLot.freeCount) /
                                selectedLot.totalSlots) *
                                100
                            )
                          )
                        : 0
                    }
                    height="8"
                    className="fill-indigo-500"
                  />
                </svg>
              </div>
            </div>

            {/* Availability Score Badge */}
            <AvailabilityBadge
              score={scoresByLotId[selectedLot.id] ?? null}
              arrivalTimeLabel={arrivalLabel}
              isRecommended={selectedLot.id === recommendedLotId}
              recommendedReason={recommendedReason}
              isMostSpacesNow={isAllLimited && selectedLot.id === mostSpacesLotId}
            />

            {/* Lazy-Loaded Pattern Chart */}
            <Suspense
              fallback={
                <div className="h-44 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center text-xs text-slate-400">
                  Loading pattern chart...
                </div>
              }
            >
              <AvailabilityPatternChart
                pattern={patternByLotId[selectedLot.id] || []}
                arrivalHour={arrivalParts.hourOfDay}
                lotName={formatLotName(selectedLot.name)}
                isLimitedData={scoresByLotId[selectedLot.id] === null}
              />
            </Suspense>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="w-full text-xs py-2.5 font-semibold"
                onClick={() => handleSelectAndViewSlots(selectedLot.id)}
              >
                <span>Select & View Slots</span>
                <ArrowRightIcon className="w-3.5 h-3.5 ml-1.5" />
              </Button>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLot.latitude},${selectedLot.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center min-w-[40px] min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                title="Open Google Maps Directions"
                aria-label={`Directions to ${formatLotName(selectedLot.name)}`}
              >
                <NavigationIcon className="w-4 h-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Lot List */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
          All Lots in Pune ({lots.length})
        </h4>

        {lots.map((lot) => {
          const isSelected = selectedLot?.id === lot.id;
          const { category, label } = getMarkerColor(lot.freeCount, lot.totalSlots);
          const price = (lot.pricePerHourPaise / 100).toFixed(0);
          const lotScore = scoresByLotId[lot.id] ?? null;
          const isRecommended = lot.id === recommendedLotId;
          const isMostSpaces = isAllLimited && lot.id === mostSpacesLotId;
          const distance = distancesByLotId[lot.id];

          const categoryPillClass =
            category === 'green'
              ? 'bg-emerald-500'
              : category === 'orange'
              ? 'bg-orange-500'
              : 'bg-red-500';

          return (
            <div
              key={lot.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectLot(lot)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectLot(lot);
                }
              }}
              className={`p-3.5 rounded-xl border text-left motion-safe:transition-all cursor-pointer select-none bg-white space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-400 shadow-sm'
                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h5 className="font-semibold text-sm text-slate-900 tracking-tight">
                    {formatLotName(lot.name)}
                  </h5>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 line-clamp-1">
                    <MapPinIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>{lot.address}</span>
                    {distance !== undefined && distance !== null && (
                      <span className="text-indigo-600 font-semibold ml-1">
                        &bull; {distance.toFixed(1)} km
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap border border-slate-200/60 font-mono">
                  ₹{price}/hr
                </span>
              </div>

              {/* Arrival Availability Badge for this lot */}
              <AvailabilityBadge
                score={lotScore}
                arrivalTimeLabel={arrivalLabel}
                isRecommended={isRecommended}
                recommendedReason={isRecommended ? recommendedReason : null}
                isMostSpacesNow={isMostSpaces}
                showFootnote={false}
              />

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${categoryPillClass}`} />
                  <span className="font-medium text-slate-700">
                    {lot.freeCount} / {lot.totalSlots} Free
                  </span>
                  <span className="text-[11px] text-slate-400">({label})</span>
                </div>
                <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                  View Slots &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

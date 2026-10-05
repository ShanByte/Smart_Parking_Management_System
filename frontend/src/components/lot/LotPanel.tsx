import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ParkingLot } from '../../types/contract';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { getMarkerColor } from '../../utils/mapUtils';
import { MapPin, Navigation, Car, ArrowRight, X } from 'lucide-react';

export interface LotPanelProps {
  lots: ParkingLot[];
  selectedLot: ParkingLot | null;
  onSelectLot: (lot: ParkingLot | null) => void;
  isLoading?: boolean;
}

export const LotPanel: React.FC<LotPanelProps> = ({
  lots,
  selectedLot,
  onSelectLot,
  isLoading = false,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading parking lots">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-slate-200/80 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (lots.length === 0) {
    return (
      <Card className="text-center py-8">
        <Car className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">No parking lots found</p>
        <p className="text-xs text-slate-500 mt-1">
          No parking facilities are currently registered in this area.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
                  const { color, label } = getMarkerColor(
                    selectedLot.freeCount,
                    selectedLot.totalSlots
                  );
                  return (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: color }}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 mt-1.5">
                {selectedLot.name}
              </CardTitle>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {selectedLot.address}
              </p>
            </div>
            <button
              onClick={() => onSelectLot(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
              aria-label="Close selected lot panel"
            >
              <X className="w-4 h-4" />
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

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="w-full text-xs py-2.5 font-semibold"
                onClick={() => navigate(`/lots/${selectedLot.id}`)}
              >
                <span>Select & View Slots</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLot.latitude},${selectedLot.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                title="Open Google Maps Directions"
              >
                <Navigation className="w-4 h-4" />
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
          const { color, label } = getMarkerColor(lot.freeCount, lot.totalSlots);
          const price = (lot.pricePerHourPaise / 100).toFixed(0);

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
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none bg-white ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-400 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h5 className="font-semibold text-sm text-slate-900">{lot.name}</h5>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 line-clamp-1">
                    <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    {lot.address}
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">
                  ₹{price}/hr
                </span>
              </div>

              <div className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-slate-700">
                    {lot.freeCount} / {lot.totalSlots} Free
                  </span>
                  <span className="text-[11px] text-slate-400">({label})</span>
                </div>
                <span className="text-xs font-semibold text-indigo-600 hover:underline">
                  View &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

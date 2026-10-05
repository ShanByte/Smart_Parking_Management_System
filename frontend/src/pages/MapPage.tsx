import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ParkingLot } from '../types/contract';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { MapPin, Navigation, Car, AlertCircle } from 'lucide-react';

export const MapPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: lots, isLoading, error } = useQuery<ParkingLot[]>({
    queryKey: ['parking-lots'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ParkingLot[] }>('/parking-lots');
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Find Parking in Pune
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time availability across verified municipal and private lots
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          <span>Green = Plenty of spots</span>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ml-2"></span>
          <span>Red = High occupancy</span>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-48 bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Failed to load parking lots. Please try again later.</p>
        </div>
      )}

      {/* Lots Grid / Map representation */}
      {lots && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lots.map((lot) => {
            const occupancyRate = (lot.totalSlots - lot.freeCount) / lot.totalSlots;
            const isMostlyFull = occupancyRate > 0.75;
            const priceInRupees = (lot.pricePerHourPaise / 100).toFixed(0);

            return (
              <Card
                key={lot.id}
                className="hover:shadow-md transition-shadow border-slate-200 flex flex-col justify-between"
              >
                <CardContent className="pt-6 pb-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                          isMostlyFull ? 'bg-red-500 ring-4 ring-red-100' : 'bg-emerald-500 ring-4 ring-emerald-100'
                        }`}
                      />
                      <h3 className="font-semibold text-slate-900 text-base">
                        {lot.name}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      ₹{priceInRupees}/hr
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span>{lot.address}</span>
                  </p>

                  <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-600">Free Slots</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      <span className={isMostlyFull ? 'text-red-600' : 'text-emerald-600'}>
                        {lot.freeCount}
                      </span>
                      <span className="text-slate-400 font-normal"> / {lot.totalSlots}</span>
                    </div>
                  </div>
                </CardContent>

                <div className="px-6 pb-6 pt-2 flex items-center gap-2">
                  <Button
                    variant="primary"
                    className="w-full text-xs py-2"
                    onClick={() => navigate(`/lots/${lot.id}`)}
                  >
                    View & Reserve Slots
                  </Button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lot.latitude},${lot.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                    title="Open Google Maps Directions"
                  >
                    <Navigation className="w-4 h-4" />
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MapPage;

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ParkingLot } from '../../types/contract';
import { getMarkerColor } from '../../utils/mapUtils';

export interface ParkingMapProps {
  lots: ParkingLot[];
  selectedLotId?: string | null;
  onSelectLot: (lot: ParkingLot) => void;
  className?: string;
  recommendedLotId?: string | null;
}

export const ParkingMap: React.FC<ParkingMapProps> = ({
  lots,
  selectedLotId,
  onSelectLot,
  className = 'h-[500px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200',
  recommendedLotId = null,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    try {
      // Default to Pune center coordinates [18.5204, 73.8567]
      const map = L.map(mapContainerRef.current, {
        center: [18.5204, 73.8567],
        zoom: 13,
        zoomControl: true,
      });

      const tileUrl =
        (typeof import.meta !== 'undefined' &&
          import.meta.env &&
          import.meta.env.VITE_MAP_TILE_URL) ||
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size on initial load to ensure complete tile rendering
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          // ignore
        }
      }, 100);
    } catch (e) {
      console.warn('Leaflet map initialization skipped in test environment', e);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // Ignore unmount error in headless env
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Container Resizing and Layout Toggles via ResizeObserver (Leaflet invalidateSize)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {
          // ignore
        }
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Invalidate map size when selected lot changes or layout toggles
  useEffect(() => {
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.invalidateSize();
      } catch {
        // ignore
      }
    }
  }, [selectedLotId, lots.length]);

  // Update Markers when lots, recommended lot, or selected lot changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => {
      try {
        marker.remove();
      } catch {
        // Ignore
      }
    });
    markersRef.current = {};

    lots.forEach((lot) => {
      const { category, label } = getMarkerColor(lot.freeCount, lot.totalSlots);
      const isSelected = selectedLotId === lot.id;
      const isRecommended = recommendedLotId === lot.id;
      const priceRupees = (lot.pricePerHourPaise / 100).toFixed(0);

      // Category color mapping to avoid forbidden inline styles
      const categoryBgClass =
        category === 'green'
          ? 'bg-emerald-600'
          : category === 'orange'
          ? 'bg-orange-500'
          : 'bg-red-600';

      const categoryTextClass =
        category === 'green'
          ? 'text-emerald-700'
          : category === 'orange'
          ? 'text-orange-700'
          : 'text-red-700';

      const ringClass = isSelected
        ? 'ring-4 ring-indigo-500 scale-110 shadow-lg'
        : 'hover:scale-105 shadow-md';

      // Custom accessible HTML marker with icon and label text
      const iconHtml = `
        <div 
          class="relative flex flex-col items-center cursor-pointer select-none -translate-x-1/2 -translate-y-full"
          aria-label="${lot.name} - ${lot.freeCount} of ${lot.totalSlots} slots available (${label})${isRecommended ? ' - Recommended choice' : ''}"
        >
          <div 
            class="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white font-bold text-xs border-2 border-white ${categoryBgClass} ${ringClass} transition-transform"
          >
            <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            <span>${lot.freeCount} Free</span>
            ${
              isRecommended
                ? '<span class="ml-1 px-1.5 py-0.2 bg-amber-300 text-slate-900 rounded-full text-[10px] font-black">★</span>'
                : ''
            }
          </div>
          <div class="w-2.5 h-2.5 rotate-45 -mt-1.5 shadow-xs ${categoryBgClass}"></div>
          <span class="mt-1 px-2 py-0.5 rounded bg-white/95 text-[10px] font-semibold text-slate-800 shadow-xs border border-slate-200 whitespace-nowrap">
            ${isRecommended ? '★ ' : ''}${lot.name}
          </span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'parking-lot-marker-icon',
        iconSize: [120, 50],
        iconAnchor: [60, 50],
      });

      try {
        const marker = L.marker([lot.latitude, lot.longitude], {
          icon: customIcon,
          title: `${lot.name}: ${lot.freeCount} slots free`,
        }).addTo(map);

        marker.on('click', () => {
          onSelectLot(lot);
          map.setView([lot.latitude, lot.longitude], 15, { animate: true });
        });

        // Popup details
        const popupContent = `
          <div class="p-1 space-y-1 text-slate-800 font-sans">
            ${
              isRecommended
                ? '<div class="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full inline-block">★ Recommended for Arrival</div>'
                : ''
            }
            <h4 class="font-bold text-sm text-slate-900">${lot.name}</h4>
            <p class="text-xs text-slate-500">${lot.address}</p>
            <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <span class="font-bold ${categoryTextClass}">${lot.freeCount} / ${lot.totalSlots} Slots Free</span>
              <span class="font-semibold text-indigo-600">₹${priceRupees}/hr</span>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);

        markersRef.current[lot.id] = marker;

        if (isSelected) {
          marker.openPopup();
        }
      } catch (err) {
        console.warn('Failed to place Leaflet marker:', err);
      }
    });
  }, [lots, selectedLotId, onSelectLot, recommendedLotId]);

  // Center map on selected lot if set
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLotId) return;
    const lot = lots.find((l) => l.id === selectedLotId);
    if (lot) {
      try {
        mapInstanceRef.current.setView([lot.latitude, lot.longitude], 15, {
          animate: true,
        });
      } catch {
        // Ignore
      }
    }
  }, [selectedLotId, lots]);

  return (
    <div className="relative w-full">
      {/* Map DOM Container */}
      <div
        ref={mapContainerRef}
        className={className}
        data-testid="leaflet-map-container"
        tabIndex={0}
        aria-label="Interactive parking map of Pune"
      />

      {/* Accessible DOM Fallback / Screen-reader List of Markers */}
      <div className="sr-only" aria-live="polite">
        <h3>Parking Lots Map View</h3>
        <ul>
          {lots.map((lot) => {
            const { label } = getMarkerColor(lot.freeCount, lot.totalSlots);
            return (
              <li key={lot.id}>
                <button onClick={() => onSelectLot(lot)}>
                  {lot.name}: {lot.freeCount} of {lot.totalSlots} spots free ({label}), ₹
                  {(lot.pricePerHourPaise / 100).toFixed(0)} per hour.
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Map Legend Overlay */}
      <div
        aria-label="Map availability legend"
        className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200/90 shadow-md text-xs space-y-1.5 select-none"
      >
        <div className="font-semibold text-slate-800 text-[11px] mb-1 uppercase tracking-wider">
          Availability Legend:
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span className="text-slate-700 font-medium">&gt; 50% Free (Plenty)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
          <span className="text-slate-700 font-medium">20% &ndash; 50% Free (Filling up)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
          <span className="text-slate-700 font-medium">&lt; 20% Free (Almost full)</span>
        </div>
      </div>
    </div>
  );
};

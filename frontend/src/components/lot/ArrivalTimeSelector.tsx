import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { formatToDateTimeLocal, formatArrivalLabel } from '../../utils/lotUtils';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

export interface ArrivalTimeSelectorProps {
  arrivalIso: string;
  onChange: (iso: string, isNow: boolean, label: string) => void;
  userCoords: UserCoordinates | null;
  onLocationChange: (coords: UserCoordinates | null) => void;
  className?: string;
}

function getPresetFromIso(arrivalIso: string): 'now' | '15' | '30' | '60' | 'custom' {
  if (!arrivalIso) return 'now';
  const d = new Date(arrivalIso);
  if (isNaN(d.getTime())) return 'now';
  const diffMinutes = Math.round((d.getTime() - Date.now()) / 60000);
  if (diffMinutes >= -1 && diffMinutes <= 2) return 'now';
  if (diffMinutes >= 13 && diffMinutes <= 17) return '15';
  if (diffMinutes >= 28 && diffMinutes <= 32) return '30';
  if (diffMinutes >= 58 && diffMinutes <= 62) return '60';
  return 'custom';
}

export const ArrivalTimeSelector: React.FC<ArrivalTimeSelectorProps> = ({
  arrivalIso,
  onChange,
  userCoords,
  onLocationChange,
  className = '',
}) => {
  const [activePreset, setActivePreset] = useState<'now' | '15' | '30' | '60' | 'custom'>(() => {
    return getPresetFromIso(arrivalIso);
  });
  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const d = new Date(arrivalIso);
    return isNaN(d.getTime()) ? '' : formatToDateTimeLocal(d);
  });
  const [customError, setCustomError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!arrivalIso) return;
    const computedPreset = getPresetFromIso(arrivalIso);
    setActivePreset(computedPreset);
    const d = new Date(arrivalIso);
    if (!isNaN(d.getTime())) {
      setCustomDateTime(formatToDateTimeLocal(d));
    }
  }, [arrivalIso]);

  // Helper to format arrival instant for display
  const formatTimeLabel = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handlePresetSelect = (preset: 'now' | '15' | '30' | '60') => {
    setActivePreset(preset);
    setCustomError(null);
    const now = new Date();
    let offsetMinutes = 0;
    if (preset === '15') offsetMinutes = 15;
    if (preset === '30') offsetMinutes = 30;
    if (preset === '60') offsetMinutes = 60;

    const target = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    // Round to minute
    target.setSeconds(0, 0);

    const isNow = preset === 'now';
    const label = isNow ? 'Now' : formatTimeLabel(target);
    onChange(target.toISOString(), isNow, label);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDateTime(val);

    if (!val) {
      setCustomError('Please choose a valid date and time');
      return;
    }

    const parsed = new Date(val);
    const now = Date.now();
    const minTime = now - 60 * 1000;
    const maxTime = now + 7 * 24 * 60 * 60 * 1000;

    if (isNaN(parsed.getTime())) {
      setCustomError('Invalid date format');
      return;
    }

    if (parsed.getTime() < minTime) {
      setCustomError('Arrival time cannot be in the past');
      return;
    }

    if (parsed.getTime() > maxTime) {
      setCustomError('Arrival time cannot be more than 7 days ahead');
      return;
    }

    setCustomError(null);
    parsed.setSeconds(0, 0);
    const label = formatArrivalLabel(parsed);
    onChange(parsed.toISOString(), false, label);
  };

  const handleNearMeClick = () => {
    if (userCoords) {
      // Toggle off
      onLocationChange(null);
      setLocationDenied(false);
      return;
    }

    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setLocationDenied(false);
        onLocationChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        setIsLocating(false);
        setLocationDenied(true);
        onLocationChange(null);
      },
      { timeout: 8000 }
    );
  };

  // Re-evaluate 'Now' once every 60 seconds
  useEffect(() => {
    if (activePreset !== 'now') return;

    const interval = setInterval(() => {
      const now = new Date();
      now.setSeconds(0, 0);
      onChange(now.toISOString(), true, 'Now');
    }, 60000);

    return () => clearInterval(interval);
  }, [activePreset, onChange]);

  const arrivalDate = new Date(arrivalIso);
  const displayLabel =
    activePreset === 'now' ? 'Now' : formatArrivalLabel(arrivalDate);

  return (
    <Card className={`p-4 bg-white border border-slate-200 shadow-xs ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            When are you arriving?
          </h2>
          <p className="text-xs text-slate-500">
            Selected Arrival: <span className="font-bold text-indigo-600">{displayLabel}</span>
          </p>
        </div>

        {/* Near Me Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNearMeClick}
            disabled={isLocating}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              userCoords
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Use your current location for distance-aware parking recommendations"
          >
            <svg
              className={`w-3.5 h-3.5 ${userCoords ? 'text-indigo-600' : 'text-slate-500'}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{isLocating ? 'Locating...' : userCoords ? 'Near me (Active)' : 'Near me'}</span>
          </button>
          {locationDenied && (
            <span className="text-[11px] text-slate-400 italic">Location unavailable</span>
          )}
        </div>
      </div>

      <div className="pt-3 space-y-3">
        {/* Preset Buttons */}
        <div className="grid grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => handlePresetSelect('now')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePreset === 'now'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('15')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePreset === '15'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            +15 min
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('30')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePreset === '30'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            +30 min
          </button>
          <button
            type="button"
            onClick={() => handlePresetSelect('60')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePreset === '60'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            +1 hour
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePreset('custom');
              const d = new Date(arrivalIso);
              const localNow =
                !isNaN(d.getTime()) && d.getTime() > Date.now() - 60 * 1000
                  ? d
                  : new Date(Date.now() + 120 * 60 * 1000);
              localNow.setSeconds(0, 0);
              const formattedLocal = formatToDateTimeLocal(localNow);
              setCustomDateTime(formattedLocal);
              const label = formatArrivalLabel(localNow);
              onChange(localNow.toISOString(), false, label);
            }}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              activePreset === 'custom'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Input */}
        {activePreset === 'custom' && (
          <div className="pt-2">
            <label
              htmlFor="custom-arrival-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Choose Custom Date & Time (within 7 days)
            </label>
            <input
              id="custom-arrival-input"
              type="datetime-local"
              value={customDateTime}
              onChange={handleCustomChange}
              min={formatToDateTimeLocal(new Date(Date.now() - 60000))}
              max={formatToDateTimeLocal(new Date(Date.now() + 7 * 24 * 3600 * 1000))}
              aria-describedby={customError ? 'custom-arrival-error' : undefined}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {customError && (
              <p
                id="custom-arrival-error"
                role="alert"
                className="text-xs text-rose-600 font-medium mt-1"
              >
                {customError}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

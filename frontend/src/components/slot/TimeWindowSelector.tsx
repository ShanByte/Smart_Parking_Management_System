import React, { useState, useEffect, useRef } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { formatToDateTimeLocal } from '../../utils/lotUtils';

export interface TimeWindow {
  from: string; // ISO string
  to: string;   // ISO string
  durationHours: number;
}

export interface TimeWindowSelectorProps {
  pricePerHourPaise: number;
  value?: TimeWindow;
  initialFrom?: string;
  initialDurationHours?: number;
  onChange: (window: TimeWindow) => void;
  className?: string;
}

function getPresetFromDate(date: Date): 'now' | '15' | '30' | '60' | 'custom' {
  const now = Date.now();
  const diffMinutes = Math.round((date.getTime() - now) / 60000);
  if (diffMinutes >= -1 && diffMinutes <= 2) return 'now';
  if (diffMinutes >= 13 && diffMinutes <= 17) return '15';
  if (diffMinutes >= 28 && diffMinutes <= 32) return '30';
  if (diffMinutes >= 58 && diffMinutes <= 62) return '60';
  return 'custom';
}

export const TimeWindowSelector: React.FC<TimeWindowSelectorProps> = ({
  pricePerHourPaise,
  value,
  initialFrom,
  initialDurationHours,
  onChange,
  className,
}) => {
  const [durationHours, setDurationHours] = useState<number>(() => {
    return value?.durationHours ?? initialDurationHours ?? 1;
  });

  const [currentFromIso, setCurrentFromIso] = useState<string>(() => {
    if (value?.from) return value.from;
    if (initialFrom) return initialFrom;
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString();
  });

  const [activePreset, setActivePreset] = useState<'now' | '15' | '30' | '60' | 'custom'>(() => {
    const fromStr = value?.from ?? initialFrom;
    if (!fromStr) return 'now';
    const parsed = new Date(fromStr);
    if (isNaN(parsed.getTime())) return 'now';
    return getPresetFromDate(parsed);
  });

  const [customDateTime, setCustomDateTime] = useState<string>(() => {
    const fromStr = value?.from ?? initialFrom;
    const d = fromStr ? new Date(fromStr) : new Date(Date.now() + 120 * 60 * 1000);
    return isNaN(d.getTime()) ? '' : formatToDateTimeLocal(d);
  });

  const [customError, setCustomError] = useState<string | null>(null);

  // Synchronize when external value changes
  useEffect(() => {
    if (value?.durationHours !== undefined) {
      setDurationHours(value.durationHours);
    }
  }, [value?.durationHours]);

  useEffect(() => {
    if (value?.from) {
      setCurrentFromIso(value.from);
      const parsed = new Date(value.from);
      if (!isNaN(parsed.getTime())) {
        setActivePreset(getPresetFromDate(parsed));
        setCustomDateTime(formatToDateTimeLocal(parsed));
      }
    }
  }, [value?.from]);

  // If uncontrolled (no value prop), fire initial onChange once on mount for caller
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      if (!value) {
        const fromDate = new Date(currentFromIso);
        const toDate = new Date(fromDate.getTime() + durationHours * 3600 * 1000);
        onChange({
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          durationHours,
        });
      }
    }
  }, [value, currentFromIso, durationHours, onChange]);

  const handlePresetSelect = (preset: 'now' | '15' | '30' | '60' | 'custom') => {
    setActivePreset(preset);
    setCustomError(null);

    if (preset === 'custom') {
      let parsed = customDateTime ? new Date(customDateTime) : new Date(NaN);
      if (isNaN(parsed.getTime()) || parsed.getTime() < Date.now() - 60000) {
        parsed = new Date(currentFromIso);
        if (isNaN(parsed.getTime()) || parsed.getTime() < Date.now() - 60000) {
          parsed = new Date(Date.now() + 120 * 60 * 1000);
        }
        parsed.setSeconds(0, 0);
        setCustomDateTime(formatToDateTimeLocal(parsed));
      }
      const newFrom = parsed.toISOString();
      const newTo = new Date(parsed.getTime() + durationHours * 3600 * 1000).toISOString();
      setCurrentFromIso(newFrom);
      onChange({
        from: newFrom,
        to: newTo,
        durationHours,
      });
      return;
    }

    const now = new Date();
    let offsetMinutes = 0;
    if (preset === '15') offsetMinutes = 15;
    if (preset === '30') offsetMinutes = 30;
    if (preset === '60') offsetMinutes = 60;

    const target = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    target.setSeconds(0, 0);

    const newFrom = target.toISOString();
    const newTo = new Date(target.getTime() + durationHours * 3600 * 1000).toISOString();
    setCurrentFromIso(newFrom);
    setCustomDateTime(formatToDateTimeLocal(target));
    onChange({
      from: newFrom,
      to: newTo,
      durationHours,
    });
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

    const newFrom = parsed.toISOString();
    const newTo = new Date(parsed.getTime() + durationHours * 3600 * 1000).toISOString();
    setCurrentFromIso(newFrom);
    onChange({
      from: newFrom,
      to: newTo,
      durationHours,
    });
  };

  const handleDurationSelect = (hours: number) => {
    setDurationHours(hours);
    const fromDate = new Date(currentFromIso);
    const toDate = new Date(fromDate.getTime() + hours * 3600 * 1000);

    onChange({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      durationHours: hours,
    });
  };

  const estimatedPaise = Math.ceil(durationHours * pricePerHourPaise);
  const estimatedRupees = (estimatedPaise / 100).toFixed(0);

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  };

  const formatWindowDisplay = (from: Date, to: Date): string => {
    const isToday = from.toDateString() === new Date().toDateString();
    const fromTime = from.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const toTime = to.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) {
      return `${fromTime} – ${toTime}`;
    }
    const dateStr = from.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${fromTime} – ${toTime}`;
  };

  const formatReadableDateTime = (d: Date): string => {
    if (isNaN(d.getTime())) return '';
    const dateStr = d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  const startOptions: Array<{ label: string; preset: 'now' | '15' | '30' | '60' | 'custom' }> = [
    { label: 'Now', preset: 'now' },
    { label: '+15 min', preset: '15' },
    { label: '+30 min', preset: '30' },
    { label: '+1 hour', preset: '60' },
    { label: 'Custom', preset: 'custom' },
  ];

  const durationOptions = [
    { label: '15m', hours: 0.25 },
    { label: '30m', hours: 0.5 },
    { label: '1 hr', hours: 1 },
    { label: '2 hrs', hours: 2 },
    { label: '4 hrs', hours: 4 },
    { label: '8 hrs', hours: 8 },
    { label: '24 hrs', hours: 24 },
  ];

  const fromDate = new Date(currentFromIso);
  const toDate = new Date(fromDate.getTime() + durationHours * 3600 * 1000);

  return (
    <Card className={className}>
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <CardTitle className="text-sm font-semibold">Select Time Window</CardTitle>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
          Estimated: ₹{estimatedRupees} ({formatDuration(durationHours)})
        </span>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Start Time Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Arrival Time
          </label>
          <div className="grid grid-cols-5 gap-2">
            {startOptions.map((opt) => (
              <button
                key={opt.preset}
                type="button"
                onClick={() => handlePresetSelect(opt.preset)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  activePreset === opt.preset
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date/Time input when Custom is selected */}
        {activePreset === 'custom' && (
          <div className="pt-1">
            <label
              htmlFor="custom-arrival-date-time"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
            >
              Custom Arrival Date &amp; Time
            </label>
            <input
              id="custom-arrival-date-time"
              type="datetime-local"
              value={customDateTime}
              onChange={handleCustomChange}
              min={formatToDateTimeLocal(new Date(Date.now() - 60000))}
              max={formatToDateTimeLocal(new Date(Date.now() + 7 * 24 * 3600 * 1000))}
              aria-describedby={customError ? 'custom-arrival-window-error' : undefined}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {customError && (
              <p
                id="custom-arrival-window-error"
                role="alert"
                className="text-xs text-rose-600 font-medium mt-1"
              >
                {customError}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              Selected Arrival:{' '}
              <span className="font-semibold text-indigo-700">
                {formatReadableDateTime(fromDate)}
              </span>
            </p>
          </div>
        )}

        {/* Duration Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Parking Duration
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => handleDurationSelect(opt.hours)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  durationHours === opt.hours
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Window Summary */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {formatWindowDisplay(fromDate, toDate)}
            </span>
          </div>
          <span className="font-semibold text-slate-800">
            {formatDuration(durationHours)} window
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

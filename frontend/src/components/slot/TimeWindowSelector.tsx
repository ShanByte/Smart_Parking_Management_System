import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';

export interface TimeWindow {
  from: string; // ISO string
  to: string;   // ISO string
  durationHours: number;
}

export interface TimeWindowSelectorProps {
  pricePerHourPaise: number;
  onChange: (window: TimeWindow) => void;
  className?: string;
}

export const TimeWindowSelector: React.FC<TimeWindowSelectorProps> = ({
  pricePerHourPaise,
  onChange,
  className,
}) => {
  const [durationHours, setDurationHours] = useState<number>(1);
  const [startOffsetMinutes, setStartOffsetMinutes] = useState<number>(0);

  useEffect(() => {
    const now = Date.now();
    const fromDate = new Date(now + startOffsetMinutes * 60 * 1000);
    const toDate = new Date(fromDate.getTime() + durationHours * 3600 * 1000);

    onChange({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      durationHours,
    });
  }, [durationHours, startOffsetMinutes, onChange]);

  const estimatedPaise = Math.ceil(durationHours * pricePerHourPaise);
  const estimatedRupees = (estimatedPaise / 100).toFixed(0);

  const startOptions = [
    { label: 'Now', offset: 0 },
    { label: '+15 min', offset: 15 },
    { label: '+30 min', offset: 30 },
    { label: '+1 hour', offset: 60 },
  ];

  const durationOptions = [
    { label: '1 hr', hours: 1 },
    { label: '2 hrs', hours: 2 },
    { label: '3 hrs', hours: 3 },
    { label: '4 hrs', hours: 4 },
    { label: '8 hrs', hours: 8 },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <CardTitle className="text-sm font-semibold">Select Time Window</CardTitle>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
          Estimated: ₹{estimatedRupees} ({durationHours} hr{durationHours > 1 ? 's' : ''})
        </span>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Start Time Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Arrival Time
          </label>
          <div className="grid grid-cols-4 gap-2">
            {startOptions.map((opt) => (
              <button
                key={opt.offset}
                type="button"
                onClick={() => setStartOffsetMinutes(opt.offset)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  startOffsetMinutes === opt.offset
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Parking Duration
          </label>
          <div className="grid grid-cols-5 gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.hours}
                type="button"
                onClick={() => setDurationHours(opt.hours)}
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
              {new Date(Date.now() + startOffsetMinutes * 60 * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              &ndash;{' '}
              {new Date(
                Date.now() + (startOffsetMinutes + durationHours * 60) * 60 * 1000
              ).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <span className="font-semibold text-slate-800">
            {durationHours} hr{durationHours > 1 ? 's' : ''} window
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

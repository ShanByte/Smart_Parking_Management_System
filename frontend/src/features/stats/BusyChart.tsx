// ==============================================================================
// BusyChart.tsx - Member 4: Occupancy Analytics Chart Component
// Uses React Query, Axios api instance, Recharts, and accessible screen-reader summary
// ==============================================================================

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { z } from 'zod';
import { api } from '../../services/api';
import { Button } from '../../components/common/Button';
import { AlertCircleIcon } from '../../components/common/icons';

export interface BusyChartProps {
  lotId: string;
}

// Zod schema validating API response (Security Rule 7)
const HourlyStatItemSchema = z.object({
  hourOfDay: z.number().int().min(0).max(23),
  averageOccupiedPercent: z.number().min(0).max(100),
  samples: z.number().int().min(0),
});

const StatsApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    parkingLotId: z.string(),
    totalSlots: z.number().int().nonnegative(),
    hours: z.array(HourlyStatItemSchema),
  }),
});

export type HourlyStatItem = z.infer<typeof HourlyStatItemSchema>;

/**
 * Helper to format 24-hour integer into user-friendly 12-hour AM/PM label
 */
function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/**
 * BusyChart Component
 * Visualizes historical occupancy rates for a parking lot throughout the day.
 */
export function BusyChart({ lotId }: BusyChartProps): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['parking-lot-stats', lotId],
    queryFn: async () => {
      const response = await api.get(`/parking-lots/${lotId}/stats`);
      const parsed = StatsApiResponseSchema.parse(response.data);
      return parsed.data;
    },
    enabled: Boolean(lotId),
    staleTime: 60 * 1000, // 1 minute cache
  });

  // State 1: Loading State
  if (isLoading) {
    return (
      <div
        className="busy-chart-container busy-chart-loading bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto spinner" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-500">Loading historical busy hours...</p>
      </div>
    );
  }

  // State 2: Error State
  if (isError) {
    return (
      <div
        className="busy-chart-container busy-chart-error bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-2 text-red-900 shadow-sm"
        role="alert"
        aria-live="assertive"
      >
        <AlertCircleIcon className="w-8 h-8 text-red-500 mx-auto" />
        <p className="error-title text-sm font-bold text-red-950">Unable to load parking busy times.</p>
        <p className="error-message text-xs text-red-700">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          className="retry-button mt-2 border-red-300 text-red-800 hover:bg-red-100"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const hours = data?.hours ?? [];

  // State 3: Empty Data State
  if (hours.length === 0) {
    return (
      <div
        className="busy-chart-container busy-chart-empty bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center shadow-sm"
        role="region"
        aria-label="Busy Times"
      >
        <h3 className="chart-heading text-sm font-bold text-slate-800">Popular Times</h3>
        <p className="empty-message text-xs text-slate-500 mt-1">
          No historical occupancy data collected yet for this location.
        </p>
      </div>
    );
  }

  // Find peak occupancy hour for accessible text summary
  const peakHour = hours.reduce(
    (max, cur) => (cur.averageOccupiedPercent > max.averageOccupiedPercent ? cur : max),
    hours[0],
  );

  return (
    <section
      className="busy-chart-container bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
      aria-label="Parking Lot Busy Times"
    >
      <div className="chart-header flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-slate-100">
        <div>
          <h3 className="chart-heading text-base font-bold text-slate-900 tracking-tight">
            Popular Times & Typical Occupancy
          </h3>
          <p className="chart-subtitle text-xs text-slate-500 mt-0.5">
            Based on historical sensor data ({data?.totalSlots} total capacity)
          </p>
        </div>
        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full w-fit">
          Peak: {formatHourLabel(peakHour.hourOfDay)} ({peakHour.averageOccupiedPercent}%)
        </span>
      </div>

      {/* Accessible Text Summary for Screen Readers (Accessibility: not color alone) */}
      <div className="sr-only" tabIndex={0} aria-label="Occupancy data summary">
        <p>
          Historical occupancy data for parking lot. Peak busy time is typically around{' '}
          {formatHourLabel(peakHour.hourOfDay)} with {peakHour.averageOccupiedPercent}% average
          occupancy.
        </p>
        <table>
          <caption>Occupancy breakdown by hour</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              <th scope="col">Average Occupancy</th>
              <th scope="col">Data Samples</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((item) => (
              <tr key={item.hourOfDay}>
                <td>{formatHourLabel(item.hourOfDay)}</td>
                <td>{item.averageOccupiedPercent}%</td>
                <td>{item.samples} snapshots</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive Visual Chart (Recharts) */}
      <div className="chart-wrapper" aria-hidden="true" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hours} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="hourOfDay"
              tickFormatter={formatHourLabel}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Average Occupancy']}
              labelFormatter={(label: number) => formatHourLabel(Number(label))}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Bar dataKey="averageOccupiedPercent" radius={[4, 4, 0, 0]}>
              {hours.map((entry) => (
                <Cell
                  key={`cell-${entry.hourOfDay}`}
                  fill={
                    entry.averageOccupiedPercent >= 80
                      ? '#EF4444'
                      : entry.averageOccupiedPercent >= 50
                        ? '#F59E0B'
                        : '#3B82F6'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default BusyChart;

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AvailabilityHourPatternItem } from '@smart-parking/shared';

export interface AvailabilityPatternChartProps {
  pattern: AvailabilityHourPatternItem[];
  arrivalHour: number;
  lotName?: string;
  isLimitedData?: boolean;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/**
 * Lazy-loaded Availability Pattern Chart using Recharts.
 * Visualizes expected free space percentages across hours around the selected arrival time.
 */
export const AvailabilityPatternChart: React.FC<AvailabilityPatternChartProps> = ({
  pattern,
  arrivalHour,
  lotName,
  isLimitedData = false,
}) => {
  if (isLimitedData || pattern.length === 0) {
    return (
      <div
        className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center"
        role="region"
        aria-label="Availability pattern chart"
      >
        <p className="text-xs font-semibold text-slate-700">Limited historical data</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Hourly occupancy pattern is still accumulating for this location.
        </p>
      </div>
    );
  }

  // Generate plain-language summary for humans and screen readers
  const summarySentences = pattern
    .map(
      (p) =>
        `${p.expectedAvailablePercent}% free at ${formatHourLabel(p.hourOfDay)}`
    )
    .join(', ');
  const plainSummary = `Typically ${summarySentences}.`;

  const chartData = pattern.map((p) => ({
    hour: formatHourLabel(p.hourOfDay),
    hourOfDay: p.hourOfDay,
    percent: p.expectedAvailablePercent,
    isArrival: p.hourOfDay === arrivalHour,
  }));

  return (
    <div
      className="p-4 bg-white border border-slate-200 rounded-xl space-y-3"
      role="region"
      aria-label={`Availability pattern for ${lotName || 'parking lot'}: ${plainSummary}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Availability Around Arrival
          </h4>
          <p className="text-[11px] text-slate-500">{plainSummary}</p>
        </div>
        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
          Target: {formatHourLabel(arrivalHour)}
        </span>
      </div>

      <div className="h-44 w-full" data-testid="pattern-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number) => [`${value}% free`, 'Expected Free']}
              labelFormatter={(label: string) => `Time: ${label}`}
              contentStyle={{
                fontSize: '11px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            />
            <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isArrival ? '#4f46e5' : '#94a3b8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Screen reader text alternative */}
      <p className="sr-only">{plainSummary}</p>
    </div>
  );
};

export default AvailabilityPatternChart;

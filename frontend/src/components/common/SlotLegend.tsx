import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  CheckCircleIcon,
  ClockIcon,
  CarIcon,
  BanIcon,
} from './icons';

export interface SlotLegendProps {
  className?: string;
}

export const SlotLegend: React.FC<SlotLegendProps> = ({ className }) => {
  const items = [
    {
      label: 'Available',
      description: 'Ready to reserve',
      icon: CheckCircleIcon,
      badgeStyle: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    },
    {
      label: 'Held',
      description: 'In checkout (5m grace)',
      icon: ClockIcon,
      badgeStyle: 'bg-amber-100 text-amber-950 border-amber-300',
    },
    {
      label: 'Reserved',
      description: 'Booked / Confirmed',
      icon: CarIcon,
      badgeStyle: 'bg-blue-100 text-blue-900 border-blue-300',
    },
    {
      label: 'Occupied',
      description: 'Sensor detected / In use',
      icon: BanIcon,
      badgeStyle: 'bg-red-100 text-red-900 border-red-300 pattern-diagonal-hatch',
    },
  ];

  return (
    <div
      aria-label="Slot status legend"
      className={twMerge(
        clsx(
          'p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs text-xs',
          className
        )
      )}
    >
      <h3 className="font-semibold text-slate-900 mb-3 text-xs uppercase tracking-wider">
        Parking Bay Legend
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={clsx(
                  'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0',
                  item.badgeStyle
                )}
              >
                <Icon className="w-3 h-3" />
              </span>
              <div>
                <span className="font-semibold text-slate-800 block">{item.label}</span>
                <span className="text-[11px] text-slate-500 leading-tight block">
                  {item.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

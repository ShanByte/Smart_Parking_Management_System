import React from 'react';
import { Card, CardContent } from '../../../components/common/Card';
import {
  BuildingIcon,
  LayersIcon,
  CalendarCheckIcon,
  CpuIcon,
  ArrowRightIcon,
} from '../../../components/common/icons';

interface AdminOverviewProps {
  lotsCount: number;
  slotsCount: number;
  bookingsCount: number;
  devicesCount: number;
  onNavigateTab: (tab: string) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  lotsCount,
  slotsCount,
  bookingsCount,
  devicesCount,
  onNavigateTab,
}) => {
  const cards = [
    {
      title: 'Parking Lots',
      value: lotsCount,
      description: 'Active parking facilities',
      icon: BuildingIcon,
      tab: 'lots',
      color: 'bg-indigo-600',
      textColor: 'text-indigo-900',
      bgColor: 'bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-300',
    },
    {
      title: 'Total Slots',
      value: slotsCount,
      description: 'Managed parking bays',
      icon: LayersIcon,
      tab: 'lots',
      color: 'bg-emerald-600',
      textColor: 'text-emerald-900',
      bgColor: 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300',
    },
    {
      title: 'Active Bookings',
      value: bookingsCount,
      description: 'Confirmed & in-progress',
      icon: CalendarCheckIcon,
      tab: 'bookings',
      color: 'bg-blue-600',
      textColor: 'text-blue-900',
      bgColor: 'bg-blue-50/40 border-blue-200/80 hover:border-blue-300',
    },
    {
      title: 'Hardware & Sim Devices',
      value: devicesCount,
      description: 'Registered IoT keyholders',
      icon: CpuIcon,
      tab: 'devices',
      color: 'bg-purple-600',
      textColor: 'text-purple-900',
      bgColor: 'bg-purple-50/40 border-purple-200/80 hover:border-purple-300',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card
              key={c.title}
              className={`border transition-all hover:shadow-md cursor-pointer rounded-2xl ${c.bgColor}`}
              onClick={() => onNavigateTab(c.tab)}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {c.title}
                  </span>
                  <div className={`w-10 h-10 rounded-xl ${c.color} text-white flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <div className={`text-3xl font-black ${c.textColor} tracking-tight`}>
                    {c.value}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                </div>
                <div className="pt-3.5 mt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Manage</span>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

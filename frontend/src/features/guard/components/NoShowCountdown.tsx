import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface NoShowCountdownProps {
  startTime: string;
  isArrived: boolean;
}

export const NoShowCountdown: React.FC<NoShowCountdownProps> = ({
  startTime,
  isArrived,
}) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (isArrived) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isArrived]);

  if (isArrived) return null;

  const startMs = new Date(startTime).getTime();
  const noShowGraceMs = 15 * 60 * 1000; // 15-minute no-show window per C3
  const deadlineMs = startMs + noShowGraceMs;
  const remainingMs = deadlineMs - now;

  if (now < startMs) {
    const minsUntilStart = Math.ceil((startMs - now) / 60000);
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-300">
        <Clock className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
        <span>Starts in {minsUntilStart}m</span>
      </div>
    );
  }

  if (remainingMs <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded border border-red-300 animate-pulse">
        <AlertTriangle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
        <span>No-Show Expired</span>
      </div>
    );
  }

  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded border border-amber-400">
      <Clock className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
      <span>No-show release: {formattedTime}</span>
    </div>
  );
};

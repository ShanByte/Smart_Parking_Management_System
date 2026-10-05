/**
 * Map utilities and marker color calculations
 * Thresholds:
 * - Green: > 50% free
 * - Orange: 20% to 50% free
 * - Red: < 20% free
 */
export function getMarkerColor(freeCount: number, totalSlots: number): {
  color: string;
  bgClass: string;
  borderClass: string;
  label: string;
  category: 'green' | 'orange' | 'red';
} {
  const ratio = totalSlots > 0 ? freeCount / totalSlots : 0;

  if (ratio > 0.5) {
    return {
      color: '#10b981', // green
      bgClass: 'bg-emerald-500',
      borderClass: 'border-emerald-600',
      label: '> 50% Free',
      category: 'green',
    };
  } else if (ratio >= 0.2) {
    return {
      color: '#f97316', // orange
      bgClass: 'bg-orange-500',
      borderClass: 'border-orange-600',
      label: '20-50% Free',
      category: 'orange',
    };
  } else {
    return {
      color: '#ef4444', // red
      bgClass: 'bg-red-500',
      borderClass: 'border-red-600',
      label: '< 20% Free',
      category: 'red',
    };
  }
}

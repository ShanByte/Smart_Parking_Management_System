import React from 'react';
import { SlotView } from '../../types/contract';
import { StatusBadge } from './StatusBadge';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SlotCellProps {
  slot: SlotView;
  isSelected?: boolean;
  onSelect?: (slot: SlotView) => void;
  disabled?: boolean;
}

export const SlotCell: React.FC<SlotCellProps> = ({
  slot,
  isSelected = false,
  onSelect,
  disabled,
}) => {
  const isAvailable = slot.status === 'AVAILABLE';
  const isActionable = isAvailable && !disabled;

  const handleClick = () => {
    if (isActionable && onSelect) {
      onSelect(slot);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isActionable && onSelect) {
      e.preventDefault();
      onSelect(slot);
    }
  };

  const getStatusStyles = () => {
    switch (slot.status) {
      case 'AVAILABLE':
        return isSelected
          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500 shadow-md'
          : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/70 hover:border-emerald-400 cursor-pointer shadow-sm';
      case 'HELD':
        return 'border-amber-300 bg-amber-50/40 opacity-80 cursor-not-allowed';
      case 'RESERVED':
        return 'border-blue-300 bg-blue-50/40 opacity-80 cursor-not-allowed';
      case 'OCCUPIED':
        return 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed';
      default:
        return 'border-slate-200 bg-white';
    }
  };

  return (
    <div
      role="button"
      tabIndex={isActionable ? 0 : -1}
      aria-label={`Slot ${slot.slotNumber}, ${slot.status}`}
      aria-disabled={!isActionable}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={twMerge(
        clsx(
          'relative flex flex-col items-center justify-between p-3 rounded-xl border-2 transition-all select-none min-h-[96px]',
          getStatusStyles()
        )
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="font-bold text-base text-slate-800 tracking-wide">
          {slot.slotNumber}
        </span>
        {isSelected && (
          <span className="text-[10px] font-semibold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded">
            Selected
          </span>
        )}
      </div>

      <div className="mt-2">
        <StatusBadge status={slot.status} size="sm" />
      </div>
    </div>
  );
};

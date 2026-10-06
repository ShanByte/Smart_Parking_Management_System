import React from 'react';
import { ArrivalBand, availabilityBand } from '@smart-parking/shared';

export interface AvailabilityBadgeProps {
  score: number | null;
  arrivalTimeLabel?: string;
  isRecommended?: boolean;
  recommendedReason?: string | null;
  isMostSpacesNow?: boolean;
  className?: string;
  showFootnote?: boolean;
}

/**
 * Inline SVGs for status icons avoiding external icon packages.
 */
function BandIcon({ band }: { band: ArrivalBand }): React.JSX.Element {
  switch (band) {
    case ArrivalBand.EXCELLENT:
      return (
        <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case ArrivalBand.GOOD:
      return (
        <svg className="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case ArrivalBand.MODERATE:
      return (
        <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case ArrivalBand.LOW:
      return (
        <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case ArrivalBand.VERY_LOW:
      return (
        <svg className="w-3.5 h-3.5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    case ArrivalBand.LIMITED_DATA:
    default:
      return (
        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

function getBandStyles(band: ArrivalBand): { bg: string; border: string; text: string } {
  switch (band) {
    case ArrivalBand.EXCELLENT:
      return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' };
    case ArrivalBand.GOOD:
      return { bg: 'bg-emerald-50/60', border: 'border-emerald-200', text: 'text-emerald-700' };
    case ArrivalBand.MODERATE:
      return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' };
    case ArrivalBand.LOW:
      return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' };
    case ArrivalBand.VERY_LOW:
      return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' };
    case ArrivalBand.LIMITED_DATA:
    default:
      return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' };
  }
}

export const AvailabilityBadge: React.FC<AvailabilityBadgeProps> = ({
  score,
  arrivalTimeLabel = 'your arrival',
  isRecommended = false,
  recommendedReason = null,
  isMostSpacesNow = false,
  className = '',
  showFootnote = true,
}) => {
  const meta = availabilityBand(score);
  const styles = getBandStyles(meta.band);

  const ariaText =
    score !== null
      ? `Estimated availability at ${arrivalTimeLabel}: ${score} percent, ${meta.label.toLowerCase()}`
      : `Estimated availability at ${arrivalTimeLabel}: limited historical data`;

  return (
    <div className={`space-y-1.5 ${className}`} aria-label={ariaText}>
      {/* Recommended Pill if applicable */}
      {isRecommended && (
        <div
          data-testid="recommended-badge"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs"
        >
          <svg className="w-3 h-3 fill-amber-300" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span>Recommended for {arrivalTimeLabel}</span>
        </div>
      )}

      {/* Most Spaces Right Now Pill (when all lots limited) */}
      {isMostSpacesNow && (
        <div
          data-testid="most-spaces-badge"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-white shadow-xs"
        >
          <span>Most spaces right now</span>
        </div>
      )}

      {/* Main Availability Card / Strip */}
      <div
        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${styles.bg} ${styles.border}`}
      >
        <div className="flex items-center gap-2">
          <BandIcon band={meta.band} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-800">
                Estimated availability
              </span>
              {score !== null && (
                <span className={`text-xs font-extrabold ${styles.text}`}>
                  {score}%
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 line-clamp-1">{meta.headline}</p>
          </div>
        </div>

        {score !== null && (
          <div className="text-right flex-shrink-0">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles.bg} ${styles.border} ${styles.text}`}
            >
              {meta.band}
            </span>
          </div>
        )}
      </div>

      {/* Recommended Reason */}
      {isRecommended && recommendedReason && (
        <p className="text-[11px] text-indigo-700 font-medium px-1">
          {recommendedReason}
        </p>
      )}

      {/* Mandatory Footnote */}
      {showFootnote && (
        <p className="text-[10px] text-slate-500 italic px-1">
          Estimate based on historical occupancy data. Not a guarantee.
        </p>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { GuardBoardSlot } from '../../../types/contract';
import { Button } from '../../../components/common/Button';
import { CarIcon, AlertCircleIcon, XIcon } from '../../../components/common/icons';

interface WalkInModalProps {
  slot: GuardBoardSlot | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const WalkInModal: React.FC<WalkInModalProps> = ({
  slot,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!slot) return null;

  const isAvailable = slot.status === 'AVAILABLE';
  const targetStatus: 'OCCUPIED' | 'AVAILABLE' = isAvailable ? 'OCCUPIED' : 'AVAILABLE';

  // HELD or RESERVED slots are protected from walk-in mutation
  const isProtected = slot.status === 'HELD' || slot.status === 'RESERVED';

  const handleConfirm = async () => {
    if (isProtected) {
      setErrorMessage(
        `Slot ${slot.slotNumber} is currently ${slot.status} by a customer reservation and cannot be changed.`
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.post(`/guard/slots/${slot.slotId}/walk-in`, {
        status: targetStatus,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const serverMsg = (err.response?.data as { message?: string })?.message;
        const status = err.response?.status;
        if (status === 409) {
          setErrorMessage(
            serverMsg || 'Slot is currently HELD or RESERVED and cannot be marked as walk-in.'
          );
        } else {
          setErrorMessage(serverMsg || 'Failed to update slot status. Please try again.');
        }
      } else {
        setErrorMessage('Failed to update slot status. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkin-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CarIcon className="w-5 h-5 text-indigo-700" />
            </div>
            <h2 id="walkin-dialog-title" className="text-base font-bold text-slate-900">
              Manage Slot {slot.slotNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isProtected ? (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900"
            >
              <AlertCircleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold">Protected Slot ({slot.status})</p>
                <p className="mt-0.5 text-amber-800">
                  This slot is associated with an active reservation. Walk-in cars cannot override customer bookings.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-700 leading-relaxed">
              {isAvailable ? (
                <p>
                  Mark slot <strong className="text-slate-900 font-bold">{slot.slotNumber}</strong> as{' '}
                  <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">OCCUPIED</span> for a drive-up / walk-in customer?
                </p>
              ) : (
                <p>
                  Release slot <strong className="text-slate-900 font-bold">{slot.slotNumber}</strong> back to{' '}
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">AVAILABLE</span>?
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs"
            >
              <AlertCircleIcon className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action buttons with large touch targets >= 48px */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={onClose}
              className="min-h-[48px] h-12 w-full font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </Button>
            {!isProtected && (
              <Button
                type="button"
                disabled={isLoading}
                isLoading={isLoading}
                onClick={handleConfirm}
                className={`min-h-[48px] h-12 w-full font-bold text-white shadow-sm rounded-xl ${
                  isAvailable
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                }`}
              >
                {isAvailable ? 'Confirm Occupied' : 'Confirm Free'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

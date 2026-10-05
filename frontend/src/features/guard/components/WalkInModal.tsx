import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { GuardBoardSlot } from '../../../types/contract';
import { Button } from '../../../components/common/Button';
import { Car, AlertCircle, X } from 'lucide-react';

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
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border-2 border-slate-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-indigo-700" />
            <h2 id="walkin-dialog-title" className="text-base font-bold text-slate-900">
              Manage Slot {slot.slotNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {isProtected ? (
            <div
              role="alert"
              className="flex items-start gap-3 p-3 bg-amber-50 border-2 border-amber-400 rounded-lg text-amber-900"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Protected Slot ({slot.status})</p>
                <p className="mt-0.5">
                  This slot is associated with an active reservation. Walk-in cars cannot override customer bookings.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-700">
              {isAvailable ? (
                <p>
                  Mark slot <strong className="text-slate-900">{slot.slotNumber}</strong> as{' '}
                  <span className="font-bold text-red-700">OCCUPIED</span> for a drive-up / walk-in customer?
                </p>
              ) : (
                <p>
                  Release slot <strong className="text-slate-900">{slot.slotNumber}</strong> back to{' '}
                  <span className="font-bold text-emerald-700">AVAILABLE</span>?
                </p>
              )}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 bg-red-50 border-2 border-red-400 rounded-lg text-red-900 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action buttons with large touch targets */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={onClose}
              className="h-12 w-full font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            {!isProtected && (
              <Button
                type="button"
                disabled={isLoading}
                isLoading={isLoading}
                onClick={handleConfirm}
                className={`h-12 w-full font-bold text-white shadow-sm ${
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

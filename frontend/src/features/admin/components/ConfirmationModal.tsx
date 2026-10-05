import React from 'react';
import { Button } from '../../../components/common/Button';
import { AlertTriangleIcon, XIcon } from '../../../components/common/icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDestructive ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
              <AlertTriangleIcon className={`w-5 h-5 ${isDestructive ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
            <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close confirmation dialog"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">{message}</p>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={onCancel}
              className="h-11 w-full font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              isLoading={isLoading}
              onClick={onConfirm}
              className={`h-11 w-full font-bold text-white shadow-sm rounded-xl ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
              }`}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

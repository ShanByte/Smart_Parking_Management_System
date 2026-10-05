import React from 'react';
import { Button } from '../../../components/common/Button';
import { AlertTriangle, X } from 'lucide-react';

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
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border-2 border-slate-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isDestructive ? 'text-red-600' : 'text-amber-600'}`} />
            <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"
            aria-label="Close confirmation dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">{message}</p>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={onCancel}
              className="h-11 w-full font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              isLoading={isLoading}
              onClick={onConfirm}
              className={`h-11 w-full font-bold text-white shadow-sm ${
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

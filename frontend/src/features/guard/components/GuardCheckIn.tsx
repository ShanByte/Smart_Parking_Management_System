import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldIcon,
  QrCodeIcon,
} from '../../../components/common/icons';

interface GuardCheckInProps {
  onCheckInSuccess: () => void;
}

export const GuardCheckIn: React.FC<GuardCheckInProps> = ({ onCheckInSuccess }) => {
  const [bookingCode, setBookingCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    code: string;
    slotId: string;
    vehicleNumber: string | null;
    checkedInAt: string;
  } | null>(null);

  const cleanCodeInput = (text: string) => {
    return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanCodeInput(e.target.value);
    setBookingCode(cleaned);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleaned = cleanCodeInput(pastedText);
    setBookingCode(cleaned);
    if (errorMessage) setErrorMessage(null);
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingCode.length !== 6) {
      setErrorMessage('Booking code must be exactly 6 characters');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      const response = await api.post('/guard/check-in', { bookingCode });
      const bookingData = response.data?.data;

      setSuccessInfo({
        code: bookingCode,
        slotId: bookingData?.slotId || 'Assigned',
        vehicleNumber: bookingData?.vehicleNumber || null,
        checkedInAt: bookingData?.checkedInAt || new Date().toISOString(),
      });
      setBookingCode('');
      onCheckInSuccess();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data as { message?: string } | undefined;
        const serverMsg = data?.message;

        if (status === 404) {
          setErrorMessage('Booking code not found or belongs to another parking lot.');
        } else if (status === 409) {
          setErrorMessage(
            serverMsg || 'Booking is not eligible for check-in (e.g. already checked in, cancelled, or expired).'
          );
        } else if (status === 429) {
          setErrorMessage('Too many check-in attempts. Please wait 1 minute before trying again.');
        } else if (serverMsg) {
          setErrorMessage(serverMsg);
        } else {
          setErrorMessage('Failed to verify booking code. Please try again.');
        }
      } else {
        setErrorMessage('Failed to verify booking code. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-200 py-3.5 px-4 sm:px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-2xs">
              <QrCodeIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                Gate Check-In
              </CardTitle>
              <p className="text-xs text-slate-500">
                Enter driver's 6-character booking code to grant entry
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <ShieldIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Driver Privacy Protected</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={handleCheckIn} className="space-y-4">
          <div>
            <label
              htmlFor="guard-booking-code"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Booking Code (6 Characters)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="guard-booking-code"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                maxLength={12}
                value={bookingCode}
                onChange={handleInputChange}
                onPaste={handlePaste}
                placeholder="e.g. KP4M9X"
                aria-label="Booking Code"
                className="flex-1 min-h-[48px] h-12 px-4 text-lg font-mono tracking-widest text-center sm:text-left font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
              />
              <Button
                type="submit"
                disabled={isLoading || bookingCode.length !== 6}
                isLoading={isLoading}
                className="min-h-[48px] h-12 px-6 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
              >
                Verify & Check In
              </Button>
            </div>
          </div>

          {/* Success Message Banner */}
          {successInfo && (
            <div
              role="alert"
              className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 shadow-2xs"
            >
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-emerald-950">
                  Check-in Confirmed: Code {successInfo.code}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-emerald-800">
                  {successInfo.vehicleNumber && (
                    <span>
                      Vehicle: <strong>{successInfo.vehicleNumber}</strong>
                    </span>
                  )}
                  <span>
                    Time: {new Date(successInfo.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl text-red-900 shadow-2xs"
            >
              <AlertCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-red-950">Check-in Rejected</p>
                <p className="text-xs text-red-800 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

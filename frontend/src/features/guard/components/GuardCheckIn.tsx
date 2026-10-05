import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { CheckCircle2, AlertCircle, Shield, QrCode } from 'lucide-react';

interface GuardCheckInProps {
  onCheckInSuccess: () => void;
}

// C3 Crockford base32 alphabet: 0-9, A-Z excluding I, L, O, U
const CROCKFORD_CHARS = /^[0-9A-HJKMNP-TV-Z]*$/;

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase and sanitize input
    const val = e.target.value.toUpperCase().trim();
    if (val.length <= 6 && CROCKFORD_CHARS.test(val)) {
      setBookingCode(val);
      if (errorMessage) setErrorMessage(null);
    }
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
    <Card className="border-2 border-slate-300 shadow-sm bg-white">
      <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-bold">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Gate Check-In
              </CardTitle>
              <p className="text-xs text-slate-600">
                Enter driver's 6-character booking code to grant entry
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-1 rounded">
            <Shield className="w-3.5 h-3.5" />
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
                maxLength={6}
                value={bookingCode}
                onChange={handleInputChange}
                placeholder="e.g. KP4M9X"
                aria-label="Booking Code"
                className="flex-1 px-4 py-3 text-lg font-mono tracking-widest text-center sm:text-left font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
              />
              <Button
                type="submit"
                disabled={isLoading || bookingCode.length !== 6}
                isLoading={isLoading}
                className="h-12 px-6 text-base font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm"
              >
                Verify & Check In
              </Button>
            </div>
          </div>

          {/* Success Message Banner */}
          {successInfo && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 bg-emerald-50 border-2 border-emerald-500 rounded-lg text-emerald-900"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
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
              className="flex items-start gap-3 p-3.5 bg-red-50 border-2 border-red-500 rounded-lg text-red-900"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
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

import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { ParkingLot, SlotSource } from '../../../types/contract';
import { DeviceView } from '../types';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { ConfirmationModal } from './ConfirmationModal';
import {
  CpuIcon,
  PlusIcon,
  RadioIcon,
  Trash2Icon,
  CopyIcon,
  CheckIcon,
  AlertCircleIcon,
  XIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
} from '../../../components/common/icons';

interface DevicesManagementProps {
  devices: DeviceView[];
  lots: ParkingLot[];
  onRefresh: () => void;
}

export const DevicesManagement: React.FC<DevicesManagementProps> = ({
  devices,
  lots,
  onRefresh,
}) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [deviceToRevoke, setDeviceToRevoke] = useState<DeviceView | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [kind, setKind] = useState<SlotSource>('SENSOR');
  const [lotId, setLotId] = useState<string>('');

  // Single-view raw key state
  const [createdKeyInfo, setCreatedKeyInfo] = useState<{
    name: string;
    rawKey: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.post('/admin/devices', {
        name: name.trim(),
        kind,
        parkingLotId: lotId ? lotId : undefined,
      });

      const data = response.data?.data;
      const rawKey = data?.rawKey;

      if (rawKey) {
        setCreatedKeyInfo({
          name: name.trim(),
          rawKey,
        });
      }

      setSuccessMessage(`Device "${name}" created successfully.`);
      setIsRegisterOpen(false);
      setName('');
      setLotId('');
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to register device.'
        );
      } else {
        setErrorMessage('Failed to register device.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeDevice = async () => {
    if (!deviceToRevoke) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.delete(`/admin/devices/${deviceToRevoke.id}`);
      setSuccessMessage(`Device "${deviceToRevoke.name}" has been revoked.`);
      setDeviceToRevoke(null);
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to revoke device.'
        );
      } else {
        setErrorMessage('Failed to revoke device.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (!createdKeyInfo) return;
    navigator.clipboard.writeText(createdKeyInfo.rawKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Hardware & Simulation Devices
          </h2>
          <p className="text-xs text-slate-500">
            Issue cryptographically secure device keys for physical gate sensors and simulators
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setIsRegisterOpen(true);
          }}
          className="h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm"
        >
          <PlusIcon className="w-3.5 h-3.5 mr-1.5" />
          Register Device
        </Button>
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-medium flex items-center justify-between"
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 p-1"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SINGLE-VIEW RAW KEY PRESENTATION BANNER */}
      {createdKeyInfo && (
        <div
          role="alert"
          className="p-5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-md space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <KeyRoundIcon className="w-5 h-5 text-amber-700" />
              <h3 className="font-extrabold text-amber-950 text-sm">
                Device Secret Key Generated: {createdKeyInfo.name}
              </h3>
            </div>
            <button
              onClick={() => setCreatedKeyInfo(null)}
              className="text-amber-800 hover:text-amber-950 text-xs font-bold px-2 py-1 rounded hover:bg-amber-100 transition-colors"
            >
              Dismiss
            </button>
          </div>

          <p className="text-xs text-amber-900 font-medium">
            Copy this key now. It is displayed <strong>exactly once</strong> and will never be shown again:
          </p>

          <div className="flex items-center gap-2 p-2.5 bg-white border border-amber-300 rounded-xl">
            <input
              type="text"
              readOnly
              value={createdKeyInfo.rawKey}
              className="w-full font-mono text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
            />
            <Button
              type="button"
              onClick={handleCopyKey}
              className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0 rounded-lg"
            >
              {isCopied ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 mr-1" /> Copied
                </>
              ) : (
                <>
                  <CopyIcon className="w-3.5 h-3.5 mr-1" /> Copy Key
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Devices Table with Sticky Header */}
      {devices.length === 0 ? (
        <Card className="border border-dashed border-slate-300 p-8 text-center bg-slate-50 rounded-2xl">
          <CpuIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No devices registered</p>
          <p className="text-xs text-slate-500 mt-1">
            Register hardware gate sensors or simulator devices above.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] z-10 shadow-sm">
              <tr>
                <th className="py-3.5 px-4">Device Name</th>
                <th className="py-3.5 px-4">Kind</th>
                <th className="py-3.5 px-4">Associated Lot</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((d) => {
                const assignedLot = lots.find((l) => l.id === d.parkingLotId);
                const isRevoked = !d.isActive || d.revokedAt !== null;

                return (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {d.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-300">
                        {d.kind === 'SENSOR' ? <RadioIcon className="w-3 h-3 text-purple-600" /> : <CpuIcon className="w-3 h-3 text-blue-600" />}
                        {d.kind}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {assignedLot?.name || d.parkingLotId || 'Global / Any Lot'}
                    </td>
                    <td className="py-3.5 px-4">
                      {isRevoked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 px-2.5 py-0.5 rounded-lg border border-red-300">
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                          <ShieldCheckIcon className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!isRevoked && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDeviceToRevoke(d)}
                          className="h-8 px-2.5 text-[11px] font-bold border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2Icon className="w-3 h-3 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Device Modal */}
      {isRegisterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Register Device</h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close dialog"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterDevice} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Device Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Entry Gate Camera 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Device Kind
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as SlotSource)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold"
                >
                  <option value="SENSOR">SENSOR (Physical Camera / Ultrasonic)</option>
                  <option value="SIM">SIM (Synthetic Traffic Simulator)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Assigned Lot (Optional)
                </label>
                <select
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Global / Unrestricted</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegisterOpen(false)}
                  className="w-full rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  isLoading={isLoading}
                  onClick={handleRegisterDevice}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                >
                  Issue Key
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Device Confirmation */}
      <ConfirmationModal
        isOpen={!!deviceToRevoke}
        title="Revoke Device Credentials"
        message={`Are you sure you want to permanently revoke credentials for "${deviceToRevoke?.name}"? All future sensor events sent with this device key will be rejected.`}
        confirmLabel="Revoke Device"
        isDestructive={true}
        isLoading={isLoading}
        onConfirm={handleRevokeDevice}
        onCancel={() => setDeviceToRevoke(null)}
      />
    </div>
  );
};

import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { ParkingLot } from '../../../types/contract';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import { ConfirmationModal } from './ConfirmationModal';
import {
  Building2,
  Plus,
  Layers,
  Trash2,
  Unlock,
  AlertCircle,
  X,
  MapPin,
  IndianRupee,
} from 'lucide-react';

interface LotsManagementProps {
  lots: ParkingLot[];
  onRefresh: () => void;
}

export const LotsManagement: React.FC<LotsManagementProps> = ({
  lots,
  onRefresh,
}) => {
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState<boolean>(false);
  const [isReleaseOpen, setIsReleaseOpen] = useState<boolean>(false);
  const [lotToDeactivate, setLotToDeactivate] = useState<ParkingLot | null>(null);
  const [selectedLotForGenerate, setSelectedLotForGenerate] = useState<ParkingLot | null>(null);

  // Form states
  const [newLotName, setNewLotName] = useState<string>('');
  const [newLotAddress, setNewLotAddress] = useState<string>('');
  const [newLotLat, setNewLotLat] = useState<string>('18.5204');
  const [newLotLng, setNewLotLng] = useState<string>('73.8567');
  const [newLotTotalSlots, setNewLotTotalSlots] = useState<number>(20);
  const [newLotPriceRupees, setNewLotPriceRupees] = useState<number>(40);

  const [generateCount, setGenerateCount] = useState<number>(10);
  const [slotIdToRelease, setSlotIdToRelease] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Create Lot
  const handleCreateLot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.post('/admin/lots', {
        name: newLotName.trim(),
        address: newLotAddress.trim(),
        latitude: parseFloat(newLotLat),
        longitude: parseFloat(newLotLng),
        totalSlots: Number(newLotTotalSlots),
        pricePerHourPaise: Math.round(Number(newLotPriceRupees) * 100),
      });

      setSuccessMessage(`Parking lot "${newLotName}" created successfully!`);
      setIsCreateOpen(false);
      setNewLotName('');
      setNewLotAddress('');
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to create lot.'
        );
      } else {
        setErrorMessage('Failed to create lot.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Generate Slots
  const handleGenerateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLotForGenerate) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.post(`/admin/lots/${selectedLotForGenerate.id}/generate-slots`, {
        count: Number(generateCount),
      });

      setSuccessMessage(
        `Generated ${generateCount} slots for lot "${selectedLotForGenerate.name}".`
      );
      setIsGenerateOpen(false);
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to generate slots.'
        );
      } else {
        setErrorMessage('Failed to generate slots.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Deactivate Lot
  const handleConfirmDeactivate = async () => {
    if (!lotToDeactivate) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.delete(`/admin/lots/${lotToDeactivate.id}`);
      setSuccessMessage(`Lot "${lotToDeactivate.name}" deactivated.`);
      setLotToDeactivate(null);
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to deactivate lot.'
        );
      } else {
        setErrorMessage('Failed to deactivate lot.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Release Stuck Slot
  const handleReleaseSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotIdToRelease.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.put(`/admin/slots/${slotIdToRelease.trim()}/release`);
      setSuccessMessage(`Slot ${slotIdToRelease} released back to AVAILABLE.`);
      setSlotIdToRelease('');
      setIsReleaseOpen(false);
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to release slot.'
        );
      } else {
        setErrorMessage('Failed to release slot.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Actions & Messages */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Parking Lots & Slots Management
          </h2>
          <p className="text-xs text-slate-500">
            Configure locations, capacity, pricing, and slot generation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setErrorMessage(null);
              setIsReleaseOpen(true);
            }}
            className="h-10 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Unlock className="w-3.5 h-3.5 mr-1 text-slate-600" />
            Release Slot
          </Button>
          <Button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setIsCreateOpen(true);
            }}
            className="h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Parking Lot
          </Button>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-medium flex items-center justify-between"
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-900 text-xs font-medium flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lots Grid / Table */}
      {lots.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No parking lots configured</p>
          <p className="text-xs text-slate-500 mt-1">
            Click "Create Parking Lot" above to create your first lot.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lots.map((lot) => (
            <Card
              key={lot.id}
              className="border-2 border-slate-200 hover:border-slate-300 transition-all bg-white shadow-sm flex flex-col justify-between"
            >
              <CardHeader className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    {lot.name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lot.address}</span>
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                  {lot.id}
                </span>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Capacity</span>
                    <strong className="text-base text-slate-900">{lot.totalSlots} Slots</strong>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Rate</span>
                    <strong className="text-base text-slate-900 flex items-center">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {(lot.pricePerHourPaise / 100).toFixed(0)}/hr
                    </strong>
                  </div>
                </div>

                {/* Lot Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedLotForGenerate(lot);
                      setIsGenerateOpen(true);
                    }}
                    className="h-9 px-3 text-xs font-bold border-slate-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    Generate Slots
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLotToDeactivate(lot)}
                    className="h-9 px-3 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 1. Create Lot Modal */}
      {isCreateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border-2 border-slate-300 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-100 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">Create New Parking Lot</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLot} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Lot Name
                </label>
                <input
                  type="text"
                  required
                  value={newLotName}
                  onChange={(e) => setNewLotName(e.target.value)}
                  placeholder="e.g. Pune Central Mall Parking"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Address
                </label>
                <input
                  type="text"
                  required
                  value={newLotAddress}
                  onChange={(e) => setNewLotAddress(e.target.value)}
                  placeholder="e.g. Shivaji Nagar, Pune"
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLotLat}
                    onChange={(e) => setNewLotLat(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLotLng}
                    onChange={(e) => setNewLotLng(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Total Slots
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newLotTotalSlots}
                    onChange={(e) => setNewLotTotalSlots(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Rate (₹/hour)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newLotPriceRupees}
                    onChange={(e) => setNewLotPriceRupees(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  isLoading={isLoading}
                  className="w-full bg-indigo-600 text-white font-bold"
                >
                  Create Lot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Generate Slots Modal */}
      {isGenerateOpen && selectedLotForGenerate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border-2 border-slate-300 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-100 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">
                Generate Slots: {selectedLotForGenerate.name}
              </h3>
              <button
                onClick={() => setIsGenerateOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGenerateSlots} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Number of Slots to Generate
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="flex gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGenerateOpen(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  isLoading={isLoading}
                  className="w-full bg-indigo-600 text-white font-bold"
                >
                  Generate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Release Stuck Slot Modal */}
      {isReleaseOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border-2 border-slate-300 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-100 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">Release Stuck Slot</h3>
              <button
                onClick={() => setIsReleaseOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReleaseSlot} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Slot ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. slot-1-1"
                  value={slotIdToRelease}
                  onChange={(e) => setSlotIdToRelease(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Forces slot back to AVAILABLE if stuck in HELD or RESERVED.
                </p>
              </div>
              <div className="flex gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReleaseOpen(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !slotIdToRelease.trim()}
                  isLoading={isLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  Release Slot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Deactivate Lot Confirmation */}
      <ConfirmationModal
        isOpen={!!lotToDeactivate}
        title="Deactivate Parking Lot"
        message={`Are you sure you want to deactivate "${lotToDeactivate?.name}"? Drivers will no longer be able to book slots in this lot.`}
        confirmLabel="Deactivate Lot"
        isDestructive={true}
        isLoading={isLoading}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setLotToDeactivate(null)}
      />
    </div>
  );
};

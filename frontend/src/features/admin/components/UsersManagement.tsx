import React, { useState } from 'react';
import axios from 'axios';
import { api } from '../../../services/api';
import { ParkingLot, Role } from '../../../types/contract';
import { UserView } from '../types';
import { Card } from '../../../components/common/Card';
import { Button } from '../../../components/common/Button';
import {
  Users,
  Shield,
  UserCheck,
  User,
  AlertCircle,
  X,
  MapPin,
  Edit2,
} from 'lucide-react';

interface UsersManagementProps {
  users: UserView[];
  lots: ParkingLot[];
  onRefresh: () => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({
  users,
  lots,
  onRefresh,
}) => {
  const [selectedUser, setSelectedUser] = useState<UserView | null>(null);
  const [newRole, setNewRole] = useState<Role>('USER');
  const [assignedLotId, setAssignedLotId] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openRoleModal = (user: UserView) => {
    setSelectedUser(user);
    setNewRole(user.role as Role);
    setAssignedLotId(user.assignedLotId || (lots.length > 0 ? lots[0].id : ''));
    setErrorMessage(null);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (newRole === 'GUARD' && !assignedLotId) {
      setErrorMessage('Assigned Parking Lot is required when role is set to GUARD.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await api.put(`/admin/users/${selectedUser.id}/role`, {
        role: newRole,
        assignedLotId: newRole === 'GUARD' ? assignedLotId : null,
      });

      setSuccessMessage(
        `Role for "${selectedUser.name}" successfully updated to ${newRole}.`
      );
      setSelectedUser(null);
      onRefresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(
          (err.response?.data as { message?: string })?.message || 'Failed to update user role.'
        );
      } else {
        setErrorMessage('Failed to update user role.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-900 bg-red-100 border border-red-300 px-2 py-0.5 rounded">
            <Shield className="w-3 h-3 text-red-700" /> Admin
          </span>
        );
      case 'GUARD':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-900 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded">
            <UserCheck className="w-3 h-3 text-indigo-700" /> Guard
          </span>
        );
      case 'USER':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
            <User className="w-3 h-3 text-slate-600" /> Driver
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            User Accounts & Roles
          </h2>
          <p className="text-xs text-slate-500">
            Manage user roles and assign gate guards to specific parking locations
          </p>
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

      {/* Users Table */}
      {users.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No users found</p>
        </Card>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Assigned Lot</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const assignedLot = lots.find((l) => l.id === u.assignedLotId);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {u.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {u.email}
                    </td>
                    <td className="py-3 px-4">
                      {getRoleBadge(u.role)}
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'GUARD' ? (
                        u.assignedLotId ? (
                          <span className="flex items-center gap-1 font-semibold text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                            {assignedLot?.name || u.assignedLotId}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Unassigned
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openRoleModal(u)}
                        className="h-8 px-2.5 text-[11px] font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Change Role
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Change Modal */}
      {selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border-2 border-slate-300 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-100 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">
                Update Role: {selectedUser.name}
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateRole} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 font-semibold"
                >
                  <option value="USER">USER (Customer / Driver)</option>
                  <option value="GUARD">GUARD (Gate Operator)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                </select>
              </div>

              {/* Guard Assignment Field (Strict requirement when role is GUARD) */}
              {newRole === 'GUARD' && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-1.5">
                  <label className="block text-xs font-bold text-indigo-900 uppercase">
                    Assigned Parking Lot *
                  </label>
                  <select
                    required
                    value={assignedLotId}
                    onChange={(e) => setAssignedLotId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-indigo-300 bg-white rounded-lg focus:outline-none focus:border-indigo-600 font-medium"
                  >
                    <option value="" disabled>Select a parking lot...</option>
                    {lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-indigo-800">
                    Guards are restricted to viewing and checking in bookings for their assigned lot.
                  </p>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
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
                  Save Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { User as UserIcon, Shield, Mail, LogOut, CheckCircle2 } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-4 pb-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
            {user.name.charAt(0)}
          </div>
          <div>
            <CardTitle>{user.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                {user.role}
              </span>
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Account
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Email Address
              </span>
              <span className="font-medium text-slate-800">{user.email}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5" />
                User ID
              </span>
              <span className="font-mono text-xs text-slate-600">{user.id}</span>
            </div>

            {user.assignedLotId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Assigned Lot ID (Guard)
                </span>
                <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                  {user.assignedLotId}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full text-red-600 hover:bg-red-50 border-red-200"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out of Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

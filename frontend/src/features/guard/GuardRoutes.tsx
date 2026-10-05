import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Shield } from 'lucide-react';

/**
 * GuardRoutes Mount Point (Owned by Member 1 per C9)
 * Mounted by Member 3 at /guard/*
 */
const GuardRoutes: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card className="border-indigo-100 bg-indigo-50/30">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Guard Console Mount Point</CardTitle>
            <p className="text-xs text-slate-500">
              Reserved for Member 1 implementation (Live Board, Check-in, Walk-ins)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-sm font-semibold text-slate-800">
              Live Guard Board Ready for Member 1
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Provides GET /guard/lots/:lotId/board, POST /guard/check-in, POST /guard/slots/:slotId/walk-in
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GuardRoutes;

import React from 'react';
import { AuditLogView as AuditLogItem } from '../types';
import { Card } from '../../../components/common/Card';
import { HistoryIcon } from '../../../components/common/icons';

interface AuditLogViewProps {
  logs: AuditLogItem[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const getActionBadge = (action: string) => {
    let color = 'bg-slate-100 text-slate-800 border-slate-300';
    if (action.includes('CREATE')) {
      color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (action.includes('DELETE') || action.includes('REVOKE')) {
      color = 'bg-red-100 text-red-800 border-red-300';
    } else if (action.includes('UPDATE') || action.includes('ROLE')) {
      color = 'bg-indigo-100 text-indigo-800 border-indigo-300';
    } else if (action.includes('RELEASE')) {
      color = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return (
      <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded border ${color}`}>
        {action}
      </span>
    );
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            System Security Audit Log
          </h2>
          <p className="text-xs text-slate-500">
            Immutable chronological record of all administrative actions and security mutations
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card className="border border-dashed border-slate-300 p-8 text-center bg-slate-50 rounded-2xl">
          <HistoryIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No audit logs recorded yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Administrative mutations will automatically generate audit entries here.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] z-10 shadow-sm">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Admin ID</th>
                <th className="py-3.5 px-4">Target Type</th>
                <th className="py-3.5 px-4">Target ID</th>
                <th className="py-3.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 text-slate-600 font-sans text-xs whitespace-nowrap">
                    {formatTimestamp(log.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    {getActionBadge(log.action)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-bold">
                    {log.adminId}
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 font-semibold font-sans text-xs">
                    {log.targetType}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {log.targetId || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={JSON.stringify(log.details)}>
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Card, EmptyState, ErrorBanner, SkeletonRows, StatusBadge } from '@/components/ui';
import { apiFetch, ApiError } from '@/lib/api';

interface AuditRow {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  moduleCode: string | null;
  status: string;
  ipAddress: string | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setError(null);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch<{ items: AuditRow[]; total: number }>(`/audit-logs${q}`);
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Security & Administrative Audit Logs</h1>
            <p className="text-sm text-[#96A8C5]">
              Immutable record of authentication, RBAC changes, forensic access, scans, and exports ({total} total).
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, action, resource..."
            className="w-full max-w-xs rounded-xl border border-[#1B335E] bg-[#0B1730] px-3.5 py-2 text-xs text-white outline-none focus:border-[#00D4FF]"
          />
        </div>

        {error ? <ErrorBanner message={error} onRetry={loadLogs} /> : null}

        {loading ? (
          <SkeletonRows rows={6} />
        ) : logs.length === 0 ? (
          <EmptyState title="No Audit Entries Found" description="No audit log entries match this filter." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-[#1B335E] text-[#96A8C5] uppercase">
                <tr>
                  <th className="pb-3 font-semibold">Timestamp</th>
                  <th className="pb-3 font-semibold">Actor</th>
                  <th className="pb-3 font-semibold">Action</th>
                  <th className="pb-3 font-semibold">Module / Resource</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B335E]/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0B1730]/45">
                    <td className="py-3 text-[#96A8C5]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 font-medium text-white">{log.actorEmail || 'SYSTEM'}</td>
                    <td className="py-3 font-mono text-[#00D4FF]">{log.action}</td>
                    <td className="py-3 text-[#D8E4F8]">
                      {log.moduleCode || 'CORE'} • {log.resourceType}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 font-mono text-[#96A8C5]">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

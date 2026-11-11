'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { ROLE_CODES } from '@sis/shared-contracts';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: Array<{ code: string; name: string }>;
  deviceCount: number;
  sessionCount: number;
}

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await apiFetch<UserRow[]>(`/users${q}`);
      setUsers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, roleCode: string) => {
    try {
      await apiFetch(`/users/${userId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roleCodes: [roleCode] }),
      });
      setToast({ type: 'success', message: `User role updated to ${roleCode}.` });
      await loadUsers();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Role update failed.' });
    }
  };

  const handleStatusToggle = async (u: UserRow) => {
    const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiFetch(`/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setToast({ type: 'success', message: `Account ${u.email} marked ${nextStatus}.` });
      await loadUsers();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Status update failed.' });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">User & Role Governance</h1>
            <p className="text-sm text-[#96A8C5]">
              Server-enforced RBAC accounts, MFA posture, and status lifecycle.
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or email..."
            className="w-full max-w-xs rounded-xl border border-[#1B335E] bg-[#0B1730] px-3.5 py-2 text-xs text-white outline-none focus:border-[#00D4FF]"
          />
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadUsers} /> : null}

        {loading ? (
          <SkeletonRows rows={5} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-[#1B335E] text-[#96A8C5] uppercase">
                <tr>
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Assigned Role</th>
                  <th className="pb-3 font-semibold">MFA</th>
                  <th className="pb-3 font-semibold">Devices / Sessions</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 text-right font-semibold">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B335E]/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#0B1730]/50">
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Users className="h-4 w-4 text-[#00D4FF]" />
                        <div>
                          <div className="font-semibold text-white">{u.fullName}</div>
                          <div className="text-[11px] text-[#96A8C5]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      {hasPermission('roles:manage') ? (
                        <select
                          value={u.roles[0]?.code || 'REGULAR_USER'}
                          onChange={(e) => void handleRoleChange(u.id, e.target.value)}
                          className="rounded-lg border border-[#1B335E] bg-[#050B18] px-2.5 py-1.5 text-xs text-white"
                        >
                          {ROLE_CODES.map((rc) => (
                            <option key={rc} value={rc}>
                              {rc}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-semibold text-[#00D4FF]">
                          {u.roles.map((r) => r.code).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${
                          u.mfaEnabled ? 'text-[#00D69A]' : 'text-[#FFB547]'
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {u.mfaEnabled ? 'Enabled' : 'Not Set'}
                      </span>
                    </td>
                    <td className="py-3.5 text-[#D8E4F8]">
                      {u.deviceCount} device(s) • {u.sessionCount} session(s)
                    </td>
                    <td className="py-3.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3.5 text-right">
                      {hasPermission('users:manage') ? (
                        <button
                          type="button"
                          onClick={() => void handleStatusToggle(u)}
                          className="rounded-lg border border-[#1B335E] bg-[#0B1730] px-3 py-1 text-xs font-semibold text-[#D8E4F8] hover:border-[#00D4FF]"
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      ) : null}
                    </td>
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

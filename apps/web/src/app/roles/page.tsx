'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SkeletonRows } from '@/components/ui';
import { apiFetch, ApiError } from '@/lib/api';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string;
  userCount: number;
  permissions: string[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<RoleRow[]>('/roles');
      setRoles(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load RBAC roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">RBAC Roles & Permission Matrix</h1>
          <p className="text-sm text-[#96A8C5]">
            Backend-enforced least-privilege capabilities across all 5 enterprise roles.
          </p>
        </div>

        {error ? <ErrorBanner message={error} onRetry={loadRoles} /> : null}

        {loading ? (
          <SkeletonRows rows={5} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {roles.map((r) => (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="h-5 w-5 text-[#00D4FF]" />
                    <div>
                      <h2 className="text-base font-bold text-white">{r.name}</h2>
                      <p className="text-xs font-mono text-[#00D4FF]">{r.code}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#10213F] px-3 py-1 text-xs font-semibold text-[#D8E4F8]">
                    {r.userCount} user(s)
                  </span>
                </div>
                <p className="text-xs text-[#96A8C5]">{r.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {r.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-lg border border-[#1B335E] bg-[#050B18] px-2 py-0.5 font-mono text-[11px] text-[#96A8C5]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Power, Shield } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';

interface ModuleItem {
  id: string;
  code: string;
  slug: string;
  number: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  platformSupport: string;
  isEnabled: boolean;
  healthStatus: string;
  postureScore: number;
  openAlertCount: number;
}

export default function ModulesPage() {
  const { hasPermission } = useAuth();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const loadModules = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<ModuleItem[]>('/modules');
      setModules(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load modules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModules();
  }, [loadModules]);

  const handleToggle = async (mod: ModuleItem) => {
    try {
      await apiFetch(`/modules/${mod.slug}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !mod.isEnabled }),
      });
      setToast({
        type: 'success',
        message: `${mod.shortName} ${!mod.isEnabled ? 'enabled' : 'disabled'}.`,
      });
      await loadModules();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Unable to toggle module.',
      });
    }
  };

  const filtered =
    categoryFilter === 'ALL'
      ? modules
      : modules.filter((m) => m.category === categoryFilter);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">12 Security Modules Hub</h1>
            <p className="text-sm text-[#96A8C5]">
              Unified defensive capabilities across identity, endpoints, web assets, vault, backups, and SOC.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['ALL', 'IDENTITY', 'ENDPOINT', 'NETWORK', 'DATA', 'WEB', 'OPERATIONS'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  categoryFilter === cat
                    ? 'bg-[#087BFF] text-white'
                    : 'border border-[#1B335E] bg-[#0B1730] text-[#96A8C5] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadModules} /> : null}

        {loading ? (
          <SkeletonRows rows={6} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((mod) => (
              <Card key={mod.id} className="flex flex-col justify-between sis-glass-hover">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#087BFF]/15 text-xs font-bold text-[#00D4FF] border border-[#00D4FF]/30">
                        {mod.number}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">{mod.name}</h2>
                        <span className="text-[11px] uppercase tracking-wider text-[#96A8C5]">
                          {mod.category} • {mod.platformSupport.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={mod.healthStatus} />
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[#96A8C5]">{mod.description}</p>
                </div>

                <div className="mt-5 border-t border-[#1B335E]/60 pt-4">
                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="text-[#96A8C5]">
                      Posture: <strong className="text-[#00D69A]">{mod.postureScore}%</strong>
                    </span>
                    <span className="text-[#96A8C5]">
                      Open Alerts: <strong className="text-white">{mod.openAlertCount}</strong>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/modules/${mod.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#087BFF]/20 border border-[#087BFF]/40 px-3.5 py-2 text-xs font-semibold text-[#6EB5FF] hover:bg-[#087BFF] hover:text-white"
                    >
                      <Shield className="h-3.5 w-3.5" /> Open Module
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    {hasPermission('modules:manage') ? (
                      <button
                        type="button"
                        onClick={() => void handleToggle(mod)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold ${
                          mod.isEnabled
                            ? 'border-[#FFB547]/40 bg-[#FFB547]/10 text-[#FFB547] hover:bg-[#FFB547]/20'
                            : 'border-[#00D69A]/40 bg-[#00D69A]/10 text-[#00D69A] hover:bg-[#00D69A]/20'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {mod.isEnabled ? 'Disable' : 'Enable'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

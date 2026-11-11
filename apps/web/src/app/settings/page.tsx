'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';

interface SettingsResponse {
  settings: Array<{ id: string; key: string; value: Record<string, unknown>; updatedAt: string }>;
  integrations: Array<{
    id: string;
    serviceKey: string;
    displayName: string;
    category: string;
    status: string;
    configured: boolean;
    details: string;
  }>;
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('soc.alertRetentionDays');
  const [jsonVal, setJsonVal] = useState('{"days": 90}');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<SettingsResponse>('/settings');
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(jsonVal) as Record<string, unknown>;
      await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: keyName, value: parsed }),
      });
      setToast({ type: 'success', message: `Setting "${keyName}" persisted.` });
      await loadSettings();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Provide valid JSON value.',
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">System Settings & Integration Posture</h1>
          <p className="text-sm text-[#96A8C5]">
            Platform configuration and honest status of optional external threat/push credentials.
          </p>
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadSettings} /> : null}

        {loading || !data ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="space-y-3">
              <h2 className="text-base font-semibold text-white">External Integrations Status</h2>
              {data.integrations.map((intg) => (
                <div
                  key={intg.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1B335E] bg-[#050B18] p-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{intg.displayName}</div>
                    <div className="text-[11px] text-[#96A8C5]">{intg.details}</div>
                  </div>
                  <StatusBadge status={intg.status} />
                </div>
              ))}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#00D4FF]" />
                <h2 className="text-base font-semibold text-white">Workspace Policy Parameters</h2>
              </div>

              {hasPermission('settings:manage') ? (
                <form onSubmit={handleSave} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2 text-xs font-mono text-white"
                  />
                  <textarea
                    rows={3}
                    required
                    value={jsonVal}
                    onChange={(e) => setJsonVal(e.target.value)}
                    className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2 text-xs font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Save Setting
                  </button>
                </form>
              ) : null}

              <div className="space-y-2 border-t border-[#1B335E] pt-3">
                {data.settings.length === 0 ? (
                  <p className="text-xs text-[#96A8C5]">Using secure defaults.</p>
                ) : (
                  data.settings.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-[#1B335E]/60 bg-[#0B1730] px-3 py-2 text-xs"
                    >
                      <div className="font-mono font-semibold text-[#00D4FF]">{s.key}</div>
                      <pre className="mt-1 overflow-x-auto text-[11px] text-[#D8E4F8]">
                        {JSON.stringify(s.value)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

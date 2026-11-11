'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Radar, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Card, SeverityBadge, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';

export function AccessGuardianPanel() {
  const { hasPermission } = useAuth();
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      clientType: string;
      deviceName: string;
      ipAddress: string | null;
      revokedAt: string | null;
      lastActivityAt: string;
      user?: { email: string; fullName: string };
    }>
  >([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    const endpoint = hasPermission('users:read') ? '/access-guardian/sessions' : '/auth/sessions';
    const res = await apiFetch<typeof sessions>(endpoint);
    setSessions(res);
  }, [hasPermission]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    try {
      const endpoint = hasPermission('users:manage')
        ? `/access-guardian/sessions/${id}`
        : `/auth/sessions/${id}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      setToast({ type: 'success', message: 'Session revoked immediately.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Revoke failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <div className="flex flex-wrap gap-3">
        {hasPermission('users:read') ? (
          <Link href="/users" className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
            Manage Users
          </Link>
        ) : null}
        {hasPermission('roles:read') ? (
          <Link href="/roles" className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-4 py-2 text-xs font-semibold text-[#00D4FF]">
            View RBAC Roles Matrix
          </Link>
        ) : null}
      </div>

      <Card className="overflow-x-auto">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <Users className="h-4 w-4 text-[#00D4FF]" /> Active & Historical Device Sessions
        </h3>
        <table className="w-full min-w-[660px] text-left text-xs">
          <thead className="border-b border-[#1B335E] text-[#96A8C5] uppercase">
            <tr>
              <th className="pb-2">User / Device</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">IP</th>
              <th className="pb-2">Last Active</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B335E]/40">
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 text-white">
                  {s.user ? `${s.user.email} — ` : ''}
                  {s.deviceName}
                </td>
                <td className="py-2.5 uppercase text-[#00D4FF]">{s.clientType}</td>
                <td className="py-2.5 font-mono text-[#96A8C5]">{s.ipAddress || '—'}</td>
                <td className="py-2.5 text-[#96A8C5]">{new Date(s.lastActivityAt).toLocaleString()}</td>
                <td className="py-2.5">
                  <StatusBadge status={s.revokedAt ? 'REVOKED' : 'ACTIVE'} />
                </td>
                <td className="py-2.5 text-right">
                  {!s.revokedAt ? (
                    <button
                      type="button"
                      onClick={() => void revoke(s.id)}
                      className="rounded-lg bg-[#FF4560]/15 px-2.5 py-1 text-[11px] font-semibold text-[#FF8A9B]"
                    >
                      Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function ThreatIntelPanel() {
  const { hasPermission } = useAuth();
  const [sources, setSources] = useState<{
    sources: Array<{ id: string; name: string; status: string; lastSyncedAt: string | null; recordCount: number }>;
    externalFeeds: Array<{ id: string; displayName: string; status: string; details: string }>;
  } | null>(null);
  const [indicators, setIndicators] = useState<
    Array<{
      id: string;
      indicatorType: string;
      value: string;
      threatCategory: string;
      severity: string;
      confidence: number;
      source: { name: string };
    }>
  >([]);
  const [search, setSearch] = useState('');
  const [indicatorType, setIndicatorType] = useState<'DOMAIN' | 'URL' | 'IP' | 'HASH'>('DOMAIN');
  const [value, setValue] = useState('');
  const [threatCategory, setThreatCategory] = useState('PHISHING');
  const [severity, setSeverity] = useState<'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const [s, iocs] = await Promise.all([
      apiFetch<NonNullable<typeof sources>>('/threats/sources'),
      apiFetch<typeof indicators>(`/threats/indicators${q}`),
    ]);
    setSources(s);
    setIndicators(iocs);
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const addIoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/threats/indicators', {
        method: 'POST',
        body: JSON.stringify({ indicatorType, value, threatCategory, severity, confidence: 90 }),
      });
      setValue('');
      setToast({ type: 'success', message: 'Threat IOC persisted and active in Phishing Shield.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed.' });
    }
  };

  const archiveIoc = async (id: string) => {
    await apiFetch(`/threats/indicators/${id}`, { method: 'DELETE' });
    await load();
  };

  if (!sources) return <SkeletonRows rows={4} />;

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="text-sm font-bold text-white">Local & Curated Threat Sources</h3>
          {sources.sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-[#050B18] p-3 text-xs">
              <div>
                <div className="font-semibold text-white">{s.name}</div>
                <div className="text-[11px] text-[#96A8C5]">
                  {s.recordCount} IOCs • Freshness: {s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : 'Never'}
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </Card>
        <Card className="space-y-2">
          <h3 className="text-sm font-bold text-white">External Feed Integrations</h3>
          {sources.externalFeeds.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-xl bg-[#050B18] p-3 text-xs">
              <div>
                <div className="font-semibold text-white">{f.displayName}</div>
                <div className="text-[11px] text-[#96A8C5]">{f.details}</div>
              </div>
              <StatusBadge status={f.status} />
            </div>
          ))}
        </Card>
      </div>

      {hasPermission('threats:manage') ? (
        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Radar className="h-4 w-4 text-[#00D4FF]" /> Add IOC Indicator (Domain, URL, IP, Hash)
          </h3>
          <form onSubmit={addIoc} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <select
              value={indicatorType}
              onChange={(e) => setIndicatorType(e.target.value as typeof indicatorType)}
              className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
            >
              <option value="DOMAIN">DOMAIN</option>
              <option value="URL">URL</option>
              <option value="IP">IP</option>
              <option value="HASH">HASH</option>
            </select>
            <input
              type="text"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Indicator value"
              className="sm:col-span-2 rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              required
              value={threatCategory}
              onChange={(e) => setThreatCategory(e.target.value)}
              placeholder="Category"
              className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
            />
            <div className="flex gap-2">
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as typeof severity)}
                className="flex-1 rounded-xl border border-[#1B335E] bg-[#050B18] px-2 py-2 text-xs text-white"
              >
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
              <button type="submit" className="rounded-xl bg-[#087BFF] px-3 py-2 text-xs font-semibold text-white">
                Add
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Active Indicators ({indicators.length})</h3>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IOC..."
            className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-1.5 text-xs text-white"
          />
        </div>
        <div className="space-y-2">
          {indicators.map((ioc) => (
            <div
              key={ioc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1B335E]/60 bg-[#050B18] px-3.5 py-2.5 text-xs"
            >
              <div>
                <span className="mr-2 rounded bg-[#087BFF]/20 px-2 py-0.5 font-mono text-[10px] text-[#00D4FF]">
                  {ioc.indicatorType}
                </span>
                <span className="font-mono text-white break-all">{ioc.value}</span>
                <div className="mt-1 text-[11px] text-[#96A8C5]">
                  {ioc.threatCategory} • Source: {ioc.source.name} • Confidence: {ioc.confidence}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={ioc.severity} />
                {hasPermission('threats:manage') ? (
                  <button type="button" onClick={() => void archiveIoc(ioc.id)} className="text-[#FF8A9B]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function DigitalForensicsShortcutPanel() {
  return (
    <Card className="space-y-3">
      <h3 className="text-base font-bold text-white">SIS Digital Forensics Workbench</h3>
      <p className="text-xs text-[#96A8C5]">
        Manage forensic cases, register SHA-256 sealed artifacts, log immutable chain-of-custody transfers, and perform audited dossier exports.
      </p>
      <Link href="/cases" className="inline-block rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
        Open Full Forensics Cases Console →
      </Link>
    </Card>
  );
}

export function CyberSocPanel() {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-[#00D4FF]">
        <ShieldCheck className="h-5 w-5" />
        <h3 className="text-base font-bold text-white">SIS Cyber SOC Command Shortcuts</h3>
      </div>
      <p className="text-xs text-[#96A8C5]">
        Cyber SOC correlates real-time events across all 11 other modules into unified alerts, incidents, forensic dossiers, audit logs, and compliance reports.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/alerts" className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
          Triage Security Alerts
        </Link>
        <Link href="/incidents" className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-4 py-2 text-xs font-semibold text-[#00D4FF]">
          Manage Incidents
        </Link>
        <Link href="/reports" className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-4 py-2 text-xs font-semibold text-[#00D69A]">
          Export SOC Reports (CSV / PDF)
        </Link>
        <Link href="/audit-logs" className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-4 py-2 text-xs font-semibold text-[#D8E4F8]">
          View Audit Trail
        </Link>
      </div>
    </Card>
  );
}

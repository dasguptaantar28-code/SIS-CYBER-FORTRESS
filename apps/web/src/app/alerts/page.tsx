'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Plus, ShieldAlert } from 'lucide-react';
import { SECURITY_MODULES } from '@sis/shared-contracts';
import { AppShell } from '@/components/AppShell';
import {
  Card,
  EmptyState,
  ErrorBanner,
  Modal,
  SeverityBadge,
  SkeletonRows,
  StatusBadge,
  ToastBanner,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  createdAt: string;
  module: { code: string; shortName: string; slug: string };
  device?: { deviceName: string } | null;
  asset?: { domain: string } | null;
}

export default function AlertsPage() {
  const { hasPermission } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [moduleCode, setModuleCode] = useState('CYBER_SOC');
  const [severity, setSeverity] = useState<'MEDIUM' | 'HIGH' | 'CRITICAL' | 'LOW'>('MEDIUM');

  const loadAlerts = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (severityFilter) params.set('severity', severityFilter);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const data = await apiFetch<AlertItem[]>(`/alerts?${params.toString()}`);
      setAlerts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiFetch(`/alerts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setToast({ type: 'success', message: `Alert transitioned to ${status}.` });
      await loadAlerts();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Update failed.' });
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      const inc = await apiFetch<{ incidentNumber: string }>(`/alerts/${id}/escalate`, {
        method: 'POST',
      });
      setToast({
        type: 'success',
        message: `Escalated to Cyber SOC Incident ${inc.incidentNumber}.`,
      });
      await loadAlerts();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Escalation failed.',
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/alerts', {
        method: 'POST',
        body: JSON.stringify({
          moduleCode,
          title,
          description,
          severity,
          category: 'SOC_ANALYST_ALERT',
        }),
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setToast({ type: 'success', message: 'Security alert created & dispatched to SOC.' });
      await loadAlerts();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Create failed.' });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Central Security Alerts</h1>
            <p className="text-sm text-[#96A8C5]">
              Correlated security events raised across all 12 SIS Cyber Fortress modules.
            </p>
          </div>
          {hasPermission('alerts:manage') ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Raise Alert
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-2 text-xs text-white"
          >
            <option value="">All Severities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-2 text-xs text-white"
          >
            <option value="">All Statuses</option>
            {['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadAlerts} /> : null}

        {loading ? (
          <SkeletonRows rows={5} />
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No Matching Security Alerts"
            description="No security alerts matched your current filter criteria."
          />
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#00D4FF]" />
                    <span className="text-sm font-semibold text-white">{alert.title}</span>
                    <SeverityBadge severity={alert.severity} />
                    <StatusBadge status={alert.status} />
                  </div>
                  <p className="text-xs text-[#96A8C5]">{alert.description}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[#6D84A8]">
                    <span>Module: {alert.module.shortName}</span>
                    {alert.device ? <span>Device: {alert.device.deviceName}</span> : null}
                    {alert.asset ? <span>Domain: {alert.asset.domain}</span> : null}
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {hasPermission('alerts:manage') && alert.status === 'OPEN' ? (
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(alert.id, 'ACKNOWLEDGED')}
                      className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 text-xs font-semibold text-[#D8E4F8] hover:border-[#00D4FF]"
                    >
                      Acknowledge
                    </button>
                  ) : null}
                  {hasPermission('alerts:manage') && alert.status !== 'RESOLVED' ? (
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(alert.id, 'RESOLVED')}
                      className="rounded-xl border border-[#00D69A]/40 bg-[#00D69A]/15 px-3 py-1.5 text-xs font-semibold text-[#00D69A]"
                    >
                      Resolve
                    </button>
                  ) : null}
                  {hasPermission('incidents:manage') ? (
                    <button
                      type="button"
                      onClick={() => void handleEscalate(alert.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#FF4560]/15 border border-[#FF4560]/40 px-3 py-1.5 text-xs font-semibold text-[#FF8A9B]"
                    >
                      Escalate <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal open={modalOpen} title="Raise Security Alert" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <select
              value={moduleCode}
              onChange={(e) => setModuleCode(e.target.value)}
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            >
              {SECURITY_MODULES.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Alert Summary Title"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed indicator or behavioral observation"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
            >
              Create Alert
            </button>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

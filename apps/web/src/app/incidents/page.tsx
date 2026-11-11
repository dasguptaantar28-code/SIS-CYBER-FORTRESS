'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Plus } from 'lucide-react';
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

interface IncidentItem {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  priority: number;
  sourceModuleCode: string | null;
  createdAt: string;
  assignments: Array<{ assignee: { id: string; email: string; fullName: string } }>;
  _count?: { alertLinks: number; forensicCases: number };
}

export default function IncidentsPage() {
  const { hasPermission } = useAuth();
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const loadIncidents = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<IncidentItem[]>('/incidents');
      setIncidents(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify({ title, description, severity, sourceModuleCode: 'CYBER_SOC' }),
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setToast({ type: 'success', message: 'Security incident created.' });
      await loadIncidents();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed.' });
    }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/incidents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setToast({ type: 'success', message: `Incident workflow moved to ${status}.` });
      await loadIncidents();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed.' });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">SOC Incident Management</h1>
            <p className="text-sm text-[#96A8C5]">
              Structured containment, responder assignment, and lifecycle triage workflow.
            </p>
          </div>
          {hasPermission('incidents:manage') ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Open Incident
            </button>
          ) : null}
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadIncidents} /> : null}

        {loading ? (
          <SkeletonRows rows={4} />
        ) : incidents.length === 0 ? (
          <EmptyState
            title="No Active Incidents"
            description="Escalate an alert or declare a new incident to track containment and resolution."
          />
        ) : (
          <div className="space-y-4">
            {incidents.map((inc) => (
              <Card key={inc.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Activity className="h-4 w-4 text-[#00D4FF]" />
                      <span className="font-mono text-xs text-[#00D4FF]">{inc.incidentNumber}</span>
                      <h2 className="text-base font-semibold text-white">{inc.title}</h2>
                      <SeverityBadge severity={inc.severity} />
                      <StatusBadge status={inc.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#96A8C5]">{inc.description}</p>
                  </div>

                  {hasPermission('incidents:manage') ? (
                    <select
                      value={inc.status}
                      onChange={(e) => void handleStatus(inc.id, e.target.value)}
                      className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-1.5 text-xs text-white"
                    >
                      {['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'].map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-4 border-t border-[#1B335E]/50 pt-2.5 text-[11px] text-[#96A8C5]">
                  <span>Priority P{inc.priority}</span>
                  <span>Linked Alerts: {inc._count?.alertLinks ?? 0}</span>
                  <span>Forensic Cases: {inc._count?.forensicCases ?? 0}</span>
                  <span>
                    Responders:{' '}
                    {inc.assignments.length > 0
                      ? inc.assignments.map((a) => a.assignee.fullName).join(', ')
                      : 'Unassigned'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal open={modalOpen} title="Declare SOC Incident" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            >
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Incident Title"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, affected systems, and initial impact"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
            >
              Create Incident
            </button>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileSearch, Plus, ShieldCheck } from 'lucide-react';
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

interface ForensicCase {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
  _count?: { evidenceItems: number };
}

interface CaseDetail extends ForensicCase {
  evidenceItems: Array<{
    id: string;
    label: string;
    evidenceType: string;
    fileName: string;
    byteSize: number;
    sha256Hash: string;
    storageLocation: string;
    integrityVerified: boolean;
    custodyLogs: Array<{
      id: string;
      action: string;
      fromCustodian: string | null;
      toCustodian: string | null;
      purpose: string;
      integrityHashAtAction: string;
      timestamp: string;
      actor: { fullName: string; email: string };
    }>;
  }>;
}

export default function CasesPage() {
  const { hasPermission } = useAuth();
  const [cases, setCases] = useState<ForensicCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [evModalOpen, setEvModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');

  const [evLabel, setEvLabel] = useState('');
  const [evFileName, setEvFileName] = useState('evidence-log.txt');
  const [evContent, setEvContent] = useState('');
  const [evLocation, setEvLocation] = useState('SOC Evidence Locker A');

  const loadCases = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<ForensicCase[]>('/forensics/cases');
      setCases(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load forensic cases.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const openDetail = async (id: string) => {
    try {
      const detail = await apiFetch<CaseDetail>(`/forensics/cases/${id}`);
      setSelectedCase(detail);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Load failed.' });
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiFetch<ForensicCase>('/forensics/cases', {
        method: 'POST',
        body: JSON.stringify({ title, description, severity }),
      });
      setCaseModalOpen(false);
      setTitle('');
      setDescription('');
      setToast({ type: 'success', message: `Forensic Case ${created.caseNumber} created.` });
      await loadCases();
      await openDetail(created.id);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Create failed.' });
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      await apiFetch(`/forensics/cases/${selectedCase.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          label: evLabel,
          evidenceType: 'ARTIFACT_SNAPSHOT',
          fileName: evFileName,
          contentForHashing: evContent,
          storageLocation: evLocation,
        }),
      });
      setEvModalOpen(false);
      setEvLabel('');
      setEvContent('');
      setToast({ type: 'success', message: 'Evidence hashed (SHA-256) and intake custody logged.' });
      await openDetail(selectedCase.id);
      await loadCases();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed.' });
    }
  };

  const handleExportDossier = async (caseId: string) => {
    try {
      const dossier = await apiFetch<Record<string, unknown>>(`/forensics/cases/${caseId}/export`);
      const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forensic-dossier-${selectedCase?.caseNumber || caseId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({
        type: 'success',
        message: 'Controlled export completed and recorded in chain-of-custody + audit logs.',
      });
      if (selectedCase) await openDetail(selectedCase.id);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Export failed.' });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Digital Forensics & Chain of Custody</h1>
            <p className="text-sm text-[#96A8C5]">
              Immutable evidence SHA-256 sealing, custody transfer log, and audited dossier export.
            </p>
          </div>
          {hasPermission('forensics:manage') ? (
            <button
              type="button"
              onClick={() => setCaseModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> New Forensic Case
            </button>
          ) : null}
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadCases} /> : null}

        {loading ? (
          <SkeletonRows rows={4} />
        ) : cases.length === 0 ? (
          <EmptyState
            title="No Forensic Cases Open"
            description="Create a forensic investigation case to register evidence hashes and chain-of-custody records."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-3">
              {cases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void openDetail(c.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedCase?.id === c.id
                      ? 'border-[#00D4FF] bg-[#10213F]'
                      : 'border-[#1B335E] bg-[#0B1730] hover:border-[#00D4FF]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#00D4FF]">
                      {c.caseNumber}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <h2 className="mt-1.5 text-sm font-semibold text-white">{c.title}</h2>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#96A8C5]">
                    <SeverityBadge severity={c.severity} />
                    <span>{c._count?.evidenceItems ?? 0} evidence item(s)</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="xl:col-span-2">
              {!selectedCase ? (
                <Card className="flex h-64 items-center justify-center text-sm text-[#96A8C5]">
                  Select a forensic case on the left to inspect evidence metadata & chain of custody.
                </Card>
              ) : (
                <Card className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1B335E] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSearch className="h-5 w-5 text-[#00D4FF]" />
                        <span className="font-mono text-sm font-bold text-[#00D4FF]">
                          {selectedCase.caseNumber}
                        </span>
                        <StatusBadge status={selectedCase.status} />
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-white">{selectedCase.title}</h2>
                      <p className="mt-1 text-xs text-[#96A8C5]">{selectedCase.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hasPermission('forensics:manage') ? (
                        <button
                          type="button"
                          onClick={() => setEvModalOpen(true)}
                          className="rounded-xl bg-[#087BFF] px-3 py-2 text-xs font-semibold text-white"
                        >
                          + Add Evidence
                        </button>
                      ) : null}
                      {hasPermission('forensics:export') ? (
                        <button
                          type="button"
                          onClick={() => void handleExportDossier(selectedCase.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-3 py-2 text-xs font-semibold text-[#00D4FF]"
                        >
                          <Download className="h-3.5 w-3.5" /> Export Dossier
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {selectedCase.evidenceItems.length === 0 ? (
                    <p className="text-xs text-[#96A8C5]">No evidence items registered for this case yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedCase.evidenceItems.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-2xl border border-[#1B335E] bg-[#050B18] p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-semibold text-white">{ev.label}</h3>
                              <p className="text-xs text-[#96A8C5]">
                                {ev.fileName} • {ev.byteSize} bytes • {ev.storageLocation}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#00D69A]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#00D69A]">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {ev.integrityVerified ? 'SHA-256 Verified' : 'Integrity Flagged'}
                            </span>
                          </div>
                          <div className="rounded-lg bg-[#0B1730] px-3 py-2 font-mono text-[11px] text-[#00D4FF] break-all">
                            SHA-256: {ev.sha256Hash}
                          </div>

                          <div className="space-y-1.5 border-t border-[#1B335E]/50 pt-2">
                            <div className="text-[11px] font-semibold uppercase text-[#96A8C5]">
                              Chain-of-Custody Timeline ({ev.custodyLogs.length})
                            </div>
                            {ev.custodyLogs.map((log) => (
                              <div
                                key={log.id}
                                className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#D8E4F8]"
                              >
                                <span>
                                  <strong className="text-[#00D4FF]">{log.action}</strong> — {log.purpose}{' '}
                                  ({log.actor.fullName})
                                </span>
                                <span className="text-[#6D84A8]">
                                  {new Date(log.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}

        <Modal open={caseModalOpen} title="Create Forensic Case" onClose={() => setCaseModalOpen(false)}>
          <form onSubmit={handleCreateCase} className="space-y-4">
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
              placeholder="Case Title"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Investigation scope & context"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
            >
              Create Forensic Case
            </button>
          </form>
        </Modal>

        <Modal open={evModalOpen} title="Register Evidence & Seal SHA-256" onClose={() => setEvModalOpen(false)}>
          <form onSubmit={handleAddEvidence} className="space-y-4">
            <input
              type="text"
              required
              value={evLabel}
              onChange={(e) => setEvLabel(e.target.value)}
              placeholder="Evidence Label"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <input
              type="text"
              required
              value={evFileName}
              onChange={(e) => setEvFileName(e.target.value)}
              placeholder="Artifact File Name"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <input
              type="text"
              required
              value={evLocation}
              onChange={(e) => setEvLocation(e.target.value)}
              placeholder="Storage Location"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <textarea
              required
              rows={4}
              value={evContent}
              onChange={(e) => setEvContent(e.target.value)}
              placeholder="Evidence artifact payload (SHA-256 hash is computed & sealed immutably)"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 font-mono text-xs text-white"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
            >
              Seal SHA-256 & Log Intake
            </button>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

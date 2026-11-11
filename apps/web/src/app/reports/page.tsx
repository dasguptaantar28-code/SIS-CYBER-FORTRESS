'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SkeletonRows } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL, apiFetch, ApiError } from '@/lib/api';

const REPORT_CATEGORIES = [
  { key: 'module-status', label: 'Module Status & Health' },
  { key: 'incidents', label: 'Security Incidents' },
  { key: 'threat-activity', label: 'Threat & Alert Activity' },
  { key: 'device-security', label: 'Device Security Posture' },
  { key: 'website-scans', label: 'Website Scan Results' },
  { key: 'backup-performance', label: 'Backup Performance' },
  { key: 'forensic-cases', label: 'Forensic Case History' },
  { key: 'admin-activity', label: 'Administrative Activity' },
] as const;

interface ReportData {
  title: string;
  generatedAt: string;
  dateRange: { from: string; to: string };
  source: string;
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
}

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const [category, setCategory] = useState<string>('module-status');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ReportData>(`/reports/${cat}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to generate report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(category);
  }, [category, loadReport]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Security Reports & Compliance Exports</h1>
            <p className="text-sm text-[#96A8C5]">
              Export timestamped CSV and PDF documents directly from authoritative backend telemetry.
            </p>
          </div>
          {hasPermission('reports:export') ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`${API_BASE_URL}/reports/${category}/export/csv`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#1B335E] bg-[#0B1730] px-3.5 py-2 text-xs font-semibold text-[#D8E4F8] hover:border-[#00D4FF]"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#00D69A]" /> Export CSV
              </a>
              <a
                href={`${API_BASE_URL}/reports/${category}/export/pdf`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#087BFF] px-3.5 py-2 text-xs font-semibold text-white"
              >
                <Download className="h-4 w-4" /> Export PDF
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {REPORT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                category === c.key
                  ? 'bg-[#087BFF] text-white'
                  : 'border border-[#1B335E] bg-[#0B1730] text-[#96A8C5] hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {error ? <ErrorBanner message={error} onRetry={() => loadReport(category)} /> : null}

        {loading || !report ? (
          <SkeletonRows rows={5} />
        ) : (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#1B335E] pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-[#00D4FF]" />
                <div>
                  <h2 className="text-base font-bold text-white">{report.title}</h2>
                  <p className="text-[11px] text-[#96A8C5]">
                    Generated: {new Date(report.generatedAt).toLocaleString()} • Source: {report.source}
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-[#050B18] px-2.5 py-1 font-mono text-[11px] text-[#96A8C5]">
                {report.rows.length} row(s)
              </span>
            </div>

            {report.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#96A8C5]">
                No persisted records exist for this report range yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-[#1B335E] text-[#96A8C5] uppercase">
                    <tr>
                      {report.columns.map((col) => (
                        <th key={col} className="pb-2.5 pr-4 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B335E]/40">
                    {report.rows.map((row, idx) => (
                      <tr key={idx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 pr-4 text-[#D8E4F8]">
                            {String(cell ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

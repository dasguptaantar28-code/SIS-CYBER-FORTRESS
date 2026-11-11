'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import { Card, ErrorBanner, SeverityBadge, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { apiFetch, ApiError } from '@/lib/api';

export function WebShieldPanel() {
  const [assets, setAssets] = useState<
    Array<{ id: string; name: string; domain: string; targetUrl: string; isApprovedForScan: boolean; ownershipStatus: string }>
  >([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [scans, setScans] = useState<
    Array<{
      id: string;
      targetValue: string;
      createdAt: string;
      result: {
        riskLevel: string;
        riskScore: number;
        summary: string;
        findings: Array<{ title: string; severity: string; detail: string; remediation?: string }>;
        metadata?: { tls?: Record<string, unknown>; dns?: Record<string, unknown>; http?: Record<string, unknown> };
      } | null;
    }>
  >([]);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    const [assetList, scanList] = await Promise.all([
      apiFetch<typeof assets>('/assets'),
      apiFetch<typeof scans>('/scans?moduleCode=WEBSHIELD'),
    ]);
    setAssets(assetList);
    const firstApproved = assetList.find((a) => a.isApprovedForScan);
    if (firstApproved && !selectedAssetId) setSelectedAssetId(firstApproved.id);
    setScans(scanList);
  }, [selectedAssetId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRunScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;
    setScanning(true);
    try {
      await apiFetch('/scans/webshield', {
        method: 'POST',
        body: JSON.stringify({ assetId: selectedAssetId }),
      });
      setToast({ type: 'success', message: 'Authorized WebShield TLS/DNS/HTTP scan finished.' });
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Scan blocked or failed.' });
    } finally {
      setScanning(false);
    }
  };

  const approvedAssets = assets.filter((a) => a.isApprovedForScan);

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Globe className="h-4 w-4 text-[#00D4FF]" /> Authorized Website Security Scanner
          </h3>
          <Link href="/assets" className="text-xs text-[#00D4FF] hover:underline">
            Manage & Verify Assets →
          </Link>
        </div>

        {approvedAssets.length === 0 ? (
          <p className="text-xs text-[#FFB547]">
            No verified or approved assets available yet. Register and verify a domain in Asset Registry before running WebShield scans.
          </p>
        ) : (
          <form onSubmit={handleRunScan} className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="flex-1 rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-xs text-white"
            >
              {approvedAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.targetUrl}) — {a.ownershipStatus}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={scanning}
              className="rounded-xl bg-[#087BFF] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {scanning ? 'Inspecting TLS/DNS/Headers...' : 'Run WebShield Scan'}
            </button>
          </form>
        )}
      </Card>

      <div className="space-y-3">
        {scans.map((job) => (
          <Card key={job.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-white">{job.targetValue}</span>
              {job.result ? <SeverityBadge severity={job.result.riskLevel} /> : null}
            </div>
            {job.result ? (
              <>
                <p className="text-xs text-[#D8E4F8]">{job.result.summary}</p>
                {job.result.findings.length > 0 ? (
                  <div className="space-y-2">
                    {job.result.findings.map((f, idx) => (
                      <div key={idx} className="rounded-xl border border-[#1B335E]/60 bg-[#050B18] p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">{f.title}</span>
                          <SeverityBadge severity={f.severity} />
                        </div>
                        <p className="mt-1 text-[#96A8C5]">{f.detail}</p>
                        {f.remediation ? (
                          <p className="mt-1 text-[#00D69A]">Remediation: {f.remediation}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function EndpointGuardianPanel() {
  const [devices, setDevices] = useState<
    Array<{
      id: string;
      deviceName: string;
      platform: string;
      osVersion: string | null;
      complianceStatus: string;
      postureScore: number;
      installedAppCount: number | null;
      highRiskPermissionCount: number | null;
      postureDetails?: { findings?: string[]; androidPolicyNote?: string };
    }>
  >([]);

  useEffect(() => {
    void apiFetch<typeof devices>('/devices').then(setDevices).catch(() => setDevices([]));
  }, []);

  return (
    <div className="space-y-5">
      <Card className="border-[#00D4FF]/30 bg-[#0B1730]/80 text-xs text-[#96A8C5]">
        <strong className="text-white">Android OS Privacy & Policy Disclosure:</strong> Endpoint Guardian inspects only permitted device posture signals and user-authorized package inventory under Android 11+ visibility boundaries. Root bypass or hidden monitoring is prohibited.
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {devices.map((d) => (
          <Card key={d.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-[#00D4FF]" />
                <span className="text-sm font-bold text-white">{d.deviceName}</span>
              </div>
              <StatusBadge status={d.complianceStatus} />
            </div>
            <div className="text-xs text-[#96A8C5]">
              {d.platform} • {d.osVersion || 'Unknown OS'} • Posture Score:{' '}
              <strong className="text-[#00D69A]">{d.postureScore}%</strong>
            </div>
            {d.installedAppCount !== null ? (
              <div className="text-xs text-[#D8E4F8]">
                Visible Apps: {d.installedAppCount} • Elevated-Permission Apps:{' '}
                {d.highRiskPermissionCount ?? 0}
              </div>
            ) : null}
            {d.postureDetails?.findings?.length ? (
              <ul className="list-disc pl-4 text-[11px] text-[#FFB547]">
                {d.postureDetails.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
      <Link href="/devices" className="inline-block text-xs font-semibold text-[#00D4FF] hover:underline">
        Open Full Device Inventory →
      </Link>
    </div>
  );
}

export function NetworkSentinelPanel() {
  const [assessments, setAssessments] = useState<
    Array<{
      id: string;
      connectionType: string;
      wifiSecurityType: string;
      isVpnActive: boolean;
      isOpenOrUnsafe: boolean;
      riskScore: number;
      ssidVisibilityNote: string;
      warnings: string[];
      createdAt: string;
    }>
  >([]);
  const [connectionType, setConnectionType] = useState('WIFI');
  const [wifiSecurityType, setWifiSecurityType] = useState('WPA3');
  const [isVpnActive, setIsVpnActive] = useState(true);
  const [checklist, setChecklist] = useState({
    disableAutoJoinOpenWifi: true,
    useEncryptedDns: true,
    verifyHttpsPadlock: true,
    vpnOnPublicHotspots: true,
  });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<typeof assessments>('/posture/network');
    setAssessments(res);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/posture/network', {
        method: 'POST',
        body: JSON.stringify({
          connectionType,
          transportLabel: `Web Assessment (${connectionType})`,
          isVpnActive,
          isMetered: false,
          wifiSecurityType,
          ssidVisibilityNote:
            'Browser Network Information API does not expose Wi-Fi SSID/BSSID for privacy; reported manually.',
          checklistState: checklist,
        }),
      });
      setToast({ type: 'success', message: 'Network Sentinel assessment recorded.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <Card className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Wifi className="h-4 w-4 text-[#00D4FF]" /> Network Security Assessment & Checklist
        </h3>
        <p className="text-xs text-[#96A8C5]">
          Web browsers restrict raw Wi-Fi SSID/security inspection by design. For automatic transport/Wi-Fi telemetry, use the native Android app.
        </p>
        <form onSubmit={submitAssessment} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value)}
              className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
            >
              <option value="WIFI">Wi-Fi</option>
              <option value="ETHERNET">Ethernet</option>
              <option value="CELLULAR">Cellular</option>
            </select>
            <select
              value={wifiSecurityType}
              onChange={(e) => setWifiSecurityType(e.target.value)}
              className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
            >
              <option value="WPA3">WPA3</option>
              <option value="WPA2">WPA2</option>
              <option value="OPEN">OPEN (Unsafe)</option>
              <option value="WEP">WEP (Unsafe)</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white">
              <input
                type="checkbox"
                checked={isVpnActive}
                onChange={(e) => setIsVpnActive(e.target.checked)}
              />
              VPN Active
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(checklist).map(([key, val]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-[#D8E4F8]">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setChecklist((c) => ({ ...c, [key]: e.target.checked }))}
                />
                {key.replace(/([A-Z])/g, ' $1')}
              </label>
            ))}
          </div>
          <button type="submit" className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
            Record Network Posture
          </button>
        </form>
      </Card>

      <div className="space-y-3">
        {assessments.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-white">
                {a.connectionType} ({a.wifiSecurityType}) • VPN: {a.isVpnActive ? 'Yes' : 'No'}
              </div>
              <div className="text-[11px] text-[#96A8C5]">{a.ssidVisibilityNote}</div>
              {a.warnings.length > 0 ? (
                <div className="mt-1 text-[11px] text-[#FF8A9B]">{a.warnings.join(' ')}</div>
              ) : null}
            </div>
            <StatusBadge status={a.isOpenOrUnsafe ? 'NON_COMPLIANT' : 'COMPLIANT'} />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function RansomwareGuardianPanel() {
  const [summary, setSummary] = useState<{
    readinessRecords: Array<{ readinessScore: number; backupVerified: boolean; canaryStatus: string; lastDrillAt: string | null }>;
    backupReadinessVerified: boolean;
  } | null>(null);
  const [checklist, setChecklist] = useState({
    verifiedOfflineBackups: true,
    mfaOnAdminAccounts: true,
    leastPrivilegeShares: true,
    endpointPatchingCurrent: true,
    restoreDrillTested: false,
  });
  const [canaryStatus, setCanaryStatus] = useState('MONITORING_HEALTHY');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<NonNullable<typeof summary>>('/posture/ransomware');
    setSummary(res);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveReadiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/posture/ransomware', {
        method: 'POST',
        body: JSON.stringify({
          checklistState: checklist,
          canaryStatus,
          markDrillCompleted: checklist.restoreDrillTested,
        }),
      });
      setToast({ type: 'success', message: 'Ransomware readiness posture saved.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Save failed.' });
    }
  };

  if (!summary) return <SkeletonRows rows={3} />;
  const latest = summary.readinessRecords[0];

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-[#96A8C5]">Recovery Readiness Score</div>
          <div className="mt-1 text-2xl font-bold text-[#00D69A]">{latest?.readinessScore ?? 0}%</div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">Verified Encrypted Backups</div>
          <div className="mt-2">
            <StatusBadge status={summary.backupReadinessVerified ? 'VERIFIED' : 'PENDING'} />
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">File-Change Indicator State</div>
          <div className="mt-2">
            <StatusBadge status={latest?.canaryStatus || 'UNCONFIGURED'} />
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldCheck className="h-4 w-4 text-[#00D4FF]" /> Defensive Recovery Checklist & Drill
        </h3>
        <p className="text-xs text-[#96A8C5]">
          Purely defensive & recovery-focused posture tracking. Execute actual verified backups in Cloud Backup Guardian to earn full readiness credit.
        </p>
        <form onSubmit={saveReadiness} className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(checklist).map(([key, val]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-[#D8E4F8]">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setChecklist((c) => ({ ...c, [key]: e.target.checked }))}
                />
                {key.replace(/([A-Z])/g, ' $1')}
              </label>
            ))}
          </div>

          <select
            value={canaryStatus}
            onChange={(e) => setCanaryStatus(e.target.value)}
            className="w-full max-w-xs rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
          >
            <option value="MONITORING_HEALTHY">MONITORING_HEALTHY</option>
            <option value="UNCONFIGURED">UNCONFIGURED</option>
            <option value="SUSPICIOUS_ACTIVITY_REPORTED">SUSPICIOUS_ACTIVITY_REPORTED (Raise SOC Alert)</option>
          </select>

          <div>
            <button type="submit" className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
              Update Readiness Posture
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Flag, KeyRound, QrCode, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, ErrorBanner, SeverityBadge, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { apiFetch, ApiError } from '@/lib/api';

async function sha1UpperHex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function IdentityGuardianPanel() {
  const [overview, setOverview] = useState<{
    profile: { mfaEnabled: boolean; passkeyCount: number; email: string };
    activeSessions: number;
    suspiciousLoginCount: number;
    identitySecurityScore: number;
    breachProviderStatus: string;
    loginHistory: Array<{
      id: string;
      createdAt: string;
      success: boolean;
      ipAddress: string | null;
      isSuspicious: boolean;
      failureReason: string | null;
      mfaUsed: boolean;
    }>;
  } | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ qrCodeDataUrl: string; manualEntryKey: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [candidatePw, setCandidatePw] = useState('');
  const [breachResult, setBreachResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<NonNullable<typeof overview>>('/auth/identity-overview');
    setOverview(res);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startMfaSetup = async () => {
    try {
      const res = await apiFetch<{ qrCodeDataUrl: string; manualEntryKey: string }>('/auth/mfa/setup', {
        method: 'POST',
      });
      setMfaSetup(res);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'MFA setup failed.' });
    }
  };

  const enableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      setMfaSetup(null);
      setTotpCode('');
      setToast({ type: 'success', message: 'TOTP Multi-Factor Authentication activated.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Invalid TOTP code.' });
    }
  };

  const registerDemoPasskey = async () => {
    try {
      const challenge = await apiFetch<{ challenge: string }>('/auth/passkeys/challenge', {
        method: 'POST',
      });
      await apiFetch('/auth/passkeys/register', {
        method: 'POST',
        body: JSON.stringify({
          credentialId: `webauthn-${challenge.challenge.slice(0, 24)}`,
          publicKey: `pk-ecdsa-${challenge.challenge}`,
          transports: ['internal'],
          deviceLabel: navigator.userAgent.slice(0, 60),
        }),
      });
      setToast({ type: 'success', message: 'Passkey metadata registered to Identity Guardian.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Passkey registration failed.' });
    }
  };

  const checkBreachKAnon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidatePw) return;
    const fullHash = await sha1UpperHex(candidatePw);
    const prefix = fullHash.slice(0, 5);
    const suffix = fullHash.slice(5);
    // Clear candidatePw immediately — plaintext never leaves browser!
    setCandidatePw('');
    try {
      const res = await apiFetch<{
        providerStatus: string;
        suffixes: Array<{ suffix: string; count: number }>;
        privacyNote: string;
      }>('/auth/breach-check', {
        method: 'POST',
        body: JSON.stringify({ sha1Prefix: prefix }),
      });
      const match = res.suffixes.find((s) => s.suffix.toUpperCase() === suffix);
      setBreachResult(
        match
          ? `WARNING: Password hash matched known breach corpus (${match.count.toLocaleString()} occurrences). Rotate immediately! [${res.providerStatus}]`
          : `No match in ${res.providerStatus}. ${res.privacyNote}`,
      );
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Breach check failed.' });
    }
  };

  if (!overview) return <SkeletonRows rows={4} />;

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <div className="text-xs text-[#96A8C5]">Identity Score</div>
          <div className="mt-1 text-2xl font-bold text-[#00D69A]">{overview.identitySecurityScore}%</div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">TOTP MFA</div>
          <div className="mt-2"><StatusBadge status={overview.profile.mfaEnabled ? 'ACTIVE' : 'PENDING'} /></div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">Registered Passkeys</div>
          <div className="mt-1 text-2xl font-bold text-white">{overview.profile.passkeyCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">Suspicious Sign-Ins</div>
          <div className="mt-1 text-2xl font-bold text-[#FFB547]">{overview.suspiciousLoginCount}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <QrCode className="h-4 w-4 text-[#00D4FF]" /> TOTP MFA & Passkey Readiness
            </h3>
            <div className="flex gap-2">
              {!overview.profile.mfaEnabled ? (
                <button
                  type="button"
                  onClick={() => void startMfaSetup()}
                  className="rounded-xl bg-[#087BFF] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Setup MFA
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void registerDemoPasskey()}
                className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 text-xs font-semibold text-[#00D4FF]"
              >
                + Register Passkey
              </button>
            </div>
          </div>

          {mfaSetup ? (
            <form onSubmit={enableMfa} className="space-y-3 rounded-xl border border-[#1B335E] bg-[#050B18] p-4">
              <img src={mfaSetup.qrCodeDataUrl} alt="MFA QR Code" className="mx-auto h-36 w-36 rounded-lg bg-white p-2" />
              <p className="text-center font-mono text-[11px] text-[#00D4FF]">
                Manual Key: {mfaSetup.manualEntryKey}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="flex-1 rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-2 text-xs text-white"
                />
                <button type="submit" className="rounded-xl bg-[#00D69A] px-4 py-2 text-xs font-bold text-[#050B18]">
                  Activate
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-[#96A8C5]">
              {overview.profile.mfaEnabled
                ? 'RFC 6238 TOTP MFA is active on your account.'
                : 'Enable TOTP Multi-Factor Authentication to protect against credential stuffing.'}
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound className="h-4 w-4 text-[#00D4FF]" /> Privacy-Preserving Credential Breach Check (k-Anonymity)
          </h3>
          <p className="text-xs text-[#96A8C5]">
            Your browser computes SHA-1 locally and transmits only the first 5 hex characters. Plaintext passwords are never sent or logged.
          </p>
          <form onSubmit={checkBreachKAnon} className="flex gap-2">
            <input
              type="password"
              required
              value={candidatePw}
              onChange={(e) => setCandidatePw(e.target.value)}
              placeholder="Test a candidate password locally..."
              className="flex-1 rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2 text-xs text-white"
            />
            <button type="submit" className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
              Check Prefix
            </button>
          </form>
          {breachResult ? (
            <div className="rounded-xl border border-[#00D4FF]/35 bg-[#050B18] p-3 text-xs text-[#D8E4F8]">
              {breachResult}
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="space-y-3">
        <h3 className="text-sm font-bold text-white">Recent Account Login Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead className="border-b border-[#1B335E] text-[#96A8C5] uppercase">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Outcome</th>
                <th className="pb-2">MFA Used</th>
                <th className="pb-2">IP Address</th>
                <th className="pb-2">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B335E]/40">
              {overview.loginHistory.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-[#96A8C5]">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <StatusBadge status={l.success ? 'ACTIVE' : 'FAILED'} />
                  </td>
                  <td className="py-2 text-[#D8E4F8]">{l.mfaUsed ? 'Yes' : 'No'}</td>
                  <td className="py-2 font-mono text-[#96A8C5]">{l.ipAddress || '—'}</td>
                  <td className="py-2">
                    {l.isSuspicious ? <SeverityBadge severity="HIGH" /> : <span className="text-[#00D69A]">Normal</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function PhishingShieldPanel() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scans, setScans] = useState<
    Array<{
      id: string;
      targetValue: string;
      providerStatus: string;
      createdAt: string;
      result: {
        id: string;
        riskLevel: string;
        riskScore: number;
        summary: string;
        verdictDisclaimer: string;
        falsePositiveReported: boolean;
        findings: Array<{ title: string; severity: string; detail: string }>;
      } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadScans = useCallback(async () => {
    try {
      const data = await apiFetch<typeof scans>('/scans?moduleCode=PHISHING_SHIELD');
      setScans(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load scan history.');
    }
  }, []);

  useEffect(() => {
    void loadScans();
  }, [loadScans]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanning(true);
    setError(null);
    try {
      await apiFetch('/scans/phishing', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setUrl('');
      setToast({ type: 'success', message: 'Phishing URL analysis completed.' });
      await loadScans();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const reportFalsePositive = async (resultId: string) => {
    try {
      await apiFetch(`/scans/${resultId}/false-positive`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'User verified domain is legitimate.' }),
      });
      setToast({ type: 'success', message: 'False-positive report recorded for analyst review.' });
      await loadScans();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      {error ? <ErrorBanner message={error} onRetry={loadScans} /> : null}

      <Card className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldAlert className="h-4 w-4 text-[#00D4FF]" /> URL & Domain Phishing Analyzer
        </h3>
        <form onSubmit={handleScan} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#96A8C5]" />
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com or http://verify-account-reset.example.invalid/auth"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-xs text-white outline-none focus:border-[#00D4FF]"
            />
          </div>
          <button
            type="submit"
            disabled={scanning}
            className="rounded-xl bg-[#087BFF] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {scanning ? 'Analyzing...' : 'Scan URL'}
          </button>
        </form>
        <p className="text-[11px] text-[#96A8C5]">
          Note: Checks correlate local Threat Intelligence IOC feeds, lexical spoofing signals, and configured external APIs. Clean results do not guarantee a link is safe.
        </p>
      </Card>

      <div className="space-y-3">
        {scans.map((job) => (
          <Card key={job.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-xs font-semibold text-white break-all">{job.targetValue}</div>
              <div className="flex items-center gap-2">
                {job.result ? <SeverityBadge severity={job.result.riskLevel} /> : null}
                <span className="text-[11px] text-[#96A8C5]">{job.providerStatus}</span>
              </div>
            </div>
            {job.result ? (
              <>
                <p className="text-xs text-[#D8E4F8]">{job.result.summary}</p>
                <p className="text-[11px] text-[#96A8C5]">{job.result.verdictDisclaimer}</p>
                {job.result.findings.length > 0 ? (
                  <div className="space-y-1 pt-1">
                    {job.result.findings.map((f, i) => (
                      <div key={i} className="rounded-lg bg-[#050B18] px-3 py-2 text-[11px] text-[#D8E4F8]">
                        <strong className="text-[#00D4FF]">{f.title}:</strong> {f.detail}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center justify-between pt-2 text-[11px] text-[#6D84A8]">
                  <span>Scanned: {new Date(job.createdAt).toLocaleString()}</span>
                  {!job.result.falsePositiveReported ? (
                    <button
                      type="button"
                      onClick={() => void reportFalsePositive(job.result!.id)}
                      className="inline-flex items-center gap-1 text-[#FFB547] hover:underline"
                    >
                      <Flag className="h-3 w-3" /> Report False Positive
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#00D69A]">
                      <ShieldCheck className="h-3 w-3" /> False Positive Submitted
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, Lock, Plus, RefreshCw, Trash2, Unlock } from 'lucide-react';
import { Card, EmptyState, ErrorBanner, SkeletonRows, StatusBadge, ToastBanner } from '@/components/ui';
import { apiFetch, ApiError } from '@/lib/api';
import { decryptVaultItemClientSide, encryptVaultItemClientSide } from '@/lib/vault-crypto';

interface VaultRow {
  id: string;
  recordType: 'PASSWORD' | 'SECURE_NOTE' | 'DOCUMENT';
  encryptedTitle: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
  createdAt: string;
}

export function VaultGuardianPanel() {
  const [passphrase, setPassphrase] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [records, setRecords] = useState<VaultRow[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<
    Record<string, { title: string; secretBody: Record<string, unknown> } | { error: string }>
  >({});
  const [recordType, setRecordType] = useState<'PASSWORD' | 'SECURE_NOTE' | 'DOCUMENT'>('PASSWORD');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadVault = useCallback(async (activePass: string) => {
    const rows = await apiFetch<VaultRow[]>('/vault/records');
    setRecords(rows);
    const nextMap: typeof decryptedMap = {};
    for (const r of rows) {
      try {
        nextMap[r.id] = await decryptVaultItemClientSide(activePass, r);
      } catch {
        nextMap[r.id] = { error: 'Encrypted with a different Master Vault Passphrase' };
      }
    }
    setDecryptedMap(nextMap);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 6) {
      setToast({ type: 'error', message: 'Master Vault Passphrase must be at least 6 characters.' });
      return;
    }
    try {
      await loadVault(passphrase);
      setUnlocked(true);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Vault sync failed.' });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const encrypted = await encryptVaultItemClientSide(passphrase, title, {
        username,
        secret: secretValue,
        savedAt: new Date().toISOString(),
      });
      await apiFetch('/vault/records', {
        method: 'POST',
        body: JSON.stringify({ recordType, ...encrypted, clientType: 'web' }),
      });
      setTitle('');
      setUsername('');
      setSecretValue('');
      setToast({ type: 'success', message: 'Encrypted client-side (AES-256-GCM) and stored safely.' });
      await loadVault(passphrase);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Create failed.' });
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/vault/records/${id}`, { method: 'DELETE' });
    await loadVault(passphrase);
  };

  if (!unlocked) {
    return (
      <Card className="mx-auto max-w-lg space-y-4">
        {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
        <div className="flex items-center gap-3">
          <Lock className="h-7 w-7 text-[#00D4FF]" />
          <div>
            <h3 className="text-base font-bold text-white">Unlock Zero-Knowledge Vault</h3>
            <p className="text-xs text-[#96A8C5]">
              PBKDF2-SHA256 (600k rounds) + AES-256-GCM runs inside your browser. Super Admins never see vault plaintext.
            </p>
          </div>
        </div>
        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            required
            minLength={6}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter Master Vault PIN / Passphrase"
            className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-4 py-2.5 text-sm text-white"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087BFF] py-2.5 text-xs font-semibold text-white"
          >
            <Unlock className="h-4 w-4" /> Unlock Encrypted Vault
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="flex items-center justify-between">
        <span className="text-xs text-[#00D69A] font-semibold">
          Vault Unlocked Locally (AES-256-GCM Zero-Knowledge Active)
        </span>
        <button
          type="button"
          onClick={() => {
            setUnlocked(false);
            setPassphrase('');
            setDecryptedMap({});
          }}
          className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 text-xs font-semibold text-[#FFB547]"
        >
          Lock Vault
        </button>
      </div>

      <Card className="space-y-4">
        <h3 className="text-sm font-bold text-white">Add Encrypted Vault Item</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as typeof recordType)}
            className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
          >
            <option value="PASSWORD">PASSWORD</option>
            <option value="SECURE_NOTE">SECURE_NOTE</option>
            <option value="DOCUMENT">DOCUMENT</option>
          </select>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Item Label (encrypted client-side)"
            className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Account / Metadata (optional)"
            className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
          />
          <input
            type="password"
            required
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
            placeholder="Secret / Note / Document Content"
            className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3 py-2 text-xs text-white"
          />
          <button
            type="submit"
            className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#087BFF] py-2.5 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Encrypt & Store in Zero-Knowledge Vault
          </button>
        </form>
      </Card>

      {records.length === 0 ? (
        <EmptyState title="Vault Is Empty" description="Add a password, secure note, or encrypted document entry above." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {records.map((r) => {
            const dec = decryptedMap[r.id];
            return (
              <Card key={r.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#087BFF]/15 px-2 py-0.5 text-[10px] font-bold text-[#00D4FF]">
                    {r.recordType}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    className="text-[#FF8A9B] hover:text-[#FF4560]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {dec && 'title' in dec ? (
                  <>
                    <div className="text-sm font-semibold text-white">{dec.title}</div>
                    {dec.secretBody.username ? (
                      <div className="text-xs text-[#96A8C5]">User: {String(dec.secretBody.username)}</div>
                    ) : null}
                    <div className="rounded-lg bg-[#050B18] px-3 py-2 font-mono text-xs text-[#00D69A] break-all">
                      {String(dec.secretBody.secret)}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[#FFB547]">
                    {dec && 'error' in dec ? dec.error : 'Encrypted'}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CloudBackupPanel() {
  const [data, setData] = useState<{
    jobs: Array<{
      id: string;
      backupName: string;
      status: string;
      encryptionAlgo: string;
      totalBytes: number;
      fileCount: number;
      integrityVerified: boolean;
      checksumSha256: string | null;
      createdAt: string;
    }>;
    summary: { totalJobs: number; verifiedCount: number; failedCount: number; totalStorageBytes: number };
  } | null>(null);
  const [backupName, setBackupName] = useState('');
  const [filePath, setFilePath] = useState('configs/policy-snapshot.json');
  const [content, setContent] = useState('');
  const [restoredContent, setRestoredContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadBackups = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>('/backups');
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load backup history.');
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const createBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/backups', {
        method: 'POST',
        body: JSON.stringify({
          backupName,
          scheduleType: 'MANUAL',
          entries: [{ relativePath: filePath, content }],
        }),
      });
      setBackupName('');
      setContent('');
      setToast({ type: 'success', message: 'Backup encrypted (AES-256-GCM) & verified via SHA-256.' });
      await loadBackups();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Backup failed.' });
    }
  };

  const restoreBackup = async (id: string) => {
    try {
      const res = await apiFetch<{ files: Array<{ relativePath: string; content: string; sha256Hash: string }> }>(
        `/backups/${id}/restore`,
        { method: 'POST' },
      );
      setRestoredContent(
        res.files.map((f) => `${f.relativePath} (SHA-256: ${f.sha256Hash}):\n${f.content}`).join('\n\n'),
      );
      setToast({ type: 'success', message: 'Backup integrity verified and restored successfully.' });
      await loadBackups();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Restore failed.' });
    }
  };

  if (!data) return <SkeletonRows rows={4} />;

  return (
    <div className="space-y-6">
      {toast ? <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      {error ? <ErrorBanner message={error} onRetry={loadBackups} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs text-[#96A8C5]">Verified Backups</div>
          <div className="mt-1 text-2xl font-bold text-[#00D69A]">{data.summary.verifiedCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">Failed Backups</div>
          <div className="mt-1 text-2xl font-bold text-[#FF4560]">{data.summary.failedCount}</div>
        </Card>
        <Card>
          <div className="text-xs text-[#96A8C5]">Encrypted Storage Used</div>
          <div className="mt-1 text-2xl font-bold text-white">{data.summary.totalStorageBytes} B</div>
        </Card>
      </div>

      <Card className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Cloud className="h-4 w-4 text-[#00D4FF]" /> Create & Verify Encrypted Backup
        </h3>
        <form onSubmit={createBackup} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              required
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="Backup Job Name"
              className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2 text-xs text-white"
            />
            <input
              type="text"
              required
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="Relative File Path"
              className="rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2 text-xs text-white"
            />
          </div>
          <textarea
            required
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Payload to encrypt with AES-256-GCM and verify SHA-256 integrity..."
            className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2 font-mono text-xs text-white"
          />
          <button type="submit" className="rounded-xl bg-[#087BFF] px-4 py-2 text-xs font-semibold text-white">
            Execute Encrypted Backup
          </button>
        </form>
      </Card>

      {restoredContent ? (
        <Card className="space-y-2 border-[#00D69A]/40">
          <div className="text-xs font-bold text-[#00D69A]">Verified Restore Output</div>
          <pre className="overflow-x-auto rounded-xl bg-[#050B18] p-3 font-mono text-xs text-[#D8E4F8]">
            {restoredContent}
          </pre>
        </Card>
      ) : null}

      <div className="space-y-3">
        {data.jobs.map((job) => (
          <Card key={job.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{job.backupName}</span>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-1 text-[11px] text-[#96A8C5]">
                {job.encryptionAlgo} • {job.fileCount} file(s) • {job.totalBytes} bytes •{' '}
                {new Date(job.createdAt).toLocaleString()}
              </div>
              {job.checksumSha256 ? (
                <div className="mt-1 font-mono text-[10px] text-[#6D84A8] break-all">
                  SHA-256: {job.checksumSha256}
                </div>
              ) : null}
            </div>
            {job.integrityVerified ? (
              <button
                type="button"
                onClick={() => void restoreBackup(job.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-3 py-1.5 text-xs font-semibold text-[#00D4FF]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Verify & Restore
              </button>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

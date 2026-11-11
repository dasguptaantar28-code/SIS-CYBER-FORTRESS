'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Globe, Plus, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import {
  Card,
  EmptyState,
  ErrorBanner,
  Modal,
  SkeletonRows,
  StatusBadge,
  ToastBanner,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';

interface AssetItem {
  id: string;
  name: string;
  assetType: string;
  targetUrl: string;
  domain: string;
  ownershipStatus: string;
  verificationMethod: string | null;
  verificationToken: string;
  isApprovedForScan: boolean;
  verifiedAt: string | null;
  _count?: { scanJobs: number };
}

export default function AssetsPage() {
  const { hasPermission, hasAnyRole } = useAuth();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('https://');
  const [notes, setNotes] = useState('');

  const loadAssets = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<AssetItem[]>('/assets');
      setAssets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load asset registry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/assets', {
        method: 'POST',
        body: JSON.stringify({ name, targetUrl, assetType: 'WEBSITE', notes }),
      });
      setModalOpen(false);
      setName('');
      setTargetUrl('https://');
      setNotes('');
      setToast({
        type: 'success',
        message: 'Website registered. Complete ownership verification before running WebShield scans.',
      });
      await loadAssets();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Create failed.' });
    }
  };

  const handleVerify = async (
    id: string,
    method: 'DNS_TXT' | 'WELL_KNOWN_HTTP' | 'ADMIN_APPROVAL',
  ) => {
    try {
      const res = await apiFetch<{ verificationDetail: string }>(`/assets/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ method, approveForScan: true }),
      });
      setToast({ type: 'success', message: res.verificationDetail });
      await loadAssets();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Verification failed.',
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Authorized Asset Registry</h1>
            <p className="text-sm text-[#96A8C5]">
              WebShield strictly enforces domain ownership verification or explicit admin approval and SSRF blocking before scanning.
            </p>
          </div>
          {hasPermission('assets:manage') ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Register Website Asset
            </button>
          ) : null}
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadAssets} /> : null}

        {loading ? (
          <SkeletonRows rows={4} />
        ) : assets.length === 0 ? (
          <EmptyState
            title="No Registered Web Assets"
            description="Register your authorized public website or API domain to verify ownership and run WebShield checks."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {assets.map((asset) => (
              <Card key={asset.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#087BFF]/15 p-2.5 text-[#00D4FF]">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">{asset.name}</h2>
                      <p className="text-xs font-mono text-[#00D4FF]">{asset.targetUrl}</p>
                    </div>
                  </div>
                  <StatusBadge status={asset.ownershipStatus} />
                </div>

                <div className="rounded-xl border border-[#1B335E] bg-[#050B18] p-3 text-xs">
                  <div className="text-[#96A8C5]">Verification Token (DNS TXT `_sis-verify.{asset.domain}` or `/.well-known/sis-cyber-fortress.txt`):</div>
                  <code className="mt-1 block break-all font-mono text-[#00D69A]">
                    {asset.verificationToken}
                  </code>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {!asset.isApprovedForScan && hasPermission('assets:manage') ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleVerify(asset.id, 'DNS_TXT')}
                          className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 text-xs font-semibold text-[#D8E4F8] hover:border-[#00D4FF]"
                        >
                          Verify DNS TXT
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleVerify(asset.id, 'WELL_KNOWN_HTTP')}
                          className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 text-xs font-semibold text-[#D8E4F8] hover:border-[#00D4FF]"
                        >
                          Verify Well-Known HTTP
                        </button>
                        {hasAnyRole(['SUPER_ADMIN', 'SECURITY_ADMIN']) ? (
                          <button
                            type="button"
                            onClick={() => void handleVerify(asset.id, 'ADMIN_APPROVAL')}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#00D69A]/15 border border-[#00D69A]/40 px-3 py-1.5 text-xs font-semibold text-[#00D69A]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Admin Scope Approve
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  {asset.isApprovedForScan ? (
                    <Link
                      href="/modules/webshield"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#087BFF] px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Scan in WebShield ({asset._count?.scanJobs ?? 0})
                    </Link>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal open={modalOpen} title="Register Authorized Web Asset" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asset Name (e.g. Organization Public Portal)"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Authorization scope notes"
              rows={3}
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
            >
              Register Asset
            </button>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

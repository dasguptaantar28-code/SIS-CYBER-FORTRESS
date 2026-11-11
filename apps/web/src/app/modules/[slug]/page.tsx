'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SeverityBadge, SkeletonRows, StatusBadge } from '@/components/ui';
import {
  IdentityGuardianPanel,
  PhishingShieldPanel,
} from '@/components/modules/IdentityPhishingPanels';
import {
  CloudBackupPanel,
  VaultGuardianPanel,
} from '@/components/modules/VaultBackupPanels';
import {
  EndpointGuardianPanel,
  NetworkSentinelPanel,
  RansomwareGuardianPanel,
  WebShieldPanel,
} from '@/components/modules/WebEndpointNetworkRansomwarePanels';
import {
  AccessGuardianPanel,
  CyberSocPanel,
  DigitalForensicsShortcutPanel,
  ThreatIntelPanel,
} from '@/components/modules/ForensicsAccessThreatSocPanels';
import { apiFetch, ApiError } from '@/lib/api';

interface ModuleDetailResponse {
  module: {
    id: string;
    code: string;
    slug: string;
    number: string;
    name: string;
    shortName: string;
    category: string;
    description: string;
    healthStatus: string;
    postureScore: number;
    openAlertCount: number;
  };
  recentAlerts: Array<{ id: string; title: string; severity: string; status: string; createdAt: string }>;
  recentAudit: Array<{ id: string; action: string; actorEmail: string | null; createdAt: string }>;
}

export default function ModuleDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [detail, setDetail] = useState<ModuleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModule = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<ModuleDetailResponse>(`/modules/${slug}`);
      setDetail(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load module telemetry.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) void loadModule();
  }, [slug, loadModule]);

  const renderPanel = () => {
    switch (slug) {
      case 'identity-guardian':
        return <IdentityGuardianPanel />;
      case 'phishing-shield':
        return <PhishingShieldPanel />;
      case 'endpoint-guardian':
        return <EndpointGuardianPanel />;
      case 'network-sentinel':
        return <NetworkSentinelPanel />;
      case 'vault-guardian':
        return <VaultGuardianPanel />;
      case 'ransomware-guardian':
        return <RansomwareGuardianPanel />;
      case 'webshield':
        return <WebShieldPanel />;
      case 'digital-forensics':
        return <DigitalForensicsShortcutPanel />;
      case 'access-guardian':
        return <AccessGuardianPanel />;
      case 'threat-intelligence':
        return <ThreatIntelPanel />;
      case 'cloud-backup':
        return <CloudBackupPanel />;
      case 'cyber-soc':
        return <CyberSocPanel />;
      default:
        return null;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <Link href="/modules" className="inline-flex items-center gap-1.5 text-xs text-[#00D4FF] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to All 12 Security Modules
        </Link>

        {error ? <ErrorBanner message={error} onRetry={loadModule} /> : null}

        {loading || !detail ? (
          <SkeletonRows rows={5} />
        ) : (
          <>
            <Card className="sis-hero-bg flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono text-[#00D4FF]">
                  MODULE {detail.module.number} • {detail.module.category}
                </div>
                <h1 className="mt-1 text-2xl font-bold text-white">{detail.module.name}</h1>
                <p className="mt-1 text-sm text-[#96A8C5]">{detail.module.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#00D69A]">{detail.module.postureScore}%</div>
                  <div className="text-[11px] text-[#96A8C5]">{detail.module.openAlertCount} open alert(s)</div>
                </div>
                <StatusBadge status={detail.module.healthStatus} />
              </div>
            </Card>

            {renderPanel()}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="space-y-3">
                <h3 className="text-sm font-bold text-white">Module Security Alerts</h3>
                {detail.recentAlerts.length === 0 ? (
                  <p className="text-xs text-[#96A8C5]">No alerts recorded for this module.</p>
                ) : (
                  detail.recentAlerts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#050B18] p-3 text-xs">
                      <span className="text-white truncate">{a.title}</span>
                      <SeverityBadge severity={a.severity} />
                    </div>
                  ))
                )}
              </Card>

              <Card className="space-y-3">
                <h3 className="text-sm font-bold text-white">Module Activity History</h3>
                {detail.recentAudit.length === 0 ? (
                  <p className="text-xs text-[#96A8C5]">No module audit activity recorded yet.</p>
                ) : (
                  detail.recentAudit.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#050B18] p-3 text-xs">
                      <span className="font-mono text-[#00D4FF]">{l.action}</span>
                      <span className="text-[#96A8C5]">
                        {l.actorEmail || 'SYSTEM'} • {new Date(l.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

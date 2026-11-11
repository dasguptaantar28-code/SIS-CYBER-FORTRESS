'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  FileSearch,
  Globe,
  HardDrive,
  Lock,
  MapPin,
  Radar,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { io } from 'socket.io-client';
import { AppShell } from '@/components/AppShell';
import { Card, ErrorBanner, SeverityBadge, SkeletonRows, StatusBadge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError, WS_BASE_URL } from '@/lib/api';

interface OverviewResponse {
  generatedAt: string;
  environment: string;
  demoSeedActive: boolean;
  kpis: {
    totalModules: number;
    activeModules: number;
    registeredDevices: number;
    compliantDevices: number;
    openSecurityAlerts: number;
    blockedThreats: number;
    activeIncidents: number;
    backupStatus: string;
    lastBackupAt: string | null;
    overallSecurityPosture: number;
    registeredAssets: number;
    forensicCases: number;
  };
  modules: Array<{
    id: string;
    code: string;
    slug: string;
    number: string;
    shortName: string;
    healthStatus: string;
    postureScore: number;
    openAlertCount: number;
    isEnabled: boolean;
  }>;
  trend7Days: Array<{
    date: string;
    label: string;
    threatsDetected: number;
    mitigatedOrScanned: number;
  }>;
  severityDistribution: Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO', number>;
  geoTelemetry: {
    hasLiveGeoData: boolean;
    note: string;
    points: Array<{
      id: string;
      title: string;
      severity: string;
      country: string | null;
      city: string | null;
      latitude: number;
      longitude: number;
    }>;
  };
  recentActivities: Array<{
    id: string;
    timestamp: string;
    event: string;
    sourceModule: string;
    moduleSlug: string;
    severity: string;
    status: string;
    target: string;
  }>;
  integrations: Array<{
    id: string;
    serviceKey: string;
    displayName: string;
    status: string;
    configured: boolean;
    details: string;
  }>;
}

const SAMPLE_GEO_POINTS = [
  { id: 'sample-1', label: 'Sample Node A (Not Live)', x: 24, y: 38 },
  { id: 'sample-2', label: 'Sample Node B (Not Live)', x: 52, y: 31 },
  { id: 'sample-3', label: 'Sample Node C (Not Live)', x: 76, y: 46 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSampleMapPreview, setShowSampleMapPreview] = useState(false);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<OverviewResponse>('/dashboard/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load SOC dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
    const socket = io(`${WS_BASE_URL}/soc`, { withCredentials: true });
    socket.on('alert:created', () => void loadOverview());
    socket.on('alert:updated', () => void loadOverview());
    socket.on('incident:created', () => void loadOverview());
    socket.on('incident:updated', () => void loadOverview());
    return () => {
      socket.disconnect();
    };
  }, [loadOverview]);

  const severityChartData = data
    ? [
        { name: 'Critical', count: data.severityDistribution.CRITICAL, color: '#FF4560' },
        { name: 'High', count: data.severityDistribution.HIGH, color: '#FF7A59' },
        { name: 'Medium', count: data.severityDistribution.MEDIUM, color: '#FFB547' },
        { name: 'Low', count: data.severityDistribution.LOW, color: '#087BFF' },
        { name: 'Info', count: data.severityDistribution.INFO, color: '#00D4FF' },
      ]
    : [];

  const posture = data?.kpis.overallSecurityPosture ?? 0;
  const ringCircumference = 2 * Math.PI * 52;
  const ringOffset = ringCircumference - (posture / 100) * ringCircumference;

  return (
    <AppShell>
      <div className="space-y-6">
        {error ? <ErrorBanner message={error} onRetry={loadOverview} /> : null}

        {/* Welcome Hero Banner */}
        <section className="sis-hero-bg rounded-3xl border border-[#1B335E] p-6 shadow-sis-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#00D4FF]">
                  Central Security Operations Command
                </span>
                {data?.demoSeedActive ? (
                  <span className="rounded-full border border-[#FFB547]/40 bg-[#FFB547]/15 px-3 py-0.5 text-[11px] font-semibold text-[#FFB547]">
                    Dev Demo Seed Data Active
                  </span>
                ) : null}
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
                Welcome back, <span className="text-[#00D4FF]">{user?.fullName.split(' ')[0]}</span>
              </h1>
              <p className="mt-1 text-sm text-[#96A8C5]">
                Unified live telemetry calculated strictly from persisted PostgreSQL records across
                12 cybersecurity modules.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[#1B335E] bg-[#050B18]/80 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      (data?.kpis.openSecurityAlerts ?? 0) > 0 &&
                      (data?.severityDistribution.CRITICAL ?? 0) > 0
                        ? 'bg-[#FF4560]'
                        : 'bg-[#00D69A]'
                    }`}
                  />
                  <span>
                    {(data?.severityDistribution.CRITICAL ?? 0) > 0
                      ? 'Critical Alerts Require Review'
                      : 'All Core Systems Operational'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[#96A8C5]">
                  Synced: {data ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadOverview()}
                className="flex items-center gap-2 rounded-xl border border-[#1B335E] bg-[#10213F] px-3.5 py-2.5 text-xs font-semibold text-[#F3F7FF] hover:border-[#00D4FF]/50"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#00D4FF]" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* 8 Live KPI Cards */}
        {loading || !data ? (
          <SkeletonRows rows={3} />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Total / Active Modules</span>
                  <Shield className="h-5 w-5 text-[#087BFF]" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{data.kpis.activeModules}</span>
                  <span className="text-sm text-[#96A8C5]">/ {data.kpis.totalModules}</span>
                </div>
                <p className="mt-1 text-xs text-[#00D69A]">All 12 modules registered in API</p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Open Security Alerts</span>
                  <ShieldAlert className="h-5 w-5 text-[#FF4560]" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {data.kpis.openSecurityAlerts}
                </div>
                <p className="mt-1 text-xs text-[#96A8C5]">
                  {data.kpis.blockedThreats} mitigated / flagged threats
                </p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Registered Devices</span>
                  <Smartphone className="h-5 w-5 text-[#00D69A]" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {data.kpis.registeredDevices}
                </div>
                <p className="mt-1 text-xs text-[#00D69A]">
                  {data.kpis.compliantDevices} compliant endpoint(s)
                </p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Backup Status</span>
                  <Cloud className="h-5 w-5 text-[#00D4FF]" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={data.kpis.backupStatus} />
                </div>
                <p className="mt-2 text-xs text-[#96A8C5]">
                  {data.kpis.lastBackupAt
                    ? `Last run: ${new Date(data.kpis.lastBackupAt).toLocaleString()}`
                    : 'No backups executed yet'}
                </p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Blocked / Flagged Threats</span>
                  <Radar className="h-5 w-5 text-[#FFB547]" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {data.kpis.blockedThreats}
                </div>
                <p className="mt-1 text-xs text-[#96A8C5]">Resolved alerts + risky scans</p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Active Incidents</span>
                  <AlertTriangle className="h-5 w-5 text-[#FFB547]" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {data.kpis.activeIncidents}
                </div>
                <p className="mt-1 text-xs text-[#96A8C5]">
                  {data.kpis.forensicCases} forensic investigation case(s)
                </p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Authorized Web Assets</span>
                  <Globe className="h-5 w-5 text-[#00D4FF]" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">
                  {data.kpis.registeredAssets}
                </div>
                <p className="mt-1 text-xs text-[#96A8C5]">WebShield verified/approved targets</p>
              </Card>

              <Card className="sis-glass-hover">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#96A8C5]">Overall Security Posture</span>
                  <ShieldCheck className="h-5 w-5 text-[#00D69A]" />
                </div>
                <div className="mt-2 text-3xl font-bold text-[#00D69A]">
                  {data.kpis.overallSecurityPosture}%
                </div>
                <p className="mt-1 text-xs text-[#96A8C5]">Computed from module & device scores</p>
              </Card>
            </section>

            {/* Security Overview + Threat Map */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Security Overview & 7-Day Telemetry
                    </h2>
                    <p className="text-xs text-[#96A8C5]">
                      Calculated from actual persisted alerts and scan jobs over the last 7 days.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
                  {/* Gauge + Checklist */}
                  <div className="flex flex-col items-center gap-4 md:col-span-5 sm:flex-row md:flex-col lg:flex-row">
                    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
                      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          stroke="#1B335E"
                          strokeWidth="10"
                          fill="none"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          stroke="#00D69A"
                          strokeWidth="10"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray={ringCircumference}
                          strokeDashoffset={ringOffset}
                        />
                      </svg>
                      <div className="absolute text-center">
                        <div className="text-2xl font-bold text-white">{posture}%</div>
                        <div className="text-[10px] uppercase tracking-wider text-[#96A8C5]">
                          Security Score
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs">
                      <li className="flex items-center gap-2 text-[#D8E4F8]">
                        <CheckCircle2 className="h-4 w-4 text-[#00D69A]" />
                        PostgreSQL Authoritative Store Online
                      </li>
                      <li className="flex items-center gap-2 text-[#D8E4F8]">
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            user?.mfaEnabled ? 'text-[#00D69A]' : 'text-[#FFB547]'
                          }`}
                        />
                        Account MFA: {user?.mfaEnabled ? 'TOTP Verified' : 'Recommended'}
                      </li>
                      <li className="flex items-center gap-2 text-[#D8E4F8]">
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            data.severityDistribution.CRITICAL === 0
                              ? 'text-[#00D69A]'
                              : 'text-[#FF4560]'
                          }`}
                        />
                        Critical Alerts: {data.severityDistribution.CRITICAL}
                      </li>
                      <li className="flex items-center gap-2 text-[#D8E4F8]">
                        <CheckCircle2
                          className={`h-4 w-4 ${
                            data.kpis.backupStatus === 'HEALTHY'
                              ? 'text-[#00D69A]'
                              : 'text-[#FFB547]'
                          }`}
                        />
                        Backup Readiness: {data.kpis.backupStatus.replace(/_/g, ' ')}
                      </li>
                    </ul>
                  </div>

                  {/* 7-day trend chart */}
                  <div className="h-56 md:col-span-7">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.trend7Days}>
                        <defs>
                          <linearGradient id="sisBlueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="sisRedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF4560" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#FF4560" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1B335E" strokeDasharray="3 3" opacity={0.45} />
                        <XAxis dataKey="label" stroke="#96A8C5" fontSize={11} />
                        <YAxis stroke="#96A8C5" fontSize={11} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0B1730',
                            borderColor: '#1B335E',
                            borderRadius: 12,
                            color: '#F3F7FF',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="mitigatedOrScanned"
                          name="Mitigated / Scanned"
                          stroke="#00D4FF"
                          fill="url(#sisBlueGrad)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="threatsDetected"
                          name="Alerts Raised"
                          stroke="#FF4560"
                          fill="url(#sisRedGrad)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              {/* Honest Threat Map */}
              <Card>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#00D4FF]" />
                    <h2 className="text-base font-semibold text-white">Threat Map</h2>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      data.geoTelemetry.hasLiveGeoData
                        ? 'bg-[#00D69A]/15 text-[#00D69A]'
                        : 'bg-[#FFB547]/15 text-[#FFB547]'
                    }`}
                  >
                    {data.geoTelemetry.hasLiveGeoData ? 'LIVE GEO DATA' : 'NO GEO DATA'}
                  </span>
                </div>

                <div className="relative h-44 overflow-hidden rounded-2xl border border-[#1B335E] bg-[#061024]">
                  {/* World dot-grid silhouette SVG */}
                  <svg viewBox="0 0 100 60" className="h-full w-full opacity-55">
                    <path
                      d="M12,18 L28,14 L32,26 L22,38 L16,32 Z M44,14 L62,12 L68,26 L56,36 L45,28 Z M70,22 L88,20 L92,38 L78,44 L71,32 Z M26,40 L34,42 L31,54 L24,52 Z M78,45 L88,46 L86,54 L76,52 Z"
                      fill="#123061"
                      stroke="#087BFF"
                      strokeWidth="0.35"
                    />
                    {data.geoTelemetry.hasLiveGeoData
                      ? data.geoTelemetry.points.map((pt) => {
                          const x = ((pt.longitude + 180) / 360) * 100;
                          const y = ((90 - pt.latitude) / 180) * 60;
                          return (
                            <g key={pt.id}>
                              <circle cx={x} cy={y} r="2.5" fill="#FF4560" opacity="0.4" />
                              <circle cx={x} cy={y} r="1.2" fill="#FF4560" />
                            </g>
                          );
                        })
                      : showSampleMapPreview
                        ? SAMPLE_GEO_POINTS.map((sp) => (
                            <g key={sp.id}>
                              <circle cx={sp.x} cy={sp.y} r="2.2" fill="#FFB547" opacity="0.45" />
                              <circle cx={sp.x} cy={sp.y} r="1.0" fill="#FFB547" />
                            </g>
                          ))
                        : null}
                  </svg>
                  {!data.geoTelemetry.hasLiveGeoData && !showSampleMapPreview ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050B18]/65 p-4 text-center">
                      <p className="text-xs font-medium text-[#D8E4F8]">
                        No geolocated threat coordinates recorded in DB.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowSampleMapPreview(true)}
                        className="mt-2 rounded-lg border border-[#1B335E] bg-[#10213F] px-3 py-1 text-[11px] text-[#00D4FF] hover:border-[#00D4FF]/60"
                      >
                        Preview Sample Layout
                      </button>
                    </div>
                  ) : null}
                </div>

                <p className="mt-3 text-xs text-[#96A8C5]">
                  {showSampleMapPreview && !data.geoTelemetry.hasLiveGeoData
                    ? 'Sample layout visualization active (not real production threat traffic).'
                    : data.geoTelemetry.note}
                </p>
              </Card>
            </section>

            {/* Quick Access + Recent Activities + System Protection */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {/* Quick Access */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Quick Access Tools</h2>
                  <Link href="/modules" className="text-xs text-[#00D4FF] hover:underline">
                    All 12 Modules →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Scan Phishing Link', href: '/modules/phishing-shield', icon: ShieldAlert },
                    { label: 'Check Website Safety', href: '/modules/webshield', icon: Globe },
                    { label: 'Open Secure Vault', href: '/modules/vault-guardian', icon: Lock },
                    { label: 'Device Security', href: '/devices', icon: Smartphone },
                    { label: 'Network Security', href: '/modules/network-sentinel', icon: Wifi },
                    { label: 'Backup Center', href: '/modules/cloud-backup', icon: Cloud },
                    { label: 'Manage Access', href: '/modules/access-guardian', icon: Users },
                    { label: 'Forensic Cases', href: '/cases', icon: FileSearch },
                  ].map((q) => {
                    const Icon = q.icon;
                    return (
                      <Link
                        key={q.href}
                        href={q.href}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#1B335E] bg-[#0B1730] p-3.5 text-center text-xs font-medium text-[#D8E4F8] transition hover:border-[#00D4FF]/60 hover:bg-[#10213F]"
                      >
                        <Icon className="h-5 w-5 text-[#00D4FF]" />
                        <span>{q.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </Card>

              {/* Recent Activities */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Recent Security Activities</h2>
                  <Link href="/alerts" className="text-xs text-[#00D4FF] hover:underline">
                    View All →
                  </Link>
                </div>
                {data.recentActivities.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#96A8C5]">
                    No recent alerts or threat events recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.recentActivities.slice(0, 6).map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[#1B335E]/70 bg-[#0B1730]/70 p-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/modules/${act.moduleSlug}`}
                            className="block truncate text-xs font-semibold text-white hover:text-[#00D4FF]"
                          >
                            {act.event}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#96A8C5]">
                            <span>{act.sourceModule}</span>
                            <span>•</span>
                            <span>{act.target}</span>
                            <span>•</span>
                            <span>{new Date(act.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <SeverityBadge severity={act.severity} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* System Protection / Module Health */}
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">System Protection Health</h2>
                  <Link href="/modules" className="text-xs text-[#00D4FF] hover:underline">
                    Manage →
                  </Link>
                </div>
                <div className="space-y-3">
                  {data.modules.slice(0, 6).map((mod) => (
                    <Link
                      key={mod.id}
                      href={`/modules/${mod.slug}`}
                      className="block rounded-xl border border-transparent p-1.5 hover:border-[#1B335E] hover:bg-[#0B1730]/60"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#D8E4F8]">{mod.shortName}</span>
                        <span className="font-mono text-[#00D69A]">{mod.postureScore}%</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#050B18]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#087BFF] to-[#00D69A]"
                          style={{ width: `${mod.postureScore}%` }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </section>

            {/* Severity Distribution + External Integration Status */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="mb-3 text-base font-semibold text-white">
                  Alert Severity Distribution
                </h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityChartData}>
                      <CartesianGrid stroke="#1B335E" strokeDasharray="3 3" opacity={0.45} />
                      <XAxis dataKey="name" stroke="#96A8C5" fontSize={12} />
                      <YAxis stroke="#96A8C5" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0B1730',
                          borderColor: '#1B335E',
                          borderRadius: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {severityChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">
                    Integration & Feed Status
                  </h2>
                  <HardDrive className="h-4 w-4 text-[#00D4FF]" />
                </div>
                <div className="space-y-2.5">
                  {data.integrations.map((intg) => (
                    <div
                      key={intg.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1B335E]/70 bg-[#0B1730]/60 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">{intg.displayName}</div>
                        <div className="text-[11px] text-[#96A8C5]">{intg.details}</div>
                      </div>
                      <StatusBadge status={intg.status} />
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import {
  Activity,
  Bell,
  ChevronDown,
  Cloud,
  Database,
  FileSearch,
  FileText,
  Globe,
  HardDriveDownload,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { SECURITY_MODULES } from '@sis/shared-contracts';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, WS_BASE_URL } from '@/lib/api';
import { Modal } from './ui';

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'identity-guardian': KeyRound,
  'phishing-shield': ShieldAlert,
  'endpoint-guardian': Smartphone,
  'network-sentinel': Wifi,
  'vault-guardian': Lock,
  'ransomware-guardian': Database,
  webshield: Globe,
  'digital-forensics': FileSearch,
  'access-guardian': Users,
  'threat-intelligence': Radar,
  'cloud-backup': Cloud,
  'cyber-soc': ShieldCheck,
};

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, hasPermission } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modulesExpanded, setModulesExpanded] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [apiHealth, setApiHealth] = useState<'CONNECTED' | 'DEGRADED'>('CONNECTED');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const loadHeaderStatus = async () => {
      try {
        const [notifRes, healthRes] = await Promise.all([
          apiFetch<{ unreadCount: number }>('/notifications'),
          apiFetch<{ status: string }>('/health'),
        ]);
        setUnreadNotifications(notifRes.unreadCount || 0);
        setApiHealth(healthRes.status === 'HEALTHY' ? 'CONNECTED' : 'DEGRADED');
      } catch {
        setApiHealth('DEGRADED');
      }
    };
    void loadHeaderStatus();

    const socket = io(`${WS_BASE_URL}/soc`, { withCredentials: true });
    socket.on('notification:new', () => {
      setUnreadNotifications((c) => c + 1);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      socket.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user]);

  useEffect(() => {
    if (!searchOpen || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ results: SearchResult[] }>(
          `/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`,
        );
        setSearchResults(res.results || []);
      } catch {
        setSearchResults([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [searchOpen, searchQuery]);

  const primaryNav = useMemo(
    () => [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
      { label: 'All 12 Modules', href: '/modules', icon: Shield, show: true },
      { label: 'Device Management', href: '/devices', icon: Smartphone, show: hasPermission('devices:read') },
      { label: 'Asset Registry', href: '/assets', icon: Globe, show: hasPermission('assets:read') },
      { label: 'Security Alerts', href: '/alerts', icon: ShieldAlert, show: hasPermission('alerts:read') },
      { label: 'Incident Management', href: '/incidents', icon: Activity, show: hasPermission('incidents:read') },
      { label: 'Digital Forensics Cases', href: '/cases', icon: FileSearch, show: hasPermission('forensics:read') },
      { label: 'Users', href: '/users', icon: Users, show: hasPermission('users:read') },
      { label: 'Roles & Permissions', href: '/roles', icon: KeyRound, show: hasPermission('roles:read') },
      { label: 'Reports & Exports', href: '/reports', icon: FileText, show: hasPermission('reports:read') },
      { label: 'Activity Logs', href: '/audit-logs', icon: HardDriveDownload, show: hasPermission('audit:read') },
      { label: 'Notifications', href: '/notifications', icon: Bell, show: true },
      { label: 'Settings', href: '/settings', icon: Settings, show: hasPermission('settings:read') },
      { label: 'Help & Support', href: '/help', icon: HelpCircle, show: true },
    ],
    [hasPermission],
  );

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050B18] text-[#96A8C5]">
        <div className="flex flex-col items-center gap-3">
          <Shield className="h-10 w-10 animate-pulse text-[#00D4FF]" />
          <p className="text-sm font-medium tracking-wide">Verifying SIS Cyber Fortress Session...</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#081226] border-r border-[#1B335E]/70">
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1B335E]/60">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
          <img
            src="/images/sis-cyber-fortress-logo.jpg"
            alt="SIS Cyber Fortress Logo"
            className="h-10 w-10 rounded-xl border border-[#00D4FF]/40 object-cover shadow-sis-glow"
          />
          <div>
            <div className="text-sm font-bold tracking-wider text-[#F3F7FF]">
              SIS <span className="text-[#00D4FF]">CYBER FORTRESS</span>
            </div>
            <div className="text-[10px] tracking-widest text-[#96A8C5] uppercase">
              Secure • Monitor • Protect
            </div>
          </div>
        </Link>
        <button
          type="button"
          className="rounded-lg p-1.5 text-[#96A8C5] hover:bg-[#10213F] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {primaryNav
          .filter((item) => item.show)
          .slice(0, 2)
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-[#087BFF] to-[#00A8E8] text-white shadow-sis-glow'
                    : 'text-[#96A8C5] hover:bg-[#10213F] hover:text-[#F3F7FF]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

        <div className="pt-3">
          <button
            type="button"
            onClick={() => setModulesExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#6D84A8] hover:text-[#00D4FF]"
          >
            <span>12 Security Modules</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${modulesExpanded ? '' : '-rotate-90'}`} />
          </button>

          {modulesExpanded ? (
            <div className="mt-1 space-y-0.5">
              {SECURITY_MODULES.map((mod) => {
                const href = `/modules/${mod.slug}`;
                const active = pathname === href;
                const Icon = MODULE_ICONS[mod.slug] || Shield;
                return (
                  <Link
                    key={mod.slug}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                      active
                        ? 'bg-[#087BFF]/20 text-[#00D4FF] border border-[#00D4FF]/35 font-semibold'
                        : 'text-[#96A8C5] hover:bg-[#10213F]/80 hover:text-[#F3F7FF]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#00D4FF]/80" />
                    <span className="truncate">{mod.shortName}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="pt-3">
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#6D84A8]">
            Operations & Governance
          </div>
          <div className="mt-1 space-y-0.5">
            {primaryNav
              .filter((item) => item.show)
              .slice(2)
              .map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-[#087BFF]/20 text-[#00D4FF] border border-[#00D4FF]/35 font-semibold'
                        : 'text-[#96A8C5] hover:bg-[#10213F] hover:text-[#F3F7FF]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      </nav>

      <div className="border-t border-[#1B335E]/70 p-3">
        <div className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#F3F7FF]">
            <span>SIS Cyber Fortress v1.0.0</span>
            <span
              className={`h-2 w-2 rounded-full ${
                apiHealth === 'CONNECTED' ? 'bg-[#00D69A]' : 'bg-[#FFB547]'
              }`}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-[#96A8C5]">
            Backend API: {apiHealth === 'CONNECTED' ? 'Connected (Live)' : 'Degraded'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#050B18] text-[#F3F7FF]">
      {/* Desktop fixed sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile slide-over drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw]">{sidebarContent}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#1B335E]/70 bg-[#050B18]/90 px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl border border-[#1B335E] bg-[#0B1730] p-2 text-[#96A8C5] hover:text-white lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-[#1B335E] bg-[#0B1730] px-3.5 py-2 text-left text-sm text-[#96A8C5] hover:border-[#00D4FF]/50"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-4 w-4 shrink-0 text-[#00D4FF]" />
                <span className="truncate">Search modules, alerts, devices, IOCs...</span>
              </span>
              <kbd className="hidden rounded bg-[#10213F] px-2 py-0.5 text-[11px] font-mono text-[#96A8C5] sm:inline-block">
                Ctrl + K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              className="relative rounded-xl border border-[#1B335E] bg-[#0B1730] p-2.5 text-[#96A8C5] hover:border-[#00D4FF]/50 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF4560] px-1 text-[10px] font-bold text-white">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              ) : null}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 hover:border-[#00D4FF]/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#087BFF] to-[#00D4FF] text-xs font-bold text-white">
                  {user.fullName
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-xs font-semibold text-[#F3F7FF] leading-tight">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-[#00D4FF] leading-tight">
                    {user.roles[0]?.replace(/_/g, ' ') || 'USER'}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-[#96A8C5]" />
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#1B335E] bg-[#0B1730] p-2 shadow-2xl">
                  <div className="border-b border-[#1B335E] px-3 py-2">
                    <div className="text-xs font-semibold text-white truncate">{user.email}</div>
                    <div className="text-[11px] text-[#96A8C5]">
                      MFA: {user.mfaEnabled ? 'TOTP Active' : 'Not Configured'}
                    </div>
                  </div>
                  <Link
                    href="/modules/identity-guardian"
                    onClick={() => setAccountMenuOpen(false)}
                    className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-[#96A8C5] hover:bg-[#10213F] hover:text-white"
                  >
                    <KeyRound className="h-4 w-4" /> Identity & MFA Security
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setAccountMenuOpen(false);
                      await logout();
                      router.replace('/login');
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-[#FF8A9B] hover:bg-[#FF4560]/15"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* Global Search Modal */}
      <Modal
        open={searchOpen}
        title="Global Cyber Fortress Search"
        onClose={() => setSearchOpen(false)}
      >
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type at least 2 characters (e.g. Phishing, example.com, Pixel)..."
            className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-4 py-2.5 text-sm text-white outline-none focus:border-[#00D4FF]"
          />
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#96A8C5]">
                {searchQuery.trim().length < 2
                  ? 'Search across modules, alerts, devices, verified assets, and threat IOCs.'
                  : 'No matching persisted records found.'}
              </p>
            ) : (
              searchResults.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    router.push(item.href);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-[#1B335E]/60 bg-[#0B1730] px-3 py-2.5 text-left hover:border-[#00D4FF]/60"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{item.title}</div>
                    <div className="text-xs text-[#96A8C5]">{item.subtitle}</div>
                  </div>
                  <span className="rounded bg-[#10213F] px-2 py-0.5 text-[10px] font-semibold text-[#00D4FF]">
                    {item.type}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

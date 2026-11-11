'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`sis-glass rounded-2xl p-5 shadow-sis-card transition-all ${className}`}>
      {children}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || 'INFO').toUpperCase();
  const styles: Record<string, string> = {
    CRITICAL: 'bg-[#FF4560]/20 text-[#FF6B81] border-[#FF4560]/40',
    HIGH: 'bg-[#FF4560]/15 text-[#FF8A9B] border-[#FF4560]/30',
    HIGH_RISK: 'bg-[#FF4560]/20 text-[#FF6B81] border-[#FF4560]/40',
    MEDIUM: 'bg-[#FFB547]/15 text-[#FFB547] border-[#FFB547]/35',
    SUSPICIOUS: 'bg-[#FFB547]/15 text-[#FFB547] border-[#FFB547]/35',
    MEDIUM_RISK: 'bg-[#FFB547]/15 text-[#FFB547] border-[#FFB547]/35',
    LOW: 'bg-[#087BFF]/15 text-[#5CA9FF] border-[#087BFF]/35',
    LOW_RISK: 'bg-[#00D69A]/15 text-[#00D69A] border-[#00D69A]/35',
    INFO: 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF]/30',
    NO_KNOWN_THREATS_FOUND: 'bg-[#00D69A]/15 text-[#00D69A] border-[#00D69A]/35',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${
        styles[s] || styles.INFO
      }`}
    >
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || 'UNKNOWN').toUpperCase();
  const green = [
    'HEALTHY',
    'COMPLIANT',
    'VERIFIED',
    'APPROVED',
    'VERIFIED_SUCCESS',
    'RESTORED',
    'RESOLVED',
    'CLOSED',
    'ACTIVE',
    'CONFIGURED',
    'CONNECTED',
    'COMPLETED',
  ];
  const amber = [
    'PENDING',
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'INVESTIGATING',
    'CONTAINED',
    'AT_RISK',
    'DEGRADED',
    'LOCAL_ONLY',
    'UNCONFIGURED',
    'NOT_RUN_YET',
  ];
  const red = ['OPEN', 'FAILED', 'NON_COMPLIANT', 'SUSPENDED', 'LOCKED', 'OFFLINE', 'REVOKED'];

  const cls = green.includes(s)
    ? 'bg-[#00D69A]/15 text-[#00D69A] border-[#00D69A]/35'
    : red.includes(s)
      ? 'bg-[#FF4560]/15 text-[#FF6B81] border-[#FF4560]/35'
      : amber.includes(s)
        ? 'bg-[#FFB547]/15 text-[#FFB547] border-[#FFB547]/35'
        : 'bg-[#087BFF]/15 text-[#5CA9FF] border-[#087BFF]/35';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1B335E] bg-[#0B1730]/50 px-6 py-12 text-center">
      <Info className="mb-3 h-8 w-8 text-[#00D4FF]" />
      <h3 className="text-base font-semibold text-[#F3F7FF]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[#96A8C5]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 animate-pulse rounded-xl border border-[#1B335E]/50 bg-[#10213F]/50"
        />
      ))}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FF4560]/40 bg-[#FF4560]/10 px-4 py-3 text-sm text-[#FF9EAA]">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-[#FF4560]" />
        <span>{message}</span>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-[#FF4560]/40 px-3 py-1 text-xs font-semibold hover:bg-[#FF4560]/20"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function ToastBanner({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}) {
  const cls =
    type === 'success'
      ? 'border-[#00D69A]/40 bg-[#00D69A]/15 text-[#7BF2CB]'
      : type === 'error'
        ? 'border-[#FF4560]/40 bg-[#FF4560]/15 text-[#FF9EAA]'
        : 'border-[#00D4FF]/40 bg-[#00D4FF]/15 text-[#86EAFF]';

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <div className="flex items-center gap-2">
        {type === 'success' ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : type === 'error' ? (
          <ShieldAlert className="h-4 w-4 shrink-0" />
        ) : (
          <Info className="h-4 w-4 shrink-0" />
        )}
        <span>{message}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss message">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="sis-glass w-full max-w-lg rounded-2xl p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-[#1B335E] pb-3">
          <h3 className="text-lg font-semibold text-[#F3F7FF]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#96A8C5] hover:bg-[#10213F] hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

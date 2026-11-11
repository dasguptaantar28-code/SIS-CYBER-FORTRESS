'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import {
  Card,
  EmptyState,
  ErrorBanner,
  SeverityBadge,
  SkeletonRows,
  StatusBadge,
} from '@/components/ui';
import { apiFetch, ApiError } from '@/lib/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: string;
  moduleCode: string;
  deepLink: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushStatus, setPushStatus] = useState('UNCONFIGURED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<{
        items: NotificationItem[];
        unreadCount: number;
        pushProviderStatus: string;
      }>('/notifications');
      setItems(res.items);
      setUnreadCount(res.unreadCount);
      setPushStatus(res.pushProviderStatus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    await loadNotifications();
  };

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    await loadNotifications();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Security Notification Center</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#96A8C5]">
              <span>Unread: {unreadCount}</span>
              <span>•</span>
              <span>Firebase Push Status:</span>
              <StatusBadge status={pushStatus} />
            </div>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#087BFF] px-3.5 py-2 text-xs font-semibold text-white"
            >
              <CheckCheck className="h-4 w-4" /> Mark All Read
            </button>
          ) : null}
        </div>

        {error ? <ErrorBanner message={error} onRetry={loadNotifications} /> : null}

        {loading ? (
          <SkeletonRows rows={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="All Clear — No Notifications"
            description="Security alerts, backup outcomes, suspicious login warnings, and incident assignments appear here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <Card
                key={n.id}
                className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                  n.isRead ? 'opacity-75' : 'border-[#00D4FF]/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Bell className="h-4 w-4 text-[#00D4FF]" />
                    <span className="text-sm font-semibold text-white">{n.title}</span>
                    <SeverityBadge severity={n.severity} />
                    {!n.isRead ? (
                      <span className="rounded-full bg-[#087BFF] px-2 py-0.5 text-[10px] font-bold text-white">
                        UNREAD
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[#96A8C5]">{n.message}</p>
                  <p className="text-[11px] text-[#6D84A8]">
                    {n.moduleCode} • {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.deepLink ? (
                    <Link
                      href={n.deepLink}
                      className="rounded-xl border border-[#1B335E] bg-[#0B1730] px-3 py-1.5 text-xs font-semibold text-[#00D4FF]"
                    >
                      Inspect
                    </Link>
                  ) : null}
                  {!n.isRead ? (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="rounded-xl bg-[#10213F] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Mark Read
                    </button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

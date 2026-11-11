'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Smartphone, Trash2 } from 'lucide-react';
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

interface DeviceItem {
  id: string;
  deviceName: string;
  platform: string;
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
  securityPatchLevel: string | null;
  complianceStatus: string;
  postureScore: number;
  screenLockEnabled: boolean;
  encryptionEnabled: boolean;
  biometricSupported: boolean;
  isRootedOrCompromised: boolean;
  installedAppCount: number | null;
  highRiskPermissionCount: number | null;
  lastSeenAt: string;
  user?: { email: string; fullName: string };
}

export default function DevicesPage() {
  const { hasPermission } = useAuth();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [deviceName, setDeviceName] = useState('');
  const [platform, setPlatform] = useState('ANDROID');
  const [osVersion, setOsVersion] = useState('Android 15');
  const [deviceIdentifier, setDeviceIdentifier] = useState('');

  const loadDevices = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<DeviceItem[]>('/devices');
      setDevices(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          deviceName,
          platform,
          osVersion,
          deviceIdentifier: deviceIdentifier || `web-reg-${Date.now()}`,
          screenLockEnabled: true,
          encryptionEnabled: true,
          biometricSupported: platform === 'ANDROID',
          isRootedOrCompromised: false,
        }),
      });
      setModalOpen(false);
      setDeviceName('');
      setDeviceIdentifier('');
      setToast({ type: 'success', message: 'Device registered & posture evaluated.' });
      await loadDevices();
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof ApiError ? err.message : 'Device registration failed.',
      });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/devices/${id}`, { method: 'DELETE' });
      setToast({ type: 'success', message: 'Device removed from active inventory.' });
      await loadDevices();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Remove failed.' });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Device Management & Endpoint Posture</h1>
            <p className="text-sm text-[#96A8C5]">
              Synced from Android Endpoint Guardian APK and authorized workstations (read-only posture checks; zero covert monitoring).
            </p>
          </div>
          {hasPermission('devices:manage') ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087BFF] px-4 py-2.5 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Register Device
            </button>
          ) : null}
        </div>

        {toast ? (
          <ToastBanner type={toast.type} message={toast.message} onClose={() => setToast(null)} />
        ) : null}
        {error ? <ErrorBanner message={error} onRetry={loadDevices} /> : null}

        {loading ? (
          <SkeletonRows rows={4} />
        ) : devices.length === 0 ? (
          <EmptyState
            title="No Registered Devices Yet"
            description="Sign in from the SIS Cyber Fortress Android APK or register a device here to inspect compliance posture."
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-[#1B335E] text-[#96A8C5] uppercase">
                <tr>
                  <th className="pb-3 font-semibold">Device</th>
                  <th className="pb-3 font-semibold">Owner</th>
                  <th className="pb-3 font-semibold">Platform / OS</th>
                  <th className="pb-3 font-semibold">Security Controls</th>
                  <th className="pb-3 font-semibold">Score</th>
                  <th className="pb-3 font-semibold">Compliance</th>
                  <th className="pb-3 font-semibold">Last Seen</th>
                  <th className="pb-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B335E]/50">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-[#0B1730]/50">
                    <td className="py-3.5 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-[#00D4FF]" />
                        <div>
                          <div>{d.deviceName}</div>
                          <div className="text-[11px] font-normal text-[#96A8C5]">
                            {[d.manufacturer, d.model].filter(Boolean).join(' ') || 'Standard Host'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 text-[#D8E4F8]">{d.user?.email || '—'}</td>
                    <td className="py-3.5 text-[#D8E4F8]">
                      {d.platform} • {d.osVersion || 'Unknown'}
                    </td>
                    <td className="py-3.5 text-[#96A8C5]">
                      Lock: {d.screenLockEnabled ? 'Yes' : 'No'} | Enc:{' '}
                      {d.encryptionEnabled ? 'Yes' : 'No'} | Bio:{' '}
                      {d.biometricSupported ? 'Yes' : 'No'}
                    </td>
                    <td className="py-3.5 font-mono font-bold text-[#00D69A]">{d.postureScore}%</td>
                    <td className="py-3.5">
                      <StatusBadge status={d.complianceStatus} />
                    </td>
                    <td className="py-3.5 text-[#96A8C5]">
                      {new Date(d.lastSeenAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right">
                      {hasPermission('devices:manage') ? (
                        <button
                          type="button"
                          onClick={() => void handleRemove(d.id)}
                          className="rounded-lg p-1.5 text-[#FF8A9B] hover:bg-[#FF4560]/15"
                          title="Remove device"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Modal open={modalOpen} title="Register Endpoint Device" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              required
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Device Name (e.g. Pixel 8 Pro Work)"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            >
              <option value="ANDROID">ANDROID</option>
              <option value="WINDOWS">WINDOWS</option>
              <option value="LINUX">LINUX</option>
              <option value="MACOS">MACOS</option>
            </select>
            <input
              type="text"
              value={osVersion}
              onChange={(e) => setOsVersion(e.target.value)}
              placeholder="OS Version (e.g. Android 15)"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <input
              type="text"
              value={deviceIdentifier}
              onChange={(e) => setDeviceIdentifier(e.target.value)}
              placeholder="Unique Device Identifier (optional)"
              className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
            >
              Register & Evaluate Posture
            </button>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

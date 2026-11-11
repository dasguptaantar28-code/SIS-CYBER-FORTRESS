'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { IdentityGuardianPanel } from '@/components/modules/IdentityPhishingPanels';
import { useAuth } from '@/hooks/useAuth';

export default function MfaPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Multi-Factor Authentication (TOTP)</h1>
        <IdentityGuardianPanel />
      </div>
    </AppShell>
  );
}

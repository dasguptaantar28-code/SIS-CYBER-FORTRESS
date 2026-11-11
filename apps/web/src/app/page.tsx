'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login');
    }
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050B18] text-[#96A8C5]">
      <div className="flex flex-col items-center gap-3">
        <Shield className="h-10 w-10 animate-pulse text-[#00D4FF]" />
        <p className="text-sm">Initializing SIS Cyber Fortress...</p>
      </div>
    </div>
  );
}

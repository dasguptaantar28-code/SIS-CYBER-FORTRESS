'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ShieldPlus, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050B18] p-4 sis-hero-bg">
      <div className="sis-glass w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="text-center">
          <img
            src="/images/sis-cyber-fortress-logo.jpg"
            alt="SIS Cyber Fortress"
            className="mx-auto h-16 w-16 rounded-2xl border border-[#00D4FF]/40 object-cover"
          />
          <h1 className="mt-3 text-xl font-bold text-white">Create Fortress Account</h1>
          <p className="mt-1 text-xs text-[#96A8C5]">
            Standard accounts receive least-privilege Regular User permissions by default.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#FF4560]/40 bg-[#FF4560]/10 px-4 py-3 text-sm text-[#FF9EAA]">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#96A8C5]">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-[#96A8C5]" />
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ayesha Rahman"
                className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#00D4FF]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#96A8C5]">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#96A8C5]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#00D4FF]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[#96A8C5]">
              Strong Password (min 10 chars, mixed case + number + symbol)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#96A8C5]" />
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Fortress#2026!"
                className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#00D4FF]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#00A8E8] py-3 text-sm font-semibold text-white"
          >
            <ShieldPlus className="h-4 w-4" />
            {submitting ? 'Provisioning Account...' : 'Register Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[#96A8C5]">
          Already registered?{' '}
          <Link href="/login" className="text-[#00D4FF] hover:underline">
            Return to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ message: string }>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed.');
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ message: string }>('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset confirmation failed.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050B18] p-4 sis-hero-bg">
      <div className="sis-glass w-full max-w-md rounded-3xl p-8">
        <div className="flex items-center gap-3">
          <KeyRound className="h-7 w-7 text-[#00D4FF]" />
          <div>
            <h1 className="text-lg font-bold text-white">Password Recovery</h1>
            <p className="text-xs text-[#96A8C5]">One-time hashed token reset flow</p>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-[#00D69A]/40 bg-[#00D69A]/15 px-4 py-3 text-xs text-[#8EF5D6]">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-[#FF4560]/40 bg-[#FF4560]/15 px-4 py-3 text-xs text-[#FF9EAA]">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleRequest} className="mt-5 space-y-3 border-b border-[#1B335E] pb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#96A8C5]">
            1. Request Reset Token
          </h2>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Account email"
            className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00D4FF]"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[#087BFF] py-2.5 text-sm font-semibold text-white"
          >
            Request Recovery Token
          </button>
        </form>

        <form onSubmit={handleConfirm} className="mt-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#96A8C5]">
            2. Confirm New Password
          </h2>
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="One-time reset token"
            className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00D4FF]"
          />
          <input
            type="password"
            required
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New strong password"
            className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#00D4FF]"
          />
          <button
            type="submit"
            className="w-full rounded-xl border border-[#00D4FF]/50 bg-[#00D4FF]/15 py-2.5 text-sm font-semibold text-[#00D4FF]"
          >
            Update Password & Revoke Old Sessions
          </button>
        </form>

        <div className="mt-5 text-center text-xs">
          <Link href="/login" className="text-[#96A8C5] hover:text-[#00D4FF]">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

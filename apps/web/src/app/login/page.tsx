'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (res.mfaRequired && res.challengeToken) {
        setMfaChallengeToken(res.challengeToken);
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyMfa(mfaChallengeToken, mfaCode);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid TOTP verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050B18] p-4 sis-hero-bg">
      <div className="sis-glass w-full max-w-md rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <img
            src="/images/sis-cyber-fortress-logo.jpg"
            alt="SIS Cyber Fortress"
            className="h-20 w-20 rounded-2xl border border-[#00D4FF]/40 object-cover shadow-sis-glow"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-wide text-white">
            SIS <span className="text-[#00D4FF]">CYBER FORTRESS</span>
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#96A8C5]">
            Secure • Monitor • Protect
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-[#FF4560]/40 bg-[#FF4560]/10 px-4 py-3 text-sm text-[#FF9EAA]">
            {error}
          </div>
        ) : null}

        {!mfaChallengeToken ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#96A8C5]">
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#96A8C5]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sisfortress.local"
                  className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#00D4FF]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#96A8C5]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#96A8C5]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-[#00D4FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087BFF] to-[#00A8E8] py-3 text-sm font-semibold text-white shadow-sis-glow hover:opacity-95 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {submitting ? 'Authenticating...' : 'Sign In to Security Command'}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs text-[#96A8C5]">
              <Link href="/reset-password" className="hover:text-[#00D4FF]">
                Forgot password?
              </Link>
              <Link href="/register" className="text-[#00D4FF] hover:underline">
                Create account
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyMfa} className="mt-6 space-y-4">
            <div className="rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/10 p-3 text-xs text-[#A3F0FF]">
              TOTP Multi-Factor Authentication is enabled on your account. Enter the 6-digit code
              from your authenticator app.
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#96A8C5]">
                6-Digit TOTP Verification Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[#00D4FF]" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-[#1B335E] bg-[#050B18] py-2.5 pl-10 pr-4 text-center font-mono text-lg tracking-[0.4em] text-white outline-none focus:border-[#00D4FF]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-[#087BFF] to-[#00A8E8] py-3 text-sm font-semibold text-white"
            >
              {submitting ? 'Verifying Code...' : 'Verify & Unlock Session'}
            </button>
          </form>
        )}

        <p className="mt-6 border-t border-[#1B335E]/60 pt-4 text-center text-[11px] text-[#6D84A8]">
          Sessions use HttpOnly SameSite cookies. Credentials and Vault secrets are never stored in
          browser localStorage.
        </p>
      </div>
    </div>
  );
}

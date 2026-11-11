'use client';

import React from 'react';
import { BookOpen, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui';

export default function HelpPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Help, Ethical Scope & Platform Disclosures</h1>
          <p className="text-sm text-[#96A8C5]">
            Transparency on defensive boundaries, Android OS restrictions, and zero-knowledge cryptography.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-[#00D4FF]">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-base font-bold text-white">Authorized Defensive Scope Only</h2>
            </div>
            <p className="text-xs leading-relaxed text-[#96A8C5]">
              SIS WebShield only evaluates domains whose ownership has been verified via DNS TXT,
              well-known HTTP proof, or explicit administrator approval. Private, loopback, and cloud
              metadata networks are blocked at both URL validation and DNS resolution stages to prevent SSRF.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-[#00D4FF]">
              <Smartphone className="h-5 w-5" />
              <h2 className="text-base font-bold text-white">Android OS Privacy & Policy Boundaries</h2>
            </div>
            <p className="text-xs leading-relaxed text-[#96A8C5]">
              The native Android app respects package visibility limits (Android 11+) and Wi-Fi SSID
              location restrictions. If a permission is declined or restricted by the manufacturer/OS,
              Endpoint Guardian and Network Sentinel explicitly report the field as unavailable instead
              of fabricating a result.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-[#00D4FF]">
              <Lock className="h-5 w-5" />
              <h2 className="text-base font-bold text-white">Zero-Knowledge Vault Architecture</h2>
            </div>
            <p className="text-xs leading-relaxed text-[#96A8C5]">
              All Vault Guardian titles, passwords, secure notes, and document payloads are encrypted
              client-side using PBKDF2-SHA256 (600,000 iterations) and AES-256-GCM before transmission.
              Neither the Super Admin nor backend logs can read your plaintext vault items.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 text-[#00D4FF]">
              <BookOpen className="h-5 w-5" />
              <h2 className="text-base font-bold text-white">API Documentation & Testing</h2>
            </div>
            <p className="text-xs leading-relaxed text-[#96A8C5]">
              Interactive OpenAPI (Swagger) documentation is served by the NestJS backend at{' '}
              <code className="text-[#00D4FF]">/api/docs</code>. Identity Guardian breach checks use
              privacy-preserving 5-character SHA-1 k-anonymity prefixes and never send plaintext
              passwords.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

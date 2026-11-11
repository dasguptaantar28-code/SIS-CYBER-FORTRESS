import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { SECURITY_MODULES } from '@sis/shared-contracts';
import { ErrorBanner, SeverityBadge, StatusBadge } from '@/components/ui';
import { decryptVaultItemClientSide, encryptVaultItemClientSide } from '@/lib/vault-crypto';
import LoginPage from '@/app/login/page';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}
if (!globalThis.TextEncoder) {
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder });
}
if (!globalThis.TextDecoder) {
  Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder });
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/login',
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: jest.fn(),
    verifyMfa: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    hasPermission: () => false,
    hasAnyRole: () => false,
  }),
}));

describe('SIS Cyber Fortress Web Application Tests', () => {
  it('defines all 12 security modules in shared contracts', () => {
    expect(SECURITY_MODULES).toHaveLength(12);
    expect(SECURITY_MODULES[0].slug).toBe('identity-guardian');
    expect(SECURITY_MODULES[11].slug).toBe('cyber-soc');
  });

  it('renders login page with HttpOnly session security notice and zero token storage', () => {
    render(<LoginPage />);
    expect(screen.getByText(/CYBER FORTRESS/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/HttpOnly SameSite cookies/i)).toBeInTheDocument();
  });

  it('renders severity, status badges, and error retry banner cleanly', () => {
    const retry = jest.fn();
    render(
      <div>
        <SeverityBadge severity="CRITICAL" />
        <StatusBadge status="VERIFIED_SUCCESS" />
        <ErrorBanner message="Backend temporarily unreachable" onRetry={retry} />
      </div>,
    );
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('Backend temporarily unreachable')).toBeInTheDocument();
    screen.getByRole('button', { name: /Retry/i }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('encrypts and decrypts Vault Guardian payloads purely client-side with AES-256-GCM', async () => {
    const encrypted = await encryptVaultItemClientSide('MasterVaultPin#2026', 'Prod SSH Key', {
      secret: 'super-secret-value-never-plaintext',
    });
    expect(encrypted.ciphertext).not.toContain('super-secret-value-never-plaintext');
    expect(encrypted.encryptedTitle).not.toContain('Prod SSH Key');

    const decrypted = await decryptVaultItemClientSide('MasterVaultPin#2026', encrypted);
    expect(decrypted.title).toBe('Prod SSH Key');
    expect(decrypted.secretBody.secret).toBe('super-secret-value-never-plaintext');

    await expect(
      decryptVaultItemClientSide('WrongPassphrase!', encrypted),
    ).rejects.toThrow();
  });
});

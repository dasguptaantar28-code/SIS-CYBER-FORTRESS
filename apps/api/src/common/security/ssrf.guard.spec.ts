import {
  decryptAes256Gcm,
  encryptAes256Gcm,
  escapeCsvCell,
  hashSecretArgon2id,
  verifySecretArgon2id,
} from './crypto.util';
import { isPrivateOrReservedIp, validateSafeOutboundUrl } from './ssrf.guard';

describe('Security Utilities & SSRF Policy Guard', () => {
  it('blocks private, loopback, link-local, CGNAT, and IPv6 local addresses', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.2.2')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.5.4')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);

    // Public IPs allowed
    expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
  });

  it('rejects unsafe schemes, credentials, localhost, and private targets in URLs', async () => {
    await expect(validateSafeOutboundUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(validateSafeOutboundUrl('https://user:pass@example.com')).rejects.toThrow();
    await expect(validateSafeOutboundUrl('http://localhost:4000')).rejects.toThrow();
    await expect(validateSafeOutboundUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
    await expect(validateSafeOutboundUrl('https://example.com:8443')).rejects.toThrow();
    await expect(validateSafeOutboundUrl('http://192.168.0.10')).rejects.toThrow();
  });

  it('hashes and verifies passwords with Argon2id', async () => {
    const hash = await hashSecretArgon2id('Fortress#Strong2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifySecretArgon2id(hash, 'Fortress#Strong2026!')).resolves.toBe(true);
    await expect(verifySecretArgon2id(hash, 'WrongPassword123!')).resolves.toBe(false);
  });

  it('encrypts and decrypts authenticated AES-256-GCM envelopes and detects tampering', () => {
    const key = 'test-master-envelope-secret-material';
    const env = encryptAes256Gcm('confidential-backup-content', key);
    const decrypted = decryptAes256Gcm(env, key).toString('utf8');
    expect(decrypted).toBe('confidential-backup-content');

    const tampered = { ...env, authTag: Buffer.from('0000000000000000').toString('base64') };
    expect(() => decryptAes256Gcm(tampered, key)).toThrow();
  });

  it('neutralizes CSV formula injection cells', () => {
    expect(escapeCsvCell('=CMD|"/C calc"!A0')).toBe('"\'=CMD|""/C calc""!A0"');
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(escapeCsvCell('normal-value')).toBe('"normal-value"');
  });
});

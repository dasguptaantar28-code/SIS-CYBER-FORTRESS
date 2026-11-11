import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Algorithm, hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

export async function hashSecretArgon2id(secret: string): Promise<string> {
  return argon2Hash(secret, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifySecretArgon2id(digest: string, plain: string): Promise<boolean> {
  try {
    return await argon2Verify(digest, plain);
  } catch {
    return false;
  }
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha1Hex(input: string | Buffer): string {
  return createHash('sha1').update(input).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Derives a deterministic 32-byte key from a configured secret string via SHA-256.
 * Used exclusively for server-side TOTP secret wrapping and backup envelope encryption
 * (never used for Vault Guardian client-side secrets).
 */
export function deriveKey32(rawKey: string): Buffer {
  return createHash('sha256').update(rawKey, 'utf8').digest();
}

export interface EncryptedEnvelope {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptAes256Gcm(plaintext: Buffer | string, keyMaterial: string): EncryptedEnvelope {
  const key = deriveKey32(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptAes256Gcm(envelope: EncryptedEnvelope, keyMaterial: string): Buffer {
  const key = deriveKey32(keyMaterial);
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  // Neutralize CSV formula injection (CWE-1236)
  const sanitized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

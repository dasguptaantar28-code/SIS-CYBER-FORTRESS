/**
 * Client-side Zero-Knowledge Cryptography for Module 05 (SIS Vault Guardian).
 * Plaintext vault titles, passwords, notes, and documents NEVER leave the browser unencrypted.
 * Uses Web Crypto API PBKDF2-SHA256 (600,000 iterations) + AES-256-GCM authenticated encryption.
 */

const KDF_ITERATIONS = 600_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedVaultPayload {
  encryptedTitle: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
  kdfAlgorithm: string;
  kdfIterations: number;
}

export async function encryptVaultItemClientSide(
  passphrase: string,
  title: string,
  secretBody: Record<string, unknown>,
): Promise<EncryptedVaultPayload> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const titleIv = crypto.getRandomValues(new Uint8Array(12));
  const bodyIv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveAesKey(passphrase, salt);

  const encryptedTitleBuf = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: titleIv },
      key,
      enc.encode(title),
    ),
  );

  const encryptedBodyBuf = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: bodyIv },
      key,
      enc.encode(JSON.stringify(secretBody)),
    ),
  );

  // WebCrypto AES-GCM appends the 16-byte authTag to the end of ciphertext buffer
  const bodyCipherOnly = encryptedBodyBuf.slice(0, encryptedBodyBuf.length - 16);
  const bodyTag = encryptedBodyBuf.slice(encryptedBodyBuf.length - 16);

  return {
    encryptedTitle: JSON.stringify({
      iv: toBase64(titleIv),
      ct: toBase64(encryptedTitleBuf),
    }),
    ciphertext: toBase64(bodyCipherOnly),
    iv: toBase64(bodyIv),
    authTag: toBase64(bodyTag),
    salt: toBase64(salt),
    kdfAlgorithm: 'PBKDF2-SHA256',
    kdfIterations: KDF_ITERATIONS,
  };
}

export async function decryptVaultItemClientSide(
  passphrase: string,
  record: {
    encryptedTitle: string;
    ciphertext: string;
    iv: string;
    authTag: string;
    salt: string;
  },
): Promise<{ title: string; secretBody: Record<string, unknown> }> {
  const dec = new TextDecoder();
  const salt = fromBase64(record.salt);
  const key = await deriveAesKey(passphrase, salt);

  const titleObj = JSON.parse(record.encryptedTitle) as { iv: string; ct: string };
  const titlePlainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(titleObj.iv).buffer as ArrayBuffer },
    key,
    fromBase64(titleObj.ct).buffer as ArrayBuffer,
  );

  const cipherOnly = fromBase64(record.ciphertext);
  const tag = fromBase64(record.authTag);
  const combined = new Uint8Array(cipherOnly.length + tag.length);
  combined.set(cipherOnly, 0);
  combined.set(tag, cipherOnly.length);

  const bodyPlainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(record.iv).buffer as ArrayBuffer },
    key,
    combined.buffer as ArrayBuffer,
  );

  return {
    title: dec.decode(titlePlainBuf),
    secretBody: JSON.parse(dec.decode(bodyPlainBuf)) as Record<string, unknown>,
  };
}

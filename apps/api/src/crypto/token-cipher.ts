/**
 * AES-256-GCM encrypt/decrypt for sensitive tokens stored in the database.
 *
 * Requires TOKEN_ENCRYPTION_KEY in environment variables:
 *   A 64-character hex string (32 bytes) — generate with:
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Format stored in DB:  iv:authTag:ciphertext  (all hex)
 */
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12; // 96-bit IV recommended for GCM
const TAG_BYTES  = 16;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY ?? '';
  if (raw.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(raw, 'hex');
}

/** Encrypt plaintext. Returns a single string: `iv:tag:ciphertext` (all hex). */
export function encryptToken(plaintext: string): string {
  const key  = getKey();
  const iv   = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Thrown when a stored token cannot be decrypted with the current key.
 * This typically means the TOKEN_ENCRYPTION_KEY changed after the token was
 * stored (e.g. after switching plans in the desktop app). The user needs to
 * disconnect and reconnect the integration to re-encrypt with the current key.
 */
export class TokenDecryptionError extends Error {
  constructor() {
    super(
      'Stored API token could not be decrypted with the current encryption key. ' +
      'Please disconnect and reconnect this integration to restore access.',
    );
    this.name = 'TokenDecryptionError';
  }
}

/** Decrypt a value produced by `encryptToken`. Throws on tampering or key mismatch. */
export function decryptToken(stored: string): string {
  // Support plain-text tokens stored before encryption was introduced —
  // they won't contain two colons and will fail the split check.
  const parts = stored.split(':');
  if (parts.length !== 3) {
    // Legacy plain-text — return as-is so existing connections keep working.
    return stored;
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = getKey();
  const iv  = Buffer.from(ivHex,  'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    // Doesn't look like a properly-formatted ciphertext — treat as plain text.
    return stored;
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    throw new TokenDecryptionError();
  }
}

import crypto from 'node:crypto';
import argon2 from 'argon2';
import config from '../config/env.js';

/**
 * AES-256-GCM encryption/decryption for secret links
 */

const KEY_V1 = Buffer.from(config.MASTER_KEY_V1, 'hex'); // 32 bytes = 256 bits

export interface EncryptedData {
  cipherText: string; // base64url
  nonce: string; // base64url
  aad: string; // Additional Authenticated Data for verification
}

export interface DecryptedData {
  plainText: string;
  aad: string;
}

/**
 * Encrypt plaintext with AES-256-GCM
 * @param plainText The secret to encrypt
 * @param itemId The item ID (used in AAD for tampering detection)
 * @param linkToken The link token (used in AAD)
 * @param ownerUserId The owner user ID (used in AAD)
 */
export function encrypt(
  plainText: string,
  itemId: string,
  linkToken: string,
  ownerUserId: number,
): EncryptedData {
  // Generate random 12-byte IV (nonce)
  const nonce = crypto.randomBytes(12);

  // Construct AAD (Additional Authenticated Data) for tampering detection
  const aad = `item_id:${itemId}|key_version:${config.KEY_VERSION}|link_token:${linkToken}|owner_user_id:${ownerUserId}`;

  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_V1, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf-8'));

  let encrypted = cipher.update(plainText, 'utf-8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine ciphertext + authTag (GCM requires this)
  const combined = Buffer.concat([Buffer.from(encrypted, 'base64'), authTag]);

  return {
    cipherText: combined.toString('base64url'),
    nonce: nonce.toString('base64url'),
    aad,
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM
 * @param cipherText The encrypted data (base64url)
 * @param nonce The random nonce (base64url)
 * @param aad The Additional Authenticated Data
 */
export function decrypt(
  cipherText: string,
  nonce: string,
  aad: string,
): DecryptedData {
  const nonceBuffer = Buffer.from(nonce, 'base64url');
  const combinedBuffer = Buffer.from(cipherText, 'base64url');

  // Split combined data into ciphertext and authTag
  const authTagLength = 16; // AES-GCM auth tag is always 16 bytes
  const encrypted = combinedBuffer.subarray(
    0,
    combinedBuffer.length - authTagLength,
  );
  const authTag = combinedBuffer.subarray(combinedBuffer.length - authTagLength);

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_V1, nonceBuffer);
  decipher.setAAD(Buffer.from(aad, 'utf-8'));
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return {
      plainText: decrypted.toString('utf-8'),
      aad,
    };
  } catch (err) {
    throw new Error('Decryption failed: authentication tag verification failed');
  }
}

/**
 * Encrypt a TOTP secret (base32 string) for storage in the DB.
 * AAD includes the user ID to bind the ciphertext to a specific user.
 */
export function encryptTotpSecret(secret: string, userId: number): { cipher: Buffer; nonce: Buffer } {
  const nonce = crypto.randomBytes(12);
  const aad = `totp:user_id:${userId}`;

  const cipherInst = crypto.createCipheriv('aes-256-gcm', KEY_V1, nonce);
  cipherInst.setAAD(Buffer.from(aad, 'utf-8'));

  const encrypted = Buffer.concat([cipherInst.update(secret, 'utf-8'), cipherInst.final()]);
  const authTag = cipherInst.getAuthTag();

  return {
    cipher: Buffer.concat([encrypted, authTag]),
    nonce,
  };
}

/**
 * Decrypt a TOTP secret stored in the DB.
 */
export function decryptTotpSecret(cipher: Buffer, nonce: Buffer, userId: number): string {
  const aad = `totp:user_id:${userId}`;
  const authTagLength = 16;
  const encrypted = cipher.subarray(0, cipher.length - authTagLength);
  const authTag = cipher.subarray(cipher.length - authTagLength);

  const decipherInst = crypto.createDecipheriv('aes-256-gcm', KEY_V1, nonce);
  decipherInst.setAAD(Buffer.from(aad, 'utf-8'));
  decipherInst.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipherInst.update(encrypted), decipherInst.final()]);
    return decrypted.toString('utf-8');
  } catch {
    throw new Error('TOTP secret decryption failed');
  }
}

/**
 * Generate a random link token
 */
export function generateLinkToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash a token (SHA-256) - tokens are hashed before storing in DB
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Hash a passphrase with Argon2id before storing it.
 * The client already sends a SHA-256 hex digest of the passphrase;
 * we re-hash it server-side so a database leak does not expose a
 * cheaply brute-forceable value.
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  return argon2.hash(passphrase, { type: argon2.argon2id });
}

/**
 * Verify a passphrase against a stored Argon2id hash (constant-time).
 */
export async function verifyPassphrase(
  passphrase: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, passphrase);
  } catch {
    return false;
  }
}

/**
 * Hash an IP address (HMAC-SHA256) for privacy-preserving logging.
 * Uses a server-side secret so the pseudonym cannot be brute-forced
 * from the (small) IPv4 address space.
 */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHmac('sha256', config.IP_HMAC_SECRET).update(ip).digest('hex');
}

/**
 * Hash an email address (HMAC-SHA256) for privacy-preserving logging.
 * Lets us correlate events without storing personal data in clear.
 */
export function hashEmail(email: string | undefined): string | null {
  if (!email) return null;
  return crypto
    .createHmac('sha256', config.IP_HMAC_SECRET)
    .update(email.trim().toLowerCase())
    .digest('hex');
}

import crypto from 'node:crypto';
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
 * Hash a passphrase (Argon2 should be used in the user service, but SHA256 for compatibility)
 */
export function hashPassphrase(passphrase: string): string {
  return crypto.createHash('sha256').update(passphrase).digest('hex');
}

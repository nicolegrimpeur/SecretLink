import { PoolConnection } from 'mysql2/promise';
import { getPool } from '../../config/database.js';
import { User, TrustedDevice, RecoveryCode } from '../../shared/types.js';

class UserStore {
  async findByEmail(email: string): Promise<User | null> {
    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id, email, password_hash, created_at, email_verified_at FROM users WHERE email = ?',
      [email],
    );
    return rows[0] || null;
  }

  async createUser(email: string, passwordHash: Buffer): Promise<{ insertId: number }> {
    const pool = getPool();
    const [result] = await pool.execute<any>(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash],
    );
    return { insertId: result.insertId as number };
  }

  async getById(id: number): Promise<User | null> {
    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id, email, password_hash, created_at, email_verified_at, password_changed_at, totp_secret_cipher, totp_secret_nonce FROM users WHERE id = ?',
      [id],
    );
    return rows[0] || null;
  }

  async updatePassword(id: number, passwordHash: Buffer): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE id = ?',
      [passwordHash, id],
    );
  }

  async purgeUserApiTokens(ownerUserId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'DELETE FROM api_tokens WHERE user_id = ? AND revoked_at IS NOT NULL',
      [ownerUserId],
    );
  }

  async purgeUserLinks(ownerUserId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'DELETE FROM links WHERE owner_user_id = ? AND (deleted_at IS NOT NULL OR expires_at < NOW() OR used_at IS NOT NULL)',
      [ownerUserId],
    );
  }

  async deleteUserLinks(cx: PoolConnection, ownerUserId: number): Promise<void> {
    await cx.execute('DELETE FROM links WHERE owner_user_id = ?', [ownerUserId]);
  }

  async deleteUserApiTokens(cx: PoolConnection, ownerUserId: number): Promise<void> {
    await cx.execute('DELETE FROM api_tokens WHERE user_id = ?', [ownerUserId]);
  }

  async deleteUserItems(cx: PoolConnection, ownerUserId: number): Promise<void> {
    await cx.execute('DELETE FROM items WHERE owner_user_id = ?', [ownerUserId]);
  }

  async deleteUser(cx: PoolConnection, id: number): Promise<void> {
    await cx.execute('DELETE FROM users WHERE id = ?', [id]);
  }

  // ─── TOTP ────────────────────────────────────────────────────────────────────

  async setTotpSecret(userId: number, cipher: Buffer, nonce: Buffer): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'UPDATE users SET totp_secret_cipher = ?, totp_secret_nonce = ? WHERE id = ?',
      [cipher, nonce, userId],
    );
  }

  // ─── Trusted devices ─────────────────────────────────────────────────────────

  async findTrustedDevice(tokenHash: string): Promise<TrustedDevice | null> {
    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id, user_id, device_token_hash, created_at, expires_at FROM trusted_devices WHERE device_token_hash = ? AND expires_at > NOW()',
      [tokenHash],
    );
    return rows[0] || null;
  }

  async createTrustedDevice(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'INSERT INTO trusted_devices (user_id, device_token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt],
    );
  }

  async deleteExpiredTrustedDevices(userId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'DELETE FROM trusted_devices WHERE user_id = ? AND expires_at <= NOW()',
      [userId],
    );
  }

  // ─── Recovery codes ──────────────────────────────────────────────────────────

  async storeRecoveryCodes(userId: number, codeHashes: string[]): Promise<void> {
    const pool = getPool();
    const placeholders = codeHashes.map(() => '(?, ?)').join(', ');
    const values = codeHashes.flatMap((h) => [userId, h]);
    await pool.execute(
      `INSERT INTO recovery_codes (user_id, code_hash) VALUES ${placeholders}`,
      values,
    );
  }

  async findAndConsumeRecoveryCode(userId: number, codeHash: string): Promise<boolean> {
    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      'SELECT id FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
      [userId, codeHash],
    );
    if (!rows[0]) return false;
    await pool.execute('UPDATE recovery_codes SET used_at = NOW() WHERE id = ?', [rows[0].id]);
    return true;
  }

  async deleteRecoveryCodes(userId: number): Promise<void> {
    const pool = getPool();
    await pool.execute('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
  }
}

export const userStore = new UserStore();

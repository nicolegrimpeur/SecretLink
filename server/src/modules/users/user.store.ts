import { PoolConnection } from 'mysql2/promise';
import { getPool } from '../../config/database.js';
import { User } from '../../shared/types.js';

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
      'SELECT id, email, password_hash, created_at, email_verified_at, password_changed_at FROM users WHERE id = ?',
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
}

export const userStore = new UserStore();

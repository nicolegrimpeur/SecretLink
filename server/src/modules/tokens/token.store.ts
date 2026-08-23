import { getPool } from '../../config/database.js';
import { ApiToken } from '../../shared/types.js';

class TokenStore {
  async listByUserId(userId: number): Promise<ApiToken[]> {
    const pool = getPool();
    const [rows] = await pool.execute<any[]>(
      `SELECT id, user_id, token_hash, label, scopes, created_at, revoked_at
       FROM api_tokens WHERE user_id = ? ORDER BY id DESC`,
      [userId],
    );
    return rows;
  }

  async createToken(
    userId: number,
    tokenHash: string,
    label: string | null,
    scopes: string,
  ): Promise<{ insertId: number }> {
    const pool = getPool();
    const [result] = await pool.execute<any>(
      `INSERT INTO api_tokens (user_id, token_hash, label, scopes)
       VALUES (?, ?, ?, ?)`,
      [userId, tokenHash, label, scopes],
    );
    return { insertId: result.insertId as number };
  }

  /** Returns the number of rows affected - 0 means unknown id or not owned by this user. */
  async revokeToken(userId: number, tokenId: number): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<any>(
      `UPDATE api_tokens SET revoked_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [tokenId, userId],
    );
    return result.affectedRows as number;
  }
}

export const tokenStore = new TokenStore();

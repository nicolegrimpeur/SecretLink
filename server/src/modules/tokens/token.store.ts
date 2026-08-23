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
  ): Promise<{ insertId: number; createdAt: Date }> {
    const pool = getPool();
    const [result] = await pool.execute<any>(
      `INSERT INTO api_tokens (user_id, token_hash, label, scopes)
       VALUES (?, ?, ?, ?)`,
      [userId, tokenHash, label, scopes],
    );
    const insertId = result.insertId as number;

    // On relit created_at plutôt que de recalculer l'heure côté Node : la valeur
    // écrite par CURRENT_TIMESTAMP est à la seconde, celle rendue par la création
    // doit donc être identique à celle que renverra ensuite le listing.
    const [rows] = await pool.execute<any[]>(
      'SELECT created_at FROM api_tokens WHERE id = ?',
      [insertId],
    );

    return { insertId, createdAt: rows[0].created_at };
  }

  /** Returns the number of rows affected - 0 means unknown id or not owned by this user. */
  async revokeToken(userId: number, tokenId: number): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<any>(
      // COALESCE : une seconde révocation ne réécrit pas l'horodatage d'origine.
      // affectedRows reste à 1 (mysql2 active CLIENT_FOUND_ROWS, donc il compte les
      // lignes appariées et non modifiées), l'opération reste donc idempotente en 204.
      `UPDATE api_tokens SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE id = ? AND user_id = ?`,
      [tokenId, userId],
    );
    return result.affectedRows as number;
  }
}

export const tokenStore = new TokenStore();

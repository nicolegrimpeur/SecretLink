import { PoolConnection } from 'mysql2/promise';
import { getPool, withTx } from '../../config/database.js';
import { Link, LinkStatus } from '../../shared/types.js';

class LinkStore {
  async insertItem(cx: PoolConnection, uid: number, itemId: string): Promise<void> {
    await cx.execute(
      'INSERT INTO items (owner_user_id, item_id) VALUES (?, ?)',
      [uid, itemId],
    );
  }

  async insertLink(
    cx: PoolConnection,
    data: {
      uid: number;
      iid: string;
      lt: string;
      ct: Buffer;
      iv: Buffer;
      kv: number;
      exp: Date | null;
      ph: string | null;
    },
  ): Promise<{ insertId: number }> {
    const [result] = await cx.execute<any>(
      `INSERT INTO links (owner_user_id, item_id, link_token, cipher_text, nonce, key_version, expires_at, passphrase_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uid,
        data.iid,
        data.lt,
        data.ct,
        data.iv,
        data.kv,
        data.exp,
        data.ph,
      ],
    );
    return { insertId: result.insertId as number };
  }

  async linkByTokenForUpdate(
    cx: PoolConnection,
    token: string,
  ): Promise<Link | null> {
    const [rows] = await cx.execute<any[]>(
      `SELECT id, owner_user_id, item_id, cipher_text, nonce, key_version, expires_at, used_at, deleted_at, passphrase_hash
       FROM links WHERE link_token = ? FOR UPDATE`,
      [token],
    );
    return rows[0] || null;
  }

  async linkOwnerItemForUpdate(
    cx: PoolConnection,
    token: string,
  ): Promise<{ id: number; owner_user_id: number; item_id: string } | null> {
    const [rows] = await cx.execute<any[]>(
      `SELECT id, owner_user_id, item_id FROM links WHERE link_token = ? FOR UPDATE`,
      [token],
    );
    return rows[0] || null;
  }

  async setUsedAndPurge(cx: PoolConnection, id: number): Promise<void> {
    await cx.execute(
      `UPDATE links SET used_at = NOW(), cipher_text = '', passphrase_hash = NULL WHERE id = ?`,
      [id],
    );
  }

  async setDeletedAndPurge(cx: PoolConnection, id: number): Promise<void> {
    await cx.execute(
      `UPDATE links SET deleted_at = NOW(), cipher_text = '' WHERE id = ?`,
      [id],
    );
  }

  async purgeExpiredLink(cx: PoolConnection, id: number): Promise<void> {
    await cx.execute(
      `UPDATE links SET cipher_text = '', passphrase_hash = NULL WHERE id = ?`,
      [id],
    );
  }

  async purgeExpiredLinksForUser(uid: number): Promise<void> {
    const pool = getPool();
    await pool.execute(
      `UPDATE links SET cipher_text = '', passphrase_hash = NULL
       WHERE owner_user_id = ? AND (cipher_text != '' OR passphrase_hash IS NOT NULL)
       AND (deleted_at IS NOT NULL OR used_at IS NOT NULL
            OR (expires_at IS NOT NULL AND expires_at <= NOW()))`,
      [uid],
    );
    await pool.execute(
      `DELETE i FROM items i
       LEFT JOIN links l
         ON l.owner_user_id = i.owner_user_id
        AND l.item_id = i.item_id
        AND l.deleted_at IS NULL AND l.used_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > NOW())
       WHERE i.owner_user_id = ? AND l.id IS NULL`,
      [uid],
    );
  }

  async purgeAllExpiredLinks(): Promise<{ ciphertextPurged: number; locksReleased: number }> {
    const pool = getPool();
    const [r1] = await pool.execute<any>(
      `UPDATE links SET cipher_text = '', passphrase_hash = NULL
       WHERE (cipher_text != '' OR passphrase_hash IS NOT NULL)
       AND (deleted_at IS NOT NULL OR used_at IS NOT NULL
            OR (expires_at IS NOT NULL AND expires_at <= NOW()))`,
    );
    const [r2] = await pool.execute<any>(
      `DELETE i FROM items i
       LEFT JOIN links l
         ON l.owner_user_id = i.owner_user_id
        AND l.item_id = i.item_id
        AND l.deleted_at IS NULL AND l.used_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > NOW())
       WHERE l.id IS NULL`,
    );
    return { ciphertextPurged: r1.affectedRows as number, locksReleased: r2.affectedRows as number };
  }

  async deleteItemLock(
    cx: PoolConnection,
    uid: number,
    itemId: string,
  ): Promise<void> {
    await cx.execute(
      `DELETE FROM items WHERE owner_user_id = ? AND item_id = ?`,
      [uid, itemId],
    );
  }


  async statusByOwner(
    uid: number,
    since?: Date | null,
    until?: Date | null,
  ): Promise<LinkStatus[]> {
    let query = `SELECT item_id, link_token, created_at, expires_at, used_at, deleted_at
                 FROM links WHERE owner_user_id = ?`;
    const params: any[] = [uid];

    if (since) {
      query += ` AND created_at >= ?`;
      params.push(since);
    }

    if (until) {
      query += ` AND created_at < ?`;
      params.push(until);
    }

    query += ` ORDER BY created_at DESC LIMIT 10000`;

    const pool = getPool();
    const [rows] = await pool.execute<any[]>(query, params);
    return rows;
  }
}

export const linkStore = new LinkStore();

export function tx<T>(fn: (cx: PoolConnection) => Promise<T>): Promise<T> {
  return withTx(fn);
}

import {pool, withTx} from '../../shared/mysqlPool.js';

export const store = {
    tx: withTx,
    insertItem: (cx, uid, itemId) =>
        cx.query(`INSERT INTO items (owner_user_id, item_id) VALUES (:uid, :iid)`, { uid, iid: itemId }),

    insertLink: (cx, rec) =>
        cx.query(
            `INSERT INTO links (owner_user_id, item_id, link_token, cipher_text, nonce, key_version, expires_at, passphrase_hash)
       VALUES (:uid, :iid, :lt, :ct, :iv, :kv, :exp, :ph)`, rec),

    linkByTokenForUpdate: (cx, token) =>
        cx.query(
            `SELECT id, owner_user_id, item_id, cipher_text, nonce, key_version, expires_at, used_at, deleted_at, passphrase_hash
         FROM links WHERE link_token=:t FOR UPDATE`, { t: token }),

    setUsedAndPurge: (cx, id) =>
        cx.query(`UPDATE links SET used_at=NOW(), cipher_text=X'', passphrase_hash=null WHERE id=:id`, { id }),

    setDeletedAndPurge: (cx, id) =>
        cx.query(`UPDATE links SET deleted_at=NOW(), cipher_text=X'' WHERE id=:id`, { id }),

    deleteItemLock: (cx, uid, itemId) =>
        cx.query(`DELETE FROM items WHERE owner_user_id=:uid AND item_id=:iid`, { uid, iid: itemId }),

    insertAudit: (cx, uid, itemId, linkId, type, ipHash = null, ua = null) =>
        cx.query(
            `INSERT INTO audits (owner_user_id, item_id, link_id, event_type, ip_hash, user_agent)
       VALUES (:uid, :iid, :lid, :type, :ip, :ua)`,
            { uid, iid: itemId, lid: linkId, type, ip: ipHash, ua }),

    statusByOwner: (uid, since, until) => {
        const params = { uid };
        let where = 'owner_user_id=:uid';
        if (since) { where += ' AND created_at >= :since'; params.since = since; }
        if (until) { where += ' AND created_at < :until'; params.until = until; }
        return pool.query(
            `SELECT item_id, link_token, created_at, expires_at, used_at, deleted_at
         FROM links WHERE ${where} ORDER BY created_at DESC LIMIT 10000`, params);
    },

    linkOwnerItemForUpdate: (cx, token) =>
        cx.query(`SELECT id, owner_user_id, item_id FROM links WHERE link_token=:t FOR UPDATE`, { t: token }),
};

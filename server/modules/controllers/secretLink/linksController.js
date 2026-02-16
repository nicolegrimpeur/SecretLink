import {store} from '../../models/secretLink/vaultlinkStore.js';
import {logger} from '../../shared/logger.js';
import {LinkCreateBulkRequest, LinkCreateItem} from '../../ressourcesModels/secretLinkRessources/linksSchemas.js';

import {
    buildAAD,
    cryptoCfg,
    decryptAesGcm,
    encryptAesGcm,
    randomTokenBase64Url
} from '../../ressourcesModels/secretLinkRessources/linksCrypto.js';

export async function createLink(req, res) {
    const body = LinkCreateItem.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload', details: body.error.errors } });

    const data = body.data;

    const uid = 0;
    const now = new Date();

    const result = await store.tx(async (cx) => {
        const itemId = '';
        const secret = String(data.secret || '');
        const passphraseHash = null;
        const ttlDays = 7;
        if (!secret) {
            out.push({ item_id: itemId, status: 'invalid_item_id', link_token: null, link_url: null, expires_at: null, error: 'Bad payload' });
        }

        const expiresAt = new Date(now.getTime() + ttlDays * 86400 * 1000);

        const linkToken = randomTokenBase64Url(32);
        const aad = buildAAD({ owner_user_id: uid, item_id: itemId, link_token: linkToken, key_version: cryptoCfg.keyVersion });
        const { iv, ciphertext, keyVersion } = encryptAesGcm(Buffer.from(secret, 'utf8'), aad);

        const [r] = await store.insertLink(cx, {
            uid, iid: itemId, lt: linkToken, ct: ciphertext, iv, kv: keyVersion, exp: expiresAt, ph: passphraseHash
        });
        const linkId = r.insertId;
        await store.insertAudit(cx, uid, itemId, linkId, 'LINK_CREATED');

        return {
            status: 'created',
            link_token: linkToken,
            link_url: `${cryptoCfg.baseUrl}/api/vaultlink/links/${encodeURIComponent(linkToken)}/redeem`,
            expires_at: expiresAt ? expiresAt.toISOString() : null,
            error: null
        };
    });

    res.status(201).json({ result });

    if (result.status === 'created')
        logger.info({ event: 'LINK_CREATED', owner_user_id: uid, item_id: result.item_id }, 'Link created');
}

export async function createLinks(req, res) {
    const body = LinkCreateBulkRequest.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload', details: body.error.errors } });

    const data = body.data;
    if (!data.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Array required' } });

    const uid = req.auth.userId;
    const now = new Date();

    const results = await store.tx(async (cx) => {
        const out = [];
        for (const row of data) {
            const itemId = String(row.item_id || '').trim();
            const secret = String(row.secret || '');
            const passphraseHash = String(row.passphrase_hash || '');
            const ttlDays = Number(row.ttl_days ?? 0);
            if (!itemId || !secret || !Number.isFinite(ttlDays) || ttlDays < 0 || ttlDays > 365) {
                out.push({ item_id: itemId, status: 'invalid_item_id', link_token: null, link_url: null, expires_at: null, error: 'Bad payload' });
                continue;
            }

            // Check for existing non-expired link
            // If expired link exists, delete it and allow new link creation
            const [existingLinks] = await store.statusByOwner(uid, null, null);
            const existingLink = existingLinks.findLast(link => link.item_id === itemId);
            if (existingLink && (!existingLink.expires_at || new Date(existingLink.expires_at) > now)) {
                out.push({ item_id: itemId, status: 'duplicate_item_id', link_token: null, link_url: null, expires_at: existingLink.expires_at ? new Date(existingLink.expires_at).toISOString() : null, error: null });
                continue;
            } else if (existingLink && existingLink.expires_at && new Date(existingLink.expires_at) <= now) {
                await store.deleteItemLock(cx, uid, itemId);
            }

            const expiresAt = ttlDays === 0 ? null : new Date(now.getTime() + ttlDays * 86400 * 1000);
            try {
                await store.insertItem(cx, uid, itemId);
            } catch {
                out.push({ item_id: itemId, status: 'duplicate_item_id', link_token: null, link_url: null, expires_at: null, error: null });
                continue;
            }

            const linkToken = randomTokenBase64Url(32);
            const aad = buildAAD({ owner_user_id: uid, item_id: itemId, link_token: linkToken, key_version: cryptoCfg.keyVersion });
            const { iv, ciphertext, keyVersion } = encryptAesGcm(Buffer.from(secret, 'utf8'), aad);

            const [r] = await store.insertLink(cx, {
                uid, iid: itemId, lt: linkToken, ct: ciphertext, iv, kv: keyVersion, exp: expiresAt, ph: passphraseHash
            });
            const linkId = r.insertId;
            await store.insertAudit(cx, uid, itemId, linkId, 'LINK_CREATED');

            out.push({
                item_id: itemId,
                status: 'created',
                link_token: linkToken,
                link_url: `${cryptoCfg.baseUrl}/api/vaultlink/links/${encodeURIComponent(linkToken)}/redeem`,
                expires_at: expiresAt ? expiresAt.toISOString() : null,
                error: null
            });
        }
        return out;
    });

    res.status(201).json({ results });

    for (const result of results) if (result.status === 'created')
        logger.info({ event: 'LINK_CREATED', owner_user_id: uid, item_id: result.item_id }, 'Link created');
}

export async function redeemLink(req, res) {
    const token = req.params.token;
    const passphrase_hash = req.query.pass ? String(req.query.pass) : null;

    try {
        const out = await store.tx(async (cx) => {
            const [rows] = await store.linkByTokenForUpdate(cx, token);
            const r = rows[0];
            if (!r) return { status: 404 };

            if (r.deleted_at || r.used_at || (r.expires_at && new Date(r.expires_at) <= new Date())) {
                return { status: 410 };
            }

            if (r.passphrase_hash) {
                if (!passphrase_hash) {
                    return { status: 403, body: { error: { code: 'PASSPHRASE_REQUIRED', message: 'Passphrase required or invalid' } } };
                } else if (passphrase_hash !== r.passphrase_hash) {
                    return { status: 403, body: { error: { code: 'INVALID_PASSPHRASE', message: 'Passphrase required or invalid' } } };
                }
            }

            const aad = buildAAD({ owner_user_id: r.owner_user_id, item_id: r.item_id, link_token: token, key_version: r.key_version });
            const secret = decryptAesGcm(r.cipher_text, r.nonce, aad).toString('utf8');

            await store.setUsedAndPurge(cx, r.id);
            await store.deleteItemLock(cx, r.owner_user_id, r.item_id);
            await store.insertAudit(cx, r.owner_user_id, r.item_id, r.id, 'LINK_REDEEMED');

            return { status: 200, body: { item_id: r.item_id, secret, redeemed_at: new Date().toISOString() } };
        });

        if (out.status === 403) return res.status(403).json(out.body);
        if (out.status === 404) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Link not found' } });
        if (out.status === 410) return res.status(410).json({ error: { code: 'LINK_GONE', message: 'Link expired, deleted, or already used' } });
        return res.status(200).json(out.body);
    } catch {
        return res.status(500).json({ error: { code: 'INTERNAL', message: 'Redeem failed' } });
    }
}

export async function deleteLink(req, res) {
    const token = req.params.token;
    const uid = req.auth.userId;

    await store.tx(async (cx) => {
        const [rows] = await store.linkOwnerItemForUpdate(cx, token);
        const r = rows[0];
        if (!r || Number(r.owner_user_id) !== uid) {
            const err = new Error('Not found'); err.status = 404; throw err;
        }
        await store.setDeletedAndPurge(cx, r.id);
        await store.deleteItemLock(cx, uid, r.item_id);
        await store.insertAudit(cx, uid, r.item_id, r.id, 'LINK_DELETED');
    });

    res.status(204).end();
}

export async function statusList(req, res) {
    const uid = req.auth.userId;
    const since = req.query.since ? new Date(String(req.query.since)) : null;
    const until = req.query.until ? new Date(String(req.query.until)) : null;
    const [rows] = await store.statusByOwner(uid, since, until);
    res.json(rows);
}

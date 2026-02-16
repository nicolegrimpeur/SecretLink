import {pool} from '../../shared/mysqlPool.js';
import {randomTokenBase64Url, sha256Hex} from '../../ressourcesModels/secretLinkRessources/linksCrypto.js';

export async function listPAT(req, res) {
    const uid = req.session.userId;
    const [rows] = await pool.query(
        `SELECT id, label, scopes, created_at, revoked_at
       FROM api_tokens WHERE user_id=:uid ORDER BY id DESC`,
        { uid }
    );

    res.json(rows.map(r => ({
        id: r.id,
        label: r.label,
        scopes: r.scopes,
        created_at: r.created_at,
        revoked_at: r.revoked_at
    })));
}

export async function createPAT(req, res) {
    const uid = req.session.userId;
    const { label, scopes } = (req.body ?? {});
    const token = randomTokenBase64Url(32);
    const tokenHash = sha256Hex(token);
    const scopesArr = Array.isArray(scopes) && scopes.length
        ? scopes
        : ['links:read','links:write','links:delete'];
    const scopesStr = JSON.stringify(scopesArr);

    const [r] = await pool.query(
        `INSERT INTO api_tokens (user_id, token_hash, label, scopes)
     VALUES (:uid, :th, :label, :sc)`,
        { uid, th: tokenHash, label: label ?? null, sc: scopesStr }
    );

    res.status(201).json({
        token,
        token_preview: token.slice(-6),
        pat: {
            id: r.insertId,
            label: label ?? null,
            scopes: scopesArr,
            created_at: new Date().toISOString(),
            revoked_at: null
        }
    });
}

export async function revokePAT(req, res) {
    const uid = req.session.userId;
    const id = Number(req.params.id);

    await pool.query(
        `UPDATE api_tokens SET revoked_at=NOW()
      WHERE id=:id AND user_id=:uid`,
        { id, uid }
    );
    res.status(204).end();
}

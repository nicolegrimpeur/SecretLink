import jwt from 'jsonwebtoken';
import {pool} from '../../shared/mysqlPool.js';
import {sha256Hex} from './linksCrypto.js';
import {env} from "../../shared/env.js";

const COOKIE = env.SESSION_COOKIE_NAME;
const SECRET = env.SESSION_SECRET;

export async function authEither(req, _res, next) {
    // 1) Essaye session d’abord (cookie)
    const tokenCookie = req.cookies?.[COOKIE];
    if (tokenCookie && SECRET) {
        try {
            const dec = jwt.verify(tokenCookie, SECRET);
            req.auth = {type: 'session', userId: Number(dec.userId), scopes: new Set()};
            return next();
        } catch {
        }
    }

    // 2) Sinon, essaye Bearer PAT
    const h = req.header('Authorization');
    if (h?.toLowerCase().startsWith('bearer ')) {
        const pat = h.slice(7).trim();
        if (pat) {
            const patHash = sha256Hex(pat);
            const [rows] = await pool.query(
                `SELECT user_id, scopes, revoked_at
                 FROM api_tokens
                 WHERE token_hash = :th`,
                {th: patHash}
            );
            const r = rows[0];
            if (r && !r.revoked_at) {
                req.auth = {
                    type: 'pat',
                    userId: Number(r.user_id),
                    scopes: new Set(r.scopes || []),
                };
                return next();
            }
        }
    }

    // 3) Rien trouvé
    return next();
}

export function requireAuth(options = {allow: ['session', 'pat'], scopes: []}) {
    const allowSet = new Set(options.allow || ['session', 'pat']);
    const needScopes = options.scopes || [];

    return (req, res, next) => {
        const a = req.auth;
        if (!a) return res.status(401).json({error: {code: 'UNAUTHORIZED', message: 'No auth'}});
        if (!allowSet.has(a.type)) {
            return res.status(403).json({error: {code: 'FORBIDDEN', message: `Auth type ${a.type} not allowed`}});
        }

        // En mode PAT → vérifier les scopes requis
        if (a.type === 'pat' && needScopes.length) {
            for (const s of needScopes) {
                if (!a.scopes?.has(s)) {
                    return res.status(403).json({error: {code: 'FORBIDDEN', message: `Missing scope ${s}`}});
                }
            }
        }

        return next();
    };
}

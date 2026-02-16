import jwt from 'jsonwebtoken';

const COOKIE = process.env.SESSION_COOKIE_NAME || 'sid';
const SECRET = process.env.SESSION_SECRET;
const TTL = Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 3600);

if (!SECRET) throw new Error('Missing SESSION_SECRET');

export function issueSession(res, payload) {
    const token = jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: TTL });
    res.cookie(COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TTL * 1000,
        path: '/',
    });
}

export function clearSession(res) {
    res.clearCookie(COOKIE, { path: '/' });
}

export function sessionAuth(req, res, next) {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    try {
        const decoded = jwt.verify(token, SECRET);
        req.session = { userId: Number(decoded.userId) };
        next();
    } catch {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' } });
    }
}

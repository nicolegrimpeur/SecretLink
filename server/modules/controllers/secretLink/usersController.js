import argon2 from 'argon2';
import {userStore} from '../../models/secretLink/userStore.js';
import {ChangePasswordReq, LoginReq, SignupReq} from '../../ressourcesModels/secretLinkRessources/userSchemas.js';
import {clearSession, issueSession} from '../../shared/session.js';

function publicUser(row) {
    return {
        id: Number(row.id),
        email: row.email,
        created_at: row.created_at,
        email_verified_at: row.email_verified_at ?? null,
    };
}

export async function signup(req, res) {
    const parsed = SignupReq.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }
    const { email, password } = parsed.data;

    const [exist] = await userStore.findByEmail(email);
    if (exist[0]) return res.status(409).json({ error: { code: 'CONFLICT', message: 'Email already in use' } });

    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const [ins] = await userStore.createUser(email, Buffer.from(hash));

    // Ouvre une session directement après signup
    issueSession(res, { userId: ins.insertId });
    const [rows] = await userStore.getById(ins.insertId);
    return res.status(201).json(publicUser(rows[0]));
}

export async function login(req, res) {
    const parsed = LoginReq.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }
    const { email, password } = parsed.data;

    const [rows] = await userStore.findByEmail(email);
    const u = rows[0];
    if (!u || !u.password_hash) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }

    const ok = await argon2.verify(Buffer.from(u.password_hash).toString(), password);
    if (!ok) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });

    issueSession(res, { userId: u.id });
    return res.status(200).json(publicUser(u));
}

export async function logout(_req, res) {
    clearSession(res);
    res.status(204).end();
}

export async function me(req, res) {
    const [rows] = await userStore.getById(req.session.userId);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json(publicUser(rows[0]));
}

export async function changePassword(req, res) {
    const parsed = ChangePasswordReq.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    }
    const { current_password, new_password } = parsed.data;

    const [rows] = await userStore.getById(req.session.userId);
    const u = rows[0];
    if (!u) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });

    const [fullRows] = await userStore.findByEmail(u.email);
    const fu = fullRows[0];
    if (!fu?.password_hash) return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'No password set' } });

    const ok = await argon2.verify(Buffer.from(fu.password_hash).toString(), current_password);
    if (!ok) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid current password' } });

    const hash = await argon2.hash(new_password, { type: argon2.argon2id });
    await userStore.updatePassword(req.session.userId, Buffer.from(hash));
    res.status(204).end();
}

export async function purgeMe(req, res) {
    const uid = req.session.userId;
    await userStore.purgeUserApiTokens(uid);
    await userStore.purgeUserLinks(uid);
    res.status(204).end();
}

export async function deleteMe(req, res) {
    const uid = req.session.userId;
    await userStore.deleteUserLinks(uid);
    await userStore.deleteUserApiTokens(uid);
    await userStore.deleteUserItems(uid);
    await userStore.deleteUser(uid);
    clearSession(res);
    res.status(204).end();
}

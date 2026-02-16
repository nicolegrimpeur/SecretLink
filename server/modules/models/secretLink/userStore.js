import {pool} from '../../shared/mysqlPool.js';

export const userStore = {
    findByEmail: (email) =>
        pool.query(`SELECT id, email, password_hash, created_at, email_verified_at FROM users WHERE email=:e`, { e: email }),

    createUser: (email, passwordHash) =>
        pool.query(`INSERT INTO users (email, password_hash) VALUES (:e, :ph)`, { e: email, ph: passwordHash }),

    getById: (id) =>
        pool.query(`SELECT id, email, created_at, email_verified_at FROM users WHERE id=:id`, { id }),

    updatePassword: (id, passwordHash) =>
        pool.query(`UPDATE users SET password_hash=:ph, password_changed_at=NOW() WHERE id=:id`, { id, ph: passwordHash }),

    purgeUserApiTokens: (ownerUserId) =>
        pool.query(`DELETE FROM api_tokens WHERE user_id=:uid AND revoked_at IS NOT NULL`, { uid: ownerUserId }),

    purgeUserLinks: (ownerUserId) =>
        pool.query(`DELETE FROM links WHERE owner_user_id=:uid AND (deleted_at IS NOT NULL OR expires_at < NOW() OR used_at IS NOT NULL)`, { uid: ownerUserId }),

    deleteUserLinks: (ownerUserId) =>
        pool.query(`DELETE FROM links WHERE owner_user_id=:uid`, { uid: ownerUserId }),

    deleteUserApiTokens: (ownerUserId) =>
        pool.query(`DELETE FROM api_tokens WHERE user_id=:uid`, { uid: ownerUserId }),

    deleteUserItems: (ownerUserId) =>
        pool.query(`DELETE FROM items WHERE owner_user_id=:uid`, { uid: ownerUserId }),

    deleteUser: (id) =>
        pool.query(`DELETE FROM users WHERE id=:id`, { id }),
};

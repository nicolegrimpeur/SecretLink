import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import {
  createSignedInUser,
  loginFull,
  signupUser,
  totpNow,
  uniqueEmail,
} from '../helpers/auth.js';
import { closeDb, resetDb } from '../helpers/db.js';
import { api, cookieHeader, readCookie } from '../helpers/http.js';

/** ISO-8601 UTC à la milliseconde, ce que produit toIso(). */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const app = createApp();

beforeEach(resetDb);
afterAll(closeDb);

/**
 * Attend le franchissement de la prochaine frontière de seconde. Borné à 1 s.
 * Nécessaire pour tout ce qui compare un `iat` de JWT (en secondes) à une
 * colonne DATETIME (sans fraction).
 */
async function waitForNextSecond(): Promise<void> {
  const start = Math.floor(Date.now() / 1000);
  while (Math.floor(Date.now() / 1000) === start) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('POST /users/signup', () => {
  it('crée le compte, renvoie 8 codes de récupération, et n\'émet PAS de session', async () => {
    const email = uniqueEmail();
    const res = await api(app).post('/users/signup').send({
      email,
      password: 'correct-horse-battery-staple',
      totp_secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      totp_code: await totpNow('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, email_verified_at: null });
    expect(res.body.recovery_codes).toHaveLength(8);
    for (const code of res.body.recovery_codes) {
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }

    // Le client doit repasser par /login : aucun cookie de session ici.
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('renvoie created_at en ISO-8601 UTC', async () => {
    const user = await signupUser(app);
    const { cookie } = await loginFull(app, user);
    const me = await api(app, { cookie }).get('/users/me');

    expect(me.status).toBe(200);
    expect(me.body.created_at).toMatch(ISO_UTC);
  });

  it('refuse un code TOTP qui ne correspond pas au secret → 400', async () => {
    const res = await api(app).post('/users/signup').send({
      email: uniqueEmail(),
      password: 'correct-horse-battery-staple',
      totp_secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      totp_code: '000000',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un email déjà pris → 409 CONFLICT', async () => {
    const user = await signupUser(app);
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

    const res = await api(app).post('/users/signup').send({
      email: user.email,
      password: 'correct-horse-battery-staple',
      totp_secret: secret,
      totp_code: await totpNow(secret),
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /users/login', () => {
  it('exige le MFA et renvoie un pre_auth_token, sans cookie de session', async () => {
    const user = await signupUser(app);

    const res = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mfa_required: true });
    expect(typeof res.body.pre_auth_token).toBe('string');
    expect(res.body.user).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('renvoie 401 UNAUTHORIZED sur mauvais mot de passe comme sur email inconnu', async () => {
    const user = await signupUser(app);

    const wrongPassword = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: 'pas-le-bon-mot-de-passe' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');

    const unknownEmail = await api(app)
      .post('/users/login')
      .send({ email: uniqueEmail('inconnu'), password: 'peu-importe' });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /users/mfa/verify', () => {
  it('émet le cookie de session sur code TOTP valide', async () => {
    const user = await signupUser(app);
    const { setCookie } = await loginFull(app, user);

    expect(readCookie(setCookie, 'sid')).toBeTruthy();
    // NODE_ENV=test ⇒ pas de flag Secure, ce qui permet à supertest de parler en HTTP.
    const raw = (Array.isArray(setCookie) ? setCookie : [setCookie ?? '']).join(';');
    expect(raw).toContain('HttpOnly');
    expect(raw).not.toContain('Secure');
  });

  it('consomme un code de récupération, et le refuse au second usage → 401', async () => {
    const user = await signupUser(app);
    const [recoveryCode] = user.recoveryCodes;

    const first = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: user.password });
    const ok = await api(app).post('/users/mfa/verify').send({
      pre_auth_token: first.body.pre_auth_token,
      recovery_code: recoveryCode,
    });
    expect(ok.status).toBe(200);

    const second = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: user.password });
    const reused = await api(app).post('/users/mfa/verify').send({
      pre_auth_token: second.body.pre_auth_token,
      recovery_code: recoveryCode,
    });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepte un code de récupération sans tiret et en minuscules', async () => {
    const user = await signupUser(app);
    const normalised = user.recoveryCodes[0].replace('-', '').toLowerCase();

    const login = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: user.password });
    const res = await api(app).post('/users/mfa/verify').send({
      pre_auth_token: login.body.pre_auth_token,
      recovery_code: normalised,
    });

    expect(res.status).toBe(200);
  });

  it('refuse totp_code ET recovery_code ensemble → 400 (exclusivité mutuelle)', async () => {
    const user = await signupUser(app);
    const login = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: user.password });

    const res = await api(app).post('/users/mfa/verify').send({
      pre_auth_token: login.body.pre_auth_token,
      totp_code: await totpNow(user.totpSecret),
      recovery_code: user.recoveryCodes[0],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse l\'absence des deux → 400', async () => {
    const user = await signupUser(app);
    const login = await api(app)
      .post('/users/login')
      .send({ email: user.email, password: user.password });

    const res = await api(app)
      .post('/users/mfa/verify')
      .send({ pre_auth_token: login.body.pre_auth_token });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un pre_auth_token qui est en fait une session → 401', async () => {
    const { cookie } = await createSignedInUser(app);
    const sid = readCookie(cookie.split('; '), 'sid') ?? cookie.replace('sid=', '');

    const res = await api(app).post('/users/mfa/verify').send({
      pre_auth_token: sid,
      totp_code: '123456',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('session', () => {
  it('GET /users/me sans cookie → 401', async () => {
    const res = await api(app).get('/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /users/logout efface le cookie et renvoie 204', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, { cookie }).post('/users/logout').send({});
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(cookieHeader(res.headers['set-cookie'])).toContain('sid=');
  });

  it('un changement de mot de passe invalide les sessions antérieures', async () => {
    const user = await signupUser(app);
    const first = await loginFull(app, user);
    const second = await loginFull(app, user);

    // ⚠️ Attente délibérée, et non un contournement de flakiness.
    // L'invalidation repose sur `password_changed_at > FROM_UNIXTIME(iat)`, or
    // `iat` d'un JWT est en SECONDES et `password_changed_at` est un DATETIME
    // sans précision fractionnaire. Un changement de mot de passe survenant
    // dans la MÊME seconde que l'émission du token ne l'invalide donc pas :
    // la comparaison stricte est fausse à égalité. On franchit la frontière de
    // seconde pour tester le mécanisme sur son domaine de validité réel.
    await waitForNextSecond();

    // La session qui change le mot de passe reçoit une session neuve.
    const change = await api(app, { cookie: second.cookie })
      .post('/users/password')
      .send({ current_password: user.password, new_password: 'un-nouveau-mot-de-passe' });
    expect(change.status).toBe(204);

    const renewed = cookieHeader(change.headers['set-cookie']);
    expect(renewed).toContain('sid=');

    // L'ancienne session est morte...
    const stale = await api(app, { cookie: first.cookie }).get('/users/me');
    expect(stale.status).toBe(401);
    expect(stale.body.error.code).toBe('UNAUTHORIZED');

    // ...mais la session réémise fonctionne.
    const alive = await api(app, { cookie: renewed }).get('/users/me');
    expect(alive.status).toBe(200);
  });

  it('un mauvais current_password donne 401 INVALID_CURRENT_PASSWORD et garde la session', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, { cookie })
      .post('/users/password')
      .send({ current_password: 'pas-le-bon', new_password: 'un-nouveau-mot-de-passe' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    // Distinction qui justifie le code dédié : la session reste utilisable.
    const me = await api(app, { cookie }).get('/users/me');
    expect(me.status).toBe(200);
  });
});

describe('POST /users/mfa/recovery-codes', () => {
  const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  it('remplace les 8 codes, et les anciens ne valent plus rien', async () => {
    const user = await signupUser(app);
    const { cookie } = await loginFull(app, user);

    const res = await api(app, { cookie }).post('/users/mfa/recovery-codes');

    expect(res.status).toBe(200);
    expect(res.body.recovery_codes).toHaveLength(8);
    expect(res.body.recovery_codes).not.toEqual(user.recoveryCodes);

    // Un code de la série précédente doit être rejeté à la vérification MFA.
    const client = api(app);
    const login = await client
      .post('/users/login')
      .send({ email: user.email, password: user.password });
    const verify = await client.post('/users/mfa/verify').send({
      pre_auth_token: login.body.pre_auth_token,
      recovery_code: user.recoveryCodes[0],
    });

    expect(verify.status).toBe(401);
  });

  /**
   * Verrouille l'uniformité du générateur.
   *
   * `_generateRecoveryCodes` tirait chaque caractère avec `randomBytes(10)` puis
   * `b % CHARSET.length`. Ce n'était non biaisé que parce que 256 est un multiple
   * de 32 : retirer ou ajouter un seul caractère au CHARSET aurait faussé la
   * distribution en silence. `crypto.randomInt` rend la propriété indépendante de
   * la longueur - ce test échouerait si un masquage ou un modulo rendait une
   * partie de l'alphabet inatteignable.
   */
  it('couvre tout l\'alphabet et ne répète jamais un code', async () => {
    const user = await signupUser(app);
    const { cookie } = await loginFull(app, user);
    const client = api(app, { cookie });

    const codes: string[] = [...user.recoveryCodes];
    for (let i = 0; i < 20; i += 1) {
      const res = await client.post('/users/mfa/recovery-codes');
      expect(res.status).toBe(200);
      codes.push(...res.body.recovery_codes);
    }

    // 168 codes, soit 1680 tirages : l'absence d'un caractère du CHARSET a une
    // probabilité de l'ordre de e^-52, donc ce test ne peut pas être instable.
    const drawn = new Set(codes.join('').replace(/-/g, ''));
    for (const ch of CHARSET) {
      expect(drawn, `caractère jamais tiré : ${ch}`).toContain(ch);
    }
    // Et aucun caractère hors alphabet (O/0/1/I notamment, écartés à dessein).
    for (const ch of drawn) {
      expect(CHARSET, `caractère inattendu : ${ch}`).toContain(ch);
    }

    expect(new Set(codes).size).toBe(codes.length);
  });
});

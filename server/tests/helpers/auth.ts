import type { Express } from 'express';
import { generate as generateTotp, generateSecret } from 'otplib';
import { expect } from 'vitest';
import { api, cookieHeader } from './http.js';

export interface TestUser {
  email: string;
  password: string;
  /** Secret TOTP en base32, pour rejouer un code à volonté. */
  totpSecret: string;
  recoveryCodes: string[];
  id: number;
}

export interface SignedInUser extends TestUser {
  /** En-tête Cookie prêt à l'emploi, contenant `sid`. */
  cookie: string;
}

const PASSWORD = 'correct-horse-battery-staple';

let emailCounter = 0;

/** Email unique : `users.email` porte une contrainte d'unicité. */
export function uniqueEmail(prefix = 'user'): string {
  emailCounter += 1;
  return `${prefix}-${emailCounter}-${process.pid}@test.local`;
}

/** Code TOTP valide à cet instant pour ce secret. */
export function totpNow(secret: string): Promise<string> {
  return generateTotp({ secret });
}

/**
 * Inscrit un utilisateur en passant par le vrai flux MFA.
 *
 * `POST /users/signup` exige un `totp_secret` base32 valide ET le code à
 * 6 chiffres correspondant : il n'y a pas de raccourci, le service vérifie le
 * code avant de créer quoi que ce soit.
 *
 * IP neuve à chaque appel : le limiteur d'inscription est à 5/heure.
 */
export async function signupUser(
  app: Express,
  email = uniqueEmail(),
): Promise<TestUser> {
  const totpSecret = generateSecret();

  const res = await api(app)
    .post('/users/signup')
    .send({
      email,
      password: PASSWORD,
      totp_secret: totpSecret,
      totp_code: await totpNow(totpSecret),
    });

  expect(res.status, `signup a échoué : ${JSON.stringify(res.body)}`).toBe(201);

  return {
    email,
    password: PASSWORD,
    totpSecret,
    recoveryCodes: res.body.recovery_codes,
    id: res.body.user.id,
  };
}

/**
 * Connecte un utilisateur déjà inscrit : login puis vérification MFA.
 *
 * Deux appels sont nécessaires, car `signup` **n'émet pas de session** - le
 * client repasse par /login (cf. le commentaire de user.controller.ts).
 */
export async function loginFull(
  app: Express,
  user: TestUser,
  opts: { rememberDevice?: boolean } = {},
): Promise<{ cookie: string; setCookie: string | string[] | undefined }> {
  const client = api(app);

  const login = await client
    .post('/users/login')
    .send({ email: user.email, password: user.password });

  expect(login.status, `login a échoué : ${JSON.stringify(login.body)}`).toBe(200);
  expect(login.body.mfa_required).toBe(true);

  const verify = await client.post('/users/mfa/verify').send({
    pre_auth_token: login.body.pre_auth_token,
    totp_code: await totpNow(user.totpSecret),
    ...(opts.rememberDevice ? { remember_device: true } : {}),
  });

  expect(verify.status, `mfa/verify a échoué : ${JSON.stringify(verify.body)}`).toBe(200);

  const setCookie = verify.headers['set-cookie'];
  return { cookie: cookieHeader(setCookie), setCookie };
}

/** Inscription + connexion, le cas courant. */
export async function createSignedInUser(app: Express): Promise<SignedInUser> {
  const user = await signupUser(app);
  const { cookie } = await loginFull(app, user);
  return { ...user, cookie };
}

/**
 * Crée un PAT et renvoie le token en clair - il n'est retourné qu'une seule
 * fois par l'API, seul son hash SHA-256 est stocké.
 */
export async function createPat(
  app: Express,
  cookie: string,
  scopes?: string[],
): Promise<{ token: string; id: number; scopes: string[] }> {
  const res = await api(app, { cookie })
    .post('/users/tokens')
    .send(scopes === undefined ? {} : { scopes });

  expect(res.status, `création du PAT a échoué : ${JSON.stringify(res.body)}`).toBe(201);

  return { token: res.body.token, id: res.body.pat.id, scopes: res.body.pat.scopes };
}

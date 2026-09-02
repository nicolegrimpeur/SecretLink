import crypto from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { generate as generateTotp, generateSecret } from 'otplib';

/**
 * Toutes les requêtes passent par `/api`, donc par le nginx du service client.
 * C'est volontaire : cela valide le proxy et reproduit exactement le chemin
 * qu'emprunte le navigateur.
 */

/** Le front hache la passphrase en SHA-256 hex (cf. CryptoService). */
export const sha256Hex = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

export interface SeededLink {
  linkToken: string;
  linkUrl: string;
}

async function expectOk(res: { ok(): boolean; status(): number; text(): Promise<string> }, what: string) {
  if (!res.ok()) {
    throw new Error(`${what} a répondu ${res.status()} : ${await res.text()}`);
  }
}

/** Lien public anonyme, sans authentification. */
export async function seedPublicLink(
  request: APIRequestContext,
  secret: string,
): Promise<SeededLink> {
  const res = await request.post('/api/links', { data: { secret } });
  await expectOk(res, 'POST /api/links');

  const { result } = await res.json();
  return { linkToken: result.link_token, linkUrl: result.link_url };
}

let emailCounter = 0;

export interface ApiUser {
  email: string;
  password: string;
  totpSecret: string;
  recoveryCodes: string[];
}

/**
 * Inscrit puis connecte un utilisateur via l'API. Le cookie de session est
 * conservé par l'`APIRequestContext` appelant, donc les requêtes suivantes
 * sont authentifiées.
 *
 * ⚠️ Consomme un des **5 signups par heure et par IP** autorisés. Voir la note
 * en tête de e2e/README.md.
 */
export async function signupAndLoginViaApi(request: APIRequestContext): Promise<ApiUser> {
  emailCounter += 1;
  const email = `e2e-api-${Date.now()}-${emailCounter}@test.local`;
  const password = 'correct-horse-battery-staple';
  const totpSecret = generateSecret();

  const signup = await request.post('/api/users/signup', {
    data: {
      email,
      password,
      totp_secret: totpSecret,
      totp_code: await generateTotp({ secret: totpSecret }),
    },
  });
  await expectOk(signup, 'POST /api/users/signup');
  const { recovery_codes: recoveryCodes } = await signup.json();

  // signup n'émet pas de session : il faut repasser par login puis mfa/verify.
  const login = await request.post('/api/users/login', { data: { email, password } });
  await expectOk(login, 'POST /api/users/login');
  const { pre_auth_token } = await login.json();

  const verify = await request.post('/api/users/mfa/verify', {
    data: {
      pre_auth_token,
      totp_code: await generateTotp({ secret: totpSecret }),
    },
  });
  await expectOk(verify, 'POST /api/users/mfa/verify');

  return { email, password, totpSecret, recoveryCodes };
}

/**
 * Lien protégé par une passphrase, créé via /links/bulk (qui exige une session).
 * Le secret est laissé en clair : seule la porte serveur est testée ici, pas le
 * chiffrement côté front - `decryptIfNeeded` renvoie tel quel un secret sans
 * préfixe `enc:`.
 */
export async function seedPassphraseLink(
  request: APIRequestContext,
  secret: string,
  passphrase: string,
): Promise<SeededLink> {
  await signupAndLoginViaApi(request);

  const res = await request.post('/api/links/bulk', {
    data: [
      {
        item_id: `e2e-passphrase-${Date.now()}`,
        secret,
        passphrase_hash: sha256Hex(passphrase),
      },
    ],
  });
  await expectOk(res, 'POST /api/links/bulk');

  const { results } = await res.json();
  if (results[0].status !== 'created') {
    throw new Error(`création attendue, obtenu « ${results[0].status} »`);
  }
  return { linkToken: results[0].link_token, linkUrl: results[0].link_url };
}

/** Code TOTP valide à cet instant. */
export const totpNow = (secret: string) => generateTotp({ secret });

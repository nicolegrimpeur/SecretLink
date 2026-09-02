import crypto from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import config from '../../src/config/env.js';
import { createPat, createSignedInUser } from '../helpers/auth.js';
import { closeDb, resetDb } from '../helpers/db.js';
import { api } from '../helpers/http.js';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Ce que fait le front avant d'envoyer : SHA-256 hex de la passphrase. */
const sha256Hex = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const app = createApp();

beforeEach(resetDb);
afterAll(closeDb);

describe('POST /links - création publique anonyme', () => {
  it('renvoie 201 avec un résultat unique enveloppé dans `result`', async () => {
    const res = await api(app).post('/links').send({ secret: 'vpn-ALICE' });

    expect(res.status).toBe(201);
    expect(res.body.result).toMatchObject({
      item_id: '',
      status: 'created',
      error: null,
    });
    expect(typeof res.body.result.link_token).toBe('string');
    expect(res.body.result.expires_at).toMatch(ISO_UTC);
  });

  it('construit link_url vers le FRONT, pas vers l\'API', async () => {
    const res = await api(app).post('/links').send({ secret: 'vpn-ALICE' });
    const { link_token: token, link_url: url } = res.body.result;

    // Distinction volontaire : link_url est la page partageable à un humain,
    // GET /links/redeem/:token est l'endpoint JSON qu'elle appelle.
    expect(url).toBe(`${config.FRONT_BASE_URL}/redeem/${token}`);

    // Régression historique : link_url pointait vers `/links/<token>/redeem`,
    // une route qui n'existe pas - l'URL distribuée par l'API ne servait donc
    // jamais le secret.
    expect(url).not.toContain('/links/');
  });

  it('expire à 7 jours, TTL fixé côté serveur', async () => {
    const before = Date.now();
    const res = await api(app).post('/links').send({ secret: 's' });
    const delta = new Date(res.body.result.expires_at).getTime() - before;

    expect(delta).toBeGreaterThan(6.9 * 86_400_000);
    expect(delta).toBeLessThan(7.1 * 86_400_000);
  });

  it('accepte 64 caractères de secret, refuse 65 → 400', async () => {
    const ok = await api(app).post('/links').send({ secret: 'x'.repeat(64) });
    expect(ok.status).toBe(201);

    // Limite propre à cet endpoint : /links/bulk autorise 4096.
    const tooLong = await api(app).post('/links').send({ secret: 'x'.repeat(65) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un secret vide ou absent → 400', async () => {
    for (const body of [{}, { secret: '' }]) {
      const res = await api(app).post('/links').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('GET /links/redeem/:token', () => {
  async function createPublicLink(secret = 'vpn-ALICE') {
    const res = await api(app).post('/links').send({ secret });
    expect(res.status).toBe(201);
    return res.body.result.link_token as string;
  }

  it('renvoie le secret en clair et un redeemed_at ISO', async () => {
    const token = await createPublicLink('vpn-ALICE');
    const res = await api(app).get(`/links/redeem/${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ item_id: '', secret: 'vpn-ALICE' });
    expect(res.body.redeemed_at).toMatch(ISO_UTC);
  });

  it('est à usage unique : le second appel donne 410 LINK_GONE', async () => {
    const token = await createPublicLink();

    const first = await api(app).get(`/links/redeem/${token}`);
    expect(first.status).toBe(200);

    // L'invariant produit le plus important de toute l'application.
    const second = await api(app).get(`/links/redeem/${token}`);
    expect(second.status).toBe(410);
    expect(second.body.error.code).toBe('LINK_GONE');
  });

  it('renvoie 404 NOT_FOUND sur un token inconnu', async () => {
    const res = await api(app).get('/links/redeem/token-qui-nexiste-pas');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('purge réellement le secret en base après consommation', async () => {
    const token = await createPublicLink('a-effacer');
    await api(app).get(`/links/redeem/${token}`);

    const rows = await (await import('../helpers/db.js')).queryRows<{
      cipher_text: Buffer | string;
      used_at: string | null;
    }>('SELECT cipher_text, used_at FROM links');

    expect(rows).toHaveLength(1);
    expect(rows[0].used_at).not.toBeNull();
    expect(String(rows[0].cipher_text)).toBe('');
  });
});

describe('GET /links/redeem/:token - passphrase', () => {
  async function createProtectedLink(passphrase: string) {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie })
      .post('/links/bulk')
      .send([
        {
          item_id: 'alice@example.com',
          secret: 'enc:charge-chiffree-par-le-front',
          passphrase_hash: sha256Hex(passphrase),
        },
      ]);

    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe('created');
    return res.body.results[0].link_token as string;
  }

  it('sans ?pass → 403 PASSPHRASE_REQUIRED', async () => {
    const token = await createProtectedLink('ouvre-toi');
    const res = await api(app).get(`/links/redeem/${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSPHRASE_REQUIRED');
  });

  it('avec un mauvais hash → 403 INVALID_PASSPHRASE', async () => {
    const token = await createProtectedLink('ouvre-toi');
    const res = await api(app)
      .get(`/links/redeem/${token}`)
      .query({ pass: sha256Hex('mauvaise-passphrase') });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_PASSPHRASE');
  });

  it('avec le bon hash → 200, et le lien reste consommable une seule fois', async () => {
    const token = await createProtectedLink('ouvre-toi');
    const pass = sha256Hex('ouvre-toi');

    const ok = await api(app).get(`/links/redeem/${token}`).query({ pass });
    expect(ok.status).toBe(200);
    expect(ok.body.secret).toBe('enc:charge-chiffree-par-le-front');

    const again = await api(app).get(`/links/redeem/${token}`).query({ pass });
    expect(again.status).toBe(410);
    expect(again.body.error.code).toBe('LINK_GONE');
  });

  it('un échec de passphrase ne consomme pas le lien', async () => {
    const token = await createProtectedLink('ouvre-toi');

    const failed = await api(app)
      .get(`/links/redeem/${token}`)
      .query({ pass: sha256Hex('faux') });
    expect(failed.status).toBe(403);

    const ok = await api(app)
      .get(`/links/redeem/${token}`)
      .query({ pass: sha256Hex('ouvre-toi') });
    expect(ok.status).toBe(200);
  });
});

describe('POST /links/bulk - authentification', () => {
  const item = () => [{ item_id: `item-${Math.random()}`, secret: 's' }];

  it('sans session ni PAT → 401 UNAUTHORIZED', async () => {
    const res = await api(app).post('/links/bulk').send(item());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('avec un PAT inconnu → 401 UNAUTHORIZED', async () => {
    const res = await api(app, { bearer: 'un-pat-qui-nexiste-pas' })
      .post('/links/bulk')
      .send(item());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('avec un PAT sans le scope links:write → 403 FORBIDDEN', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie, ['links:read']);

    const res = await api(app, { bearer: pat.token }).post('/links/bulk').send(item());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('avec un PAT porteur du scope → 201', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie, ['links:write']);

    const res = await api(app, { bearer: pat.token }).post('/links/bulk').send(item());

    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe('created');
  });

  it('une session accorde tous les scopes → 201', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).post('/links/bulk').send(item());

    expect(res.status).toBe(201);
  });

  it('un PAT révoqué → 401 UNAUTHORIZED', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie);

    const revoke = await api(app, { cookie }).delete(`/users/tokens/${pat.id}`);
    expect(revoke.status).toBe(204);

    const res = await api(app, { bearer: pat.token }).post('/links/bulk').send(item());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('un PAT ne donne accès à AUCUNE route /users/* → 401', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie);

    // sessionAuth ignore totalement l'en-tête Authorization.
    const res = await api(app, { bearer: pat.token }).get('/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

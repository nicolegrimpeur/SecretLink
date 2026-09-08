import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import config from '../../src/config/env.js';
import { closeDb, resetDb } from '../helpers/db.js';
import { createPat, createSignedInUser, signupUser, totpNow } from '../helpers/auth.js';
import { api, cookieValue, readCookie } from '../helpers/http.js';

/**
 * La porte anti-CSRF de middleware/csrf.ts.
 *
 * Ces tests ont une raison d'être précise : avant ce middleware, les mutations
 * cross-origin étaient bloquées par *effet de bord* du callback CORS, qui throw
 * un 403 au lieu de simplement omettre ses en-têtes. Rien ne le disait, rien ne
 * le vérifiait. Ce fichier fixe le contrat, y compris ses exemptions assumées.
 */

const app = createApp();

const EXTENSION_ORIGIN = `chrome-extension://${config.ALLOWED_EXTENSION_IDS}`;

beforeEach(resetDb);
afterAll(closeDb);

describe('émission du jeton', () => {
  it('mfa/verify pose XSRF-TOKEN à côté de sid, lisible par le JS', async () => {
    const user = await signupUser(app);
    const client = api(app);

    const login = await client
      .post('/users/login')
      .send({ email: user.email, password: user.password });
    const verify = await client.post('/users/mfa/verify').send({
      pre_auth_token: login.body.pre_auth_token,
      totp_code: await totpNow(user.totpSecret),
    });

    expect(verify.status).toBe(200);

    const setCookie = verify.headers['set-cookie'];
    expect(readCookie(setCookie, 'XSRF-TOKEN')).toBeTruthy();

    // httpOnly ferait échouer l'intercepteur d'Angular, qui lit document.cookie.
    const raw = (Array.isArray(setCookie) ? setCookie : [setCookie ?? '']).find((c) =>
      c.startsWith('XSRF-TOKEN='),
    );
    expect(raw?.toLowerCase()).not.toContain('httponly');
    expect(raw?.toLowerCase()).toContain('samesite=lax');
  });

  it('une requête portant sid sans jeton s\'en voit poser un', async () => {
    const { cookie } = await createSignedInUser(app);
    const sidOnly = `sid=${cookieValue(cookie, 'sid')}`;

    const res = await api(app, { cookie: sidOnly }).get('/users/me');

    expect(res.status).toBe(200);
    expect(readCookie(res.headers['set-cookie'], 'XSRF-TOKEN')).toBeTruthy();
  });

  it('logout efface les deux cookies', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, { cookie }).post('/users/logout');

    expect(res.status).toBe(204);
    const setCookie = res.headers['set-cookie'];
    const cleared = (Array.isArray(setCookie) ? setCookie : [setCookie ?? '']).join(' | ');
    expect(cleared).toContain('sid=;');
    expect(cleared).toContain('XSRF-TOKEN=;');
  });
});

describe('vérification d\'Origin', () => {
  it('refuse une mutation portant une session et une Origin hors liste', async () => {
    const { cookie } = await createSignedInUser(app);

    // La couche CORS répond déjà 403 sur cette origine ; ce test existe pour que
    // le jour où elle cesserait de throw, la porte CSRF prenne le relais.
    const res = await api(app, { cookie, origin: 'https://evil.example' })
      .post('/users/logout');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
  });

  it('accepte une mutation depuis FRONT_BASE_URL avec son jeton', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, { cookie, origin: config.FRONT_BASE_URL })
      .post('/users/logout');

    expect(res.status).toBe(204);
  });

  it('laisse passer une mutation sans Origin (curl, supertest, CI)', async () => {
    // Exemption assumée : aucun navigateur n'omet Origin sur une méthode non
    // sûre, donc elle ne couvre aucun cas atteignable par un attaquant web.
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, { cookie, xsrf: null }).post('/users/logout');

    expect(res.status).toBe(204);
  });
});

describe('double-submit', () => {
  it('refuse une mutation dont l\'en-tête X-XSRF-TOKEN manque', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, {
      cookie,
      origin: config.FRONT_BASE_URL,
      xsrf: null,
    }).post('/users/logout');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('refuse un en-tête qui ne correspond pas au cookie', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, {
      cookie,
      origin: config.FRONT_BASE_URL,
      xsrf: 'un-jeton-qui-nest-pas-le-bon',
    }).post('/users/logout');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('refuse un en-tête de même longueur mais de contenu différent', async () => {
    // Garde-fou sur la comparaison constant-time : un test de longueur seul
    // laisserait passer celui-ci.
    const { cookie } = await createSignedInUser(app);
    const token = cookieValue(cookie, 'XSRF-TOKEN')!;
    const forged = `${'A'.repeat(token.length - 1)}B`;

    const res = await api(app, {
      cookie,
      origin: config.FRONT_BASE_URL,
      xsrf: forged,
    }).post('/users/logout');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('exempte l\'extension épinglée, qui ne peut pas lire le cookie', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, {
      cookie,
      origin: EXTENSION_ORIGIN,
      xsrf: null,
    })
      .post('/links/bulk')
      .send([{ item_id: 'depuis-extension', secret: 's' }]);

    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe('created');
  });
});

describe('portée de la porte', () => {
  it('ne s\'applique pas à un PAT sans cookie de session', async () => {
    const { cookie } = await createSignedInUser(app);
    const { token } = await createPat(app, cookie, ['links:write']);

    const res = await api(app, { bearer: token, origin: config.FRONT_BASE_URL })
      .post('/links/bulk')
      .send([{ item_id: 'via-pat', secret: 's' }]);

    expect(res.status).toBe(201);
    expect(res.body.results[0].status).toBe('created');
  });

  it('ne s\'applique pas aux routes publiques et anonymes', async () => {
    const create = await api(app, { origin: config.FRONT_BASE_URL })
      .post('/links')
      .send({ secret: 'anonyme' });

    expect(create.status).toBe(201);

    const redeem = await api(app, { origin: config.FRONT_BASE_URL })
      .get(`/links/redeem/${create.body.result.link_token}`);

    expect(redeem.status).toBe(200);
  });

  it('ne bloque jamais un GET, même sans jeton', async () => {
    const { cookie } = await createSignedInUser(app);

    const res = await api(app, {
      cookie,
      origin: config.FRONT_BASE_URL,
      xsrf: null,
    }).get('/users/me');

    expect(res.status).toBe(200);
  });

  it('laisse le préflight OPTIONS répondre 204', async () => {
    const res = await api(app, { origin: config.FRONT_BASE_URL })
      .options('/users/logout');

    expect(res.status).toBe(204);
  });

  it('laisse le 503 de maintenance gagner sur le 403', async () => {
    const { cookie } = await createSignedInUser(app);
    config.MAINTENANCE_MODE = 1;
    try {
      const res = await api(app, {
        cookie,
        origin: config.FRONT_BASE_URL,
        xsrf: null,
      }).post('/users/logout');

      expect(res.status).toBe(503);
    } finally {
      config.MAINTENANCE_MODE = 0;
    }
  });
});

describe('absence de variable d\'échappement', () => {
  /**
   * Le double-submit est inconditionnel : il n'existe aucun réglage pour le
   * désactiver, y compris pour une session ouverte avant le déploiement du
   * middleware. Ce que ça n'empêche pas de fonctionner est couvert par les
   * exemptions testées plus haut - et la SPA, qui appelle GET /users/me depuis
   * provideAppInitializer, récupère son jeton avant tout clic possible.
   */
  it('refuse une session dépourvue du cookie de jeton, sans échappatoire', async () => {
    const { cookie } = await createSignedInUser(app);
    const sidOnly = `sid=${cookieValue(cookie, 'sid')}`;

    const res = await api(app, {
      cookie: sidOnly,
      origin: config.FRONT_BASE_URL,
    }).post('/users/logout');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('mais un GET reste servi, ce qui est ce qui repose le jeton', async () => {
    const { cookie } = await createSignedInUser(app);
    const sidOnly = `sid=${cookieValue(cookie, 'sid')}`;

    const res = await api(app, {
      cookie: sidOnly,
      origin: config.FRONT_BASE_URL,
    }).get('/users/me');

    expect(res.status).toBe(200);
    expect(readCookie(res.headers['set-cookie'], 'XSRF-TOKEN')).toBeTruthy();
  });
});

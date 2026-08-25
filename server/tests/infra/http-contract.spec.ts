import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import config from '../../src/config/env.js';
import { closeDb, resetDb } from '../helpers/db.js';
import { api, fixedIp } from '../helpers/http.js';

const app = createApp();

beforeEach(resetDb);
afterAll(closeDb);

describe('GET /health', () => {
  it('renvoie 200 avec un timestamp ISO', async () => {
    const res = await api(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('n\'annonce pas Express', async () => {
    const res = await api(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('routes inconnues', () => {
  it('renvoie 404 JSON quelle que soit la méthode', async () => {
    const client = api(app);

    for (const call of [
      client.get('/route-inconnue'),
      client.post('/route-inconnue'),
      client.delete('/route-inconnue'),
      client.put('/route-inconnue'),
      client.patch('/route-inconnue'),
    ]) {
      const res = await call;
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('ne redirige PLUS les GET vers le front', async () => {
    // Historiquement un catch-all renvoyait 302 vers FRONT_BASE_URL, ce qui
    // masquait toute faute de frappe d'URL derrière une redirection.
    const res = await api(app).get('/nimporte/quoi');

    expect(res.status).toBe(404);
    expect(res.headers.location).toBeUndefined();
  });

  it('renvoie 404 aussi sous un préfixe de route existant', async () => {
    const client = api(app);
    expect((await client.get('/users/inconnu')).status).toBe(404);
    expect((await client.get('/links/inconnu')).status).toBe(404);
  });

  it('exception OPTIONS : la couche CORS répond 204 avant le handler 404', async () => {
    const res = await api(app).options('/route-inconnue');
    expect(res.status).toBe(204);
  });
});

describe('CORS', () => {
  it('accepte une origine de la liste', async () => {
    const res = await api(app, { origin: 'http://localhost:8100' }).get('/users/me');

    // 401 parce qu'il n'y a pas de session : la requête a bien traversé CORS.
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8100');
  });

  it('accepte FRONT_BASE_URL, toujours autorisée', async () => {
    const res = await api(app, { origin: config.FRONT_BASE_URL }).get('/users/me');
    expect(res.headers['access-control-allow-origin']).toBe(config.FRONT_BASE_URL);
  });

  it('accepte n\'importe quelle origine chrome-extension://', async () => {
    const origin = 'chrome-extension://dbneilgepekkiaabbjdmhmakojcenpel';
    const res = await api(app, { origin }).get('/users/me');

    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });

  it('refuse une origine hors liste → 403 CORS_ORIGIN_NOT_ALLOWED', async () => {
    const res = await api(app, { origin: 'https://evil.example' }).get('/users/me');

    // À ne pas confondre avec le 403 FORBIDDEN des scopes PAT.
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
  });

  it('laisse passer une requête sans Origin (curl, scripts, Postman)', async () => {
    const res = await api(app).get('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('erreurs de corps de requête', () => {
  it('JSON malformé → 400 INVALID_JSON', async () => {
    const res = await api(app)
      .post('/users/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c",');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('corps supérieur à 1 Mo → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await api(app)
      .post('/links')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ secret: 'x'.repeat(1_200_000) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('charset non supporté → 415 UNSUPPORTED_CHARSET', async () => {
    const res = await api(app)
      .post('/users/login')
      .set('Content-Type', 'application/json; charset=latin1')
      .send('{"email":"a@b.c","password":"x"}');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_CHARSET');
  });

  it('Content-Encoding inconnu → 415 UNSUPPORTED_ENCODING', async () => {
    const res = await api(app)
      .post('/users/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'encodage-imaginaire')
      .send('{"email":"a@b.c","password":"x"}');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_ENCODING');
  });

  it('un Content-Type non JSON laisse le corps vide → 400 VALIDATION_ERROR', async () => {
    const res = await api(app)
      .post('/users/login')
      .set('Content-Type', 'text/plain')
      .send('email=a@b.c');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('mode maintenance', () => {
  afterEach(() => {
    config.MAINTENANCE_MODE = 0;
  });

  it('ferme toutes les routes en 503 JSON, sauf /health', async () => {
    config.MAINTENANCE_MODE = 1;
    const client = api(app);

    const closed = await client.get('/users/me');
    expect(closed.status).toBe(503);
    expect(closed.body.error.code).toBe('MAINTENANCE_MODE');

    const post = await client.post('/links').send({ secret: 's' });
    expect(post.status).toBe(503);

    // La sonde de disponibilité doit continuer de répondre pendant l'intervention.
    const health = await client.get('/health');
    expect(health.status).toBe(200);
  });
});

describe('rate limiting', () => {
  /** Épuise un limiteur puis renvoie la première réponse refusée. */
  async function exhaust(
    ip: string,
    max: number,
    call: (client: ReturnType<typeof api>) => Promise<{ status: number; body: any; headers: any }>,
  ) {
    const client = api(app, { ip });
    for (let i = 0; i < max; i += 1) {
      const res = await call(client);
      expect(res.status, `appel ${i + 1}/${max} ne devrait pas être limité`).not.toBe(429);
    }
    return call(client);
  }

  it('inscription : 5 par heure', async () => {
    // Corps invalide volontairement : le limiteur est monté AVANT le contrôleur,
    // donc l'appel compte tout en évitant le coût d'un hash argon2.
    const res = await exhaust(fixedIp('signup'), 5, (c) =>
      c.post('/users/signup').send({}),
    );

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('authentification : 10 par 15 minutes', async () => {
    const res = await exhaust(fixedIp('auth'), 10, (c) => c.post('/users/login').send({}));

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('liens publics : 20 par 15 minutes', async () => {
    const res = await exhaust(fixedIp('public-links'), 20, (c) =>
      c.post('/links').send({}),
    );

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('limiteur global : 100 par minute', async () => {
    const res = await exhaust(fixedIp('global'), 100, (c) => c.get('/route-inconnue'));

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('expose les en-têtes RateLimit-* sur une réponse normale', async () => {
    const res = await api(app).get('/users/me');

    expect(res.headers['ratelimit-policy']).toBeDefined();
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
    // Retry-After n'apparaît que sur un refus.
    expect(res.headers['retry-after']).toBeUndefined();
  });

  it('/health échappe au limiteur global', async () => {
    const client = api(app, { ip: fixedIp('health-exempt') });

    for (let i = 0; i < 105; i += 1) {
      const res = await client.get('/health');
      expect(res.status, `appel ${i + 1}`).toBe(200);
    }
  });
});

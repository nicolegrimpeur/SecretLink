import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createPat, createSignedInUser } from '../helpers/auth.js';
import { closeDb, queryRows, resetDb } from '../helpers/db.js';
import { api } from '../helpers/http.js';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ALL_SCOPES = ['links:read', 'links:write', 'links:delete'];

const app = createApp();

beforeEach(resetDb);
afterAll(closeDb);

describe('POST /users/tokens', () => {
  it('accorde les trois scopes quand scopes est absent', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).post('/users/tokens').send({});

    expect(res.status).toBe(201);
    expect(res.body.pat.scopes).toEqual(ALL_SCOPES);
    expect(res.body.pat.revoked_at).toBeNull();
    expect(res.body.pat.created_at).toMatch(ISO_UTC);
  });

  it('accorde les trois scopes quand scopes est un tableau VIDE', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).post('/users/tokens').send({ scopes: [] });

    // `.default()` de zod ne se déclenche que sur undefined : sans la
    // transformation, ce cas produirait un PAT sans aucun scope, donc en 403
    // sur chaque appel.
    expect(res.status).toBe(201);
    expect(res.body.pat.scopes).toEqual(ALL_SCOPES);
  });

  it('renvoie le token en clair une seule fois, avec un aperçu de 6 caractères', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).post('/users/tokens').send({ label: 'bulk-import' });

    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token_preview).toBe(res.body.token.slice(-6));
    expect(res.body.pat.label).toBe('bulk-import');

    // La liste ne le redonne jamais.
    const list = await api(app, { cookie }).get('/users/tokens');
    expect(JSON.stringify(list.body)).not.toContain(res.body.token);
  });

  it('refuse un scope inconnu → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie })
      .post('/users/tokens')
      .send({ scopes: ['links:read', 'bogus'] });

    // Sans liste fermée, ce PAT serait créé puis rejetterait chaque appel en 403
    // sans que rien n'ait signalé la faute de frappe.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('déduplique les scopes répétés', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie })
      .post('/users/tokens')
      .send({ scopes: ['links:read', 'links:read', 'links:write'] });

    expect(res.status).toBe(201);
    expect(res.body.pat.scopes).toEqual(['links:read', 'links:write']);
  });

  it('refuse un scopes qui n\'est pas un tableau → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).post('/users/tokens').send({ scopes: 'links:read' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('exige une session → 401 sans cookie', async () => {
    const res = await api(app).post('/users/tokens').send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /users/tokens', () => {
  it('liste aussi les tokens révoqués, dates en ISO', async () => {
    const { cookie } = await createSignedInUser(app);
    const kept = await createPat(app, cookie);
    const revoked = await createPat(app, cookie);
    await api(app, { cookie }).delete(`/users/tokens/${revoked.id}`);

    const res = await api(app, { cookie }).get('/users/tokens');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    interface ListedPat {
      id: number;
      created_at: string;
      revoked_at: string | null;
    }
    const byId = new Map<number, ListedPat>(
      (res.body as ListedPat[]).map((t) => [t.id, t]),
    );
    expect(byId.get(kept.id)?.revoked_at).toBeNull();
    expect(byId.get(revoked.id)?.revoked_at).toMatch(ISO_UTC);
    for (const token of res.body) {
      expect(token.created_at).toMatch(ISO_UTC);
    }
  });

  it('cloisonne les tokens entre utilisateurs', async () => {
    const alice = await createSignedInUser(app);
    const bob = await createSignedInUser(app);
    await createPat(app, alice.cookie);

    const res = await api(app, { cookie: bob.cookie }).get('/users/tokens');
    expect(res.body).toEqual([]);
  });
});

describe('DELETE /users/tokens/:id', () => {
  it('révoque et renvoie 204', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie);

    const res = await api(app, { cookie }).delete(`/users/tokens/${pat.id}`);
    expect(res.status).toBe(204);
  });

  it('refuse un id non entier positif → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    for (const id of ['abc', '0', '-1', '1.5']) {
      const res = await client.delete(`/users/tokens/${id}`);
      expect(res.status, `id=${id}`).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('renvoie 404 sur un id inexistant', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).delete('/users/tokens/999999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('renvoie 404 sur le token d\'un autre utilisateur', async () => {
    const alice = await createSignedInUser(app);
    const bob = await createSignedInUser(app);
    const pat = await createPat(app, alice.cookie);

    const res = await api(app, { cookie: bob.cookie }).delete(`/users/tokens/${pat.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('est idempotent, et conserve l\'horodatage de la PREMIÈRE révocation', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie);
    const client = api(app, { cookie });

    expect((await client.delete(`/users/tokens/${pat.id}`)).status).toBe(204);

    // On recule la date en base pour rendre le test déterministe : deux appels
    // dans la même seconde produiraient un NOW() identique et ne prouveraient
    // rien du COALESCE.
    await queryRows(
      'UPDATE api_tokens SET revoked_at = ? WHERE id = ?',
      ['2020-01-02 03:04:05', pat.id],
    );

    expect((await client.delete(`/users/tokens/${pat.id}`)).status).toBe(204);

    const [row] = await queryRows<{ revoked_at: Date }>(
      'SELECT revoked_at FROM api_tokens WHERE id = ?',
      [pat.id],
    );
    expect(new Date(row.revoked_at).toISOString()).toBe('2020-01-02T03:04:05.000Z');
  });

  it('exige une session → 401 sans cookie', async () => {
    const res = await api(app).delete('/users/tokens/1');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

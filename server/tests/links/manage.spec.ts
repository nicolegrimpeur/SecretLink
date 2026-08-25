import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createPat, createSignedInUser } from '../helpers/auth.js';
import { closeDb, resetDb } from '../helpers/db.js';
import { api } from '../helpers/http.js';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const app = createApp();

beforeEach(resetDb);
afterAll(closeDb);

describe('POST /links/bulk — validation et statuts par item', () => {
  it('répond 201 même en échec total : le statut est porté par chaque item', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    const first = await client.post('/links/bulk').send([{ item_id: 'a', secret: 's1' }]);
    expect(first.status).toBe(201);
    expect(first.body.results[0].status).toBe('created');

    // Un lien encore actif bloque la recréation pour le même item_id.
    const again = await client.post('/links/bulk').send([{ item_id: 'a', secret: 's2' }]);
    expect(again.status).toBe(201);
    expect(again.body.results[0]).toMatchObject({
      item_id: 'a',
      status: 'duplicate_item_id',
      link_token: null,
      link_url: null,
      error: null,
    });
  });

  it('traite chaque item indépendamment dans un même lot', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    await client.post('/links/bulk').send([{ item_id: 'deja-la', secret: 's' }]);

    const res = await client.post('/links/bulk').send([
      { item_id: 'deja-la', secret: 's' },
      { item_id: 'nouveau', secret: 's' },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
      'duplicate_item_id',
      'created',
    ]);
  });

  it('ttl_days = 0 signifie pas d\'expiration', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie })
      .post('/links/bulk')
      .send([{ item_id: 'sans-expiration', secret: 's', ttl_days: 0 }]);

    expect(res.status).toBe(201);
    expect(res.body.results[0].expires_at).toBeNull();
  });

  it('ttl_days accepte les décimales (décision produit) : 0.5 = 12 heures', async () => {
    const { cookie } = await createSignedInUser(app);
    const before = Date.now();

    const res = await api(app, { cookie })
      .post('/links/bulk')
      .send([{ item_id: 'demi-journee', secret: 's', ttl_days: 0.5 }]);

    expect(res.status).toBe(201);
    const delta = new Date(res.body.results[0].expires_at).getTime() - before;
    expect(delta).toBeGreaterThan(11.9 * 3_600_000);
    expect(delta).toBeLessThan(12.1 * 3_600_000);
  });

  it('refuse ttl_days hors bornes → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    for (const ttl of [-1, 366]) {
      const res = await client.post('/links/bulk').send([{ item_id: 'x', secret: 's', ttl_days: ttl }]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuse un tableau vide, et un lot de plus de 1000 items → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    const empty = await client.post('/links/bulk').send([]);
    expect(empty.status).toBe(400);

    const tooMany = await client
      .post('/links/bulk')
      .send(Array.from({ length: 1001 }, (_, i) => ({ item_id: `i${i}`, secret: 's' })));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepte un secret de 4096 caractères, refuse 4097 → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    const ok = await client.post('/links/bulk').send([{ item_id: 'long', secret: 'x'.repeat(4096) }]);
    expect(ok.status).toBe(201);

    const tooLong = await client
      .post('/links/bulk')
      .send([{ item_id: 'trop-long', secret: 'x'.repeat(4097) }]);
    expect(tooLong.status).toBe(400);
  });

  it('exige un passphrase_hash de 64 caractères hex minuscules → 400 sinon', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    for (const hash of ['trop-court', 'A'.repeat(64), 'z'.repeat(64)]) {
      const res = await client
        .post('/links/bulk')
        .send([{ item_id: `h-${hash.length}`, secret: 's', passphrase_hash: hash }]);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('refuse un corps qui n\'est pas un tableau → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie })
      .post('/links/bulk')
      .send({ item_id: 'a', secret: 's' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /links/by-item/:item_id', () => {
  async function seedLink(cookie: string, itemId: string) {
    const res = await api(app, { cookie })
      .post('/links/bulk')
      .send([{ item_id: itemId, secret: 'secret' }]);
    expect(res.body.results[0].status).toBe('created');
    return res.body.results[0].link_token as string;
  }

  it('supprime le lien et renvoie 204', async () => {
    const { cookie } = await createSignedInUser(app);
    await seedLink(cookie, 'a-supprimer');

    const res = await api(app, { cookie }).delete('/links/by-item/a-supprimer');
    expect(res.status).toBe(204);
  });

  it('rend le lien inconsommable après suppression → 410', async () => {
    const { cookie } = await createSignedInUser(app);
    const token = await seedLink(cookie, 'a-supprimer');

    await api(app, { cookie }).delete('/links/by-item/a-supprimer');

    const res = await api(app).get(`/links/redeem/${token}`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('LINK_GONE');
  });

  it('renvoie 404 sur item inconnu, déjà supprimé, ou déjà consommé', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    const unknown = await client.delete('/links/by-item/jamais-cree');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');

    await seedLink(cookie, 'double-suppression');
    expect((await client.delete('/links/by-item/double-suppression')).status).toBe(204);
    expect((await client.delete('/links/by-item/double-suppression')).status).toBe(404);

    const token = await seedLink(cookie, 'deja-consomme');
    await api(app).get(`/links/redeem/${token}`);
    expect((await client.delete('/links/by-item/deja-consomme')).status).toBe(404);
  });

  it('renvoie 404 sur l\'item d\'un autre utilisateur, pas 403', async () => {
    const alice = await createSignedInUser(app);
    const bob = await createSignedInUser(app);
    await seedLink(alice.cookie, 'appartient-a-alice');

    // L'appartenance est dans la clause WHERE : Bob ne peut pas distinguer
    // « n'existe pas » de « n'est pas à moi », ce qui est voulu.
    const res = await api(app, { cookie: bob.cookie }).delete('/links/by-item/appartient-a-alice');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('exige le scope links:delete pour un PAT → 403', async () => {
    const { cookie } = await createSignedInUser(app);
    await seedLink(cookie, 'protege');
    const pat = await createPat(app, cookie, ['links:read', 'links:write']);

    const res = await api(app, { bearer: pat.token }).delete('/links/by-item/protege');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /links/status', () => {
  it('renvoie un tableau nu, dates en ISO, sans jamais exposer le link_token', async () => {
    const { cookie } = await createSignedInUser(app);
    await api(app, { cookie }).post('/links/bulk').send([{ item_id: 'suivi', secret: 's', ttl_days: 7 }]);

    const res = await api(app, { cookie }).get('/links/status');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(Object.keys(res.body[0]).sort()).toEqual([
      'created_at',
      'deleted_at',
      'expires_at',
      'item_id',
      'used_at',
    ]);
    expect(res.body[0].created_at).toMatch(ISO_UTC);
    expect(res.body[0].expires_at).toMatch(ISO_UTC);
    expect(res.body[0].used_at).toBeNull();
  });

  it('renvoie un tableau vide pour un utilisateur sans lien', async () => {
    const { cookie } = await createSignedInUser(app);
    const res = await api(app, { cookie }).get('/links/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('refuse since/until hors ISO-8601 avec heure → 400', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    // Le cas historiquement dangereux : une date invalide atteignait mysql2 et
    // provoquait un ERR_OUT_OF_RANGE. Elle doit être rejetée par zod.
    for (const query of [
      { since: 'pasunedate' },
      { since: '2024-01-01' }, // date seule refusée : heure obligatoire
      { until: 'hier' },
    ]) {
      const res = await client.get('/links/status').query(query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('accepte les formes ISO valides, avec Z comme avec un offset', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });

    for (const query of [
      { since: '2024-01-01T00:00:00Z' },
      { since: '2024-01-01T10:00:00+02:00' },
      { since: '2024-01-01T00:00:00Z', until: '2030-01-01T00:00:00Z' },
    ]) {
      const res = await client.get('/links/status').query(query);
      expect(res.status).toBe(200);
    }
  });

  it('applique since en inclusif et until en exclusif', async () => {
    const { cookie } = await createSignedInUser(app);
    const client = api(app, { cookie });
    await client.post('/links/bulk').send([{ item_id: 'borne', secret: 's' }]);

    const [row] = (await client.get('/links/status')).body;
    const createdAt = row.created_at as string;

    const inclusive = await client.get('/links/status').query({ since: createdAt });
    expect(inclusive.body).toHaveLength(1);

    // Comparaison stricte : une ligne créée exactement à `until` est exclue.
    const exclusive = await client.get('/links/status').query({ until: createdAt });
    expect(exclusive.body).toHaveLength(0);
  });

  it('exige le scope links:read pour un PAT → 403', async () => {
    const { cookie } = await createSignedInUser(app);
    const pat = await createPat(app, cookie, ['links:write']);

    const res = await api(app, { bearer: pat.token }).get('/links/status');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('cloisonne les données entre utilisateurs', async () => {
    const alice = await createSignedInUser(app);
    const bob = await createSignedInUser(app);
    await api(app, { cookie: alice.cookie })
      .post('/links/bulk')
      .send([{ item_id: 'a-alice', secret: 's' }]);

    const res = await api(app, { cookie: bob.cookie }).get('/links/status');
    expect(res.body).toEqual([]);
  });
});

import { expect, test } from '@playwright/test';

/**
 * Ce que seule la stack assemblée peut prouver : que le nginx du service
 * `client` sert bien la SPA *et* proxifie l'API, que le préfixe /api est retiré
 * avant Express, et que le serveur - qui ne publie aucun port - n'est joignable
 * que par ce chemin.
 *
 * Aucun navigateur ici : le contexte `request` de Playwright suffit, ces tests
 * durent quelques millisecondes.
 */
test.describe('point d\'entrée unique', () => {
  test('sert la SPA à la racine', async ({ request }) => {
    const res = await request.get('/');

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
    expect(await res.text()).toContain('<app-root');
  });

  test('sert index.html en repli sur les routes profondes de la SPA', async ({ request }) => {
    // Sans ce repli, un rechargement sur /dashboard donnerait un 404 nginx.
    for (const route of ['/dashboard', '/redeem/nimporte-quoi', '/account']) {
      const res = await request.get(route);
      expect(res.status(), route).toBe(200);
      expect(await res.text()).toContain('<app-root');
    }
  });

  test('proxifie /api/health vers Express', async ({ request }) => {
    const res = await request.get('/api/health');

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  test('redirige /api sans slash en 308 vers /api/', async ({ request }) => {
    // Sans cette location, `/api` retomberait sur la SPA et renverrait du HTML
    // à un appelant qui attend du JSON.
    const res = await request.get('/api', { maxRedirects: 0 });

    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe('/api/');
  });

  test('renvoie l\'enveloppe JSON 404 sur une route d\'API inconnue', async ({ request }) => {
    const res = await request.get('/api/route-inconnue');

    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  test('ne sert pas une route d\'API finissant par .js depuis le disque', async ({ request }) => {
    // C'est le rôle du `^~` devant /api/ : sans lui, la location regex des
    // assets l'emporterait et nginx chercherait un fichier.
    const res = await request.get('/api/inconnu.js');

    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('sert robots.txt depuis nginx, pas depuis l\'API', async ({ request }) => {
    const res = await request.get('/robots.txt');

    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /redeem/');
  });

  test('pose les en-têtes de la SPA par nginx, ceux de l\'API par helmet', async ({ request }) => {
    const spa = await request.get('/');
    expect(spa.headers()['content-security-policy']).toContain("connect-src 'self'");
    expect(spa.headers()['x-frame-options']).toBe('DENY');

    // Sous /api c'est helmet qui les pose, et nginx s'en abstient : les cumuler
    // produirait des doublons contradictoires. Les valeurs diffèrent donc de
    // celles de la SPA, et c'est le signe que le bon jeu s'applique.
    const api = await request.get('/api/users/me');
    expect(api.headers()['referrer-policy']).toBe('no-referrer');
    expect(api.headers()['x-frame-options']).toBe('SAMEORIGIN');
    expect(api.headers()['x-powered-by']).toBeUndefined();
  });

  test('GET /api/health échappe à helmet, comme au mode maintenance', async ({ request }) => {
    // /health est monté avant helmet dans app.ts, délibérément, pour rester
    // joignable quand tout le reste est fermé. Il ne porte donc AUCUN en-tête
    // de sécurité - c'est voulu, et figé ici pour que ça reste un choix.
    const res = await request.get('/api/health');

    expect(res.status()).toBe(200);
    expect(res.headers()['content-security-policy']).toBeUndefined();
    expect(res.headers()['referrer-policy']).toBeUndefined();
    expect(res.headers()['x-powered-by']).toBeUndefined();
  });

  test('expose les en-têtes de rate limiting au travers du proxy', async ({ request }) => {
    const res = await request.get('/api/users/me');

    // 401 attendu (pas de session) : ce qui compte est que les en-têtes du
    // limiteur traversent bien nginx.
    expect(res.status()).toBe(401);
    expect(res.headers()['ratelimit-limit']).toBeDefined();
  });
});

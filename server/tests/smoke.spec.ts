import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Le point de tout ce fichier : ce specifier. `src/` est du TypeScript ESM qui
// importe en `.js` (moduleResolution: bundler), et rien ne garantit a priori
// qu'un runner sache remonter de `app.js` vers `app.ts`. Si cet import passe,
// toute la chaîne passe - app.ts tire env.ts, database.ts, les routers, etc.
import { createApp } from '../src/app.js';

describe('smoke - résolution des modules et branchement de l\'environnement', () => {
  it('résout les specifiers .js vers les sources .ts', () => {
    expect(typeof createApp).toBe('function');
  });

  it('charge .env.test avant la validation zod de config/env.ts', async () => {
    // Cet import n'aurait pas pu aboutir si une variable requise manquait :
    // env.ts fait envSchema.parse(process.env) au chargement du module.
    const { default: config } = await import('../src/config/env.js');

    expect(config.NODE_ENV).toBe('test');
    expect(config.MYSQL_PORT).toBe(3307);
    expect(config.LOG_LEVEL).toBe('fatal');
  });

  it('GET /health répond 200 sans toucher à MySQL', async () => {
    // /health est monté avant toute autre couche, et le pool mysql2 est
    // paresseux : ce test doit passer sans qu'aucune base ne tourne.
    const res = await request(createApp()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.timestamp).toBe('string');
  });
});

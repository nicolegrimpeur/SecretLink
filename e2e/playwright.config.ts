import { defineConfig, devices } from '@playwright/test';

/**
 * Les tests tapent l'unique port publié par la stack : le nginx du service
 * `client`, qui sert la SPA et proxifie /api. Interroger l'API par cette même
 * origine n'est pas un raccourci - c'est ce qui valide le proxy et reproduit
 * exactement ce que fait le navigateur en production.
 *
 * La stack est montée séparément (`npm run e2e:up`) plutôt que par l'option
 * `webServer` : le build des images prend plus de deux minutes, on ne veut pas
 * le refaire à chaque relance de la suite.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',

  // Le serveur garde des limiteurs de débit en mémoire, indexés sur l'IP - et
  // tous les tests arrivent avec la même. En parallèle, ils se voleraient leurs
  // quotas (5 inscriptions/heure) et échoueraient en 429 de façon erratique.
  workers: 1,
  fullyParallel: false,

  // Un échec de bout-en-bout est cher à reproduire : on garde de quoi le
  // diagnostiquer sans avoir à le rejouer.
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: 'reports/junit.xml' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // La stack E2E parle en HTTP en clair (cf. NODE_ENV=test côté serveur).
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

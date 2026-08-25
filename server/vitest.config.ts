import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Chargé ici, et pas dans un setupFile : config/env.ts valide process.env à
 * l'import du module. Il faut donc que les variables soient en place avant que
 * le premier `import` d'un fichier de test ne soit résolu - ce que `test.env`
 * garantit, contrairement à un hook de setup.
 */
const testEnv = dotenv.parse(readFileSync(resolve(here, '.env.test')));

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    env: testEnv,

    /**
     * Séquentiel, et ce n'est pas de la prudence : les 4 limiteurs de
     * middleware/rateLimit.ts sont des singletons de module, partagés par
     * toutes les instances de createApp(). Des fichiers en parallèle se
     * voleraient leurs quotas - et se marcheraient dessus sur la même base.
     */
    fileParallelism: false,

    // argon2 est lent par conception : un signup coûte ~100 ms de hash.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    reporters: [
      'default',
      ['junit', { outputFile: 'reports/junit.xml' }],
    ],

    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
});

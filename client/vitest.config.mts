import { defineConfig } from 'vitest/config';

/**
 * Configuration additionnelle du runner, chargée par le builder
 * `@angular/build:unit-test` via l'option `runnerConfig`.
 *
 * Le builder fournit déjà l'essentiel (environnement jsdom, polyfills,
 * initialisation du TestBed, transformation Angular). On ne corrige ici qu'un
 * point de résolution de modules.
 */
export default defineConfig({
  test: {
    server: {
      deps: {
        /**
         * `@ionic/angular` importe `@ionic/core/components`, c'est-à-dire un
         * RÉPERTOIRE. Un bundler sait le résoudre via le champ `main` du
         * package ; le résolveur ESM natif de Node, non - il exige un chemin
         * de fichier et échoue sur « Directory import is not supported ».
         *
         * Inliner Ionic force Vite à traiter ces modules lui-même, avec sa
         * propre résolution, au lieu de déléguer à Node.
         */
        inline: [/@ionic\/angular/, /@ionic\/core/],
      },
    },
  },
});

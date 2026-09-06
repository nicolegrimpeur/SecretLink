import { defineConfig, globalIgnores } from 'eslint/config';
import angular from 'angular-eslint';

export default defineConfig([
  globalIgnores([
    'www/**',
    '.angular/**',
    'out-tsc/**',
    'coverage/**',
    'reports/**',
  ]),

  {
    files: ['**/*.ts'],
    // `extends` dans un objet de config plate vient de `defineConfig` : sans
    // lui, un simple étalement appliquerait ces règles à TOUS les fichiers,
    // les configs d'angular-eslint ne portant elles-mêmes aucun `files`.
    extends: [angular.configs.tsRecommended],

    // Extrait les templates déclarés en `template:` dans un composant, pour
    // que les règles de template ci-dessous s'y appliquent aussi.
    processor: angular.processInlineTemplates,

    rules: {
      // Reprise à l'identique des trois règles de l'ancien .eslintrc.json :
      // cette migration change le FORMAT, pas le jeu de règles.
      '@angular-eslint/component-class-suffix': [
        'error',
        { suffixes: ['Page', 'Component'] },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],

      // Désactivée volontairement, et c'est une DETTE ASSUMÉE, pas un désaccord
      // avec la règle.
      //
      // Angular 22 fait d'OnPush la stratégie par défaut ; `ng update` a donc
      // inscrit `ChangeDetectionStrategy.Eager` dans les 13 composants pour
      // préserver le comportement existant, et cette règle signale précisément
      // cet opt-out.
      //
      // Le passage à OnPush n'a rien de mécanique : plusieurs pages mutent des
      // champs simples depuis des callbacks asynchrones (`this.state`,
      // `this.secret` dans redeem.page.ts par exemple). Sous OnPush et sans
      // signal, la vue ne serait pas rafraîchie - le secret ne s'afficherait
      // plus. La conversion demande de passer ces états en `signal()`, page par
      // page, avec vérification à l'écran.
      //
      // À rouvrir comme chantier à part entière, en réactivant cette règle à la
      // fin pour garantir qu'on n'a rien oublié.
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
    },
  },

  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended],
    rules: {},
  },
]);

// Volontairement ABSENTS, pour que la migration reste iso-comportement :
//
//  - `@eslint/js` (js.configs.recommended) : l'ancienne config ne l'étendait
//    pas. L'ajouter ferait surgir un lot de nouvelles erreurs sans rapport.
//  - les règles typescript-eslint : idem, `plugin:@typescript-eslint/recommended`
//    n'était pas étendu. Le parser TypeScript, lui, vient de `tsRecommended`.
//  - `parserOptions.project` : l'ancienne config le déclarait, mais aucune des
//    règles activées n'exploite les types. Il ne servait qu'à ralentir le lint.
//    À réintroduire le jour où une règle type-aware sera activée - ESLint le
//    signalera explicitement ("rule requires parserServices").

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

      // La dette est soldée : les 13 composants sont passés en signaux et
      // l'opt-out `ChangeDetectionStrategy.Eager` posé par `ng update` a été
      // retiré partout. La règle est réactivée pour que le retour en arrière
      // soit impossible sans le voir - sous zoneless, un champ muté hors signal
      // ne rafraîchit tout simplement plus la vue, et ça échoue en silence.
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
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

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

      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    },
  },

  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended],
    rules: {},
  },
]);

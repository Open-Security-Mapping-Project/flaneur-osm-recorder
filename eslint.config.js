/**
 * ESLint flat config (ESLint 9+ format).
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Replaces the old `.eslintrc.cjs`. ESLint 8 went end-of-life and stopped
 * receiving security patches, which is untenable for a project that already
 * dropped a dependency over a supply-chain CVE.
 *
 * Two deliberate choices carried over from the old config:
 *
 * 1. `eslint-config-prettier` is NOT used, and must never be added — it was
 *    removed due to CVE-2025-54313 (supply chain compromise, CVSS 7.5). Its
 *    only job was switching off ESLint formatting rules that fight Prettier,
 *    which we get for free by not enabling any. Prettier runs separately via
 *    `npm run format`; it is not wired through ESLint at all.
 *
 *    The old config also had to switch off `no-extra-semi` and
 *    `no-mixed-spaces-and-tabs`. ESLint 9 dropped every formatting rule from
 *    the recommended set, so there is nothing left to disable and those
 *    overrides are gone.
 *
 * 2. Globals are listed explicitly instead of pulling in the `globals`
 *    package. The whole app uses fifteen browser globals, so the dependency
 *    would buy very little, and CLAUDE.md asks us to prefer a small inline
 *    definition over a new dependency. A listed set is also stricter than the
 *    full browser catalogue: a typo like `documnet` is still caught.
 *
 *    Adding a browser API? ESLint says `'Foo' is not defined` — add it below.
 *    That check is `no-undef`, which arrives via js.configs.recommended; the
 *    globals lists below are meaningless without it.
 *
 * `@eslint/js` carries the recommended ruleset, which ESLint 10 no longer
 * bundles. It is first-party (OpenJS Foundation, same repo as ESLint) and has
 * zero dependencies of its own.
 */

import js from '@eslint/js';

/** Browser globals the app actually uses. Alphabetical. */
const browserGlobals = {
  AudioContext: 'readonly',
  Blob: 'readonly',
  clearTimeout: 'readonly',
  confirm: 'readonly',
  console: 'readonly',
  document: 'readonly',
  Event: 'readonly',
  FileReader: 'readonly',
  localStorage: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  setTimeout: 'readonly',
  URL: 'readonly',
  webkitAudioContext: 'readonly',
  window: 'readonly',
};

/** Node globals used by the test harness and the build config. */
const nodeGlobals = {
  clearTimeout: 'readonly',
  console: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
};

const sharedRules = {
  // ── Code quality ────────────────────────────────────────────────────
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  'prefer-const': 'error',
  'no-var': 'error',
};

export default [
  {
    // Never lint build output or dependencies.
    ignores: ['dist/**', 'node_modules/**', '.npm/**'],
  },
  {
    files: ['src/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: { ...js.configs.recommended.rules, ...sharedRules },
  },
  {
    files: ['tests/**/*.mjs', 'tests/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    rules: { ...js.configs.recommended.rules, ...sharedRules },
  },
  {
    // Vite config runs in Node, as ESM (package.json declares "type": "module").
    files: ['vite.config.js', 'eslint.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: { ...js.configs.recommended.rules, ...sharedRules },
  },
];

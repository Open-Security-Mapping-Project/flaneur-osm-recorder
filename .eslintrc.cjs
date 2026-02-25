/**
 * ESLint config — no eslint-config-prettier dependency.
 *
 * eslint-config-prettier was removed due to CVE-2025-54313 (supply chain
 * compromise, CVSS 7.5). Its only purpose was disabling ESLint formatting
 * rules that conflict with Prettier. We achieve the same result by simply
 * not enabling any of those rules in the first place, and by turning off
 * the small set below that eslint:recommended activates.
 *
 * Prettier remains in the project for formatting; it runs independently
 * via `npm run format` and is not integrated through ESLint at all.
 */
module.exports = {
  env: {
    browser: true,
    es2022: true,
    serviceworker: true,
  },
  // Only eslint:recommended — no prettier bridge needed
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // ── Code quality ──────────────────────────────────────────────────
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "prefer-const": "error",
    "no-var": "error",

    // ── Disable the handful of eslint:recommended formatting rules
    //    that would otherwise conflict with Prettier's output.
    //    (This is the exact set eslint-config-prettier was disabling.)
    "no-extra-semi": "off",
    "no-mixed-spaces-and-tabs": "off",
  },
};
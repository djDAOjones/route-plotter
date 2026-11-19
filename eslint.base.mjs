// V31-APP-PACK: ESLint for every kind of flagged app, the common part (lab/next-v31/app/README.md); eslint.config.mjs
// exports it as is, and the React kinds' eslint.config.mjs adds the hook rules. It imports only packages every kind
// installs. The accessibility pack's fragment is imported, never copied: eslint.a11y.mjs lands at the project root from
// that pack. Each block marked signed was a proposal of this pack, signed by the owner on 2026-11-11 (V31-APP-PACK.1).
import { defineConfig } from 'eslint/config';
import js from '@eslint/js'; // signed 2026-11-11 (P-eslint-js): ESLint's own recommended rules
import tseslint from 'typescript-eslint'; // signed 2026-11-11 (P-ts-eslint): ESLint reads TypeScript only through a parser
import a11y from './eslint.a11y.mjs';

// Signed 2026-11-11 (P-escapes): the rules that close strict TypeScript's escapes — explicit any, unsafe operations on any,
// non-null assertions, ts-ignore and ts-nocheck, and unchecked (narrowing) casts; `as const` and `satisfies` stay open.
const ESCAPES = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' }],
  '@typescript-eslint/no-unsafe-type-assertion': 'error',
};

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '*.config.mjs', 'eslint.base.mjs', 'eslint.a11y.mjs'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: ESCAPES,
  },
  ...a11y,
);

// V31-APP-PACK starter, React kinds (the editor and the forms tool): the common configuration plus React's hook rules
// over TSX. Replaces eslint.config.mjs, which carries the common part alone for the "unsure" kind.
// STACK-02 (Route Plotter v4) adds two blocks, made under the owner's overnight grant G3 and standing on his delegated
// decisions of 27 Nov 2026: frozen v3 in v3/ is never linted as v4, and v4's tests keep the architecture plan's §15
// conventions — a test exercises behaviour and never reads source text (TST-11), and none relies on a real animation
// frame, the engine being tested through its pure clock (INTAKE.18).
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks'; // signed 2026-11-11 (P-react-hooks): React kinds only
import jsdoc from 'eslint-plugin-jsdoc'; // STACK-07: the owner's "Yes, add it" (27 Nov 2026), v4's src/ only
import base from './eslint.base.mjs';

const TST_11 = 'TST-11: a test exercises behaviour through imports and never reads source text';
const INTAKE_18 = 'INTAKE.18: no test relies on a real animation frame; drive the pure clock instead';

export default defineConfig(
  { ignores: ['v3/**'] },
  ...base,
  { files: ['src/**/*.tsx'], extends: [reactHooks.configs.flat['recommended-latest']] },
  // STACK-07 (the JSDoc house digest), on the owner's "Yes, add it" of 27 Nov 2026: rule 1,
  // every exported function and class carries a doc comment, and no type is written inside one, TypeScript holding the
  // types. Only these four rules: the plugin's recommended set asks @param and @returns tags the types already carry.
  // No type inside a doc comment: no-restricted-syntax refuses a braced type on any tag (@throws {Error}, @yields {T}
  // and the rest) in any doc comment; no-types refuses one on @param and @returns as well, and check-tag-names, typed,
  // refuses the tags TypeScript makes redundant (@type, @typedef and their kin) along with tag names it does not know.
  // Untyped tags and inline {@link} references are accepted.
  // Arrow functions and function expressions are asked for where a const names them or a default export is one, and
  // publicOnly keeps that to the exported ones, whether exported in place or by reference (`export { f }`,
  // `export default f`). Callbacks inside an exported object or call are not asked for: no declarator names them.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': ['error', {
        publicOnly: true,
        require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: false },
        contexts: ['ArrowFunctionExpression', 'FunctionExpression'].flatMap((kind) => [
          `VariableDeclarator > ${kind}`,
          `ExportDefaultDeclaration > ${kind}`,
        ]),
      }],
      'jsdoc/no-types': 'error',
      'jsdoc/check-tag-names': ['error', { typed: true }],
      'jsdoc/no-restricted-syntax': ['error', {
        contexts: [{
          comment: 'JsdocBlock:has(JsdocTag[rawType!=""])',
          context: 'any',
          message: 'No type inside a doc comment: TypeScript holds the types, so write the tag without the {braces}.',
        }],
      }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].map((name) => ({ name, message: TST_11 })),
        patterns: [{ group: ['*?raw', '*?raw&*'], message: TST_11 }],
      }],
      'no-restricted-globals': ['error', ...['requestAnimationFrame', 'cancelAnimationFrame'].map((name) => ({ name, message: INTAKE_18 }))],
      'no-restricted-properties': ['error', ...['requestAnimationFrame', 'cancelAnimationFrame'].flatMap((property) => ['window', 'globalThis', 'self'].map((object) => ({ object, property, message: INTAKE_18 })))],
    },
  },
);

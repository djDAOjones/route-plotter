// STACK-07: the JSDoc digest's rule 1 is proved for good, not once, as the dependency rules are by their plants
// (boundaries.test.mjs). fixtures/jsdoc/ is a small src/ tree linted with v4's own eslint.config.mjs, loaded as `npm run
// lint` loads it: an undocumented export, in place or by reference, must be refused by jsdoc/require-jsdoc, and a type
// inside a doc comment, on any tag, by jsdoc/no-restricted-syntax; a typed @param or @returns is refused by
// jsdoc/no-types as well, and an @type or @typedef tag by jsdoc/check-tag-names as well, so those plants expect two
// reports, one from each rule. The documented exports, of each kind the rule covers and with untyped tags, are
// accepted. So a rule that stops biting, or fires too widely, is noticed on every v4 change (`npm run
// test:architecture`). The rules are the owner's "Yes, add it" (27 Nov 2026).
import { strict as assert } from 'node:assert';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(ROOT, 'tests', 'architecture', 'fixtures', 'jsdoc');

// Each fixture file: the rule and line of every report it must give, and no other.
const PLANTS = {
  'undocumented.ts': [['jsdoc/require-jsdoc', 4]],
  'by-reference-arrow.ts': [['jsdoc/require-jsdoc', 3]],
  'by-reference-function.ts': [['jsdoc/require-jsdoc', 3]],
  'default-reference.ts': [['jsdoc/require-jsdoc', 3]],
  'typed.ts': [['jsdoc/no-restricted-syntax', 3], ['jsdoc/no-types', 5]],
  'type-tag.ts': [['jsdoc/check-tag-names', 3], ['jsdoc/no-restricted-syntax', 3]],
  'typedef.ts': [['jsdoc/no-restricted-syntax', 3], ['jsdoc/check-tag-names', 5]],
  'throws-type.ts': [['jsdoc/no-restricted-syntax', 4]],
  'documented.ts': [],
  'documented-default.ts': [],
};

async function lint(file) {
  // The fixture's own folder stands for the project root, so v4's `src/**` blocks reach its src/ as they reach v4's.
  const eslint = new ESLint({ cwd: FIXTURE, overrideConfigFile: join(ROOT, 'eslint.config.mjs') });
  const [result] = await eslint.lintFiles([join('src', file)]);
  return result.messages;
}

describe("the JSDoc digest's rules, each broken by a planted fault", () => {
  for (const [file, expected] of Object.entries(PLANTS)) {
    test(`${file}: ${expected.length ? `breaks ${expected.map(([rule]) => rule).join(' and ')}` : 'breaks no rule'}`, async () => {
      const messages = await lint(file);
      const found = messages.map((m) => [m.ruleId, m.line]);
      assert.deepEqual(found, expected, JSON.stringify(messages.map((m) => `${m.line}: ${m.ruleId ?? 'fatal'} ${m.message}`)));
    });
  }
});

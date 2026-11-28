// STACK-07: the JSDoc digest's rule 1 is proved for good, not once, as the dependency rules are by their plants
// (boundaries.test.mjs). fixtures/jsdoc/ is a small src/ tree linted with v4's own eslint.config.mjs, loaded as `npm run
// lint` loads it: an undocumented export must be refused by jsdoc/require-jsdoc, a type inside a doc comment by
// jsdoc/no-types, and the documented exports, of each kind the rule covers, accepted. So a rule that stops biting, or
// fires too widely, is noticed on every v4 change (`npm run test:architecture`). The rules are the owner's "Yes, add it"
// (27 Nov 2026).
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
  'typed.ts': [['jsdoc/no-types', 5]],
  'documented.ts': [],
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

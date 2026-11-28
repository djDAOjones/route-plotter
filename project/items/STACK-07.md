# STACK-07 — Item C, first part: JSDoc on v4

## Intent

The owner asked for the full PM-Skills suite, minus promptfoo, in operation on v4, and delegated the decisions. Of the JSDoc pack he said "JSdoc can be used for typescript", and to "Add eslint-plugin-jsdoc so the gate enforces documented exports?" he answered "Yes, add it" (27 Nov 2026, the lane's JOE-MESSAGE-2026-11-27-full-suite-decisions.md). This item adopts the pack's digest for exported TypeScript, installs that one package, has lint require a doc comment on every export, and documents the exports that lacked one. No code behaviour and nothing on the page changes.

## Acceptance criteria

- `project/digests/jsdoc.md` is the pack's pm_skills/jsdoc/project/digests/jsdoc.md at v5.0.3 byte for byte, apart from one dated entry under "Exceptions recorded": rules 3 to 6 met by strict TypeScript, no ratchet. The profile adopts it under Standards; the rules route it by task; Set 1 pins the plugin.
- `eslint-plugin-jsdoc` 65.5.7 is a dev dependency, pinned exactly; `npm ls eslint typescript typescript-eslint` shows 9.39.5, 6.0.3 and 8.71.2 as before.
- v4's `src/` block in `eslint.config.mjs` turns on jsdoc/require-jsdoc (exports only) and jsdoc/no-types, both errors, test files apart; `npm run lint` passes.
- `tests/architecture/jsdoc.test.mjs` lints a fixture with v4's config: an undocumented export is reported by jsdoc/require-jsdoc, a type inside a doc comment by jsdoc/no-types, and documented exports are not. It runs in `npm run check:v4`.
- Every `src/` change is a comment; no code line changes.
- `eslint.config.mjs` and `project/architecture.md` no longer say "provisional under the owner's overnight grant G3".
- `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-28

Next step: gpt-6-astra's review of the item's range; then the owner's merge, after STACK-06's pull request.

Open question: None.

## Context and sources

- project/digests/jsdoc.md
- project/digests/app-opinion.md (STACK-05)
- [STACK-06](./STACK-06.md)
- `eslint.config.mjs`

## Notes

- 2026-11-28 — Opened and built by sub-chat 155 (brief 155) on branch stack-07/jsdoc from stack-06/opinion-fixes at 8df5723, STACK-06's pull request being still open (D284, the lane's decisions list: it stands unless the owner objects). Measured before any comment was written: 45 exports to document (a first, too broad, setting counted 85, of which 40 were exports and 45 were callbacks and methods inside exported objects). Methods are not required, their class's comment covering them (rule 1 names functions, classes and modules); file overviews are not linted, the plugin checking them only by an @file tag on every file, boilerplate against rule 2; every source file but `src/main.tsx` already opened with a comment, and that one gains one.
- 2026-11-28 — The planted test, tests/architecture/jsdoc.test.mjs, lints fixtures/jsdoc/ with v4's own config: an undocumented export (refused by jsdoc/require-jsdoc), a type inside a doc comment (refused by jsdoc/no-types), and a documented export of each kind, accepted. Mutations, each put back: both rules turned off failed the two plants; the rule widened to methods and every arrow function failed the documented case.

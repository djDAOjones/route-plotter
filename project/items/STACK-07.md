# STACK-07 — Item C, first part: JSDoc on v4

## Intent

The owner asked for the full PM-Skills suite, minus promptfoo, in operation on v4, and delegated the decisions. Of the JSDoc pack he said "JSdoc can be used for typescript", and to "Add eslint-plugin-jsdoc so the gate enforces documented exports?" he answered "Yes, add it" (27 Nov 2026, the lane's JOE-MESSAGE-2026-11-27-full-suite-decisions.md). This item adopts the pack's digest for exported TypeScript, installs that one package, has lint require a doc comment on every export, and documents the exports that lacked one. No code behaviour and nothing on the page changes.

## Acceptance criteria

- `project/digests/jsdoc.md` is the pack's pm_skills/jsdoc/project/digests/jsdoc.md at v5.0.3 byte for byte, apart from one dated entry under "Exceptions recorded": rules 3 to 6 met by strict TypeScript, no ratchet. The profile adopts it under Standards; the rules route it by task; Set 1 pins the plugin.
- `eslint-plugin-jsdoc` 65.5.7 is a dev dependency, pinned exactly; `npm ls eslint typescript typescript-eslint` shows 9.39.5, 6.0.3 and 8.71.2 as before.
- v4's `src/` block in `eslint.config.mjs` turns on jsdoc/require-jsdoc (exports, in place or by reference), jsdoc/no-types, jsdoc/check-tag-names (typed) and jsdoc/no-restricted-syntax (a type the parser reads on any tag; inline links and braces after @see and @example excepted), all errors, test files apart; `npm run lint` passes.
- `tests/architecture/jsdoc.test.mjs` lints a fixture with v4's config: an undocumented export, in place or by reference, is reported by jsdoc/require-jsdoc, a type the parser reads on any tag of a doc comment by jsdoc/no-restricted-syntax (and also by jsdoc/no-types on @param and @returns, by jsdoc/check-tag-names on @type and @typedef), and documented exports, with untyped tags or inline {@link}, {@linkcode} and {@linkplain} references, are not. It runs in `npm run check:v4`.
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
- 2026-11-28 — Sub-chat 156 (brief 156) closed gpt-6-astra's three lines: jsdoc/require-jsdoc's contexts now take an arrow function or function expression under any declarator, so with publicOnly the forms exported by reference (export { f }, export default f) are asked for and callbacks inside exported objects still are not; jsdoc/check-tag-names with typed refuses @type and @typedef; the decision states the plugin's Node floor. Five plants and a by-reference legal case added; v4's src/ needed no new comment. Mutations, each put back: the old selector failed the three by-reference plants; the plugin's require options for arrows failed the legal case; check-tag-names off, or on without typed, failed both tag plants.
- 2026-11-28 — Sub-chat 158 (brief 158) closed gpt-6-astra's lines 4 to 6: jsdoc/no-restricted-syntax, selector JsdocBlock:has(JsdocTag[rawType!=""]) in any context, refuses a braced type on any tag (@throws {Error} and the rest), so the three typed plants another rule already refused (typed.ts, type-tag.ts, typedef.ts) now give two reports each, and throws-type.ts gives one; the digest's dated exception names the three rules that refuse types; the decision's Rationale reads as sentences and lists four rules. A typed-@throws plant added, and untyped tags in the legal case; v4's src/ needed no new comment. Mutations, each put back: the rule off failed the four typed plants; the selector widened to any tag failed the legal case.
- 2026-11-28 — Sub-chat 159 (brief 159) closed gpt-6-astra's lines 7 and 8: jsdoc/no-restricted-syntax's selector, now JsdocBlock:has(JsdocTag[rawType!=""][rawType!=/^@link(code|plain)?\b/]), spares inline {@link}, {@linkcode} and {@linkplain} references on a tag and still refuses every typed tag, {linkError} included; jsdoc/no-types still reads a link where an @param or @returns type goes as a type, so there a link goes in the text. The config's comment, the digest's dated exception, the decision, these criteria and the test's header now say exactly that. A legal case, documented-links.ts, added; v4's src/ needed no change. Mutation, put back: 158's selector failed the new legal case.

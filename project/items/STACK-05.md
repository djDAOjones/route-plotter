# STACK-05 — The app opinion routed into the record

## Intent

The owner asked for the full PM-Skills suite, minus promptfoo, in operation on v4, and delegated the decisions: "ideally you just decide what is best, but I want the full suite minus promptfoo". This item is its first part (item A): the pack's app-opinion digest at v5.0.3 installed in the record with its two exceptions, the profile's and rules' lines that route it, and Set 1's record made his, so that every later v4 change is read against the digest. Record-only: nothing on the page changes.

## Acceptance criteria

- `project/digests/app-opinion.md` holds the pack's digest at tag v5.0.3 (d599678) byte for byte, except its "Exceptions recorded" section, which holds two dated entries: the player's use of the features' model/ and draw/ parts (decision 5), and the slider's remount until its fix (decision 6).
- The profile carries the Gate line as drafted, `- App opinion: editor, 2026-11-19`, the app opinion's Standards entry and the Budget line at profile 625 and rules 800; the rules carry the digest's By-task row.
- `project/app/set1.json` has no top-level provisional note, keeps `"signed": "2026-11-18"` (D57), and pins `@playwright/test`, `@axe-core/playwright` and `axe-core` as `package.json` does; Vite stays 8.2.2 (wish PLAN-8.8).
- One decision entry records what was written, quoting the owner's sentence, with the lines listed for his later review.
- Wishes: PLAN-8.5 retired; PLAN-8.6 reduced to what stays unwritten.
- No file outside `project/` changes; `node tools/check.mjs` and `--commit HEAD` give 0 failures, and `node tools/read.mjs` lists the digest as a routed read.

## Now

Updated: 2026-11-27

Next step: None in this item; item B of the owner's order follows: the editor's .tsx boundary rule, the composer's plain-TypeScript owner and the key dispatcher's `isComposing` stand-down.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): REFRESH-503, PLAN-8
- [STACK-02](./STACK-02.md)
- `project/app/set1.json`
- `src/editor/kit/SettingSlider.tsx`
- `.dependency-cruiser.cjs`

## Notes

- 2026-11-27 — Opened by sub-chat 146 on the owner's order of 2026-11-27, typed to the parent chat: "put the full PM-Skills suite, minus promptfoo, into operation on v4 exactly as the decisions file sets out: CORE-06's close first, then item A, then item B, before any other v4 code; the rest in its order. The decisions in that file are made, on my delegation; do not ask me them again."
- 2026-11-27 — Built and closed by STACK-05's pull request, record-only: the digest from PM-Skills' tag v5.0.3 (d599678), read by `gh api`, equal byte for byte to the draft copy in the lane before its two exceptions were added; the lines as the lane's draft, with the budgets at 625 and 800; the digest is 779 words against its row's 650, a warning, the signed row unchanged. What stays unwritten, the Accessibility testing line and its row, is STACK-05.1.

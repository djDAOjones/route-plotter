# STACK-06 — Item B: the app opinion's three fixes

## Intent

The owner asked for the full PM-Skills suite, minus promptfoo, in operation on v4, and delegated the decisions: "ideally you just decide what is best, but I want the full suite minus promptfoo". His order, typed to the parent chat on 27 Nov 2026: "CORE-06's close first, then item A, then item B, before any other v4 code". This item is item B: the three fixes that make the editor's code keep the app opinion's editor rules (project/digests/app-opinion.md, routed by STACK-05): React "may mount the canvas host, never draws"; "one owner per DOM subtree"; "keys stand down in text entry, composition and widgets". With it, decision 5's "provisional" words come off the boundary rules. Nothing on the page changes.

## Acceptance criteria

- The key dispatch stands down while an input method composes: `KeyPress` has `isComposing`; `dispatchKey` returns false first when it is set, running nothing (no action, Escape, Editing key, nudge end, store or transport call), Open project's chord included; the page's keydown listener returns at its head for `isComposing` or `keyCode` 229, before the menu key's branch. Proved by `dispatch.test.ts`'s "composition stands down", red at 4bd5480 and failing again with the head check removed (mutation bq).
- `.dependency-cruiser.cjs` has no "provisional" word: its two G3 comments say the boundaries are kept by the owner's delegated decision of 27 Nov 2026. No rule, regex or list changed by that edit.
- The preview's drawing lives in a plain TypeScript owner of the canvas, `src/editor/shell/mountCanvas.ts`; `src/editor/shell/Preview.tsx` imports nothing of `player/` or adapters/render, and the page's DOM, names and teardown order are unchanged. Proved by `npm run check:v4`, its drawing journeys included.
- The boundary rule `editor-screens-never-draw`: no src/editor/**/*.tsx file imports player/compose, player/transport or adapters/render directly (D281: direct imports only, so the owner is allowed). Proved red on the real tree before the move, by the plant `editor-screen-reaches-the-composer`, by the `legal` tree reaching the composer through a plain host, and by mutations br and bs.
- `node tools/check.mjs` and `--commit HEAD` give 0 failures; no package changed.

## Now

Updated: 2026-11-27

Next step: gpt-6-astra's review of the item's range; then the owner's merge of #190, after which this item's pull request moves onto `main`.

Open question: None.

## Context and sources

- project/digests/app-opinion.md (STACK-05)
- STACK-05 (item A, its own pull request)
- [CORE-06](./CORE-06.md)
- `.dependency-cruiser.cjs`
- `src/editor/shell/mountCanvas.ts`

## Notes

- 2026-11-27 — Opened and built by sub-chat 148 (brief 148) on its own branch from core-06/drawing-routes at 4bd5480 (D281, the lane's decisions list: it stands unless the owner objects), with a draft pull request on that branch. Stage 1: the composition stand-down, red first; the "provisional" words off. Stage 2: the rule added first and seen red on the real tree (Preview.tsx to the composer), the drawing moved to `mountCanvas.ts`, the rule then green; its plant; `legal`'s editor edge moved through a plain `host.ts`. depcruise refused `compose(\.tsx?)?$` as an unsafe expression, so the composer's path is `compose\.tsx?$` (it is one file). Safari's keyCode 229 is read in the listener only; the lint allows it without a disable.
- 2026-11-27 — Mutations, each put back: bq (the dispatch's head check removed) failed "composition stands down"; br (the rule's from path matching nothing) failed the plant's test; bs (Preview.tsx importing the composer again) failed `npm run boundaries` on that edge. The whole `npm run check:v4` passed on stage 2 at its first run.

# DEF-82 — Dialog heading passes shortcuts through

## Intent

When a modal dialog opens, focus lands on its heading, and from there every editor shortcut reaches the editor behind it: open Help, press Delete, and the selected waypoint is deleted, though the focus trap promises the editor is inert (`src/handlers/InteractionHandler.js`, `handleKeyDown`'s guard covers controls inside `[aria-modal="true"]`, not the dialog itself).

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [DEF-13's item](./DEF-13.md) — where it was found
- [The decisions](../decisions.md) — DEF-13 and GATELESS-1 (the run's conditions)

## Notes

- 2026-10-08 — Found by DEF-13's implementing agent; present on main before DEF-13, which keeps today's behaviour for controls inside a modal dialog.
- 2026-10-11 — Closed by UI-06's Help PR in its round 4 (#122, `d6a3a31`, squashed as `2c9f5f8`, v3.2.713), on the owner's word of 2026-10-10 to fold this row in: the page's shortcuts stand down while focus is anywhere inside an open modal dialog, its title included, in both `src/handlers/InteractionHandler.js` and the network editor's key listener (`src/services/NetworkEditService.js`), which could otherwise delete a network selection from Help's title; `?` is kept, so Help still opens over the welcome. Its acceptance criteria are met: DEF-82's regression tests in `tests/keyTable.test.js` (on Help's title 20 shortcuts change nothing behind it and no other key of the domain reaches the page, Tab, Escape and `?` aside; the network pen's Delete, Backspace and T leave its selected node) failed on 0f02e80's production code and pass on `d6a3a31`, and every existing test stays green, none deleted, skipped or weakened (the gate: 133 files, 3,127 tests, 2 todo). Found by DEF-13's implementing agent; Help's title passed the same keys until round 4 (the PR's report, its sixth question; the owner's audit of 2026-10-10).

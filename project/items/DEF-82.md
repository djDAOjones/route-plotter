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

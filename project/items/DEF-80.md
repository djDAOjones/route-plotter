# DEF-80 — Player retimes constant-time projects

## Intent

The HTML player rebuilds the timing on load whatever the project's mode (`src/player/PlayerApp.js`, its load), so a constant-time project whose duration the author set, and which the editor keeps until a rebuild (`_timingDerived` false, DEF-06), plays at a different length in the player: Codex's CROWD-05 review r1 measured the base 12,000 ms in the editor and 2,640 ms in the player. Pre-existing loader behaviour. A defect against play == export, under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [CROWD-05's item](./CROWD-05.md) — where it was found
- [The decisions](../decisions.md) — CROWD-05 and GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Found by Codex's review r1 of CROWD-05 (PR #98), reproduced in memory.

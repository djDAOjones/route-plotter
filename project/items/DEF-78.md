# DEF-78 — Comet tail retimes crowds

## Intent

In Preview with a comet trail, the base timeline includes the trail's tail (`src/app/pathTiming.js`, `updateAnimationDuration`), and crowd releases are fractions of it, so a crowd releases later in Preview, and so in a video export and the HTML player, than in Edit. Pre-existing; CROWD-05 kept each mode's base as it was, so nothing authored moved. A defect against play == scrub == export across modes, under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [CROWD-05's item](./CROWD-05.md) — where it was found
- [The decisions](../decisions.md) — CROWD-05 and GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Found by CROWD-05's work (the run's implementing session), by code reading; to verify before fixing.

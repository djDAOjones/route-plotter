# DEF-79 — Player anchors crowds apart

## Intent

For a linear route, the HTML player resolves route anchors in its render space (`src/player/PlayerApp.js`), not the authored timing space, so a crowd bound to a route moment may release at a different instant in the player than in the editor. Pre-existing; noted while CROWD-05 measured the player's own scene end. A defect against play == export, under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [CROWD-05's item](./CROWD-05.md) — where it was found
- [The decisions](../decisions.md) — CROWD-05 and GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Found by CROWD-05's work (the run's implementing session), by code reading; to verify before fixing.

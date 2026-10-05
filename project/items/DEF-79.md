# DEF-79 — Render space moves crowd anchors

## Intent

For a linear route, route anchors are resolved in the space being drawn, not the authored timing space: the HTML player resolves them in its render space (`src/player/PlayerApp.js`), and a video export in export space (`src/app/exporting.js`, after it enters export mode), while waits stay fixed. So a crowd bound to a route moment may release at a different instant in the player or a video export than in the editor (Codex's CROWD-05 review r1 measured 18,640 ms against the editor's anchors and 19,073 ms in export at 1920×1080). Pre-existing; noted while CROWD-05 measured the player's own scene end. A defect against play == export, under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [CROWD-05's item](./CROWD-05.md) — where it was found
- [The decisions](../decisions.md) — CROWD-05 and GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Found by CROWD-05's work (the run's implementing session), by code reading; to verify before fixing.
- 2026-10-05 — Widened from the player to video export too, by Codex's review r1 of CROWD-05; CROWD-05 measures each scene end in the space it renders in, so neither cuts a crowd off, but their lengths can differ from the editor's.

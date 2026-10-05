# TST-16 — Tighten the round-2 predicates · Characterisation P1

## Intent

Tighten the round-2 predicates · Characterisation P1

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-16 Tighten the round-2 predicates** · Characterisation [ready]
**P1**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r1 of 81c8c2d, 2026-10-01): (1) F1, blocking: every asset in `tests/imageAssetRoundTrip.test.js` (:40-49, :112) is the same PNG, so IR-FIRST, exporting the first stored image's bytes under every ID (`src/services/ImageAssetService.js`:677), passes all 210 tests; fixed when at least two assets carry distinct valid payloads of equal length, each reloaded asset's bytes are compared with its own source, and IR-FIRST is killed. (2) F2, blocking: the event transcript in `tests/undoService.test.js`:290-308 never goes past one undo or redo, so capping undoCount or redoCount at 1 (`src/services/UndoService.js`:231-232) passes; fixed by a third save, two undos and their redos, both counts pinned. Advisory: a strict-false finishes check (CA-UNDEFINED), a moving-cone golden (C09-MOVING), DEF-72's wording (the next playback update, not frame), and the runner's old tree described as old tests over current source. Resolved on the head 81c8c2d: none; the review read this head. Reference only: an unfinished round-2 attempt in the run's agent transcripts.

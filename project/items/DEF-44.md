# DEF-44 — A paused editor never idles · Live defect P2

## Intent

A paused editor never idles · Live defect P2

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (Defects runnable now), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **DEF-44 A paused editor never idles** · Live defect [ready] **P2**
```
- 2026-10-05 — PLAN-1: the Edit-scrub one-step camera that DEF-44's review found is folded into DEF-68, which waits for this.
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r3 of 340e045, 2026-10-01): (1) B1, blocking for the exhaustive idle claim: an 8K player seeking from the zoom slider's first nonzero step (1.028×) to 1× ends with eight invisible keep-alive frames, on `main` too: the renderer stops applying a camera within 0.001 of 1× (`src/services/RenderingService.js`:581) while the centre eases on to within a pixel (`src/services/CameraService.js`:134-143, 470-485) and `src/player/PlayerApp.js`:316-323 renews. Fixed by naming this near-1× tail among the plan row's bounded residuals and narrowing the completion claim, or by settling that centre once invisible, tested with the tail and the next zoom-in. (2) Advisory A1: T1, T2 (no X or Y lower clamp on the resting centre, `src/services/CameraService.js`:118-119) and T4 (x = 0 read as absent) pass the focused tests; run the viewport-return test (tests/pausedIdle.test.js, added by this PR, :314-342) at all four edges and an exact-zero head, checking the first revealed position and that no frame follows. Resolved on the head 340e045: none; the review read this head.

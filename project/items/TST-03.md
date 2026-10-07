# TST-03 — Visibility mode matrix · Characterisation P1

## Intent

Visibility mode matrix · Characterisation P1

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-03 Visibility mode matrix** · Characterisation [ready] **P1**
```
- 2026-10-06 — Landed (TST-03's PR): `tests/visibilityPathMatrix.test.js`, `visibilityWaypointMatrix.test.js`, `visibilityRevealMasks.test.js`, helpers `tests/helpers/visibilityGoldens.js` (order checker: fresh, forwards, backwards, scrambled) and `visibilityTimeline.js` (a real `AnimationEngine`, MVS's arguments assembled as `RenderingService` does, a copy that can drift from the renderer). The dead `getPathPointOpacity` is pinned in a block labelled DEL-02, to go with the method; it fades the opposite way to its comment.

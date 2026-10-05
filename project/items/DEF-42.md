# DEF-42 — A beacon-style change keeps the old schedule · Live defect P3

## Intent

A beacon-style change keeps the old schedule · Live defect P3

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (Defects runnable now), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **DEF-42 A beacon-style change keeps the old schedule** · Live defect
[ready] **P3**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r1 of 4c9efb5, 2026-09-29; the head 8056cd7, round 2's fix, was never reviewed): (1) Claim 1A: in a constant-time project Undo restores the beacon style but the engine keeps the edited schedule, as a geometry rebuild retimes only in constant-speed (`src/app/pathTiming.js`); the head's plan row leaves it to DEF-06, so once DEF-06 and `main` are merged in, add a constant-time edit, Undo, Redo case to tests/beaconTimingEdits.test.js (added by this PR), checking model, schedules and branch legs at each step. (2) Claim 2: add the wish-list line the PR body proposes, coalescing continuous-input rebuilds to one per frame (about 31 ms of branch composition per slider input at 2,000 waypoints). Then review round 2. Resolved on the head 8056cd7: the oracle is the edited project's own save, opened fresh; two-major, Edit, constant-time, glow, branch-major and undo/redo cases kill round 1's M1, M3 and M4; the fingerprint covers every schedule and branch leg; ripple rebuilds once; fresh constant-time opening and branch beacon clocks moved to DEF-56 and DEF-57.

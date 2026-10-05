# DEF-76 — Leg-speed edit stales timing

## Intent

A leg-speed edit recomputes the duration without clearing a branched route's cached `branchTimeline`, whose cache checks only the base speed; Undo or Redo rebuilds it, so the same waypoints time differently (13,336.2163 ms against 11,984.528 ms on the Open day route in TST-05's review, round 3). Mechanism traced read-only by Codex on 2026-10-05: `src/app/pathTiming.js` (the branch composition cache), `src/app/wiringBus.js` (the leg-speed handler), `src/app/undoRedo.js` (Undo/Redo recalculates the path). DEF-42's pull request composes a branched route's timeline afresh and may already fix it: check there first. Found by the big run's review of TST-05 (PR #72, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for DEF-42 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [TST-05's item](./TST-05.md) and [PR #72](https://github.com/djDAOjones/route-plotter/pull/72) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

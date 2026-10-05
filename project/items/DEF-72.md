# DEF-72 — Timeline shortcut ignores tail

## Intent

`PlayerCore.pathToTimelineProgress`'s shortcut ignores a comet tail. Found by the big run's review of TST-16 (PR #76, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for TST-16 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [TST-16's item](./TST-16.md) and [PR #76](https://github.com/djDAOjones/route-plotter/pull/76) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.
- 2026-10-05 — Wording, from TST-16's review r1 (advisory): the head jumps on the next playback update, not the next frame (`AnimationEngine.js` 187–193).
- 2026-10-05 — Closed: both shortcuts (`timelineToPath`, `pathToTimelineProgress`) now hold only when the timeline is the path (`isPlainTimeline`); the forward one, which stretched a trunk under a longer branch, is the same defect (the run's call). With no route, `pathDuration` is zeroed (`clearRouteTiming`). Tests: `tests/playerCore.test.js` (DEF-72 block), `tests/branchExportParity.test.js` (the trunk keeps its own time).

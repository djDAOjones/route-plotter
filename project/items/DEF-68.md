# DEF-68 — Paused camera controls sleep

## Intent

In a paused Preview, the camera Zoom slider, Camera movement and Edit scrub render once without waking the loop (the Edit-scrub one-step camera, folded in from DEF-44's review). Found by the big run's review of DEF-44 (PR #71, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for DEF-44 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [DEF-44's item](./DEF-44.md) and [PR #71](https://github.com/djDAOjones/route-plotter/pull/71) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

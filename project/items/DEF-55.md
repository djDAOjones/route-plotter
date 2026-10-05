# DEF-55 — List drop sends branch last

## Intent

Any list drop moves a branch's waypoints to the end of the list. Found by the big run's review of TST-04 (PR #57, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for TST-04 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [TST-04's item](./TST-04.md) and [PR #57](https://github.com/djDAOjones/route-plotter/pull/57) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

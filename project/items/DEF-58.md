# DEF-58 — Export edits change scene

## Intent

Edits made during a video export change its framing, and an accepted trace during an export changes the exported scene (the review's R12-A1, folded in). Found by the big run's review of DEF-53 (PR #64, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for DEF-53 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [DEF-53's item](./DEF-53.md) and [PR #64](https://github.com/djDAOjones/route-plotter/pull/64) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

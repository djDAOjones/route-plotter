# DEF-74 — Redo restores no selection

## Intent

Insert and the type toggle select after saving their undo entry, so Redo restores no selection. Found by the big run's review of TST-05 (PR #72, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for TST-05 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [TST-05's item](./TST-05.md) and [PR #72](https://github.com/djDAOjones/route-plotter/pull/72) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

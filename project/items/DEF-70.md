# DEF-70 — Menu item drops focus

## Intent

A context-menu item closes the menu without returning focus. Found by the big run's review of TST-14 (PR #74, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for TST-14 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [TST-14's item](./TST-14.md) and [PR #74](https://github.com/djDAOjones/route-plotter/pull/74) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

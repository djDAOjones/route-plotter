# DEF-63 — Shortcuts take modifier chords

## Intent

Keyboard shortcuts take the browser's modifier chords; it needs a Chromium check. Found by the big run's review of TST-13 (PR #69, between 2026-09-29 and 2026-10-03) and recorded on 2026-10-05; it waits for TST-13 to land, which brings the harness its regression test needs. A defect against an existing promise, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- A regression test fails on the defect before the fix and passes after it.
- The fix keeps every existing test green, none deleted, skipped or weakened.

## Context and sources

- [TST-13's item](./TST-13.md) and [PR #69](https://github.com/djDAOjones/route-plotter/pull/69) — where it was found
- [The decisions](../decisions.md) — GATELESS-1 (the run's conditions)

## Notes

- 2026-10-05 — Recorded from the big run's handoff, which listed it with what it waits on.

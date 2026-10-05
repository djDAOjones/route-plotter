# DEF-53 — Export size follows the canvas

## Intent

A video export kept following the canvas: a size changed while an export ran (a resize, a typed width or height, a preset) changed the frames it was still writing. The fix keeps the canvas size the export began with. Opened by the big run as PR #64 and recorded here on 2026-10-05, when PLAN-1 put it in Phase 1.

## Acceptance criteria

- The pull request's tests pin the fixed behaviour; the round its last review asked for is finished; one Codex check (GATELESS-1).
- A Chromium check of the user-facing behaviour before the merge.

## Context and sources

- [PR #64](https://github.com/djDAOjones/route-plotter/pull/64) — the change, its tests and its review history
- [The decisions](../decisions.md) — PLAN-1 and GATELESS-1

## Notes

- 2026-10-05 — Its review history lived in the big run's working notes; the pull request body carries what matters.

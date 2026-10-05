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
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r11 of c1e467f, 2026-10-01): (1) F1, blocking test gap: each size choice and the encoder's release run with no task turn between them (tests/exportSizeDuringExport.test.js, added by this PR, :292-298, :419-438, :512-516), so AC1, the guard at `src/app/viewport.js`:24 resizing on the next animation frame instead, passes all 38 tests and the 140-test selection while the running export's later frames turn 1080×1920. Fixed when a case keeps the encoder held while queued animation-frame and timer callbacks run after the choice, asserts geometry then for both export kinds and all three endings, and AC1 and AC9 (alpha zeroed on a timer) are killed; then the test-role and plan text name those turns. No production change indicated. (2) Advisory A1: a mask painted wholly outside its canvas passes; the review offers optional wording. From the run's handoff: rerun the renderer cases on the merged head, W2 and X1 re-anchored to DEF-27's rect.x and rect.w. Resolved on the head c1e467f: none; the review read this head.

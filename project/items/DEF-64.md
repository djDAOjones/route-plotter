# DEF-64 — Branch legs miss hover and click

## Intent

A branched route's legs could not be hovered or clicked along their own runs: hits followed the waypoint array, not the trunk's and each branch's run. The fix hits each leg along its own run, names the leg (the waypoint it leaves, the next on its run, the run) and offers the "+" on trunk legs only. Opened by the big run as PR #77 and recorded here on 2026-10-05, when PLAN-1 put it in Phase 1.

## Acceptance criteria

- The pull request's tests pin the fixed behaviour; the round its last review asked for is finished; one Codex check (GATELESS-1).
- A Chromium check of the user-facing behaviour before the merge.

## Context and sources

- [PR #77](https://github.com/djDAOjones/route-plotter/pull/77) — the change, its tests and its review history
- [The decisions](../decisions.md) — PLAN-1 and GATELESS-1

## Notes

- 2026-10-05 — Its review history lived in the big run's working notes; the pull request body carries what matters.
- 2026-10-05 — PLAN-1: Chromium check before the merge: hover, click and the "+" on the Open day route's trunk and branch legs. TST-05 and DEF-64 both touch the wiring controllers' event-transcript golden (TST-05 adds it); whichever merges second moves its two lines.

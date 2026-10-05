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
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r1 of 9d3563e, 2026-10-01): (1) F1, blocking: P10 is not equivalent: after a site-walk waypoint move, a late failed load of Open day (pruneImageAssets throwing once) leaves a five-entry trunk beside four restored waypoints, and without the pairing guard (`src/app/pointer.js`:272) a query 75% along names the last waypoint as owner. Commit that regression (owner null), count P10 killed, and drop the equivalence from the PR body's table and the plan row. (2) F2, blocking: N1-N4 and N6 (only the first branch kept; terminal or nested branches dropped; ownership by ID) pass the 69 committed tests; add multiple, terminal, nested and branch-first topologies and the identical-ID rollback to tests/branchLegHit.test.js (added by this PR). (3) Narrow claim 2 to plain canvas clicks; the menu and bus insert paths still split branches (DEF-22). (4) The DEF-05 note's line is `src/services/RenderingService.js`:1351, not 1258, and needs b1 recoloured. Resolved on the head 9d3563e: none; DEF-51 and DEF-73 now have items on main. Reference only: an unfinished round-2 attempt in the run's agent transcripts.

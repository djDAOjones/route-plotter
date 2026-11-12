# Next steps

Written 2026-11-12 during a repository tidy. The live record is the
ledger in [`project/`](project/); this page is a short summary of it.

## Current state

- `main` is level with GitHub at PR #164 (pm-next v3.1 refresh,
  2026-11-12). Version 3.3.0. CI ("Verify") and the Pages deploy pass.
- Recent work has been framework upkeep (V31-UPGRADE, V31-REFRESH,
  V31-REFRESH-3). The last product item was UI-08 "Show image"
  (2026-10-19).
- Work lands through a branch and a pull request, never straight on
  `main`; `npm run push` releases when the owner calls it.

## Known problems

- Live P2 defects: DEF-15 (L resumes at the old J/K/L speed), DEF-19
  (camera-zoom edits skip undo), DEF-22 (an inserted waypoint splits a
  branch run).
- `npm audit` reports 5 issues in development tools (3 high, 2 moderate).
  Dependency changes need a decision.
- The checkout lives on OneDrive. Keep `core.fileMode=false`, or every file
  shows as changed after a sync.
- Two local-only branches, `crowd07/cards-a` and `ui06/help-dialog`, hold
  earlier drafts of the squash-merged PRs #123 and #122.

## Next three tasks

1. **DEF-15, DEF-19, DEF-22**: fix the three Phase 2 live defects.
2. **UI-06 and CROWD-07**: finish the in-progress Phase 3 design reviews,
   then **UI-07** (the layout and order of cards, sidebars and header).
3. **TST-11, REV-03, REV-05**: owner evidence and decisions (retire the
   source-text assertions; Android Chrome; NVDA/VoiceOver and
   forced-colours checks).

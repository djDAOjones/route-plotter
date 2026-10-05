# TST-14 — Shell and ContextMenu safety tests · Characterisation P1

## Intent

Shell and ContextMenu safety tests · Characterisation P1

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-14 Shell and ContextMenu safety tests** · Characterisation
[ready] **P1**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r2 of 31a1b16, 2026-10-01): five blocking gaps, each fixed when its mutants fail. (1) F1: the lsof stand-in keeps only the text after the last colon (`tests/restartSafety.test.sh`:493-500, 513, 521-522), so S34 and S35 (UDP or a bogus protocol, `scripts/restart.sh`:210) pass; model address forms or refuse unmodelled ones. (2) F2: the identity stubs (:105-109) answer alike for any PID, so S36 and S37 (asking about $$, `scripts/restart.sh`:112-115) pass; index them by PID. (3) F3: no child takes time to stop (:301-339), so S38 (the grace loop's sleep removed, `scripts/restart.sh`:232) passes; add one exiting 0.8 s after TERM, asserting no KILL. (4) F4: canvas and viewport coordinates coincide (tests/contextMenu.test.js, added by this PR, :517-521), so C30 (no offset subtraction, `src/handlers/InteractionHandler.js`:1097-1099) passes; offset the canvas. (5) F5: Delete acting on the primary selection, not the right-clicked waypoint (C31, `src/app/wiringControllers.js`:700), passes; right-click a non-primary selected waypoint. Advisory: C32, C33, E05's label; the plan row and file-map drop "answer as real tools would". Resolved on the head 31a1b16: none.

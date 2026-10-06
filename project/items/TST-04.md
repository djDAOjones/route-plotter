# TST-04 — Sidebar control and readout goldens · Characterisation P1

## Intent

Control→bus for every control, and model→control state per selection path. First, because nothing guards the readouts (§14.5), so W4 waits on it. **P1**

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-04 Sidebar control and readout goldens** · Characterisation
[ready] — Control→bus for every control, and model→control state per
selection path. First, because nothing guards the readouts (§14.5), so W4
waits on it. **P1**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r8 of 79585f8, 2026-10-01): (1) B1, blocking: the suite imports `src/main.js` before recordWiring, recordHandlers and watchInlineHandlers (tests/goldenControls.test.js, added by this PR, :2431-2435), so a module that binds addEventListener while it loads (EARLY-ADD, in `src/app/crowds.js`) adds a live double-click listener on the Busy field that the inventory never sees, and all 56 tests pass. Fixed when instrumentation is installed before any application module, static imports included, can capture registration APIs or handler accessors; an early-binding regression proves unrun-listener detection and invocation credit; and the family, isolated mode (CONTROL_GOLDENS_ISOLATED=1) and the gate pass. (2) Advisory A1: H-UNDO-WAYPOINTS (waypoints dropped from the history comparison, :2217) passes; add a negative test where Undo keeps a waypoint's value. Then the backlog, file-map and plan row claims of every control listener name the repaired boundary. Resolved on the head 79585f8: none; the review read this head. Reference only: an unfinished round-9 attempt in the run's agent transcripts.
- 2026-10-05 — Round 9 finished (chat 11): B1 by installing the instrumentation before any application module (EARLY-ADD survived before, fails now, normal and isolated); A1's negative Undo test kills H-UNDO-WAYPOINTS; after the main merge, UI-03's numbered hint ids keyed by position, the inventory noted once the app's observers settle, and isolated mode replaces an app whose booked frame was dropped; every moved golden line traced to a main commit. Landed as PR #57.

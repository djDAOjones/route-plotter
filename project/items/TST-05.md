# TST-05 — Event transcript golden · Characterisation P1

## Intent

Gates DEF-15, DEF-22 and W6. **P1**

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-05 Event transcript golden** · Characterisation [ready] — Gates
DEF-15, DEF-22 and W6. **P1**
```
- 2026-10-05 — PLAN-1: TST-05 and DEF-64 both touch the wiring controllers' event-transcript golden (TST-05 adds it); whichever merges second moves its two lines.
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r3 of 9651108, 2026-10-01): two mutants pass all 142 tests. (1) B1: lookupState reads waypointsById itself (tests/eventTranscript.test.js, added by this PR, :724-730), never the app's getWaypointById, so U7, the getter refusing new `wp_` IDs (`src/main.js`:739), passes while the scene outline throws for an inserted waypoint; fixed when each observation checks `getWaypointById(id) === waypoint` for every route waypoint, a newly generated ID included, and after the performed Undo and Redo if lookup integrity covers them. (2) B2: summarise() turns objects at depth two into {…} (:660), so U6, scene-outline:update emitting x: 0 (`src/app/sceneOutline.js`:261), passes; fixed by a field-sensitive form or digest of structured payloads, by asserting the payload against the model, or by narrowing the claim. Advisory: U2 (call the returned imageToScreen once), U3 (keep the hover index), U5 (four-decimal rounding); memory rows follow B1 and B2. Resolved on the head 9651108: none; DEF-74 now has an item on main. Reference only: an unfinished round-4 attempt in the run's agent transcripts.
- 2026-10-05 — Round finished (chat 11): B1 and B2 closed in the tests only; U7 and U6 survived before and fail now; advisories U2, U3, U5 killed; goldens regenerated after the main merge with every moved line traced to a landed item; the "paused half way" rows seek half the route's base timeline. Landed as PR #72.

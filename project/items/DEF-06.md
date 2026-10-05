# DEF-06 — Clear All leaves stale route state · Live defect P3

## Intent

Visible since DEF-08 (#37, unreleased): a route cut to one waypoint draws its last marker, paused, at a stale grow scale. Land it before the release. **P3**

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (Defects runnable now), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **DEF-06 Clear All leaves stale route state** · Live defect [ready] —
Visible since DEF-08 (#37, unreleased): a route cut to one waypoint draws
its last marker, paused, at a stale grow scale. Land it before the
release. **P3**
```
- 2026-10-05 — v3.2.693 shipped before this landed (REL-693), on the owner's order to release `main` as it stands before anything else (GATELESS-1 condition 8). The session reads the "Land it before the release" above as written for the 2026-09-28 plan's single release, which GATELESS-1 replaced (its call, for the owner to confirm), so the DEF-08 symptom is live until this lands and releases.
- 2026-10-05 — PLAN-1: lands first in Phase 1; v3.2.693 ships the symptom this fixes (REL-693). DEF-42 (PR #62) waits for it.
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r16 of 519a8cb, 2026-10-01): (1) R16-A, blocking coverage gap: the accepted-rejoin tests (tests/staleRouteState.test.js, added by this PR, :1211-1237) never play at another rate, so M87, the rejoin's own retime (`src/app/wiringControllers.js`:440-447) given px/s × playback rate, passes the whole gate (1,662 tests) yet at 650 px/s and 0.5× saves and reopens 4,388 ms, not 2,944. Fixed when a rejoin made and one cleared, in Preview and Edit, at 2× and 0.5× (−2× too), check total and trunk travel live, in recovery, in Save Project reopened and in the HTML export's embedded project, and M87 fails them; no production change indicated. The run's old bar also asked for mutation-table reruns on the files DEF-43's merge changed; GATELESS-1 replaced that bar, so they are not part of this round. Resolved on the head 519a8cb: none; the review read this head.

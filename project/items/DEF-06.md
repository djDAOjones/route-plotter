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

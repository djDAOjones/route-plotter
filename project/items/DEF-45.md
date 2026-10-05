# DEF-45 — Announcements overwrite each other · Accessibility P3

## Intent

Announcements overwrite each other · Accessibility P3

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (Defects runnable now), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **DEF-45 Announcements overwrite each other** · Accessibility [ready]
**P3**
```
- 2026-10-05 — PLAN-1: round 3 was left uncommitted at the 2026-10-01 reboot: a bounded queue that withdraws a replaced project's recovery notices and merges identical must-hear messages; DEF-43's test waits for the load's announcements; a `wiringBus` comment. Redo it from the review, not from the old partial diff. PR #70 conflicts with `main`.

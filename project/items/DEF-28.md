# DEF-28 — A failed recovery restore is silent · Live defect P2

## Intent

Option A (Joe, 2026-09-28): announce it, and a notice offers Download it and Discard; the record moves to a second key autosave never writes. Clear All discards it too; if storage is full it stays, and the autosave failure report points to the notice. **P2**

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (Defects runnable now), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **DEF-28 A failed recovery restore is silent** · Live defect [ready]
— Option A (Joe, 2026-09-28): announce it, and a notice offers Download it
and Discard; the record moves to a second key autosave never writes. Clear
All discards it too; if storage is full it stays, and the autosave failure
report points to the notice. **P2**
```
- 2026-10-05 — PLAN-1: once DEF-45 is in, mark this item's recovery announcements as RECOVERY_NOTICE-style (essential, about the project); a Chromium check is owed before the merge. PR #54 conflicts with `main`.

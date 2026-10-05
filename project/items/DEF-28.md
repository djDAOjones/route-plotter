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
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r11 of b01e97c, 2026-10-01), lines in src/app/unrestoredAutosave.js (added by this PR): (1) F1: a successful search listing a kept key it cannot read (:132-136) still consumes the disappearance evidence (:211-218), so a failed Discard of a copy this tab never read silences the failed restore, records it discarded, then offers it as earlier; keep that evidence until every listed key's text is known, testing P1's two variants (the disappearance seen by a successful search; and first seen by key during a failed search, then reconciled after healing), a readable-copy control and provenance after healing. (2) F2: Discard forgets every key known for the text (:428-430) though `src/services/StorageService.js`:366-375 skipped an unreadable copy, then announces completion (:439); keep that copy, report incomplete removal. (3) F3: a successful search retires missing keys but not unreadAtStart (:141-143), so Clear All reports a phantom discard (:382; `src/app/projectReset.js`:90-91); retire them too, auditing :374-376. (4) Close three test gaps, each a broken fix the four suites pass: removing only `started.unreadAtStart.delete(key)` (:160) must fail a case where tab A sees key K empty by key during a failed search, then Clear All reports zero completed discards, not one; removing only `started.seen.set(key, text)` (:170) must fail a case that boots with K unreadable and heals its read while search fails, where a second refresh still offers and downloads the text the first learned; `.findLast(each => each.earlier)` for `.find(…)` (:334) must fail a case with two earlier records, search failing and only the newest unreadable, where the notice describes the newest cached offer, not the older parked one. (5) Correct README and the plan row. Resolved on the head b01e97c: none. Reference only: the old partial round 12 in the run's backups.

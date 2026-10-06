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
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r2 of 029b1f9, 2026-10-01): (1) F1, blocking: the queue is not bounded. Essential and assertive entries escape the cap (src/utils/announcementQueue.js, added by this PR, :79, :91-93) and each committed project re-arms its omission warning (`src/app/persistence.js`:955-959), so twelve Site walk Examples clicks leave six warnings queued and stale feedback runs 20 s on. Fixed by bounded coalescing or backpressure for recovery notices, tested under sustained input, never evicting essential messages, or by withdrawing the boundedness claim and recording that trade-off. (2) F2, blocking: Y1 (`kept ||=` made `=`) and Y3 (a protected entry merged with any matching waiting text; it passes the whole gate) survive; add protection tests in both duplicate orders, protected-other-protected, and repeated real loads. Advisory: Y2 (trimmed text), Y5 (Clear All's warning made polite); wording: each message actually shown; protected messages merge too (UI-STANDARDS.md). Rerun the merged-file cases (M18, X8-X14; the PR body adds M19) on the merged head. Resolved on the head 029b1f9: none. Reference only: the old partial round 3 in the run's backups.
- 2026-10-05 — Round finished (chat 11): F1 by bounded coalescing (a must-hear text already waiting is not queued again; the bound is stated in `announcementQueue.js`), tested under sustained input; F2's Y1 and Y3 killed, advisories Y2 and Y5 killed; merged-file cases M18, M19, X8–X14 all killed on the merged head. Landed as PR #70.

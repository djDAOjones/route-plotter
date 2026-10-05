# TST-13 — Key table, element IDs, HTML ranges · Characterisation P1

## Intent

Gates DEL-05, DEF-13, DEF-15 and DEF-32. **P1**

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-13 Key table, element IDs, HTML ranges** · Characterisation
[ready] — Gates DEL-05, DEF-13, DEF-15 and DEF-32. **P1**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r4 of dfb1650, 2026-10-01): three mutants pass all 124 focused tests; keep each probe (P1, P3, P5) as a regression. (1) F1: the source reader follows a helper's declaration, not a later reassignment (tests/helpers/sourceScan.js, added by this PR, :491-503, :787-793), so P1, a header helper reassigned to read `altKey`, leaves the inventory unchanged; analyse such writes or report the binding unread. (2) F2: names match only as spelled (:249, :294-295, :873-876), so a listener registered through escaped literals (`addEvent\u004cistener`, `key\u0064own`) vanishes; decode escapes or report them unread, with fixtures for escaped method names, event types, event identifiers and getElementById. (3) F3: tests/rangeConstants.test.js (added by this PR) :70-72 coerces attributes with Number(), so `max="0x1e00"` on the export width passes; check HTML number syntax or pin the raw strings, with a malformed-attribute regression. Then correct the plan row and file-map's reader and markup guarantees. Advisory A1: call the key domain the listed named keys, F1–F24 and Soft1–Soft4. Resolved on the head dfb1650: none; the review read this head.

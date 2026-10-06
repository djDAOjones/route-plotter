# DEF-14 — A hint click stops a label toggling · Accessibility P1

## Intent

A hint click stops a label toggling · Accessibility P1

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (Defects after their W5 test (§13 ground rule 8)), flags [gated: TST-04 impl]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **DEF-14 A hint click stops a label toggling** · Accessibility
[gated: TST-04 impl] **P1**
```
- 2026-10-06 — Closed with UI-04 (chat 11): the label-click remedy and the readout wiring (28 ranges, about 55 readout writes through setRangeReadout) are both met; tests/paramTooltip.test.js and tests/rangeReadouts.test.js pin them.

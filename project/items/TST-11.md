# TST-11 — Behavioural tests for source-text assertions

## Intent

Behavioural tests for source-text assertions

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [gated: SPL-06 impl]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-11 Behavioural tests for source-text assertions** ·
Characterisation [gated: SPL-06 impl] **P1**
```
- 2026-10-06 — Round 1 (TST-11's first PR): behavioural tests added beside the source-text assertions (`tests/reviewAccessibilityBehaviour.test.js`, `tests/perfHarnessBehaviour.test.js`, `tests/buildScriptMain.test.js`); the PR body maps each assertion to its tests. Left, on the owner's word: retire the source-text assertions at `reviewAccessibility.test.js` 388–394 and 662–690, `releaseSafety.test.js` 56–89 and `perfHarness.test.js` 101–122; the two that pin only a comment (`reviewAccessibility.test.js:666`, `perfHarness.test.js:116`) go or stay with them. `releaseSafety.test.js`'s order of restore before cleanup (73–82) is pinned by its source read alone: the new tests see only the final state, so retiring that read needs a behavioural test of the order (an interrupted cleanup) first. The source checks at `reviewAccessibility.test.js` 366, 378–387, 395–396 and 400 lie outside the row. The shipped shell has no `#bg-fit-toggle` (`main.js:260` looks it up), so the Fit/Fill test adds one before boot.

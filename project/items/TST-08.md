# TST-08 — Mixin composition guards · Characterisation P1

## Intent

Mixin composition guards · Characterisation P1

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **TST-08 Mixin composition guards** · Characterisation [ready] **P1**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r2 of 8558e26, 2026-10-01): 13 mutants pass all 30 guards in `tests/mixins.test.js`; keep each probe as a fixture. (1) F1: a text prefilter (:1301) skips the AST walk unless the source holds `import(` exactly, so `import /* gap */ (` hides a dynamic import (Q17). (2) F2: a local export alias loses the mixin's identity (:1272-1288, :1323; Q07). (3) F3: helper admission trusts declaration and parameter names, so writes through `arguments[0]`, a reassigned helper, or another object passed as app go unseen (:1120-1131, :1538-1554, :1580-1603, :1694-1702; Q02, Q03, Q09). (4) F4: any method named bind counts as making a function (:1381-1384; Q01). (5) F5: inherited reflective calls such as `__defineGetter__` and `valueOf()` change the app or a mixin unmodelled (:1324, :1621-1628, :1667-1670; Q05, Q06, Q14, Q15). (6) F6: reassigning `Object.assign` passes (:1221-1225; Q04). (7) F7: `window.app` inside `src/main.js` is unchecked (:1594; Q16, Q19); follow it or state that exclusion. Then align the memory rows. Resolved on the head 8558e26: none; it already parsed with parseAst when reviewed.
- 2026-10-05 — Round finished (chat 11): F1–F7 closed in the tests only; all 13 probes (Q01–Q07, Q09, Q14–Q17, Q19) passed before and are refused now, each pinned as an in-memory fixture; each of the 10 sub-fixes reverted alone is caught by its own test; F7 settled by refusing `window.app` in the files read for the app. Landed as PR #73.
- 2026-10-05 — Codex r3 of fd5ac39 found an indirect helper chain from a non-app object, a method's own `.bind` overridden, `window.window`/`window.self` aliases in `main.js`, and a false positive on a stored callback's bound copy; all fixed in the tests (42 tests), each with sibling variants, and each of the 17 sub-fixes reverted alone fails only its own test.

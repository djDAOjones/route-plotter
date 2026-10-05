# SPL-06 — `build.js` entry guard and exported functions · Refactor P2

## Intent

Pulled forward from W9: TST-11 needs it, and `build.js` exports nothing today. **P2**

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — each plan row is its item's detail (the big run, decisions 2026-09-28)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Next" (W5 — deepen the characterisation (TST-04 first)), flags [ready]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [ ] **SPL-06 `build.js` entry guard and exported functions** · Refactor
[ready] — Pulled forward from W9: TST-11 needs it, and `build.js` exports
nothing today. **P2**
```
- 2026-10-05 — PLAN-1, the round to finish (from Codex's review r2 of befcac8, 2026-10-01): (1) R2-F1, blocking: the import watcher copies function properties unwrapped (tests/helpers/buildScriptHost.mjs, added by this PR, :60-74), so Y1, `fs.realpathSync.native` read at import, passes all 77 focused tests, as does Y3, `process.umask(0o077)`, which processState (:120-126) omits. Fixed when callable fs properties are wrapped, the umask is checked, and Y1 and Y3 are negative harness checks. (2) R2-F2, blocking: export calls record arguments and API activity but not process state (serve, :184-204; the purity assertion in tests/buildScript.test.js, added by this PR, :677-696), so Y4, resolveBuildMode setting an environment variable, passes 77/77. Fixed when each export call compares process state before and after, the pure exports require no change, and Y4 is a probe. (3) With those fixes, the memory calls the watcher an observation of the named APIs and state, not of every effect; advisory: `pm_skills/project/trajectory.md` says importing runs nothing without the old-Node path-resolution exception. Resolved on the head befcac8: none; the review read this head.

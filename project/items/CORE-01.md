# CORE-01 — The project model and the schema helper

## Intent

v4's project is one scene holding routes whose points and lines may fork, join, run both ways, start in several places and loop (the plan's §3). This item writes that model in `src/core`, with the schema helper from which every saved field takes its type, default, check and range (§13). It is pure: no DOM, no clock.

## Acceptance criteria

- The scene, routes, points (stops and bends), lines (one way or both), start and end marks and `leadStart` are typed and checked by the schema; ids are injected, never from `Date.now` or `Math.random`.
- The schema helper declares each field once (kind, default, minimum, maximum, unit, one-line description) and gives its type, defaults, check at open and the range every control uses; a check failure is a structured report naming the field.
- The core modules' settings (line, lead, markers, labels, pauses; background, clock, export) are declared with it, with v3's limits carried.
- fast-check properties: every model the schema allows is valid, and defaults are valid.
- INTAKE.29 and DEF-20.2 pass: a value that opens is always one its control can show.
- It changes only these paths: src/core/model/**, src/core/schema/** and src/core/config/**.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once Phase 7 opens by its PLAN entry.

Open question: None; the round-1 answer on route shape (Q2) only adds a validation rule if he picks "forks only".

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §4, §13, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "One route, travellers as features (Recommended)" (Q11); "Core with storytelling basics" (Q9); "v3 files stay with v3" (Q14). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1, A2a, A12 (the plan's §18; the night's decisions list).

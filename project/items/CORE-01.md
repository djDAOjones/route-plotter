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
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: None; CORE-02 (geometry, the lead's timing and the clock) and CORE-03 (save and open) build on this item's model, declarations and `checkScene`.

Open question: Owner: do this item's provisional choices stand (CORE-01's decision entry and D103 on in the night's list): the lead's speed in image widths a second, colours as `#rrggbb` only, 10,000 points in a scene, ranges narrowed to their controls, v3's model defaults, and the purity guard as a test?

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §4, §13, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "One route, travellers as features (Recommended)" (Q11); "Core with storytelling basics" (Q9); "v3 files stay with v3" (Q14). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1, A2a, A12 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 1, Q2 (route shape, A1; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "recommendation good". Read by PLAN-6 of 2026-11-19, a reading his to correct, as ruling A1 as recommended, so no rule refusing several starts, two-way lines and loops is added. A2a and A12 stay provisional under G3.
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.
- 2026-11-19 — Built by sub-chat 13 and finished by sub-chat 15 under the owner's overnight grants; no further instruction of his for it is recorded beyond those quoted above, "Proceed on recommendations (Recommended)" (G3) and, typed by him on 2026-11-18, "accrue decisions that come up but dont stop dev unless impossible". Codex rejected three rounds (five, seven and two findings), each answered; the shape and the rules across it are now declared with the schema helper, and the open check is the declaration's own (CORE-01's decision entry).

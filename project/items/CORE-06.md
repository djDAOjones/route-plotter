# CORE-06 — Drawing routes on the canvas

## Intent

An author draws routes on the canvas (the plan's §3). This item ports v3's pointer transaction and builds the pen and the route graph's editing commands.

## Acceptance criteria

- Canvas authoring runs through the ported pointer transaction (one primary pointer, a 3 px tap-or-drag threshold, capture, one commit or a restoring cancel).
- The pen adds stops and bends, draws lines, forks, joins, two-way lines and loops, sets `leadStart` and marks starts and ends; a point can be inserted into a line, deleted, dragged with its group, duplicated, nudged by arrow keys and reached by a context menu.
- The drawing half of "what the interface can author, a project can open" (the plan's §15, rule 6), driven through these commands at their limits with v3's boundary cases.
- A point inserted on a fork's run joins that run (DEF-22, v3's pin at `v3/tests/branchAuthoring.test.js` :469 inverted); a drag that moves nothing records no undo (DEF-87).
- It changes only these paths: src/editor/canvas/** and src/core/model/commands/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once CORE-05 has merged; it may run beside CORE-12.

Open question: None; the round-1 answer on route shape (Q2) only adds a validation rule if he picks "forks only".

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Core with storytelling basics" (Q9); "One route, travellers as features (Recommended)" (Q11). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1 (the plan's §18; the night's decisions list).

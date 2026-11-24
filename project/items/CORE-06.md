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
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-05 has merged; it may run beside CORE-12.

Open question: None; his answer on route shape (round 1, Q2), "recommendation good", keeps a route able to be a network (A1), as PLAN-6 of 2026-11-19 reads it.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Core with storytelling basics" (Q9); "One route, travellers as features (Recommended)" (Q11). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 1, Q2 (route shape, A1; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "recommendation good". Read by PLAN-6 of 2026-11-19, a reading his to correct, as ruling A1 as recommended: drawing gains two-way lines, loops and several starts, with no rule refusing them.
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.
- 2026-11-24 — D208, ruled by PLAN-9: the owner's label "Line with a halo (b) (Recommended)" (a label he selected, written by the asking chat; the questions and options are in `reviews/v4-owner-answers-review-2026-11-24.md`). At this item's start, the hovered stretch is redrawn as its own line with a halo, so its colour shows again, as in v3. Wish CORE-04.13 is settled by this and not retired until it is built.
- 2026-11-24 — D209, ruled by PLAN-9: the owner's label "Remove and enlarge (b) (Recommended)" (a label he selected, written by the asking chat). At this item's start, the "being built" paragraph above the preview goes, its accessibility checks move to the page's real controls, and the preview takes the height left between the header and the play bar. Where the sentence "Its progress is on GitHub" goes, if anywhere, was not asked.

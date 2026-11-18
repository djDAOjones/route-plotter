# CORE-07 — The scene outline

## Intent

Keyboard-only authoring is how v4 meets AAA for people who cannot use the canvas. This item builds the accessible outline of the scene, its routes, stops and features, through which every core action can be done.

## Acceptance criteria

- The outline lists the scene, its routes, each route's stops and, later, each added feature; its keys port v3's stable encoding.
- Every core action (add a route, add and move a stop, set a label, marker or pause, play, save, export) can be done from the outline by keyboard alone, tested in Playwright.
- It is mounted in the shell's outline slot.
- It changes only these paths: src/editor/outline/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once CORE-06 and CORE-12 have merged; it may run beside CORE-08.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §9, §15, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Standard now, extended before v4.0 (Recommended)" (Q22). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A32 (the plan's §18; the night's decisions list).

# PRESET-01 — The five presets

## Intent

The owner named v4's presets: "Map route; document reveal; signal flow; annotated diagram; match-day crowd" (Q19), and confirmed that "A preset starts one route" (P6). This item offers them, with Blank, when an author makes a route.

## Acceptance criteria

- New route offers Blank (the core alone) and the five, each with the features and settings of the plan's §12, checked against the composed schema.
- A test makes a route from each and checks its features.
- It changes only these paths: src/editor/presets/**.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once Phase 9 opens by its PLAN entry.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §12, §19

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: his five names quoted in the Intent (Q19); "A preset starts one route" (P6); the meanings he ticked in Q24. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A10 (the plan's §18; the night's decisions list).

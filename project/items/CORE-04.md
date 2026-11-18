# CORE-04 — The renderer and the core's drawing

## Intent

One composer draws every frame for the editor's preview, the video export and the exported player (the plan's §8). This item builds it with the canvas kit and the core modules' drawing, splitting v3's renderer by layer and keeping editor overlays out of every export.

## Acceptance criteria

- src/adapters/render draws the layers of P4 with reference scaling; src/player/compose.ts runs §8's four stages (routes, scene, the view, drawing).
- The core modules' `model/` and `draw/` parts (line with its appearances, lead head and head presets, markers, labels, pauses; the background) are modules of §8's shape, listed in src/features/catalogue.ts.
- Editor overlays are a separate list drawn only by the editor, in screen space.
- The draw recorder is ported with a clip region (INTAKE.30); the first goldens are compared with v3's frames of the same scene and every difference named.
- The clock and export settings are core scene modules of the same shape, with the background.
- A module whose evaluation fails returns a structured report; the composer draws nothing for it in that frame and passes the report on, never a throw.
- It changes only these paths: src/adapters/render/**, src/player/compose.ts, the model and draw parts of the core modules (line, lead, markers, labels, pauses, background, clock, export) under src/features/, and src/features/catalogue.ts.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once CORE-02 has merged.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §6, §8, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: Q1's port sentence (quoted in CORE-02) and "Adopt the editor stack whole (Recommended)" (Q21). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A5, A6, A25 (the plan's §18; the night's decisions list).

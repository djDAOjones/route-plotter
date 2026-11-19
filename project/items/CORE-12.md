# CORE-12 — The core panels and the points list

## Intent

A new route shows only the core (the plan's §9): the points list and the Line, Lead, Marker, Label and Pause sections, with the scene's Background, Timing and Export sections. This item builds those panels and lists in the shell's slots.

## Acceptance criteria

- The points list selects and reorders by drag and keyboard; the scene's route list reorders by drag and keyboard and sets the drawing order (INTAKE.2's reorder).
- The route panel's Line and Lead sections, the stop panel's Marker, Label and Pause sections and the scene panel's Background, Timing and Export sections are the core modules' `editor/` parts, listed in src/features/catalogue.editor.ts.
- The panels' half of "what the interface can author, a project can open", each control at its limits (the plan's §15, rule 6).
- A new route shows about fourteen controls (M5); the panel shows what is selected however it was selected (DEF-88).
- It changes only these paths: src/editor/panels/**, src/editor/lists/**, the editor parts of the core modules under src/features/, and src/features/catalogue.editor.ts.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request; UI-06's open findings are read as inputs to the panels.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-05 has merged; it may run beside CORE-06.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §9, §12, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list
- `reviews/ui-06-gui-review-2026-10-08.md`: UI-06's findings

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Core with storytelling basics" (Q9); "The lead is in the core" (Q24); "An Add feature list (Recommended)" (Q17). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A8 (the plan's §18; the night's decisions list).
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.

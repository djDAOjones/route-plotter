# CORE-10 — HTML export and the exported player

## Intent

v4's HTML export carries its own player, free of React and Carbon (Q21). This item builds that player from the shared runtime and the composer, and proves editor, video and player agree.

## Acceptance criteria

- src/exported/player.ts builds as one script with no React or Carbon inside; the page shell keeps v3's content security policy and embedding rules.
- The player's accessibility is ported, its words matched to the glossary (UI-06.7); the export panel gains the HTML option.
- A parity test shows the same frame in editor, video and player at the same instants (DEF-79, DEF-80); the player's on-screen sizing is tested (INTAKE.15).
- It changes only these paths: src/exported/**, the runtime under src/player/ (not compose.ts's contract), src/adapters/html/**, src/editor/export/** and the second entry's settings in vite.config.mjs.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-08 has merged; it may run beside CORE-09.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §14, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Adopt the editor stack whole (Recommended)" (Q21). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A20 (the plan's §18; the night's decisions list).
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.

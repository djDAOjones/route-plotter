# CORE-08 — Video export: the core works end to end

## Intent

The owner chose "The core works end to end (Recommended)" as what makes v4 releasable (Q13): an author can draw a route, play it, save and reopen it, and export it. This item ports v3's video export and so completes that build.

## Acceptance criteria

- MP4 and WebM through WebCodecs and mediabunny, the frame plan, aspect presets, what to include and path-only, rendered through `compose.ts` with no editor overlay.
- Nothing done in the editor during an export changes it (DEF-58); no selection box is drawn into it (DEF-99.1); the first export after open matches every later one (REL-725.2).
- A scripted run draws a route, plays it, saves and reopens it and exports it, as the build PUB-01 may publish on the owner's call.
- The export panel fills the shell's export slot.
- It changes only these paths: src/adapters/video/** and src/editor/export/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-06 and CORE-12 have merged; it may run beside CORE-07.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "The core works end to end (Recommended)" (Q13); "once it's releasable" (Q7). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A21 (the plan's §18; the night's decisions list).
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.

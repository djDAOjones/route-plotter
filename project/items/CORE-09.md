# CORE-09 — Autosave and recovery in v4's own storage

## Intent

v3's browser autosaves stay untouched (Q8). This item gives v4 autosave and recovery of its own, under names that cannot collide with v2's or v3's on the shared github.io origin (the plan's §11).

## Acceptance criteria

- v4 autosaves to IndexedDB under names that do not begin `routePlotter_`, with its own image store and lock names; it never reads, changes or deletes v3's keys and never calls `localStorage.clear()`.
- A Web Lock keeps two tabs from writing over each other (DEF-28.1); a session that cannot be restored is kept and offered.
- Every saved setting autosaves and marks the project changed (DEF-66); recovery holds only fields the schema names (INTAKE.13).
- It changes only these paths: src/adapters/storage/** and src/editor/recovery/**.
- A test seeds v3's storage names (its routePlotter_ keys, its image database and lock names) before v4 runs, and finds every one byte for byte unchanged afterwards.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-03 and CORE-05 have merged; built late in Phase 7, where the plan placed it while its storage was the least settled.

Open question: None; his answer on v4's browser storage (round 1, Q3), "open to reccomendation but no backwards compatibility needed", keeps v4's own storage (A15), as PLAN-6 of 2026-11-19 reads it.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §11, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Leave them alone" (Q8). He left the reading "v4 has its own storage" unticked (P6), so it is round 1's third question. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A15 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 1, Q3 (v4's browser storage, A15; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "open to reccomendation but no backwards compatibility needed". Read by PLAN-6 of 2026-11-19, a reading his to correct: the recommended option stands, and v4 need not read, import or migrate v3's browser autosaves; this item's check that no v3 key is read, written or deleted stands. It is not read as changing A13 (older v4 files keep opening), which he was not asked about.
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.

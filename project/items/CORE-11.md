# CORE-11 — Help, diagnostics and the privacy notice

## Intent

The brief's decided foundations keep "previewable redacted diagnostics" for best-effort support. This item ports v3's allowlisted diagnostics and its privacy wording into v4, and writes v4's help in the glossary's words.

## Acceptance criteria

- Diagnostics are allowlisted and redacted, previewable before sharing, and carry no project content.
- The privacy notice keeps v3's disclosure wording; help uses the glossary's words only (M6).
- It changes only these paths: src/editor/help/** and src/adapters/diagnostics/**.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-05 has merged; it may run beside FEAT-02, FEAT-03 and FEAT-04.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §15, §19
- [The brief](../brief.md): Decided foundations

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: none is recorded beyond the brief's decided foundation quoted in the Intent. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A33 (the plan's §18; the night's decisions list).
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.

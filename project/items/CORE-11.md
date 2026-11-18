# CORE-11 — Help, diagnostics and the privacy notice

## Intent

The brief's decided foundations keep "previewable redacted diagnostics" for best-effort support. This item ports v3's allowlisted diagnostics and its privacy wording into v4, and writes v4's help in the glossary's words.

## Acceptance criteria

- Diagnostics are allowlisted and redacted, previewable before sharing, and carry no project content.
- The privacy notice keeps v3's disclosure wording; help uses the glossary's words only (M6).
- It changes only these paths: src/editor/help/** and src/adapters/diagnostics/**.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once CORE-05 has merged; it may run beside FEAT-02, FEAT-03 and FEAT-04.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §15, §19
- [The brief](../brief.md): Decided foundations

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: none is recorded beyond the brief's decided foundation quoted in the Intent. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A33 (the plan's §18; the night's decisions list).

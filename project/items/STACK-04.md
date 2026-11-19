# STACK-04 — The architecture record, the enforced edges and the measures

## Intent

The owner asked for "layers and module edges enforced in the gate, not just written down; and §16's test applied to every new abstraction. Show me measures I can check, for example that adding a feature touches only its own module." (Q1). This item writes v4's architecture record from the plan, enforces the plan's layer and feature rules in the gate, and prints the measures.

## Acceptance criteria

- v3's `project/architecture.md` moves to v3/ARCHITECTURE.md before the pack's architecture record takes its path, by PLAN-6's decision (the pack asks for "its own decision"); v4's record is written in the pack's format from the plan.
- dependency-cruiser enforces the pack's kept rules, the replaced player and exported rules, and the rules for src/features/ (the plan's §8); each rule is proved by a planted violation that fails the gate.
- `npm run measures` prints M1 to M11 (the plan's §10), with v3's baselines counted once, and CI shows the table in its summary for every v4 run.
- v4's lines for the rules file's Always section are drafted for the owner's signature; the signed text stays as it is.
- It changes only these paths: project/architecture.md, v3/ARCHITECTURE.md, .dependency-cruiser.cjs, scripts/measures.mjs, tests/architecture/**, package.json (scripts) and .github/workflows/ci.yml.
- A closure test on the built player bundle proves it holds no React, React DOM, Carbon, jszip or mediabunny and reaches no editor part, as the plan's §8 rule 6 says.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: None: shipped by pull request; Phase 6 is closed and CORE-01 is next.

Open question: Owner: will you sign v4's drafted Always lines, which need a raise of the rules file's 600-word budget first (the wish list's first STACK-04 line)?

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §8, §10, §17, §19
- `v3/ARCHITECTURE.md`: v3's architecture file, moved there by this item; `project/architecture.md`: v4's architecture record
- `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`: §11, §16, §18

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: the Q1 sentences quoted in the Intent. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A7, A9, A34 (the plan's §18; the night's decisions list).
- 2026-11-19 — Built by sub-chat 11 under the owner's overnight grants; no further instruction of his for it is recorded beyond the Q1 sentences in the Intent and G3, "Proceed on recommendations (Recommended)". v3's file moved first, alone; v4's record, the rules with 27 planted violations and a legal tree, the player's closure test and `npm run measures` followed; the rules file's Always lines are drafted, not written (STACK-04's decision entry).

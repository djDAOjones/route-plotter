# FEAT-05 — The crowd's extras, as v3 has them

## Intent

v3's football crowd and mob parts (CROWD-08's B to G) come across into the crowd module: start and finish areas centred on their points, waiting crowds, groups and the final whistle, added from a short list inside the crowd's own section.

## Acceptance criteria

- The extras are ported into src/features/crowd/ with their tests under the plan's §15 rules, time coming from authored inputs only.
- Areas are centred on their points, as in v3; placing them freely is FEAT-07.
- If the item runs long, it splits between the areas and the rest.
- It changes only these paths: src/features/crowd/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once FEAT-04 has merged; it may run beside FEAT-06.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §9, §12, §15, §19
- [CROWD-08](./CROWD-08.md): the MVP's parts

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: none for these parts beyond the merge: "I want the next major version to be a merge" (PLAN-4). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A31 (the plan's §18; the night's decisions list).

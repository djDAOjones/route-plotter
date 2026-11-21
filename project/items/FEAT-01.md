# FEAT-01 — The Add feature list, with Arrival effects and Line glow

## Intent

The owner chose "An Add feature list (Recommended)" (Q17) and, for removing, "hide it during the session for undo, but dont save it" (Q18). This item builds adding and removing features, with the first two added features as its proof.

## Acceptance criteria

- One Add feature button per route and on the scene opens a searchable list grouped by purpose; an added section takes its catalogue's fixed place, is announced and receives focus; adding is one undo step.
- Removing hides the feature for the session (Undo or adding it back restores it) and a saved project holds nothing for it; a dependant found through `refersTo` is named and the app asks first.
- The outline gains an entry per added feature.
- Arrival effects (v3's beacons, per stop) and Line glow (casing and glow) are modules of §8's shape, each one folder and one line in each catalogue (M1).
- Line glow meets the owner's requirement of 2026-11-20 (D161), in his words, typed: "plain is fine, but the glow effect needs to provide a setting that has clean lines like in "casing" used it map graphics. perhaps rename glow to casing but allow a parameter to soften into a glow i.e roll-off or gradient or fade"
- It changes only these paths: src/editor/features/**, src/features/arrival-effects/**, src/features/line-glow/** and one line each in the two catalogues.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-21

Next step: Start once Phase 8 opens by its PLAN entry.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §7, §8, §9, §16, §19

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "An Add feature list (Recommended)" (Q17); "hide it during the session for undo, but dont save it" (Q18); "Removing asks first" (P6). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A4, A8 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 2, Q5 (where features live, A3 and A4; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "q5) as recommended". Read by PLAN-6 of 2026-11-19, a reading his to correct, as ruling A4 as recommended. A8 stays provisional under G3.
- 2026-11-21 — PLAN-8 records the owner's answer to D161 (`reviews/v4-owner-answers-bulk-2026-11-20.md`): the plain line stands, and the criterion above quotes his requirement whole; how it is met is this item's to settle. His "perhaps rename glow to casing" is a suggestion, not a ruling: the name is this item's to weigh and put to him.

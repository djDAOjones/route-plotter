# FEAT-07 — Crowd areas placed freely

## Intent

The owner said of crowd areas "as per your reccomendation, but the full feature in v4" (2026-10-14). This item builds what his answer to the plan's round 2, Q7, says "full" means, last in Phase 8 because it is the least settled.

## Acceptance criteria

- Provisionally (A23): a start or finish area can be dragged off its point or set by an offset, a point on its edge allowed, rectangle or ellipse; if he picks drawn shapes too, they are added here.
- Seeded starts and ranked places stay inside an off-point area; a project with one opens and saves unchanged.
- It changes only these paths: src/features/crowd/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once FEAT-05 has merged.

Open question: None; his answer to round 2, Q7, "q7) as recommended", is read by PLAN-6 of 2026-11-19 as: the full area feature is areas placed freely, rectangle or ellipse (A23).

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §12, §16, §19, §22
- [CROWD-08](./CROWD-08.md): the MVP's areas

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: of crowd areas, "as per your reccomendation, but the full feature in v4" (2026-10-14). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A23 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 2, Q7 (what "the full feature in v4" means, A23; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "q7) as recommended". Read by PLAN-6 of 2026-11-19, a reading his to correct, as ruling A23 as recommended: areas placed freely, rectangle or ellipse, with no drawn shapes at v4.0, so this item's criterion marked "Provisionally (A23)" now reads as ruled.

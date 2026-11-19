# FEAT-06 — The camera

## Intent

The owner said "crowd paths should be able to act as the camera" (2026-10-13). This item adds the camera as a scene feature that follows a route's lead or crowd, as a pure function of time.

## Acceptance criteria

- The camera follows a lead's main head, with zoom stops on that route's stops, or a crowd's centre at one zoom (the plan's §5).
- Its smoothing is the average of the target over a window of scene time, so play, scrub and export agree and a still view queues no frame (DEF-07, DEF-44.1, TST-09.1).
- A camera edit is one undo step and settles while paused; an unreachable zoom is said on screen (DEF-19, DEF-68, DEF-69).
- Removing what it follows names the camera first (`refersTo`).
- One folder and one line in each catalogue (M1).
- It changes only these paths: src/features/camera/** and its catalogue lines. Shared files (package.json, the lockfile, ci.yml, the two catalogues) have one writer at a time: running beside another item, it adds its catalogue lines only as it merges, after bringing main in, with CI green and Codex's approval on that exact head.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once FEAT-04 has merged; it may run beside FEAT-05.

Open question: None; his answer to round 2, Q5, "q5) as recommended", keeps the feature homes (A3, A4), as PLAN-6 of 2026-11-19 reads it.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §5, §8, §15, §16, §19

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "crowd paths should be able to act as the camera" (PLAN-4); "do what makes intuitive sense from a user point of view for a given case" (Q10). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A3, A4 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 2, Q5 (where features live, A3 and A4; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "q5) as recommended". Read by PLAN-6 of 2026-11-19, a reading his to correct, as ruling A3 and A4 as recommended: the camera is the scene's, following a route's lead or its crowd.

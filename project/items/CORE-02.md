# CORE-02 — Geometry, the lead's timing and the clock

## Intent

Every frame stays a pure function of (timelineMs, projectState, seed). This item ports v3's geometry and timing (the plan's §15) into `src/core`, generalised to the route graph: the lead's deterministic walk (§3), exact times (§4), the scene's length, and Hold at start and at end.

## Acceptance criteria

- The ports of §15's timing and geometry tables, with their tests under §15's rules; the pins of DEF-05, DEF-10, DEF-11 and DEF-12 inverted to assert the fix.
- The lead's walk passes §3's three worked examples (a fork that rejoins, a loop, two starts) as tests.
- `sceneLength` follows §4, a repeating crowd's allowance included; distances in image widths, never canvas pixels; one pause clock.
- Where the scene's length comes from its content (§4; an author may still fix a length, which trims), the scene ends when all its animation has ended, and animation that cycles, in the owner's words, "will need a grace period or control for how long to last" (his answer to the plan's round 1, Q1, 2026-11-18): which of the two, or both, is this item's to settle and to name in its pull request.
- A path's samples have a budget for a whole route (INTAKE.12), and its shape never depends on edit history (DEF-10, CROWD-08.4).
- A route of 2,000 points samples within its budget.
- It changes only these paths: src/core/geometry/**, src/core/timing/** and src/core/clock/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-01 has merged; it may run beside CORE-03.

Open question: None for the owner; how animation that cycles is bounded (the criterion added on 2026-11-19, from his answer to round 1, Q1) is this item's to settle.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §4, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Through the core only (Recommended)" (Q12), which keeps everything a pure function of time; and Q1's "Port v3's engine (drawing, timing, crowds, export, file safety) into it with its tests rather than rewriting it; the architecture plan decides piece by piece where a port isn't worth it." Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1, A2b, A22 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 1, Q1 (scene length, A2b; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "scene ends when all animation has concluded (although some animation could be cyclical so will need a grace period or control for how long to last)". Read by PLAN-6 of 2026-11-19, a reading his to correct: the recommended option stands, and he adds a requirement, now this item's criterion on animation that cycles. The plan's set allowance for a crowd that goes on for ever (§4) is the nearest thing it has; whether that becomes a grace period, a control the author sets, or both, is settled here and named in the pull request, not left as a hidden rule. His round 1, Q2 answer, "recommendation good", is read as ruling A1 as recommended; A22 stays provisional under G3.

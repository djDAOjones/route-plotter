# CORE-02 — Geometry, the lead's timing and the clock

## Intent

Every frame stays a pure function of (timelineMs, projectState, seed). This item ports v3's geometry and timing (the plan's §15) into `src/core`, generalised to the route graph: the lead's deterministic walk (§3), exact times (§4), the scene's length, and Hold at start and at end.

## Acceptance criteria

- The ports of §15's timing and geometry tables, with their tests under §15's rules; the pins of DEF-05, DEF-10, DEF-11 and DEF-12 inverted to assert the fix.
- The lead's walk passes §3's three worked examples (a fork that rejoins, a loop, two starts) as tests.
- `sceneLength` follows §4, a repeating crowd's allowance included; distances in image widths, never canvas pixels; one pause clock.
- A path's samples have a budget for a whole route (INTAKE.12), and its shape never depends on edit history (DEF-10, CROWD-08.4).
- A route of 2,000 points samples within its budget.
- It changes only these paths: src/core/geometry/**, src/core/timing/** and src/core/clock/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once CORE-01 has merged; it may run beside CORE-03.

Open question: None; the round-1 answer on the scene's length (Q1) changes only a default here.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §4, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Through the core only (Recommended)" (Q12), which keeps everything a pure function of time; and Q1's "Port v3's engine (drawing, timing, crowds, export, file safety) into it with its tests rather than rewriting it; the architecture plan decides piece by piece where a port isn't worth it." Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1, A2b, A22 (the plan's §18; the night's decisions list).

# FEAT-04 — The crowd

## Intent

The owner asked for routes and crowds to become "one thing with options" because "having routes and crowds separately does confuse things a little from a user point of view" (2026-10-13). This item ports v3's crowd engine onto the route graph as a traveller feature.

## Acceptance criteria

- The ported engine (the plan's §15) on the route's own lines: release, pace, journey end, shares at starts and weights on lines, seeded; a two-way line's way back is not counted as a choice (DEF-77.3).
- The crowd's traveller gives its centre at a time, for the camera.
- Its section, per-line and per-start controls follow v3's range table and hints and CROWD-07's open findings.
- A repeating dot's laps follow round 2's answer on DEF-95 (provisionally identical).
- A large crowd's first walk does not block editing (CROWD-05.2).
- One folder and one line in each catalogue (M1).
- The DEF-12 and DEF-79 pins of v3's tests are inverted; a 5,000-dot crowd's first walk does not block editing.
- It changes only these paths: src/features/crowd/** and its catalogue lines. Shared files (package.json, the lockfile, ci.yml, the two catalogues) have one writer at a time: running beside another item, it adds its catalogue lines only as it merges, after bringing main in, with CI green and Codex's approval on that exact head.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once FEAT-01 has merged; it may run beside FEAT-02, FEAT-03 and CORE-11.

Open question: Owner: whether a repeating crowd repeats exactly (round 2, Q8); provisionally yes (A24).

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §3, §4, §15, §16, §19
- `reviews/crowd-07-crowd-review-2026-10-08.md`: CROWD-07's findings

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "I want the next major version to be a merge" (PLAN-4); "One route, travellers as features (Recommended)" (Q11). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A1, A24, A30, A31 (the plan's §18; the night's decisions list).

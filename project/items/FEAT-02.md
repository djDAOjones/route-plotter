# FEAT-02 — Highlighted areas

## Intent

The annotated diagram preset needs areas that appear in sequence at stops (Q24's meaning). This item adds highlighted areas as a route feature with per-stop settings.

## Acceptance criteria

- Per stop: a circle, a rectangle or a drawn shape, with its line style and appearance over time; the drawing and editing tools rewritten as the feature's editor part.
- One folder and one line in each catalogue (M1).
- Its controls' half of "what the interface can author, a project can open" (the plan's §15, rule 6).
- It changes only these paths: src/features/highlighted-areas/** and its catalogue lines. Shared files (package.json, the lockfile, ci.yml, the two catalogues) have one writer at a time: running beside another item, it adds its catalogue lines only as it merges, after bringing main in, with CI green and Codex's approval on that exact head.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once FEAT-01 has merged; it may run beside FEAT-03, FEAT-04 and CORE-11.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §7, §15, §19

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "do what makes intuitive sense from a user point of view for a given case" (Q10); the meaning of "annotated diagram" he ticked in Q24. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A4 (the plan's §18; the night's decisions list).
- 2026-11-19 — The owner answered the plan's round 2, Q5 (where features live, A3 and A4; `reviews/v4-plan-question-round-answers-2026-11-19.md`), verbatim: "q5) as recommended". Read by PLAN-6 of 2026-11-19, a reading his to correct, as ruling A4 as recommended: highlighted areas belong to a route's stops.

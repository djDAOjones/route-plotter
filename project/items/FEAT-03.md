# FEAT-03 — Reveal background

## Intent

The document reveal preset uncovers "an image of a document ... step by step as a route passes over it" (Q24's meaning). This item adds the background reveal as a route feature drawing into the background mask layer.

## Acceptance criteria

- Spotlight and angle of view and their reveal forms, following the route's lead and the camera's view; two routes' reveals uncover the union of their shapes.
- The spotlight's intro shows (TST-03.3); no throw at any progress (TST-03.4).
- One folder and one line in each catalogue (M1).
- It changes only these paths: src/features/reveal-background/** and its catalogue lines. Shared files (package.json, the lockfile, ci.yml, the two catalogues) have one writer at a time: running beside another item, it adds its catalogue lines only as it merges, after bringing main in, with CI green and Codex's approval on that exact head.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once FEAT-01 has merged; it may run beside FEAT-02, FEAT-04 and CORE-11.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §7, §8, §15, §16, §19

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "do what makes intuitive sense from a user point of view for a given case" (Q10); the meaning of "document reveal" he ticked in Q24. Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A4 (the plan's §18; the night's decisions list).

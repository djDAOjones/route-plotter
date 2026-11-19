# STACK-02 — v4's skeleton on the editor stack

## Intent

The owner adopted the PM-Skills editor stack whole for v4 (Q21) and asked for v4 to be built at the repository's root (Q5). With v3 moved aside by STACK-01, this item installs the stack and the packs' files at the root, gives v4 its own gate inside GATE-01's sorting, and leaves an empty shell that builds. It builds no feature.

## Acceptance criteria

- The PM-Skills 5.0.1 app pack (editor kind) and the accessibility pack's lint are installed at the root by their own routes, the accessibility pack's ESLint file first, as the app pack's ESLint config requires.
- React 19, React DOM, Carbon React, strict TypeScript, Vite, Vitest, ESLint, knip, dependency-cruiser, fast-check, Sass, IBM Plex, jszip and mediabunny are installed at exact versions, and the list is shown to the owner (G4); Set 1 is recorded in project/app/set1.json as the pack says for the first app, provisional.
- Vite builds two outputs: the editor, and the exported player (src/exported/player.ts) as one self-contained script with no React or Carbon inside, proved by a check.
- v4's gate (typecheck, lint, boundaries, dead code, tests with `--maxWorkers=3`, build) runs in CI in GATE-01's place for a v4 change, inside 10 minutes, its time reported; v4's settings exclude v3/**, and knip does not sweep the record's own `tools/`.
- An empty Carbon shell builds and opens; v4's third-party notices list the new packages.
- The test conventions of the plan's §15 hold: no test reads source text (TST-11), and no test relies on a real animation frame after its file ends (INTAKE.18).
- The profile's App opinion and Accessibility testing lines are drafted for the owner's signature and the signed file is left unchanged.
- The pilot row is dated as the pack says for the first app, provisionally (A35).
- It changes only these paths: package.json, package-lock.json, index.html, tsconfig*.json, vite.config.mjs, eslint*.mjs, knip.json, .dependency-cruiser.cjs, src/**, tests/**, project/app/set1.json, THIRD_PARTY_NOTICES.md and .github/workflows/ci.yml.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: None in this item; PUB-01 publishes v4's build from `dist/`, STACK-03 installs the accessibility pack's run, first deciding where its routed document and tools go, and STACK-04 writes the edges' full rule set.

Open question: Owner: sign or change Set 1's pins (`project/app/set1.json`) and the drafted App opinion, Accessibility testing, Standards, By-task and Gate lines; and whether to take Vite 8.3.8 for its development-server advisories (the wishes this item filed).

## Context and sources

- [The decisions](../decisions.md): PLAN-5, PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §8, §14, §15, §19
- [STACK-01](./STACK-01.md)
- [GATE-01](./GATE-01.md)

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Adopt the editor stack whole (Recommended)" (Q21), whose option text reads "exact versions are pinned by the item that installs them and shown to you then"; "This repo, v4 at the root (Recommended)" (Q5); "Gate by what changed (Recommended)" (Q23); and, overnight, G4: "Yes, read and install (Recommended)". Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A5, A20, A26, A35 (the plan's §18; the night's decisions list).
- 2026-11-19 — Built and closed by STACK-02's pull request. The owner's instructions in force, verbatim, unchanged since the note above: "Adopt the editor stack whole (Recommended)" (Q21), whose option text reads "exact versions are pinned by the item that installs them and shown to you then"; "This repo, v4 at the root (Recommended)" (Q5); "Gate by what changed (Recommended)" (Q23); overnight, "Yes, read and install (Recommended)" (G4) and "Proceed on recommendations (Recommended)" (G3), and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". So every pin, Set 1 and the pilot row (A35) are provisional, the pinned list shown to him in the night's lane, and the signed lines the install would add are drafted for his signature, unchanged in the record until he signs. Beyond the item's paths: `scripts/gate.mjs` and its test, for v4's list, as the brief allowed; `.gitignore` needed no change. Departures from the pack, recorded in STACK-02's decision: the root `tsconfig.json` names projects only (v3's esbuild read it), Vitest's settings in `vite.config.mjs`, the starters emptied to a blank page and an inert core scaffold (Codex's first round), knip's sweep narrowed, and the accessibility pack's install helper not run.

# STACK-01 — Move v3 aside into v3/, frozen and still building

## Intent

The owner chose "This repo, v4 at the root (Recommended)" (Q5), whose option text reads "v3's source moves into a v3/ folder as the porting reference and stays recoverable at tag v3.3.726", and froze v3 at 3.3.726 (Q2). This item moves v3's app set into `v3/` so v4 can take the root, as the architecture plan's §14 rules (L1): v3's build and release scripts are not edited, the committed `docs/` (the live 3.3.726 site) and `version.json` are untouched, and v3 still builds and passes its suite from `v3/`. It installs nothing for v4.

## Acceptance criteria

- v3's app set moves into `v3/` by `git mv` (`src/`, `tests/`, `styles/`, `images/`, `index.html`, `build.js`, `push.js`, `vitest.config.js`, v3's own scripts, `public-assets.json`, `package.json`, `package-lock.json`); GATE-01's scripts/gate.mjs and its test stay at the root; v3 gets copies of `version.json`, `LICENSE` and `THIRD_PARTY_NOTICES.md`, and the root files stay as they are.
- `build.js` and `push.js` are not edited; v3 builds into v3/docs/, which git ignores; the only v3 files changed are paths: v3/package.json's `check` script, v3/tests/governance.test.js (paths to `.github/`, assertions unchanged) and v3/tests/helpers/bootApp.js (it builds the example archives it serves instead of reading the root `docs/examples/`).
- v3's whole suite passes in CI from `v3/`; GATE-01's sorting treats v3/** as v3 code.
- The build compared, read only: in two throwaway folders outside the repository (a copy of `v3/` after the move, and a checkout of the tag `v3.3.726`), v3's own build is run so that it stamps version 3.3.726 and keeps its output in that folder's own `docs/`, the throwaway folder absorbing whatever the build writes. The outputs are compared file by file after two normalisations only: the `// Built:` timestamp line of `app.js` (`build.js` :860) is masked, and the random staging folder names recorded in `meta.json` (`build.js` :756) are replaced by one fixed name; each output is compared the same way with the committed root `docs/`; any other difference fails the item.
- `git diff` shows the root `docs/`, `version.json` and the tag `v3.3.726` untouched; `git log --follow` holds across the move.
- The record's paths that name v3 files are re-pointed where the checker reads them; signed lines that name v3 paths are left for STACK-04's redraft.
- It changes only these paths: v3/** (by git mv, plus the copies of version.json, LICENSE and THIRD_PARTY_NOTICES.md), scripts/gate.mjs and its test (v3's paths now under v3/), .gitignore, .github/workflows/ci.yml, DEV-INFRASTRUCTURE.md, project/structure.md and project/items/*.md (source paths only).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: None in this item; STACK-02 puts v4's skeleton at the root, fills v4's list in `scripts/gate.mjs` and gives the root its own package.

Open question: Owner: sign the redrafted lines the move made untrue (the profile's Runtime, Gate and Hosting lines; the rules' two Always lines naming v3's files), and rule on `DEV-INFRASTRUCTURE.md`'s budget, now 3,344 of 3,300 words.

## Context and sources

- [The decisions](../decisions.md): PLAN-5, PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §14, §19
- `reviews/v4-vision-question-rounds-2026-11-18.md`: Q1, Q2, Q5, Q21 and Q22
- `reviews/v4-programme-2026-11-18.md`: findings F6 and F11
- [GATE-01](./GATE-01.md)

## Notes

- 2026-11-18 — Filed by PLAN-5. The owner's instructions in force, verbatim: the Q1 sentence quoted in the Intent; "This repo, v4 at the root (Recommended)" (Q5); "Adopt the editor stack whole (Recommended)" (Q21), whose option text reads "exact versions are pinned by the item that installs them and shown to you then"; "Standard now, extended before v4.0 (Recommended)" (Q22). Unconfirmed readings carried from the question rounds: the pack says that if v4 is the first app under its app flag, Set 1 is pinned at that intake and a pilot row is dated before the first session; and adopting the architecture record means first moving today's `project/architecture.md`. The rules file's Always section stands at 457 words against its guideline of 400; most of it is v3's invariants, which move with v3's source here.
- 2026-11-18 — Narrowed by PLAN-6 to moving v3 aside, from the architecture plan's §19 (A29): installing the packs and the gate went to STACK-02, the accessibility run to STACK-03, and the architecture record, the edges and the measures to STACK-04. The owner's instructions in force, verbatim: "This repo, v4 at the root (Recommended)" (Q5) and "Freeze v3 now (Recommended)" (Q2); and, overnight, his grant G3, "Proceed on recommendations (Recommended)" (the plan's Appendix A), under which this item builds on the plan's provisional decision A14. Its criteria as PLAN-5 filed them, word for word: v3's source moves aside as the architecture plan rules, stays recoverable at tag v3.3.726, and still builds and passes its suite when v3 code changes. / The PM-Skills 5.0.1 packs are installed by their own route: the app opinion "editor", accessibility testing at level AAA and depth standard, and the architecture record. The profile's App opinion and Accessibility testing lines are written as the pack's intake says, for the owner's signature. / Every package's exact version is pinned and shown to the owner before the merge. / v4's gate runs types, lint, boundaries, dead code, tests in parallel, build and the accessibility checks inside 10 minutes, a finding if exceeded, wired into GATE-01's sorting. / Layers and module edges are enforced in the gate as the architecture plan sets them, with the plan's measure that adding a feature touches only its own module. / Today's `project/architecture.md`, v3's and without the pack's mark, is moved aside as v3's reference before the architecture record takes its path. This is the session's proposal, for the owner to confirm. / Every signed line the install makes untrue is redrafted for the owner's signature. / The result is an app that builds, passes its gate and shows an empty shell.
- 2026-11-18 — Built and closed by STACK-01's pull request. The owner's instructions in force, verbatim, unchanged since the notes above: "This repo, v4 at the root (Recommended)" (Q5) and "Freeze v3 now (Recommended)" (Q2); overnight, "Proceed on recommendations (Recommended)" (G3) and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". So the move is provisional on the plan's A14, and the signed lines it made untrue are redrafted for his signature in the night's decisions list, unchanged in the record until he signs. One path edit beyond the criteria's list: `v3/package.json`'s `check:changed` is re-pointed to `node ../scripts/gate.mjs`, as the gate stays at the root; the exception is recorded in STACK-01's decision and put to him (D46 in the night's list). A fourth v3 file beyond the list: `v3/tests/helpers/buildScriptHarness.js` takes the published `docs/` its release tests need from the root's committed `docs/`, the same bytes as before the move, assertions unchanged; recorded in the decision and put to him (D49).

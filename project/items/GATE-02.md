# GATE-02 — The gate's loose ends after the foundations

## Intent

The gate (`scripts/gate.mjs`) sorts each change by its paths, so that a record-only change runs the record checker alone and a v4 change runs v4's gate. Phase 6 left five small gaps in it and around it, each found and written down by the item that met it. Each one makes some change run more than it needs, or less, or leaves a trial unrecorded. This item closes them together, beside the first core items, which touch none of its files, so that no core item waits 35 to 45 minutes for a sorting gap.

## Acceptance criteria

- The accessibility pack's own files, tools/a11y-*.mjs and `project/a11y/`, sort as v4 ahead of the record, and their four known entries in `scripts/gate.test.mjs`'s record-path guard are removed (wish STACK-03.1, D70).
- The publishing step's own files, `.github/workflows/publish.yml` and scripts/publish*.mjs, sort in a class of their own that runs the gate's and the step's tests, not frozen v3's whole suite (wish PUB-01.3).
- scripts/measures.mjs, which STACK-04 adds and leaves on none of the gate's lists, sorts in the class whose lane runs it, so a change to it alone no longer runs everything.
- When the gate checks a publishing commit on `main` against its run, it reads the logs only of the `publish` and `take-back` jobs that ran, skipping a job whose conclusion is `skipped`, so a commit that replays a real run's number fails Verify instead of running everything with a warning (PUB-01's hand-over, "Not done, or found after the merge").
- PUB-01's Notes record the first publish through the step, the take-back tried once on the live site and the publish after it (8f4774f, e907926 and 037d131), and that each push made with the run's token started a Pages build by itself (wish PUB-01.6).
- Each gate change has a test in `scripts/gate.test.mjs` that fails without it; no test is deleted, skipped or weakened, and anything unlisted still runs more checks, never fewer.
- It changes only these paths: scripts/gate.mjs, scripts/gate.test.mjs and project/items/PUB-01.md (its Notes).
- Its pull request has a `## What to try` section saying in one line that nothing visible changes.
- The item's gate is green in CI (a change to the gate runs everything, 35 to 45 minutes), Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: None.

Open question: Owner: whether a change to the publishing step's own files alone should keep publishing a preview, as the step does now, or publish nothing, as PUB-01's wording "a path of the gate's v4 or unplaced classes" reads once those files are placed (GATE-02's decision).

## Context and sources

- [The decisions](../decisions.md): PLAN-7, which files this item; GATE-01, PUB-01 and STACK-03, whose gaps it closes
- `scripts/gate.mjs` and `scripts/gate.test.mjs`: the gate and its tests
- [PUB-01](./PUB-01.md): the publishing step, whose Notes this item completes
- [STACK-03](./STACK-03.md): the accessibility run, whose files the first criterion sorts
- `reviews/v4-architecture-plan-2026-11-18.md`: §19, Phase 7

## Notes

- 2026-11-19 — Filed by PLAN-7, promoting three wish lines, each now one criterion here: STACK-03.1 (the first), PUB-01.3 (the second) and PUB-01.6 (the fifth); their text stands in the wish list's history and in PLAN-7's commit. The third criterion comes from STACK-04's brief, which left scripts/gate.mjs to a later gate item, and the fourth from PUB-01's hand-over. Wishes PUB-01.4 and PUB-01.5 stay the owner's calls and are not part of this item.
- 2026-11-19 — Built and closed by GATE-02's pull request. The owner's instructions in force, verbatim: "Gate by what changed (Recommended)" (Q23); on publishing, "re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)" (2026-11-18); overnight, "Merge when checks pass (Recommended)" (G2), "Proceed on recommendations (Recommended)" (G3) and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". So each choice is provisional and put to him in the night's decisions list. Three go beyond the criteria's letter, each recorded in GATE-02's decision: removing the guard's four entries needed it to read a folder's mention with the path after it and to pass over web addresses, and it gained one known entry, the measures script's comment citing two reviews; the step's class runs v4's gate as well as the gate's tests, as v4's dead-code check reads the step's scripts; and on `main` a site change its run's record cannot vouch for now fails rather than warns, the commit that last changed the site on `main`'s line being the one checked (Codex's reviews). Nothing under `src/`, `tests/`, `tools/`, `v3/`, `docs/` or `version.json` changed.

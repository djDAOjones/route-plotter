# GATE-01 — Gate by what changed

## Intent

Every push waits about 34 minutes, because v3's 4,385 tests run one file at a time, even when only the record changed. The owner chose "Gate by what changed (Recommended)" (Q23): a record-only change runs the record checker alone, a v4 change runs v4's own gate inside 10 minutes, v3's suite runs only when frozen v3 code changes, and anything unclear gets the full gate. This item builds the sorting. It runs alongside the architecture plan, on his word, so that the plan's own pushes are checked in seconds.

## Acceptance criteria

- A push that changes only record files runs `node tools/check.mjs` alone. The item proposes which paths count as record-only and shows the list to the owner before the merge.
- A push that changes frozen v3 code, its tests or its build runs v3's whole suite, as today. *Superseded by GATE-05 (2026-11-25): frozen v3 is locked; a change to it is refused, and its suite runs only by hand.*
- Anything not clearly record-only runs the full gate. The sorting rule has tests of its own, mixed pushes included.
- A place is left for v4's gate (types, lint, boundaries, dead code, tests in parallel, build, accessibility checks), with a 10-minute budget that is a finding if exceeded; STACK-01 fills it.
- No test is deleted, skipped or weakened, and no dependency is added without the owner's decision.
- The profile's Gate line is checked against what was built, and redrafted for the owner's signature if it differs.
- Codex reviews the pull request, read-only, before the owner decides the merge.

## Now

Updated: 2026-11-18

Next step: None in this item; STACK-01 fills v4's lane (`V4` in `scripts/gate.mjs` and a `check:v4` script) when it puts v4 at the root.

Open question: Owner: confirm the record-only list, and sign the redrafted Gate line in GATE-01's decision.

## Context and sources

- [The decisions](../decisions.md): PLAN-5
- `reviews/v4-vision-question-rounds-2026-11-18.md`: Q23, his answer and the option's text
- `reviews/v4-programme-2026-11-18.md`: P4, where the item sits, and finding F5
- `DEV-INFRASTRUCTURE.md`: Quality gate
- `.github/workflows/ci.yml` and `package.json`: the gate as it is

## Notes

- 2026-11-18 — Filed by PLAN-5. The owner's instructions in force, verbatim: "Gate by what changed (Recommended)" (Q23), whose option text stands in the vision file and is paraphrased in the Intent; of where the item sits, "Alongside the plan (Recommended)" (P4); and, from his task message as the programme file quotes it, "Propose a faster gate, and say whether a record-only change needs the app suite". CI run 44322370111 took 2,260 seconds, 2,139 of them inside the tests: 203 files, 4,385 tests, one worker. The stock take kept REV-07 (CI maturity) in the Icebox, to be raised when this item is planned.
- 2026-11-18 — Built and closed by GATE-01's pull request. The owner's instructions in force, verbatim, unchanged since the note above: "Gate by what changed (Recommended)" (Q23); "Alongside the plan (Recommended)" (P4); "Propose a faster gate, and say whether a record-only change needs the app suite" (his task message). His overnight answers of the same day govern the close, verbatim: "accrue decisions that come up but dont stop dev unless impossible", and the option labels "Merge when checks pass (Recommended)" and "Proceed on recommendations (Recommended)" (GATELESS-2). So the record-only list and the Gate line's redraft are provisional, put to him in the night's decisions list, and the merge is made under G2's conditions. `npm run check` stayed the full gate because `push.js` runs it as one; REV-07 is untouched.
- 2026-11-25 — The second criterion (a push that changes frozen v3 runs v3's whole suite) is superseded by GATE-05, on the owner's word of 2026-11-25: frozen v3 is locked, a change to any v3 path is refused, and v3's suite runs in no lane, only by hand. The criterion's text stands as written, marked in place; GATE-05's item and decision entry hold his words. The rest of this item stands.

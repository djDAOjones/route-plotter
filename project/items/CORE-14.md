# CORE-14 — A label fades over half a second of the lead's moving, whatever the pauses

## Intent

A label's fade is half a second on a route with no pauses and shorter on one with pauses, because v3's sum was copied: the review of 24 Nov put it at 312 ms on a 10-second walk with 6 seconds of pauses. The owner chose a fade of 500 ms of the lead's moving whatever the pauses. It changes code CORE-04 merged, so it is an item of its own, built after CORE-05 merges.

## Acceptance criteria

- Under `fade in` and `fade in and out`, a label's fade lasts 500 ms of the lead's moving time, whatever the route's pauses.
- The tests hold the review's case (500, not 312) and a route with no pauses unchanged.
- Wherever a comparison with v3 pins the old figure, it is changed with the reason written beside it.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-24

Next step: Built after CORE-05 merges, from fresh `main`.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-9, which files this item; CORE-04, whose labels it changes
- [The owner's answers of 24 Nov](../../reviews/v4-owner-answers-review-2026-11-24.md): D203's question, his label and the option's words
- `src/features/labels/model/timing.ts`: `fadesOf`
- `src/features/labels/model/labels.ts`: where the fade is applied

## Notes

- 2026-11-24 — Filed by PLAN-9, from D203. The owner's label, "Half a second (b) (Recommended)", whose option read "500 ms of the lead's moving, whatever the pauses. One line and its test figures." Both the label and the option's words are the asking chat's; what he chose is the option. The figures 312 and 500 are the review chat's arithmetic from reading the code: nothing was run, and this filing verified nothing; the building chat does. The orchestrator placed it as an item of its own after CORE-05 merges (D217 in the night's decisions list, in force unless he objects); the acceptance criteria are the orchestrator's, his to change.

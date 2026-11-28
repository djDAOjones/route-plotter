# STACK-08 — Item C, second part: accessibility before CORE-07

## Intent

The owner's decisions of 27 Nov 2026 put, before CORE-07: "`user-input` and `pointer-gestures` set to present, … each with evidence", the states "project open" and "playing", `a11y:known-bad` and `a11y:sample`. This item does that in stages on one branch and one draft pull request. Stage 1: the refusals to open a file say what to choose instead (WCAG 3.3.3), and the six input rows (1.3.5, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.6) are credited by j-forms journeys so `user-input` can be set present (D280 in the lane's decisions list). Stage 2: the two states and `pointer-gestures`. Stage 3: `a11y:known-bad` and `a11y:sample`.

## Acceptance criteria

- Every refusal to open a file says what to choose instead, just before "Nothing was opened." (`src/adapters/io/words.ts`; `words.test.ts` holds each to it); words only, no logic changed.
- Each of the six rows is claimed only by a journey whose method its catalogue entry lists, or named with why not; `user-input` is set present in `project/a11y/coverage.json` with evidence only when all six are credited and `npm run check:v4` shows no new failure.
- Planted faults (bo), a refusal's suggestion taken out, and (bp), an `autocomplete` purpose added to an input, each fail their step.
- Stages 2 and 3 as the intent says.
- `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-28

Next step: stage 1's second part, the six rows' journeys and `user-input` (sub-chat 157 stopped at its context line after the words); then stages 2 and 3.

Open question: None.

## Context and sources

- project/digests/app-opinion.md, project/digests/wcag-2.2-aaa.md, project/digests/nielsen.md (9: the cause and a way forward)
- project/a11y/catalogue.json, project/a11y/coverage.json, tests/a11y/project.mjs
- [STACK-07](./STACK-07.md), [CORE-06](./CORE-06.md)

## Notes

- 2026-11-28 — Sub-chat 157 (brief 157), stage 1, the words. Each open refusal now ends with what to choose instead: a file that is no project, "Choose a project saved by Route Plotter v4 (a .zip file)."; one unsafe, or outside what Route Plotter allows, "Choose a project saved by Route Plotter v4 and not changed since."; one too large, "Choose a smaller project."; one from another preview, or holding what this preview does not know, "Choose a project saved by this preview."; v3's already said "Open it in Route Plotter v3.". Save's refusals are unchanged: Save is not offered on the page yet. A unit test holds every open refusal to it; the two journeys' copies of the words follow. `user-input` stays unknown: its journeys are the next chat's.
- 2026-11-28 — Sub-chat 161 (brief 161), stage 1, the unreadable file. A file whose bytes could not be read (moved, or the browser lost access) no longer says to choose a project saved by v4 and not changed since; it says "This file could not be read: it may have been moved, or the browser may no longer have access to it. Choose it again from where it is now. Nothing was opened." (io's new `openedUnreadable`; the refusal's reason is unchanged). Codex's list, line 1.

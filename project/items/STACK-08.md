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

Next step: stage 2b (the states "project open" and "playing"); then stage 3.

Open question: None.

## Context and sources

- project/digests/app-opinion.md, project/digests/wcag-2.2-aaa.md, project/digests/nielsen.md (9: the cause and a way forward)
- project/a11y/catalogue.json, project/a11y/coverage.json, tests/a11y/project.mjs
- [STACK-07](./STACK-07.md), [CORE-06](./CORE-06.md)

## Notes

- 2026-11-28 — Sub-chat 157 (brief 157), stage 1, the words. Each open refusal now ends with what to choose instead: a file that is no project, "Choose a project saved by Route Plotter v4 (a .zip file)."; one unsafe, or outside what Route Plotter allows, "Choose a project saved by Route Plotter v4 and not changed since."; one too large, "Choose a smaller project."; one from another preview, or holding what this preview does not know, "Choose a project saved by this preview."; v3's already said "Open it in Route Plotter v3.". Save's refusals are unchanged: Save is not offered on the page yet. A unit test holds every open refusal to it; the two journeys' copies of the words follow. `user-input` stays unknown: its journeys are the next chat's.
- 2026-11-28 — Sub-chat 161 (brief 161), stage 1, the unreadable file. A file whose bytes could not be read (moved, or the browser lost access) no longer says to choose a project saved by v4 and not changed since; it says "This file could not be read: it may have been moved, or the browser may no longer have access to it. Choose it again from where it is now. Nothing was opened." (io's new `openedUnreadable`; the refusal's reason is unchanged). Codex's list, line 1.
- 2026-11-28 — Sub-chat 161, stage 1, the six input rows. `user-input` is present: the page takes a file (through "Open project"), the switch "Single-key shortcuts", the slider "Timeline" and canvas edits, and none of the user's own details. Journeys: inputs-purpose-and-labels (new; 1.3.5, 3.3.2: every field, hidden ones included, in the shell, with Help open and with "Replace your route?" open), refused-not-a-project (3.3.1, 3.3.3: the suggestion checked on its own), open-over-changes (3.3.4, 3.3.6) and a-delete-is-undone (new; 3.3.6: Delete, then one Undo draws the canvas as before). The other refusals' suggestions are held by the unit test, not journeys.
- 2026-11-28 — Sub-chat 162 (brief 162), stage 1, the inventory. inputs-purpose-and-labels now reads every input, type=hidden included (its own selector; the shared FIELDS unchanged), and a field it does not know, or any field inside "Replace your route?", fails both 1.3.5 and 3.3.2. Read so, it found a fourth field: the Timeline slider's own number box, which Carbon renders as an input of type=hidden, labelled by the same visible "Timeline"; the journey now checks it. The `user-input` evidence now counts four kinds of input, not three. Codex's list, lines 2 and 3.
- 2026-11-28 — Sub-chat 163 (brief 163), stage 2a, the features. Thirteen features the page as built does not have are absent, each with what was looked for and where: media, live-media, autoplay-audio, pdf, native-ios, native-android, authentication, timers, interruptions, device-motion, page-set, languages and exports; their 35 rows are not applicable. flashing (2.3.1, 2.3.2: the preview animates the user's own route and picture, which source cannot judge) and multi-step (3.3.7: no journey checks it) stay unknown. The report: 52 checked, 0 failed, 28 unverified of 80, 35 not applicable (was 52, 0, 63 of 115).
- 2026-11-28 — Sub-chat 164 (brief 164), stage 2a fix (Codex's list, lines 4-6). `languages` is present: a refused project's notice quotes text found in the file, and file names are shown, so 3.1.2 applies, resting on axe's valid-lang (quoted values carry no lang: their language cannot be known). `multi-step` is present: Open over a drawn route takes three steps; the new journey replace-asks-nothing-again (3.3.7) finds nothing asked again. flashing stays unknown, its reason now in its evidence; "no network request" narrowed to none of the app's own.
- 2026-11-28 — Sub-chat 165 (brief 165), stage 2a second fix (Codex's list, lines 7-9). `languages`' evidence now claims only what is established: names and short quoted values from a file may be in any language and carry no lang; axe's valid-lang passes; whether such a passage needs its own language is judged by no run (3.1.2's ai-review, unverified), a shortfall recorded. replace-asks-nothing-again now opens two-stops.zip on a fresh page first and requires the canvas and timeline after "Replace" to read as that reference, and fails on any control, focusable element or entry role in the dialog beyond its three buttons (Carbon's focus landing allowed once). Counts unchanged: 54 checked, 0 failed, 27 unverified, 34 not applicable, of 81.

# CORE-03 — Save and open

## Intent

v4 saves its own format, written schema-first, and opens no v3 file (Q14). This item ports v3's file-safety trust boundary into src/adapters/io around v4's format (the plan's §13 and §15).

## Acceptance criteria

- A project saves as a ZIP holding `project.json` (marked as v4's format, with a version) and its images, and opens through the ported preflight, limits, forbidden-key guard, colour grammar, asset admission and staged open, which leaves nothing behind if it fails (DEF-51, inverted from v3's pins).
- A v3 file is recognised and refused with a message naming v3; a file from a newer v4 version, or holding an unknown feature or field, is refused before anything changes, listing what it did not know.
- DEF-101's check: an emoji placed across each 16,384-unit boundary survives save and reopen by every save path (the table of v3's `v3/tests/archiveText.test.js`).
- Open after save gives the same project, as a fast-check property; open then save is stable near the limits (CROWD-08.7).
- It changes only these paths: src/adapters/io/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request.
- Until v4.0 is declared, the format may change between previews (PLAN-7, changing the plan's A13): a file from any other v4 format version, older or newer, is refused whole before anything changes, with a message saying another preview made it; the words the editor shows wherever it offers Save, that a file saved in a preview may not open in a later preview, are written here for the item that first offers Save to show.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: None; CORE-05 (the editor shell) passes Save and Open one decoder built on the browser's own, and the item that first offers Save shows `SAVE_NOTICE`.

Open question: Owner: does D124 stand (in the night's list, CORE-03's decision entry): a file holds about 5,000 points with 10,000 lines, half of what a scene may hold, with v3's file limits kept and Save refusing more in words, or should a limit change?

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §13, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "v3 files stay with v3" (Q14); of DEF-101, "drop this fix, concentrate on building new" and "No v3 fix, v4 check kept (Recommended)" (P3, P10). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A12, A13 (the plan's §18; the night's decisions list).
- 2026-11-19 — PLAN-7 changes the plan's A13, provisionally under the owner's grant G3: the format was to change freely only until the first publish, and v4 was published early, on his word, before anything could be saved. Until v4.0 it may change between previews; from v4.0 every older v4 version opens through a tested step, as A13 says.
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.
- 2026-11-19 — Built by sub-chats 17, 19, 21 and 23 and closed by sub-chat 24 under the owner's overnight grants; no further instruction of his for it is recorded beyond those quoted above ("v3 files stay with v3", Q14; of DEF-101, "drop this fix, concentrate on building new" and "No v3 fix, v4 check kept (Recommended)", P3 and P10), "Proceed on recommendations (Recommended)" (G3, 2026-11-18) and, typed by him on 2026-11-18, "accrue decisions that come up but dont stop dev unless impossible". Its choices are in CORE-03's decision entry, each provisional until he rules (D115, D116, D117, D122 and D124 in the night's list).

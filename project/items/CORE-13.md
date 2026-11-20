# CORE-13 — The settings the drawing already takes

## Intent

CORE-04 built and tested the drawing of every look the plan's §6 and §7 name, but the project's settings (CORE-01) have nowhere to keep most of them, so each draws in v3's default look until this item adds the settings and switches them on (D137). It changes what a saved file holds, so it gets its own look and review, before the panels that show these controls (CORE-12).

## Acceptance criteria

- The line: its dash, its shapes (wavy, randomised) and, per stretch, its colour, width and style (D135, D137).
- The lead's head: its kind (arrow, dot, picture), colour, image, and how it turns (its rotation mode and offset); per-line colour (D143, D135).
- The markers: per stop, size, style (dot, square, flag, custom, none), colour (then the stretch's colour, D135), custom image, its rotation and rotation offset; route-wide, the marker style (D144).
- The labels: per stop, mode, size, colour, background colour and opacity, width, and offsets X and Y; each label holding its own offset (D149).
- Each setting is declared once with CORE-01's field kit, judged by its declaration, and drawn by the code CORE-04 built and tested; a test shows each look reached from a saved setting.
- Every per-stretch or per-stop value counts against a saved file's size limit (D124); the limit and its words are checked again.
- `LABEL_SETTINGS.width` says "a share of the image's" while v4 draws it of the whole frame, as v3 measured (D150): the words and the drawing agree.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-20

Next step: Start when the orchestrator starts it, before CORE-12.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): CORE-04
- [CORE-04](CORE-04.md): the drawing this item switches on
- `reviews/v4-architecture-plan-2026-11-18.md`: §6, §7

## Notes

- 2026-11-20 — Filed by CORE-04's close on the orchestrator's D137 (19 Nov, provisional under the owner's overnight grant G3, "Proceed on recommendations (Recommended)"): "a small new item then adds the settings and switches them on", built before CORE-12. Its list is CORE-04's: the settings the line, the head, the markers and the labels lack. No instruction of the owner's for it is recorded.

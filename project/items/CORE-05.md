# CORE-05 — The editor shell

## Intent

v4's editor is React and Carbon React, pushed to the AAA bar (Q21, Q22). This item builds the frame every later item fills: the store with typed commands, undo and redo, selection, the transport, the control kit, announcements, the key table and dialogs.

## Acceptance criteria

- The Carbon frame with the pack's theme, UoN tokens for chrome and the Okabe-Ito palette for map data.
- A typed store: every change is a command, one gesture is one undo step, never merged by a timer; Redo restores the selection the action left.
- The transport (play, pause, scrub, J, K and L, skip) runs on `src/player`'s clock; a project opened from a file plays at once with its timing built.
- The control kit: sliders and number fields commit at the gesture's end and never lose a typed value; every control shows the value it holds.
- The announcement queue (ported), the key table (no browser chord taken), and Carbon dialogs that return focus.
- The shell has named slots for the panels, the points list, the outline and the export panel, which later items fill.
- It changes only these paths: src/editor/shell/**, src/editor/store/**, src/editor/kit/**, src/editor/transport/**, src/player/transport/** and src/ui/**.
- Its held lines in the plan's §16 are passed or weighed, each named in the pull request; the open findings of UI-06 and UI-07 are read as inputs to the shell.
- If the shell replaces the link to GitHub that STACK-03 added so the AAA focus test has a control (wish STACK-03.5), it keeps a control that takes focus, and the entries in `tests/a11y/project.mjs` that name the link change in the same pull request: the shell state's snapshot, its interaction and kept function, the keyboard function `follow-progress-link`, and the journeys `reading-and-focus-order`, `pointer-cancellation` and `keyboard-task`; as a shared component, it updates record P09 and flags a wider run.
- Its pull request has a `## What to try` section for the owner; whatever screen or control it adds is covered in `tests/a11y/project.mjs` and `project/a11y/coverage.json`, shared files where it may add its own entries beyond its own paths; and its merge, which publishes, leaves the published page working (PLAN-7).
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: Start once CORE-03 and CORE-04 have merged.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §9, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list
- `reviews/ui-06-gui-review-2026-10-08.md`: UI-06's findings

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Adopt the editor stack whole (Recommended)" (Q21); "Standard now, extended before v4.0 (Recommended)" (Q22). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A19 (the plan's §18; the night's decisions list).
- 2026-11-19 — PLAN-7 opens Phase 7 and adds the criterion on the pull request's `## What to try` section, accessibility coverage and the published page, from what Phase 6 taught: every app merge now publishes (PUB-01), the publishing step copies the section to the live `version.json`, and v4's gate runs the accessibility run at AAA (STACK-03). Each new screen or control is declared in `tests/a11y/project.mjs` (its state, snapshot, interactions and kept functions; a journey that meets something it cannot check is extended in the same pull request) and each feature it adds or rules out is recorded in `project/a11y/coverage.json`, never the catalogue.
- 2026-11-20 — Stage 3: the end of a playing reached by itself is not yet announced (v3's "Animation complete", `wiringBus.js` 422 to 429); no command reaches an end, so the editor's transport does not say it, and the frame owes it, stage 5, by watching the store's playback.
- 2026-11-21 — Stage 5, the first piece: the page has its one session, one keydown listener and the status region. The keys of one printable character (J, K, L, comma, full stop, < and >) are held off on the page until their switch is built with help (D183); Space, Home, End and the Undo and Redo chords work. Seen in Chromium on the empty page: Space says "Playing animation" and starts a playing that asks for a frame at every refresh until it is paused, since an empty scene has no end to stop on; a second Space says "Animation paused" and the frames stop. The refusal of a play start with nothing to play (v3's `_admitPlayStart`, `v3/src/app/playback.js` 72) and "Animation complete" come with the play bar.

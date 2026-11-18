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
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-18

Next step: Start once CORE-03 and CORE-04 have merged.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §9, §15, §16, §19
- `reviews/v4-stock-take-2026-11-18.md`: the held list
- `reviews/ui-06-gui-review-2026-10-08.md`: UI-06's findings

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Adopt the editor stack whole (Recommended)" (Q21); "Standard now, extended before v4.0 (Recommended)" (Q22). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules; those bearing on it: A19 (the plan's §18; the night's decisions list).

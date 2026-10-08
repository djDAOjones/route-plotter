# DEF-88 — Branch keeps crowd inspector

## Intent

With a crowd selected, Alt+click a major waypoint and click to place the branch: the Waypoints list highlights the new branch waypoint, but the inspector keeps "Editing · Crowd 1 · crowd" and the crowd cards. Placement sets the waypoint selection without emitting the event that clears crowd scope (`src/app/wiringControllers.js` line 421; `src/app/crowds.js` line 179). Seen in Chromium on 2026-10-08. The scope chip's promise is that the panel edits what is selected. **P3**

## Acceptance criteria

- Placing a branch waypoint (and any other programmatic waypoint selection) clears the crowd selection and shows the waypoint's cards, as a list click does.
- A test selects a crowd, arms and places a branch, and asserts the scope chip text and that no crowd is selected.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/wiringControllers.js` (:421) — branch placement selects the waypoint
- `src/app/crowds.js` (:172-182) — `crowd:deselected` on `waypoint:selected`
- `src/controllers/UIController.js` (:411-438) — the scope chip
- [The walkthrough](../../reviews/design-review-walkthrough-2026-10-08.md) — novice task (c), shot 11
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — real; DEF-65 covers only its undo issue
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found in the Chromium walkthrough; Codex confirmed the mechanism. The priority is the reviewing session's proposal, accepted with the row.

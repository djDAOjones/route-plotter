# CROWD-06 — Hold at end: the animation carries on after everything has finished

## Intent

After CROWD-05 the animation ends when the last animation that concludes has ended. This adds the owner's control "for both looping / ongoing situations, and also for generally adding some padding to the end" (2026-10-05, relayed verbatim by the Backlog status session): one project-wide setting for how long the animation carries on after that. Looping crowds keep moving through it, and the final frame holds.

## Acceptance criteria

- A "Hold at end" control in the Pacing section, under Duration: 0–10 s, default 2 s. It is saved with the project, takes part in undo and autosave, and has a plain-language hint to UI-03's standard, e.g. "Keeps the animation going after everything that finishes has finished: looping crowds keep moving and the final frame holds."
- The hold applies the same in the editor, Preview, scrub, video export and the HTML player, and the Duration readout includes it.
- Existing projects take the 2 s default (the owner waived backwards compatibility, 2026-10-05).
- "Wait here for this crowd" is retired: the fixed wait it writes at the last major waypoint goes stale, and CROWD-05 makes it redundant.
- The control is pinned like every other control: it extends TST-04's goldens.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- [CROWD-05's item](./CROWD-05.md) — the rule this extends
- [TST-04's item](./TST-04.md) — pins every control in the Pacing section
- [DEF-20's item](./DEF-20.md) — the Duration control out of step after Open and Clear All
- `src/config/constants.js` — `END_BUFFER_SECONDS` (line 275), the unused intent this replaces
- `src/app/crowds.js` — "Wait here for this crowd"

## Notes

- 2026-10-05 — Split from CROWD-05 by the Backlog status session under the owner's delegation ("do whats best"). It follows TST-04, so TST-04's long-running PR need not absorb a new control, and sits beside DEF-20, which fixes the same Duration control. The 2 s default mirrors the export's 2 s start buffer.

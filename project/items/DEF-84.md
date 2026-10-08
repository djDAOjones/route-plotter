# DEF-84 — Play silent without route

## Intent

With a custom-network crowd and fewer than two route waypoints, Play is enabled but `play()` returns at once (`src/app/playback.js` line 186) with no announcement, no disabled state and no reason; the crowd renders on scrub, so the app looks frozen only on Play. This is the first stall in the novice task "people walking from one place to another" from a blank project. UI-STANDARDS System status ("The UI must never appear frozen") and Error prevention ("disable impossible actions"). **P2**

## Acceptance criteria

- With fewer than two route waypoints, Play (button and Space) is disabled with an accessible reason naming what to do ("Add two route waypoints to set the timeline"), or plays and announces why nothing moves; the run chooses and records which here.
- Adding the second waypoint re-enables Play without a reload.
- A test boots the editor, adds a crowd with two nodes and no route, and asserts the disabled state and reason (or the announcement).
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/playback.js` (:186) — the silent return
- `index.html` (:1219) — the Play button
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F19, F30, §7 (a)
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED; distinct from DEF-62
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07's novice pre-analysis; Codex: CONFIRMED, not DEF-62's end-of-playback case. The priority is the reviewing session's proposal, accepted with the row.

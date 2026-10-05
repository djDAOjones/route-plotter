# CROWD-05 — The animation runs until everything that finishes has finished

## Intent

The animation ends when the route's own timeline ends, so anything still finishing is cut off. A crowd going from Entry to Exit loses its last dots, in the editor, on scrub, in export and in the player alike. The owner, 2026-10-05, relayed verbatim by the Backlog status session: "add to the wishlist or backlog, we need to animation duration to continue until all animation is concluded (loops notwithstanding - maybe we need an intentioned mechanism or control for animation that continues). at the moment, for example, when a crowd is going from entry point to exit, the animation finishes before all the dots have exited." Later the same day: "all animations that do conclude should be taken into account with the procedurally generated duration, so that animations never end before any animation that will end does end." This item lands that rule, scene-wide, and shows it in the Duration readout. The end-hold control he also asked for is CROWD-06, after TST-04.

## Acceptance criteria

- The procedural duration is the latest end of every animation that concludes. That includes the route head and its waits, a longer branch (ROUTE-01d), and the comet tail (Preview). It also includes crowds whose dots finish: Disappear and Collect, counting only journeys that really end (DEF-77's flag). Anything else the audit in Notes finds outlasting the head counts too.
- Animation that never concludes does not lengthen the duration. Respawn and Repeat journey crowds stop at the end, as today, until CROWD-06's hold.
- Nothing timed as a fraction of the timeline moves. Crowd release windows, busyness and route anchors stay measured against the base timeline, the duration as composed before this item; only the end grows.
- The same length holds in the editor, Preview, scrub, video export and the HTML player (play == scrub == export).
- The Duration readout shows the full length and what makes it up, e.g. "Ends at 16.5 s — route 12.0 s, crowds finish +4.5 s".
- DEF-77's hint shows only where no journey can end.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/pathTiming.js` — lines 620–702 compose the duration: path, start handle, intro, waits, the comet tail (Preview only), then the longer of trunk and branches (ROUTE-01d); crowds never count. Lines 677–678 say the end handle is added at export, which export does not do.
- `src/services/SwarmEngine.js` — lines 375–405: releases are fractions of the master duration, so the base they measure against must stay fixed
- `src/config/constants.js` — `END_BUFFER_SECONDS: 2` (line 275) and the end-handle comment (lines 276–279), "allows final beacon animations", are read nowhere
- `src/app/exporting.js` (line 237), `src/services/VideoExporter.js` — export adds only the 2 s start buffer
- `index.html` (~line 708) — the Pacing section's Duration control and readout
- [DEF-77's item](./DEF-77.md) — the "journey ends" flag and the hint
- [CROWD-06's item](./CROWD-06.md) — the end hold

## Notes

- 2026-10-05 — Filed from the Backlog status session's message and write-up (the run's inbox, 2026-10-05). A shape that session proposed, not the owner's: a crowd tail after the route's own timeline, sized to the last Disappear or Collect finish, with release percentages anchored to the route-only duration; and an explicit control for looping crowds, for example "After the route ends: stop / until crowds finish / N seconds". Waits on the owner's word on the looping-crowd choice and on starting it.
- 2026-10-05 — The owner replied "agreed" to that session's summary (relayed verbatim, about 16:50): file it in the backlog; a crowd tail after the route, its timing still measured against the route; an explicit control for crowds that never finish, the example above. That this accepts the placement and the shape, the example control included, is this run's reading, for him to confirm; it is not an order to start, and it places the item in no queue.
- 2026-10-05 — The owner's second reply, relayed verbatim by the Backlog status session (about 17:00): "agree with your control suggestion, although it may apply beyond just crowds / I'm not sure where that control is best placed. either way, all animations that do conclude should be taken into account with the procedurally generated duration, so that animations never end before any animation that will end does end. the extra control is for both looping / ongoing situations, and also for generally adding some padding to the end. happy for you to push back. do whats best". His own calls: the rule is scene-wide, and the control serves both looping or ongoing animation and padding. He delegated the rest. The Backlog status session's calls under that delegation: the rule as in the criteria; one project-wide "Hold at end" control in Pacing, not one per crowd (CROWD-06); and a split, so the control lands after TST-04 (which pins every control in the Pacing section) and beside DEF-20 (which fixes its Duration control). Part 1 carries no hold, so projects' lengths and end-frame goldens change once, not twice.
- 2026-10-05 — Audit, to verify before closing (the Backlog status session's reading of the code): the final waypoint's beacon or ripple, since the end handle meant for it was never built; label fades and area, spotlight and AoV reveal fades; the camera's final zoom ease, which never strictly settles off 1× (count it at DEF-44's settle threshold, or leave it out and say so).

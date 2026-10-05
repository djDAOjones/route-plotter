# CROWD-05 — The animation runs until every crowd dot has finished

## Intent

A crowd going from its Entry to its Exit is cut off when the route ends: its last dots never arrive, in the editor, on scrub, in export and in the player alike. The owner, 2026-10-05, relayed verbatim by the Backlog status session: "add to the wishlist or backlog, we need to animation duration to continue until all animation is concluded (loops notwithstanding - maybe we need an intentioned mechanism or control for animation that continues). at the moment, for example, when a crowd is going from entry point to exit, the animation finishes before all the dots have exited." He asked for it to be filed, not started: it is new feature work, and what a looping crowd does is his design call.

## Acceptance criteria

- With a crowd whose dots disappear or collect, the timeline runs until its last dot has finished, in the editor, on scrub, in export and in the player.
- A crowd's release timings do not move when the timeline grows for it.
- What a looping crowd does after the route ends is the owner's choice, made before the work starts, and implemented as he chooses.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/pathTiming.js` — lines 620–702 extend the timeline for a longer branch (ROUTE-01d) and a comet tail, never for crowds
- `src/services/SwarmEngine.js` — lines 375–405: releases are fractions of the master duration, so lengthening the timeline naively moves every release later
- `src/app/crowds.js` — the crowd wait the route can fit to a crowd
- [DEF-77's item](./DEF-77.md) — "At journey end", and the panel's note when no dot finishes

## Notes

- 2026-10-05 — Filed from the Backlog status session's message and write-up (the run's inbox, 2026-10-05). A shape that session proposed, not the owner's: a crowd tail after the route's own timeline, sized to the last Disappear or Collect finish, with release percentages anchored to the route-only duration; and an explicit control for looping crowds, for example "After the route ends: stop / until crowds finish / N seconds". Waits on the owner's word on the looping-crowd choice and on starting it.

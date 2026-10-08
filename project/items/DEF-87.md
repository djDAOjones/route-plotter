# DEF-87 — Traced node drag no-op

## Intent

A node traced from the route is anchored to its waypoint (`anchorWaypointId`): drawing, hit-testing and the walk read `position()`, which returns the resolved anchor while one is set (`src/models/GraphNode.js` lines 51-55), but a drag in Edit network writes the authored `x`,`y` (`src/services/NetworkEditService.js` lines 613-624) and `endDrag` commits an undo entry (`src/app/network.js` lines 112-118). The node stays put, Undo gains an entry, and the scene outline shows the new numbers. The node hint still says "Choose Edit network to move nodes" (the wish-list line this promotes). **P2**

## Acceptance criteria

- Dragging an anchored node either moves it (clearing the anchor, with the hint saying so) or refuses the drag with a visible reason ("This node follows Main entrance; move the waypoint"); the owner did not pick an Unpin control on 2026-10-08, so the run's call is recorded here.
- No undo entry is recorded for a drag that changes nothing.
- The outline's position fields for an anchored node show the resolved position or are read-only with the same reason.
- A test traces the route, drags a node, and asserts the position, the undo stack length and the hint.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/models/GraphNode.js` (:39-55, :86-89) — authored vs resolved
- `src/services/NetworkEditService.js` (:563-568, :610-648) — the drag
- `src/app/network.js` (:112-118) — the commit
- `src/app/sceneOutline.js` (:674-693) — the outline fields
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F4, F26, probe (a)
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED; distinct from DEF-79
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07 (promotes the wish-list line "A traced network's nodes are pinned…", deleted with its trace when this ships); Codex: CONFIRMED. The priority is the reviewing session's proposal, accepted with the row.

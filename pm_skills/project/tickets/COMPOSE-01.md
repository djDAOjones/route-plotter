# COMPOSE-01 — Route-bound crowd anchors

> **Status:** Phase 5 — gated by ROUTE-01, REV-03 and CROWD-03.

## Intent

Let graph-guided crowds start or react at meaningful route moments while the
hero route remains the source of spatial and temporal truth.

## Done when

- `GraphNode.anchorWaypointId` binds a node's position to a valid waypoint and
  `Emitter.releaseAnchor` resolves head arrival, waypoint pause or route
  completion through PlayerCore's pure mappings.
- Route edits update bound evaluation without silently rewriting graph intent;
  broken references have an explicit fallback and author-visible warning.
- Migration, undo/redo, save/load, seek/reverse and standalone/video export
  fixtures preserve deterministic results.
- Existing unanchored swarm hashes remain byte-for-byte fixture compatible.

## Approach

Use additive model fields with null defaults. Resolve anchors at evaluation
time from the compatible hero-route model approved by ROUTE-01. Ownership is
strictly graph→route: the graph follows the route; it never moves route points.

## Constraints

Do not make route timing a live function of crowd arrival. New pointer gestures
wait for REV-03.

## Open questions

Fallback when an anchor waypoint is deleted; whether release during a pause is
a normalised offset or a small set of named positions.

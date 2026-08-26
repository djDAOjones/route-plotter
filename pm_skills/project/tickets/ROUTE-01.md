# ROUTE-01 — Split hero routes

> **Status:** Phase 0 discovery/sign-off; Phase 5 implementation remains blocked.

## Intent

Allow the main animated route itself to fork while keeping authoring,
playback, timing and export behaviour understandable.

## Done when

- The owner has approved the branch playback model: choose one branch, animate
  every branch, or run simultaneous heads.
- A signed-off interaction defines how a split is created, selected, reordered,
  rejoined and deleted without confusing hero-route branches with crowd guide
  networks.
- Timing, waits, labels, style inheritance, head state and route completion
  have explicit semantics at forks and reconvergence.
- Project migration, undo/redo, standalone player/export parity, keyboard
  authoring and representative branched-route fixtures are specified before
  implementation starts.

## Evidence / context

The current hero route is one ordered waypoint chain. Crowd guide networks can
already branch and select weighted paths, and Wave 3 includes tracing the hero
route into that network, but neither capability makes the hero animation
itself a split route. Treating the request as a drawing-only change would hide
model and timeline decisions.

## Approach

First prototype the smallest canonical route graph and two authoring
interactions against one fork/rejoin teaching example. Compare their saved
shape and player behaviour before selecting a migration. Reuse graph concepts
where they remain clear, but keep hero-route and crowd-layer meaning distinct.

## Constraints

Preserve valid linear projects exactly, deterministic seeking/export, the
normalised-coordinate model, and a comprehensible single timeline. Do not
infer playback semantics from the existing crowd weighting model.

## Open questions

When a route splits, should the head choose one branch, animate all branches
in sequence, or create multiple simultaneous heads? Do branches share one
master time or own independent durations? May branches reconverge, and how do
waits, labels and completion behave at the join?

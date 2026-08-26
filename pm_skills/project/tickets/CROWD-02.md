# CROWD-02 — Whole-route busyness envelope

> **Status:** Wave 2 — Inspector completion.

## Intent

Let an author describe how busy a crowd should feel across the complete
timeline without calculating emitter parameters or editing many intervals by
hand.

## Done when

- A compact line graph plots relative crowd busyness against route time and
  supports adding, moving and removing handles.
- Each span can change gradually or jump at a boundary, so patterns such as
  quiet → busy and quiet → busy → quiet are straightforward to author.
- Accessible numeric/time controls and keyboard operation provide the same
  authoring power as dragging the graph.
- Evaluation remains deterministic, honours the authored seed, and produces
  the same dot schedule in preview, project reload and export.
- Undo/redo, validation, persistence migration and representative golden tests
  cover the new envelope.

## Evidence / context

The current crowd model already has deterministic release windows,
`onsetVariance` and `intensityRamp`, but these parameters do not give a novice
an immediate picture of busyness across a whole route. The requested graph is
an authoring layer over that timing model, not permission to add transient
random state.

## Approach

Model a small ordered set of normalised time/value handles plus an explicit
transition type per segment. Compile the envelope into the pure swarm release
calculation, keeping timeline evaluation stateless. Start with one selected
crowd layer and place the editor behind the Wave 2 disclosure layout.

## Constraints

Preserve seeded reproducibility, normalised project coordinates/times, existing
projects, and editor/export parity. Do not rely on colour alone to communicate
the graph or make pointer dragging the only editing method.

## Open questions

Whether the horizontal axis is always the complete route timeline or may be
scoped to one emitter window; the initial maximum number of handles; whether a
step is represented by a segment mode or paired handles at one time.

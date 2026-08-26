# CROWD-03 — Seeded crowd variation controls

> **Status:** Phase 3 — after CROWD-01.

## Intent

Make crowds feel less mechanical while keeping every project reproducible and
making the meaning of each variation control understandable to non-specialists.

## Done when

- The selected crowd exposes walking-like pace variation, wobble/cadence,
  uneven release timing and seeded route-choice behaviour with plain labels.
- The current seed is visible and an explicit Re-roll action creates a new
  undoable seed; reload and export preserve the chosen result.
- Controls build on existing `speedVariance`, `wobble`, `onsetVariance`,
  `intensityRamp` and weighted-choice foundations instead of adding wall-clock
  randomness.
- Limits, migration and golden fixtures cover zero/max variation and prove
  editor, scrub, reload and export parity.

## Approach

V1 edits the selected crowd's first emitter. Put primary variation controls in
the crowd card and advanced shaping behind UI-01's More disclosure. Use
CROWD-01 for the route-choice explanation and leave multi-emitter authoring for
a later design.

## Constraints

Variation must remain a pure function of project state, seed, dot index and
timeline. Do not imply biomechanically accurate gait simulation.

## Open questions

Which two controls deserve primary placement; whether Re-roll changes only the
seed or also offers named deterministic presets.

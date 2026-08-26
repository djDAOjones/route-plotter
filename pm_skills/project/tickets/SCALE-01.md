# SCALE-01 — Authored size and export-resolution model

> **Status:** Phase 6 implementation — approved and ready after REV-06 profiling.

## Intent

Make marker, path, label and effect sizes predictable across background sizes,
viewport zoom and export resolutions without changing authored timing.

## Approved contract

- A project owns one reference render size, seeded additively from its existing
  `timingReference` or the current authored canvas for older projects.
- Normalised geometry stays normalised. Path/marker/beacon/area graphics are
  authored in reference pixels and scale uniformly from the reference short
  edge; labels remain authored in reference pixels with documented legibility
  clamps in the interactive editor.
- Editor labels report reference pixels. HTML/video rendering scales appearance
  without mutating saved values or recomputing the authored timeline.

## Done when

- The owner approves which properties are image-relative, canvas-relative or
  physical-pixel based and what authors see in the editor.
- Native, preset and custom-resolution exports preserve the approved visual
  relationships while `timingReference` continues to preserve authored time.
- Existing projects migrate additively and representative low/high-resolution,
  camera-zoom and HTML/video fixtures agree.
- UI labels name the chosen units and warn only where exact parity is
  impossible.

## Evidence / context

The former relative-sizing and export-resolution items share one root:
absolute-pixel values are interpreted against changing canvas dimensions.
Changing them independently would create conflicting migration rules.

## Constraints

Do not recompute an authored timeline from export dimensions. Preserve
normalised coordinates and avoid resolution-dependent saved-state mutation.

## Open questions

None at the model gate. Exact legibility clamp values are tuneable constants to
be validated against representative low- and high-resolution fixtures.

# SCALE-01 — Authored size and export-resolution model

> **Status:** Phase 0 — design/sign-off required.

## Intent

Make marker, path, label and effect sizes predictable across background sizes,
viewport zoom and export resolutions without changing authored timing.

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

Whether a project owns one reference resolution; which text/effect sizes must
remain screen-legible rather than map-relative.

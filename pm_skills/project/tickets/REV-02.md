# REV-02 — Non-visual scene and keyboard authoring design

> **Status:** Phase 2 — approved and ready; gates REV-03 and REV-05.

## Intent

Define how keyboard-only and non-visual users can inspect and author the full
route, crowd, network and polygon scene without inventing disconnected canvas
semantics.

## Approved contract

- A synchronized DOM scene outline is another view of the canonical project:
  route (major and minor waypoints), crowds, emitters, graph nodes/edges and
  polygon vertices are all inspectable and selectable without the canvas.
- V1 includes explicit add/delete/connect commands and labelled numeric
  coordinate/time fields; pointer gestures remain an equivalent visual route.
- The standalone player exposes a concise static scene summary and announces
  transport milestones, not a noisy description of every rendered frame.

## Done when

- The approved model covers major/minor waypoints, nodes, edges, emitters,
  polygons, timing and exported-player meaning in working UI.
- Focus, announcement, undo, pointer parity and mobile implications have
  explicit acceptance criteria before implementation begins.

## Evidence / context

The review found the canvas exposes only a generic image label; network and
polygon creation are pointer-only; minor points and flow structure have no DOM
representation. This is a WCAG and product-design concern, but the smallest
honest fix requires an interaction decision rather than isolated ARIA patches.

## Approach

Use the canonical scene/project model to drive a synchronized semantic outline
and evaluate coordinate-entry, roving tree/list navigation and explicit edit
commands against representative educator workflows.

## Constraints

Preserve Canvas as the visual renderer, EventBus communication, normalized
coordinates and deterministic playback. No implementation before sign-off.

## Open questions

None at the design gate. Detailed control placement may use existing card and
outline patterns during implementation without changing the contract above.

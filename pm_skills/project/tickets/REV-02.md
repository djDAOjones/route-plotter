# REV-02 — Non-visual scene and keyboard authoring design

## Intent

Define how keyboard-only and non-visual users can inspect and author the full
route, crowd, network and polygon scene without inventing disconnected canvas
semantics.

## Done when

- The owner approves a semantic scene-outline model and keyboard/coordinate
  authoring interaction.
- The design covers major/minor waypoints, nodes, edges, emitters, polygons,
  timing and exported-player meaning.
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

Whether the first release must support full graph/polygon creation or may ship
inspection plus coordinate editing first; how much authored animation meaning
the standalone player should narrate dynamically.

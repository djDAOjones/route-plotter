# CROWD-01 — Competing-route shares

> **Status:** Phase 1 — ready and partly implemented.

## Intent

Let an author understand and set how dots divide between competing outgoing
paths without editing isolated weights and doing percentage arithmetic.

## Done when

- Selecting a junction shows every valid outgoing choice together, its
  relative input and resulting percentage; percentages normalise predictably.
- Editing one choice has a documented effect on the others, survives
  undo/redo and project reload, and never leaves an unusable zero-total set.
- Preview makes likely allocation legible with text plus a non-colour-only
  weight treatment such as edge thickness.
- Seeded route selection and editor/export evaluation continue to agree, with
  fixtures for two-way, multi-way, directed and unavailable choices.

## Evidence / context

Graph edges already persist positive weights and the network inspector reports
the selected edge's traffic share. The deterministic swarm engine already
samples weighted choices. The gap is an aggregate authoring view, not a new
routing algorithm.

## Constraints

Do not confuse crowd path allocation with ROUTE-01 hero-route branching. Keep
the Okabe-Ito data palette and provide the percentages as text.

## Open questions

Whether V1 accepts relative weights, percentages, or both; whether one share
may be locked while the remainder is redistributed.

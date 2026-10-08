# DEF-85 — Anchored window start misreads

## Intent

A crowd whose emitter carries a `releaseAnchor` (today only the built-in Open day Visitors crowd, `src/examples/index.js` line 119) releases at the anchored route moment, but the Release card's Window start slider shows the authored `releaseStart` (0%) and moving it changes nothing while the anchor resolves (`src/utils/routeAnchors.js` lines 138-150). Probe: authored 80%, effective 10%. UI-STANDARDS Recognition over recall: "Slider readouts show the value the renderer or timeline consumes". **P2**

## Acceptance criteria

- On an anchored crowd the Window start control shows the effective start ("Starts when the head reaches Main entrance") and is disabled with that reason, or shows the resolved percentage as its readout; the stored anchor and `releaseStart` are not changed by the fix (Codex: a truthful readout, not a behaviour change).
- Deleting the anchored waypoint returns the control to the authored value, as the engine does.
- A test loads the Open day example and asserts the readout and the reason, then removes the anchor waypoint and asserts the authored value shows.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/crowds.js` (:821-822) — `syncCrowdEditor` writes `releaseStart`
- `src/utils/routeAnchors.js` (:102-150) — the anchor wins while it resolves
- `src/examples/index.js` (:119) — the anchored example
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F3, F27
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED; distinct from DEF-79
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07's parameter matrix; Codex: CONFIRMED. A release-anchor authoring control (F3) is a separate backlog candidate the owner did not pick on 2026-10-08. The priority is the reviewing session's proposal, accepted with the row.

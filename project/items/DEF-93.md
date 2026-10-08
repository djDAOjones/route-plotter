# DEF-93 — Journey-end hint misadvises

## Intent

`hasJourneyEnd` is false when no end is reachable from any entry (`src/services/SwarmEngine.js` lines 286-293 and 426-447), including a network that has an Exit on a part the dots cannot reach; the hint under "At journey end" still says "Set a node's Type to Exit to see this setting act." (`src/app/crowds.js` lines 49-50). Repro (Codex): a reachable loop A, B, A with an Exit C no path leads to; adding another Exit elsewhere changes nothing, the fix is an edge direction. **P3**

## Acceptance criteria

- The hint names the actual condition: no end is reachable from an entry, so check Exit nodes and one-way directions; on an intentional closed loop it reads as information, not a nag (CROWD-07 F20).
- A test builds the loop-with-unreachable-Exit network and asserts the hint text; a second builds a dead-end chain and asserts no hint.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/services/SwarmEngine.js` (:286-293, :410, :426-447) — reachability
- `src/app/crowds.js` (:49-50, :866-875) — the hint
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F20, F36
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — mechanism real, repro corrected
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07; the review's own repro was wrong (its B node is a dead end), Codex supplied the loop repro. The priority is the reviewing session's proposal, accepted with the row.

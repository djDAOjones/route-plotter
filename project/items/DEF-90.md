# DEF-90 — Window length readout unclipped

## Intent

The engine clips the release window to the timeline (the window end is the lesser of start plus length and 1, `src/services/SwarmEngine.js` lines 475-476), but the Release card shows the authored length: at Window start 60% and Window length 100% the readout says "100%" while the effective window is 40%. UI-STANDARDS Recognition over recall (readouts show the value the renderer consumes). **P3**

## Acceptance criteria

- The readout shows the effective length ("40% (clipped)") or the slider's maximum follows 100 minus the start; stored values are unchanged (Codex: a truthful readout, not a behaviour change).
- A test sets start 60 and length 100 and asserts the readout and `aria-valuetext`.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/services/SwarmEngine.js` (:474-481) — the clip
- `src/app/crowds.js` (:258-261) — the readout
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F29
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07's no-effect table; Codex: CONFIRMED. The priority is the reviewing session's proposal, accepted with the row.

# DEF-86 — Sliders rewrite stored values

## Intent

The crowd and edge cards' sliders have narrower ranges than the model (Count 1–500 vs 1–5,000; Speed 0.01–1.00 vs 0.001–1,000; Size 0.05–2 vs 0.01–100; Traffic 0.1–5 vs 0.01 and up). `syncCrowdEditor` sets the input's value to the stored value, the browser clamps the thumb, the readout shows the true number, and the next `input` event writes the clamped value to the model (`src/app/crowds.js` lines 815-838 and 238-281; `src/app/network.js` lines 448 and 186). Probe: Path weight 24, thumb at 50, the next nudge writes 5.0. Projects authored in the scene outline or imported lose their values silently. **P2**

## Acceptance criteria

- A stored value outside a slider's range is neither clamped on display nor rewritten by the first nudge: the slider's range widens to the model's (with the number field he picked on 2026-10-08: "Number field beside each crowd slider + full-width Traffic (Recommended)", recorded in PLAN-3), or the first `input` is guarded against the clamp.
- The outline and the cards agree on every value after a round trip.
- A test sets Count 1000 and weight 24 through the model, selects the crowd and the edge, presses ArrowLeft once on each slider, and asserts 999 and 23.9 when the ranges are widened, or the unchanged stored values when clamped input is refused (never 500 and 5.0).
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/crowds.js` (:815-838, :238-281) — sync and the `input` writers
- `src/app/network.js` (:183-190, :448) — the Traffic slider
- `index.html` (:1020, :1042, :1110, :1193-1197) — the ranges
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F5, F28
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED, repro ArrowLeft; not DEF-20's restore-sync
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07's parameter matrix; Codex: CONFIRMED. Lands with CROWD-07's number-field tweak (his pick on 2026-10-08, quoted above), which is the natural fix. The priority is the reviewing session's proposal, accepted with the row.

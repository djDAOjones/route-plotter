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
- 2026-10-12 — Closed by CROWD-07's crowd cards PR 5b (#128, `9466a3f`, v3.2.716), with the number field the owner picked on 2026-10-08, by the first criterion's second branch, clamped input refused: a number field beside each crowd slider (Size, Walking variation, Count, Window start, Window length, Release timing, Release bias, Speed, Pace variation) and the Path card's Share holds the stored value as it is, to the model's whole range (`index.html` (:1120–1346); `src/app/crowds.js` (:93–150), (:406–603); `src/app/network.js` (:216–282), (:568); `src/utils/uiReadouts.js` (:96–250)). A slider writes only where it is moved: one whose stored value lies past its ends sits at its nearer end, off, described by "Beyond the slider's reach — use the number field.", so a stored Count 1000 or weight 24 is never rewritten, and it is on again once the field brings the value within reach; one holding a value between its steps stays on and writes nothing until it moves. A field committed as it was shown writes nothing, so an untouched stored value is kept exactly; Count is held to the scene's 20,000-dot budget by its field and its slider. Its acceptance criteria are met: `tests/crowdNumberFields.test.js` ("Count 1000: the field holds 1000, the slider is off at its end and says why; a step writes nothing; 400 typed brings it back" and "weight 24: the Share field holds 24, the slider is off at its end; a step never writes 23.9 or 5; 3 typed brings it back", the keyboard step simulated by an `input` on the slider, since jsdom moves no range) failed on f211c7c and passes on `c35eacf`, and so does "the outline and the card agree after a round trip, either way"; Codex r1's off-grid case is pinned beside them ("Speed 0.12345 and Size 8.25 reference px, between the sliders' steps: an input on the unmoved slider keeps them; a step writes the stepped value"); every existing test stays green, none deleted, skipped or weakened (the gate: 134 files, 3,248 tests, 2 todo). In the lead's pane, Count 1000 typed leaves its slider off at 500 with its reason, and a weight of 24 Share's.

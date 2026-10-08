# DEF-92 — Crowd sliders undo on timer

## Intent

Every crowd slider, the Edge Traffic slider and the Node path-weight inputs route through `crowd:param-changed` to `saveUndoStateDebounced` (`src/app/crowds.js` lines 190-196 and 324-330; `src/app/network.js` lines 189 and 524; `src/app/undoRedo.js` lines 87-93): a drag paused for more than 400 ms makes two undo entries, and a Direction change within 400 ms of a Traffic nudge cancels the pending timer and merges both into one entry (`undoRedo.js` line 70). CROWD-06's Hold at end slider already records on `change`. Promotes the crowd half of the wish-list line on slider undo timing. **P3**

## Acceptance criteria

- Each crowd, Traffic and path-weight slider records one undo entry per gesture, on `change`, as Hold at end does; keyboard steps record per key.
- A test drags with a pause and asserts one entry; a second changes Traffic then Direction within 400 ms and asserts two entries in order.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/crowds.js` (:190-196, :324-330) — `_wireCrowdSlider`
- `src/app/network.js` (:183-190, :512-526) — Traffic and weights
- `src/app/undoRedo.js` (:70, :87-93) — the debounce
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md) — F34, F35
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED, F35 folded in
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by CROWD-07; the route-card sliders in the wish-list line stay on the wish-list. The priority is the reviewing session's proposal, accepted with the row.

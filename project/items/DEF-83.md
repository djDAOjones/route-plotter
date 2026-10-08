# DEF-83 — Collapsed header focus unseen

## Intent

A keyboard user who tabs onto a collapsed left-sidebar card header sees no focus indicator: `.settings-section` has `overflow:hidden` and clips the header's outer box-shadow ring; when the card is collapsed the header is the whole section, so the ring is clipped on every side, and the forced-colours outline is clipped the same way. Confirmed in Chromium on 2026-10-08 (the Dots header focused, `:focus-visible` true, nothing drawn). WCAG 2.4.7 and 2.4.11; UI-STANDARDS Operable. **P2**

## Acceptance criteria

- Tabbing onto any of the 17 card headers, collapsed or expanded, shows a focus ring that is not clipped at any edge, in normal and forced colours.
- The `[data-last]` accent ring on the last-touched card is not clipped by `.settings-sections`.
- A test pins the CSS rules that decide it (no clipping ancestor for a focused collapsed header); the PR carries a Chromium screenshot.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `styles/main.css` (:885-891, :935-941, :1515-1519, :3926-3930) — the section clip, the header ring, the list clip, the forced-colours block
- `index.html` — the 17 `.section-header` elements
- [The GUI review](../../reviews/ui-06-gui-review-2026-10-08.md) — B-02, C-1
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by UI-06's static half, confirmed in the pane; Codex: CONFIRMED. UI-06's targets-and-focus PR makes the fix with B-21's native `<h2><button>` headers; this row is the defect's record and closes with that PR. The priority is the reviewing session's proposal, accepted with the row.

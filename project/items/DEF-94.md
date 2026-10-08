# DEF-94 — Outline errors lack red mark

## Intent

`--support-01` is not defined in `styles/tokens.css`, so the error accent bar (`styles/main.css` line 2162), the `[aria-invalid]` border and shadow (lines 2170-2171) and `.scene-outline-danger` (line 2097) are invalid at computed-value time: an outline validation error appears as plain text with no accent bar and no red field border. Four more undefined tokens (`--text-helper`, `--type-heading-02`, `--type-heading-03`, `--type-body-compact`) make the help screen fall back to inherited sizes and colours. Repro (Codex): in the outline, connect two nodes that are already connected (`src/app/sceneOutline.js` line 728); an off-image position such as 150% is valid and is not a repro. **P3**

## Acceptance criteria

- Every token the stylesheets reference is defined in `styles/tokens.css`; a test greps the `var(--…)` uses against the definitions.
- The outline's error paragraph and the invalid field carry their accent bar and red border, 7:1 text.
- A test triggers the duplicate-edge error and asserts the computed border colour is the error token.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `styles/tokens.css` — the definitions
- `styles/main.css` (:2097, :2162, :2170-2171, :2796, :2882, :2980, :3017, :3026, :3064, :3090, :3115, :3150, :3174) — the uses
- `src/app/sceneOutline.js` (:728) — the custom error
- [The GUI review](../../reviews/ui-06-gui-review-2026-10-08.md) — B-14, C-2
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — real; repro corrected
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by UI-06's static half; Codex supplied the working repro. UI-06's colour-and-tokens PR (B-14) makes the fix; this row is the record. The priority is the reviewing session's proposal, accepted with the row.
- 2026-10-08 — Shipped in UI-06's colour and tokens PR (#114, `1bc07cd`, v3.2.709): the five tokens are defined, the duplicate-edge error renders its accent bar and the field its red border, pinned through the cascade in `tests/tokens.test.js` and `tests/sceneOutline.test.js`.

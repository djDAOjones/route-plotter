# DEF-91 — Example background fails silently

## Intent

File, Example backgrounds, an image that fails to load (offline, or a blocked `images/Garlic.jpg`): `loadExampleBackground` catches, logs to the console and returns false (`src/app/backgroundLoading.js` lines 87-92); the callers do nothing with false, so there is no toast, no announcement and no change. An upload failure is announced only (lines 55-60). UI-STANDARDS System status and Empty states ("No blank panels or silent failures"). The v3.1.473 audit's N9-2, still open. **P3**

## Acceptance criteria

- A failed example or uploaded background shows a toast with the reason and announces it; a decode in progress sets `aria-busy` on the canvas area.
- A test stubs the image load to fail and asserts the toast and the announcement.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/backgroundLoading.js` (:29-92) — upload and example paths
- `src/main.js` (:1029-1031), `src/app/wiringDom.js` (:55) — the callers
- [The GUI review](../../reviews/ui-06-gui-review-2026-10-08.md) — B-16, C-3
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — real
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found by UI-06's static half; Codex: real. UI-06's status PR (B-16) makes the fix; this row is the record. The priority is the reviewing session's proposal, accepted with the row.

# DEF-96 — Marker Size reads the radius as its diameter

## Intent

The Marker card's Size readout says "8 reference px" at the default, and its hint says "Waypoint marker diameter in project reference pixels" (`index.html` (:186)), but the drawing uses that value as the radius: a dot is an arc of radius `size` (`src/services/RenderingService.js` (:2470)) and a square is `size * 2` wide (:2439), so a default marker is 16 reference px across while it reads 8. The owner's audit of 2026-10-10 found it while checking the readout CROWD-07's PR 5a (#123) gives a crowd's dot Size (F1), whose "8 reference px" is the dot's true diameter: a default crowd dot reads the same as a default marker but is half its width. The owner's call (the audit's decision 3): the readout becomes the diameter, "16 reference px" at the default; the stored value, the drawing and the hint are unchanged. **P3**

## Acceptance criteria

- The Size readout and the slider's `aria-valuetext` give the drawn diameter, twice the stored value: "16 reference px" at the default, 8 to 32 across the slider's stored 4 to 16, wherever they are written (the markup, a selected waypoint, an edit, a multi-selection).
- The stored `dotSize`, the slider's range, the drawing and the hint are unchanged; a saved project opens and draws as before.
- A regression test fails on the defect before the fix and passes after it: the default readout and `aria-valuetext` read "16 reference px", and one other value reads twice its stored value.
- The tests that pin the old readout (`tests/goldens/controls-major.txt`, `tests/goldens/controls-mixed.txt`, `tests/goldens/controls-major-first.txt`, `tests/paramTooltip.test.js` (:120)) change with it, each named with its reason; every other test stays green, none deleted, skipped or weakened.

## Context and sources

- `src/services/RenderingService.js` (:2439, :2470) — the drawing: a square `size * 2` wide, a dot of radius `size`
- `index.html` (:186-189) — the hint, the slider's `aria-valuetext` and the readout
- `src/app/editorPanel.js` (:378, :519, :629), `src/app/wiringDom.js` (:806-814), `src/controllers/UIController.js` (:2172-2178) — where the readout is written
- [UI-06](./UI-06.md) — PR 8, the follow-ups PR that makes the fix
- [CROWD-07](./CROWD-07.md) — PR 5a (#123), whose crowd-dot readout the audit compared with this one
- [The decisions](../decisions.md) — REL-713 (the filing and the owner's call)

## Notes

- 2026-10-11 — Filed in the REL-713 record on the owner's answer of 2026-10-10 to his audit, "Proceed as per your recommendations", which takes its decision 3: the readout becomes the diameter, not the hint the radius (DEF-96 either way). Found by the audit while checking PR 5a's claim that its crowd readout reads "as the Marker card's Size does"; PR 5a's round 3 corrects that sentence and changes nothing in the Marker card. UI-06's PR 8 (the follow-ups) makes the fix; this row is the record. P3 is the filing session's proposal, taken with the rest.

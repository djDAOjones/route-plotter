# DEF-99 — The editor's zoom leaks into video exports

## Intent

The owner, 2026-10-18: "exports and playback of the football example are
coming out weird", with two MP4s of v3.3.723's Match day. One showed a
96×54-pixel patch of the aerial west of the Market Square, enlarged about
48×, with no fans in it. The editor's zoom (the scroll wheel on a selected
waypoint, up to 48×) went into the video export. Its pan is in display
pixels, so on the export's larger canvas it framed another part of the map,
and it took the camera's place, so Camera movement was lost. A video export
now frames as the HTML export's player does, whose viewport never zooms.

## Acceptance criteria

- With Camera movement off, a video export draws the same frames, call for
  call, whether the editor is at 1× or zoomed.
- With Camera movement on, every frame of an export made while the editor is
  zoomed is drawn by the camera and no viewport zoom, as at 1×.
- The editor keeps its zoom and pan after the export, and its own display,
  zoomed or not, is unchanged (DEF-61's Preview checks pass as they were).
- A test pins each; no test is deleted, skipped or weakened.

## Context and sources

- `src/main.js`: the render state's viewport
- `src/app/camera.js`: `_calculateCameraState`, where the editor's zoom takes
  the camera's place (DEF-61)
- `src/player/PlayerApp.js`: the HTML export's viewport, fixed at 1×
- `tests/exportFraming.test.js`: the regression tests
- `tests/cameraDomain.test.js`: why camera frames are not compared call for
  call across apps (DEF-07)

## Notes

- 2026-10-18 — Found from the owner's `route-animation-2026-10-18T20-32-36.mp4`
  (27.8 s: Match day's 25.77 s and the export's 2 s start buffer, so
  v3.3.723). A template match puts its frame at the aerial's source pixels
  (584, 1060), 96 wide (NCC 0.93). Reproduced on the live site by zooming the
  editor 48× on the City Ground and exporting. Zooming needs a selected
  waypoint and Match day has none, so the filing session reads that the owner
  added one at the stadium (proposed, unconfirmed).
- 2026-10-18 — DEF-61's export checks (`tests/goldenDrawLogs.test.js`) pinned
  the old framing: every frame of a video exported at 2× drawn at 2×, the
  pan in display pixels. DEF-61 recorded that export mode keeps the author's
  viewport but decided nothing on whether it should. Asked whether a video
  exported while zoomed should ignore the zoom or copy it (its pan converted
  to export pixels), the owner picked "Ignore the zoom (Recommended)". Those
  three checks now expect the camera, as in the same export at 1×, with the
  map, its mask and the route still under one transform.
- 2026-10-18 — Out of scope, a wish line: a selected waypoint's dashed
  selection box is drawn into video exports too.
- 2026-10-19 — Shipped in v3.3.725 (PR #158, merge `c5f707a`, deploy
  `3f3c2da`); see REL-725 for publication evidence and the live check.

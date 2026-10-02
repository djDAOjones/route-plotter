# Brief — Route Plotter

<!-- Owner-signed. Direction lives here and in the backlog; agents do
     not change it without a decision. Rule 1 reads Direction every
     session (under 150 words); the full brief is read at kick-off,
     after a substantial amendment, in the plan verb, and when
     Direction does not answer. The full brief below is the canon
     brief at 75ba7ae, carried verbatim on 2026-10-01. -->

## Direction

An animated route editor for maps and images — background image →
waypoints → animated path → export — for university educators (Gary
Priestnall, Nottingham geography), not a GIS tool, a drawing app or a
video editor. v3
is a layered scene over one master timeline: the hero route plus flow
layers of crowd animation, rendered as a pure function of (timelineMs,
projectState, seed). Pure JavaScript and Canvas 2D; two bundled runtime
dependencies; WCAG 2.2 AAA with Carbon productive UI in our own code and
Okabe-Ito for map data; Chromium-only for now. `main` is the live site:
branch, pull request, the owner merges and calls each release. The
current work is the big run from the 2026-09-22 abstraction plan under
the owner's standing delegation of 2026-09-28.

## What we are building

Route Plotter v3 — an animated route editor for maps and images. Users
drop in a background image, click to place waypoints, configure styles
and timing, and export as MP4, WebM, or a self-contained HTML file.

v3 extends the single narrative route into a **layered scene over one
master timeline**: the existing waypoint chain stays as the "hero route",
and new **flow layers** add particle/crowd animation — many dots
following guide networks (weighted, directed graphs) or the hero route
itself, with emitter controls for count, release window, onset/speed
variance, intensity ramp and lifecycle (absorbed from the archived
dot-crowd-navigator fork; spec in `specs/dot-crowd-navigator/`).

## Who it is for

University educators, students, and presentation makers who need
animated map or image overlays showing routes, processes, sequences, or
flows (people moving across a map, particles in a system). Primary user:
Gary Priestnall, University of Nottingham (geography/cartography).

## Platform and deployment

Web app. Single-page, client-side only. No server. Repo:
`djDAOjones/route-plotter` (fresh-history v3 line, founded 2026-08-17).
Deploys via GitHub Pages from `docs/` on `main` — live at
`djdaojones.github.io/route-plotter/` since Phase 5 (2026-08-19). The
frozen v2 line remains served from
`djdaojones.github.io/router-plotter-02/` for existing users.

## Core features (v1)

- Drag-and-drop background images with waypoint placement (major + minor)
- Catmull-Rom spline path with per-segment speed control
- Per-waypoint markers, beacons, text labels, area highlights, camera zoom
- Multiple visibility modes (path, waypoint, background)
- Video export (MP4/WebM via WebCodecs) and self-contained HTML export
- Auto-save to localStorage, project save/load as ZIP

## Constraints

- Pure JavaScript, no frameworks. Two bundled runtime dependencies:
  mediabunny (video mux) and jszip (project ZIPs). Nothing from CDNs.
- Canvas 2D rendering.
- **Deterministic timeline (v3 mandate):** the scene is a pure function
  of (timelineMs, projectState, seed) — no wall-clock or delta-time
  accumulated state in any renderer. Play/scrub/export share one
  evaluation path. See the canon decision log, 2026-08-17.
- npm + esbuild for bundling (target es2022; lockfile committed),
  Vitest for testing.
- WCAG 2.2 AAA is the product target; the semantic authoring model now ships,
  while REV-03/REV-05 track the remaining pointer-parity and assurance evidence
  before it can be claimed as verified support.
- IBM Carbon Design System for UI patterns (implemented, not installed).
- Okabe-Ito colour-blind safe palette for map data.
- UoN semantic design tokens for UI chrome.

## Out of scope

- Server-side storage or user accounts
- Multi-user collaboration
- GIS integration or georeferencing
- Mobile-native apps

## Decided foundations

- Split hero routes animate simultaneous branches on one master timeline;
  reconvergence waits for the latest branch and shared join effects fire once.
- Projects own a shipped reference render size: map-bound graphics scale from
  its short edge while normalised geometry and authored timing remain
  unchanged. Interactive label clamps protect editor legibility; exports use
  the exact reference scale.
- Public/share/support boundaries retain original project image bytes only in
  explicit saves/exports, use previewable redacted diagnostics, and publish
  under MIT with third-party notices and best-effort GitHub support.

## Open questions

- Whether "drop older" project formats reaches format 9 (the owner's
  pending confirmation, 2026-09-28); until he answers, format 9 keeps
  loading.

## Signed

- Owner (delegated, not reviewed): Joe, 2026-10-01 — see the maintainer's instruction of 2026-10-01 to run V3-FIELD on this project (the lab's V3-FIELD-2); the owner's reviewed line is due within two weeks (3.8)

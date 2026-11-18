# Brief — Route Plotter

<!-- Owner-signed. Direction lives here and in the backlog; agents do
     not change it without a decision. Rule 1 reads Direction every
     session (under 175 words); the full brief is read at kick-off,
     after a substantial amendment, in the plan verb, and when
     Direction does not answer. The full brief below is the canon
     brief at 75ba7ae, carried verbatim on 2026-10-01. -->

## Direction

An animated route editor for maps and images — background image →
waypoints → animated path → export — for university educators (Gary
Priestnall, Nottingham geography), not a GIS tool, a drawing app or a
video editor. v3 is frozen at 3.3.726. v4 is a new app at this
repository's root: a scene and its routes, with a core that is always
present and features an author adds, each feature a module; presets
are starting points. v3's engine is ported with its tests, and every
frame stays a pure function of (timelineMs, projectState, seed). The
editor is strict TypeScript with React and Carbon React; the exported
player has neither. WCAG 2.2 AAA; Okabe-Ito for map data; Chromium-only
for now. `main` is the live site: branch, pull request, the owner
orders each merge; once v4's core works end to end, each app merge
publishes until v4.0. The current work is the v4 programme (PLAN-5):
the architecture plan first, before any code.

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

v4, on the owner's answers of 2026-11-18:

- The core, always present: a scene (background, play and scrub, save
  and open, export) and a route (points, a styled line, a single lead)
  with waypoint labels, markers and pauses
- Features an author adds, to a route or to the scene, from an Add
  feature list; a crowd is one; the architecture plan lists the rest
  and where each lives
- Presets as starting points: Map route; document reveal; signal flow;
  annotated diagram; match-day crowd
- v4.0 is reached when one scene for each preset is made and exported
  in v4

v3, frozen at 3.3.726:

- Drag-and-drop background images with waypoint placement (major + minor)
- Catmull-Rom spline path with per-segment speed control
- Per-waypoint markers, beacons, text labels, area highlights, camera zoom
- Multiple visibility modes (path, waypoint, background)
- Video export (MP4/WebM via WebCodecs) and self-contained HTML export
- Auto-save to localStorage, project save/load as ZIP

## Constraints

- v4's editor is strict TypeScript with React 19 and Carbon React; the
  exported player is free of React and Carbon. v3, frozen, is pure
  JavaScript with no framework. mediabunny (video mux) and jszip
  (project ZIPs) are v3's two bundled runtime dependencies, carried
  into v4 by the port unless the architecture plan rules otherwise.
  Nothing from CDNs.
- Canvas 2D rendering.
- **Deterministic timeline (v3 mandate, kept in v4):** the scene is a pure function
  of (timelineMs, projectState, seed) — no wall-clock or delta-time
  accumulated state in any renderer. Play/scrub/export share one
  evaluation path. See the canon decision log, 2026-08-17.
- **Modules (v4):** each feature is a module that owns its settings,
  drawing, controls, save fields and tests; features talk through the
  core only; layers and module edges are enforced in the gate; the
  abstraction plan's §16 is applied to every new abstraction.
- npm with a committed lockfile; v4 builds with Vite, v3 with esbuild
  (target es2022); Vitest for testing.
- WCAG 2.2 AAA is the product target. v4 tests accessibility in its
  gate from the start (a real browser, axe and lint rules) and with a
  screen reader before v4.0 is declared; REV-03/REV-05 track the
  pointer-parity and assurance evidence before it can be claimed as
  verified support.
- IBM Carbon Design System for UI patterns: Carbon React installed in
  v4 and pushed to the AAA bar; implemented, not installed, in v3.
- Okabe-Ito colour-blind safe palette for map data.
- UoN semantic design tokens for UI chrome.
- v4 opens no v3 project file and leaves v3's browser autosaves alone;
  v3's files, exports and autosaves stay with v3.

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
  explicit saves/exports and in this browser's own recovery (its image store,
  with each file name, until Clear All; DEF-98), use previewable redacted
  diagnostics, and publish under MIT with third-party notices and best-effort
  GitHub support.

## Open questions

- None of the owner's is open on v3's formats: v3 is frozen and keeps
  opening formats 6 to 9, and v4 opens no v3 file (2026-11-18).
- For the architecture plan (MERGE-01) to bring to the owner: where
  each feature lives, scene or route; which pieces of v3's engine are
  not worth porting; whether v4 keeps browser storage keys of its own;
  and whether the Xerte copy's readiness is a condition for v4
  replacing v3 on Pages.

## Signed

- Owner: Joe, 2026-10-02.

# Project Brief

## What are we building?

Route Plotter — an animated route editor for maps and images. Users drop
in a background image, click to place waypoints, configure styles and
timing, and export as MP4, WebM, or a self-contained HTML file.

## Who is it for?

University educators and presentation makers who need animated map or
image overlays showing routes, processes, or sequences. Primary user:
Gary Priestnall, University of Nottingham (geography/cartography).

## Platform and deployment

Web app. Single-page, client-side only. No server. Deployed via GitHub
Pages from `docs/` on `main` branch.

## Core features (v1)

- Drag-and-drop background images with waypoint placement (major + minor)
- Catmull-Rom spline path with per-segment speed control
- Per-waypoint markers, beacons, text labels, area highlights, camera zoom
- Multiple visibility modes (path, waypoint, background)
- Video export (MP4/WebM via WebCodecs) and self-contained HTML export
- Auto-save to localStorage, project save/load as ZIP

## Constraints

- Pure JavaScript, no frameworks. Single runtime dependency: mediabunny.
- Canvas 2D rendering.
- npm + esbuild for bundling, Vitest for testing.
- WCAG 2.2 AAA accessibility.
- IBM Carbon Design System for UI patterns (implemented, not installed).
- Okabe-Ito colour-blind safe palette for map data.
- UoN semantic design tokens for UI chrome.

## Out of scope (for now)

- Server-side storage or user accounts
- Multi-user collaboration
- GIS integration or georeferencing
- Mobile-native apps

## Open questions

- None currently blocking.

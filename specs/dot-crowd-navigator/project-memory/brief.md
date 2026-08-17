# Project Brief

## What are we building?

**Dot Crowd Navigator** — a graph-based crowd-flow simulation tool. Users draw a network of nodes and weighted edges over a background image (typically a map or venue plan), then run a swarm of animated dots through that network. The tool visualises pedestrian or crowd flow patterns across a spatial network.

This is a rewrite of Route Plotter. Route Plotter was "draw one route and animate movement along it." Dot Crowd Navigator is "draw a route network and simulate many moving agents through it." The codebase retains Route Plotter's mature infrastructure (EventBus, coordinate transform, autosave, undo, Canvas 2D render loop, build/test/deploy, path math) but replaces the domain model entirely.

## Who is it for?

Researchers, urban planners, and event organisers who need to visualise crowd flow across a spatial network — typically over a map or floor plan image.

## Platform and deployment

Single-page web app. Pure JavaScript, Canvas 2D, esbuild bundler. Zero runtime dependencies. Deployed via GitHub Pages.

## Core features (v1 — Phase 1: Graph Editor MVP)

- Background image workflow (drag-drop, upload, example images, zoom, tint) — already implemented
- Graph model: `GraphNode`, `GraphEdge`, `GraphModel` with direction, weight, curve data, cached path geometry
- Graph editing: add/move/delete nodes, draw edges, add/move control points, select nodes or edges, edit edge weights and direction
- Entry/exit node designation (multiple entry/exit nodes supported)
- Edge weight preview (thickness-based visualisation)
- Per-edge path shaping: Catmull-Rom smoothing, reparameterisation, squiggle/randomised shapes
- Node labels (adapted from Route Plotter's waypoint label system)
- Save/load projects, autosave to localStorage

## Core features (v2 — Phase 2: Weighted Swarm Engine)

- Weighted branch selection at junctions (dot routing proportional to edge weights)
- Swarm simulation: configurable total dot count, release period, onset variance, speed variance
- Intensity ramp (start-to-end flow scaling)
- Dot behaviour: wobble/warble, lifecycle modes (disappear, respawn, loop, collect)
- Video export of simulation

## Constraints

- WCAG 2.2 AAA target (7:1 contrast, 44px targets, keyboard-operable, no colour-only meaning)
- Self-contained: no external CDN calls, no server-side dependencies
- Carbon-first UI design language (implemented to spec, not via Carbon packages)
- All coordinates stored normalised (image-relative), rendered via CoordinateTransform
- EventBus-only cross-module communication — no direct method calls between modules

## Out of scope (for now)

- Real-time data ingestion or live sensor feeds
- 3D or WebGL rendering
- Multi-user collaboration
- Server-side computation or storage
- Route Plotter-specific features removed during Phase 0: beacon rendering, motion visibility modes, camera keyframes, area highlight editing, custom image asset system, HTML export

## Open questions

- Exact lifecycle mode behaviours (disappear vs respawn vs loop vs collect) — to be designed during Phase 2 scoping
- Whether edge curve control points should support full Bézier or stay with Catmull-Rom + control points
- Video export codec strategy (WebM via MediaRecorder vs WebCodecs for broader format support)

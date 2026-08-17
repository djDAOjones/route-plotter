# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->
<!-- Agents: read Active tasks only. Completed section is for reference. -->

## Active

### Phase 1 — Remaining items

- [ ] Node labels — Adapt TextLabelService for graph nodes. Position labels relative to node, avoid overlap.
- [ ] Edge control points — Add/move control points on edges for curve shaping (Catmull-Rom curved edges).
- [ ] Undo/redo for graph — Hook GraphModel mutations into UndoService stack for proper undo history.
- [ ] Delete legacy files — Remove `main_legacy.js`, `index_legacy.html`, and legacy service/model/controller files from `src/`. Currently unused but still present on disk.

### Phase 1F — Documentation

- [ ] Update README.md — Replace Route Plotter feature docs with Dot Crowd Navigator description, architecture, usage, and graph-editing instructions.

### Phase 2 — Remaining items

- [ ] Intensity ramp — Start-to-end flow scaling (gradual build-up of dot count).
- [ ] Dot visual options — Configurable shape, colour per-dot, wobble/warble effects.
- [ ] Curved edge paths — Dots follow Catmull-Rom curves instead of straight lines.
- [ ] Video export — Record simulation to downloadable video via VideoExporter.

### Icebox

- [ ] Per-edge path shaping UI — Squiggle amplitude, randomised jitter, tension controls per edge.
- [ ] Fullscreen simulation view — Hide UI, show only canvas at full viewport.
- [ ] Heatmap overlay — Aggregate dot density over time and render as a heatmap layer.
- [ ] Import/export graph as standard format — GeoJSON, GraphML, or similar for interop.
- [ ] Multi-scenario comparison — Run and compare different weight configurations side by side.

---

## Completed

- [x] Fork Route Plotter codebase into Dot Crowd Navigator repo.
- [x] Retain shared infrastructure: EventBus, CoordinateTransform, StorageService, UndoService, PathCalculator, CatmullRom, Easing, SwatchPicker, UI components, tokens.
- [x] Keep background image workflow (drag-drop, upload, example images, zoom, tint).
- [x] Stub play/save/load controls for later phases.
- [x] Adopt PM Skills framework and populate project memory.
- [x] Rename identity — package.json, README.md, main.js, constants.js.
- [x] GraphNode model — id, normalised position, type, label, toJSON/fromJSON, 14 unit tests.
- [x] GraphEdge model — id, sourceId, targetId, weight, direction, control points, toJSON/fromJSON, 23 unit tests.
- [x] GraphModel — Collection class with CRUD, referential integrity, adjacency queries, serialisation, 25 unit tests (added clear + instance fromJSON).
- [x] GraphRenderer — Render nodes as circles, edges as straight lines, weight as thickness. Selection highlights, entry/exit badges (E/X letters), one-way direction arrows. Wired to canvas via CoordinateTransform.
- [x] Replace ai_project_manager_kickstart with PM Skills framework.
- [x] Phase 0B — Clean app shell. Rewrote main.js (6065→~400 lines) and index.html (853→~180 lines). Legacy code moved to `main_legacy.js` / `index_legacy.html` for reference; not imported.
- [x] Phase 1B — Selection rendering. Blue ring on selected node, highlight on selected edge.
- [x] Phase 1C — GraphInteractionHandler. Click-to-add nodes, click+drag to move, shift-click to draw edges, delete/backspace to remove, double-click to cycle type, escape to deselect.
- [x] Phase 1D — GraphUIController. Sidebar: node properties (type, position, id), edge properties (weight slider, direction toggle), status bar, empty-state instructions.
- [x] Phase 1E (partial) — Save/load JSON project files. Autosave graph to localStorage (coordVersion 8). Background overlay persisted.
- [x] Build target updated (chrome58→chrome90, firefox57→firefox90, safari11→safari15) to fix destructuring transform errors.
- [x] Phase 2 (core) — SimulationState model (9 tests), SwarmEngine (7 tests, weighted routing, 4 lifecycle modes), DotRenderer, simulation controls UI (play/pause/reset, dot count, speed, lifecycle).
- [x] Wheel zoom + middle-button/Cmd-drag pan on canvas.
- [x] Undo/redo wiring — graph state snapshots saved to UndoService, buttons enable/disable.

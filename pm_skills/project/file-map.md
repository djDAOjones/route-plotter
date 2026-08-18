# File Map

## Entry point

- `index.html` — Single-page app shell (sidebar + canvas + controls)
- `src/main.js` — RoutePlotter class: app entry + orchestrator core (constructor, init, model bookkeeping, render scheduling); attaches the `src/app/*` mixins to its prototype

## App mixins (RoutePlotter prototype method groups — `this` = the app instance; names must stay unique across all mixins)

- `src/app/wiringDom.js` — setupEventListeners(): DOM control wiring
- `src/app/wiringBus.js` — EventBus + AnimationEngine subscription wiring
- `src/app/wiringControllers.js` — UIController/InteractionHandler event connections
- `src/app/undoRedo.js` — undo/redo snapshots, restore, global-style UI sync
- `src/app/playback.js` — keyboard dispatch, transport, JKL, preview mode, render loop, time display
- `src/app/camera.js` — camera keyframe UI, camera state evaluation, zoom-transition warnings
- `src/app/viewport.js` — canvas aspect/bounds, coordinate conversion, manual zoom
- `src/app/pathTiming.js` — path recalc, easing, segment/leg timing, duration updates
- `src/app/persistence.js` — project save/load, autosave/restore, dirty-title indicator
- `src/app/exporting.js` — export mode enter/exit, video/HTML export flows, summary UI
- `src/app/editorPanel.js` — waypoint list + editor panel sync, control-visibility helpers
- `src/app/pointer.js` — canvas pointer fallbacks and hit-testing

## Core modules

- `src/core/EventBus.js` — Pub-sub event system
- `src/core/PlayerCore.js` — Pure timeline math (deterministic-timeline mandate): segment/pause/beacon-schedule builders + timeline↔path mappings; one evaluation path shared by play, scrub, and export
- `src/models/Waypoint.js` — Waypoint data model (normalised coords, style, camera, area)
- `src/models/AnimationState.js` — Playback state (progress, timing, pause tracking)
- `src/models/ImageAsset.js` — Custom image references (marker, path head)
- `src/models/GraphNode.js` — Flow-network node (normalised pos, entry/exit type)
- `src/models/GraphEdge.js` — Weighted directed edge with control points
- `src/models/GraphModel.js` — Node/edge collection: CRUD, referential integrity, adjacency (owned by FlowLayer)
- `src/models/Emitter.js` — Dot-stream params + per-emitter seed (release window, lifecycle, wobble…) — no runtime state
- `src/models/FlowLayer.js` — Guide network (own graph or hero route) + emitters; visible, guideType
- `src/models/Scene.js` — Ordered flow layers (drawn beneath the hero route); serialises as the coordVersion 9 `scene` block

## Services

- `src/services/AnimationEngine.js` — Transport (play/pause/seek/reverse), wait-event edge-detection; all timeline mapping delegates to PlayerCore; marker fields keep their serialised shapes
- `src/services/PathCalculator.js` — Catmull-Rom spline, corner-slowing reparameterisation, curvature; `legTimingLengths()` gives per-major-leg timing lengths (progress-span basis)
- `src/services/RenderingService.js` — Canvas drawing: path, markers, labels, overlays; static `glowLayers()` computes the path-glow underlay strokes; static `VECTOR_LAYERS` registry drives the vector draw order (the `flow-layers` entry draws swarms beneath the hero route)
- `src/services/SwarmEngine.js` — Deterministic flow-layer dot evaluator: pure `evaluate(timelineMs, layer, context)`, `hash(seed, dotIndex, hopIndex)` variation, weighted graph walks, four lifecycle modes, per-edge PathCalculator caches (Phase 3)
- `src/services/DotRenderer.js` — Batched swarm-dot drawing: one canvas path per (colour, size) group, sizes via `scaleSizeClamped()` (Phase 3)
- `src/services/BeaconRenderer.js` — Animated waypoint effects (ripple, glow, pop, grow, pulse); closed-form: each animator's `sync(localSec, win, options)` derives state from a timeline-local clock (schedules from PlayerCore via `engine.beaconSchedules`)
- `src/services/TextLabelService.js` — Text label layout, fade, auto-positioning
- `src/services/MotionVisibilityService.js` — Path/waypoint/background visibility calculations
- `src/services/CameraService.js` — Per-major-waypoint zoom with continuous interpolation; `toMajorKeyframes()` drops minors (minors shape geometry, not zoom)
- `src/services/CoordinateTransform.js` — Image ↔ canvas coordinate conversion
- `src/services/VideoExporter.js` — MP4/WebM export (WebCodecs + mediabunny)
- `src/services/HTMLExportService.js` — Self-contained HTML export with embedded player
- `src/services/ImageAssetService.js` — Custom image management and deduplication
- `src/services/StorageService.js` — localStorage with debounce and change detection
- `src/services/UndoService.js` — 150-step undo/redo history
- `src/services/AreaDrawingService.js` — Polygon area drawing mode
- `src/services/AreaEditService.js` — Area highlight repositioning and vertex editing
- `src/services/AreaHighlightRenderer.js` — Per-waypoint area highlight rendering

## UI

- `src/controllers/UIController.js` — Sidebar controls, waypoint list, slider sync
- `src/controllers/SectionController.js` — Collapsible settings sections
- `src/components/SwatchPicker.js` — Okabe-Ito colour-blind safe palette picker
- `src/components/Dropdown.js` — Accessible dropdown menus
- `src/components/ContextMenu.js` — Right-click menu (canvas waypoints + empty canvas): Carbon menu anatomy, arrow-key navigation, aria-disabled reasons, focus restore (Phase 3.5)
- `src/components/Tooltip.js` — Tooltip attachment
- `src/components/ParamTooltip.js` — Click-label parameter tooltips (Carbon pattern)
- `src/handlers/InteractionHandler.js` — Mouse, keyboard, touch, drag-and-drop input

## Styles and tokens

- `styles/tokens.css` — Design tokens: UoN palette, Okabe-Ito map palette, semantic colours, spacing
- `styles/main.css` — Core layout, sidebar, canvas, controls, modals
- `styles/swatch-picker.css` — Swatch picker grid (5×2, 44px AAA touch targets)
- `styles/dropdown.css` — Dropdown component styles
- `styles/context-menu.css` — Context menu styles (UoN tokens, 44px AAA targets)
- `styles/tooltip.css` — Tooltip styles

## Config and constants

- `src/config/constants.js` — All tuneable values (animation, rendering, path, etc.)
- `src/config/keybindings.js` — Mouse + keyboard bindings (customisable via localStorage)
- `src/config/helpContent.js` — Welcome modal and inline help HTML generators
- `src/config/tooltips.js` — Tooltip definitions

## Utils

- `src/utils/CatmullRom.js` — Catmull-Rom spline interpolation
- `src/utils/Easing.js` — Easing functions (linear, quad, cubic, etc.)
- `src/utils/focusTrap.js` — Modal focus trapping for accessibility
- `src/utils/snapToAngle.js` — Angle-snap geometry for shift-drag waypoint placement (moved out of main.js in the Phase 1 split)
- `src/utils/pathWidthScale.js` — Log-scale thickness slider ↔ width (1–40px) mapping; single source shared by the DOM wiring and UIController bulk edits (Phase 3.5)

## Specs (reference, not live code)

- `specs/dot-crowd-navigator/` — archived fork material: spec docs, the fork's pm_skills project memory, salvaged SwarmEngine/SimulationState test suites (behavioural spec only — tick() API superseded), and recovered graph-editor source for Phase 4 pattern mining. See its README.md.

## Tests

- `tests/example.test.js` — Unit tests (Waypoint, AnimationState, Path, EventBus, etc.)
- `tests/units.test.js` — Extended unit coverage (state transitions, coordinate round-trips, path maths, waypoint serialisation/inheritance)
- `tests/mixins.test.js` — Mixin split guards: cross-mixin name-collision check, cluster spot-checks, snapToAngle unit tests
- `tests/vectorLayers.test.js` — VECTOR_LAYERS registry: canonical order + per-layer visibility-guard dispatch
- `tests/playerCore.test.js` — PlayerCore builders, pause budgets, timeline windows, inverse mappings
- `tests/goldenFrames.test.js` — Scrub-vs-play golden harness: sequential/reverse/export-step == direct seek (full scene state incl. beacons); evaluation never mutates the timeline
- `tests/swarmEngine.test.js` — SwarmEngine behavioural spec: hash pins, call-order-free determinism, release windows/ramps, weighted junctions, four lifecycle modes, route guide, wobble bounds, edge-cache invalidation
- `tests/setup.js` — Vitest jsdom setup (uses defineProperty for getter-only jsdom globals)

## Build and tooling

- `build.js` — esbuild bundler, version management, dev server
- `push.js` — GitHub Pages deploy helper
- `scripts/restart.sh` — maintainer wrapper: free port 3000 → boot dev → verify HTTP 200 (`--hard-reset`, `--help`)
- `scripts/build.sh` — maintainer wrapper: `npm run build` into docs/ (`--test`, `--help`)
- `scripts/README.md` — usage reference for the maintainer scripts
- `version.json` — Auto-incremented build number
- `package.json` — Project metadata and scripts

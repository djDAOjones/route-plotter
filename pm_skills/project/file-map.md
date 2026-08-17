# File Map

## Entry point

- `index.html` — Single-page app shell (sidebar + canvas + controls)
- `src/main.js` — RoutePlotter class: app entry, orchestrator, all event handling

## Core modules

- `src/core/EventBus.js` — Pub-sub event system
- `src/models/Waypoint.js` — Waypoint data model (normalised coords, style, camera, area)
- `src/models/AnimationState.js` — Playback state (progress, timing, pause tracking)
- `src/models/ImageAsset.js` — Custom image references (marker, path head)

## Services

- `src/services/AnimationEngine.js` — Playback loop, timing, per-major-leg segment speed, pause markers
- `src/services/PathCalculator.js` — Catmull-Rom spline, corner-slowing reparameterisation, curvature; `legTimingLengths()` gives per-major-leg timing lengths (progress-span basis)
- `src/services/RenderingService.js` — Canvas drawing: path, markers, labels, overlays; static `glowLayers()` computes the path-glow underlay strokes
- `src/services/BeaconRenderer.js` — Animated waypoint effects (ripple, glow, pop, grow, pulse)
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
- `src/components/Tooltip.js` — Tooltip attachment
- `src/components/ParamTooltip.js` — Click-label parameter tooltips (Carbon pattern)
- `src/handlers/InteractionHandler.js` — Mouse, keyboard, touch, drag-and-drop input

## Styles and tokens

- `styles/tokens.css` — Design tokens: UoN palette, Okabe-Ito map palette, semantic colours, spacing
- `styles/main.css` — Core layout, sidebar, canvas, controls, modals
- `styles/swatch-picker.css` — Swatch picker grid (5×2, 44px AAA touch targets)
- `styles/dropdown.css` — Dropdown component styles
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

## Tests

- `tests/example.test.js` — Unit tests (Waypoint, AnimationState, Path, EventBus, etc.)
- `tests/units.test.js` — Extended unit coverage (state transitions, coordinate round-trips, path maths, waypoint serialisation/inheritance)
- `tests/setup.js` — Vitest jsdom setup (uses defineProperty for getter-only jsdom globals)

## Build and tooling

- `build.js` — esbuild bundler, version management, dev server
- `push.js` — GitHub Pages deploy helper
- `scripts/restart.sh` — maintainer wrapper: free port 3000 → boot dev → verify HTTP 200 (`--hard-reset`, `--help`)
- `scripts/build.sh` — maintainer wrapper: `npm run build` into docs/ (`--test`, `--help`)
- `scripts/README.md` — usage reference for the maintainer scripts
- `version.json` — Auto-incremented build number
- `package.json` — Project metadata and scripts

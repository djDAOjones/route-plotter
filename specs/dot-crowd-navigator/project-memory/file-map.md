# File Map

<!-- Format: path — role or responsibility -->
<!-- Update when files are created, renamed, or deleted. -->

## Entry point

- `index.html` — App shell, sidebar (background + graph property panels) + canvas layout.
- `src/main.js` — DotCrowdNavigator orchestrator (~400 lines). Bootstraps EventBus, CoordinateTransform, StorageService, UndoService, GraphModel, GraphRenderer, GraphInteractionHandler, GraphUIController. Handles canvas, background images, coordinate pipeline, rendering, persistence.

## Core modules

- `src/core/EventBus.js` — Pub/sub event system. All cross-module communication.
- `src/services/CoordinateTransform.js` — Normalised ↔ canvas coordinate mapping.
- `src/services/StorageService.js` — Autosave to localStorage, save/load JSON.
- `src/services/UndoService.js` — Undo/redo stack for user-facing mutations.
- `src/services/GraphRenderer.js` — Renders graph nodes, edges, selection highlights, type badges, direction arrows. Stateless.
- `src/services/PathCalculator.js` — Catmull-Rom spline generation. To be adapted for per-edge curved paths.
- `src/services/TextLabelService.js` — Text labels on canvas. To be adapted for graph node labels.
- `src/services/SwarmEngine.js` — Dot swarm simulation: spawning, weighted routing, movement, lifecycle modes (disappear/respawn/loop/collect).
- `src/services/DotRenderer.js` — Paints swarm dots as filled circles with outlines. Stateless per frame.
- `src/services/VideoExporter.js` — Canvas → video export. Deferred.

## Models

- `src/models/GraphNode.js` — Graph node data model: id, normalised position, type, label, toJSON/fromJSON.
- `src/models/GraphEdge.js` — Graph edge data model: id, sourceId, targetId, weight, direction, control points, toJSON/fromJSON.
- `src/models/GraphModel.js` — Graph collection: node/edge CRUD, clear, referential integrity, adjacency queries, toJSON/fromJSON (static + instance).
- `src/models/SimulationState.js` — Simulation parameters: dotCount, releasePeriod, speed, speedVariance, dotSize, dotColor, lifecycleMode. toJSON/fromJSON.

## Controllers

- `src/controllers/GraphUIController.js` — Sidebar controls for graph editing: node type/position, edge weight/direction, status bar, empty state instructions.

## Handlers

- `src/handlers/GraphInteractionHandler.js` — Mouse/keyboard input for graph editing: click-to-add, drag-to-move, shift-click-to-connect, delete, double-click type cycle, escape deselect.

## UI components

- `src/components/Tooltip.js` — Tooltip component.
- `src/components/ParamTooltip.js` — Parameter-specific tooltip.
- `src/components/Dropdown.js` — Dropdown menu component.
- `src/components/SwatchPicker.js` — Colour picker (Okabe-Ito palette).

## Utilities

- `src/utils/CatmullRom.js` — Catmull-Rom spline math.
- `src/utils/Easing.js` — Easing functions for animation.
- `src/utils/focusTrap.js` — Modal focus trapping for accessibility.
- `src/utils/index.js` — Barrel export for utils.

## Config and constants

- `src/config/constants.js` — All tuneable values (animation, rendering, interaction, etc.).
- `src/config/keybindings.js` — Mouse + keyboard bindings (customisable via localStorage).
- `src/config/helpContent.js` — Welcome/help modal content.
- `src/config/tooltips.js` — Tooltip text definitions.

## Styles

- `styles/tokens.css` — Design tokens (UoN palette, Carbon-aligned spacing/colour/type).
- `styles/main.css` — Core layout and component styles.
- `styles/swatch-picker.css` — Colour picker styles.
- `styles/dropdown.css` — Dropdown styles.
- `styles/tooltip.css` — Tooltip styles.

## Tests

- `tests/example.test.js` — Infrastructure tests (EventBus, Waypoint, PathCalculator, etc.).
- `tests/GraphNode.test.js` — GraphNode model unit tests (14 tests).
- `tests/GraphEdge.test.js` — GraphEdge model unit tests (23 tests).
- `tests/GraphModel.test.js` — GraphModel collection unit tests (25 tests).
- `tests/SimulationState.test.js` — SimulationState model unit tests (9 tests).
- `tests/SwarmEngine.test.js` — SwarmEngine simulation unit tests (7 tests).

## Build and tooling

- `build.js` — esbuild build script (dev server + production build).
- `package.json` — Project metadata, scripts, dependencies.
- `.editorconfig` — Code style rules (indent, line endings, etc.).

## Project management

- `AGENTS.md` — AI agent behavioral contract (project root).
- `UI-STANDARDS.md` — UI/accessibility standards (project root).
- `DEV-INFRASTRUCTURE.md` — Build, dev server, versioning, scripts (project root).
- `pm_skills/project/` — Living project memory (brief, architecture, backlog, etc.).
- `pm_skills/prompts/` — Reusable task prompts.
- `pm_skills/integrations/` — Tool-specific workflows (feature, bugfix, init).

## Legacy (on disk but NOT imported — safe to delete)

- `src/main_legacy.js` — The original 6065-line Route Plotter main.js. Kept as reference.
- `index_legacy.html` — The original 853-line Route Plotter index.html. Kept as reference.
- `src/services/AnimationEngine.js`, `RenderingService.js`, `CameraService.js`, `BeaconRenderer.js`, `MotionVisibilityService.js`, `HTMLExportService.js`, `ImageAssetService.js`, `AreaDrawingService.js`, `AreaEditService.js`, `AreaHighlightRenderer.js` — Route Plotter services. Not imported.
- `src/models/Waypoint.js`, `AnimationState.js`, `ImageAsset.js` — Route Plotter models. Not imported.
- `src/controllers/UIController.js`, `SectionController.js` — Route Plotter controllers. Not imported.
- `src/handlers/InteractionHandler.js` — Route Plotter interaction handler. Not imported.
- `src/services/PathCalculatorWithWorker.js`, `src/workers/pathWorker.js` — Legacy web worker path calc. Not imported.

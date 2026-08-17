# Architecture

<!-- Generated during kickstart adoption. Reflects the existing codebase -->
<!-- (Phase 0 — retained Route Plotter infra) plus planned additions.   -->
<!-- Update this file when major structural decisions change.            -->

## Tech stack

| Choice | Reason |
| --- | --- |
| **Vanilla JS (ES modules)** | Inherited from Route Plotter. Self-contained, zero runtime deps. |
| **esbuild** | Fast bundler, used for production builds (`build.js`). Dev via `--watch --serve`. |
| **HTML Canvas 2D API** | All rendering — background image, graph overlay, dot swarm animation. |
| **CSS Custom Properties** | Tokenised design system (`tokens.css`) aligned to Carbon conventions without Carbon packages. Uses UoN + Okabe-Ito palettes. |
| **Vitest** | Unit testing. Existing tests cover retained shared infrastructure. |
| **localStorage** | Client-side autosave. Full save/load via JSON download/import. |
| **MediaRecorder / WebCodecs** | Native browser video export — no server, no ffmpeg. WebCodecs path available for broader format support. |

## Project structure (current)

```text
dot-crowd-navigator/
├── index.html                     — app shell, sidebar + canvas layout
├── build.js                       — esbuild build script
├── package.json                   — dev deps: esbuild, vitest, jsdom
├── src/
│   ├── main.js                    — DotCrowdNavigator app class (orchestrator)
│   ├── config/
│   │   ├── constants.js           — all tuneable values
│   │   ├── keybindings.js         — mouse + keyboard bindings
│   │   ├── helpContent.js         — welcome modal content
│   │   └── tooltips.js            — tooltip definitions
│   ├── core/
│   │   └── EventBus.js            — pub/sub event system
│   ├── models/                    — [ROUTE PLOTTER LEGACY — to be replaced]
│   │   ├── Waypoint.js            — → replaced by GraphNode
│   │   ├── AnimationState.js      — → replaced by SimulationState
│   │   └── ImageAsset.js          — retained (background images)
│   ├── services/
│   │   ├── CoordinateTransform.js — retained: normalised ↔ canvas coords
│   │   ├── StorageService.js      — retained: autosave, save/load
│   │   ├── UndoService.js         — retained: undo/redo stack
│   │   ├── PathCalculator.js      — retained: to be adapted for per-edge paths
│   │   ├── PathCalculatorWithWorker.js — legacy: web worker wrapper
│   │   ├── TextLabelService.js    — retained: to be adapted for node labels
│   │   ├── VideoExporter.js       — deferred: Phase 2
│   │   ├── AnimationEngine.js     — [LEGACY — replaced by SwarmEngine]
│   │   ├── RenderingService.js    — [LEGACY — replaced by GraphRenderer]
│   │   ├── CameraService.js       — [LEGACY — still present, to be removed]
│   │   ├── BeaconRenderer.js      — [LEGACY — still present, to be removed]
│   │   ├── MotionVisibilityService.js — [LEGACY — still present, to be removed]
│   │   ├── HTMLExportService.js   — [LEGACY — still present, to be removed]
│   │   ├── ImageAssetService.js   — [LEGACY — still present, to be removed]
│   │   ├── AreaDrawingService.js   — [LEGACY — still present, to be removed]
│   │   ├── AreaEditService.js      — [LEGACY — still present, to be removed]
│   │   ├── AreaHighlightRenderer.js — [LEGACY — still present, to be removed]
│   │   └── index.js               — barrel export (legacy)
│   ├── controllers/               — [LEGACY — to be replaced]
│   │   ├── UIController.js        — → replaced by graph-aware UI controller
│   │   └── SectionController.js   — → replaced or adapted
│   ├── handlers/                  — [LEGACY — to be replaced]
│   │   └── InteractionHandler.js  — → replaced by GraphInteractionHandler
│   ├── components/
│   │   ├── SwatchPicker.js        — retained: colour picker
│   │   ├── Dropdown.js            — retained: dropdown menus
│   │   ├── Tooltip.js             — retained: tooltips
│   │   └── ParamTooltip.js        — retained: parameter tooltips
│   ├── utils/
│   │   ├── CatmullRom.js          — retained: spline math
│   │   ├── Easing.js              — retained: easing functions
│   │   ├── focusTrap.js           — retained: modal focus trapping
│   │   └── index.js               — barrel export
│   └── workers/
│       └── pathWorker.js          — [LEGACY — still present, to be removed]
├── styles/
│   ├── tokens.css                 — design tokens (UoN palette, Carbon-aligned)
│   ├── main.css                   — core layout and components
│   ├── swatch-picker.css          — colour picker styles
│   ├── dropdown.css               — dropdown styles
│   └── tooltip.css                — tooltip styles
├── tests/
│   └── example.test.js            — infrastructure tests (EventBus, etc.)
├── docs/                          — GitHub Pages build output (read-only)
├── AGENTS.md                      — AI agent behavioral contract
├── UI-STANDARDS.md                — UI/accessibility standards
├── DEV-INFRASTRUCTURE.md           — build, dev server, versioning rules
└── pm_skills/                     — project management framework
    ├── project/                   — living project memory
    ├── prompts/                   — reusable task prompts
    └── integrations/              — tool-specific workflows
```

## Planned new modules (Phase 1)

| Module | Planned path | Responsibility |
| --- | --- | --- |
| **GraphNode** | `src/models/GraphNode.js` | Node data model: id, position (normalised), type (normal/entry/exit), label config, `toJSON`/`fromJSON`. |
| **GraphEdge** | `src/models/GraphEdge.js` | Edge data model: id, source/target node ids, weight, direction, control points, curve data, cached path geometry, `toJSON`/`fromJSON`. |
| **GraphModel** | `src/models/GraphModel.js` | Collection of nodes and edges. CRUD operations, adjacency queries, serialisation. Single source of truth for graph state. |
| **GraphRenderer** | `src/services/GraphRenderer.js` | Renders nodes, edges, weight previews, selection highlights, and labels onto canvas. Replaces RenderingService. |
| **GraphInteractionHandler** | `src/handlers/GraphInteractionHandler.js` | Mouse/keyboard handling for graph editing: add/move/delete nodes, draw edges, select, control points. Replaces InteractionHandler. |
| **GraphUIController** | `src/controllers/GraphUIController.js` | Sidebar controls for graph editing: node properties, edge weight/direction, entry/exit toggles. Replaces UIController. |

## Planned new modules (Phase 2)

| Module | Planned path | Responsibility |
| --- | --- | --- |
| **SimulationState** | `src/models/SimulationState.js` | Simulation parameters: dot count, release period, onset variance, speed variance, intensity ramp, lifecycle mode. |
| **SwarmEngine** | `src/services/SwarmEngine.js` | Runs the dot simulation: spawns dots at entry nodes, routes through weighted edges, applies variance and lifecycle rules. |
| **DotRenderer** | `src/services/DotRenderer.js` | Paints individual dots with wobble/warble effects. Separated from graph rendering for performance. |

## Retained infrastructure (from Route Plotter)

| Module | Path | Status |
| --- | --- | --- |
| **EventBus** | `src/core/EventBus.js` | Retained as-is. All cross-module communication. |
| **CoordinateTransform** | `src/services/CoordinateTransform.js` | Retained. Normalised ↔ canvas coordinate mapping. |
| **StorageService** | `src/services/StorageService.js` | Retained. Autosave + save/load. |
| **UndoService** | `src/services/UndoService.js` | Retained. Undo/redo stack. |
| **PathCalculator** | `src/services/PathCalculator.js` | Retained. Still single-route; to be adapted for per-edge paths. |
| **TextLabelService** | `src/services/TextLabelService.js` | Retained. Still waypoint labels; to be adapted for node labels. |
| **SwatchPicker** | `src/components/SwatchPicker.js` | Retained. Colour picker. |
| **CatmullRom** | `src/utils/CatmullRom.js` | Retained. Spline interpolation. |
| **Easing** | `src/utils/Easing.js` | Retained. Animation easing curves. |
| **VideoExporter** | `src/services/VideoExporter.js` | Deferred to Phase 2. |

## Communication patterns

All cross-module communication uses **EventBus** with colon-separated namespaces:

- **`graph:node:added` / `:moved` / `:deleted`** — graph model changes → renderer + UI sync.
- **`graph:edge:added` / `:updated` / `:deleted`** — edge changes → renderer re-renders weight previews.
- **`graph:selection:changed`** — user selected a node or edge → sidebar shows properties.
- **`ui:controls:change`** — a parameter changed → model updates → renderer re-renders.
- **`sim:swarm:start` / `:tick` / `:end`** — simulation lifecycle → renderer animates dots.
- **`export:video:progress` / `:complete`** — export status → toolbar shows progress/download.
- **`app:project:loaded`** — full state refresh after load.
- **`app:background:changed`** — background image loaded → canvas resized.

**Data flow:** UI → event → Model (validates, stores) → event → Renderer / UI consumers.

No direct method calls between modules. Modules only import EventBus and their own data models.

## Dependency policy

| Category | Rule |
| --- | --- |
| **Runtime packages** | Minimal. Currently one: `mediabunny` (video export). Browser APIs otherwise. |
| **Dev tooling** | esbuild (bundler), Vitest (tests), jsdom (test DOM). |
| **New dependencies** | Any new runtime dependency requires explicit approval and documented justification. |
| **Fonts** | Self-hosted or system fonts only — no external CDN calls. |
| **Polyfills** | Only if a target browser lacks Canvas 2D or MediaRecorder. Requires approval. |

# File Map

<!-- file-map-index -->
<!-- 214 file(s) across 12 section(s); regenerate with pm_skills/scaffold/gen-file-map.mjs -->
- `(root)` — 11 file(s)
- `.devin` — 2 file(s)
- `.github` — 1 file(s)
- `_Joe` — 45 file(s)
- `docs` — 21 file(s)
- `examples` — 1 file(s)
- `images` — 7 file(s)
- `scripts` — 3 file(s)
- `specs` — 15 file(s)
- `src` — 71 file(s)
- `styles` — 6 file(s)
- `tests` — 31 file(s)
<!-- /file-map-index -->

## (root)

- `AGENTS.md` — Project-wide agent contract: product boundaries, invariants, workflow, documentation and memory rules
- `DEV-INFRASTRUCTURE.md` — Canonical build, test, version, deployment and owned-runtime lifecycle contract
- `README.md` — Product overview, user/developer quick start, architecture, persistence/export behaviour and glossary
- `Route Plotter v3.code-workspace` — VS Code workspace definition for this repository
- `UI-STANDARDS.md` — Carbon-first UI, UoN/Okabe-Ito token and WCAG 2.2 AAA interaction contract
- `build.js` — esbuild/watch server plus clean staged production builds, explicit Pages allowlist, versioned static references and non-mutating build checks
- `index.html` — Single-page app shell (sidebar + canvas + controls)
- `package.json` — Project metadata and scripts
- `push.js` — Clean-tree, current-branch Pages deploy helper with argv-safe commits and a non-mutating dry run
- `version.json` — Auto-incremented build number
- `vitest.config.js` — Vitest jsdom configuration, setup binding and test-file selection

## .devin

- `.devin/workflows/bugfix.md` — Devin adapter for the repository's pm-skills bug-fix workflow
- `.devin/workflows/feature.md` — Devin adapter for the repository's pm-skills feature workflow

## .github

- `.github/workflows/ci.yml` — Read-only Node CI: frozen install plus the canonical test/build/restart-safety gate

## _Joe

- `_Joe/design docs/Colour.html` — Maintainer-owned colour exploration reference; not application source
- `_Joe/design docs/UI Audit - Carbon + Nielsen.md` — Maintainer-owned Carbon/Nielsen UI audit reference
- `_Joe/design docs/UI from ChatGPT` — Maintainer-owned saved UI design discussion
- `_Joe/design docs/saved/Archive/automatic_version_display_with_server.md` — Archived version-display/server design note
- `_Joe/design docs/saved/Archive/route_plotter_v3_styling_pack spec/route_plotter_v3_components_uon_carbon.css` — Archived UoN/Carbon component-style proposal
- `_Joe/design docs/saved/Archive/route_plotter_v3_styling_pack spec/route_plotter_v3_tokens_uon_carbon.css` — Archived UoN/Carbon design-token proposal
- `_Joe/design docs/saved/Archive/route_plotter_v3_styling_pack spec/route_plotter_v3_uon_integrated_design_system.md` — Archived integrated UoN design-system specification
- `_Joe/design docs/saved/Archive/route_plotter_v3_swatch_picker spec/route_plotter_v3_map_ink_tokens_optional.css` — Archived optional map-ink token proposal
- `_Joe/design docs/saved/Archive/route_plotter_v3_swatch_picker spec/route_plotter_v3_swatch_picker.css` — Archived swatch-picker CSS prototype
- `_Joe/design docs/saved/Archive/route_plotter_v3_swatch_picker spec/route_plotter_v3_swatch_picker.js` — Archived swatch-picker JavaScript prototype
- `_Joe/design docs/saved/Archive/route_plotter_v3_swatch_picker spec/route_plotter_v3_swatch_picker_spec.md` — Archived swatch-picker interaction specification
- `_Joe/design docs/saved/Archive/route_plotter_v3_swatch_picker spec/swatch_picker_demo.html` — Archived standalone swatch-picker demo
- `_Joe/design docs/saved/Archive/route_plotter_v3_wcag_aaa_intent_consolidated.md` — Archived consolidated WCAG AAA intent
- `_Joe/design docs/saved/UoN Colours from UoN ER.html` — Saved UoN colour-source evidence
- `_Joe/design docs/saved/WAVE Report of Route Plotter v3.1.506.html` — Saved WAVE accessibility report for an earlier build
- `_Joe/design docs/saved/route_plotter_v3_1_400_ux_wcag_aaa_review.md` — Saved UX/WCAG AAA review of an earlier build
- `_Joe/design docs/saved/ui_list.md` — Maintainer-owned inventory of UI elements
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.35.38 1440x900.png` — Archived 1440×900 baseline UI audit screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.35.43 1440x900 Keyboard shortcuts expanded but not brililant visual cue they are below or expanded.png` — Archived keyboard-shortcuts disclosure screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.35.53 scrolled down to show shortcuts.png` — Archived scrolled keyboard-shortcuts screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.36.00 scrolled to end of shortcuts.png` — Archived end-of-shortcuts screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.39.51 waypoints initially placed.png` — Archived initial-waypoint state screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.40.46 mid play.png` — Archived mid-playback screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.41.10 all left sidebar expanded using full page image capture plugin.png` — Archived full-page expanded-sidebar screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.41.10 all left sidebar expanded.png` — Archived expanded-sidebar viewport screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.42.40 export drop down clicked.png` — Archived Export-menu screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.42.43 examples drop down clicked.png` — Archived Examples-menu screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.43.05 edit switch toggled - warning message causes new line on title.png` — Archived Edit-toggle/header-wrap defect screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.45.20 2560 x 1440.png` — Archived 2560×1440 responsive audit screenshot 1
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.45.26 2560 x 1440.png` — Archived 2560×1440 responsive audit screenshot 2
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.45.33 2560 x 1440.png` — Archived 2560×1440 responsive audit screenshot 3
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 09.45.49 2560 x 1440.png` — Archived 2560×1440 responsive audit screenshot 4
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 10.01.31 768x1024.png` — Archived 768×1024 responsive audit screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 10.01.46 960x540.png` — Archived 960×540 responsive audit screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 10.02.00 360x800.png` — Archived 360×800 responsive audit screenshot
- `_Joe/design docs/screenshots/Screenshot 2026-02-08 at 10.16.15 waypoint selected.png` — Archived selected-waypoint UI screenshot
- `_Joe/dev helper scripts/push_github.js` — Legacy maintainer deploy helper, superseded by root `push.js`
- `_Joe/dev helper scripts/restart_localhost.sh` — Legacy local restart helper, superseded by `scripts/restart.sh`
- `_Joe/dev notes/needs consolidating and deleting/Future Features.md` — Legacy maintainer feature notes; backlog is canonical
- `_Joe/dev notes/needs consolidating and deleting/Unit Tests.md` — Legacy maintainer test-planning notes
- `_Joe/dev notes/needs consolidating and deleting/dev guide.md` — Maintainer development guide for change mechanics and fragile areas
- `_Joe/dev notes/needs consolidating and deleting/example feature.md` — Legacy example feature-workflow note
- `_Joe/dev notes/opus chat on re-architecting event bus.md` — Archived EventBus architecture discussion
- `_Joe/dev notes/task list.md` — Legacy maintainer task list; project backlog is canonical
- `_Joe/useful prompt fragments.txt` — Maintainer-owned reusable prompt fragments

## docs

- `docs/UoN_map 24-bit.png` — Generated Pages copy of the legacy 24-bit UoN map asset; never hand-edit
- `docs/UoN_map.png` — Generated Pages copy of the legacy UoN map asset; never hand-edit
- `docs/app.js` — Generated, minified main application bundle served by GitHub Pages
- `docs/app.js.map` — Generated source map for the Pages application bundle
- `docs/images/Court.png` — Generated Pages copy of the Court example background
- `docs/images/Courts.jpg` — Generated Pages copy of the legacy Courts example background
- `docs/images/Garlic.jpg` — Generated Pages copy of the Garlic example background
- `docs/images/Nervous_System.jpg` — Generated Pages copy of the nervous-system example background
- `docs/images/PARM_Aerial.jpg` — Generated Pages copy of the PARM aerial example background
- `docs/images/Rocketry.jpg` — Generated Pages copy of the Rocketry example background
- `docs/images/UoN_map.png` — Generated Pages copy of the UoN map example background
- `docs/images/route-project-2026-03-28 (2).zip` — Generated Pages copy of the bundled example project
- `docs/index.html` — Generated, version-injected Pages application shell
- `docs/meta.json` — Generated build/version metadata used for readiness and artifact checks
- `docs/player.js` — Generated standalone-export player bundle fetched and inlined by the app
- `docs/styles/context-menu.css` — Generated Pages copy of context-menu styles
- `docs/styles/dropdown.css` — Generated Pages copy of dropdown styles
- `docs/styles/main.css` — Generated Pages copy of the core application styles
- `docs/styles/swatch-picker.css` — Generated Pages copy of swatch-picker styles
- `docs/styles/tokens.css` — Generated Pages copy of design tokens
- `docs/styles/tooltip.css` — Generated Pages copy of tooltip styles

## examples

- `examples/route-project-2026-01-10.zip` — Archived example Route Plotter project ZIP

## images

- `images/Court.png` — Built-in Court example background
- `images/Garlic.jpg` — Built-in Garlic example background
- `images/Nervous_System.jpg` — Built-in nervous-system example background
- `images/PARM_Aerial.jpg` — Built-in PARM aerial example background
- `images/Rocketry.jpg` — Built-in Rocketry example background
- `images/UoN_map.png` — Built-in UoN map example background
- `images/route-project-2026-03-28 (2).zip` — Bundled example project archive copied into Pages output

## scripts

- `scripts/README.md` — usage reference for the maintainer scripts
- `scripts/build.sh` — maintainer wrapper: `npm run build` into docs/ (`--test`, `--help`)
- `scripts/restart.sh` — Exact owned-process stop/start/status wrapper: refuse foreign listeners, record process identity and verify HTTP 200

## specs

- `specs/dot-crowd-navigator/AGENTS-spec.md` — Archived dot-crowd product/invariant specification; reference, not live agent policy
- `specs/dot-crowd-navigator/README.md` — Provenance and navigation guide for the salvaged dot-crowd material
- `specs/dot-crowd-navigator/app-overview.md` — Archived verbatim application overview from the dot-crowd fork
- `specs/dot-crowd-navigator/project-memory/architecture.md` — Archived fork architecture memory used as design evidence
- `specs/dot-crowd-navigator/project-memory/backlog.md` — Archived fork backlog showing the salvaged feature intent
- `specs/dot-crowd-navigator/project-memory/brief.md` — Archived fork product brief
- `specs/dot-crowd-navigator/project-memory/conventions.md` — Archived fork coding and product conventions
- `specs/dot-crowd-navigator/project-memory/decision-log.md` — Archived fork decision history
- `specs/dot-crowd-navigator/project-memory/file-map.md` — Archived fork source-role map
- `specs/dot-crowd-navigator/recovered-src/GraphInteractionHandler.js` — Recovered graph-editor interaction source retained for pattern mining
- `specs/dot-crowd-navigator/recovered-src/GraphRenderer.js` — Recovered graph-editor rendering source retained for pattern mining
- `specs/dot-crowd-navigator/recovered-src/index.html` — Recovered graph-editor shell retained as historical reference
- `specs/dot-crowd-navigator/recovered-src/main.js` — Recovered fork orchestrator retained as historical reference
- `specs/dot-crowd-navigator/tests-salvage/SimulationState.test.js` — Salvaged simulation-state behavioural contract; superseded API reference only
- `specs/dot-crowd-navigator/tests-salvage/SwarmEngine.test.js` — Salvaged swarm-engine behavioural contract used to reconstruct deterministic flow

## src

- `src/app/backgroundLoading.js` — Detached user/example background decoding with compressed-byte retention and latest-request commit guards
- `src/app/camera.js` — camera keyframe UI, camera state evaluation, zoom-transition warnings
- `src/app/crowds.js` — Crowd layers mixin (Phase 4): layers strip (Route + crowds), Crowd scope selection events, card syncing, and the single-writer wiring for Guide/Dots/Release/Motion controls editing FlowLayer + first Emitter
- `src/app/editorPanel.js` — waypoint list + editor panel sync, control-visibility helpers, `selectionTargets()` (the write-target rule every card edit loops over; Phase 4 multi-select)
- `src/app/exporting.js` — Video/HTML export flows, summary UI and exact pre-export transport/timing restoration
- `src/app/network.js` — Network editing mixin (Phase 4): Guide-card entry point (Edit network + auto-enter), pointer routing into NetworkEditService, node/edge/control hit-testing on the engine's edge polylines, Node/Edge card wiring, traffic-share readout, restore re-binding
- `src/app/operationGeneration.js` — Project-generation, per-channel request-token and edit-revision helpers for stale async-work rejection
- `src/app/pathTiming.js` — path recalc, easing, segment/leg timing, duration updates
- `src/app/persistence.js` — Transactional bounded project/ZIP staging, commit and rollback; honest autosave recovery, save revisions and the shared coordVersion-9 snapshot
- `src/app/playback.js` — Single keyboard-command path, canonical transport/JKL, preview mode, paused render gating and time display
- `src/app/pointer.js` — canvas pointer fallbacks and hit-testing
- `src/app/startup.js` — Testable startup sequence: await autosave recovery before selecting a default background
- `src/app/undoRedo.js` — Undo/redo snapshots and full model/UI/custom-image restoration with stale async-result guards
- `src/app/viewport.js` — Responsive canvas/panel bounds, coordinate conversion, aspect handling and manual zoom
- `src/app/wiringBus.js` — EventBus + AnimationEngine subscription wiring
- `src/app/wiringControllers.js` — UIController/InteractionHandler event connections
- `src/app/wiringDom.js` — setupEventListeners(): DOM control wiring
- `src/components/ContextMenu.js` — Right-click menu (canvas waypoints + empty canvas): Carbon menu anatomy, arrow-key navigation, aria-disabled reasons, focus restore (Phase 3.5)
- `src/components/Dropdown.js` — Accessible dropdown menus
- `src/components/ParamTooltip.js` — Click-label parameter tooltips (Carbon pattern)
- `src/components/SwatchPicker.js` — Okabe-Ito colour-blind safe palette picker
- `src/components/Tooltip.js` — Tooltip attachment
- `src/config/constants.js` — All tuneable values (animation, rendering, path, etc.)
- `src/config/helpContent.js` — Welcome modal and inline help HTML generators
- `src/config/keybindings.js` — Mouse + keyboard bindings (customisable via localStorage)
- `src/config/tooltips.js` — Tooltip definitions
- `src/controllers/SectionController.js` — Collapsible settings sections + scope switching (waypoint-scope vs route-scope card groups follow selection; Phase 4)
- `src/controllers/UIController.js` — Sidebar controls, waypoint list, slider sync; scope chip (text + prev/next stepping, multi counts) and Leg-card header naming; multi-select gesture Set + `setSelection()` for app-decided selections; pause/speed/area controls write to the whole selection (Phase 4)
- `src/core/EventBus.js` — Pub-sub event system
- `src/core/PlayerCore.js` — Pure timeline math (deterministic-timeline mandate): segment/pause/beacon-schedule builders + timeline↔path mappings; one evaluation path shared by play, scrub, and export
- `src/handlers/InteractionHandler.js` — Mouse, keyboard, touch, drag-and-drop input
- `src/main.js` — RoutePlotter class: app entry + orchestrator core (constructor, init, model bookkeeping, render scheduling); attaches the `src/app/*` mixins to its prototype
- `src/models/AnimationState.js` — Playback state, canonical seek-derived timing/pause state and exact transport snapshots
- `src/models/Emitter.js` — Dot-stream params + per-emitter seed (release window, lifecycle, wobble…) — no runtime state
- `src/models/FlowLayer.js` — Bounded graph/hero-route guide plus emitters, with strict endpoint and persisted-data validation
- `src/models/GraphEdge.js` — Weighted directed edge with control points
- `src/models/GraphModel.js` — Node/edge collection: CRUD, referential integrity, adjacency (owned by FlowLayer)
- `src/models/GraphNode.js` — Flow-network node (normalised pos, entry/exit type)
- `src/models/ImageAsset.js` — Custom image references (marker, path head)
- `src/models/Scene.js` — Ordered flow layers (drawn beneath the hero route); serialises as the coordVersion 9 `scene` block
- `src/models/Waypoint.js` — Waypoint data model (normalised coords, style, camera, area)
- `src/models/index.js` — Barrel exports for canonical project and flow-scene models
- `src/player/PlayerApp.js` — Headless app core for exported files: real service instances + adopted app mixins (pathTiming wholesale; viewport/camera cherry-picks); computes timing in the snapshot's timingReference space, renders at export resolution; never imports ImageAssetService (jszip) or the exporting mixin (mediabunny)
- `src/player/playerEntry.js` — Exported-page boot: background decode, transport controls, keyboard, resize; exposes `window.__routePlotterPlayer` debug handle
- `src/services/AnimationEngine.js` — Transport (play/pause/seek/reverse), wait-event edge-detection; all timeline mapping delegates to PlayerCore; marker fields keep their serialised shapes
- `src/services/AreaDrawingService.js` — Polygon area drawing mode
- `src/services/AreaEditService.js` — Area highlight repositioning and vertex editing
- `src/services/AreaHighlightRenderer.js` — Per-waypoint area highlight rendering
- `src/services/BeaconRenderer.js` — Animated waypoint effects (ripple, glow, pop, grow, pulse); closed-form: each animator's `sync(localSec, win, options)` derives state from a timeline-local clock (schedules from PlayerCore via `engine.beaconSchedules`)
- `src/services/CameraService.js` — Per-major-waypoint zoom with continuous interpolation; `toMajorKeyframes()` drops minors (minors shape geometry, not zoom)
- `src/services/CoordinateTransform.js` — Image ↔ canvas coordinate conversion
- `src/services/DotRenderer.js` — Batched swarm-dot drawing: one canvas path per (colour, size) group, sizes via `scaleSizeClamped()` (Phase 3)
- `src/services/HTMLExportService.js` — Self-contained HTML export: embeds snapshot/background and the exact-build same-origin player bundle; owns the exported shell
- `src/services/ImageAssetService.js` — Strict bitmap validation, bounded ZIP preflight/staging/export and persistence-safe custom-image deduplication
- `src/services/MotionVisibilityService.js` — Stateless timeline-derived path, waypoint and background visibility, including comet trails
- `src/services/NetworkEditService.js` — Network edit mode (Phase 4): pen state machine (chaining, drags, bends, Esc ladder, mode keys), banner, node/edge selection events, and the guide/overlay canvas rendering (edge geometry via SwarmEngine's cache)
- `src/services/PathCalculator.js` — Catmull-Rom spline, corner-slowing reparameterisation, curvature; `legTimingLengths()` gives per-major-leg timing lengths (progress-span basis)
- `src/services/RenderingService.js` — Canvas drawing: path, markers, labels, overlays; static `glowLayers()` computes the path-glow underlay strokes; static `VECTOR_LAYERS` registry drives the vector draw order (the `flow-layers` entry draws swarms beneath the hero route)
- `src/services/StorageService.js` — Honest bounded localStorage writes with debounce, change detection, deterministic flush/cancel and clear
- `src/services/SwarmEngine.js` — Deterministic flow-layer dot evaluator: pure `evaluate(timelineMs, layer, context)`, `hash(seed, dotIndex, hopIndex)` variation, weighted graph walks, four lifecycle modes, per-edge PathCalculator caches (Phase 3)
- `src/services/TextLabelService.js` — Text label layout, fade, auto-positioning
- `src/services/UndoService.js` — 150-step undo/redo history
- `src/services/VideoExporter.js` — MP4/WebM export (WebCodecs + mediabunny)
- `src/services/index.js` — Barrel exports for the core application services used by consumers
- `src/utils/CatmullRom.js` — Catmull-Rom spline interpolation
- `src/utils/Easing.js` — Easing functions (linear, quad, cubic, etc.)
- `src/utils/focusTrap.js` — Modal inerting, focus containment/wrap, Escape handling and origin-focus restoration
- `src/utils/index.js` — Barrel exports for Catmull-Rom and easing utilities
- `src/utils/pathWidthScale.js` — Log-scale thickness slider ↔ width (1–40px) mapping; single source shared by the DOM wiring and UIController bulk edits (Phase 3.5)
- `src/utils/segmentHitTest.js` — Pure leg hit-test geometry: polyline nearest-point projection, waypoint→point-index mapping, leg ownership + midpoint (Phase 4 canvas affordances; used by pointer mixin and hover render layers)
- `src/utils/snapToAngle.js` — Angle-snap geometry for shift-drag waypoint placement (moved out of main.js in the Phase 1 split)

## styles

- `styles/context-menu.css` — Context menu styles (UoN tokens, 44px AAA targets)
- `styles/dropdown.css` — Dropdown component styles
- `styles/main.css` — Core responsive layout, sidebar/canvas reflow, 44 px controls, modal and application states
- `styles/swatch-picker.css` — Swatch picker grid (5×2, 44px AAA touch targets)
- `styles/tokens.css` — Design tokens: UoN palette, Okabe-Ito map palette, semantic colours, spacing
- `styles/tooltip.css` — Tooltip styles

## tests

- `tests/Emitter.test.js` — Emitter defaults, bounds, updates, reseeding and persistence contracts
- `tests/FlowLayer.test.js` — Flow-layer guide, emitter CRUD and hydration/round-trip contracts
- `tests/GraphEdge.test.js` — Graph-edge direction, weight, control-point and serialisation contracts
- `tests/GraphModel.test.js` — Graph CRUD, adjacency, referential-integrity and hydration contracts
- `tests/GraphNode.test.js` — Graph-node type, normalised-position and serialisation contracts
- `tests/Scene.test.js` — Ordered flow-layer CRUD, movement, clearing and persistence contracts
- `tests/crowds.test.js` — Crowd creation, layers strip, selection, visibility, rename and hostile-colour contracts
- `tests/example.test.js` — Unit tests (Waypoint, AnimationState, Path, EventBus, etc.)
- `tests/goldenFrames.test.js` — Scrub-vs-play golden harness: sequential/reverse/export-step == direct seek (full scene state incl. beacons); evaluation never mutates the timeline
- `tests/htmlExportCache.test.js` — HTML export fetches the standalone player bundle for the exact application build
- `tests/imageAssetRoundTrip.test.js` — Persistence-safe image IDs and import→export→import asset round-trip contracts
- `tests/mixins.test.js` — Mixin split guards: cross-mixin name-collision check, cluster spot-checks, snapToAngle unit tests
- `tests/modelBoundary.test.js` — Strict graph-endpoint and persisted emitter integer boundary contracts
- `tests/multiSelect.test.js` — Multi-select everywhere: selectionTargets rules, Cmd+A incl. minors, toggle-select collapse ladder, one-gesture bulk delete/nudge, snapshot selectedWaypointIds round-trip, headless UIController list gestures + chip counts
- `tests/networkEdit.test.js` — Network edit mode: pen chaining/loop-close, snap, drags + bends + cancel, Esc ladder + mode keys, guide-card auto-enter/exit rules, change pipeline, hit cascade, traffic-share readout, restore re-binding
- `tests/operationGeneration.test.js` — Latest-request/project-generation guards and original background-byte retention
- `tests/playerApp.test.js` — Golden app-to-exported-player timeline, reset, reveal, swarm and text parity contracts
- `tests/playerCore.test.js` — PlayerCore builders, pause budgets, timeline windows, inverse mappings
- `tests/projectLimits.test.js` — Adversarial image, model, ZIP/ZIP64 and detached-import resource-limit contracts
- `tests/releaseSafety.test.js` — Clean-build rollback, versioned CSS references and dry-run deployment safety contracts
- `tests/restartSafety.test.sh` — Shell contract for exact owned-process restart, readiness and foreign-listener refusal
- `tests/reviewAccessibility.test.js` — Keyboard, modal focus, paused render, responsive shell and stale-upload review regressions
- `tests/reviewPersistence.test.js` — Autosave honesty, transactional load/rollback, save revisions and undo-image restoration regressions
- `tests/reviewTimeline.test.js` — Stateless comet, canonical transport/export and timing-invalidation review regressions
- `tests/scenePersistence.test.js` — coordVersion-9 scene autosave, ZIP, migration and undo round-trip contracts
- `tests/segmentHitTest.test.js` — Pure polyline projection, leg ownership and midpoint geometry contracts
- `tests/setup.js` — Vitest jsdom setup (uses defineProperty for getter-only jsdom globals)
- `tests/startup.test.js` — Recovery-before-default-image startup ordering contracts
- `tests/swarmEngine.test.js` — SwarmEngine behavioural spec: hash pins, call-order-free determinism, release windows/ramps, weighted junctions, four lifecycle modes, route guide, wobble bounds, edge-cache invalidation
- `tests/units.test.js` — Extended unit coverage (state transitions, coordinate round-trips, path maths, waypoint serialisation/inheritance)
- `tests/vectorLayers.test.js` — VECTOR_LAYERS registry: canonical order + per-layer visibility-guard dispatch

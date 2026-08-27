# File Map

<!-- file-map-index -->
<!-- 272 file(s) across 12 section(s); regenerate with pm_skills/scaffold/gen-file-map.mjs -->
- `(root)` — 14 file(s)
- `.devin` — 2 file(s)
- `.github` — 3 file(s)
- `_Joe` — 45 file(s)
- `docs` — 17 file(s)
- `images` — 6 file(s)
- `reviews` — 6 file(s)
- `scripts` — 3 file(s)
- `specs` — 15 file(s)
- `src` — 93 file(s)
- `styles` — 6 file(s)
- `tests` — 62 file(s)
<!-- /file-map-index -->

## (root)

- `AGENTS.md` — Project-wide agent contract: product boundaries, invariants, workflow, documentation and memory rules
- `CLAUDE.md` — Claude Code adapter importing the shared `AGENTS.md` contract without duplicating project knowledge
- `DEV-INFRASTRUCTURE.md` — Canonical build, test, version, deployment and owned-runtime lifecycle contract
- `README.md` — Product overview, user/developer quick start, architecture, persistence/export behaviour and glossary
- `Route Plotter v3.code-workspace` — VS Code workspace definition for this repository
- `THIRD_PARTY_NOTICES.md` — Checked licence, copyright and source notices for the exact direct runtime and development dependencies
- `UI-STANDARDS.md` — Carbon-first UI, UoN/Okabe-Ito token and WCAG 2.2 AAA interaction contract
- `build.js` — esbuild/watch server plus clean staged production builds, explicit Pages allowlist, versioned static references and non-mutating build checks
- `index.html` — Single-page app shell (sidebar + canvas + controls)
- `package.json` — Project metadata and scripts
- `public-assets.json` — Owner-approved public image allowlist pinned to exact paths and SHA-256 hashes
- `push.js` — Clean-tree, current-branch Pages deploy helper with argv-safe commits and a non-mutating dry run
- `version.json` — Auto-incremented build number
- `vitest.config.js` — Vitest jsdom configuration, setup binding and test-file selection

## .devin

- `.devin/workflows/bugfix.md` — Devin adapter for the repository's pm-skills bug-fix workflow
- `.devin/workflows/feature.md` — Devin adapter for the repository's pm-skills feature workflow

## .github

- `.github/SECURITY.md` — Private vulnerability-reporting route, safe evidence guidance and supported-code scope
- `.github/SUPPORT.md` — Best-effort public Issues support boundary with safe-sharing and no-SLA guidance
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

- `docs/app.js` — Generated, minified main application bundle served by GitHub Pages
- `docs/app.js.map` — Generated source map for the Pages application bundle
- `docs/images/Court.png` — Generated Pages copy of the Court example background
- `docs/images/Garlic.jpg` — Generated Pages copy of the Garlic example background
- `docs/images/Nervous_System.jpg` — Generated Pages copy of the nervous-system example background
- `docs/images/PARM_Aerial.jpg` — Generated Pages copy of the PARM aerial example background
- `docs/images/Rocketry.jpg` — Generated Pages copy of the Rocketry example background
- `docs/images/UoN_map.png` — Generated Pages copy of the UoN map example background
- `docs/index.html` — Generated, version-injected Pages application shell
- `docs/meta.json` — Generated build/version metadata used for readiness and artifact checks
- `docs/player.js` — Generated standalone-export player bundle fetched and inlined by the app
- `docs/styles/context-menu.css` — Generated Pages copy of context-menu styles
- `docs/styles/dropdown.css` — Generated Pages copy of dropdown styles
- `docs/styles/main.css` — Generated Pages copy of the core application styles
- `docs/styles/swatch-picker.css` — Generated Pages copy of swatch-picker styles
- `docs/styles/tokens.css` — Generated Pages copy of design tokens
- `docs/styles/tooltip.css` — Generated Pages copy of tooltip styles

## images

- `images/Court.png` — Built-in Court example background
- `images/Garlic.jpg` — Built-in Garlic example background
- `images/Nervous_System.jpg` — Built-in nervous-system example background
- `images/PARM_Aerial.jpg` — Built-in PARM aerial example background
- `images/Rocketry.jpg` — Built-in Rocketry example background
- `images/UoN_map.png` — Built-in UoN map example background

## reviews

- `reviews/README.md` — Public-safe review dossier index, provenance and
  cross-project filename guard
- `reviews/read-only-comprehensive-repository-review-prompt.md` — Original
  read-only review brief retained as historical provenance, not active policy
- `reviews/route-plotter-review-finding-crosswalk-2026-08-26.md` — Original
  RP-01–RP-18 findings mapped to shipped work and residual assurance tickets
- `reviews/route-plotter-review-headlines-for-novices-2026-08-26.md` —
  Plain-language pre-remediation health snapshot with an explicit stale-state
  warning
- `reviews/route-plotter-review-remediation-continuation-prompt-2026-08-26.md`
  — Paste-ready, path-based continuation contract for the next development chat
- `reviews/route-plotter-v3-comprehensive-repository-review-2026-08-26.md` —
  Full historical Route Plotter review at commit cec0191, public-path sanitised

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
- `src/app/camera.js` — camera keyframe UI, actual-major mixed-state sync, camera state evaluation and zoom-transition warnings
- `src/app/crowds.js` — Crowd layers mixin: layers strip and selection plus single-writer first-emitter controls, seeded variation, one-step Re-roll and the accessible busyness-envelope graph
- `src/app/editorPanel.js` — Waypoint list/editor sync, actual write-target resolution, transient mixed-state overlays and card-action state/transactions
- `src/app/exporting.js` — Video/HTML export flows, summary UI and exact pre-export transport/timing restoration
- `src/app/network.js` — Network editing mixin (Phase 4): Guide-card entry point (Edit network + auto-enter), pointer routing into NetworkEditService, node/edge/control hit-testing on the engine's edge polylines, Node/Edge card wiring, traffic-share readout, restore re-binding
- `src/app/operationGeneration.js` — Project-generation, per-channel request-token and edit-revision helpers for stale async-work rejection
- `src/app/pathTiming.js` — path recalc, easing, segment/leg timing, duration updates
- `src/app/persistence.js` — Transactional bounded project/ZIP staging, commit and rollback; honest autosave recovery, save revisions and the shared coordVersion-9 snapshot including timing and visual references
- `src/app/playback.js` — Single keyboard-command path, canonical transport/JKL, preview mode, demand-driven render keepalive and time display
- `src/app/pointer.js` — canvas pointer fallbacks and hit-testing
- `src/app/privacy.js` — Explicit export disclosures plus fixed-schema diagnostics preview, public/private support hand-off, exact-address fallback and modal recovery
- `src/app/projectReset.js` — Testable Clear All transaction: invalidate async work, clear bytes/model/UI, reset the visual reference, cancel writers and establish one empty baseline
- `src/app/sceneOutline.js` — EventBus integration and sole mutation/undo/autosave owner for stable-ID semantic scene-outline commands, with shared plain crowd-field vocabulary
- `src/app/startup.js` — Testable startup sequence: await autosave recovery before selecting a default background
- `src/app/undoRedo.js` — Undo/redo model, selection and inspector-scope restoration; reference-aware asset sweeping and rollback-safe interactive image admission with minimum history loss
- `src/app/viewport.js` — Responsive canvas/panel bounds, first-authored-canvas visual-reference seeding, coordinate conversion, aspect handling and manual zoom
- `src/app/wiringBus.js` — EventBus + AnimationEngine subscriptions, including card-action availability refresh and compatible already-saved image-edit signalling
- `src/app/wiringControllers.js` — UIController/InteractionHandler event connections
- `src/app/wiringDom.js` — DOM control and delegated card-action wiring, transient mixed-state reset, and detached transactional custom marker/route-head image uploads
- `src/assets/README.md` — Provenance and bundling boundary for reviewed first-party visual assets
- `src/assets/drone-head.png` — Reviewed 512 px RGBA quadcopter route-head preset, inlined into both runtime bundles
- `src/components/ContextMenu.js` — Right-click menu (canvas waypoints + empty canvas): Carbon menu anatomy, arrow-key navigation, aria-disabled reasons, focus restore (Phase 3.5)
- `src/components/Dropdown.js` — Accessible dropdown menus
- `src/components/ParamTooltip.js` — Click-label parameter tooltips (Carbon pattern)
- `src/components/SwatchPicker.js` — Okabe-Ito palette picker with exact custom, disabled and transient mixed-state synchronization
- `src/components/Tooltip.js` — Tooltip attachment
- `src/config/constants.js` — All tuneable values (animation, rendering, path, etc.)
- `src/config/helpContent.js` — Welcome modal and inline help HTML generators
- `src/config/keybindings.js` — Mouse + keyboard bindings (customisable via localStorage)
- `src/config/tooltips.js` — Tooltip definitions
- `src/controllers/SceneOutlineController.js` — Native-details/list/form renderer owning transient disclosure, focus and dirty-draft state while emitting model-free commands in the shared plain field vocabulary
- `src/controllers/SectionController.js` — Collapsible settings sections, waypoint/route/crowd/network scope switching, undo selection-state synchronization and deterministic native More keyboard activation
- `src/controllers/UIController.js` — Sidebar/list/slider sync; stable multi-selection scope and Leg headings; selection gestures; whole-selection pause, speed and area writes
- `src/core/EventBus.js` — Pub-sub event system
- `src/core/PlayerCore.js` — Pure timeline math (deterministic-timeline mandate): segment/pause/beacon-schedule builders + timeline↔path mappings; one evaluation path shared by play, scrub, and export
- `src/handlers/InteractionHandler.js` — One captured Pointer Events transaction for mouse/touch/pen waypoint, area and network taps/drags; keyboard, drop, context-menu and wheel paths stay native
- `src/main.js` — RoutePlotter class: app entry + orchestrator core (constructor, init, model bookkeeping, render scheduling); attaches the `src/app/*` mixins to its prototype
- `src/models/AnimationState.js` — Playback state, canonical seek-derived timing/pause state and exact transport snapshots
- `src/models/Emitter.js` — Persisted dot-stream parameters, two-to-eight-handle busyness envelope and guaranteed-changing authoring seed; no transient runtime state
- `src/models/FlowLayer.js` — Bounded graph/hero-route guide plus emitters, with strict endpoint and persisted-data validation
- `src/models/GraphEdge.js` — Weighted directed edge with control points
- `src/models/GraphModel.js` — Node/edge collection: CRUD, referential integrity, adjacency (owned by FlowLayer)
- `src/models/GraphNode.js` — Flow-network node (normalised pos, entry/exit type)
- `src/models/ImageAsset.js` — Custom image references (marker, path head)
- `src/models/Scene.js` — Ordered flow layers (drawn beneath the hero route); serialises as the coordVersion 9 `scene` block
- `src/models/Waypoint.js` — Waypoint data model (normalised coords, style, camera, area)
- `src/models/index.js` — Barrel exports for canonical project and flow-scene models
- `src/player/PlayerApp.js` — Headless app core for exported files: real service instances + adopted app mixins, separate authored timing/visual references and demand-driven camera keepalive; renders at export resolution and never imports ImageAssetService (jszip) or the exporting mixin (mediabunny)
- `src/player/playerAccessibility.js` — Privacy-safe aggregate exported-scene summary and action-driven transport announcements
- `src/player/playerEntry.js` — Exported-page boot: background decode, transport controls, keyboard, resize; exposes `window.__routePlotterPlayer` debug handle
- `src/services/AnimationEngine.js` — Demand-driven preview scheduler plus transport (play/pause/seek/reverse) and wait-event edge-detection; all timeline mapping delegates to PlayerCore and export can suspend preview frames
- `src/services/AreaDrawingService.js` — Polygon area drawing mode
- `src/services/AreaEditService.js` — Area highlight repositioning and vertex editing
- `src/services/AreaHighlightRenderer.js` — Per-waypoint area geometry with project-reference-scaled border rendering
- `src/services/BeaconRenderer.js` — Animated waypoint effects (ripple, glow, pop, grow, pulse); closed-form: each animator's `sync(localSec, win, options)` derives state from a timeline-local clock (schedules from PlayerCore via `engine.beaconSchedules`)
- `src/services/CameraService.js` — Per-major-waypoint zoom with target-aware continuous interpolation and settling; `toMajorKeyframes()` drops minors (minors shape geometry, not zoom)
- `src/services/CoordinateTransform.js` — Image ↔ canvas coordinate conversion
- `src/services/DiagnosticsService.js` — Pure fixed-schema technical diagnostics with bounded allowlisted fields and URL/path/filename redaction
- `src/services/DotRenderer.js` — Batched swarm-dot drawing: one canvas path per (colour, size) group, sizes via `scaleSizeClamped()` (Phase 3)
- `src/services/HTMLExportService.js` — Self-contained HTML export: embeds snapshot/background and the exact-build same-origin player bundle; owns the exported shell
- `src/services/ImageAssetService.js` — Strict bitmap validation, bounded ZIP staging/export, deduplication and deterministic unreachable-asset sweeping
- `src/services/MotionVisibilityService.js` — Stateless timeline-derived path, waypoint and background visibility, including comet trails
- `src/services/NetworkEditService.js` — Network edit mode (Phase 4): pen state machine (chaining, drags, bends, Esc ladder, mode keys), banner, node/edge selection events, and the guide/overlay canvas rendering (edge geometry via SwarmEngine's cache)
- `src/services/PathCalculator.js` — Catmull-Rom spline, corner-slowing reparameterisation, curvature; `legTimingLengths()` gives per-major-leg timing lengths (progress-span basis)
- `src/services/RenderingService.js` — Canvas drawing and stable short-edge reference scaling for path, markers, labels, effects and overlays; static `VECTOR_LAYERS` drives draw order
- `src/services/StorageService.js` — Honest bounded localStorage writes with debounce, change detection, deterministic flush/cancel and clear
- `src/services/SwarmEngine.js` — Deterministic flow-layer dot evaluator: pure `evaluate(timelineMs, layer, context)`, seeded release-density inversion, weighted graph walks, four lifecycle modes and per-edge PathCalculator caches
- `src/services/TextLabelService.js` — Text label layout, fade, auto-positioning
- `src/services/UndoService.js` — 150-state undo/redo history with non-mutating save previews and validated additional oldest-prefix discard
- `src/services/VideoExporter.js` — Runtime-probed MP4/WebM export with one frame plan, visibility-safe MediaRecorder pacing and rollback-safe WebCodecs cleanup
- `src/services/index.js` — Barrel exports for the core application services used by consumers
- `src/utils/CatmullRom.js` — Catmull-Rom spline interpolation
- `src/utils/Easing.js` — Easing functions (linear, quad, cubic, etc.)
- `src/utils/assetReferences.js` — Image-ID reachability collector and pure minimum-oldest-history admission planner for count/byte/pixel limits
- `src/utils/branchTiming.js` — Pure per-run branch timing: builds each run's
- `src/utils/busynessEnvelope.js` — Pure busyness-handle normalisation/validation, segment-area compilation and inverse-density sampling for seeded release times
- `src/utils/entityId.js` — Shared persisted structural-ID length boundary that leaves authored display text untouched
- `src/utils/focusTrap.js` — Modal inerting, focus containment/wrap, Escape handling and origin-focus restoration
- `src/utils/graphRouting.js` — Shared directed departures, overflow-safe weight normalisation and stable whole-percentage traffic shares
- `src/utils/index.js` — Barrel exports for Catmull-Rom and easing utilities
- `src/utils/mixedControlState.js` — DOM-only mixed-value comparison, select/range/checkbox presentation and concrete-input reset helpers
- `src/utils/pathHeadPresets.js` — Built-in route-head registry, shared image decoding and custom/preset hydration boundary
- `src/utils/pathWidthScale.js` — Log-scale thickness slider ↔ width (1–40px) mapping; single source shared by the DOM wiring and UIController bulk edits (Phase 3.5)
- `src/utils/renderReference.js` — Pure visual-reference migration and current-to-authored short-edge scale calculation
- `src/utils/routeBranches.js` — Pure hero-route branch resolution: cuts a
- `src/utils/safeColor.js` — Strict persisted hexadecimal-colour grammar with opt-in exact transparent sentinel
- `src/utils/sceneSemantics.js` — Pure bounded DOM-free projection and collision-safe semantic keys for route/crowd/network/polygon models
- `src/utils/segmentHitTest.js` — Pure leg hit-test geometry: polyline nearest-point projection, waypoint→point-index mapping, leg ownership + midpoint (Phase 4 canvas affordances; used by pointer mixin and hover render layers)
- `src/utils/snapToAngle.js` — Angle-snap geometry for shift-drag waypoint placement (moved out of main.js in the Phase 1 split)
- `src/utils/uiReadouts.js` — Shared reference-pixel, effective-amplitude and background-overlay readout formatting with accessible range-value synchronisation
- `src/utils/waypointCardActions.js` — Pure Reset/Apply-onward field ownership, target filtering, semantic no-op comparison and effect metadata for waypoint cards
- `src/utils/waypointNaming.js` — Shared hierarchical route numbering

## styles

- `styles/context-menu.css` — Context menu styles (UoN tokens, 44px AAA targets)
- `styles/dropdown.css` — Dropdown component styles
- `styles/main.css` — Core responsive layout, sidebar/canvas reflow, 44 px controls, modal and application states
- `styles/swatch-picker.css` — Swatch picker grid (5×2, 44px AAA touch targets)
- `styles/tokens.css` — Design tokens: UoN palette, Okabe-Ito map palette, semantic colours, spacing
- `styles/tooltip.css` — Tooltip styles

## tests

- `tests/Emitter.test.js` — Emitter defaults, bounds, updates, collision-safe reseeding and persistence contracts
- `tests/FlowLayer.test.js` — Flow-layer guide, emitter CRUD and hydration/round-trip contracts
- `tests/GraphEdge.test.js` — Graph-edge direction, weight, control-point and serialisation contracts
- `tests/GraphModel.test.js` — Graph CRUD, adjacency, referential-integrity and hydration contracts
- `tests/GraphNode.test.js` — Graph-node type, normalised-position and serialisation contracts
- `tests/Scene.test.js` — Ordered flow-layer CRUD, movement, clearing and persistence contracts
- `tests/areaEdit.test.js` — Screen-space area-handle hit targets and one-commit polygon editing through zoom/pan transforms
- `tests/assetAdmission.test.js` — Pure minimum-prefix image admission at exact count, 40 MiB and 48-million-pixel boundaries plus fail-closed inputs
- `tests/assetPruning.test.js` — Reference collection, deterministic sweep and transactional marker/head admission, redo and rollback contracts
- `tests/branchAuthoring.test.js` — ROUTE-01c contract: branch numbering,
- `tests/branchExportParity.test.js` — ROUTE-01d contract: branch links in
  the snapshot, identical structure and timeline after rehydration, and the
  timeline extending for a branch that outlives the trunk
- `tests/branchTiming.test.js` — ROUTE-01b contract: run timing, master
- `tests/busynessEnvelope.test.js` — Neutral, gradual, sudden, normalisation and strict-validation contracts for crowd release density
- `tests/crowds.test.js` — Crowd creation/layers/selection plus seeded variation, busyness graph/control transactions, seed-only Re-roll and custom-network guidance contracts
- `tests/diagnostics.test.js` — Fixed diagnostic schema, deterministic byte parity, hostile-field exclusion, redaction and no-network contracts
- `tests/example.test.js` — Unit tests (Waypoint, AnimationState, Path, EventBus, etc.)
- `tests/goldenFrames.test.js` — Scrub-vs-play golden harness: sequential/reverse/export-step == direct seek (full scene state incl. beacons); evaluation never mutates the timeline
- `tests/governance.test.js` — MIT metadata, exact dependency notices and approved security/support route contracts
- `tests/graphRouting.test.js` — Directed graph choices, backtrack avoidance, overflow-safe shares and stable 100-percent rounding
- `tests/htmlExportCache.test.js` — HTML export fetches the standalone player bundle for the exact application build
- `tests/imageAssetRoundTrip.test.js` — Persistence-safe image IDs and import→export→import asset round-trip contracts
- `tests/interactionPointer.test.js` — Pointer transaction contracts: exactly-once mouse/touch/pen taps, common threshold, capture/window terminal fallback, cancellation, mode priority, group snapshots and teardown
- `tests/mixedControlState.test.js` — Mixed comparison, accessible control presentation and user-input reset contracts
- `tests/mixins.test.js` — Mixin split guards: cross-mixin name-collision check, cluster spot-checks, snapToAngle unit tests
- `tests/modelBoundary.test.js` — Strict graph-endpoint and persisted emitter integer boundary contracts
- `tests/multiSelect.test.js` — Multi-select write-target rules, gestures/bulk actions/persistence, undo scope restoration, stable headings and honest per-control mixed-state integration
- `tests/networkEdit.test.js` — Network edit mode: pen chaining/loop-close, snap, drags + bends + cancel, Esc ladder + mode keys, guide-card auto-enter/exit rules, change pipeline, hit cascade, traffic-share readout, restore re-binding
- `tests/operationGeneration.test.js` — Latest-request/project-generation guards and original background-byte retention
- `tests/pathHeadPresets.test.js` — Drone preset metadata, native control, loader ownership and renderer-transform contracts
- `tests/performanceScheduling.test.js` — Manual-rAF scheduler contract: idle sleep, transport wake/coalescing, camera keepalive and export suspension/restore
- `tests/playerAccessibility.test.js` — Aggregate-summary privacy/counting and discrete/coalesced transport-announcement contracts
- `tests/playerApp.test.js` — Golden app-to-exported-player timeline, reset, reveal, swarm and text parity contracts
- `tests/playerCore.test.js` — PlayerCore builders, pause budgets, timeline windows, inverse mappings
- `tests/playerEntryAccessibility.test.js` — Exported-player summary, keyboard/transport live-region and playback-speed integration contracts
- `tests/privacy.test.js` — Export disclosures, byte-identical diagnostics, support navigation/address fallback, mode isolation, focus recovery and no automatic sharing
- `tests/projectLimits.test.js` — Adversarial image, model, ZIP/ZIP64 and detached-import resource-limit contracts
- `tests/projectReset.test.js` — Behavioral Clear All proof for stale writers/tokens, asset/reference removal and one empty non-undoable baseline
- `tests/publicationBoundary.test.js` — Approved-image hashes, CSP/same-origin shell, exact Pages inventory and manifest-tamper rejection
- `tests/releaseSafety.test.js` — Clean-build rollback, versioned CSS references and dry-run deployment safety contracts
- `tests/renderReference.test.js` — Reference migration, aspect/export scaling, label clamp, camera, area-border and no-timeline-mutation contracts
- `tests/restartSafety.test.sh` — Shell contract for exact owned-process restart, readiness and foreign-listener refusal
- `tests/reviewAccessibility.test.js` — Keyboard semantics, modal focus, responsive/support/privacy shell, disclosure, card-action and accessible crowd-variation/busyness UI contracts
- `tests/reviewPersistence.test.js` — Autosave honesty, transactional load/rollback, save revisions and undo-image restoration regressions
- `tests/reviewTimeline.test.js` — Stateless comet, canonical transport/export and timing-invalidation review regressions
- `tests/routeBranches.test.js` — ROUTE-01a contract: branch resolution and
- `tests/safeColor.test.js` — Accepted hexadecimal forms, hostile CSS rejection and exact transparent-sentinel opt-in
- `tests/sceneOutline.test.js` — Semantic projection/controller security, focus, disclosure, draft, stable-key and bounded-scale contracts
- `tests/sceneOutlineApp.test.js` — App command mutation, selection, undo/autosave, reset and model-boundary integration contracts
- `tests/scenePersistence.test.js` — coordVersion-9 scene variation/seed autosave, ZIP, migration and undo round-trip contracts
- `tests/segmentHitTest.test.js` — Pure polyline projection, leg ownership and midpoint geometry contracts
- `tests/setup.js` — Vitest jsdom setup (uses defineProperty for getter-only jsdom globals)
- `tests/startup.test.js` — Recovery-before-default-image startup ordering contracts
- `tests/swarmEngine.test.js` — SwarmEngine behavioural spec: hash pins, serialized-clone determinism, busyness density, release variation, weighted junctions, lifecycles, route guide, wobble and cache invalidation
- `tests/swatchPicker.test.js` — Exact preset/custom/mixed colour state, external refresh and complete disabled-fieldset contracts
- `tests/undoService.test.js` — Prospective-save parity, natural rollover, extra oldest discard, redo preservation/invalidation and rejected-input immutability
- `tests/units.test.js` — Extended unit coverage (state transitions, coordinate round-trips, path maths, waypoint serialisation/inheritance)
- `tests/vectorLayers.test.js` — VECTOR_LAYERS registry: canonical order + per-layer visibility-guard dispatch
- `tests/videoExporter.test.js` — Endpoint-inclusive frame planning, visibility throttling, cancellation and complete MediaRecorder/WebCodecs cleanup
- `tests/waypointCardActions.test.js` — Reset/Apply-onward ownership, no-op reasons, content preservation, copy semantics and one-transaction integration contracts
- `tests/waypointList.test.js` — UI-02 sidebar list contract: whole-route
- `tests/waypointNaming.test.js` — Route numbering and its agreement with
- `tests/wiringBus.test.js` — Waypoint edit event compatibility, card-action refresh and exactly-once undo/render/list/autosave routing

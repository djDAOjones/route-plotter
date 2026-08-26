# Route Plotter

An animated route editor for maps and images. Drop in a background, click to place waypoints, tweak styles and timing, then export as MP4, WebM, or a self-contained HTML file.

**[Live demo](https://djdaojones.github.io/route-plotter/)** *(the frozen v2 line remains at [router-plotter-02](https://djdaojones.github.io/router-plotter-02/))*

---

## What it does

1. Load a background image (drag-and-drop, upload, or pick a built-in example).
2. Click the canvas to add **major** waypoints (full features) or Cmd/Ctrl+Click for **minor** waypoints (path shaping only).
3. A Catmull-Rom spline connects them into a smooth animated path.
4. Configure per-waypoint: marker style, colour, beacon effect, text label, wait time, segment speed, camera zoom, and area highlight.
5. Configure globally: path visibility mode, waypoint visibility mode, background reveal mode (spotlight, angle-of-view), tint, trail, and graphics scale.
6. Toggle between **Edit** and **Preview** modes in the header.
7. Export to MP4 (H.264 via WebCodecs), WebM (VP8), or standalone HTML with interactive playback.
8. Projects auto-save to localStorage and can be saved/loaded as ZIP files.

---

## Quick start

```bash
git clone https://github.com/djDAOjones/route-plotter.git
cd route-plotter
nvm use            # Node version is pinned in .nvmrc
npm ci
npm run dev        # Dev server with watch → http://localhost:3000
```

```bash
npm run build          # Production bundle → docs/
npm run build:check    # Validate a production build without changing docs/ or the version
npm test               # Vitest (jsdom)
npm run check          # Tests + non-mutating production build
npm run push:dry-run   # Preview the clean-tree deployment commands
npm run push           # Test, build, commit docs/, push the current branch
```

Maintainer shortcuts — wrappers around the above, runnable from any directory (see `scripts/README.md`):

```bash
./scripts/restart.sh   # restart this repo's server, then wait for HTTP 200
./scripts/build.sh     # production build into docs/ (add --test to run tests)
```

---

## Project structure

```text
index.html                        Single-page app shell (sidebar + canvas + controls)
.nvmrc                            Supported local Node major
build.js                          esbuild bundler, version management, dev server
version.json                      Auto-incremented build number
push.js                           Clean-tree, current-branch GitHub Pages deploy helper

scripts/                          Maintainer convenience wrappers (run from anywhere)
  restart.sh                      Owned-process restart/boot — refuse foreign port holders, verify HTTP 200
  build.sh                        Production build into docs/ (--test also runs tests)
  README.md                       Usage reference for these scripts

src/
  main.js                         RoutePlotter class — app entry point and orchestrator core
  app/                            RoutePlotter prototype mixins (method groups moved out of main.js;
                                  attached via Object.assign — wiring, playback, undo/redo, camera,
                                  viewport, path timing, persistence, exporting, editor panel, pointer,
                                  semantic scene-outline integration)
  config/
    constants.js                  All tuneable values (animation, rendering, path, etc.)
    keybindings.js                Mouse + keyboard bindings (customisable via localStorage)
    helpContent.js                Welcome modal and inline help HTML generators
    tooltips.js                   Tooltip definitions
  components/
    SwatchPicker.js               Okabe-Ito colour-blind safe palette picker
    Dropdown.js                   Accessible dropdown menus
    Tooltip.js                    Tooltip attachment
    ParamTooltip.js               Click-label parameter tooltips (Carbon pattern)
  controllers/
    UIController.js               Sidebar controls, waypoint list, slider sync
    SectionController.js          Collapsible settings sections
    SceneOutlineController.js     Native lazy scene outline, authoring forms, focus and draft state
  core/
    EventBus.js                   Pub-sub event system
    PlayerCore.js                 Pure timeline math — segments, pause budgets, beacon schedules,
                                  timeline↔path mapping; play/scrub/export share this one evaluation path
  player/
    PlayerApp.js                  Headless app core for exported HTML files (real render stack,
                                  adopts the app's own timing mixins)
    playerEntry.js                Exported-page boot + transport controls (bundled → docs/player.js)
    playerAccessibility.js        Static scene summary and discrete transport announcements
  handlers/
    InteractionHandler.js         Captured Pointer Events, keyboard, and drag-and-drop input
  models/
    Waypoint.js                   Waypoint data model (position, style, camera, area, etc.)
    AnimationState.js             Playback state (progress, timing, pause tracking)
    ImageAsset.js                 Custom image references (marker, path head)
    GraphNode.js                  Active flow-network node model
    GraphEdge.js                  Active weighted directed edge with control points
    GraphModel.js                 Active network collection (CRUD, adjacency)
  services/
    AnimationEngine.js            Demand-driven preview scheduler and transport timing
    PathCalculator.js             Catmull-Rom spline, reparameterisation, curvature
    RenderingService.js           Canvas drawing — path, markers, labels, overlays
    BeaconRenderer.js             Animated waypoint effects (ripple, glow, pop, grow, pulse)
    TextLabelService.js           Text label layout, fade, auto-positioning
    MotionVisibilityService.js    Path/waypoint/background visibility calculations
    CameraService.js              Per-waypoint zoom with target-aware interpolation
    CoordinateTransform.js        Image ↔ canvas coordinate conversion
    VideoExporter.js              MP4/WebM export (WebCodecs primary, MediaRecorder fallback)
    HTMLExportService.js           Self-contained HTML export with embedded player
    ImageAssetService.js          Custom image management and deduplication
    StorageService.js             localStorage with debounce and change detection
    UndoService.js                150-step undo/redo history
    AreaDrawingService.js         Polygon area drawing mode
    AreaEditService.js            Area highlight repositioning and vertex editing
    AreaHighlightRenderer.js      Per-waypoint area highlight rendering
  utils/
    CatmullRom.js                 Catmull-Rom spline interpolation
    Easing.js                     Easing functions (linear, quad, cubic, etc.)
    entityId.js                   Persisted structural-ID boundary
    focusTrap.js                  Modal focus trapping for accessibility
    sceneSemantics.js             Pure canonical-project projection for the scene outline

styles/
  tokens.css                      Design tokens — UoN palette, semantic colours, spacing
  main.css                        Core layout, sidebar, canvas, controls, modals
  swatch-picker.css               Swatch picker grid (5×2, 44px AAA touch targets)
  dropdown.css                    Dropdown component styles
  tooltip.css                     Tooltip styles

tests/
  *.test.js                       Unit, integration, golden-frame, persistence, safety, and UI contracts
  review*.test.js                 Regression contracts added from repository reviews
  projectLimits.test.js           Adversarial project/model resource ceilings
  releaseSafety.test.js           Build/deployment argument and dry-run safety
  setup.js                        Vitest jsdom setup

reviews/                          Historical review evidence and continuation dossier
  README.md                       Index, provenance and cross-project filename guard
  route-plotter-v3-comprehensive-repository-review-2026-08-26.md
                                  Full pre-remediation review at commit cec0191
  route-plotter-review-finding-crosswalk-2026-08-26.md
                                  RP-01–RP-18 remediation and residual-ticket map
  route-plotter-review-remediation-continuation-prompt-2026-08-26.md
                                  Paste-ready next-chat development handover

docs/                             Build output served by GitHub Pages
```

---

## Architecture

### Overview

`RoutePlotter` (in `main.js`) is the single orchestrator. It owns all services, handles EventBus events, manages application state, and drives the render loop. Since the Phase 1 split its method groups live as prototype mixins in `src/app/*` (attached via `Object.assign(RoutePlotter.prototype, …)` at the bottom of `main.js`); `main.js` itself keeps only the constructor, init, model bookkeeping, and render scheduling. Method names must stay unique across all mixins.

There is no framework. The app is pure JavaScript with Canvas 2D rendering and vanilla DOM for the sidebar UI.

### Event-driven communication

Components talk through `EventBus` (pub-sub), not direct method calls:

```text
Captured canvas gesture → InteractionHandler emits one terminal event
    → main.js handles event, updates Waypoint model
    → main.js calls queueRender()
    → RenderingService draws the frame
```

```text
User moves slider → UIController emits event
    → main.js handles event, updates state
    → main.js recalculates timing / path
    → main.js calls queueRender()
```

### Key event categories

| Event prefix | Source | Purpose |
| --- | --- | --- |
| `waypoint:*` | InteractionHandler, UIController | Add, delete, select, move, restyle waypoints |
| `animation:*` | AnimationEngine, UIController | Play, pause, reset, speed, seek |
| `ui:*` | UIController | Slider sync, mode changes, export triggers |
| `video:*` | VideoExporter | Export lifecycle (started, progress, complete, error) |
| `area:*` | AreaDrawingService, AreaEditService | Area highlight draw/edit |
| `undo:*` | UndoService | State snapshot/restore |
| `scene-outline:*` | SceneOutlineController, RoutePlotter | Semantic snapshots, stable-ID authoring commands, validation feedback |

### Rendering pipeline

1. `queueRender()` coalesces editor mutations, while `AnimationEngine` schedules preview frames only for active transport or visible camera settling; a stable paused view leaves no frame queued.
2. `render()` builds a `renderState` object from current waypoints, animation progress, motion settings, camera, and preview mode.
3. `RenderingService` draws layers in order: background → tint overlay → area highlights → path → waypoints → labels → path head → beacons.
4. `MotionVisibilityService` computes per-frame visibility/opacity for path, waypoints, and background based on animation progress and the active visibility mode.
5. `CameraService` applies zoom/pan transforms from per-waypoint camera keyframes.

### Coordinate systems

Waypoints are stored in **normalised image coordinates** (0–1). The `CoordinateTransform` service converts between:

- **Image coords** (`imgX`, `imgY`) — storage and serialisation.
- **Canvas coords** (`x`, `y`) — rendering and hit-testing.

Zoom, pan, and fit/fill mode are handled inside the transform. Path points are recalculated when the canvas resizes.

---

## Persistence and export

### Auto-save (localStorage)

State is debounce-saved to `routePlotter_autosave` on every change and loaded
on startup. Recovery is deliberately model-only: it never stores original
background/custom-image bytes or their original filenames. Custom marker and
path-head references are replaced with loadable built-in fallbacks in the
recovery snapshot, while the live project remains unchanged. **Save Project**
is the durable option for preserving images. Pending recovery is flushed on
`pagehide`, and **Clear All** also removes the old recovery point so cleared
work cannot return on reload.

Other localStorage keys: `routePlotter_preferences`, `routePlotter_splashShown`, `routePlotter_customKeybindings`.

### Project save/load (ZIP)

Save Project packages all state (including the background image) into a `.zip`
file. Open Project validates and decodes a detached candidate before replacing
the current project; any failure leaves the live project, assets, history, and
autosave unchanged. ZIP and standalone HTML exports embed the retained original
PNG, JPEG, or WebP data URL without canvas/JPEG re-encoding; export stops with a
clear error if those source bytes are unavailable. Explicitly shared exports
may contain original custom-image filenames and asset metadata.

### Import safety limits

Imported images must be PNG, JPEG, or WebP and are limited to 16 MiB, 8,192 px
on either axis, and 24 megapixels each. A project ZIP is limited to 50 MiB
compressed, 256 entries, 64 MiB decompressed, 2 MiB of project JSON, 128 image
assets, 40 MiB of asset bytes, and 48 megapixels across those assets. Model
ceilings include 2,000 waypoints, 32 flow layers, 256 emitters, 20,000 dots,
10,000 graph nodes, 20,000 graph edges, and 10,000 polygon points. Files above
these ceilings are rejected before live state changes. Persisted waypoint,
flow-layer, emitter, graph-node and graph-edge IDs are limited to 256
characters so high-cardinality projects cannot amplify one structural value;
display names and labels retain their separate text budget.

### Video export

- **MP4**: H.264 via WebCodecs + [mediabunny](https://www.npmjs.com/package/mediabunny) muxer. Explicit frame timestamps avoid background-timer stretching; hardware acceleration is requested but capability-probed at runtime. Requires even dimensions (auto-rounded).
- **WebM**: VP8 via WebCodecs + mediabunny, with a manually clocked MediaRecorder fallback when the exact required APIs pass runtime probes. Browser/version support remains release-tested rather than assumed.
- Configurable resolution (up to 7680×4320), frame rate (10–60 fps), aspect ratio presets, and path-only (transparent) mode.

### HTML export

Self-contained HTML file with embedded base64 background image, the full project data, and the app's own player runtime (`docs/player.js`, inlined at export time). The exported player runs the same PlayerCore/SwarmEngine/RenderingService stack as the app, so crowds, beacons, pauses, camera, labels, and area highlights replay exactly as previewed — including the authored timeline, which is preserved verbatim regardless of the viewer's window size. Interactive transport: play/pause, scrubbing, keyboard, playback speed. 80–95% smaller than equivalent video.

---

## Versioning

Format: `major.minor.build` (e.g. `3.1.530`).

- **major.minor** — set manually in `package.json`.
- **build** — auto-incremented in `version.json` once per dev-server start or production build.

The combined string is injected at build time via esbuild's `define` as `APP_VERSION`.

| Change | Version bumps? |
| --- | --- |
| Edit JS in `src/` | Build increments on next `npm run dev` restart or `npm run build` |
| Edit CSS/HTML only | No (static files are copied, not rebuilt) |
| Force bump after CSS | Restart the dev server, or run a production build |

---

## Keybindings

All shortcuts live in `src/config/keybindings.js`. User overrides are stored in `routePlotter_customKeybindings` localStorage key and merged at load time.

Each binding specifies: `key`, `modifiers` (meta/alt/shift), `action` (EventBus event name), `description`, and `category`.

`meta` maps to **Cmd** on macOS, **Ctrl** on Windows/Linux.

The in-app help panel (press `?`) renders all bindings dynamically from this config.

---

## Constants reference

All tuneable values are in `src/config/constants.js`, grouped by concern:

| Group | Key values |
| --- | --- |
| `ANIMATION` | `DEFAULT_SPEED` 200 px/s, `DEFAULT_DURATION` 10 000 ms, `DEFAULT_WAIT_TIME` 1 500 ms, `TARGET_FPS` 60 |
| `VIDEO_EXPORT` | `DEFAULT_FRAME_RATE` 25 fps, `DEFAULT_BITRATE` 20 Mbps, `START_BUFFER_MS` 2 000 ms |
| `RENDERING` | `DEFAULT_PATH_COLOR` #D55E00, `DEFAULT_DOT_SIZE` 8 px, `MINOR_DOT_SIZE` 4 px, `CONTROLS_HEIGHT` 80 px |
| `PATH` | `POINTS_PER_SEGMENT` 100, `DEFAULT_TENSION` 0.1, `TARGET_SPACING` 2 px, `MIN_CORNER_SPEED` 0.2 |
| `MOTION` | Trail default 20%, spotlight 10% canvas, AoV 60°/25%/50%, timeline handles 2 s + 3 s |
| `INTERACTION` | Hit radius 15 px, drag threshold 3 px, double-click 300 ms |
| `TEXT_LABEL` | 16–48 px font, 15% width, 0.85 bg opacity, 500 ms fade, 8-direction auto-position |
| `AREA_HIGHLIGHT` | Circle/rectangle/polygon, Okabe-Ito fill, configurable border, fade in/out, same visibility modes as waypoints |
| `STORAGE` | Autosave debounce 1 000 ms |

### Visibility mode enums

| Enum | Values |
| --- | --- |
| `PATH_VISIBILITY` | `always-show`, `show-on-progression`, `hide-on-progression`, `instantaneous` (comet), `always-hide` |
| `WAYPOINT_VISIBILITY` | `always-show`, `hide-before`, `hide-after`, `hide-before-and-after`, `always-hide` |
| `BACKGROUND_VISIBILITY` | `always-show`, `spotlight`, `spotlight-reveal`, `angle-of-view`, `angle-of-view-reveal`, `always-hide` |
| `TEXT_VISIBILITY` | `off`, `on`, `fade-up`, `fade-up-down` |
| `AREA_VISIBILITY` | Same five modes as `WAYPOINT_VISIBILITY` |

---

## Common development tasks

### Add a new per-waypoint property

1. Add the property with a default in `Waypoint.js` constructor.
2. Include it in `toJSON()` and handle it in `fromJSON()`.
3. Add a UI control in the appropriate `index.html` settings section.
4. Wire the control in `UIController.js` to emit an EventBus event.
5. Handle the event in `main.js` (update waypoint, call `queueRender()`).

### Add a new global setting

1. Add the value to the relevant state object in `RoutePlotter` constructor (`motionSettings`, `exportSettings`, `styles`).
2. Add a constant/default in `constants.js`.
3. Add UI control in `index.html`, wire in `UIController.js`.
4. Handle in `main.js`, persist in auto-save and project save/load.

### Modify canvas rendering

Edit `RenderingService.js`. Drawing methods follow the naming pattern `render*()`. The rendering order is defined in the `LAYERS` constants.

### Debug issues

- **Console**: The app intercepts `console.log/warn/error` into a 500-entry ring buffer. Use **Export → Download Debug Log** or **Copy Debug Log** to capture it as markdown.
- **Browser DevTools**: Check the Console tab and Network tab.
- **Version**: Shown in the header tooltip and page title.

---

## Gotchas

- **Don't edit `docs/`** — it is generated by the build. Edit source files in `src/`, `styles/`, or `index.html`.
- **Imports at top only** — esbuild bundles from `src/main.js`. Never import mid-file.
- **Coordinate transform** — always use `CoordinateTransform.canvasToImage()` / `imageToCanvas()` when converting between screen and storage positions.
- **Autosave is model-only recovery, not a project file** — backgrounds, custom
  image bytes, original image filenames, and unusable custom-image references
  are deliberately excluded; use **Save Project** for durable work.
- **Slider feedback loops** — programmatic slider updates must go through `ui:slider:update-speed` to avoid re-triggering input event handlers. Check `isUpdatingSlider` flag in `UIController`.
- **H.264 even dimensions** — MP4 export requires even width and height. The exporter auto-rounds, but custom resolution inputs can produce odd values.
- **Two runtime dependencies, both bundled** — mediabunny (MP4/WebM mux) and
  jszip (project save/load). Nothing loads from a CDN. Creating the first HTML
  export still reads the same-origin `player.js`; offline-first export is
  tracked as follow-up work. Everything else is vanilla JS.

---

## Glossary

Precise terms used across the codebase.

- **Route** — Full journey from first to last waypoint.
- **Path** — Interpolated Catmull-Rom spline connecting waypoints.
- **Path points** — Dense array of `{x, y}` coordinates defining the path.
- **Major waypoint** — Full-featured: labels, pauses, beacons, area highlights, larger marker.
- **Minor waypoint** — Path shaping only: smaller marker, no pause/label/beacon.
- **Marker** — Visual dot, square, flag, custom image, or none.
- **Path head** — Leading indicator at current animation position (arrow, dot, custom image, or none).
- **Beacon** — Animated effect at waypoints: ripple, glow, pop, grow, pulse.
- **Label** — Text attached to a waypoint with fade/visibility modes.
- **Area highlight** — Per-waypoint overlay region (circle, rectangle, or drawn polygon) with visibility timing.
- **Tint** — Background overlay from −100 (black) to +100 (white).
- **Spotlight** — Circular background reveal around the path head.
- **Angle of view** — Cone-shaped background reveal from the path head.
- **Trail** — In comet mode, the visible path segment behind the head.
- **Segment speed** — Per-segment speed multiplier (0.1x–10x).
- **Progress** — Animation position, 0.0–1.0.
- **Image coordinates** — Normalised 0–1 position on the background image. Used for storage.
- **Canvas coordinates** — Screen-pixel position. Used for rendering and hit-testing.
- **Graphics scale** — Global multiplier (0.25×–4×) applied to all vector element sizes.

---

## License

Route Plotter's first-party source is available under the [MIT License](LICENSE).
Third-party components retain their own terms; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Author

Joe Bell — University of Nottingham

## Links

- [Repository](https://github.com/djDAOjones/route-plotter)
- [Live demo](https://djdaojones.github.io/route-plotter/)
- [Live demo (frozen v2 line)](https://djdaojones.github.io/router-plotter-02/)
- [Issues](https://github.com/djDAOjones/route-plotter/issues)
- [Support policy](.github/SUPPORT.md)
- [Security policy](.github/SECURITY.md)

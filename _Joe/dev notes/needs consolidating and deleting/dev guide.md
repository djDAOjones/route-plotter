<!-- markdownlint-disable MD060 -->
# Developer Guide — Route Plotter

> Practical reference for changing, debugging, and extending the codebase.
> For feature overview, architecture summary, and glossary see `README.md`.

---

## 1. Purpose of this guide

This document is for anyone making changes to Route Plotter — whether
you are a human developer or an AI assistant generating code. It covers
the local development loop, how changes propagate through the codebase,
architectural rules that must not be broken, and the fragile areas
that have caused bugs before.

It deliberately does **not** restate the project overview, full file
tree, rendering pipeline, or glossary already covered in `README.md`.

---

## 2. Local development workflow

### Start / stop

```bash
npm run dev          # esbuild watch + dev server → http://localhost:3000
                     # Ctrl+C to stop
```

The server runs via esbuild's built-in `ctx.serve()` — there is no
separate HTTP server process.

### What happens on save

| You edit…              | What the build does                      | Browser update              |
|------------------------|------------------------------------------|-----------------------------|
| Any file in `src/`     | esbuild rebundles → `docs/app.js`        | Hard-refresh to see changes |
| `styles/*.css`         | Copied to `docs/` by file watcher        | Hard-refresh to see changes |
| `index.html`           | Copied to `docs/` with version injection | Hard-refresh to see changes |
| `images/*`             | Nothing (copied only at initial build)   | Restart `npm run dev`       |

There is **no hot-module replacement**. After any change, hard-refresh
(`Cmd+Shift+R`) or the browser may serve a stale cached bundle.

### Port 3000 already in use

```bash
lsof -i :3000          # find the PID
kill -9 <PID>          # terminate it
```

Then restart `npm run dev`.

### Clearing a stuck state

If the app starts in a broken state due to corrupt localStorage data:

1. DevTools → Application → Local Storage → delete keys starting with
   `routePlotter_` (especially `routePlotter_autosave`).
2. Hard-refresh.

Alternatively, `rm -rf docs && npm run dev` clears the build output
and rebuilds from scratch.

---

## 3. Build, deploy, and versioning

### Build commands

| Command                | What it does                                                |
|------------------------|-------------------------------------------------------------|
| `npm run dev`          | Watch + serve from `docs/` (dev mode, no minify)            |
| `npm run build`        | One-shot production build → `docs/` (minified, sourcemap)   |
| `npm run build:deploy` | `npm run build` then copies `dist/` → `docs/`              |
| `npm run push`         | Build, stage `docs/ version.json`, commit, push to `main`   |
| `npm test`             | Vitest (jsdom) — runs `tests/**/*.test.js`                  |
| `npm run test:watch`   | Vitest in watch mode                                        |

### Output directory: `docs/`

`docs/` is **both** the esbuild output directory **and** the GitHub
Pages source. It is checked into git. Never hand-edit files inside
`docs/` — they are overwritten on every build.

### Version format: `major.minor.build`

- **major.minor** — set manually in `package.json` `"version"` field.
- **build** — auto-incremented in `version.json` once per `npm run dev`
  session start or `npm run build` invocation. Subsequent hot-rebuilds
  within the same session reuse the same build number.
- The combined string is injected at build time as the global
  `APP_VERSION` via esbuild `define`.

| Change type         | Build number increments?                            |
|---------------------|-----------------------------------------------------|
| Edit JS in `src/`   | No — only on next `npm run dev` restart or `build`  |
| Edit CSS/HTML       | No (static copy, not a JS rebuild)                  |
| Restart dev server  | Yes (once per session)                              |
| `npm run build`     | Yes                                                 |

To force a bump after CSS-only changes: restart the dev server.

### Deploy to GitHub Pages

```bash
npm run push                 # auto-message: "chore: deploy v3.1.531"
npm run push "custom msg"    # custom commit message
npm run push --dry-run       # preview without executing
```

`push.js` runs `build:deploy`, stages `docs/ version.json`, commits,
and pushes to `origin/main`. GitHub Pages serves from `docs/` on
`main`.

---

## 4. How changes flow through the codebase

Almost every user-visible change follows one path:

```text
User input
  → InteractionHandler / UIController emits EventBus event
    → main.js (RoutePlotter) handles event
      → updates Waypoint model / state object / service
      → calls queueRender()  (batched via requestAnimationFrame)
        → RenderingService.render() draws one frame
```

### Key coupling points

- **main.js** (`RoutePlotter` class) is the sole orchestrator. It owns
  every service, handles every EventBus subscription, and manages all
  application state. Nothing talks to anything else directly.
- **UIController** translates DOM events into EventBus events. It never
  mutates waypoints or application state.
- **InteractionHandler** does the same for canvas mouse/touch/keyboard.
- **RenderingService** is a pure renderer: given a `renderState` object
  it draws a frame. It does not read or write application state.

### EventBus event categories

| Prefix        | Emitted by                         | Triggers                    |
|---------------|------------------------------------|-----------------------------|
| `waypoint:*`  | InteractionHandler, UIController   | Model update + render       |
| `animation:*` | AnimationEngine, UIController      | Timing update + render      |
| `ui:*`        | UIController                       | Slider sync, mode changes   |
| `video:*`     | VideoExporter                      | Export lifecycle             |
| `area:*`      | AreaDrawingService, AreaEditService | Area highlight operations   |
| `undo:*`      | UndoService                        | State snapshot / restore    |

### Rendering is always deferred

Never call `render()` directly from an event handler. Use
`this.queueRender()` which coalesces multiple requests into one
`requestAnimationFrame` callback.

### Persistence pipeline

Every state-mutating event handler ends with `this.autoSave()`, which
debounce-writes to `routePlotter_autosave` in localStorage (1 s
debounce). On load, `loadAutosave()` restores the full state including
waypoints, styles, motion settings, export settings, and animation
progress.

---

## 5. Architectural invariants

These rules are load-bearing. Breaking them causes subtle bugs.

1. **Waypoint coordinates are normalised (0–1).** Stored as `imgX`,
   `imgY` on the `Waypoint` model. Canvas-pixel positions are derived
   at render time via `CoordinateTransform`. Never store pixel coords
   on a waypoint.

2. **All imports at the top of the file.** esbuild bundles from
   `src/main.js` as a single entry point. Mid-file imports break the
   bundler and produce confusing errors.

3. **EventBus is the only communication channel between components.**
   UIController, InteractionHandler, and services never call methods
   on each other or on `RoutePlotter` directly. They emit events;
   `main.js` handles them.

4. **`docs/` is a build artefact.** It is committed for GitHub Pages
   but must never be hand-edited. Source of truth is `src/`, `styles/`,
   and `index.html` at the project root.

5. **Programmatic slider updates must use the `ui:slider:update-speed`
   event**, not direct `.value` assignment. Direct assignment triggers
   the slider's `input` handler, creating feedback loops. The
   `isUpdatingSlider` flag in UIController gates this.

6. **Style changes vs path-property changes vs position changes are
   distinct event types.** Emitting the wrong category causes either
   unnecessary path recalculation (expensive) or missing path
   recalculation (visual bug).
   - `waypoint:style-changed` — visual only, no path recalc.
   - `waypoint:path-property-changed` — triggers path recalculation.
   - `waypoint:position-changed` — triggers path recalculation.

7. **One runtime dependency: `mediabunny`.** Everything else is vanilla
   JS. Do not introduce frameworks or new npm dependencies without
   discussion.

8. **Colour data on the map must use the Okabe-Ito palette** (defined
   in `tokens.css` as `--map-series-*` and enforced by `SwatchPicker`).
   UI chrome uses the UoN semantic tokens. These two colour systems
   must stay separate.

9. **WCAG AAA compliance.** All text must meet 7:1 contrast. Touch
   targets must be ≥ 44px. Focus rings must be visible. No
   colour-only meaning.

---

## 6. Common change patterns

### Add a new per-waypoint property

1. **`Waypoint.js`** — add to constructor with a default; include in
   `toJSON()` and `fromJSON()`.
2. **`index.html`** — add the UI control in the appropriate settings
   section.
3. **`main.js` → `setupEventListeners()`** — wire the control's DOM
   event to mutate the waypoint and emit the correct EventBus event
   (`style-changed` or `path-property-changed`).
4. **`main.js` → `updateWaypointEditor()`** — sync the control when
   a waypoint is selected.

If the property affects rendering, also update `RenderingService` to
read it from the waypoint in the relevant `render*()` method.

### Add a new global setting

1. **`RoutePlotter` constructor** — add to the relevant state object
   (`motionSettings`, `exportSettings`, or `styles`).
2. **`constants.js`** — add a named default.
3. **`index.html`** — add UI control.
4. **`UIController.js` or `main.js` → `setupEventListeners()`** — wire
   the control.
5. **`autoSave()` / `loadAutosave()`** — persist and restore.

### Add a new visibility mode

1. Add the enum value to the relevant group in `constants.js`
   (`PATH_VISIBILITY`, `WAYPOINT_VISIBILITY`, etc.).
2. Add the `<option>` to the dropdown in `index.html`.
3. Implement the logic in `MotionVisibilityService`.
4. Handle in `RenderingService` where the mode is consumed.

### Modify canvas drawing

Edit `RenderingService.js`. Drawing methods follow the `render*()`
naming pattern. Rendering order is: background → tint → area
highlights → path → waypoints → labels → path head → beacons.

### Add a keyboard shortcut

1. Add the binding in `keybindings.js` under `DEFAULT_BINDINGS`.
2. The in-app help panel renders all bindings dynamically from this
   config — no separate docs update needed.

---

## 7. Change impact by subsystem

Use this table to estimate which files a change will touch.

| If you are changing…  | Expect to touch                                                           |
|-----------------------|---------------------------------------------------------------------------|
| Waypoint visual style | `Waypoint.js`, `main.js`, `index.html`, `RenderingService.js`            |
| Waypoint data/model   | `Waypoint.js`, `main.js` (autoSave, loadAutosave, editor sync)           |
| Animation timing      | `AnimationEngine.js`, `main.js` (duration calc, UI sync)                 |
| Path calculation      | `PathCalculator.js` or `PathCalculatorWithWorker.js`, `main.js`          |
| Sidebar UI layout     | `index.html`, `styles/main.css`                                          |
| Colour palette        | `SwatchPicker.js`, `styles/swatch-picker.css`, `tokens.css`              |
| Beacon effect         | `BeaconRenderer.js`, `RenderingService.js`                               |
| Video/HTML export     | `VideoExporter.js` or `HTMLExportService.js`, `main.js`                  |
| Camera/zoom           | `CameraService.js`, `RenderingService.js`, `main.js`                     |
| Area highlights       | `AreaDrawingService.js`, `AreaEditService.js`, `AreaHighlightRenderer.js`|
| Text labels           | `TextLabelService.js`, `RenderingService.js`                             |
| Coordinate transforms | `CoordinateTransform.js` — **high-risk, test thoroughly**                |
| Undo/redo             | `UndoService.js`, `main.js` (snapshot shape)                             |
| Persistence format    | `main.js` (autoSave/loadAutosave), `Waypoint.js` (toJSON/fromJSON)       |

---

## 8. Debugging workflow

### Console and debug log

The app intercepts `console.log`, `.warn`, and `.error` into a
500-entry ring buffer. Two export options in the sidebar:

- **Download Debug Log** — saves a `.md` file with system info + log.
- **Copy Debug Log** — copies the same content to clipboard.

The version string is shown in the header tooltip and page title.

### Step-by-step debugging

1. **Reproduce** — find the minimal interaction that triggers the bug.
2. **Console first** — open DevTools Console. Errors and warnings
   from the ring buffer appear here in real time.
3. **Add targeted logging** — `console.log('🔍 [area]', value)` with
   a prefix so you can grep. The ring buffer captures it.
4. **Check event flow** — if a UI control isn't working, verify the
   EventBus event is emitted (`console.log` in the emitter) and
   handled (`console.log` in `setupEventBusListeners`).
5. **Check coordinate space** — many rendering bugs are caused by
   mixing normalised image coords (0–1) with canvas pixel coords.
   Log both and compare.
6. **Check animation state** — `this.animationEngine.state` holds
   `isPlaying`, `progress`, `duration`, `speed`, `isWaitingAtWaypoint`.
   Log it in `render()` or `syncUIWithAnimationState()`.
7. **Check autosave** — if a property doesn't persist, verify it
   appears in the `autoSave()` serialisation and `loadAutosave()`
   deserialisation.

### Running tests

```bash
npm test               # single run
npm run test:watch     # re-run on save
```

Tests use Vitest with jsdom. The setup file (`tests/setup.js`) mocks
Canvas, `requestAnimationFrame`, `localStorage`, `Image`, and
`performance.now`. Tests import source modules directly (no build
step needed).

Note: some EventBus tests use `jest.fn()` — this works because Vitest
provides `jest` compatibility globals when `globals: true` is set.

### Network / loading issues

Check the Network tab. Common causes:

- Stale `app.js` cached by the browser (hard-refresh).
- Image asset 404 after moving files (check `staticFiles` array in
  `build.js`).

---

## 9. Fragile areas / gotchas

These have caused real bugs. Be careful here.

### Slider feedback loops

Programmatic slider updates (e.g. after reset or load) must go through
`this.eventBus.emit('ui:slider:update-speed', speed)`, never by
setting `slider.value` directly. Direct assignment fires the `input`
event handler with stale queued values, causing the speed to revert
to incorrect values. The `isUpdatingSlider` flag in `UIController`
protects against this.

### Animation duration after reset

`AnimationState.reset()` preserves speed but resets duration to the
default. The `animation:reset` handler in `main.js` must recalculate
duration from path length and speed, then update AnimationEngine. If
this step is skipped, the animation plays at the wrong speed.

### H.264 even dimensions

MP4 export requires even width and height (H.264 4:2:0 chroma
subsampling). The exporter rounds automatically, but custom resolution
inputs can produce odd values. Always round export dimensions.

### mediabunny codec naming

The mediabunny muxer uses `'avc'` (not `'h264'`) for
`EncodedVideoPacketSource`. It also requires `avc: { format: 'avc' }`
(AVCC framing, not Annex B) for the MP4 container.

### WebCodecs backpressure

Video export uses the encoder's `'dequeue'` event for backpressure
yielding. Using `setTimeout` polling instead will starve the hardware
encoder output callback and hang the export.

### Web Worker fallback

`PathCalculatorWithWorker` starts a Web Worker for off-thread path
calculation. If it fails (e.g. due to `file://` origin or CORS), it
falls back silently to main-thread `PathCalculator`. This means path
calculation will block the UI but still work.

### Coordinate transform

`CoordinateTransform.canvasToImage()` and `.imageToCanvas()` handle
the mapping between normalised image space and canvas pixels. When
debugging click-position or rendering-position bugs, always check:

- Is the image loaded? (transforms are undefined without dimensions)
- Are you using `imgX/imgY` (normalised) vs pixel `x/y`?
- Is viewport zoom/pan applied?

### `docs/` is committed

Unlike most projects, `docs/` is not gitignored — it is the GitHub
Pages deploy target. `npm run push` handles this automatically. Do not
add `docs/` to `.gitignore`.

### Autosave data shape

If you add a property to the save format, existing users' autosave
data won't have it. Always provide defaults in `loadAutosave()` for
missing fields — never assume a key exists.

### DOM element references

`RoutePlotter.elements` is populated in the constructor via
`document.getElementById()`. If you add a new control to
`index.html`, add the corresponding element reference here and use
optional chaining (`?.`) when accessing it, as controls may be
absent in test environments.

---

## 10. AI-assisted development guidance

### Scoping changes

- **Read `README.md` first** for architecture context. Read this
  guide for change mechanics.
- **Identify the event type** before writing code. Is the change a
  style-only change, a path-affecting change, or a position change?
  This determines which EventBus event to emit and whether path
  recalculation is needed.
- **Check the impact table** (§7) to know which files will be touched.
- **Prefer single-file changes** when possible. Most visual tweaks
  need only `RenderingService.js`. Most UI wiring changes need only
  `main.js`.

### Making minimal changes

- Don't reorganise code you weren't asked to touch.
- Don't add or remove comments unless instructed.
- Don't introduce new abstractions (classes, helpers, files) for a
  single use case. The codebase is already modularised; use existing
  patterns.
- Match existing code style: 2-space indent, single quotes, no
  semicolons only where the file already omits them (this codebase
  uses semicolons).

### Serialisation checklist

When adding any new property that should persist:

1. Default in `Waypoint.js` constructor (or relevant state object).
2. `toJSON()` includes it.
3. `fromJSON()` reads it with a fallback default.
4. `autoSave()` in `main.js` serialises it.
5. `loadAutosave()` in `main.js` restores it.
6. Verify round-trip: save → reload → value preserved.

### Testing expectations

- Unit tests live in `tests/` and cover models, utils, and core
  services (Waypoint, AnimationState, PathCalculator,
  CoordinateTransform, EventBus, Easing, CatmullRom).
- Full integration testing is manual: load the app, exercise the
  feature, check console for errors.
- If you add a new model method or utility function, add a test.
- Never delete or weaken existing tests without explicit instruction.

### Build verification

After any change:

```bash
npm run build          # does it bundle without errors?
npm test               # do existing tests still pass?
```

Then manually verify in the browser with hard-refresh.

---

## Uncertainties requiring manual verification

These items were inferred from the codebase but may need confirmation:

1. **EventBus test compatibility** — the test file uses `jest.fn()`.
   This relies on Vitest's `globals: true` providing Jest-compatible
   APIs. If tests fail on `jest is not defined`, replace with
   `vi.fn()` from Vitest.
2. **Web Worker in dev mode** — `PathCalculatorWithWorker` may fail
   silently on `file://` origins. The fallback is main-thread
   calculation. If path calculations feel slow during dev, this may
   be why.
3. **`build:deploy` vs `build`** — the `build:deploy` script runs
   `build` then copies `dist/` → `docs/`, but the build itself
   already outputs to `docs/`. The `dist/` intermediate may be
   vestigial. Verify whether `build:deploy` is actually needed or
   whether `build` alone suffices for deploy.

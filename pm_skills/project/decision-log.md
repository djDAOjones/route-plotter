# Decision Log

<!-- Append new decisions at the top. Don't edit old entries. -->

## 2026-08-18 — Phase 2 scene model: Scene/FlowLayer/Emitter land, saves go to coordVersion 9

**Task:** Phase 2 of the v3.0 refactor — the layered-scene data model and
additive save/load (backlog Phase 2; founding + salvage entries 2026-08-17).

**Shipped:**
- `src/models/Emitter.js` — one dot stream's authored parameters plus its
  per-emitter seed. Full founding vocabulary: dotCount, speed,
  speedVariance, dotSize, dotColor, lifecycleMode
  (disappear/respawn/loop/collect), releaseStart/releaseDuration,
  onsetVariance, intensityRamp, wobble. Zero transient state — dots are
  computed by the Phase 3 engine as a pure function of
  (timelineMs, layer, seed) and never stored.
- `src/models/FlowLayer.js` — guide network + emitters. `guideType`
  'graph' | 'route' (hero route reused as a guide, per the founding
  decision); a layer always owns its GraphModel so switching guide type
  never loses data. This is the salvaged GraphModel's first wiring.
- `src/models/Scene.js` — ordered flow layers (index 0 bottom; all flow
  layers draw beneath the hero route); CRUD, reorder, clear. The hero
  route stays `RoutePlotter.waypoints` — the Scene model carries flow
  layers only.
- Persistence: coordVersion 7→**9** (8 skipped — the fork's graph-only
  saves used it). v9 = the v7 shape + an additive `scene` block; pre-v9
  saves load unchanged with an empty scene (MIN_COORD_VERSION stays 6).
  Scene is cleared by `clearAll()` and included in undo snapshots, so
  Phase 4 editing gets undo by construction.

**Decision — emitter timing is an onset window on the master timeline**
(owner's call, 2026-08-18, over fork-style free-running releasePeriod and
over "whole timeline only"). Each emitter's dots onset within
releaseStart/releaseDuration; default window = the whole timeline. All
candidate parameterisations were determinism-safe — the mandate constrains
evaluation, not vocabulary — so the window won on expressiveness
(mid-animation crowd arrival) and on dotCount being an exact promise
rather than a rate-dependent cap.

**Decision — the release window is normalised (0–1 fractions of the
timeline), not milliseconds.** Timeline duration is derived (route length
÷ speed, plus pauses) and shifts constantly during authoring; absolute
windows would drift out of range. Both fields clamp independently; an
overhanging window (start + duration > 1) is kept as authored and clipped
by the engine at evaluation time.

**Decision — full founding vocabulary in v9 from day one** (owner's call
over a fork-proven-fields-only format). onsetVariance/intensityRamp/wobble
are persisted now with defaults; Phase 3 may refine ranges but not names.
Adding defaulted fields later stays legal within v9 if the engine needs
more (e.g. a wobble frequency).

**Verification:** 204/204 tests (was 158) — four new suites: Emitter,
FlowLayer, Scene, and a scenePersistence contract suite that binds the
persistence/undo mixins to a fake app and pins the additive-format rules.
Live browser pass at v3.1.589: the owner's real v7 autosave upgraded to
v9 in place (3 waypoints intact, empty scene block added); a
programmatically authored scene (graph + seeded emitter, mid-timeline
window) survived autosave → reload as real model instances with exact
params; no console errors; the owner's autosave was backed up first and
byte-for-byte restored after the test.

---

## 2026-08-17 — PlayerCore teardown: the scene is now a pure function of timeline time (Phase 1 complete)

**Task:** Phase 1 item 3 — PlayerCore extraction + deterministic
animation-core teardown + scrub-vs-play golden-frame harness.

**Decision — PlayerCore owns all timeline math.** New `src/core/PlayerCore.js`
(pure, no wall-clock, no mutation): segment building, pause building, beacon
schedules, and the timeline↔path mappings. AnimationEngine keeps its public
surface (setSegmentMarkers/setPauseMarkers/timelineToPathProgress/
pathToTimelineProgress and the marker fields the HTML export serialises —
shapes unchanged) but every mapping delegates to PlayerCore; the engine's
remaining jobs are transport state and wait-event edge-detection
(`_applyWaitState`). Play advances time, scrub sets it, export steps it —
one evaluation path.

**Decision — beacon phases are closed-form.** Every animator's
`update(deltaTime, phase, …)` accumulation (plus the `_lastHoldTime`/
`_lastLoopTime`/pauseElapsed sync hacks) is replaced by
`sync(localSec, win, options)`: full visual state derived from the beacon's
local clock `timelineMs - clockStartMs`, where clock starts and hold windows
come from PlayerCore's per-waypoint schedules (`engine.beaconSchedules`).
Consequences: reverse playback and backward scrubbing render beacons exactly
(rings un-fade, completed beacons revive); pulse's exit-crossing is computed,
not frame-detected; ripple ring state rebuilds per evaluation.

**Decision — grow pauses are exact, runtime extension deleted.** One
early-onset formula (`PlayerCore.beaconEarlyOnsetMs`: lead capped by the
half-gap to the previous major) feeds BOTH the pause budget and the beacon
schedule, so the scale-down always completes inside the precomputed pause.
The `isGrowBeaconAnimating` hook, the mid-evaluation marker mutation /
`timeShiftApplied` machinery, and the interim export fixed-frame-delta patch
(+ its test) are all deleted. The export render-loop gate stays as a plain
perf optimisation.

**Known behaviour deltas (deliberate):** grow early-onset now uses exact
path-times with a half-gap-to-previous-major cap (the engine and renderer
previously used two *different* approximations — the drift the 750ms buffer
papered over; buffer retained as visual margin). Ripple pause budgets read
`rippleMaxScale` (the value the rings actually use) rather than the stale
`beaconScale`. `pathToTimelineProgress` now includes start-handle/intro
offsets, making it a true inverse under export handles and reveal intros.
Pulse under hide-before begins its loop after its full 2-quarter onset
(previously desynced by one quarter). Per-frame SegSpeed/Timeline debug
traces were dropped with the duplicated math; `dumpSegmentState()` remains.

**Verification:** `tests/goldenFrames.test.js` — sequential jittered playback,
reverse traversal, and fixed-step export stepping each equal direct seeks in
full scene state (path + waits + every beacon field); evaluation provably
never mutates the timeline; grow completes by pause end; backward scrub
revives beacons byte-identically. `tests/playerCore.test.js` pins builders,
budgets, windows, and inverse mappings. 158/158 tests; ESLint sweep clean.
Live in the throttled pane: seek-into-beacon renders mid-animation state,
end-and-back round-trip identical, reverse JKL un-fades rings, and a 105-frame
MP4 exported clean at 1.1fps (fully throttled) with zero console errors and
no interim patch.

**Scope:** new `src/core/PlayerCore.js`; `AnimationEngine.js` (−~350 lines),
`BeaconRenderer.js` (all five animators + service update), `RenderingService.js`
(timeline-time beacon sync; fixed-delta machinery removed), `exporting.js`,
`playback.js`, `main.js` (hook removal); tests: goldenFrames + playerCore
added, exportFrameDelta removed (superseded).

---

## 2026-08-17 — Export slowdown when browser inactive: fixed-frame-delta interim fix

**Task:** Owner report — video export "encodes weirdly (slowed animation)"
unless the browser stays active during export.

**Mechanism (confirmed in code + live):** the export loop itself is
deterministic — `seekToProgress(progress)` per frame with explicit WebCodecs
timestamps — but `RenderingService.renderBeacons()` advanced beacon animators
by **wall-clock delta between renders**. Foreground encodes only looked right
because the loop happens to run near real-time; in a background tab the
loop's `setTimeout` yields stretch to ~1s, advancing beacon phases ~25x per
encoded frame, and grow-beacon pause extension (driven by those same clocks)
mutates the progress→time map mid-export — the hero motion stretches through
the extended sections. Exactly the stateful-animation defect class from the
founding entry, showing up in encodes.

**Decision — pin beacon time to encoded-frame time during export.**
`RenderingService.setFixedFrameDelta(seconds)`: when set, beacon updates
advance by exactly that delta per rendered frame (export sets 1/frameRate,
clears to wall-clock in the export `finally`; unpinning re-arms the
wall-clock tracker so the first live frame never inherits an export-length
delta). Because fixed-delta renders are time-advancing, the AnimationEngine
update callback now skips rendering while `_isExportMode` — the export loop
owns rendering (previously duplicate renders were harmless only because
wall-clock deltas are render-count-independent).

**Interim, not the fix:** the PlayerCore teardown still replaces accumulation
with closed-form beacon phases; this patch (and its `_isExportMode` render
gate) should be removed as part of that work — noted on the backlog item.

**Verified live in the throttled in-app browser** (unfocused pane = the
failing environment): 75-frame MP4 export completed; all 76 beacon updates
during export received exactly 0.100s (1/10fps), none wall-clock — proving
both the pin and the render gate; post-export preview resumed on the 0.016s
bootstrap. `tests/exportFrameDelta.test.js` pins the selection logic
(145 tests total).

**Scope:** `RenderingService.js`, `src/app/exporting.js`,
`src/app/playback.js`, `tests/exportFrameDelta.test.js`.

---

## 2026-08-17 — Phase 1 enabling refactor: main.js mixin split + renderer layer registry

**Task:** Phase 1 items 1–2 — split the 6,235-line `main.js` and formalise
the vector draw order — as groundwork for the PlayerCore teardown (item 3).

**Decision — prototype mixins, not class inheritance or delegation.** Twelve
method groups moved verbatim into `src/app/*` modules, each exporting a plain
object attached by `Object.assign(RoutePlotter.prototype, …)` at the bottom of
`main.js`: wiringDom, wiringBus, wiringControllers, undoRedo, playback,
camera, viewport, pathTiming, persistence, exporting, editorPanel, pointer.
`main.js` (6,235 → ~1,120 lines) keeps only the app core: constructor, init,
model bookkeeping, render scheduling, image loading, destroy. `this` semantics
and the runtime prototype shape are unchanged (bundle grew 214 bytes — module
wrappers only). Constraint this creates: **method names must stay unique
across all mixins** (last-write-wins otherwise) — `tests/mixins.test.js`
fails loudly on a collision.

**Deviations from verbatim (all deliberate):** `static JKL_MAX_SPEED` became
a module const in `playback.js` (statics cannot ride a prototype mixin);
`snapToAngle()` moved to `src/utils/snapToAngle.js` (needed by two wiring
mixins; unit-tested); per-file imports trimmed to what each file uses.

**Decision — vector draw order is data, not code.** The hard-coded sequence
in `RenderingService.renderVectorLayerTo()` became the static
`RenderingService.VECTOR_LAYERS` registry (bottom → top: area-highlights,
path, path-head, beacons, waypoints, area-edit-handles, area-draw-preview).
Each entry guards its own visibility; shared per-frame derivations ride a
`frame` object. Phase 2 flow layers (swarms beneath the hero route) insert by
adding an entry between area-highlights and path. `tests/vectorLayers.test.js`
pins the order and the ALWAYS_HIDE guards.

**Verification:** build + 142/142 tests (11 new); one-off ESLint no-undef
sweep over `src/` clean (the two remaining warnings are pre-existing unused
locals, left verbatim); interactive in-app-browser pass — waypoint add/drag,
play/scrub, JKL (L×3 → 4x, J reverse, K reset-on-pause), undo/redo exact
position round-trip, zoom-to-waypoint, Edit/Preview toggle, autosave reload —
zero console errors. Two environment findings worth keeping: the embedded
browser throttles rAF when unfocused, freezing the engine clock between
forced frames (confirms the delta-time accumulation the PlayerCore teardown
exists to kill), and keyboard shortcuts are correctly swallowed while a
slider (e.g. `#timeline-slider`) holds focus — test keys with body focus.

**Scope:** `src/main.js`, new `src/app/*` (12 files), `src/utils/snapToAngle.js`,
`src/services/RenderingService.js`, `tests/mixins.test.js`,
`tests/vectorLayers.test.js`, README tree/orchestrator note. v3.1.580+.

---

## 2026-08-17 — Dot-crowd salvage: recovered fork state, GraphModel landed, coordVersion goes to 9

**Task:** Before archiving dot-crowd-navigator, verify the local OneDrive
working copy held nothing unpushed (founding-entry gate).

**Finding:** It held a lot. The fork's last local state (2026-05-03, never
pushed) was a working standalone graph editor — clean ~700-line app shell,
GraphModel/GraphRenderer/GraphInteractionHandler/GraphUIController, JSON
save/load with graph-only autosave at coordVersion 8, zoom/pan, undo — plus
Phase 2 core: SimulationState (9 tests), SwarmEngine (7 tests, weighted
routing, 4 lifecycle modes), DotRenderer, and sim controls UI. OneDrive
file-offloading (~2026-07-14) then destroyed most of `src/`. Recovered:
tracked files from git; newer files from Windsurf local-history snapshots.
Unrecoverable (agent-written, no history entries): SwarmEngine.js,
SimulationState.js, DotRenderer.js, GraphUIController.js — their test
suites survive. Full story: SALVAGE-NOTE.md in the archived fork.

**Decision — carried into v3 now:** `GraphModel.js` + its 25 tests land in
src/models/ and tests/ (unwired until Phase 2, same treatment as
GraphNode/GraphEdge — total graph tests now 62). Fork memory, the two
swarm test suites, and the recovered graph-editor source are archived under
`specs/dot-crowd-navigator/` as Phase 2–4 reference.

**Decision — tick() API superseded, behaviour retained.** The recovered
SwarmEngine tests specify a stateful `tick(deltaMs)` engine — exactly the
architecture the deterministic-timeline mandate forbids. v3 carries the
*behavioural* spec (release scheduling, weighted junction choice, lifecycle
modes disappear/respawn/loop/collect, normalised dot positions) into the
pure `evaluate(timelineMs, layer)` design; the tick-based tests are kept as
reference only, not ported as-is.

**Decision — coordVersion for the layered scene is 9, not 8.** The fork's
local builds already shipped a *different* coordVersion 8 (graph-only JSON,
clears v≤7 data). v3 skips 8 entirely to keep the number unambiguous:
7 = current route-only, 9 = layered scene (routeLayer + flowLayers).

**Repo state:** dot-crowd-navigator final state pushed (as-found +
restoration commits) and the repo archived; router-plotter-01 archived.
router-plotter-02 stays live as the frozen v2 line.

---

## 2026-08-17 — Route Plotter v3 founding: fresh repo, dot-crowd fold-in, deterministic-timeline mandate

**Task:** Owner-commissioned review of router-plotter-02 (mature) vs
dot-crowd-navigator (nascent) to decide whether the dot-swarm concept folds
into the route-plotter line, and to found the v3 refactor.

**Finding that reframed everything:** git history proves dot-crowd-navigator
is router-plotter-02 copied at v3.1.530 (2026-04-12) — a rename plus two
unwired model classes (`GraphNode`, `GraphEdge`, 232 LOC, 37 passing tests)
and spec docs. The swarm was never built. "Merge the apps" therefore means
"build the swarm feature inside this codebase, guided by the fork's spec".
Verdict from adversarial cross-review: viable; conflicts are sequencing
risks, not incompatibilities.

**Decision — v3 is this fresh-history repo (`route-plotter`).** Imported
router-plotter-02 @ v3.1 build 573 (commit 5b19787) as the initial commit.
router-plotter-02 keeps its name and stays frozen as the v2 line, so the
deployed v2 Pages URL (djdaojones.github.io/router-plotter-02/) keeps
working while v3 matures. dot-crowd-navigator and router-plotter-01 will be
archived on GitHub after cherry-picking, gated on a diff of the local
OneDrive working copies to confirm no unpushed work (the fork's overview doc
references a `Migration.md` and a more advanced state that exist nowhere on
GitHub).

**Decision — supersedes dot-crowd AGENTS.md "no linear routes" invariant.**
The fork's spec forbade Waypoint/linear-route abstractions; v3 explicitly
adopts a coexistence model instead: a **layered scene over one master
timeline** — the existing Waypoint chain remains the narrative "hero route"
layer, and new **flow layers** (guide networks built from the ported
GraphNode/GraphEdge, or the hero route reused as a guide) carry emitters
with the fork's swarm vocabulary (count, release window, onset variance,
speed variance, intensity ramp, wobble, lifecycle). The fork's spec docs are
archived under `specs/dot-crowd-navigator/` as the feature-vocabulary source.

**Decision — deterministic-timeline mandate (animation-core teardown).**
Owner reports v2 scrubbing sometimes disagreed with real-time playback and
requested a total teardown. Review confirmed the mechanism class:
`BeaconRenderer` animators accumulate `this.time += deltaTime` with
pause-sync/monotonic-hold hacks, and Grow beacons mutate timeline duration
at runtime (`isGrowBeaconAnimating` dynamically extends pauses) — so
duration is not a pure function of project state, and seek and play can
diverge. Mandate for all v3 work: **the scene is a pure function of
(timelineMs, projectState, seed)** — no wall-clock or delta-time
accumulation in any renderer; beacon phases become closed-form functions of
time-since-trigger; grow-beacon pause extension is precomputed into the
timeline, never applied mid-flight; play = advancing time, scrub = setting
time, export = stepping time, all through one evaluation path (the
`PlayerCore` extraction). The swarm engine inherits the same rule
(`hash(seed, dotIndex, hopIndex)` for per-dot variation), which makes video
export, scrubbing, reverse JKL, and undo correct by construction.

**Phases (backlog holds the living copy):** 0 stabilise (lockfile tracked,
es2022 esbuild targets, bundle JSZip, PM-Skills 4.7.0) → 1 enabling refactor
(main.js split, renderer layer registry, PlayerCore + timeline teardown) →
2 scene/flow-layer model (coordVersion 8) → 3 deterministic SwarmEngine +
batched DotRenderer → 4 authoring UI (first canvas tool-mode: Route/Flow,
Crowd sidebar section, graph gestures) → 5 HTML-export parity via
PlayerCore, docs, deploy.

**Scope:** pm_skills upgraded v2.3.0 → 4.7.0 (fresh install, v2 project
memory ported forward); GraphNode/GraphEdge + tests cherry-picked verbatim;
fork's AGENTS.md + overview archived to specs/dot-crowd-navigator/.

---

## 2026-06-18 — Segment-speed refinement: major-leg keyframing + Web Worker removal

**Task:** Backlog "Segment-speed model — audience-coherent leg timing" and its
dependent "Wider segment-speed range", preceded by the backlog-mandated
diagnosis spike.

**Latent bug fixed — Web Worker layer removed.** The spike found that
`PathCalculatorWithWorker` never initialised: esbuild downlevels
`new Worker(new URL(…, import.meta.url))` against the `chrome58/firefox57`
target (which predate `import.meta`), so the URL was invalid and the code
*always* silently fell back to the synchronous main-thread `PathCalculator`.
Decision: delete the worker layer (`PathCalculatorWithWorker.js`,
`src/workers/pathWorker.js`) and use `PathCalculator` directly. This makes
main-thread **corner-slowing** reparameterisation the single canonical path
behaviour (no hidden even-spacing fork) and drops dead async code.

**Decision — majors are the only timing keyframes.** One speed per
major-to-major leg; minors shape geometry but never split a leg or act as a
timing keyframe, and their `segmentSpeed` (incl. legacy saved values) is ignored
in playback. Mirrors the camera half shipped via `CameraService.toMajorKeyframes`
(2026-06-16). New `RoutePlotter.getMajorLegData()` aggregates majors + progress +
per-leg lengths and feeds `AnimationEngine.setSegmentMarkers()` one marker/leg.

**Decision — progress-span timing basis (kills the regime split).**
`PathCalculator.legTimingLengths(majorProgress, totalLength)` weights each leg by
its progress span × full path length, not summed pixel lengths. Payoffs: (1)
corner-slowing preserved (progress maps to corner-dense point index); (2) at
all-1.0x the legs sum to the full path length, so total duration equals
`calculatePathLength / baseSpeed` — playback is identical with or without a
custom leg speed (the old all-1.0x-vs-variable discontinuity is gone).
`getSegmentDurations()` (zoom rate-limit input) rewritten to the same basis so
its major→major aggregation stays correct.

**Folded in.** Range widened 0.2x–5.0x → **0.1x–10x** (symmetric log slider,
centred on 1.0x; only the `SEGMENT_SPEED` constant changed — mapping fns read it
dynamically). Segment-speed control now hidden for minors (mirrors the pause
control). HTML export needs no change: markers are serialised verbatim, so the
player replays the new leg timing automatically.

**Deferred (wish-list):** `getSegmentLengths()` / `calculateSegmentLengths()` are
now unused by timing; left in place to keep the change minimal.

**Scope:** `PathCalculator.js`, `main.js`, `UIController.js`,
`AnimationEngine.js`/`Waypoint.js` (doc comments). v3.1.569, build + 69 tests
green (3 new). In-browser feel-check pending user sign-off.

---

## 2026-06-17 — Path glow (Option B layered underlay) + HTML-export casing parity

**Task:** Next-milestone "Path glow effect" — an optional soft glow around the
path, named distinctly from the beacon "glow" style.

**Decision — Option B (layered additive underlay).** Glow is drawn as N
widening, translucent strokes beneath the casing using
`globalCompositeOperation = 'lighter'`, brightening toward the path centre.
Chosen over `ctx.shadowBlur` (B over A): shadowBlur is unreliable per-segment,
scales poorly across zoom, and is costly per frame. The maths live in a pure
static `RenderingService.glowLayers(baseWidthPx, intensity, extraScale)` →
`{width, alpha}[]` (widest first), so it is unit-testable without a canvas and
reused verbatim by preview, the partial head segment, and the HTML player.
Per-segment colour (not one global colour) so multi-colour routes glow in kind.
Defaults: 4 layers, +28px max extra width, 0.16 per-layer alpha, 0.5 intensity
(`RENDERING.PATH_GLOW_*`); halo width scales by zoom×graphics like the casing.

**Bonus fix — HTML-export casing parity.** The export `styles` payload
(`HTMLExportService.js:108`) is hand-picked and never included `showPathCasing`,
so the player's `styles.showPathCasing !== false` was always true — the casing
toggle was silently ignored in HTML exports. Since glow had to be added to that
same payload, `showPathCasing` was added too; HTML export now matches preview
(default-on, so the only behaviour change is that a casing-off export now omits
casing).

**Folded in.** (A) UI: Path casing moved into a new "Path emphasis" Carbon
fieldset with the glow toggle + intensity slider. (B) the white casing colour +
`+2px` extra-width literals are now `RENDERING.PATH_CASING_COLOR` /
`PATH_CASING_EXTRA_WIDTH` (no value change).

**Scope:** `constants.js`, `RenderingService.js`, `main.js`, `index.html`,
`styles/main.css`, `HTMLExportService.js`, `tests/units.test.js`. `pathGlow`
persists via `_syncGlobalStyleUI()` (undo/redo, autosave, project-open).
v3.1.563, build + 66 tests green (6 new `glowLayers` tests).

---

## 2026-06-17 — Console spam gated to console.debug (AnimationEngine)

**Task:** Next-milestone "Console spam gate" — the throttled per-frame
`console.log` in `AnimationEngine.pathTimeToPathProgress` (plus the related
segment-speed diagnostics) flooded the 500-entry console ring buffer and
polluted the Download/Copy Debug Log export during variable-speed playback.

**Finding:** the file already reserved `console.log` for exactly 7 verbose
segment-speed diagnostics while using `console.debug` for ~15 routine ones.
The ring-buffer interceptor (`main.js:28`) captures only
`['log', 'warn', 'error']` — not `debug`.

**Decision:** downgrade all 7 `console.log` sites to `console.debug`
(`pathTimeToPathProgress` transition + throttled per-frame; `setSegmentMarkers`
header + per-segment loop; `play()` header; `dumpSegmentState`;
`timelineToPathProgress` trace). This keeps them out of the ring buffer / Debug
Log export *and* hidden at the default console level (verbose is suppressed by
default), while preserving the diagnostics for opt-in DevTools debugging —
matching the file's dominant `console.debug` pattern. Chosen over deleting them
(reversible, keeps tooling) and over a new DEBUG flag (no such pattern exists);
the throttle guards (`_debugFrameCount`/`_debugLogInterval`/`_debugLastSegIdx`)
are left intact.

**Scope:** `src/services/AnimationEngine.js` only (7 lines, `console.log` →
`console.debug`). No behavioural change. v3.1.562, 60/60 tests green.

---

## 2026-06-17 — Undo granularity verified (no change); Edit/Preview header reflow fixed

**Task:** Diagnosis (verify-don't-trust) on two Current-milestone items —
"undo snaps at too-fine increments" and "Edit/Preview warning rejigs the
header". Both task-brief leads were wrong on specifics.

**Undo — no change.** The mouse-drag path already collapses one drag into one
undo entry: `InteractionHandler` emits `position-changed {isDragging:true}`
during the drag (`InteractionHandler.js:243`), the `main.js` handler skips the
save while dragging (`main.js:1848`) and saves once on `drag-ended`
(`main.js:1860`); `calculatePath()` emits no cascading events. Verified working
with the user. The only fine-grained path is arrow-key nudge (one debounced
save per tap, by design — `main.js:2227`). Backlog item closed, no code change.

**Header reflow — fixed.** The warning is a red herring:
`.export-warning` (absolute), `.highlight-warning` (box-shadow) and the export
tip (fixed toast) are all out of flow. The cause is `.mode-label.active`
switching `font-weight` 500→600 (`styles/main.css:226`, toggled by
`_updateModeSwitch` `main.js:3243`) — the bolder active label is wider, so each
Edit↔Preview toggle resizes `.mode-switch` and shifts the flex
`.header-controls`. Fixed by dropping the `font-weight:600` (active state is
already multi-signal: pill bg + darker text + box-shadow), CSS-only — v3.1.561,
60/60 tests green.

**Aside:** `showExportModeWarning()` (`main.js:5350`) is dead — queries a
non-existent `#export-mode-warning` (CSS class is `.export-warning`); the toast
already covers it. Parked on the wish-list.

**Scope:** Header fix in `styles/main.css` (one declaration removed); plus memory (backlog, trajectory, wish-list, this log).

---

## 2026-06-17 — Sidebar calmness: waypoint list + swatch picker (UI polish)

**Task:** Two Current-milestone "UI polish and UX" items — calm the waypoint
list (item 4) and reduce the swatch picker's visual weight (item 3). User chose
the low-risk "inline tidy" direction over a swatch popover redesign. CSS-only.

**Waypoint list (item 4):**

- **Progressive disclosure:** at rest a row shows only its colour dot + name;
  the drag handle, ▲/▼ reorder buttons, and delete `×` reveal on
  `:hover`/`:focus-within`. Hidden controls use `opacity:0` (layout stays
  stable — space reserved) plus `pointer-events:none` so the invisible delete
  can't be mis-clicked; both restore on reveal. Keyboard users get the controls
  via `:focus-within`, so nothing becomes unreachable.
- **Reorder button size:** grew from 24×16 to **24×22 px** so the two stacked
  buttons total exactly the 44 px row height — larger than before with *no*
  hover row-growth jank. **AAA exception (documented):** WCAG 2.5.5's 44 px
  per button is infeasible for a stacked dual reorder control in a dense list
  (would need 88 px / doubled rows); 24×24 (the AA 2.5.8 square) would regrow
  the row 4 px on every hover — itself a calmness regression. 24×22 is the
  chosen balance; reorder is also keyboard- and drag-operable.

**Swatch picker (item 3):** the inline 5×2 grid can't shrink below ~88 px
because each `.swatch-option` cell is `min-height:2.75rem` (44 px) for WCAG
2.5.5 — a hard floor. So visual weight was reduced by shrinking the colour
*chip* from filling the cell to `height:2rem` (32 px), centred; the 44 px
clickable cell is untouched. The larger popover redesign (single current-colour
swatch → grid on click) is parked in the backlog Icebox.

**Scope:** `styles/main.css`, `styles/swatch-picker.css` only. No JS/HTML.

**Verified:** `npm run build` (v3.1.557) + 60/60 tests green. Visual
confirmation of the lighter/calmer sidebar pending user review (canvas/CSS not
unit-tested).

---

## 2026-06-17 — Export "Include in export" group + reduced-motion beacons (glow)

**Task:** Two Current-milestone "UI polish and UX" items — consolidate the
Export inclusion controls into one checkbox group (item 8) and close the
reduced-motion beacon gap (item 7). Also verified the keyboard-reorder item
(item 5) was already shipped.

**Export include group (item 8):**

- **Decision:** Replaced the `Included` `<select>` (with-image / path-only)
  with a Carbon `<fieldset>` "Include in export" of three checkboxes —
  Background image, Camera movement, Text labels. The camera/text checkboxes
  (shipped 2026-06-16) moved into the group unchanged; the image toggle is new.
- **Minimal churn:** kept the `video:layers-change(pathOnly)` event and its
  `main.js` handler; only the *source control* changed (checkbox →
  `pathOnly = !checked`). New id `export-include-image`; element ref renamed
  `exportLayers` → `exportIncludeImage`. `UIController` shares `main.js`'s
  `elements`, so the ref changed in one place.
- **Correctness fixes folded in:** the `video:layers-change` handler now calls
  `autoSave()` (previously it didn't — the image preference could fail to
  persist), matching the camera/text handlers; and `openProject` now syncs the
  image checkbox (it previously synced only camera/text, leaving the inclusion
  control stale after a project load).
- **AAA:** native fieldset/legend grouping (semantic, no ARIA); each row given
  `min-height:2.75rem` (44px target, WCAG 2.5.5). Sentence-case labels.

**Reduced-motion beacons (item 7):** the guard suppressed only `pulse`/`ripple`;
`glow` (a ~3s animated radial bloom) still played under
`prefers-reduced-motion`. Added `glow` to the skip set (effect held static,
marker at normal scale). `pop`/`grow` remain — brief one-shot reveal
transitions, not continuous motion (WCAG 2.3.3).

**Keyboard reorder (item 5):** confirmed already complete — ▲/▼ buttons with
aria-labels, boundary `disabled`, and `announce()`. Residual nit: the buttons
are 24×16px (below the 44px AAA target) and `opacity:0` until hover/focus-within;
migrated to the "waypoint list calmness" backlog item to keep that row-chrome
rework in one place, rather than fixed here.

**Scope:** `index.html`, `src/controllers/UIController.js`, `src/main.js`,
`src/services/BeaconRenderer.js`, `styles/main.css`. Event contract unchanged.

**Verified:** `npm run build` + 60/60 tests green. Manual canvas / checkbox /
persistence / reduced-motion verification pending user confirmation.

---

## 2026-06-17 — restart.sh stops the whole dev tree, not just the port (orphan fix)

**Symptom:** After a `restart.sh` shutdown — and on the next restart — a
`node build.js --watch` process (plus its npm / `restart.sh` wrappers) was left
running; repeated restarts accreted orphaned watchers.

**Root cause:** esbuild's `ctx.serve()` binds the port from a child "service"
process, so `lsof -ti :3000` returns the **esbuild child**, not its
`node build.js --watch` parent. The original `free_port()` killed only the port
listener, orphaning the node parent (which keeps the esbuild service and file
watchers alive). This corrects the kill-scope claim in the entry below
("only PIDs on port 3000").

**Fix:** replaced `free_port()` with `dev_pids()` + `stop_dev()`. `dev_pids()`
unions the port listener (`lsof -ti :3000`) with the parent
(`pgrep -f 'build.js --watch'`); `stop_dev()` sends TERM to the set, then KILL
to survivors only. Still scoped to this project's dev server — never a broad
`pkill node`. Called both pre-boot and from the Ctrl-C / TERM `cleanup` trap.

**Verified:** fresh boot → 1 watcher, HTTP 200; restart while already running →
exactly 1 watcher (old script exits); close-out (TERM, the same `cleanup`
handler as Ctrl-C) → 0 watchers, 0 port listeners, script exited. Docs
(DEV-INFRASTRUCTURE recovery playbook, `scripts/README.md`) updated to match.

---

## 2026-06-17 — Maintainer run/build scripts (scripts/)

**Task:** Add ergonomic, tracked entry points for running and rebuilding —
`scripts/restart.sh` (clean restart/boot) and `scripts/build.sh` (rebuild).

**Decisions:**

- **Codify, don't reinvent.** `restart.sh` is the scripted form of the
  DEV-INFRASTRUCTURE Recovery playbook (free port 3000 → `npm run dev` →
  hard-refresh), not new behaviour; `build.sh` wraps `npm run build`. Both
  resolve the repo root so they run from any CWD.
- **Honour the one-command-runtime-recovery invariant (AGENTS.md).** Kill
  scope is *only* PIDs on port 3000 (graceful TERM, then KILL survivors) —
  never a broad `pkill node`. Readiness is a `curl` poll for HTTP 200, not
  "process launched" (we had a print-Serving-then-crash incident, see entry
  below). Destructive actions are gated: default restart deletes nothing;
  only `--hard-reset` removes `docs/` (documented generated output);
  `version.json`/`src/`/`_Joe/` are never touched.
- **Tracked, not personal.** Lives in `scripts/` (version-controlled) with a
  short `scripts/README.md`, superseding the untracked `_Joe/` helper. Made
  executable; also runnable via `bash` since OneDrive can drop the +x bit.
- **No npm aliases** added (kept to the shell-script request); easy to add
  `npm run restart` later if wanted.

**Verified:** `build.sh` builds clean (v3.1.548); `restart.sh` freed the port,
booted, and reported HTTP 200 (v3.1.549) with a single listener; `--help`
works on both.

---

## 2026-06-16 — Dev server survives OneDrive watch churn (build.js)

**Symptom:** `npm run dev` exited 1 mid-session and `localhost:3000` stopped
loading; log showed `Serving at http://undefined:3000` and a rapid loop of
`Static file changed: index.html`.

**Root cause:** this workspace is OneDrive-synced; sync repeatedly touches and
swaps file inodes. The static-file `fs.watch` calls in `build.js` had no
`error` handler, so an inode swap surfaced as an unhandled FSWatcher error →
uncaught exception → process exit 1. (The `undefined` host was a separate
cosmetic bug: current esbuild `ctx.serve()` returns `{ hosts: [...] }`, not
`{ host }`.)

**Fix:** added a `watcher.on('error', …)` handler and wrapped the copy in
try/catch so transient sync failures are logged and ignored, not fatal; the
serve log now prints `http://localhost:${port}` directly. No change to the
recovery procedure — `npm run dev` remains the one command.

**Verified:** clean restart serves HTTP 200 (v3.1.547); host log fixed.

---

## 2026-06-16 — Interactive control colour + contrast (UoN blue, 3:1 borders)

**Task:** Two Current-milestone UI items — sliders/switches should read UoN
dark blue not black; interactive elements need a ≥3:1 non-text boundary
(WCAG 2.2 SC 1.4.11). CSS/token-only.

**Key finding:** control fills already referenced `--interactive-01`
(= `--uon-blue` `#003A65`, ~11.7:1 on white) — it *passes* contrast but reads
near-black at small sizes, and a couple of sliders (`.sidebar-control-row`,
`.control-row-inline`) set no accent, so they fell back to the UA default. So
"not black" was a perception + consistency gap, not a contrast bug.

**Decisions:**

- **Colour (A1):** added a semantic `--control-accent` / `--control-accent-hover`
  seam (= `--uon-blue` / `--uon-nottingham-blue`) and pointed every control
  fill at it (section + timeline thumbs, `.mode-toggle` on-state,
  `.segment.active`, checkboxes). Added `accent-color` on `body` so *all*
  native controls inherit UoN blue — kills UA-default/black fallbacks in one
  line. Kept `#003A65` as the value; the seam allows a one-place retune later.
  Normal text colour untouched.
- **Borders (B1):** interactive boundary = `--border-interactive` `#767676`
  (4.53:1). Added a 1px rail border to the two custom sliders
  (`.section-content`, `.timeline-slider`; rails were `--ui-03` ≈1.2:1), gave
  the `.mode-toggle` OFF state a visible border (ON sets it transparent — navy
  fill is already 11.7:1), and flipped the interactive containers
  (`.segmented-control`, `.mode-switch`) from passive `--border-subtle` to
  `--border-interactive`. Repaired `--border-control` (was `#BDBDBD` ≈1.9:1,
  failed 3:1 → now aliases `--border-interactive`).
- **Adjacent fix:** `.segment.active` used an undefined `--text-on-color`,
  rendering the selected Edit/Preview tab as near-black text on the navy fill
  (~1.3:1). Repointed to `--text-04` (white inverse, 11.7:1) — a one-line fix
  on a line already being edited.

**Kept separate:** UoN UI tokens vs Okabe-Ito map palette — no map colours
touched. No colour-only meaning: switch state is carried by fill + thumb
position, selection by border + contrast.

**Scope:** `styles/tokens.css` + `styles/main.css` only. No JS/HTML.

**Verified:** `npm run build` (v3.1.544) + 60/60 tests green. Visual smoke-load
pending user confirmation (canvas/CSS not unit-tested).

---

## 2026-06-16 — Camera zoom: keyframe over major waypoints only (bug fix)

**Bug:** With two 4x majors and a minor between them, the follow-cam zoom
dipped toward 1x at the minor (preview + MP4/WebM + HTML export).

**Root cause:** Zoom was keyframed over *every* waypoint.
`CameraService._findWaypointSegment()` walked the full waypoint list and
each `Waypoint.camera.zoom` defaults to 1, so a minor injected a 1x
keyframe → interpolation ran 4x→1x→4x. The camera UI was already
major-only ("This/Next Zoom" read the next *major*,
`main.js:_updateCameraControls`), so the engine was the part out of step.

**Decision:** Make minors transparent to the camera by feeding the
keyframer a *majors-only* waypoint+progress set. Chosen over filtering
inside `CameraService` so the interpolation/smoothing/rate-limiter maths
stay untouched and the service stays generic ("keyframe over whatever
you're given"). New invariant: **camera zoom keyframes over major
waypoints only; minors shape path geometry, never zoom.**

**Mechanism:**

- New pure `CameraService.toMajorKeyframes(waypoints, progressValues)` →
  index-aligned majors-only arrays (unit-tested).
- `main.js:_calculateCameraState()` passes the filtered arrays. Head
  position still derives from full `pathPoints`, so panning is unaffected.
- **HTML export mirror:** the embedded player's `findWaypointSegment` /
  `calculateTargetZoom` / `hasZoom` filter on `isMajor !== false` (already
  embedded). Same predicate in both so indices align.
- **Rate-limit warning:** `main.js:validateZoomTransitions()` now builds
  major→major pairs with durations aggregated across spanned minors —
  otherwise short minor sub-segments would raise false warnings.

**Not touched:** `AnimationEngine.setSegmentMarkers()` (timing still
keyframes every waypoint). That is the same minors-as-keyframes shape and
the *shared* half of the Next-milestone "segment-speed model" item — but
that item has separate contributors (`MIN_CORNER_SPEED`, the all-1.0x vs
variable-speed regime split) and needs its own spike. Mirror this
majors-only approach there when it lands.

**Verified:** `npm run build` (v3.1.542) + 60/60 tests (added a
regression test proving full-list dips to ~1x and majors-only holds 4x).
Manual smoke confirmed by user: preview holds 4x across the minor.

---

## 2026-06-16 — Export toggles: without-camera / without-text

**Decision:** Added `exportSettings.includeCamera` / `includeText`
(default true), surfaced as two Carbon checkboxes in the Export section.
Chosen design = Option A: gate the raster/preview render; shape the HTML
export data. Never mutate the live waypoint model.

**Mechanism:**

- **Camera:** `_calculateCameraState()` returns identity when
  `!includeCamera` (alongside the existing `!previewMode` guard) — flat
  view in preview + export.
- **Text:** render state carries
  `suppressLabels = !includeText && (previewMode || _isExportMode)`;
  `RenderingService.renderVectorLayerTo` skips `renderLabel`. WYSIWYG in
  Preview, full suppression during export, labels always shown in plain
  Edit mode.
- **HTML:** `HTMLExportService` shapes `PROJECT_DATA` (per-waypoint
  `camera.zoom = 1` so the player's `hasZoom` check is false; `label =
  ''`) — no embedded-player JS changed.

**Persistence:** both keys added to autoSave + project-save; explicit
`!== undefined` restore + checkbox sync in `loadAutosave`; checkbox sync
after the project-load `Object.assign` (`!== false` so old saves default
to included).

**Naming:** positive `includeX` (checkbox checked = included), inverse
to the legacy `pathOnly`. Events `video:camera-change` /
`video:text-change` mirror `video:layers-change`.

**Deferred:** consolidating the Export "Included" select + these toggles
into one checkbox group → `wish-list.md`.

**Verified:** `npm run build` + 57 tests green. Manual canvas/HTML
verification pending.

---

## 2026-06-16 — Roadmap: six incoming requests triaged + batched

**Context:** Six requests (segment-speed range; first-leg speed
coherence; path glow; zoom-returns-to-1x; export-without-camera;
export-without-text) scoped against source before any code.

**Key finding — shared root cause:** Minor waypoints act as full
*timing and camera keyframes*, contradicting the documented "minors
shape geometry only" model. `CameraService._findWaypointSegment()`
keyframes over every waypoint and each `Waypoint.camera.zoom` defaults
to 1, so a minor between two zoomed majors interpolates 4x→1x→4x — the
"zoom returns to 1x" report. The camera UI already implies
major-to-major ("This/Next Zoom" read the next *major*), so the engine
is the part out of step. Timing has the same per-leg-incl-minors
structure in `AnimationEngine.setSegmentMarkers()`.

**Decisions:**

- **Camera 1x dip = bug, lands in Current.** Fix by keyframing zoom over
  major waypoints only (minors pass through). Aligns the engine to the
  existing UI contract; low ambiguity.
- **Segment-speed model rethink needs a diagnosis spike first.** Lean:
  minors = geometry only, majors = timing keyframes. But corner-slowing
  reparameterisation (`MIN_CORNER_SPEED`) and the all-1.0x vs
  variable-speed regime split are separate contributors to "first leg
  feels different" — confirm before committing. Goes to Next (rework,
  not a clear-cut bug); shares the camera diagnosis.
- **Wider range sequenced after the model** to avoid tuning twice;
  proposed 0.1x–10x, slider stays log-centred on 1.0x.
- **Export-without-camera / -without-text batched together** — same
  pattern as existing `pathOnly` (temp state swap during export) plus
  4-place persistence; ship as one low-risk batch, first.
- **Path glow: global toggle**, distinct name from beacon "glow"; new
  render pass modelled on the casing pass.
- **HTML-export parity included** for glow + both export toggles
  (`HTMLExportService` has its own renderer — extra work accepted for
  consistency).

**Recommended order:** export toggles → camera fix → segment-speed
model + range → glow.

**Scope:** Memory only (`backlog.md` + this entry). No app code.

---

## 2026-06-16 — Pruned project memory

**Decision:** Migrated the lone shipped `[x]` item out of `backlog.md`
(shipped work has a budget of 0 there). Moved *Path casing toggle* to
`trajectory.md` as the first real phase entry (one line); its WHY was
already logged (2026-04-16). Removed the `## Completed` section and its
stale "read Active only" comment from `backlog.md`.

**Scope:** No `archive/` files created — content moved to the live
`trajectory.md`, not cold storage. All other memory files are within
budget. This clears the follow-up noted in the 2026-06-14 upgrade entry.

---

## 2026-06-16 — Fixed broken deploy path (`build:deploy` / `push.js`)

**Decision:** `build:deploy` was `npm run build && rm -rf docs && cp -r
dist docs`, but `build.js` writes straight to `docs/` and never creates
`dist/`. So `npm run push` built fresh `docs/`, deleted it, then copied
a stale, gitignored `dist/` (months old, 280 KB vs 479 KB) over it —
i.e. it would deploy old code. Simplified `build:deploy` to
`npm run build`; dropped `dist` from `push.js` `STAGE_TARGETS` /
`git add` / log messages; repointed `serve:dist` at `docs/`. Updated
`DEV-INFRASTRUCTURE.md` + `README.md` to match.

**Verified:** `node push.js --dry-run` shows build → stage `docs
version.json` → commit → push, with no `dist`. The bug was caught
during the code-review-phase2 deploy (done manually to avoid it). The
stale local `dist/` is harmless now that nothing references it.

---

## 2026-06-16 — `npm test` uses the threads pool (OneDrive workspace fix)

**Decision:** Changed `npm test` from `vitest run` to
`vitest run --pool=threads --no-file-parallelism` (and `test:watch`
to match) in `package.json`.

**Why:** Vitest's default `forks` pool times out starting its worker
in this OneDrive-synced workspace path, exiting 0 with "no tests" — a
silent false green. The 2026-06-14 entries noted forks "succeeds once
hydrated", but the timeout has proven consistent enough to need a
permanent fix rather than relying on warm `node_modules`. The
`threads` pool with `--no-file-parallelism` was verified green
(57/57, ~1s) and is now the canonical invocation.

**Scope:** `package.json` scripts + `DEV-INFRASTRUCTURE.md` canonical
scripts table (command + a "why" note). No source or test changes;
generated `docs/*`/`version.json` left untouched.

---

## 2026-06-14 — Code review phase 2: cleanups + coverage (branch code-review-phase2)

**Decision:** Continued the review ("go whole hog on the parked items").
Shipped the safe, verifiable improvements; deliberately deferred the two
high-surface, interaction-unverifiable items to a supervised session.

**Shipped (branch `code-review-phase2`, build + 57 tests green):**

- Canonicalised labelMode — normalise legacy `'none'` → `'off'` on load;
  `hasLabel()` now tests `!== OFF`; UIController editor fallback `'off'`.
- PathCalculator coordinate access uses `??` (a valid `0` coordinate is
  no longer discarded by falsy `||`).
- Removed unused `A11Y` constants and 4 dead `@deprecated` methods
  (reveal-mask ×2, tab no-ops ×2) — all verified zero callers.
- +13 unit tests (labelMode/hasLabel, getTextVisibility branches, log2
  slider round-trip, ImageAsset). Suite 44 → 57.

**Deferred, with reasoning:** a blind `main.js` split is organisational
only (no runtime benefit) and a ~40-site `render()`→`queueRender()`
migration both carry subtle interaction-regression risk I cannot verify
without a browser (no Playwright/interaction harness). Both are planned
concretely in `wish-list.md` for a supervised session. A few
`@deprecated` methods were left in place (internal whitespace makes
tool-based excision fragile).

---

## 2026-06-14 — Code review: restored test suite, fixed latent bugs

**Decision:** Ran a full code-review pass (auto-jazz, unsupervised) on
branch `code-review-autojazz`. Prioritised safe, high-value fixes over
risky refactors.

**What changed:**

- **Test suite restored (0 → 44 passing).** `npm test` was a silent
  false-green ("no tests", exit 0). Causes: (1) `tests/setup.js`
  assigned getter-only jsdom 27 globals (`performance`, `localStorage`,
  `Image`, URL helpers) via `global.x =`, throwing during setup;
  (2) `example.test.js` used `jest.fn()` in a Vitest project; (3) stale
  assertions (labelMode `'none'`, pixel-space PathCalculator input,
  removed Easing methods). Also discovered: the default forks pool times
  out on a cold OneDrive `node_modules` ("files on demand") and reports
  no tests; it succeeds once hydrated — a real false-green trap.
- **fix(waypoint):** `toggleType()` set `labelMode` to legacy sentinel
  `'none'` (invalid TEXT_VISIBILITY mode); aligned to `'off'` like
  `createMinor`/`copyPropertiesFrom`.
- **fix(app):** `destroy()` called non-existent methods
  (`pathCalculator.destroy`, `eventBus.removeAll`) and cancelled a
  boolean instead of a RAF id; corrected, and `queueRender()` now stores
  the frame id.
- **+18 unit tests** for pure model/service logic (`tests/units.test.js`).

**Deferred (wish-list — too risky unsupervised):** split 6057-line
`main.js`; direct `render()` → `queueRender()`; remove `@deprecated`
shims and unused `A11Y` constants; dead `Waypoint.hasLabel()`.

**Status:** committed to branch, not pushed/merged — awaiting review.

---

## 2026-06-14 — Upgraded pm-skills framework (pre-1.0.0 → 2.3.0)

**Decision:** Upgraded pm-skills from its pre-versioning state to
v2.3.0 via the framework's Legacy upgrade path (full-tree diff against
source, classified by `MANIFEST.md`).

**Version:** pre-1.0.0 (no `VERSION` file) → 2.3.0.
**Source:** <https://github.com/djDAOjones/PM-Skills> (shallow clone).

**What changed:**

- Added metadata `VERSION`, `CHANGELOG.md`, `MANIFEST.md` — the project
  is now versioned and future upgrades skip the legacy path.
- Overwrote 12 existing framework files (GUIDE, init, integrations
  bugfix/feature, 8 prompts) with their v2.3.0 versions.
- Added 15 new framework files (7 integrations incl. init-mvp,
  init-project, spec-to-prod, prune-memory, auto-jazz(-lite), upgrade;
  8 prompts incl. deploy, end-of-task, doctor-memory, next-batch,
  prune-memory, release, roadmap-refactor, upgrade).
- Created two new project-memory files from template: `trajectory.md`
  (warm — shipped-work narrative) and `wish-list.md` (cold — idea inbox).
- Merged root templates: `AGENTS.md` gained the Memory size budgets
  table, the Capturing deferred ideas section, the One-command runtime
  recovery hard rule, an updated Document-ownership table, and new
  anti-patterns; `DEV-INFRASTRUCTURE.md` gained a populated Runtime
  lifecycle section. `UI-STANDARDS.md` unchanged (already current).

**Local customisations:** none — existing framework files were vanilla
older versions (no project-specific edits found), so all were
overwritten cleanly. All populated content in the root templates was
preserved verbatim.

**Follow-up:** `backlog.md` still has a `## Completed` section; newer
pm-skills relocates shipped work into `trajectory.md` (one line) +
`decision-log.md` (the why). Migrate via `roadmap-refactor.md` /
`prune-memory.md` when convenient — deferred to keep this upgrade
lossless.

---

## 2026-04-16 — Path casing as a global style toggle

**Decision:** Add `showPathCasing` boolean to `this.styles` (default
`true`) with a checkbox in the right sidebar. Guards casing draws in
RenderingService (2 locations) and HTMLExportService (1 location).

**Rationale:** Simple global style property, no new event type needed.
Uses `!== false` guard so existing saves without the property default
to casing on (backward compatible).

---

## 2026-04-16 — Adopted PM-Skills framework for AI guidance

**Decision:** Replace the previous ad-hoc AGENTS.md + feature-scoping
workflow with the PM-Skills two-tier memory system.

**Rationale:** The previous system had a single AGENTS.md and one
Windsurf workflow. PM-Skills provides structured project memory
(brief, architecture, conventions, backlog, file-map, decision-log),
permanent behavioral contracts (AGENTS.md, UI-STANDARDS.md,
DEV-INFRASTRUCTURE.md), reusable prompt workflows, and Windsurf
integrations. Better discipline, cheaper AI sessions.

**Alternatives considered:**

- Keep the old system: simpler but lacked project memory, UI standards,
  dev infrastructure rules, and structured workflows.
- Build a custom system: more work, less battle-tested.

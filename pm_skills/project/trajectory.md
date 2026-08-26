# Trajectory

<!-- Shipped-work narrative. The story of what changed over time, in chunks. -->
<!-- Warm tier. Agents do NOT auto-read this every task. Read it on demand:
     during roadmap-refactor.md, release.md, or when reconstructing what
     already shipped. See AGENTS.md -> "Before every task". -->
<!-- Compress on ship. One line per item: the outcome, not the implementation.
     The WHY lives in decision-log.md; the per-file roles live in file-map.md.
     Never paste a decision-log entry in here. A pointer is enough. -->
<!-- Keep every shipped ID individually greppable: start each line with the
     item ID. When one line covers a group of related sub-items, spell out
     each ID (e.g. WL-19a, WL-19b, ... WL-19h) rather than a range, so an
     ID-level reconcile can find them all. -->
<!-- Structure: newest phase/milestone at the top. Group items by the phase or
     milestone they belong to, with a one-line Outcome per phase. -->
<!-- Budget: see AGENTS.md -> "Memory size budgets". Over budget -> prune-memory.md
     moves the oldest phases to archive/trajectory/trajectory-NNNN-<range>.md and
     adds a row to archive/INDEX.md. Archives are append-only; never rewrite. -->

## Performance (shipped 2026-08-26)

REV-06 — Stable paused editor and standalone-player views now leave no animation
frame queued; transport changes and camera settling wake on demand while the
explicit export frame loop stays synchronous. (2026-08-26) — see decision-log.

## Crowd controls (shipped 2026-08-26)

CROWD-02 — Crowds now author whole-release busyness with a direct line graph,
two-to-eight handles, gradual or sudden spans and equivalent exact controls;
the seeded profile is undoable and identical after reload and in export.
(2026-08-26) — see decision-log.

CROWD-03 — Crowds now expose plain-language seeded walking, pace, release and
route-choice variation, the exact reproducible seed and a one-step Re-roll
that changes the pattern without changing authored controls. (2026-08-26) —
see decision-log.

## Inspector foundation (shipped 2026-08-26)

UI-05 — Marker, On arrival, Label and Leg cards now reset the selected
waypoints to route style or apply one waypoint's settings to later applicable
waypoints as one accessible, undoable transaction; authored label text and
polygon geometry stay untouched. (2026-08-26) — see decision-log.

UI-04 — Multi-waypoint cards now compare each field's actual write targets and
show a transient, accessible Mixed state without changing saved projects;
choosing a value still performs the established shared edit. (2026-08-26) —
see decision-log.

UI-03 — Label text/background colour and opacity plus incoming camera zoom
transition are now editable under More, with exact custom-colour state,
multi-major writes, undo, reload and export-compatible persistence.
(2026-08-26) — see decision-log.

UX-02 — Label Size now edits its persisted 16–48 renderer-pixel value directly;
size, amplitude and background-overlay readouts expose their effective units
and accessible values; ambiguous names use plain language; and Pacing explains
Comet's intentional preview-tail extension. Stored project values, scaling and
timeline semantics are unchanged. (2026-08-26) — see decision-log.

UI-01 — Crowded inspector cards now keep their shortest complete task visible
and place refinements in one accessible native More disclosure, providing the
layout slot for advanced and crowd controls. (2026-08-26) — see decision-log.

## Review Phase 2 — semantic scene authoring (shipped 2026-08-26)

REV-02 — Route, crowd, emitter, custom-network and polygon structure is now
inspectable and authorable through a synchronized semantic outline; standalone
exports add aggregate scene context and discrete transport announcements.
(2026-08-26) — see decision-log.

## Support hand-off (shipped 2026-08-26)

SUPPORT-01 — Report a bug now previews one redacted diagnostic bundle before
any explicit copy, download or public-Issues hand-off, supplies a safe address
fallback and routes suspected vulnerabilities to private reporting.
(2026-08-26) — see decision-log.

## Phase 1 — live-app health and public boundary (shipped 2026-08-26)

KEY-01 — Undo, redo and Save now have one authoritative keyboard/button event
path; stale Tab navigation was removed. (2026-08-26) — see decision-log.

UX-01 — Waypoint scope now has a direct labelled Route target, avoiding
repeated back-arrow navigation. (2026-08-26) — see decision-log.

BUG-01 — Area-handle hit-testing now compares one coordinate space and remains
correct through viewport zoom and drag. (2026-08-26) — see decision-log.

QA-02 — Nudge undo grouping and editor restoration after undo/redo are pinned
as verified behaviour. (2026-08-26) — see decision-log.

CROWD-04 — Add crowd works without a hero route by creating a graph guide and
entering network authoring with neutral lifecycle copy. (2026-08-26) — see
decision-log.

CROWD-01 — Junction choices are edited together as normalised shares and
previewed with percentage text plus non-colour-only guide widths.
(2026-08-26) — see decision-log.

REV-08 — The public/share/support boundary is enforced by an explicit build
allowlist, CSP, safe style grammar, original-byte disclosure and previewed
redacted diagnostics. (2026-08-26) — see decision-log.

REV-09 — MIT terms, dependency notices, private vulnerability reporting and
best-effort GitHub Issues support now ship as checked governance contracts.
(2026-08-26) — see decision-log.

REV-10 — Custom marker and route-head images now use reference-aware asset
reachability, rollback-safe admission and minimum-oldest undo shortening at
the project limits; Clear, load, recovery and ZIP boundaries are pinned.
(2026-08-26) — see decision-log.

## Phase 0 — owner decisions and acceptance (closed 2026-08-26)

QA-01 — Owner accepted selection behaviour, standalone-player feel, major-leg
timing and the shipped 0.1×–10× segment-speed range. (2026-08-26) — see
decision-log 2026-08-26.

REV-02, REV-08, REV-09, ROUTE-01, SCALE-01 — Owner signed off the
semantic-authoring, publication/privacy, governance, simultaneous split-route
and project-reference sizing contracts; each implementation moved to its
dependency phase. (2026-08-26) — see decision-log 2026-08-26.

## REV-01 — comprehensive repository-review remediation (shipped 2026-08-26)

REV-01 — Project recovery/import is transactional and bounded; autosave is honest and Clear All cannot revive stale work; timeline/export behaviour is deterministic; keyboard, modal and responsive reflow defects are repaired; and CI, clean Pages builds, deployment and restart scripts fail safely. The larger product, assurance and governance questions remain as REV-02–REV-10. (2026-08-26) — see decision-log 2026-08-26.

## Phase 5 — parity & release (shipped 2026-08-19; PHASE 5 COMPLETE — v3.0 refactor milestone CLOSED)

Outcome: HTML exports run the app's real render stack — `src/player/PlayerApp.js` (bundled to `docs/player.js`, inlined into every export) replaces the 1,270-line template player; exports gain swarm layers and area highlights, preserve the authored timeline via the snapshot's `timingReference`, and render at export resolution. v3.2.618 released: GitHub Pages enabled — **https://djdaojones.github.io/route-plotter/ live** (v2 line stays up). Docs refreshed incl. the owner-approved dev-guide reconciliation; decision-log archived by month. See decision-log 2026-08-19 "Phase 5".

## Phase 4, items 2–5 — canvas affordances, layers strip + Crowd scope, network edit mode, multi-select everywhere (shipped 2026-08-18; PHASE 4 COMPLETE)

Outcome: the canvas answers back (hover rings, leg hit-testing + midpoint insert), crowds are authorable in two clicks (layers strip + Crowd scope cards), custom guide networks get the one true tool mode (pen chaining, node/edge cards, Esc ladder), and selection became an app-level set honoured by every card (Cmd+A works, canvas toggle, group delete/nudge, one undo entry per bulk change). See decision-log 2026-08-18 second/third/fourth/fifth slices.

## Phase 3 — deterministic swarm engine (shipped 2026-08-18; PHASE 3 COMPLETE)

Outcome: `SwarmEngine.evaluate(timelineMs, layer, context)` — pure hash(seed, dotIndex, hopIndex) dots with weighted graph walks, four lifecycle modes, route guide, wobble; batched DotRenderer drawing beneath the hero route via the `flow-layers` registry entry. See decision-log 2026-08-18 "Phase 3 swarm engine".

## Phase 2 — layered scene model (shipped 2026-08-18; PHASE 2 COMPLETE)

Outcome: `Scene` → `FlowLayer` (guide graph or hero route) → `Emitter` models with per-emitter seeds and normalised release windows; coordVersion 7→9 additive `scene` block (8 skipped); scene included in clearAll + undo snapshots. See decision-log 2026-08-18 "Phase 2 scene model".

## Phase 4, item 1 — scope-split inspector (shipped 2026-08-18)

Outcome: the sidebar is an inspector that names its subject — scope chip with prev/next stepping, waypoint cards (Marker · On arrival · Label · Leg → next · Area) vs route cards (Head · Pacing · Reveal · Path emphasis · Background · Video settings) swapped on selection, ghost state deleted, right sidebar reduced to the Waypoints list ready for the Layers strip. Markup + wiring only. See decision-log 2026-08-18 "Phase 4 first slice".

## Phase 3.5 — authoring-UI paper cuts (shipped 2026-08-18; PHASE 3.5 COMPLETE)

Outcome: all 15 review items landed same-day — one data bug (minor-detach on reorder), one data-corruption find (bulk thickness raw ints), the context menu (first right-click UI, revived the dead T-key toggle), single-writer editor controls, path head resolved global, duration discrepancy root-caused (preview tail gated on comet) — see decision-log 2026-08-18 "Phase 3.5 shipped".

## Phase 1 enabling refactor, item 3 — PlayerCore teardown (shipped 2026-08-17; PHASE 1 COMPLETE)

- PlayerCore extraction — `src/core/PlayerCore.js` owns all timeline math (segments, exact pause budgets, beacon schedules, timeline↔path mappings) as pure functions; AnimationEngine delegates and keeps only transport + wait-event edge-detection. See decision-log 2026-08-17 (PlayerCore teardown).
- Closed-form beacons — all five animators derive state from a timeline-local clock (`sync(localSec, win, options)`); delta-time accumulation, pause-sync hacks, and the grow runtime pause extension are gone; reverse scrubbing revives/un-fades beacons exactly. Interim export fixed-delta patch removed as planned.
- Golden-frame harness — `tests/goldenFrames.test.js` pins play == scrub == reverse == export stepping at the state level and proves evaluation never mutates the timeline; `tests/playerCore.test.js` pins the builders and windows.

Outcome: the scene is a pure function of (timelineMs, projectState) — the deterministic-timeline mandate is implemented for everything that exists today, ready for Phase 2's seeded flow layers. 158/158 tests; verified live incl. a fully-throttled 105-frame export with zero console errors. Phase 1 closed.

## Phase 1 enabling refactor, items 1–2 (shipped 2026-08-17)

- Export slowdown fix (owner report, interim) — beacon time is pinned to 1/frameRate per encoded frame during video export, so encodes no longer depend on the browser staying active (background-tab throttling used to speed wall-clock beacons ~25x/frame and distort grow-pause timing). Superseded by PlayerCore later. See decision-log 2026-08-17 (export slowdown).
- main.js mixin split — 6,235 → ~1,120 lines; twelve method groups moved verbatim to `src/app/*` prototype mixins (Object.assign onto RoutePlotter.prototype); snapToAngle now a tested util; mixin-collision guard test added. See decision-log 2026-08-17 (Phase 1).
- Renderer layer registry — vector draw order formalised as `RenderingService.VECTOR_LAYERS` (data-driven, bottom → top) so Phase 2 flow layers insert beneath the hero route by adding an entry; order + visibility guards pinned by tests. See the same entry.

Outcome: the orchestrator is navigable and the draw order is data; build + 142 tests green, interactive browser pass clean. Phase 1 now has one item left: PlayerCore extraction + deterministic animation-core teardown with the scrub-vs-play golden-frame harness.

## Route Plotter v3 founding + dot-crowd salvage (shipped 2026-08-17)

- v3 founding — fresh-history repo `route-plotter` created; router-plotter-02 imported @ v3.1 build 573 and frozen as the v2 line (its Pages URL stays live). See decision-log 2026-08-17 (founding).
- PM-Skills 4.7.0 — fresh manifest-verified install replacing embedded v2.3.0; v2 project memory ported forward.
- Graph models landed — GraphNode, GraphEdge, GraphModel + 62 tests cherry-picked/salvaged from the dot-crowd fork (unwired until Phase 2).
- Toolchain fix — package-lock.json now tracked; esbuild target chrome58/firefox57/safari11 → es2022 (fresh clones were unbuildable under esbuild 0.27.7).
- JSZip bundled — jszip 3.10.1 as a real dependency; CDN script-injection removed; offline save/load works.
- Dot-crowd salvage — the fork's never-pushed working state (graph editor + Phase 2 swarm core, partially destroyed by OneDrive offloading) recovered via git + Windsurf local history, pushed to the fork, mined into `specs/dot-crowd-navigator/`; dot-crowd-navigator and router-plotter-01 archived on GitHub. Four implementation files remain lost (their test suites survive). See decision-log 2026-08-17 (salvage) and the fork's SALVAGE-NOTE.md.

Outcome: v3 founded on the mature trunk with the swarm feature specced and its graph data layer already tested in-tree; build + 131 tests green. Phase 0 closed 2026-08-17 (memory reconciled, JSZip bundled, offline-capable). Next: Phase 1 — main.js split, renderer layer registry, PlayerCore + deterministic animation-core teardown.

## Path glow + casing parity (shipped 2026-06-17)

- Path glow (Next-milestone feature) — an optional soft, per-segment-coloured halo beneath the path casing, surfaced via a new "Path emphasis" fieldset (Path casing + Path glow toggle + intensity slider). Renders in preview, the animated head segment, and the HTML-export player → MP4/WebM/HTML parity; off by default, round-trips through autosave + project save/load + undo/redo. Layered additive underlay computed by the pure `RenderingService.glowLayers()` (unit-tested). See decision-log 2026-06-17.
- HTML-export casing parity (bonus) — `showPathCasing` was never in the export payload, so the casing toggle was silently ignored in HTML exports (casing always drew); added alongside `pathGlow` so HTML export now matches preview. See decision-log 2026-06-17.
- Casing constants (fold-in) — the white casing colour + extra-width literals are now `RENDERING.PATH_CASING_COLOR` / `PATH_CASING_EXTRA_WIDTH` (no value change).

Outcome: paths can carry an optional soft halo for legibility on busy maps, consistent across preview and all exports; the casing toggle now also applies to HTML export. v3.1.563, build + 66 tests green (6 new `glowLayers` tests).

## Diagnostics hygiene — console spam gate (shipped 2026-06-17)

- Console spam gate (Next-milestone item) — the 7 verbose segment-speed `console.log` diagnostics in `AnimationEngine` are now `console.debug`, so variable-speed playback no longer floods the 500-entry console ring buffer or the Download/Copy Debug Log export (verbose is hidden by default; the interceptor captures only log/warn/error). See decision-log 2026-06-17.

Outcome: the Debug Log export stays clean during variable-speed playback; diagnostics remain available at the DevTools verbose level. v3.1.562, build + 60 tests green.

## UI polish — undo verified + header reflow fixed (2026-06-17)

- Undo granularity (Current-milestone item) — the "undo snaps at too-fine increments" report was investigated and the mouse-drag path already collapses a drag to one undo entry (mid-drag saves suppressed via `isDragging`; one save on `drag-ended`). Verified working with the user; closed with no code change. See decision-log 2026-06-17.
- Edit/Preview header reflow (Current-milestone item) — fixed: the cause was `.mode-label.active` going `font-weight` 500→600 (not the warning, which is out-of-flow), widening the active label and shifting the header on every toggle. Dropped the weight bump; active state still reads via bg + colour + shadow. CSS-only, v3.1.561. See decision-log 2026-06-17.

Outcome: one UI-polish item closed as already-correct, one root-caused and fixed (CSS-only, build + 60 tests green); Current milestone now has only the blocked reflow-breakpoint item.

## UI polish — sidebar calmness (shipped 2026-06-17)

- Waypoint list calmness (item 4) — rows are calm at rest (colour dot + name); the drag handle, ▲/▼ reorder buttons, and delete reveal on hover/`:focus-within` (keyboard-reachable), and the reorder buttons grew from 24×16 to 24×22 px. See decision-log 2026-06-17.
- Swatch picker compaction (item 3) — colour chips shrank from filling the cell to 32px tall, lightening the three pickers while the 44px cell stays the tap target (AAA floor). The bigger popover redesign is parked in the Icebox. See decision-log 2026-06-17.

Outcome: the colour pickers and waypoint list read lighter and calmer; all controls stay keyboard-operable. CSS-only, build + 60 tests green; visual confirmation pending.

## UI polish — export inclusion + reduced motion (shipped 2026-06-17)

- Export "Include in export" group — the Export "Included" select plus the camera/text checkboxes are now one Carbon fieldset of three checkboxes (background image / camera movement / text labels); the image toggle persists immediately and syncs on project open, and rows are ≥44px AAA targets. See decision-log 2026-06-17.
- Reduced motion for beacons (glow) — `glow` joins `pulse`/`ripple` in the `prefers-reduced-motion` skip, so no continuous/multi-second beacon animation plays; brief one-shot `pop`/`grow` remain. See decision-log 2026-06-17.
- Keyboard waypoint reorder — verified already shipped (▲/▼ buttons with aria-labels, boundary `disabled`, screen-reader `announce()`); the residual <44px move-button target size migrated to the "waypoint list calmness" backlog item.

Outcome: the milestone's export-toggle thread is consolidated into one coherent group, reduced-motion now covers every continuous beacon, and the keyboard-reorder item is confirmed done. Build + 60 tests green.

## Dev runtime hardening (shipped 2026-06-17)

- Maintainer scripts — `scripts/restart.sh` (clean restart/boot with an HTTP-200 readiness poll) and `scripts/build.sh` (one-shot rebuild, `--test` also runs the suite), tracked wrappers that supersede the untracked `_Joe/` helper. See decision-log 2026-06-17.
- Dev server survives OneDrive watch churn — `build.js` static-file `fs.watch` now has an error handler + try/catch copy, so OneDrive inode swaps no longer crash the dev server (exit 1); the serve log prints the real `localhost` host. See decision-log 2026-06-16.
- restart.sh orphan fix — restart/shutdown now stops the whole dev tree (the port-3000 esbuild listener **and** its `node build.js --watch` parent), so no orphaned watcher accretes across restarts. See decision-log 2026-06-17.

Outcome: one documented, verified command (`./scripts/restart.sh`) reaches a known-good running state and tears it down cleanly — no OneDrive-sync crash, no orphaned watchers — satisfying the one-command-runtime-recovery invariant.

## Interactive control colour + contrast (shipped 2026-06-16)

- Slider and switch colours — sliders, switches, the timeline, and checkboxes now use a `--control-accent` token (UoN dark blue `#003A65`, not black), with a `body` accent-color so no native control falls back to the UA default. See decision-log 2026-06-16.
- Border role separation — interactive elements (slider/timeline rails, toggle off-state, segmented/mode-switch containers, the repaired `--border-control` token) carry a ≥3:1 non-text boundary via `--border-interactive`; passive dividers stay decorative. Also fixed the selected Edit/Preview segment's near-black-on-navy text. See decision-log 2026-06-16.

Outcome: controls read as UoN blue not black, interactive boundaries meet WCAG 1.4.11 (3:1), and the active Edit/Preview tab is legible; normal text stays black, Okabe-Ito map palette untouched. CSS/token-only (v3.1.544).

## Camera zoom fix (shipped 2026-06-16)

- Camera zoom drops to 1x at minor waypoints — zoom now keyframes over *major* waypoints only (minors shape geometry, not zoom), in preview, MP4/WebM, and HTML export. See decision-log 2026-06-16.

Outcome: two 4x majors either side of a minor hold ~4x across it; minors no longer inject a 1x keyframe.

## Export options (shipped 2026-06-16)

- Export without camera + Export without text — two persisted Export-section checkboxes (checked by default) that drop the follow-cam and/or waypoint labels from preview, MP4/WebM, and HTML export. See decision-log 2026-06-16.

Outcome: exports can omit camera movement and/or text labels; toggles reflect live in Preview and round-trip through autosave and project save/load.

## Path styling (shipped 2026-04-16)

- Path casing toggle — global right-sidebar switch to turn off the white path outline. See decision-log 2026-04-16.

Outcome: white path casing is now a global on/off style (defaults on for backward compatibility).

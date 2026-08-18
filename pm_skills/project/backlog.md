# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->

## Active

### Current milestone — v3.0 refactor (founded 2026-08-17, rationale in decision-log)

**Phase 0 — stabilise (complete 2026-08-17)**

- [x] Fresh-history repo `route-plotter`; imported router-plotter-02 @ v3.1 build 573
- [x] PM-Skills 4.7.0 fresh install; v2 project memory ported forward
- [x] Cherry-pick `GraphNode`/`GraphEdge` + 37 tests from dot-crowd-navigator (left unwired by design until Phase 2); fork spec docs archived to `specs/dot-crowd-navigator/`
- [x] Fresh-clone build fixed: `package-lock.json` now tracked; esbuild target `chrome58/firefox57/safari11` → `es2022` (was 200+ errors under esbuild 0.27.7; build + 106/106 tests green)
- [x] Bundle JSZip as an npm dependency (2026-08-17: jszip 3.10.1 pinned, `_loadJSZip()` CDN loader removed from ImageAssetService — offline save/load now works)
- [x] Reconcile project memory with v3 reality (2026-08-17: brief, architecture, file-map, trajectory updated — v3 scope + flow layers, deterministic-timeline mandate, graph models, specs/ folder, two-bundled-deps policy, phantom workers/ note removed)
- [x] Archive dot-crowd-navigator + router-plotter-01 on GitHub — gate paid off: local copy held a never-pushed working graph editor + Phase 2 swarm core, partially destroyed by OneDrive offloading; recovered via git + Windsurf local history, pushed to the fork (see its SALVAGE-NOTE.md), mined into `specs/dot-crowd-navigator/`, then both repos archived (2026-08-17). Four files remain lost (SwarmEngine/SimulationState/DotRenderer/GraphUIController implementations — tests survive); owner may still find them in OneDrive web recycle bin.

**Phase 1 — enabling refactor: COMPLETE 2026-08-17** (mixin split, layer registry, PlayerCore teardown + golden harness — see decision-log; owner feel-check of the deterministic build welcome)

**Phase 2 — scene model: COMPLETE 2026-08-18** (see decision-log)

- [x] `Scene`/`FlowLayer`/`Emitter` models; coordVersion 7→**9** additive save/load (layer params + seeds only — runtime dot state never persists; 8 is skipped — the fork's local builds used it for graph-only saves, decision-log 2026-08-17) — shipped 2026-08-18: onset-window emitter timing in normalised timeline fractions, full founding vocabulary (incl. onsetVariance/intensityRamp/wobble), guideType 'graph'|'route', scene in clearAll + undo snapshots; 204/204 tests, live autosave round-trip verified
- [x] `GraphModel` collection — salvaged from the fork with its 25 tests (landed 2026-08-17, wired into FlowLayer 2026-08-18; adjacency + referential integrity + serialisation included)

**Phase 3 — swarm engine: COMPLETE 2026-08-18** (see decision-log)

- [x] Deterministic `SwarmEngine.evaluate(timelineMs, layer)` using `hash(seed, dotIndex, hopIndex)` for onset/speed/junction/wobble; per-edge paths via one PathCalculator instance per edge — shipped 2026-08-18: weighted walks, four lifecycle modes, route guide, wobble, signature-keyed edge caches; 30-test suite; owner feel-check of the dot motion welcome (needs Phase 4 UI or console authoring)
- [x] Batched `DotRenderer` pass (plain arcs/sprites, sizes via `scaleSizeClamped`), drawn beneath the hero route — `flow-layers` registry entry between area-highlights and path; one canvas path per (colour, size) group; live-verified at v3.1.591 (pixel-delta + byte-identical scrub-return)

**Phase 4 — authoring UI**

- [ ] First canvas tool-mode system (Route edit | Flow edit) in InteractionHandler
- [ ] "Crowd" sidebar section via SectionController; graph editing gestures (place/drag nodes, draw edges, control points, weights, entry/exit marking)

**Phase 5 — parity & release**

- [ ] HTML-export swarm support via PlayerCore; enable GitHub Pages for route-plotter; docs refresh

### Held over from v2 — UI polish and UX

- [ ] Reflow breakpoint — avoid horizontal scroll at 200–400% zoom
  - Blocked / needs scoping (2026-06-17): conflicts with the `<1440px` min-width gate (`#screen-warning`); reconcile zoom-driven reflow with the hard min-width in its own scoping task.

### Next milestone — features

- [ ] Group arrow-key nudges into one undo entry — a burst of nudge taps saves one undo state per debounced tap; snapshot once per nudge gesture instead. — (from: 2026-06-17 diagnosis)
- [ ] Comet mode for spotlight reveal modes
- [ ] Improve auto-position for text labels
- [ ] Convert example backgrounds into example projects with waypoints/paths
- [ ] Custom drone icon for path head
- [ ] Relative sizing for all canvas elements across different canvas sizes
- [ ] Import/export custom keybindings
- [~] Segment-speed model — audience-coherent leg timing
  - Built (v3.1.569, 2026-06-18): major-leg keyframing + progress-span timing basis; minors are geometry-only; broken worker layer removed. Model in decision-log 2026-06-18. Pending in-browser feel-check → then move to trajectory.
- [~] Wider segment-speed range — 0.1x–10x
  - Built (v3.1.569): range widened 0.2x–5.0x → 0.1x–10x (log slider still centred on 1.0x). Pending the same in-browser check.
- [ ] Bug report button — header button opening a modal to send a report to <joe.bell@nottingham.ac.uk>
  - Intent: user clicks a header button, types a description in a modal, and submits a report that reaches Joe with enough context to reproduce.
  - Include: free-text description, captured console log output, and the current project file if it can be attached/serialised in-browser.
  - Note: no backend on GitHub Pages — likely a `mailto:` with pre-filled body, or download-bundle-then-attach; capturing console output needs intercepting `console.*` early (buffer log/warn/error). Investigate whether the project JSON can ride along (mailto body size limits vs. downloaded attachment).
  - Done when: button + modal exist, a submitted report delivers the description + console log to the address, and the project file is included where browser limits allow.

### Icebox

- [ ] Swatch picker popover — collapse each colour picker to a single current-colour swatch that opens the full grid in a popover; bigger visual-weight win than the 2026-06-17 inline tidy, but changes the colour-picking interaction. — (from: 2026-06-17 swatch tidy)
- [ ] Split `main.js` (6057 lines) into modules via prototype-mixin extraction (verbatim method moves + `Object.assign(RoutePlotter.prototype, group)`); candidate clusters: setup* wiring, undo/redo, JKL playback, camera, zoom, export. NEEDS supervised interactive testing (drag/click/keys/export). — (from: 2026-06-14 review phase 2)
- [ ] Migrate ~40 direct `this.render()` calls in `main.js` to `queueRender()`. MUST stay synchronous: the export-frame render (VideoExporter callback ~5110) and the startRenderLoop frame render (~5756). Benefit only on rapid sliders; needs visual verification. — (from: 2026-06-14 review phase 2)
- [ ] Remove verified-dead @deprecated methods: `MotionVisibilityService.sliderToLogValue`/`logValueToSlider`, `AnimationEngine.calculateDurationWithSegmentSpeeds` (internal trailing-whitespace makes tool-based excision fragile). — (from: 2026-06-14 review phase 2)
- [ ] Remove dead `showExportModeWarning()` (`main.js:5350`) — queries `#export-mode-warning` (no such element; CSS class is `.export-warning`), so it never fires; the toast already covers Edit-mode export. — (from: 2026-06-17 diagnosis)
- [ ] Function to convert images to Okabe-Ito palette or UoN colour scheme, so the whole thing has less colours.
- [ ] Path shape "randomised" periodic frequency improvement
- [ ] Export resolution preservation in zoom modes

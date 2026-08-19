# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->

## Active

<!-- The v3.0 refactor milestone (Phases 0–5, founded 2026-08-17) COMPLETED
     2026-08-19 with the Phase 5 release: v3 live at
     https://djdaojones.github.io/route-plotter/. Per-phase outcomes in
     trajectory.md; rationale in decision-log.md (and archive/). -->

### Held over from v2 — UI polish and UX

- [ ] Reflow breakpoint — avoid horizontal scroll at 200–400% zoom
  - Blocked / needs scoping (2026-06-17): conflicts with the `<1440px` min-width gate (`#screen-warning`); reconcile zoom-driven reflow with the hard min-width in its own scoping task.

### Next milestone — features

**From the 2026-08-18 UI review (post-Phase 4)**

- [ ] Anchors as drops: `GraphNode.anchorWaypointId` (spatial — bound node mirrors its waypoint) + `Emitter.releaseAnchor` (temporal — at head-arrival of waypoint N / during N's pause / at route completion, resolved through PlayerCore's pure mappings so windows track route edits instead of drifting). Additive coordVersion bump; anchors strictly graph→route, never route→graph
- [ ] "Fit wait to crowd" button — compute last dot arrival once, write it into `pauseTime` as an ordinary authored value (bake, don't bind: route timing never becomes a live function of swarm state)
- [ ] Branch gesture: "+" handle on a waypoint starts drawing network edges from a bound entry node — "the path grew a branch" as a feeling, layered scene as the data model
- [ ] Trace route into network: import route legs as chained edges (route untouched) so dots can run the visible route and branch off it
- [ ] Two-tier disclosure pass: 2–4 primary controls per card + "More…" for the rest (offsets, rotation offset, ripple thickness, tension) — roughly 20 controls at rest instead of ~45
- [ ] Minors in the waypoint list as indented rows under their major — selectable, renameable, reorder-visible
- [ ] Per-card "Reset to route style" / "Apply onward" — makes copy-at-creation inheritance visible and reversible
- [ ] Unit/naming pass: every readout in renderer units (px/s/%/×/°); Arrow Style → Head; Text Size abstract 1–10 scale → px

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

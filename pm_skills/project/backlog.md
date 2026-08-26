# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->

## Active

<!-- Current is dependency-ready or has a named residual gate. Next is ordered
     by dependency chain rather than deadline. Quarantine is not schedulable. -->

### Current

- [~] REV-04 [verify: Chromium/Firefox/Safari + offline] — Runtime probes,
  format-locked strategy selection, cached player loading and one
  endpoint-inclusive frame plan are implemented. Publish real-browser
  codec/container and genuinely offline standalone-export evidence.
- [ ] REV-02 [[detail]](tickets/REV-02.md) [ready] — Implement the approved
  synchronized semantic scene outline plus explicit keyboard and coordinate
  authoring for route, crowd, network and polygon structures.
- [ ] UI-01 [ready] — Introduce two-tier cards with 2–4 primary controls and a
  More disclosure; this is the layout substrate for advanced and crowd
  controls.
- [ ] REV-06 [ready] — Measure idle/paused CPU and a representative
  500-dot/4K scene, then sleep unnecessary animation work; assess
  direct-render coalescing only where profiling supports it and preserve
  synchronous export/render-loop frames.
- [ ] MAINT-01 [ready, low] — Remove verified-unused timing, visibility and
  export helpers without mixing user-visible behaviour into the sweep.

### Next

- [ ] REV-03 [gated: REV-02] — Replace separate mouse/touch paths with one
  Pointer Events + capture state machine. Include exactly-once contracts,
  physical mobile evidence and multi-selection group drag.
- [ ] UX-02 [gated: UI-01] — Make names/readouts honest in renderer units,
  migrate Text Size to pixels, and explain comet mode's intentional
  preview-tail duration in Pacing.
- [ ] UI-03 [gated: UI-01] — Surface existing Label
  colour/background/opacity and camera zoom-transition controls behind More;
  model, rendering and persistence already exist.
- [ ] UI-04 [gated: UI-01] — Show an honest mixed state when a multi-selection
  disagrees instead of silently displaying the primary waypoint's values.
- [ ] UI-05 [gated: UI-01] — Add per-card Reset to route style and Apply onward
  after the card layout and mixed-value rules are stable.
- [ ] UI-02 [gated: REV-02, UI-01] [sign-off] — Show minor waypoints as
  indented, selectable, renameable and reorder-visible rows using the approved
  semantic outline.
- [ ] CROWD-03 [[detail]](tickets/CROWD-03.md) [gated: UI-01] — Expose seeded
  walking/release/route-choice variation and re-roll using the deterministic
  model already present.
- [ ] CROWD-02 [[detail]](tickets/CROWD-02.md)
  [gated: UI-01, CROWD-03] — Add the whole-route busyness line graph with
  handles and gradual/step transitions, identical in editor, reload and
  export.
- [ ] REV-05 [gated: REV-02, REV-03, CROWD-02] — Complete accessibility
  assurance with axe, NVDA/VoiceOver, forced colours, reduced motion and
  200–400% zoom after the new authoring UI stabilises.
- [ ] SCALE-01 [[detail]](tickets/SCALE-01.md) [gated: REV-06] — Implement
  project-reference sizing so map-bound graphics preserve their authored
  proportions across editor, HTML and video resolutions without changing
  timing.
- [ ] ROUTE-01 [[detail]](tickets/ROUTE-01.md) [gated: REV-02, REV-03] —
  Implement simultaneous split hero-route branches on one master timeline,
  with deterministic fork, reconvergence and completion semantics.
- [ ] COMPOSE-01 [[detail]](tickets/COMPOSE-01.md)
  [gated: ROUTE-01, REV-03, CROWD-03] — Bind graph nodes and emitter release
  timing to route waypoints while preserving deterministic hashes and one-way
  graph→route ownership.
- [ ] COMPOSE-03 [gated: ROUTE-01, CROWD-03] — Trace the compatible hero route
  into a one-way copied guide network so crowds can follow it and branch.
- [ ] COMPOSE-02 [gated: COMPOSE-01] — Fit a route wait to the analytically
  computed last crowd arrival as a baked authored value, never a live timing
  dependency.
- [ ] COMPOSE-04 [gated: COMPOSE-01, COMPOSE-03, REV-03] — Add the waypoint
  “+” branch gesture from a bound entry node.
- [ ] DEMO-01 [gated: COMPOSE-02, COMPOSE-04, REV-04] — Replace bare example
  backgrounds with approved example projects that demonstrate route, crowd
  and anchors and double as living fixtures.
- [ ] HEAD-01 [gated: SCALE-01] [low] — Ship a reviewed drone head
  preset; custom head upload, rotation, persistence, undo and player hydration
  are already implemented.

### Icebox

- [ ] REV-07 [deferred] — Mature the already-green CI gate with risk-based
  coverage thresholds, a supported-Node matrix and dependency-update
  automation.
- [ ] ICE-01 — Swatch-picker popover. Re-evaluate after UI-01; More disclosures
  may make it redundant.
- [ ] ICE-02 — Import-time Okabe-Ito/UoN palette conversion. Promote only on
  user demand; photo posterisation/dithering needs separate quality work.

## Quarantine — proposed cuts, awaiting owner approval

<!-- Nothing here is schedulable. Delete or restate only with explicit owner
     disposition; shipped work has been evicted to trajectory. -->

- [ ] Import/export custom keybindings — PROPOSE CUT: no UI foundation and no user demand; default shortcut repair is KEY-01, not customisation.
- [ ] Comet mode for spotlight reveal modes — PROPOSE RESTATE OR CUT: existing axes already combine; reopen only as a clearly requested decaying background reveal.
- [ ] Improve auto-position for text labels — PROPOSE RESTATE OR CUT: collision-scored placement already exists; capture concrete failures before reopening.
- [ ] Path shape “randomised” periodic frequency improvement — PROPOSE RESTATE OR CUT: the old line has no recoverable intent and is unrelated to CROWD-03 dot variation.

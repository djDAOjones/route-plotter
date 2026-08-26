# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->

## Active

<!-- Current is the active lane or has a named residual gate. Next is ordered
     by dependency chain rather than deadline; [ready] marks runnable
     successors. Quarantine is not schedulable. -->

### Current

- [~] REV-04 [verify: Chromium/Firefox/Safari + offline] — Runtime probes,
  format-locked strategy selection, cached player loading and one
  endpoint-inclusive frame plan are implemented. Publish real-browser
  codec/container and genuinely offline standalone-export evidence.
- [~] REV-03 [[detail]](tickets/REV-03.md)
  [verify: physical iOS Safari + Android Chrome] — Unified Pointer Events,
  captured group drag and cancel/no-op transactions are implemented and green
  in automation plus production Chromium. Record the physical mobile pass.
- [ ] MAINT-01 [ready, low] — Remove verified-unused timing, visibility and
  export helpers without mixing user-visible behaviour into the sweep.
- [ ] HEAD-01 [ready, low] — Ship a reviewed drone head preset; custom head
  upload, rotation, persistence, undo and player hydration are already
  implemented. Promoted after SCALE-01 removed its visual-parity gate.

### Next

- [ ] UI-02 [ready] [sign-off] — Show minor waypoints as
  indented, selectable, renameable and reorder-visible rows using the approved
  semantic outline.
- [ ] REV-05 [gated: REV-03] — Complete accessibility
  assurance with axe, NVDA/VoiceOver, forced colours, reduced motion and
  200–400% zoom after the new authoring UI stabilises.
- [ ] ROUTE-01 [[detail]](tickets/ROUTE-01.md) [gated: REV-03] —
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

### Icebox

- [ ] REV-07 [deferred] — Mature the already-green CI gate with risk-based
  coverage thresholds, a supported-Node matrix and dependency-update
  automation.
- [ ] ICE-01 [deferred] — Swatch-picker popover. UI-01 now contains secondary
  area palettes under More while keeping Marker colour visible for novices;
  promote only if observed palette height becomes a real navigation problem.
- [ ] ICE-02 — Import-time Okabe-Ito/UoN palette conversion. Promote only on
  user demand; photo posterisation/dithering needs separate quality work.

## Quarantine — proposed cuts, awaiting owner approval

<!-- Nothing here is schedulable. Delete or restate only with explicit owner
     disposition; shipped work has been evicted to trajectory. -->

- [ ] Import/export custom keybindings — PROPOSE CUT: no UI foundation and no user demand; default shortcut repair is KEY-01, not customisation.
- [ ] Comet mode for spotlight reveal modes — PROPOSE RESTATE OR CUT: existing axes already combine; reopen only as a clearly requested decaying background reveal.
- [ ] Improve auto-position for text labels — PROPOSE RESTATE OR CUT: collision-scored placement already exists; capture concrete failures before reopening.
- [ ] Path shape “randomised” periodic frequency improvement — PROPOSE RESTATE OR CUT: the old line has no recoverable intent and is unrelated to CROWD-03 dot variation.

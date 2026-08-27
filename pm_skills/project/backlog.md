# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->
<!-- Grammar: `- [ ] **ID Short title** · Band [flags] — description`.
     Band names the delivery theme; the H3 lane names the schedule state. -->

## Active

<!-- Current is the active lane or has a named residual gate. Next is ordered
     by dependency chain rather than deadline; [ready] marks runnable
     successors. Quarantine is not schedulable.

     Gate vocabulary: `[gated: X impl]` waits on X's *code* landing;
     `[verify: …]` is an evidence-only residual that blocks nothing
     downstream. Conflating the two stalled the whole Phase 5 chain behind
     physical-device evidence that no successor actually needs. -->

### Current

- [~] **REV-04 Cross-browser and offline export evidence** · Review assurance
  [verify: Chromium/Firefox/Safari + offline] — Runtime probes, format-locked
  strategy selection, cached player loading and one endpoint-inclusive frame
  plan are implemented. Publish real-browser codec/container and genuinely
  offline standalone-export evidence.
- [~] **REV-03 Unified pointer transactions** · Review assurance
  [[detail]](tickets/REV-03.md) [verify: physical iOS Safari + Android Chrome]
  — Unified Pointer Events, captured group drag and cancel/no-op transactions
  are implemented and green in automation plus production Chromium. Record the
  physical mobile pass.

### Next

- [ ] **ROUTE-01c Branch authoring** · Phase 5 route composition
  [[detail]](tickets/ROUTE-01.md) [ready] [sign-off] — The split/rejoin gesture, list and
  semantic-outline representation, selection, deletion and undo.
- [ ] **ROUTE-01d Branch export parity** · Phase 5 route composition
  [ready] — Standalone player and video export reproduce the
  branched timeline frame-for-frame.
- [ ] **COMPOSE-01 Route-bound crowd anchors** · Phase 5 composition
  [[detail]](tickets/COMPOSE-01.md) [ready] — Bind graph nodes
  and emitter release timing to route waypoints while preserving deterministic
  hashes and one-way graph→route ownership.
- [ ] **COMPOSE-03 Trace route into guide network** · Phase 5 composition
  [ready] — Trace the compatible hero route into a one-way
  copied guide network so crowds can follow it and branch.
- [ ] **COMPOSE-02 Baked last-arrival wait** · Phase 5 composition
  [gated: COMPOSE-01 impl] — Fit a route wait to the analytically computed
  last crowd arrival as a baked authored value, never a live timing
  dependency.
- [ ] **COMPOSE-04 Branch gesture from a bound node** · Phase 5 composition
  [gated: COMPOSE-01 impl, COMPOSE-03 impl] — Add the waypoint “+” branch
  gesture from a bound entry node.
- [ ] **DEMO-01 Example projects as living fixtures** · Showcase/release
  [gated: COMPOSE-02 impl, COMPOSE-04 impl] — Replace bare example backgrounds
  with approved example projects that demonstrate route, crowd and anchors and
  double as living fixtures.
- [ ] **REV-05 Accessibility assurance** · Accessibility assurance
  [gated: ROUTE-01c impl] [verify: NVDA/VoiceOver] — Complete axe,
  forced colours, reduced motion and 200–400% zoom checks once the authoring
  UI stops changing shape; screen-reader passes stay owner-run evidence.

### Icebox

- [ ] **REV-07 CI maturity** · Engineering maturity [deferred] — Mature the
  already-green CI gate with risk-based coverage thresholds, a supported-Node
  matrix and dependency-update automation. Promote when a regression escapes
  the current gate or a Node upgrade is forced.
- [ ] **ICE-01 Swatch-picker popover** · UI polish [deferred] — UI-01 now
  contains secondary area palettes under More while keeping Marker colour
  visible for novices; promote only if observed palette height becomes a real
  navigation problem.
- [ ] **ICE-02 Import-time palette conversion** · Import/colour [deferred] —
  Import-time Okabe-Ito/UoN palette conversion. Promote only on user demand;
  photo posterisation/dithering needs separate quality work.

## Quarantine — proposed cuts, awaiting owner approval

<!-- Nothing here is schedulable. Delete or restate only with explicit owner
     disposition; shipped work has been evicted to trajectory. -->

- [ ] **QUAR-01 Import/export custom keybindings** — PROPOSE CUT: no UI foundation and no user demand; default shortcut repair is KEY-01, not customisation.
- [ ] **QUAR-02 Comet mode for spotlight reveal** — PROPOSE RESTATE OR CUT: existing axes already combine; reopen only as a clearly requested decaying background reveal.
- [ ] **QUAR-03 Auto-position for text labels** — PROPOSE RESTATE OR CUT: collision-scored placement already exists; capture concrete failures before reopening.
- [ ] **QUAR-04 Randomised path-shape frequency** — PROPOSE RESTATE OR CUT: the old line has no recoverable intent and is unrelated to CROWD-03 dot variation.

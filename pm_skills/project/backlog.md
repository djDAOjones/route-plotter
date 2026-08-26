# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->

## Active

<!-- Phases are dependency-ordered. Owner decisions in Phase 0 can run in
     parallel with Phase 1 development. Status tags name the next gate;
     Quarantine is not schedulable work. See decision-log 2026-08-26. -->

### Phase 0 — Owner decisions and acceptance

- [~] QA-01 [owner-check] — Run one consolidated browser feel-check covering Phase 4 selection behaviour, the Phase 5 standalone player, major-leg timing and the built 0.1×–10× segment-speed range; then close the two pending speed outcomes to trajectory.
- [ ] REV-02 [[detail]](tickets/REV-02.md) [sign-off] — Approve the semantic scene outline and non-visual/keyboard authoring model. This gates new gesture work, full accessibility assurance and accessible split-route authoring.
- [ ] REV-08 [[detail]](tickets/REV-08.md) [sign-off] — Approve the publication/privacy boundary for samples, asset metadata, CSP, logs and support bundles before more public examples or diagnostics ship.
- [ ] REV-09 [[detail]](tickets/REV-09.md) [sign-off] — Select the repository licence, notices, security route and support posture; the public repository makes this an immediate governance lane.
- [ ] ROUTE-01 [[detail]](tickets/ROUTE-01.md) [sign-off] — Decide split-route playback, timing and reconvergence now. Implementation remains a Phase 5 model change behind REV-02/REV-03.
- [ ] SCALE-01 [[detail]](tickets/SCALE-01.md) [sign-off] — Decide whether authored sizes are image-relative, canvas-relative or physical-pixel based, and how export resolution preserves them, before implementing scaling changes.

### Phase 1 — Live-app health and immediate user value

- [ ] KEY-01 [ready] — Restore one authoritative Cmd/Ctrl+Z, redo and Cmd/Ctrl+S path: current `history:*`/`file:save` events have no subscribers. Remove stale Tab-next/previous configuration/help and test each document command exactly once.
- [ ] UX-01 [ready] — Add a direct labelled Route target to waypoint scope so users return to route controls in one click or keystroke without stepping through the back arrow.
- [ ] BUG-01 [ready] — Fix area-handle hit-testing at viewport zoom > 1 by comparing pointer and handle coordinates in one space; pin hover and drag regressions.
- [ ] QA-02 [verify] — Add focused tests for nudge undo grouping and editor-control restoration after undo/redo. Current code appears to satisfy both; close rather than rewrite if the tests confirm it.
- [ ] CROWD-04 [ready] — Allow Add crowd without a hero route by creating a graph-guided crowd and entering network edit; use route/network-neutral lifecycle copy such as journey end or exit.
- [ ] CROWD-01 [[detail]](tickets/CROWD-01.md) [ready, partly-built] — Edit all competing outgoing route shares together, normalise predictably, and preview allocation with a non-colour-only weight treatment.
- [ ] REV-04 [ready] — Prove portable, honest export strategy selection: preload/cache the player, probe required APIs, emit the announced frame count, and publish Chromium/Firefox/Safari codec and offline evidence.
- [ ] REV-10 [[detail]](tickets/REV-10.md) [ready] — Prune unreferenced custom-image assets without breaking live waypoints, the route head, undo/redo or save/load.

### Phase 2 — Authoring and inspector foundation

- [ ] REV-03 [gated: REV-02] — Replace separate mouse/touch paths with one Pointer Events + capture state machine. Include exactly-once contracts, physical mobile evidence and multi-selection group drag.
- [ ] UI-01 [ready] — Introduce two-tier cards with 2–4 primary controls and a More disclosure; this is the layout substrate for advanced and crowd controls.
- [ ] UX-02 [gated: UI-01] — Make names/readouts honest in renderer units, migrate Text Size to pixels, and explain comet mode's intentional preview-tail duration in Pacing.
- [ ] UI-02 [gated: REV-02, UI-01] [sign-off] — Show minor waypoints as indented, selectable, renameable and reorder-visible rows using the approved semantic outline.
- [ ] UI-03 [gated: UI-01] — Surface existing Label colour/background/opacity and camera zoom-transition controls behind More; model, rendering and persistence already exist.
- [ ] UI-04 [gated: UI-01] — Show an honest mixed state when a multi-selection disagrees instead of silently displaying the primary waypoint's values.
- [ ] UI-05 [gated: UI-01] — Add per-card Reset to route style and Apply onward after the card layout and mixed-value rules are stable.

### Phase 3 — Crowd control

- [ ] CROWD-03 [[detail]](tickets/CROWD-03.md) [gated: CROWD-01, UI-01] — Expose seeded walking/release/route-choice variation and re-roll using the deterministic model already present.
- [ ] CROWD-02 [[detail]](tickets/CROWD-02.md) [gated: UI-01, CROWD-03] — Add the whole-route busyness line graph with handles and gradual/step transitions, identical in editor, reload and export.

### Phase 4 — Assurance and maintainability

- [ ] REV-05 [gated: REV-02, REV-03, Phase 3] — Complete accessibility assurance with axe, NVDA/VoiceOver, forced colours, reduced motion and 200–400% zoom after the new authoring UI stabilises.
- [ ] REV-06 [ready] — Measure idle/paused CPU and a representative 500-dot/4K scene, then sleep unnecessary animation work; assess direct-render coalescing only where profiling supports it and preserve synchronous export/render-loop frames.
- [ ] REV-07 [deferred] — Mature the already-green CI gate with risk-based coverage thresholds, a supported-Node matrix and dependency-update automation.
- [ ] MAINT-01 [low] — Remove the verified-unused timing/visibility/export helpers after KEY-01, without mixing user-visible behaviour into the sweep.
- [ ] SUPPORT-01 [gated: REV-08, REV-09] — Build the approved bug-report flow as a previewable/redacted diagnostic bundle plus an owner-approved contact route; do not preselect an email or attachment policy.

### Phase 5 — Route and crowd composition

<!-- If ROUTE-01 changes the hero-route model, implement that compatible model
     before composition features that assume a linear route. REV-03 gates all
     new gestures. -->

- [ ] COMPOSE-01 [[detail]](tickets/COMPOSE-01.md) [gated: ROUTE-01, REV-03, CROWD-03] — Bind graph nodes and emitter release timing to route waypoints while preserving deterministic hashes and one-way graph→route ownership.
- [ ] COMPOSE-02 [gated: COMPOSE-01] — Fit a route wait to the analytically computed last crowd arrival as a baked authored value, never a live timing dependency.
- [ ] COMPOSE-03 [gated: ROUTE-01, CROWD-03] — Trace the compatible hero route into a one-way copied guide network so crowds can follow it and branch.
- [ ] COMPOSE-04 [gated: REV-03, COMPOSE-01, COMPOSE-03] — Add the waypoint “+” branch gesture from a bound entry node.

### Phase 6 — Showcase and scale

- [ ] DEMO-01 [gated: Phase 5, REV-04, REV-08] — Replace bare example backgrounds with approved example projects that demonstrate route, crowd and anchors and double as living fixtures.
- [ ] HEAD-01 [gated: REV-10, SCALE-01] [low] — Ship a reviewed drone head preset; custom head upload, rotation, persistence, undo and player hydration are already implemented.

## Icebox

- [ ] ICE-01 — Swatch-picker popover. Re-evaluate after UI-01; More disclosures may make it redundant.
- [ ] ICE-02 — Import-time Okabe-Ito/UoN palette conversion. Promote only on user demand; photo posterisation/dithering needs separate quality work.

## Quarantine — proposed cuts, awaiting owner approval

<!-- Nothing here is schedulable. Delete or restate only with explicit owner
     disposition; shipped work has been evicted to trajectory. -->

- [ ] Import/export custom keybindings — PROPOSE CUT: no UI foundation and no user demand; default shortcut repair is KEY-01, not customisation.
- [ ] Comet mode for spotlight reveal modes — PROPOSE RESTATE OR CUT: existing axes already combine; reopen only as a clearly requested decaying background reveal.
- [ ] Improve auto-position for text labels — PROPOSE RESTATE OR CUT: collision-scored placement already exists; capture concrete failures before reopening.
- [ ] Path shape “randomised” periodic frequency improvement — PROPOSE RESTATE OR CUT: the old line has no recoverable intent and is unrelated to CROWD-03 dot variation.

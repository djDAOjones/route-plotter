# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->

## Active

<!-- Next milestone (features) resequenced into waves by the 2026-08-19
     triage pass (rationale in decision-log.md, same date). Waves are
     ordered; items within a wave are roughly independent unless noted.
     Quarantine at the bottom holds proposed cuts — owner approval
     required before anything is deleted. -->

### Wave 0 — Verify & close out (owner, in-browser; no dev work)

- [ ] Consolidated feel-check session: Phase 4 behaviour changes (Cmd+A incl. minors, canvas Cmd+click toggle, leg-click selects, no confirm modal) + the Phase 5 exported player in a real browser + the two segment-speed items below. Closing this closes both [~] items to trajectory.
- [~] Segment-speed model — audience-coherent leg timing
  - Built (v3.1.569, 2026-06-18): major-leg keyframing + progress-span timing basis; minors are geometry-only; broken worker layer removed. Model in decision-log 2026-06-18 (archive). Pending in-browser feel-check → then move to trajectory.
- [~] Wider segment-speed range — 0.1x–10x
  - Built (v3.1.569): range widened 0.2x–5.0x → 0.1x–10x (log slider still centred on 1.0x). Pending the same in-browser check.

### Wave 1 — Hygiene & launch-window quick wins

<!-- Cheap and independent. Defects and the feedback channel come first
     while v3 is newly live on Pages. -->

- [ ] Dead-code sweep — bundles the verified-dead lines from the old icebox + wish-list: `MotionVisibilityService.sliderToLogValue`/`logValueToSlider`; `AnimationEngine.calculateDurationWithSegmentSpeeds`; `showExportModeWarning()` + its call (exporting.js:115/329 — targets nonexistent `#export-mode-warning`, null-guard no-ops); `pathTiming.getSegmentLengths()` + `PathCalculator.calculateSegmentLengths()` (unused since major-leg timing). All re-verified uncalled 2026-08-19.
- [ ] Group arrow-key nudges into one undo entry — a burst of nudge taps saves one undo state per debounced tap; snapshot once per nudge gesture instead (matches Phase 4's one-undo-per-bulk-change rule). — (from: 2026-06-17 diagnosis)
- [ ] Unit/naming pass: every readout in renderer units (px/s/%/×/°); Arrow Style → Head; Text Size abstract 1–10 scale → px. The scale change needs an additive save migration.
- [ ] Bug report button — header button opening a modal to send a report to <joe.bell@nottingham.ac.uk>
  - Intent: user clicks a header button, types a description in a modal, and submits a report that reaches Joe with enough context to reproduce.
  - Include: free-text description, captured console log output, and the current project file if it can be attached/serialised in-browser.
  - Note: no backend on GitHub Pages, and `mailto:` cannot carry attachments — likely shape: generate a downloadable report bundle (description + console ring buffer + project ZIP) and open a short pre-filled mailto instructing the user to attach it. Console capture needs intercepting `console.*` at boot (buffer log/warn/error).
  - Done when: button + modal exist, a submitted report delivers the description + console log to the address, and the project file is included where browser limits allow.
- [ ] Fix: area handle hit-testing misses at viewport zoom > 1 — `area:check-handle` compares screen coords against imageToCanvas (canvas) coords; drag and hover share the miss consistently. — (promoted from wish-list; from: 2026-08-18 Phase 4 canvas affordances)
- [ ] Fix: editor control values go stale after undo/redo — `_restoreState` restores selection without re-emitting selection events (the chip half was fixed by the Phase 4 multi-select restore sync). — (promoted from wish-list; from: 2026-08-18 Phase 4 canvas affordances, narrowed by fifth slice)
- [ ] Fix: Clear All should save an undo snapshot like Apply-to-All now does; its modal's "cannot be undone" copy is currently accurate. — (promoted from wish-list; from: 2026-08-18 Phase 3.5)

### Wave 2 — Inspector completion (finish the Phase 4 story)

<!-- Disclosure first: it defines the card slots the other two land on. -->

- [ ] Two-tier disclosure pass: 2–4 primary controls per card + "More…" for the rest (offsets, rotation offset, ripple thickness, tension) — roughly 20 controls at rest instead of ~45. Also unblocks the wish-list "under More…" items (label colour/bg, camera zoom mode, onsetVariance/intensityRamp).
- [ ] Minors in the waypoint list as indented rows under their major — selectable, renameable, reorder-visible. Resolves the last open UI-review sub-decision — present the pattern for owner sign-off before building.
- [ ] Per-card "Reset to route style" / "Apply onward" — makes copy-at-creation inheritance visible and reversible. Buttons land on the post-disclosure card layout, hence after it.

### Wave 3 — Route ⇄ crowd composition (the milestone headline)

<!-- Anchors first: the branch gesture depends on them (its "+" handle
     creates a bound entry node). -->

- [ ] Anchors as drops: `GraphNode.anchorWaypointId` (spatial — bound node mirrors its waypoint) + `Emitter.releaseAnchor` (temporal — at head-arrival of waypoint N / during N's pause / at route completion, resolved through PlayerCore's pure mappings so windows track route edits instead of drifting). Additive coordVersion bump; anchors strictly graph→route, never route→graph. Care: swarm hashes are test-pinned — anchor default null must leave existing fixtures untouched; add new pinned fixtures for anchored scenes.
- [ ] "Fit wait to crowd" button — compute last dot arrival once, write it into `pauseTime` as an ordinary authored value (bake, don't bind: route timing never becomes a live function of swarm state). Last arrival is analytically computable from the deterministic release schedule + per-dot speed multipliers.
- [ ] Trace route into network: import route legs as chained edges (route untouched) so dots can run the visible route and branch off it. One-way copy at import time — same bake-don't-bind posture.
- [ ] Branch gesture: "+" handle on a waypoint starts drawing network edges from a bound entry node — "the path grew a branch" as a feeling, layered scene as the data model. Depends on anchors (spatial).

### Wave 4 — Showcase & ship

- [ ] Convert example backgrounds into example projects with waypoints/paths — author AFTER Wave 3 so the examples demonstrate the full v3 story (route + crowd + anchors); doubles as living demos and informal fixtures. Precedent: an example project ZIP already ships in images/.
- [ ] Custom head icon — generalise waypoint `customImage` support (incl. auto-rotation, already in the model) to the path head; ship a drone icon as a preset. Player-side hydration via bare ImageAsset (Phase 5 pattern).

### Blocked / needs scoping

- [ ] Reflow breakpoint — avoid horizontal scroll at 200–400% zoom
  - Blocked / needs scoping (2026-06-17): conflicts with the `<1440px` min-width gate (`#screen-warning`); reconcile zoom-driven reflow with the hard min-width in its own scoping task.
  - Triage note (2026-08-19): this is the brief's WCAG 2.2 commitment (1.4.10 Reflow), not polish — at 400% zoom the effective width (~360 CSS px) always trips the gate, so the criterion is unreachable as designed. The scoping task itself is small: decide posture (responsive editor vs documented exception) before any implementation is sequenced.
- [ ] Resolution & scaling design ticket — merged from "Relative sizing for all canvas elements across different canvas sizes" + "Export resolution preservation in zoom modes" (same root: absolute-px element sizing tied to background/canvas resolution). Touches the authored-timeline preservation rules (timingReference; never recompute timing at a new canvas) — highest-blast-radius area in the app. Needs its own design ticket before sequencing.

### Icebox

- [ ] Swatch picker popover — collapse each colour picker to a single current-colour swatch that opens the full grid in a popover; bigger visual-weight win than the 2026-06-17 inline tidy, but changes the colour-picking interaction. — (from: 2026-06-17 swatch tidy). Trigger: re-evaluate after the Wave 2 disclosure pass — may be redundant once pickers sit behind "More…".
- [ ] Migrate remaining direct `this.render()` calls (34 across main.js + src/app mixins as of 2026-08-19) to `queueRender()`. MUST stay synchronous: the export-frame render (exporting.js) and the render-loop frame render (playback.js). Benefit only on rapid sliders; needs visual verification. — (from: 2026-06-14 review phase 2; refs refreshed post-refactor)
- [ ] Function to convert images to Okabe-Ito palette or UoN colour scheme, so the whole thing has less colours. Trigger: when Gary wants unified-palette maps. Bake at import (don't live-filter); expect quality work on photos (posterisation/dithering).

### Quarantine — proposed cuts, awaiting owner approval

<!-- Nothing here is deleted. Each line carries a triage verdict
     (2026-08-19): approve to delete, or veto back into a wave/icebox.
     Do NOT pick up items from this section as work. -->

- [ ] Import/export custom keybindings — PROPOSE CUT: keybinding customisation has no UI (`saveCustomBindings` exists in config/keybindings.js, nothing calls it — hand-edited localStorage only), so this is a feature on an unbuilt foundation, for an audience unlikely to rebind keys. Resurrect if a real user asks.
- [ ] Comet mode for spotlight reveal modes — PROPOSE RESTATE OR CUT: comet (path INSTANTANEOUS) and spotlight-reveal (background) are separate axes that already combine (the Phase 5 golden test includes a reveal+comet variant). If the intent is a decaying reveal — background re-hides behind the head, comet-style — that is a plausible new visibility variant; restate it that way and it can be scoped.
- [ ] Improve auto-position for text labels — PROPOSE RESTATE OR CUT: `TextLabelService.autoPosition` already does collision-scored placement (path, markers, other labels); "improve" names no failure. Capture concrete mislabel cases (e.g. during the Wave 0 feel-check) and re-open with examples, else cut.
- [ ] Path shape "randomised" periodic frequency improvement — PROPOSE RESTATE OR CUT: v2-era line with no recorded intent; cannot be mapped to a current defect or design goal.
- [x] Split `main.js` into modules via prototype-mixin extraction — VERIFIED DONE by the Phase 1 refactor (2026-08-17): 6,057 → 1,150 lines, mixins in `src/app/` exactly per the proposed pattern (undoRedo, playback/JKL, camera, viewport/zoom, exporting all extracted). PROPOSE DELETE this line — the work is already recorded in trajectory/decision-log.

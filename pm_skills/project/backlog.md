# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->
<!-- Grammar: `- [ ] **ID Short title** · Band [flags] — description`.
     Band names the delivery theme; the H3 lane names the schedule state. -->

## Active

<!-- Current is the active lane or has a named residual gate — today it holds
     the three assurance items whose only remaining work is owner evidence, so
     Next reads as the genuinely schedulable queue. Next is ordered by
     dependency chain rather than deadline; [ready] marks runnable successors.
     Quarantine is not schedulable.

     Gate vocabulary: `[gated: X impl]` waits on X's *code* landing;
     `[verify: …]` is an evidence-only residual that blocks nothing
     downstream; `[owner: …]` waits on a decision only Joe can make;
     `[ready]` means nothing is in the way. Conflating the first two stalled
     the whole Phase 5 chain behind physical-device evidence that no successor
     actually needs, and on 2026-09-23 two items carried `[gated: owner]` for
     decisions Joe had already made — a gate is a claim, so check it. -->

### Current

- [~] **REV-04 Cross-browser and offline export evidence** · Review assurance
  [verify: Chromium/Firefox/Safari + offline] — Runtime probes, format-locked
  strategy selection, cached player loading and one endpoint-inclusive frame
  plan are implemented. Publish real-browser codec/container and genuinely
  offline standalone-export evidence. Chromium is done (2026-09-24, v3.2.692):
  an HTML export with a traced crowd, opened from another origin, made one
  request (the page itself), and an MP4 export carried `ftyp` at offset 4.
  Firefox and Safari remain owner-run.
- [~] **REV-03 Unified pointer transactions** · Review assurance
  [[detail]](tickets/REV-03.md) [verify: physical iOS Safari + Android Chrome]
  — Unified Pointer Events, captured group drag and cancel/no-op transactions
  are implemented and green in automation plus production Chromium. Record the
  physical mobile pass.
- [~] **REV-05 Accessibility assurance** · Accessibility assurance
  [verify: NVDA/VoiceOver + forced-colours + reduced-motion emulation] —
  Everything automatable is done and green: structural audit, AAA contrast
  sampling, 400%-zoom reflow, and axe over both the static shell and the shell
  as JavaScript leaves it (48 rules, zero violations, contrast evaluated live in
  Chromium). A11Y-01 and A11Y-02 closed the two findings this audit spun out, so
  forced-colours fallbacks now exist and are proved to ship — what remains is
  *looking* at them under a real high-contrast theme, a reduced-motion
  emulation pass including canvas motion (restored 2026-09-22; it left this
  residual at `24e650c` without an owner call), plus the screen-reader pass.
  All stay owner-run.

### Next

<!-- The schedulable queue of the adopted codebase abstraction plan
     (reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md; IDs are
     the plan's, used verbatim). Working setup and release steps:
     DEV-INFRASTRUCTURE.md → Deployment.

     W0 closed 2026-09-22, W1 2026-09-23, W2 2026-09-24 (released as
     v3.2.692). Three groups, in the order to take them: what Joe approved or
     accepted when W2 closed; the defects W1 released that are still open (plan
     §13 ground rule 8, "After W1"); and W3, the pilot. Taking the first two
     before W3 is a scheduling choice, not a dependency.

     Nothing enters this lane until it is runnable, and the plan is never
     imported wholesale. A behaviour change is one PR that states its new
     behaviour for Joe and changes only the golden cells it means to. Where a
     defect is characterised, an active test asserts today's BROKEN behaviour
     beside an empty `test.todo`: turn that test into a regression and retire
     the todo. Gate vocabulary is under Active; a gate is a claim, so check
     it. -->

**Approved or accepted by Joe on 2026-09-24**

- [ ] **DEF-34 The exported player ignores Graphics scale** · Live defect
  [ready] — `PlayerApp` never calls `setGraphicsScale`, so an HTML export
  draws every vector element at scale 1 while the editor and video export are
  right. One call in `PlayerApp.load`; `goldenDrawLogs.test.js`
  characterises it exactly. Approved. **P1**
- [ ] **TST-17 The draw log cannot tell canvases apart** · Test harness
  [ready] — The recorder writes every source canvas as `[canvas]`, so
  compositing the wrong canvas passes all 11 draw goldens (reproduced
  2026-09-23). Name the source surface, regenerate the goldens and justify
  every changed line. Test-only; do it before the goldens multiply. **P1**
- [ ] **DEF-36 A throwing frame leaves canvas state stacked** · Live defect
  [ready] — A throw mid-render skips the vector layer's `restore()` and the
  beacons' own, so later frames compound the camera zoom. Reset the drawing
  context each frame; the goldens stay byte-identical when nothing throws.
  **P2**
- [ ] **DEF-35 Off-image points are pinned by four readers** · Live defect
  [ready] — Since DEF-03 a point may sit off the image, but the scene outline
  refuses any edit to such a waypoint, area-vertex and centre drags snap onto
  the image, and crowd anchors and dots stop at its edge. One PR per reader is
  fine. **P2**

**Released by W1, still open** (plan §13 ground rule 8; one PR each, any order)

- [ ] **DEF-08 Beacon scaling is missing outside playback** · Live defect
  [ready] — Pop/grow/pulse marker scaling applies only while `isPlaying()`, so
  it is absent from video export, scrubbing and paused preview. Remove the
  gate; beacons are closed-form. Visible change: needs a golden cell update,
  and active scaling cases **including `pop`**, which `authoredExtras` does not
  yet carry. **P1**
- [ ] **DEF-17 A finished polygon tells nobody which waypoint** · Live defect
  [ready] — Completion nulls `targetWaypoint` before emitting, so
  `area:changed` and `area:draw-completed` carry `null` and neither the
  sidebar nor the outline refreshes. Capture first; correct the "double-click
  closes" copy in the same PR. **P1**
- [ ] **DEF-28 A failed recovery restore is silent** · Live defect [ready] —
  It goes to the console only, and the next edit overwrites the record.
  Announce it, and keep the record until the user acts. **P2**
- [ ] **DEF-33 Every cold load announces "Animation paused"** · Live defect
  [ready] — The startup `pause()` runs after the listener is registered, and
  the live region sits outside the inert `#app`. Pause before subscribing, or
  add a `silent` flag. **P3**
- [ ] **DEF-30 The perf harness disables autosave before its own refusal
  check** · Live defect [ready] — It also says nothing, and `EventBus.once`
  refires when its callback throws (no production caller). Reorder and
  restore; wrap `once` in try/finally. **P3**
- [ ] **DEF-29 Reduced motion suppresses beacons in baked video exports** ·
  Live defect [ready] — **Policy decided (§20 Q7b, accepted 2026-09-22):
  ignore reduced motion when exporting video; keep it for the live editor and
  player.** **P3**

**W3 — the pilot** (plan §14; enters now that W2 is closed)

- [ ] **SPL-01 The slider scales move to `utils/sliderScales`** · Refactor
  [ready] — Move the six pure slider-scale functions out of
  `MotionVisibilityService`, characterising `formatUIValue`'s existing
  rounding rather than "fixing" it. Behaviour-preserving: the goldens stay
  byte-identical. §14.6 lists what would invalidate the pilot.

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

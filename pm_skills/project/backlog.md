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
  offline standalone-export evidence.
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

     W0 closed 2026-09-22, W1 (the safety net) 2026-09-23. This lane now holds
     two groups, because W1 released both at once: the W2 wave, and the eight
     unwaved defects whose only prerequisite was W1 (plan §13 ground rule 8,
     "After W1" slot). W3 (the SPL-01 pilot) enters when W2 closes.

     Listing the second group **refines DOC-06 (i)** ("Next holds only the
     current wave", decision log 2026-09-22 and 09-23): ground rule 8's defects
     are not a wave but independent one-PR fixes, and hiding eight runnable
     ones would misrepresent the queue. The rule's purpose holds — nothing
     enters this lane until it is runnable.

     Every item below is a behaviour change: one per PR, each stating its new
     behaviour for Joe, each changing only the golden cells it means to.
     Several are already characterised by a test that asserts today's BROKEN
     behaviour, beside an empty `test.todo` naming the fix — so the work is to
     turn that characterisation into a regression and retire the todo, not to
     "flip" anything. Priorities are the plan's. -->

**W2 — urgent live defects** (plan §13 W2; DEF-01 already shipped as v3.2.691)

- [ ] **DEF-02 The player never builds `waypointsById`** · Live defect [ready]
  — Every anchored crowd node in an exported HTML player draws at its authored
  position instead of at its waypoint. Characterised twice:
  `playerHostContract.test.js` (structural) and `goldenDrawLogs.test.js`
  (render-level, 120+ differing draw calls once a waypoint moves). The file
  goldens capture the app, not the player, so they should stay byte-identical.
  **P0**
- [ ] **DEF-03 Authoring outside the image will not reload** · Live defect
  [ready] — Below 100% background zoom a waypoint or polygon vertex can be
  authored outside 0–1 and load refuses it, losing the ZIP, the autosave
  recovery and the player's waypoints. **Policy decided (§20 Q3, accepted
  2026-09-22): widen what load accepts to the range the UI can author, not
  clamp at authoring** — backwards-compatible, and it keeps intentional
  off-image points. Reconcile `AGENTS.md`'s hard rule that waypoints are "0–1"
  in the same PR — it predates the decision and would otherwise stop an
  obedient agent. The characterisation in `authorableLoadable.test.js` covers
  an out-of-bounds waypoint only; polygon vertices and the player's load path
  need their own. **P0**
- [ ] **DEF-31 Traced graph IDs overflow the ID limit** · Live defect [ready]
  — `gn_trace_<id>` and `ge_trace_<from>__<to>` reach 265/523 characters from
  legitimate 256-character waypoint IDs, so "Trace route into crowd" makes a
  project that will not reopen. Bounded deterministic derived IDs, with the
  reference mapping preserved. Characterised in `authorableLoadable.test.js`.
  **P1**
- [ ] **DEF-23 Exports carry images only undo can reach** · Live defect
  [ready] — Shared ZIP and HTML exports include images reachable only through
  undo history, and the HTML also carries original filenames. **Policy decided
  (§20 Q4, accepted 2026-09-22): filter to live references in both ZIP and
  HTML; keep filenames in the ZIP only.** Filter at export — the store
  retention is correct and `assetPruning.test.js` pins it. Needs its own test.
  **P1**

**Released by W1** (plan §13 ground rule 8, "After W1"; one PR each, any order)

- [ ] **DEF-26 A short hex glow colour freezes playback** · Live defect
  [ready] — The glow beacon parses only `#rrggbb` while load accepts `#rgb`,
  `#rgba` and `#rrggbbaa`, so `addColorStop` throws every glow frame: playback
  stops and `queueRender` latches until reload. Parse every accepted form and
  **preserve alpha** — eight-digit hex currently loses it silently rather than
  throwing. In the same PR make one bad frame survivable: reset the latch in a
  `finally`, reschedule `_loop` before `onUpdate`. **May join W2** (plan §13).
  **P1**
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
- [ ] **DEF-21 Help and the File menu describe keys that do not exist** ·
  Live defect [ready] — `,`/`.` are labelled "Step" but skip to start/end, K
  is labelled "Pause" but toggles, and ⌘O is advertised with no handler. Text
  only; the structural fix is CON-15. **P1**
- [ ] **DEF-28 A failed recovery restore is silent** · Live defect [ready] —
  It goes to the console only, and the next edit overwrites the record.
  Announce it, and keep the record until the user acts. **P2**
- [ ] **DEF-30 The perf harness disables autosave before its own refusal
  check** · Live defect [ready] — It also says nothing, and `EventBus.once`
  refires when its callback throws (no production caller). Reorder and
  restore; wrap `once` in try/finally. **P3**
- [ ] **DEF-33 Every cold load announces "Animation paused"** · Live defect
  [ready] — The startup `pause()` runs after the listener is registered, and
  the live region sits outside the inert `#app`. Pause before subscribing, or
  add a `silent` flag. **P3**
- [ ] **DEF-29 Reduced motion suppresses beacons in baked video exports** ·
  Live defect [ready] — **Policy decided (§20 Q7b, accepted 2026-09-22):
  ignore reduced motion when exporting video; keep it for the live editor and
  player.** **P3**

**Proposed — needs Joe before it can be scheduled**

- [ ] **DEF-34 The exported player ignores Graphics scale** · Live defect
  [owner: approve the behaviour change] — `PlayerApp` never calls
  `setGraphicsScale`, so an HTML export draws every vector element as though
  the scale were 1 while the same project's video export is correct. Found by
  TST-02 and added to plan §12.1 marked *Proposed*; `goldenDrawLogs.test.js`
  characterises it exactly. The fix is in `PlayerApp.load`. **P1 is this lane's recommendation, not an adopted
  priority** — the plan row is still *Proposed*.

<!-- Also for Joe (2026-09-23 decision log): very long labels can make a saved
     project impossible to reopen — the `#waypoint-label` field has no length
     limit while load refuses anything past 100,000 characters. Two separable
     questions: CLASSIFICATION (it sits inside DEF-04's authoring-budget scope,
     which is where it is now) and TIMING (DEF-04 is a W8 item). Recommended:
     keep the classification, decide the timing separately. Nothing is blocked
     either way. -->

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

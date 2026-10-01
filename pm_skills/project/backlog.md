# Backlog

<!-- Status: [ ] todo  [~] in progress  [x] done  [-] cut -->
<!-- Grammar: `- [ ] **ID Short title** · Band [flags] — description`.
     Band names the delivery theme; the H3 lane names the schedule state. -->

## Active

<!-- Current is the active lane or has a named residual gate — today it holds
     the two assurance items whose only remaining work is owner evidence, so
     Next reads as the genuinely schedulable queue. Next is ordered by
     dependency chain rather than deadline; [ready] marks runnable successors.
     Quarantine is not schedulable.

     Gate vocabulary: `[gated: X impl]` waits on X's *code* landing;
     `[verify: …]` is an evidence-only residual that blocks nothing
     downstream; `[owner: …]` waits on a decision only Joe can make;
     `[ready]` means nothing is in the way. Conflating the first two stalled
     the whole Phase 5 chain behind physical-device evidence that no successor
     actually needs; on 2026-09-23 two items carried `[gated: owner]` for
     decisions Joe had already made, and on 2026-09-28 the plan still did in
     ten rows and three waves, and TST-11 read ready without its SPL-06 — a
     gate is a claim, so check it. -->

### Current

- [~] **REV-03 Unified pointer transactions** · Review assurance
  [[detail]](tickets/REV-03.md) [verify: physical Android Chrome] — Unified
  Pointer Events, captured group drag and cancel/no-op transactions are
  implemented and green in automation plus production Chromium. Record the
  physical Android Chrome pass (iOS Safari is no longer checked: Route
  Plotter is Chromium-only for now, Joe, 2026-09-28).
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

<!-- The big run's queue (decision log, 2026-09-28, "the big run"). IDs are
     the plan's (reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md),
     and each plan row is its item's detail. Working setup and release steps:
     DEV-INFRASTRUCTURE.md → Deployment.

     Closed: W0, W1, W2 (released as v3.2.692), the post-W2 queue, W3's
     pilot and their follow-ups (merged, unreleased). Here: W5, with TST-04
     first and SPL-06 pulled forward for TST-11; W4 behind TST-04 (§14.5);
     the defects runnable now; and those waiting on a W5 test (§13 ground
     rule 8). W6 to W12 enter from plan §13 at a wave's close, once the waves
     they depend on are complete — the run promotes them itself (DEP-03 now
     opens W8). Nothing enters until it is runnable, and the plan is never
     imported wholesale.

     A defect's approved behaviour is its plan row's stated treatment (Joe,
     2026-09-28, in advance; amended the same day, DEF-07 included). A defect
     found on the way is fixed too, with its own row and PR. Its PR still
     states that behaviour and moves only the goldens it means to. Where a
     defect is characterised, an active test asserts today's BROKEN
     behaviour beside an empty `test.todo`: turn that test into a regression
     and retire the todo. -->

**W5 — deepen the characterisation** (TST-04 first)

- [ ] **TST-04 Sidebar control and readout goldens** · Characterisation
  [ready] — Control→bus for every control, and model→control state per
  selection path. First, because nothing guards the readouts (§14.5), so W4
  waits on it. **P1**
- [ ] **TST-13 Key table, element IDs, HTML ranges** · Characterisation
  [ready] — Gates DEL-05, DEF-13, DEF-15 and DEF-32. **P1**
- [ ] **TST-05 Event transcript golden** · Characterisation [ready] — Gates
  DEF-15, DEF-22 and W6. **P1**
- [ ] **TST-09 Camera, dots, curvature, minor-end and time domains** ·
  Characterisation [ready] — With branched and intro/tail fixtures; gates
  W7 and W10. **P1**
- [ ] **TST-03 Visibility mode matrix** · Characterisation [ready] **P1**
- [ ] **TST-08 Mixin composition guards** · Characterisation [ready] **P1**
- [ ] **SPL-06 `build.js` entry guard and exported functions** · Refactor
  [ready] — Pulled forward from W9: TST-11 needs it, and `build.js` exports
  nothing today. **P2**
- [ ] **TST-11 Behavioural tests for source-text assertions** ·
  Characterisation [gated: SPL-06 impl] **P1**
- [ ] **TST-14 Shell and ContextMenu safety tests** · Characterisation
  [ready] **P1**
- [ ] **TST-16 Tighten the round-2 predicates** · Characterisation [ready]
  **P1**

**W4 — remove clearly dead code** (§20 Q8; mutate every branch of anything
moved, and account for every survivor)

- [ ] **DEL-02 Render dead code** · Dead code [gated: TST-04 impl] **P1**
- [ ] **DEL-03 Engine, geometry and bus dead code** · Dead code
  [gated: TST-04 impl] **P1**
- [ ] **DEL-04 Wiring dead code** · Dead code [gated: TST-04 impl] **P1**
- [ ] **DEL-05 UI, config and CSS dead code** · Dead code
  [gated: TST-04, TST-13 impl] — With a before/after browser check of the
  Tooltip system and the CSS. **P1**
- [ ] **DEL-06 Services dead API** · Dead code [gated: TST-04 impl] **P2**
- [ ] **DEL-01 Unused barrels** · Dead code [gated: TST-04 impl] **P2**

**Defects runnable now**

- [ ] **DEF-28 A failed recovery restore is silent** · Live defect [ready]
  — Option A (Joe, 2026-09-28): announce it, and a notice offers Download it
  and Discard; the record moves to a second key autosave never writes. Clear
  All discards it too; if storage is full it stays, and the autosave failure
  report points to the notice. **P2**
- [ ] **DEF-44 A paused editor never idles** · Live defect [ready] **P2**
- [ ] **DEF-42 A beacon-style change keeps the old schedule** · Live defect
  [ready] **P3**
- [ ] **DEF-45 Announcements overwrite each other** · Accessibility [ready]
  **P3**

**Defects after their W5 test** (§13 ground rule 8)

- [ ] **DEF-20 Controls out of sync after Open and Clear All** · Live defect
  [gated: TST-04 impl] — One nudge can make the duration 646 s. **P1**
- [ ] **DEF-13 A focused button swallows every shortcut** · Accessibility
  [gated: TST-13 impl] **P1**
- [ ] **DEF-32 Activating a list row loses focus** · Accessibility
  [gated: TST-13 impl] **P1**
- [ ] **DEF-14 A hint click stops a label toggling** · Accessibility
  [gated: TST-04 impl] **P1**
- [ ] **DEF-15 L resumes at the old J/K/L speed** · Live defect
  [gated: TST-05, TST-13 impl] **P2**
- [ ] **DEF-19 Camera-zoom edits skip undo** · Live defect
  [gated: TST-04 impl] **P2**
- [ ] **DEF-22 An inserted waypoint splits a branch run** · Live defect
  [gated: TST-05 impl] — §20 Q7: it joins the run of the waypoint before
  it; at the fork, the trunk. **P2**

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

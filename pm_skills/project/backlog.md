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

<!-- Holds only the CURRENT wave of the adopted codebase abstraction plan
     (reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md; IDs are
     the plan's, used verbatim). When this wave closes, the next one enters
     from the plan's §13; never import the whole plan here. Working setup and
     release steps: DEV-INFRASTRUCTURE.md → Deployment. W0 closed 2026-09-22,
     W1 (the safety net) on 2026-09-23. Now W2, the urgent live defects: one
     per pull request, each stating its behaviour change for Joe. W2's first
     defect, DEF-01, already shipped as v3.2.691. W3 (the SPL-01 pilot) enters
     from the plan's §13 when this wave closes. -->

- [ ] **DEF-02 The player never builds `waypointsById`** · Live defect [ready]
  — Every anchored crowd node in an exported HTML player draws at its authored
  position instead of at its waypoint. `tests/playerHostContract.test.js` and
  `tests/goldenDrawLogs.test.js` both carry the `todo` to flip.
- [ ] **DEF-03 Authoring outside the image will not reload** · Live defect
  [gated: owner §20 Q3] — Below 100% background zoom a waypoint can be authored
  outside 0–1, and load refuses it. Joe chooses: widen what load accepts
  (default) or clamp at authoring.
- [ ] **DEF-23 Exports carry images only undo can reach** · Live defect
  [gated: owner §20 Q4] — Filter exported assets to the snapshot's live
  references; keep filenames only in ZIPs.
- [ ] **DEF-31 Traced graph IDs overflow the ID limit** · Live defect [ready]
  — `gn_trace_<id>` and `ge_trace_<from>__<to>` reach 265/523 characters from
  legitimate 256-character waypoint IDs, so the traced layer fails reload.
- [ ] **DEF-26 A short hex glow colour freezes playback** · Live defect
  [ready] — May join this wave (plan §13 W2).

<!-- Awaiting Joe before they can be scheduled (see the 2026-09-23 decision
     log entry): DEF-34 (proposed) — the exported HTML player ignores Graphics
     scale; and whether the unbounded label field, now annotated onto the
     DEF-04 row, should be its own row. -->

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

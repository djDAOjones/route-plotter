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

- [~] **REV-05 Accessibility assurance** · Accessibility assurance
  [verify: NVDA/VoiceOver + forced colours] — Structural audit, AAA contrast
  sampling, 400%-zoom reflow and axe-core all green in production Chromium
  (48 rules, zero violations, contrast evaluated live), with two AAA failures
  fixed and axe now a standing gate. Screen readers stay owner-run; forced
  colours needs devtools emulation.
- [ ] **A11Y-01 Tooltip triggers should not be buttons** · Accessibility
  [ready] — `[data-tip]` labels get `role="button"` and `tabindex="0"`, so ~80
  hint labels announce as buttons that perform no action and owe a 44px target
  they do not meet. axe confirms it is worse than questionable: `role="button"`
  is *invalid* on a `<label>`, and would be a violation rather than an
  incomplete once the camera controls are shown. Describe the control instead
  (`aria-describedby`) and drop the phantom role.
- [ ] **REVEAL-01 Spotlight reveal that fades behind the head** · Reveal modes
  [ready] — Owner: "the spot reveals the background, but then its revealing
  effect fades out over time". Not currently possible: the mask repaints every
  passed path point at full opacity each frame, so revealed stays revealed.
  Weight each point's alpha by its distance behind the head, keeping the
  per-frame rebuild that makes scrubbing bidirectional.
- [ ] **LABEL-01 Auto-position at the right moments** · Inspector polish
  [ready] — Owner: auto-position itself works well. Three changes: run it when
  a label is first written (it starts hidden), do NOT re-run it after the
  author has moved the label by hand, and surface the control — it is buried
  in the collapsed "More" disclosure. A fading prompt offering auto-position
  is the proposed nudge.
- [ ] **A11Y-02 Forced-colours sweep** · Accessibility [ready] — Only the
  UI-02/ROUTE-01c row affordances declare `forced-colors` fallbacks. Selection
  accent bars, focus rings, the leg “+” and beacon colours have none. Needs
  devtools forced-colours emulation to verify, so pair it with REV-05's
  residual.

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

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
  [verify: NVDA/VoiceOver + forced colours + axe] — Structural audit, AAA
  contrast sampling and 400%-zoom reflow are done and green in production
  Chromium, with two AAA failures fixed. Screen readers stay owner-run; forced
  colours needs devtools emulation; axe-core needs a dev-dependency decision.
- [ ] **A11Y-01 Tooltip triggers should not be buttons** · Accessibility
  [ready] — `[data-tip]` labels get `role="button"` and `tabindex="0"`, so ~80
  hint labels announce as buttons that perform no action and owe a 44px target
  they do not meet. Describe the control instead (`aria-describedby`) and drop
  the phantom role.
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

## Quarantine — proposed cuts, awaiting owner approval

<!-- Nothing here is schedulable. Delete or restate only with explicit owner
     disposition; shipped work has been evicted to trajectory. -->

- [ ] **QUAR-01 Import/export custom keybindings** — PROPOSE CUT: no UI foundation and no user demand; default shortcut repair is KEY-01, not customisation.
- [ ] **QUAR-02 Comet mode for spotlight reveal** — PROPOSE RESTATE OR CUT: existing axes already combine; reopen only as a clearly requested decaying background reveal.
- [ ] **QUAR-03 Auto-position for text labels** — PROPOSE RESTATE OR CUT: collision-scored placement already exists; capture concrete failures before reopening.
- [ ] **QUAR-04 Randomised path-shape frequency** — PROPOSE RESTATE OR CUT: the old line has no recoverable intent and is unrelated to CROWD-03 dot variation.

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
- [ ] **DEPLOY-01 Release the remediation branch** · Release
  [blocked: owner calls the release] — The owner held the merge on 2026-08-27
  (`f1c14b9`): the live site stays on v3.2.618 until they call it. This ticket
  exists so RP-07's residual is tracked rather than forgotten, not to reopen
  the decision. When called: `review-remediation` is 41 commits ahead of
  `main`, which is what Pages serves. Also settle GitHub branch-protection and
  Pages permissions, which the review could inspect only from repository files.
- [ ] **REL-01 Decide the production source-map policy** · Release
  [ready] [sign-off] — `docs/app.js.map` publishes 3.1 MB carrying the full
  unminified source of 89 first-party files (`sourcesContent`). The repository
  is public, so this is a size and tidiness decision rather than a secrecy one:
  keep it for debuggable production stack traces, or drop it. Review §17
  Optional.
- [ ] **PERF-01 Benchmark a representative maximum project** · Performance
  [ready] — Hostile inputs are bounded and fixture-covered (RP-09), but no
  *legitimate* large project was ever profiled, so the supported ceiling is a
  UI limit rather than a measured budget. Profile an agreed maximum — waypoint
  count, crowd size, image resolution — and record what it costs. Review §18
  "intended project-size ceiling".
- [ ] **LEGAL-01 Confirm the MPL source-notice posture** · Governance
  [ready] [maintainer] — `mediabunny` (runtime, bundled) and now `axe-core`
  (dev-only) are MPL-2.0. Notices and licence text shipped under REV-09, but
  the review flagged that a technical review cannot give legal advice and the
  owner should confirm the redistribution posture is what they intend. Review
  §18 "MPL/source-notice obligations". Pair with DEPS-01, which moves those
  same versions.
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
- [ ] **DEPS-01 Consider dependency upgrades across the board** · Engineering
  maturity [ready] — Owner-requested (2026-08-27 maintenance). Evaluate and
  take deliberate upgrades: mediabunny 1.55.1→1.55.3 (runtime — re-verify
  export), vitest 4.1.10→4.1.11, jsdom 27→29 (two majors, test env), plus any
  transitive drift; full gate after each. Relates to REV-07 (icebox), which
  would automate this recurring pass.

### Icebox

- [ ] **REV-07 CI maturity** · Engineering maturity [deferred] — Mature the
  already-green CI gate with risk-based coverage thresholds, a supported-Node
  matrix and dependency-update automation. Promote when a regression escapes
  the current gate or a Node upgrade is forced.
- [ ] **ICE-01 Swatch-picker popover** · UI polish [deferred] — UI-01 now
  contains secondary area palettes under More while keeping Marker colour
  visible for novices; promote only if observed palette height becomes a real
  navigation problem.
- [ ] **ICE-03 Visual and performance benchmark corpus** · QA [deferred] —
  Golden-frame fixtures catch timeline regressions, but there is no repeatable
  benchmark for subtle visual or performance drift, so optimisation decisions
  stay anecdotal. Review §17 Optional. Promote if a visual regression escapes
  the golden frames, or alongside PERF-01.
- [ ] **ICE-02 Import-time palette conversion** · Import/colour [deferred] —
  Import-time Okabe-Ito/UoN palette conversion. Promote only on user demand;
  photo posterisation/dithering needs separate quality work.

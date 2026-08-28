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
  [verify: NVDA/VoiceOver + forced-colours emulation] — Everything automatable
  is done and green: structural audit, AAA contrast sampling, 400%-zoom reflow,
  and axe over both the static shell and the shell as JavaScript leaves it
  (48 rules, zero violations, contrast evaluated live in Chromium). A11Y-01 and
  A11Y-02 closed the two findings this audit spun out, so forced-colours
  fallbacks now exist and are proved to ship — what remains is *looking* at
  them under a real high-contrast theme, plus the screen-reader pass. Both stay
  owner-run.

### Next

- [ ] **DEPLOY-01 Release the remediation branch** · Release
  [blocked: owner calls the release] — The owner held the merge on 2026-08-27
  (`f1c14b9`): the live site stays on v3.2.618 until they call it. This ticket
  exists so RP-07's residual is tracked rather than forgotten, not to reopen
  the decision. When called: `review-remediation` is 42 commits ahead of
  `main` as of `c993ea9` — a number that goes stale on every commit, so read it
  with `git rev-list --count origin/main..review-remediation` rather than
  trusting this line. Also settle GitHub branch-protection and Pages
  permissions, which the review could inspect only from repository files.
- [ ] **REL-01 Decide the production source-map policy** · Release
  [blocked: settled when the release is called] — `docs/app.js.map` publishes
  3.1 MB carrying the full unminified source of 89 first-party files
  (`sourcesContent`). The repository is public, so this is a size and tidiness
  decision rather than a secrecy one: keep it for debuggable production stack
  traces, or drop it. **Owner 2026-08-28: decide at release** — carry it into
  DEPLOY-01 rather than settling it now. Review §17 Optional.
- [ ] **ICE-03 Visual and performance benchmark corpus** · QA [ready] —
  **Promoted 2026-08-28: its own trigger fired alongside PERF-01.** That pass
  measured the cost curve by hand in a browser console; the numbers are in the
  decision-log but nothing re-runs them, so the next optimisation decision is
  anecdotal again. Make the harness repeatable — fixed render surface, the same
  deterministic timeline instants, the waypoint/crowd/image sweeps — and pin a
  regression threshold. Golden-frame fixtures already cover timeline drift;
  this covers visual and performance drift.
- [ ] **LEGAL-01 Confirm the MPL source-notice posture** · Governance
  [ready] [maintainer] — `mediabunny` (runtime, bundled) and now `axe-core`
  (dev-only) are MPL-2.0. Notices and licence text shipped under REV-09, but
  the review flagged that a technical review cannot give legal advice and the
  owner should confirm the redistribution posture is what they intend. Review
  §18 "MPL/source-notice obligations". DEPS-01 has since shipped, so the
  versions to confirm are settled: mediabunny 1.55.3 and axe-core 4.13.0.

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

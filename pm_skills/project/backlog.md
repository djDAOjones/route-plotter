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
     from the plan's §13; never import the whole plan here. Work branches from
     main in a fresh clone outside OneDrive (owner's §20 Q1/Q2 answers). -->

- [ ] **DOC-06 Agent workflow fits this repo** · Codebase auditability
  [ready] [[detail]](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md) — First, `AGENTS.md` gains `## Commit, push and release`:
  agents work on short-lived branches and never commit to or push `main`, and
  `docs/` and `version.json` change only through `npm run push`. Without it,
  `task.md` step 11 commits and pushes every close onto the live `main`. Then
  sub-items (b)–(f) in the plan's §12. (g) and (h) shipped 2026-09-22.
- [ ] **DEF-18 push.js refuses unknown flags** · Codebase auditability
  [ready] — `node push.js --dryrun`, a typo, performs a real and now live
  release. Reject unknown flags with no git side effect and run `npm run check`
  rather than `npm test`; add the `releaseSafety` case first.
- [ ] **GOV-01 Branch-per-wave working setup** · Codebase auditability
  [gated: DOC-06 impl] — Every wave on a short-lived branch from `main` in a
  fresh clone outside OneDrive; merges reach `main` in small batches, each a
  tagged release. Done when DOC-06 (a) and the DEV-INFRASTRUCTURE release
  steps say so and W1 starts that way.
- [ ] **DOC-02 Canonical docs match the code** · Codebase auditability
  — Correct the 14 README, DEV-INFRASTRUCTURE and `architecture.md`
  contradictions listed in the plan (§6 SEG-030), linking rather than
  restating.
- [ ] **DOC-03 The real communication rule** · Codebase auditability — Replace
  "EventBus only, exceptions: none" with the owner's §20 Q15 rule: components
  reach the app through the bus; the app calls components through named public
  methods; modal tools make provisional edits and commit them through events.
  Change `AGENTS.md`, `architecture.md` and `conventions.md` together, and name
  the exceptions CON-01 will remove.

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

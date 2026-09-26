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
     v3.2.692), and the post-W2 queue and W3's pilot on 2026-09-26 (merged, not
     yet released). Two groups: what Joe accepted since W2 closed, and the one
     defect W1 released that is still open (plan §13 ground rule 8, "After
     W1"). §14.5 asks for the readout gap (TST-04) to close before W4; that,
     and W4 itself, are Joe's calls.

     Nothing enters this lane until it is runnable, and the plan is never
     imported wholesale. A behaviour change is one PR that states its new
     behaviour for Joe and changes only the golden cells it means to. Where a
     defect is characterised, an active test asserts today's BROKEN behaviour
     beside an empty `test.todo`: turn that test into a regression and retire
     the todo. Gate vocabulary is under Active; a gate is a claim, so check
     it. -->

**Accepted by Joe on 2026-09-25**

- [ ] **DEF-38 A throw on the main canvas leaves its state stacked** · Live
  defect [ready] — DEF-36's exposure on the main canvas: a throw inside the
  background pass's saves keeps that frame's zoom, camera transform or
  `destination-in` for every later frame. The main canvas's base transform
  belongs to its host, so DEF-36's cure does not carry over. No known
  trigger. **P2**
- [ ] **DEF-39 Vector styles carry from one frame to the next** · Live defect
  [ready] — Area borders inherit the route's round caps and joins, so the
  first frame after a resize or a throw draws them with butt caps and mitred
  joins. Joe's call: keep the round look that steady frames draw today. **P3**

**Released by W1, still open** (plan §13 ground rule 8)

- [ ] **DEF-28 A failed recovery restore is silent** · Live defect
  [owner: what the author sees, and how the record is kept] — It goes to the
  console only, and the next edit overwrites the record. Announce it, and keep
  the record until the user acts. **P2**

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

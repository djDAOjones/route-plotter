<!-- markdownlint-disable MD013 MD060 -->
# Original review finding crosswalk

This is the durable bridge between the read-only report at `cec0191` and the
current `review-remediation` branch. “Shipped” means implemented and verified in
the branch history; it does not erase the original evidence. “Residual” names
the remaining assurance or product ticket in the live PM-Skills backlog.

| Finding | Original concern | Remediation evidence | Current disposition |
| --- | --- | --- | --- |
| RP-01 | Destructive project loading | `a813328` made import detached, bounded, transactional and rollback-safe. | Shipped under REV-01. |
| RP-02 | Incomplete or misleading autosave and clear lifecycle | `a813328` added honest bounded writes, recovery ownership and a non-resurrecting Clear baseline. | Shipped under REV-01. |
| RP-03 | Tab interception and duplicate transport shortcuts | `a813328` repaired keyboard/modal paths; `591e1d6` completed the single authoritative keyboard/button route. | Shipped under REV-01 and KEY-01. |
| RP-04 | Unreachable authoring panel at narrow widths/zoom | `a813328` repaired responsive reflow and touch targets with regression coverage. | Shipped under REV-01; broader zoom/accessibility evidence remains REV-05. |
| RP-05 | History-dependent comet rendering | `a813328` made visibility/timeline behaviour deterministic and added review timeline fixtures. | Shipped under REV-01. |
| RP-06 | Inconsistent timeline/export/transport state | `a813328` unified derived timing and rollback-safe export restoration; later export work retained that contract. | Shipped under REV-01. |
| RP-07 | Broken or irreproducible clean builds/deploys | `a813328` added exact clean output, non-mutating check builds, guarded current-branch deployment and CI; `2bc9fff` published v3.2.619. | Shipped under REV-01. Pages switching/deployment still requires explicit authority. |
| RP-08 | No semantic, keyboard or non-visual route/crowd authoring | `31cbfd3` added a synchronized semantic scene outline and exported-player descriptions/announcements. | Shipped under REV-02. Minor-waypoint presentation continues as UI-02. |
| RP-09 | Unbounded hostile project/image complexity | `a813328` added project limits and adversarial fixtures; `c1b73d8`/REV-10 added reference-aware, rollback-safe asset admission and pruning. | Substantially remediated. Keep bounds and failure fixtures intact. |
| RP-10 | Duplicate background-control owners | `a813328` consolidated wiring and background loading behind guarded transactions. | Shipped under REV-01. |
| RP-11 | Separate incomplete touch state machine | `bbc1c3f` replaced competing mouse/touch mutation paths with one captured Pointer Events transaction. | Implementation shipped under REV-03; physical iOS Safari and Android Chrome evidence remains open. |
| RP-12 | Modal, widget, help, target and naming accessibility gaps | `a813328` repaired the highest-risk keyboard, modal and reflow defects; subsequent UI phases use native disclosures, named actions and mixed-state semantics. | Partial assurance remains REV-05 after REV-03 physical evidence. |
| RP-13 | Export portability, offline and endpoint uncertainty | `a813328` and Phase 1 added probes, format-locked strategies, cached player loading and exact frame planning. | Implementation complete; Chromium/Firefox/Safari plus truly offline evidence remains REV-04. |
| RP-14 | Unsafe script argument/process targeting | `a813328` made restart ownership and deployment arguments fail safely and added shell safety tests. | Shipped under REV-01. |
| RP-15 | CI/runtime/dependency/licence governance gaps | `a813328` established CI, pinned tool expectations and release checks; `591e1d6`/REV-09 added MIT terms, notices, security and support contracts. | Core governance shipped; REV-07 maturity work remains deferred in Icebox. |
| RP-16 | Continuous rendering while paused | `97c18ae` made preview scheduling demand-driven and measured the real 500-dot 4K path. | Shipped under REV-06. |
| RP-17 | Privacy/publication/support boundary gaps | `c1b73d8`/REV-08 added allowlisted public assets, CSP, safe colour grammar and redacted diagnostics; `b3c20ea` added preview-first support hand-off. | Shipped under REV-08 and SUPPORT-01. |
| RP-18 | Material documentation drift | `a813328` reconciled architecture, testing, build, deployment and dependency contracts; later phases kept source docs and PM memory current. | Shipped under REV-01. Historical `_Joe/` notes remain non-authoritative and read-only. |

## Work added after the original review

The same development run also delivered owner-approved product work beyond the
literal findings: route-scope navigation, graph route shares, seeded crowd
variation, a whole-route busyness envelope, progressive inspector disclosure,
honest units and mixed states, reusable waypoint-card actions,
resolution-independent authored sizing, verified dead-code removal and a
built-in drone route-head preset. The exact shipped narrative is in
`pm_skills/project/trajectory.md`; the why is in
`pm_skills/project/decision-log.md`.

<!-- markdownlint-disable MD013 MD060 -->
# Continue the Route Plotter review-remediation programme

Continue development of Route Plotter v3 as a thorough, evidence-led extension
of the repository review and remediation programme completed on 26 August 2026.
Use the repository's embedded PM-Skills framework as the durable source of
truth. Do not restart the original review from scratch, but do verify all
drift-prone state before acting.

## Repository and branch

Repository root:

`/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

Branch: `review-remediation`

Verified implementation baseline:

- `c9a953cbaac74691ac947855c16531138d311e79`
- latest feature commit: `673e627` — `HEAD-01: ship built-in drone head preset`
- latest PM commit: `c9a953c` — `PM: refactor roadmap after HEAD-01`
- generated Pages build at that baseline: v3.2.656 with an exact 17-file
  `docs/` inventory
- automated gate at that baseline: 54 files / 745 tests, restart safety and a
  non-mutating production check build
- real Chromium at that baseline: drone selection/render/reload passed with no
  warning or error console entries

Documentation-only handover commits may follow `c9a953c`. At session start,
verify that local HEAD and `origin/review-remediation` are equal, the worktree is
clean, HEAD descends from `c9a953c`, and the `reviews/` dossier exists. Stop on
unexpected divergence, conflict copies or unrelated changes.

## Mandatory evidence and reading order

Read these repository paths before planning the next ticket:

1. `AGENTS.md`
2. `README.md`
3. `pm_skills/project/brief.md`
4. `pm_skills/project/architecture.md`
5. `pm_skills/project/conventions.md`
6. `pm_skills/project/file-map.md`
7. the Active section of `pm_skills/project/backlog.md`
8. the latest relevant entries of `pm_skills/project/decision-log.md`
9. `_Joe/dev notes/needs consolidating and deleting/dev guide.md`
10. `DEV-INFRASTRUCTURE.md` for build, runtime or publication work
11. `UI-STANDARDS.md` for UI, accessibility or user-facing work
12. `reviews/README.md`
13. `reviews/route-plotter-v3-comprehensive-repository-review-2026-08-26.md`
14. `reviews/route-plotter-review-finding-crosswalk-2026-08-26.md`
15. `reviews/route-plotter-review-headlines-for-novices-2026-08-26.md`

The comprehensive report is the full historical review at `cec0191`; the
crosswalk and current source establish what has changed since then. The file
`reviews/read-only-comprehensive-repository-review-prompt.md` is the original
brief and provenance only. Its read-only rule applied to the review run, not to
the now-authorised remediation branch.

### Cross-project ambiguity guard

The previous user instruction explicitly named
`uon-video-helper-comprehensive-review-2026-08-26.md`. That file was inspected:
it is genuinely a report about the separate **UoN Video Helper** repository at
commit `66227e5`, including its media/audio pipeline. It is not a Route Plotter
review and was intentionally not copied into this repository. Do not use its
findings, file paths, ticket names or acceptance evidence here. If the user
actually wants UoN Video Helper, stop and switch repositories explicitly rather
than cross-contaminating the two projects.

## Purpose of the programme

The original task was a principal-level, whole-repository review spanning
architecture, correctness, security, privacy, data integrity, accessibility,
performance, tests, dependencies, build/release operations and documentation.
It found no Critical issue but found eight High findings and ten additional
material findings. The remediation programme then:

- repaired bounded, mechanism-known defects first;
- converted larger product and assurance questions into named PM-Skills
  tickets rather than pretending they were fixed;
- asked the owner at genuine product, taste, legal, publication and
  real-device gates;
- used tests, clean builds and real-browser evidence in proportion to risk;
- updated and refactored the roadmap after each phase;
- preserved the project's deterministic timeline, normalised-coordinate,
  EventBus and static/offline architecture;
- committed and published only explicit file sets to the public
  `djDAOjones/route-plotter` repository.

Maintain that standard. Treat old review claims as evidence to re-check against
current source, not as eternal truth and not as instructions to rewrite the
codebase.

## Owner instructions and standing permissions

- Use PM-Skills faithfully.
- “Autojazz” means autonomously complete mechanism-known, low-risk work.
- Ask questions only for a real product, taste, authority, publication,
  privacy/legal or unavailable external-evidence decision.
- Refactor the backlog after every completed phase or meaningful roadmap
  transition.
- Preserve the complete trajectory/decision history and its existing soft
  budget warnings. Do not prune or archive without explicit owner approval.
- Use explicit staging. Never use `git add -A`.
- Preserve unrelated user changes and stop on unexplained divergence or
  OneDrive conflict artefacts.
- The owner approved publishing the full `review-remediation` branch,
  including source and generated `docs/`, to the public
  `djDAOjones/route-plotter` repository.
- That approval covers ordinary commits and pushes for this branch; it does not
  authorise changing GitHub Pages configuration, switching the deployed branch,
  deploying another environment, deleting data or publishing private material.
- `docs/` is generated output. Never hand-edit it; use `npm run build` when a
  publishable application change needs refreshed Pages artefacts.
- `_Joe/` is maintainer-owned historical material. Read where required, but do
  not edit it.

## Completed activity and durable outcomes

| Commit | Phase/ticket | Purpose and outcome | Status |
| --- | --- | --- | --- |
| `a813328` | REV-01 | Transactional bounded imports, honest autosave/recovery, deterministic timeline/export, keyboard/modal/reflow repair, safe CI/build/deploy/restart contracts. | Shipped |
| `2bc9fff` | v3.2.619 | First public source and generated Pages artefact for the review branch. | Published |
| `7b7aef5` | Roadmap | Reprioritised live health and crowd delivery; preserved larger review work as explicit tickets. | Shipped |
| `cf3b20e` | Phase 0 | Owner signed off QA-01 and the REV-02, REV-08, REV-09, ROUTE-01 and SCALE-01 contracts. | Fully signed off |
| `591e1d6` | Phase 1A | KEY-01, UX-01, BUG-01, QA-02 and licence/security/support governance. | Shipped |
| `c1b73d8` | Phase 1B | CROWD-01/CROWD-04, REV-08/09/10, public-asset/CSP/privacy boundary, diagnostics, project reset, asset safety and strengthened video export. | Shipped |
| `b3c20ea` | SUPPORT-01 | Preview-first redacted bug-report bundle with safe public/private support hand-off. | Shipped |
| `31cbfd3` | REV-02 | Synchronized semantic scene authoring plus exported-player scene description and transport announcements. | Shipped |
| `bbc1c3f` | REV-03 implementation | One captured Pointer Events transaction for mouse, touch and pen authoring. | Code shipped; physical mobile evidence remains |
| `bd2148d`–`2a359b0` | UI-01/UX-02/UI-03/UI-04/UI-05 | Progressive inspector disclosure, honest units, appearance/zoom controls, mixed-state semantics and reversible card propagation. | Shipped |
| `60cc4b4` | CROWD-03 | Seeded walking, pace, release and route-choice variation with explicit re-roll. | Shipped |
| `ef791a3` | CROWD-02 | Accessible two-to-eight-handle busyness envelope with gradual/step spans and deterministic editor/export parity. | Shipped |
| `97c18ae` | REV-06 | Demand-driven preview frames; stable pause sleeps while transport/camera changes wake it. | Shipped |
| `285a0cd` | PM follow-up | Removed the satisfied REV-06 gate from SCALE-01. | Shipped |
| `a6f7b54` | SCALE-01 | Stable project-reference appearance across editor, HTML and video resolution without changing timing geometry. | Shipped |
| `8f1167f` | MAINT-01 | Removed only pre-verified dead timing/visibility/export-warning paths. | Shipped |
| `673e627` | HEAD-01 | Built-in reviewed right-facing quadcopter, persisted and hydrated across editor, undo, Clear and standalone export. | Shipped |
| `c9a953c` | PM follow-up | Evicted HEAD-01, promoted UI-02 and removed stale CROWD-03 gates. | Shipped |

The complete outcome narrative is in `pm_skills/project/trajectory.md`; design
rationale is in `pm_skills/project/decision-log.md`; current file roles are in
`pm_skills/project/file-map.md`. Do not duplicate those records unnecessarily.

## Current roadmap

Display this and future roadmaps with the columns **ID, phase, purpose / topic,
status**.

| ID | Phase | Purpose / topic | Status |
| --- | --- | --- | --- |
| REV-04 | Review assurance | Real-browser codec/container and genuinely offline standalone-export evidence | Current — implementation complete; Chromium, Firefox, Safari and offline evidence remain |
| REV-03 | Review assurance | Unified pointer transactions and physical mobile behaviour | Current — automation/Chromium green; physical iOS Safari and Android Chrome evidence remain |
| UI-02 | Inspector foundation | Show minor waypoints as indented, selectable, renameable and reorder-visible rows | Current — ready; explicit sign-off gate |
| REV-05 | Accessibility assurance | Axe, NVDA/VoiceOver, forced colours, reduced motion and 200–400% zoom | Next — gated by REV-03 |
| ROUTE-01 | Phase 5 route composition | Simultaneous split hero routes with deterministic fork/rejoin semantics | Next — approved model; gated by REV-03 |
| COMPOSE-01 | Phase 5 composition | Bind crowd graph nodes and release timing to route waypoints | Next — gated by ROUTE-01 and REV-03 |
| COMPOSE-03 | Phase 5 composition | Copy a compatible hero route into a crowd guide network | Next — gated by ROUTE-01 |
| COMPOSE-02 | Phase 5 composition | Bake a route wait from the analytically computed last crowd arrival | Next — gated by COMPOSE-01 |
| COMPOSE-04 | Phase 5 composition | Add the waypoint “+” branch gesture from a bound entry node | Next — gated by COMPOSE-01, COMPOSE-03 and REV-03 |
| DEMO-01 | Showcase/release | Replace bare backgrounds with approved example projects and living fixtures | Next — gated by COMPOSE-02, COMPOSE-04 and REV-04 |
| REV-07 | Engineering maturity | Coverage thresholds, Node matrix and dependency automation | Icebox — deferred |
| ICE-01 | UI polish | Swatch-picker popover | Icebox — promote only if palette height becomes an observed problem |
| ICE-02 | Import/colour | Okabe-Ito/UoN palette conversion | Icebox — promote only on user demand |

Quarantine contains four proposed cuts and is not schedulable without explicit
owner disposition. No Icebox promotion trigger was met at the handover.

## What to do next

UI-02 is the next runnable development ticket, but it deliberately retains
`[sign-off]`. Use PM-Skills full/gated mode: inspect the current semantic outline
and waypoint-list implementations, present a concrete scope, design
recommendation, files, sequence, risks and acceptance criteria, then wait for
explicit owner approval before changing UI code. General autojazz authority does
not bypass that gate.

If the owner instead provides physical iOS/Android evidence or cross-browser and
offline export evidence, process REV-03 or REV-04 first and update their residual
status honestly. Never infer physical-device, screen-reader or offline-browser
results from jsdom or Chromium emulation.

After UI-02 or evidence closure, refactor the backlog again. Remove shipped
items, move outcomes to trajectory, put why in the decision log, delete detail
tickets only when their items leave the live backlog, and reconsider downstream
gates and Icebox triggers from new evidence.

## Current PM-Skills health

- `pm_skills/project/file-map.md`: 3,609 words; 262 mapped files × 35 gives a
  derived 9,170-word budget; green.
- Active backlog: 523 words / 13 open items; green.
- Wish-list: 5 open items; green.
- Detail tickets: ROUTE-01 322 words, COMPOSE-01 190, REV-03 582; green and
  linked.
- `trajectory.md`: 3,082 / 2,000 words; known preserved warning.
- `decision-log.md`: 35 / 20 live entries, including one legacy 1,541-word
  entry over the 600-word guard; known preserved warning.
- Do not prune either warning without explicit owner approval.

Re-run the validator/counts rather than assuming these numbers remain current.

The optional repository-wide Markdown link checker currently reports 15
pre-existing machine-specific links in the archived
`specs/dot-crowd-navigator/app-overview.md`. The six `reviews/` documents add no
broken local link. Do not “fix” the archived verbatim evidence as part of an
unrelated ticket; if link-check parity becomes a requirement, scope its archive
handling explicitly.

## Engineering and verification discipline

For each ticket:

1. Verify cwd, branch, clean state, remote parity and relevant ticket gates.
2. Declare a narrow file claim and search the complete source surface first.
3. Preserve normalised waypoint coordinates, EventBus-only component
   communication, top-level imports, deterministic timeline evaluation and the
   split between Okabe-Ito map colours and UoN UI chrome.
4. Preserve one captured pointer transaction and one authoritative mutation,
   undo and autosave owner.
5. Do not add a runtime dependency without explicit approval.
6. Add focused tests for the acceptance contract and failure/rollback path.
7. Run `npm run check` before close.
8. When runtime/UI/build changed, prove ready state in the relevant real browser
   or environment and inspect warning/error logs.
9. Run `npm run build` only for a publishable app change that needs refreshed
   generated `docs/`; verify the exact inventory and version.
10. Update the PM-Skills records and run the memory validator/size checks.
11. Stage an explicitly enumerated set of files, inspect the staged diff, commit
    and push the approved public branch.
12. Report tests, manual/browser evidence, generated version, PM changes,
    warnings and exact commit hashes.

Do not weaken tests, erase history to satisfy soft budgets, hand-edit generated
files, claim unsupported browser/device evidence, or silently broaden one ticket
into a product redesign. Continue the same careful review-to-evidence-to-ticket-
to-implementation process until a genuine decision or authority boundary is
reached.

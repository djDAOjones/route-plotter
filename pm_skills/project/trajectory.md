# Trajectory

<!-- Shipped-work narrative. The story of what changed over time, in chunks. -->
<!-- Warm tier. Agents do NOT auto-read this every task. Read it on demand:
     during roadmap-refactor.md, release.md, or when reconstructing what
     already shipped. See AGENTS.md -> "Before every task". -->
<!-- Compress on ship. One line per item: the outcome, not the implementation.
     The WHY lives in decision-log.md; the per-file roles live in file-map.md.
     Never paste a decision-log entry in here. A pointer is enough. -->
<!-- Keep every shipped ID individually greppable: start each line with the
     item ID. When one line covers a group of related sub-items, spell out
     each ID (e.g. WL-19a, WL-19b, ... WL-19h) rather than a range, so an
     ID-level reconcile can find them all. -->
<!-- Structure: newest phase/milestone at the top. Group items by the phase or
     milestone they belong to, with a one-line Outcome per phase. -->
<!-- Budget: see AGENTS.md -> "Memory size budgets". Over budget -> prune-memory.md
     moves the oldest phases to archive/trajectory/trajectory-NNNN-<range>.md and
     adds a row to archive/INDEX.md. Archives are append-only; never rewrite. -->

## Programme close-out (2026-08-27)

PM — The original review is fully dispositioned: RP-01…RP-18 all shipped or
ticketed, and the review's Optional roadmap and unresolved uncertainties —
never covered by the RP crosswalk — audited into DEPLOY-01, REL-01, PERF-01,
LEGAL-01 and ICE-03. The backlog is now the single source of truth for what to
do next. (2026-08-27) — see decision-log.

## Branch rendering (shipped 2026-08-28)

BUG-01 — A branched hero route no longer crashes on the trunk's wait index:
each run renders with its own waypoint sub-array, so a wait past the end of a
shorter branch run now falls through to that run's own path direction instead
of reading undefined. Fixed a hard failure of video export, and of the final
preview frame, for any branched project with a late wait. (2026-08-28) — see
decision-log.

## Accessibility assurance (in progress 2026-08-27)

A11Y-02 — Forced colours no longer erases the UI: focus is restored as a
system-colour outline (box-shadow, which every ring here used, is suppressed
in that mode), selection accent bars are repainted, colour swatches opt out,
and the map canvas is a documented content exception. Also fixed a focus ring
that referenced an undefined token and so rendered nothing in any mode.
(2026-08-28) — see decision-log.

A11Y-01 — The 74 `[data-tip]` hint labels no longer pose as buttons: each
hint is now its control's appended `aria-describedby` description, and the
visible tooltip stays reachable by pointer and by keyboard focus. axe now also
runs over the shell as JavaScript leaves it, where the defect actually lived.
(2026-08-27) — see decision-log.

REV-05a — axe-core joined the gate (dev dependency, owner-approved): 48 rules,
zero violations across WCAG 2.0/2.1/2.2 A/AA/AAA and best practice, verified
live with contrast evaluated for real. (2026-08-27) — see decision-log.

PM — Quarantine cleared on owner verdicts: two cut, two recovered as REVEAL-01
(spotlight reveal that fades behind the head — investigated and confirmed not
currently possible) and LABEL-01 (auto-position timing and discoverability).
(2026-08-27) — see decision-log.

REV-05 — The structural audit, AAA contrast sampling and 400%-zoom reflow ran
green in production Chromium; two AAA failures found and fixed (a 6.37:1 label
and a 37px skip link), and the structural half is now a permanent regression
test. (2026-08-27) — see decision-log.

## Showcase (shipped 2026-08-27)

DEMO-01 — Three example projects ship as downloadable `.zip` project saves and
open from the File menu: a plain labelled route, a branching campus route with
a crowd traced from it, and a weighted signal network. Built from the live
models and loaded through the ordinary project path, so they double as living
fixtures. (2026-08-27) — see decision-log.

## Phase 5 — crowds bound to the route (in progress 2026-08-27)

COMPOSE-04 — A waypoint a bound crowd enters from carries a branch "+" handle:
clicking it arms the same fork gesture Alt+click does, hit-tested directly so a
touch tap reaches it. (2026-08-27) — see decision-log.

DEV-01 — `restart.sh` no longer refuses to boot because a browser left a closed
client socket on the port; the check matches listeners only. (2026-08-27) — see
decision-log.

COMPOSE-02 — "Wait here for this crowd" solves, in closed form, the wait a
waypoint needs so the head does not leave before the last dot arrives, and
bakes it as an ordinary authored pause. (2026-08-27) — see decision-log.

COMPOSE-03 — A crowd's network can be traced from the route: a node per major,
an edge per leg carrying that leg's minors as control points, and branches
traced as edges leaving the fork and returning to the rejoin. The copy is the
author's to reshape and each node stays bound to its waypoint. (2026-08-27) —
see decision-log.

COMPOSE-01 — A crowd can follow the route: a graph node binds to a waypoint's
position and an emitter's release binds to a route moment (arrival, pause end
or route completion), both resolved from live route state. Authored positions
and windows are never rewritten, a broken binding falls back to them with a
warning, and unanchored crowds evaluate byte-for-byte as before. (2026-08-27)
— see decision-log.

## Phase 5 — split hero routes (in progress 2026-08-27)

ROUTE-01d — A branched route exports: the snapshot carries its branch links,
the standalone player rebuilds the identical structure and master timeline, and
a branch that outlives the trunk extends the timeline instead of being cut off.
(2026-08-27) — see decision-log.

ROUTE-01c — Branches are authorable: Alt+click a waypoint to fork, click to
place; drag a branch's end onto a waypoint to rejoin (again to end it there).
Branch rows read `2·B1`, indented and tagged, with a ⑂ badge on the fork's
marker; the scope chip, the row and the semantic outline all number a branch
waypoint the same way. (2026-08-27) — see decision-log.

ROUTE-01c-a — `findWaypointAt` takes an exclusion, so a drop hit-test no longer
finds the waypoint being dragged. (2026-08-27) — see decision-log.

ROUTE-01b — Branches now draw and animate: each gets its own spline anchored
at its fork (and rejoin), its own head, and its own progress resolved from
master timeline time through the same PlayerCore mapping the trunk uses. The
follow-camera keeps tracking the trunk head. (2026-08-27) — see decision-log.

ROUTE-01a — The hero route can now describe branches: additive, null-defaulting
branch links on Waypoint, a pure resolver that cuts a route into trunk plus
contiguous branch runs and reports structural problems instead of repairing
them, and a deterministic master-timeline composer implementing simultaneous
fork start, latest-arrival rejoin and universal completion. Headless — linear
projects keep their exact serialized shape and timeline. (2026-08-27) — see
decision-log.

## Inspector foundation (shipped 2026-08-27)

UI-02 — The waypoint list now shows the whole route: minors appear as indented,
selectable, renameable rows under the leg they shape, numbered `major.minor` by
the same routine the semantic outline uses, and a major visibly drags and
reorders as its whole leg block. (2026-08-27) — see decision-log.

UI-02a — Inline rename no longer throws NotFoundError on every successful
commit: `finish()` detaches its own blur listener before replacing the input.
(2026-08-27) — see decision-log.

DOC-01 — `AGENTS.md` is one shared Codex/Claude contract with a tiered read
policy and a minimal `CLAUDE.md` adapter; stale prompt paths and the duplicated
budget table are gone. (2026-08-26) — see decision-log.

## Route-head presets (shipped 2026-08-26)

HEAD-01 — A reviewed right-facing quadcopter is now a built-in route head with
shared size, rotation, persistence, undo and standalone-export behaviour, while
custom image ownership stays unchanged. (2026-08-26) — see decision-log.

## Maintenance (shipped 2026-08-26)

MAINT-01 — Superseded timing/visibility helpers, a permanently inert export
warning and their orphaned cache state are removed without changing route,
playback, persistence or export behaviour. (2026-08-26) — see decision-log.

## Phase 6 — resolution-independent rendering (shipped 2026-08-26)

SCALE-01 — Projects now preserve map-bound authored sizes through a stable
reference render space across editor, HTML and video resolutions, independently
of normalised geometry and the authored timeline. (2026-08-26) — see
decision-log.

## Performance (shipped 2026-08-26)

REV-06 — Stable paused editor and standalone-player views now leave no animation
frame queued; transport changes and camera settling wake on demand while the
explicit export frame loop stays synchronous. (2026-08-26) — see decision-log.

## Crowd controls (shipped 2026-08-26)

CROWD-02 — Crowds now author whole-release busyness with a direct line graph,
two-to-eight handles, gradual or sudden spans and equivalent exact controls;
the seeded profile is undoable and identical after reload and in export.
(2026-08-26) — see decision-log.

CROWD-03 — Crowds now expose plain-language seeded walking, pace, release and
route-choice variation, the exact reproducible seed and a one-step Re-roll
that changes the pattern without changing authored controls. (2026-08-26) —
see decision-log.

## Inspector foundation (shipped 2026-08-26)

UI-05 — Marker, On arrival, Label and Leg cards now reset the selected
waypoints to route style or apply one waypoint's settings to later applicable
waypoints as one accessible, undoable transaction; authored label text and
polygon geometry stay untouched. (2026-08-26) — see decision-log.

UI-04 — Multi-waypoint cards now compare each field's actual write targets and
show a transient, accessible Mixed state without changing saved projects;
choosing a value still performs the established shared edit. (2026-08-26) —
see decision-log.

UI-03 — Label text/background colour and opacity plus incoming camera zoom
transition are now editable under More, with exact custom-colour state,
multi-major writes, undo, reload and export-compatible persistence.
(2026-08-26) — see decision-log.

UX-02 — Label Size now edits its persisted 16–48 renderer-pixel value directly;
size, amplitude and background-overlay readouts expose their effective units
and accessible values; ambiguous names use plain language; and Pacing explains
Comet's intentional preview-tail extension. Stored project values, scaling and
timeline semantics are unchanged. (2026-08-26) — see decision-log.

UI-01 — Crowded inspector cards now keep their shortest complete task visible
and place refinements in one accessible native More disclosure, providing the
layout slot for advanced and crowd controls. (2026-08-26) — see decision-log.

## Review Phase 2 — semantic scene authoring (shipped 2026-08-26)

REV-02 — Route, crowd, emitter, custom-network and polygon structure is now
inspectable and authorable through a synchronized semantic outline; standalone
exports add aggregate scene context and discrete transport announcements.
(2026-08-26) — see decision-log.

## Support hand-off (shipped 2026-08-26)

SUPPORT-01 — Report a bug now previews one redacted diagnostic bundle before
any explicit copy, download or public-Issues hand-off, supplies a safe address
fallback and routes suspected vulnerabilities to private reporting.
(2026-08-26) — see decision-log.

## Phase 1 — live-app health and public boundary (shipped 2026-08-26)

KEY-01 — Undo, redo and Save now have one authoritative keyboard/button event
path; stale Tab navigation was removed. (2026-08-26) — see decision-log.

UX-01 — Waypoint scope now has a direct labelled Route target, avoiding
repeated back-arrow navigation. (2026-08-26) — see decision-log.

BUG-01 — Area-handle hit-testing now compares one coordinate space and remains
correct through viewport zoom and drag. (2026-08-26) — see decision-log.

QA-02 — Nudge undo grouping and editor restoration after undo/redo are pinned
as verified behaviour. (2026-08-26) — see decision-log.

CROWD-04 — Add crowd works without a hero route by creating a graph guide and
entering network authoring with neutral lifecycle copy. (2026-08-26) — see
decision-log.

CROWD-01 — Junction choices are edited together as normalised shares and
previewed with percentage text plus non-colour-only guide widths.
(2026-08-26) — see decision-log.

REV-08 — The public/share/support boundary is enforced by an explicit build
allowlist, CSP, safe style grammar, original-byte disclosure and previewed
redacted diagnostics. (2026-08-26) — see decision-log.

REV-09 — MIT terms, dependency notices, private vulnerability reporting and
best-effort GitHub Issues support now ship as checked governance contracts.
(2026-08-26) — see decision-log.

REV-10 — Custom marker and route-head images now use reference-aware asset
reachability, rollback-safe admission and minimum-oldest undo shortening at
the project limits; Clear, load, recovery and ZIP boundaries are pinned.
(2026-08-26) — see decision-log.

## Phase 0 — owner decisions and acceptance (closed 2026-08-26)

QA-01 — Owner accepted selection behaviour, standalone-player feel, major-leg
timing and the shipped 0.1×–10× segment-speed range. (2026-08-26) — see
decision-log 2026-08-26.

REV-02, REV-08, REV-09, ROUTE-01, SCALE-01 — Owner signed off the
semantic-authoring, publication/privacy, governance, simultaneous split-route
and project-reference sizing contracts; each implementation moved to its
dependency phase. (2026-08-26) — see decision-log 2026-08-26.

## REV-01 — comprehensive repository-review remediation (shipped 2026-08-26)

REV-01 — Project recovery/import is transactional and bounded; autosave is honest and Clear All cannot revive stale work; timeline/export behaviour is deterministic; keyboard, modal and responsive reflow defects are repaired; and CI, clean Pages builds, deployment and restart scripts fail safely. The larger product, assurance and governance questions remain as REV-02–REV-10. (2026-08-26) — see decision-log 2026-08-26.


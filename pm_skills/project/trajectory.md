# Trajectory

<!-- Shipped-work narrative. The story of what changed over time, in chunks. -->
<!-- Warm tier. Agents do NOT auto-read this every task. Read it on demand:
     during memory-maintenance.md, release.md, or when reconstructing what
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

## W3 — the pilot (closed 2026-09-26; merged, not yet released)

Outcome: the slider scales live in their own pure module, and the pilot showed
that nothing yet guards the sidebar's readouts.

SPL-01 — The slider scales moved out of the visibility service into
`utils/sliderScales`; every readout and restored value is unchanged.
(2026-09-26) — see decision-log.

## The post-W2 queue (2026-09-24 to 2026-09-26; merged, not yet released)

Outcome: exports, the player and paused views draw what the editor draws,
points off the image stay editable, and a small failure no longer passes
silently or corrupts what follows.

DEF-34 — An exported HTML player draws at the project's Graphics scale, as
the editor and video do. (2026-09-24) — see decision-log.

TST-17 — The draw log names the canvas each frame composites, so compositing
the wrong canvas fails the draw goldens. (2026-09-24)

DEF-36 — A frame that throws part-way no longer leaves the vector layer's
transform stacked, so later frames draw at the right zoom. (2026-09-25) — see
decision-log.

DEF-35 — Crowd anchors, dots, area drags and the scene outline follow points
off the image instead of pinning them to its edge. (2026-09-26) — see
decision-log.

DEF-08 — Pop, grow and pulse beacons scale their marker in video exports,
scrubbing and pause, not only while playing. (2026-09-26)

DEF-17 — A finished polygon names its waypoint, so the sidebar and the scene
outline show it at once. (2026-09-26)

DEF-33 — Loading the app no longer tells a screen reader "Animation paused",
and a restored session is announced. (2026-09-26)

DEF-30 — A refused benchmark changes nothing, a failed one says so, and
`EventBus.once` runs once. (2026-09-26)

DEF-37 — A project file whose Graphics scale is `null` opens at 1×, and its
next save reopens. (2026-09-26)

DEF-29 — Video exports show pulse, ripple and glow beacons whatever the
author's reduced-motion setting. (2026-09-26) — see decision-log.

## W2 — the live defects, released as v3.2.692 (closed 2026-09-24)

Outcome: projects that would not reopen now do, the exported player draws what
the editor draws, and a shared file carries only what the project uses.

DEF-02 — An exported HTML player follows a traced crowd to its waypoints, as
the editor and video do, instead of leaving it where it was traced.
(2026-09-24) — see decision-log.

DEF-03 — Waypoints, polygon vertices and area centres placed off the image
while zoomed out reload, within ten image-widths of it, and every authoring
path stops at that edge. (2026-09-24) — see decision-log.

DEF-31 — Tracing a route whose waypoint ids are as long as the limit makes a
project that reopens, with no node or path lost to a clashing id.
(2026-09-24)

DEF-23 — A saved project or HTML export carries only the images the project
uses, and the HTML page no stored filenames. (2026-09-24) — see decision-log.

DEF-26 — A short hex glow colour draws instead of freezing playback, and one
bad frame no longer stops playback or redrawing. (2026-09-24)

DEF-21 — Help and the File menu describe the keys that exist. (2026-09-24)

## W1 — the abstraction programme's safety net (closed 2026-09-23)

Outcome: the behaviour a refactor must not change is now written down and
enforced — the save shape, what the renderer draws, and the two interfaces
nobody had declared. Test-only; nothing shipped to users.

ISO-02 — A listener that throws on the EventBus can be observed instead of
vanishing: an optional `onListenerError` handler and counters, with today's
log-and-continue default unchanged. (2026-09-23) — see decision-log.

TST-10 — The suite is loud where it should be and quiet where it should not:
a strict bus, an undeclared `console.error`/`warn` fails its test, and a
canary fails a run too small to be the real suite. (2026-09-23)

TST-07 — The exported player's ~25-member host contract is derived from the
mixin's own source and checked against a player that really loaded a project,
and the player bundle is proved closed through esbuild's metafile.
(2026-09-23)

TST-06 — The one save shape is pinned to a file per example plus a fixture
that leaves no field at its default, `load(save(x))` is proved stable, and
every slider and select of the shipped shell is shown to save a project that
loads — with DEF-03/04/31 characterised as the three places it does not.
(2026-09-23) — see decision-log.

TST-02 — What the renderer draws is frozen: whole draw transcripts for four
fixtures at five instants in the editor, preview and export, with play == seek
and app == player proved at the draw level. (2026-09-23) — see decision-log.

## Release v3.2.691 (shipped 2026-09-22)

DEF-01 — The "Background Mode Debug" panel no longer paints over the picture
in Angle of View Reveal, in preview, video exports or the player; the overlay,
its AoV debug logs and the cone-debug state are gone, pinned by a test that
proves no background mode draws text or a panel. (2026-09-22) — see
decision-log.

TST-01 — Tests can boot the whole app from the shipped shell, and the test
world behaves like a browser: absent storage keys read `null`, and every
canvas records its own draw calls, style state and resets. (2026-09-22) — see
decision-log.

## Abstraction programme W0 — safe setup (closed 2026-09-22)

Outcome: agents can no longer release by accident, and the root docs match
the code. Six pull requests, no shipped-code change, so no release.

DOC-06 — `AGENTS.md` forbids committing to or pushing `main` outside an
owner-called merge or release (#1), and the root docs meet the vendored
workflows: a Quality gate section, aliases for all 12 dangling section
references, the refactor and prune-bar clauses (#3). (2026-09-22) — see
decision-log.

DEF-18 — `push.js` refuses unknown options and mistyped dry runs before
anything runs, reads npm's dry-run setting as npm does, and runs
`npm run check` (#2). (2026-09-22) — see decision-log.

GOV-01 — DEV-INFRASTRUCTURE gives the fresh-clone, branch-and-PR working
setup and checked release steps; a merge releases no source (#4).
(2026-09-22) — see decision-log.

DOC-02 — The canonical docs' drift against the code is corrected, with
restated copies replaced by links (#5). (2026-09-22) — see decision-log.

DOC-03 — The communication rule is the owner's Q15 rule, with every current
exception listed (#6). (2026-09-22) — see decision-log.

## Release v3.2.690 (shipped 2026-09-22)

DEPLOY-01 — The remediation line is released from `main`: v3.2.690
(`caea691`), Pages source back on `main /docs`, verified by deployment SHA and
by SHA-256 of every published file; rollback tag `v3.2.689`. Also corrected the
record that Pages had served `main` all along — it had served the branch since
2026-08-26. (2026-09-22) — see decision-log.

REL-01 — The production source map stays published. (2026-09-22) — see
decision-log.

REL-02 — `main` is protected by a ruleset against force-push and deletion,
with no bypass, so the branch Pages serves cannot be rewritten or removed.
(2026-09-22) — see decision-log.

LEGAL-01 — Owner confirmed the MPL posture; the notices and licence now ship
with the app and are linked from Help, with mediabunny's source pinned to the
exact tag and commit it was built from. (2026-09-22) — see decision-log.

## Programme close-out (2026-08-27)

PM — The original review is fully dispositioned: RP-01…RP-18 all shipped or
ticketed, and the review's Optional roadmap and unresolved uncertainties —
never covered by the RP crosswalk — audited into DEPLOY-01, REL-01, PERF-01,
LEGAL-01 and ICE-03. The backlog is now the single source of truth for what to
do next. (2026-08-27) — see decision-log.

## Engineering maturity (shipped 2026-08-28)

DEPS-01 — Dependency pass taken deliberately and gated one upgrade at a time:
vitest 4.1.11, mediabunny 1.55.3 (export re-verified in Chromium, MP4 and
WebM), jsdom 27 -> 29 across two majors, which also dropped five transitive
packages. jszip, esbuild and axe-core were already latest. jsdom 30 refused:
it needs Node >= 24.15.0 and this checkout runs 24.5.0. (2026-08-28) — see
decision-log.

## Performance (shipped 2026-08-28)

ICE-03 — The cost curve is repeatable: `scripts/perf-harness.js` prints it on
demand with no pass/fail threshold and no place in the quality gate, because
frame timings are machine-dependent. Its first version let the running app
autosave the synthetic benchmark project over the author's; autosave is now
suppressed for the rest of the page's life. (2026-08-28) — see decision-log.


PERF-01 — The supported ceiling is now measured, not assumed: waypoint count is
the only dimension that costs frame time (comfortable to ~200, borderline at
500, not interactive by 1,000), while 5,000 dots cost ~1 ms and image
resolution costs no frame time at all — only memory. (2026-08-28) — see
decision-log.

## Inspector polish (shipped 2026-08-28)

LABEL-01 — Auto-position now runs when a label is first written, never again
once the author has placed it by hand (a new persisted flag), and the button
sits in the Label card's primary tier instead of behind More. A colliding label
raises one fading offer to re-place it, reusing the toast. (2026-08-28) — see
decision-log.

## Reveal modes (shipped 2026-08-28)

REVEAL-01 — The spotlight reveal now fades out behind the head over an
authorable per-project trail, persisted and carried into the exported player;
the maximum is a sentinel meaning "never fades", so older projects are
untouched. The reveal sliders are also synced on load for the first time.
(2026-08-28) — see decision-log.

BUG-02 — A zero feather no longer makes the spotlight invisible: equal gradient
radii paint nothing, so the shipped default rendered nothing at all in both
spotlight modes. (2026-08-28) — see decision-log.

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


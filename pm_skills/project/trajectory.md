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

## W5 — deepen the characterisation (2026-09-29 →; merged, not yet released)

Outcome: written when W5 closes.

TST-05 — For every event the two wiring files subscribe to, in the
scenarios its rows name, one fresh app per row: the emits it causes and
each step in order, what it says and shows, the project, selection and
undo change at once and after ten seconds of timers (each delay pinned),
and whether browser recovery holds the project as it stands. The
dispatch order of all 194 boot listeners is pinned too, so W9's CLR-01
split must leave both unchanged. DEF-15, DEF-16 and DEF-22 are pinned as
they stand. (2026-10-01)

## The big run: defects outside the waves (2026-09-28 →; merged, not yet released)

Outcome: written when the run's last such defect has merged.

DEF-48 — The preview tip's storage access is guarded, as every other the app
reaches is: a browser that blocks site storage no longer stops the app
starting, and a full store no longer throws from the tip's timer. (2026-09-28)

DEF-49 — A failed load's rollback keeps going when a step fails: a failure
restoring the image assets or the undo history no longer leaves the previous
waypoints beside the failed project's styles and settings. (2026-09-28)

DEF-40 — An outline entry opens with its content on one click or key press,
and closes on the next, one holding the selection too: the outline toggles its
entries itself, a selection or focus request opens entries once, and a
redraw's focus no longer reopens the entry just closed. (2026-09-28)

DEF-41 — A crowd traced from a route that bends off the image bends there
too: its bends keep the range a project can store, reload, and can be edited
in the outline; a bend drawn by hand still stays on the image. (2026-09-28)

DEF-61 — Under the author's viewport zoom, the map is drawn under the zoom
alone, as the route already was, not the animation camera as well: the route
no longer leaves the map in Preview, or in a video exported while zoomed in.

DEF-52 — A route traced into a crowd is checked as the project it would
make would be when it is saved and opened: a trace the loader or the file's
metadata would refuse (a leg with more bends than a path can hold, a scene,
project or file past its budgets) is refused, saying why, whether or not the
project already failed that check, so a traced crowd reopens (its images all
there). The archive's whole size, which its images dominate, stays Save
Project's check (DEF-04).
(2026-09-29)

DEF-59 — The network editor's pen keeps a crowd within the six graph counts a
project can store, as the outline does: a node, link or bend past a crowd's or
the scene's counts is refused, in the outline's words. The project-wide
budgets, which no editor checks yet, stay DEF-04's. (2026-09-29)

DEF-46 — A video export is the app's from the moment it is asked for to the
end of its clean-up: another asked for meanwhile, by a control, the bus, or
a script called back by the export's own setting up or clean-up, is refused
before it touches it, its size included, so it no longer spoils its frames,
mode and buttons, and Export MP4 starts no codec probe meanwhile. Overlapping
MP4 probes are superseded, not refused: a codec probe, or the dialog it
opened, answers only for the export the author last asked for, so a stale
one starts nothing, and an open dialog closes rather than holding Escape from
the export. Once its transport is suspended, each part of an export's
clean-up runs whether or not another fails, and its controls are freed
whatever failed. (2026-09-28)

DEF-43 — A polygon draw follows its waypoint through an undo or a redo, and
ends, saying so in a toast, when its waypoint is deleted or undone away,
rather than closing onto a waypoint the project no longer has; and Draw Area
asked for again keeps the draw in progress. (2026-09-29)

DEF-27 — The instant spotlight and angle of view follow the camera, so the
circle or cone stays on the head at any zoom, and the contrast tint covers the
image's rectangle and no margin at any background zoom, moving with the camera.
(2026-09-29)

## Before the big run (2026-09-28)

Outcome: Route Plotter is a Chromium-only app for now; REV-04 closes with its
Firefox and Safari evidence waived, not supplied.

REV-04 — Closed on Joe's call that Route Plotter is Chromium-only for now:
Chromium's codec, container and offline export evidence (2026-09-24,
v3.2.692) stands, and Firefox and Safari are no longer checked. (2026-09-28) —
see decision-log.

## The post-W2 follow-ups (2026-09-28; merged, not yet released)

Outcome: no frame draws with state that an earlier frame or layer left
behind, whether after a throw, after a resize or while an area is drawn.

DEF-38 — A frame that throws while drawing the background no longer leaves its
zoom, camera or mask on the canvas for the frames after it. (2026-09-28) — see
decision-log.

DEF-39 — Area borders, marker outlines and the editor's minor dots draw with
round ends and corners in every frame, whatever came before it. (2026-09-28) —
see decision-log.

DEF-47 — A polygon being drawn shows its edges in the preview's own blue from
the first point. (2026-09-28)

## W3 — the pilot (closed 2026-09-28; merged, not yet released)

Outcome: the slider scales live in their own pure module, and the pilot showed
that nothing yet guards the sidebar's readouts.

SPL-01 — The slider scales moved out of the visibility service into
`utils/sliderScales`; every readout and restored value is unchanged.
(2026-09-28) — see decision-log.

## The post-W2 queue (2026-09-24 to 2026-09-28; merged, not yet released)

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
off the image instead of pinning them to its edge. (2026-09-28) — see
decision-log.

DEF-08 — Pop, grow and pulse beacons scale their marker in video exports,
scrubbing and pause, not only while playing. (2026-09-28)

DEF-17 — A finished polygon names its waypoint, so the sidebar and the scene
outline show it at once. (2026-09-28)

DEF-33 — Loading the app no longer tells a screen reader "Animation paused",
and a restored session is announced. (2026-09-28)

DEF-30 — A refused benchmark changes nothing, a failed one says so, and
`EventBus.once` runs once. (2026-09-28)

DEF-37 — A project file whose Graphics scale is `null` opens at 1×, and its
next save reopens. (2026-09-28)

DEF-29 — Video exports show pulse, ripple and glow beacons whatever the
author's reduced-motion setting. (2026-09-28) — see decision-log.

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


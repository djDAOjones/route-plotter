# Trajectory

<!-- Shipped work, one line per item, under a phase heading, newest
     phase first: - ID — outcome (YYYY-MM-DD) — see decisions. Rule 1
     reads the latest item lines within the 300-word budget, never
     fewer than the last four shipped. The lines below are the last
     items the canon record shipped before the migration, in v3's form;
     their why is in the frozen canon decision log (history.md). -->

## Next feature — the owner's word of 2026-10-18

- RECALL — 8/8 (2026-10-19) — scores: 2,2,2,2 — local — see decisions
- UI-08 — Background → Show image hides the background while editing, in playback and in every export, and Include in export → Background image ticks with it; the image is kept and saved, one change is one undo, and an HTML export leaves a hidden image out (2026-10-19) — see decisions

## Export framing — the owner's word of 2026-10-18

- DEF-100 — a path-only video export draws the route, markers, labels and crowds where the export with its background does (2026-10-18) — see decisions
- DEF-99 — a video export frames the whole picture, or follows its camera, whatever the editor's zoom (2026-10-18) — see decisions

## The built-in examples — the owner's word of 2026-10-17

- EX-02 — Match day and Reform riot, 1831 open from File → Example projects on the Nottingham aerial: fans fill the City Ground's four stands from three routes and two bridges, and a mob passes through the Market Square to the Castle (2026-10-17) — see decisions
- EX-03 — Match day's dots double to solid 0.15 and fans converge on the City Ground from the town centre, station, buses, every edge, car parks, park and ride, pubs and cycle paths, each stand seating fans one per seat while more walk in (2026-10-18) — see decisions

## MVP — football crowds and mobs

- RECALL — 7/8 (2026-10-16) — scores: 1,2,2,2 — local — see decisions
- RECALL — 7/8 (2026-10-16) — scores: 1,2,2,2 — local — see decisions
- RECALL — 8/8 (2026-10-16) — scores: 2,2,2,2 — local — see decisions

- DEF-84 — crowds with a drawable network play and export without a route; empty scenes explain what to add (2026-10-14) — see decisions
- CROWD-08 — all seven football and mob MVP parts shipped across v3.3.719–722; D–G published together (2026-10-16) — see decisions

## Ahead of Phase 2's last defects — the owner's word of 2026-10-13

- RECALL — 7/8 (2026-10-13) — scores: 2,2,1,2 — local — see decisions
- RECALL — 8/8 (2026-10-13) — scores: 2,2,2,2 — local — see decisions
- RECALL — 8/8 (2026-10-13) — scores: 2,2,2,2 — local — see decisions
- DEF-98 — a session browser recovery restores comes back with every image the project uses, the background, custom markers and the custom path head, each with its file name; an image recovery cannot keep is named with the reason in a warning, and a background that cannot come back is offered again by name, never replaced (2026-10-13) — see decisions

## Phase 3 — Design reviews

- DEF-94 — the scene outline's validation errors show their accent bar and red field border again, because the five tokens the stylesheets used without a definition are defined (2026-10-08) — see decisions
- DEF-83 — a keyboard user tabbing onto a collapsed card header now sees its focus ring, because the header is a native button whose ring is drawn inside it, out of the card's clip (2026-10-08) — see decisions
- DEF-91 — a background that fails to load, uploaded or from the examples, now says why in a toast and aloud, and the canvas area is marked busy while one decodes (2026-10-09) — see decisions
- DEF-82 — with focus anywhere inside an open dialog, its title included, the page's shortcuts stand down, so Space, Delete or A no longer act on the editor behind it, nor Delete or T on the network pen's selection, while `?` still opens Help (2026-10-11) — see decisions
- DEF-96 — the Marker card's Size reads the diameter it draws, "16 reference px" at the default where it read 8, in its readout and `aria-valuetext` wherever they are written, while what is stored and drawn is unchanged (2026-10-11) — see decisions
- DEF-86 — a crowd slider or the Path card's Share no longer rewrites a stored value: a number field beside each takes the model's whole range, and a slider writes only where it is moved, off at its nearer end with its reason when the value lies past it, so a Count of 1000 or a weight of 24 survives a nudge (2026-10-12) — see decisions
- DEF-89 — after Trace route into network the Guide card's helper counts the traced network at once, without entering Edit network, as it already did after Undo, Redo and an outline edit (2026-10-12) — see decisions

## Phase 2 — The owner's after-TST-04 items, then W5 and the defects it held

- DEF-32 — activating a waypoint-list row by click, Enter or Space rebuilds the list once, so focus stays on the selected row instead of falling to the page (2026-10-08) — see decisions
- DEF-13 — a focused button, list row, summary, section header or link keeps only Space (a menu item or option also its arrows), so Delete, the nudge arrows, Undo, Save and the timeline keys work after a click, and Cmd+S no longer opens the browser's Save dialog (2026-10-08) — see decisions
- DEF-20 — after Open, a failed Open's rollback and Clear All the controls show the project they hold: the Duration thumb sits at its speed, so one nudge moves it one step, the reveal and Angle of View sliders follow it, and Clear All leaves Preview through the one mode setter (2026-10-08) — see decisions
- DEF-81 — Verify's job limit rises from 15 to 30 minutes, so a suite that now runs about 14 minutes on GitHub is no longer cut off (2026-10-07) — see decisions
- TST-03 — every path and waypoint visibility mode and both reveal masks are pinned as a golden table at each window edge, on bare inputs and a real engine timeline, and seek equals play forwards, backwards and scrambled for every mode (2026-10-07) — see decisions
- UI-04 — each hint has a "?" of its own beside its label, opened by hover, focus or tap, so a label acts as a label again (2026-10-06) — see decisions
- DEF-14 — a click on a label toggles or focuses its control, and every range names its readout to screen readers (2026-10-06) — see decisions
- TST-09 — camera, dots, curvature cache, minor-end and time domains are pinned as they stand on a branched route, play, seek and export compared, so the camera, dot, curvature and minor-end fixes each move a baseline on purpose (2026-10-06) — see decisions
- CROWD-06 — a Hold at end control (0–10 s) carries the animation on after everything that finishes has finished, the same in every output; projects saved before it open with none, and "Wait here for this crowd" is retired (2026-10-06) — see decisions

## After TST-16, ahead of Phase 1's other pull requests — the owner's word of 2026-10-05

- RECALL — 8/8 (2026-10-05) — scores: 2,2,2,2 — local — see decisions
- CROWD-05 — the animation runs until every crowd dot that finishes has finished and every beacon has settled, crowd releases still timed against the route, and Duration says what sets the end (2026-10-05) — see decisions
- DEF-72 — the timeline shortcut is taken only when the timeline is the path: a seek under a comet tail lands where the head is, and a trunk keeps its own time when a branch outlives it (2026-10-05) — see decisions

## Ahead of Phase 1's pull requests — the owner's order of 2026-10-05

- RECALL — 8/8 (2026-10-05) — scores: 2,2,2,2 — local — see decisions
- UI-03 — a mouse resting on a hint's text opens it, Escape dismisses it in place, thirteen unclear hints are reworded and every setting has a hint, the scene outline's included (2026-10-05) — see decisions
- DEF-77 — "At journey end" acts where it is seen: a new crowd's dots finish, a network with no Exit ends journeys at its ends, Respawn varies each journey, and the panel says when no dot finishes and why (2026-10-05) — see decisions

## Phase 1 — Land the big run's open pull requests

- RECALL — 8/8 (2026-10-06) — scores: 2,2,2,2 — local — see decisions
- DEF-28 — a session that cannot be restored is kept and offered (Download it, Discard) instead of cleared or overwritten, each further one under a key of its own; Discard and Clear All say what they removed and what they could not (2026-10-06) — see decisions
- TST-04 — every sidebar control's effect is pinned as a golden, credited by the listeners its gestures run, with the instrumentation installed before any app module loads, and readouts pinned per selection (2026-10-05) — see decisions
- DEF-45 — announcements are read in turn, each holding the live region for 2 s, so a recovery warning is no longer replaced or lost, and a warning already waiting is not queued again, so a burst of loads leaves at most one behind (2026-10-05) — see decisions
- TST-08 — the mixin composition is guarded from the parsed source: `main.js` composes exactly the listed mixins and reaches the prototype nowhere else, nothing changes a mixin, and every call on the app by name reaches a function it has; what the reader cannot follow is refused with its line (2026-10-05) — see decisions
- TST-05 — every event the wiring subscribes to and the order its listeners run are pinned as golden transcripts, with hidden payload fields digested and the waypoint lookup checked after each step, Undo and Redo (2026-10-05) — see decisions
- TST-14 — the restart script's safety checks can fail on a Mac as in CI, its stand-in tools answer only what they model, and the context menu has its first tests, acting on the waypoint right-clicked at the pointer (2026-10-05) — see decisions
- DEF-64 — a branched route's legs are hovered and clicked along their own runs, trunk and each branch, a click selects the waypoint a leg leaves, and only a trunk leg offers the "+" (2026-10-05) — see decisions
- TST-16 — the round-2 audit's predicates are tight: problem lists exact, ZIP round trips compare each image's own bytes, undo and redo announce counts past one, and DEF-12, DEF-22, DEF-25, CON-04 and CON-09 are pinned as they stand (2026-10-05) — see decisions
- DEF-42 — a beacon style or pulse cycle chosen in the inspector retimes at once, and a branched route's timeline is composed afresh at every rebuild, so a pause or beacon edit there changes its total (2026-10-05) — see decisions
- TST-13 — the key table, element ids and HTML number ranges are pinned against the code, and the source reader reports what it cannot read (2026-10-05) — see decisions
- SPL-06 — `build.js` builds only when run as a script, and exports the checks a release applies and its publish and rollback steps (2026-10-05) — see decisions
- DEF-44 — a still editor goes idle: a frame that draws no camera puts the camera where it would come to rest, bounded residuals named (2026-10-05) — see decisions
- DEF-53 — a video export keeps the canvas size it began with; a size chosen meanwhile applies once it ends (2026-10-05) — see decisions
- DEF-06 — what a route scheduled no longer outlives it, and a snapshot times the route at its authoring speed (2026-10-05) — see decisions

## The big run — defects outside the waves (released in v3.2.693, 2026-10-05)

- DEF-27 — the tint covers the image, and the instant spotlight and angle of view follow the camera (2026-10-01) — see decisions
- DEF-43 — a polygon draw follows its waypoint through an undo or a redo, or ends and says so, and Draw Area again keeps it (2026-10-01) — see decisions
- DEF-46 — a second video export is refused before it touches the running one, and a stale codec probe starts nothing (2026-10-01) — see decisions
- DEF-52 — a route traced into a crowd is refused when the project could not store it (2026-10-01) — see decisions
- DEF-59 — the network editor's pen keeps a crowd within its graph counts (2026-10-01) — see decisions
- DEF-61 — under the author's viewport zoom, the map is drawn under the zoom alone, as the route is (2026-09-30) — see decisions

# The v4 architecture plan — MERGE-01 with REFACTOR-01's port plan — 18 November 2026

**Phase 7 opened on 19 November 2026 by PLAN-7.** That entry changes A13
(§13, §18), adds GATE-02 to Phase 7 and the accessibility files to the shared
files (§19), and gives every core item three duties Phase 6 taught; each
change is provisional under the owner's grant G3.

**Brought up to date on 19 November 2026 by PLAN-6 (the entry of that
date).** The owner answered the question round of section 22 on the evening
of 18 November and gave his word on publishing v4 to GitHub Pages; his words
stand in section 22 and, with what he was shown, in
`reviews/v4-plan-question-round-answers-2026-11-19.md`. As that entry reads
his answers (a reading, his to correct), A1, A2b, A3, A4, A11, A15, A23 and
A24 are ruled as recommended, A2b with a requirement he added, and A16 is
overturned; PUB-01 moves to Phase 6, straight after STACK-02. Sections 18 to
22 say so. The rest of the plan is as merged in #172: where an earlier
section calls one of these provisional, or places PUB-01 last in Phase 7,
sections 18 to 22 and that entry win.

This is the one written plan PLAN-5 asks for: MERGE-01's architecture of v4
and REFACTOR-01's plan for porting v3's engine into it. It was written on the
night of 18 to 19 November 2026 by an Opus sub-chat, under the owner's
overnight grant G3, whose option he picked in these words: "Proceed on
recommendations (Recommended)" (word for word in Appendix A). So every
recommendation here is **provisional** until he rules on it. Each is numbered
(A1 onwards) and listed in section 18 with what would be redone if he
overturns it, and each goes on the night's decisions list for him.

Codex (gpt-6-astra) reviews this plan read-only before the owner's question
round; its findings and the answers to them are recorded in section 23. The
question round itself is section 22.

## How to read this plan

- **Authority.** The owner's words are the requirements: his vision and Q1 to
  Q24 in `reviews/v4-vision-question-rounds-2026-11-18.md`, P1 to P11 in
  `reviews/v4-programme-2026-11-18.md`, the PLAN-5 decision, and his overnight
  answers G1 to G6 (kept word for word in the session lane, outside this
  repository, and quoted here where used). Where this plan differs from his
  words, his words win. Section 2 lists each requirement and where the plan
  meets it.
- **What it is for.** Another chat should be able to build v4 from this file
  and the record alone. Part A (sections 3 to 13) is the design. Part B
  (sections 14 and 15) is where the code lives and the port. Part C (sections
  16 to 18) gives every held line its home, checks the plan against the
  record, and lists the decisions taken for him. Part D (sections 19 to 23) is
  the build in order, the phases, the brief's amendment, his question round
  and Codex's review.
- **Words.** "Point" is any point of a route's line; a **stop** is a point
  that can carry a pause, a label, a marker or a feature's per-stop settings
  (v3's major waypoint); a **bend** only shapes the line (v3's minor
  waypoint). "Line" is the drawn line between points. The **lead** is the
  single traveller every route has. A **feature** is a module an author adds.
  These are the interface's words too: one word per concept (Nielsen; the
  profile's "no synonyms for existing concepts").

## 1. Summary

- **The model.** A project is one **scene** (background, clock, export, and
  scene features such as the camera) holding any number of **routes**. A route
  is geometry only: points joined by lines, which may fork, join, run both
  ways and start in several places. On every route the **core** is always
  present: the line with its style, the lead (one traveller, timed leg by leg
  with pauses), and per-stop markers, labels and pauses. Everything else is a
  **feature** the author adds from an Add feature list: a crowd, arrival
  effects, highlighted areas, a background reveal, a line glow on a route; the
  camera on the scene. A v3 route and a v3 crowd both become a route; the
  bridges between them (Follow route, Trace route, anchored nodes) disappear.
- **Time.** Every time is stored in milliseconds of scene time, never as a
  fraction of a duration. Each part says when it stops changing; the scene's
  length is the latest of those plus Hold at end, unless the author fixes it.
  Every frame stays a pure function of (timelineMs, projectState, seed).
- **Modules.** Each feature is one folder, `src/features/<id>/`, owning its
  settings, save fields, evaluation, drawing, controls and tests. Features
  never import each other; they meet only at seven contact points the core
  offers, each used by at least two real v4.0 features. The gate enforces
  this with dependency-cruiser rules beside the PM-Skills pack's own layers.
- **Where it lives.** v3's app moves into `v3/` with its own package and
  lockfile, its build and release scripts unchanged; it builds into `v3/`,
  its output proved identical to the tag's, while the committed `docs/` (the
  live 3.3.726 site) stays untouched until v4's first publish. v3 stays
  recoverable at tag v3.3.726. v4 takes the root on the PM-Skills editor
  layout.
- **The port.** v3's pure engine is ported to strict TypeScript with its
  tests: geometry, timing, crowds, visibility maths, the drawing stack split
  by layer, video export, and the file-safety trust boundary. v3's interface,
  its mixin orchestrator, its event bus, its format migrations and its
  examples are not ported. A test that pins an open defect is not ported as a
  requirement: it is inverted to assert the fix, or replaced by the held
  check.
- **The build.** Twenty-eight items in four phases: foundations (Phase 6), the
  core end to end and the publishing set-up (Phase 7), features as modules
  (Phase 8), presets and v4.0 (Phase 9). The least settled work comes last.
- **The owner's questions.** Two rounds of four (section 22). Round 1: what
  sets the scene's length; whether one route can have several starts and
  loops; v4's own browser storage keys; whether the Xerte copy's readiness is
  a condition for the switch. Round 2: where each feature lives; which
  candidate features join before v4.0; what "the full area feature" means;
  and whether a repeating crowd repeats exactly.

## 2. What the owner asked for, and where this plan meets it

| # | His word (source) | Where met |
| --- | --- | --- |
| R1 | A new app on the full PM-Skills stack; v3's engine ported with its tests; "the architecture plan decides piece by piece where a port isn't worth it" (Q1) | §14, §15 |
| R2 | "each feature a module that owns its settings, drawing, controls, save fields and tests; layers and module edges enforced in the gate, not just written down; and §16's test applied to every new abstraction. Show me measures I can check" (Q1) | §8, §10, §17 |
| R3 | "Freeze v3 now (Recommended)": open v3 defects "become checks v4 must pass" (Q2) | §16 |
| R4 | "half build v4 is ok, use pages as is" (Q3); "once it's releasable" (Q7); "The core works end to end (Recommended)" (Q13); "Every merge publishes" (Q15); "Record-only merges publish nothing" (Q24) | §19 (CORE-08, PUB-01) |
| R5 | v4.0 is one scene for each of his five presets, made and exported in v4 (Q4 with Q24) | §19 (EX-01, V40-01) |
| R6 | "This repo, v4 at the root (Recommended)" (Q5); v3 recoverable at tag v3.3.726 (PLAN-5's criterion) | §14 |
| R7 | v3's autosaves: "Leave them alone" (Q8) | §11 |
| R8 | "Core with storytelling basics" (Q9); "The lead is in the core" (Q24) | §3, §7 |
| R9 | Scene or route: "do what makes intuitive sense from a user point of view for a given case" (Q10) | §7 |
| R10 | "One route, travellers as features (Recommended)" (Q11) | §3 |
| R11 | "Through the core only (Recommended)": contact points each used by at least two real v4.0 features; a pure function of time (Q12) | §8 |
| R12 | "v3 files stay with v3" (Q14) | §11 |
| R13 | "An Add feature list (Recommended)": sections in a fixed order, adding announced, focus moved (Q17) | §9 |
| R14 | Removing: "hide it during the session for undo, but dont save it" (Q18); "Removing asks first" (P6) | §9 |
| R15 | Presets: "Map route; document reveal; signal flow; annotated diagram; match-day crowd" (Q19), meanings ticked in Q24; "A preset starts one route" (P6) | §12 |
| R16 | Own presets: "Yes, as a file, after v4.0 (Recommended)" (Q20) | §20 (wish PLAN-5.1) |
| R17 | "Adopt the editor stack whole (Recommended)" (Q21); "Standard now, extended before v4.0 (Recommended)" (Q22) | §19 (STACK-02, STACK-03, A11Y-03) |
| R18 | "Gate by what changed (Recommended)" (Q23) | GATE-01; §14, §19 (STACK-01, STACK-02) |
| R19 | "claude builds with codex astra as partner" | §19 (every item's checks) |
| R20 | DEF-101: "No v3 fix, v4 check kept (Recommended)" (P10); every held line given a v4 item or brought back (the stock take) | §16 |
| R21 | Overnight: "accrue decisions that come up but dont stop dev unless impossible" and "please plan for as many phases of work as possible" | §18, §20 |

# Part A — the design

## 3. The merged model

### The question

MERGE-01 asks what kind of layer or layers v4 has and what each v3 route and
crowd becomes. The owner settled the shape (Q11, "One route, travellers as
features"): a route is geometry, and what moves along it is a feature. What is
left to decide is how general a route's geometry is.

### Options weighed

- **G1 — A route is a chain with forks, as v3's hero route is.** One start;
  branches split from it and may rejoin. A scene with many approaches (the
  match-day crowd) uses several routes. *For:* the simplest geometry; v3's
  branch code ports as is. *Against:* a crowd cannot enter from several
  places on one route, cannot lap a ring road, and cannot use a two-way
  street. v3's own examples show it: Match day's networks have 10 entries and
  8 merges, Pre-match pubs 3 entries and 4 exits, and Nervous system runs on
  two-way lines (counted read-only from `buildExampleProjects()` in
  `src/examples/index.js`), while v3's route forbids cycles
  (`src/utils/routeBranches.js` :216). Under G1 none of them is one crowd on
  one route, and dots from different routes never share a junction's choice.
- **G2 — A route is a directed graph (recommended, A1).** Points joined by
  lines; a line runs one way (the default) or both ways; a point may have
  several lines in and out, so a route may fork, join, start in several places
  and loop. A plain new route is still a chain with one start and one end; the
  rest appears only when the author draws it. *For:* one geometry serves both
  real travellers of v4.0, the lead and the crowd (§16.1's "two real
  consumers"); every v3 network and every v3 route has a place. *Against:* the
  lead needs stated rules on a graph (below), and the geometry editor must
  handle two-way lines and loops.
- **G3 — Two geometry kinds** (a chain for the lead, a network for crowds),
  sharing the pen. *Against:* it is "Two kinds, shared tools", the option the
  owner turned down in Q11.

### The recommended model (A1)

**Scene** — one per project:
- the background (one image, or none; Show image; darken or lighten; zoom);
- the clock (§4): its length rule, Hold at start, Hold at end;
- play and scrub; save and open; export (video and HTML player, §19);
- scene features the author adds: at v4.0, the camera (§5);
- its routes, in a list whose order is the drawing order.

**Route** — any number per scene; a new project starts with one:
- **Points.** Each has a position in normalised image coordinates (the rules
  file's first invariant carries into v4) and is a stop or a bend.
- **Lines.** Each joins two points and is drawn as a Catmull-Rom curve through
  the bends between stops (§6). A line runs one way or both ways.
- **Starts and ends.** For a crowd, a start is a point no line enters and an
  end a point no line leaves; both are worked out, not stored, so a chain has
  one of each. Where a loop or a two-way line leaves it unclear, the author
  marks a point as a start or an end, and only that mark is saved.
- **The lead's start.** One stored point, `leadStart`: the first point drawn,
  until the author picks another.
- **The core, always present (Q9, Q24).** The line (style and appearance over
  time), the lead, and per-stop markers, labels and pauses.
- **Added features** (§7): at v4.0 a crowd and its extras, arrival effects,
  highlighted areas, a background reveal and a line glow.

**The lead on a graph: one deterministic walk.** The lead's walk is worked
out once from the project, never from what happened on screen:

1. From `leadStart`, a depth-first search follows lines in their saved order:
   a one-way line in its direction, a two-way line in the direction the search
   first meets it.
2. A line that leads back to a point on the search's current path closes a
   loop and is left out. Every other line reached is in the walk, so the walk
   is a tree with joins and never has a cycle.
3. Timing runs over that walk. At a fork the lead goes every way at once, as
   v3's split routes do. A join waits for the latest arrival among the walk's
   lines into it, then goes on once, and its effects fire once (the brief's
   decided foundation, kept).
4. Lines the walk leaves out (loop-closers, and lines not reachable from
   `leadStart`) are walked only by a crowd. Their appearance cannot follow the
   lead, so they are drawn by the line's style alone, and the editor says
   which lines the lead does not walk.
5. Where the lead has several heads at once, its **main head** is the one on
   the branch first in saved order; a camera following the lead follows it.

Three worked examples, each a test in CORE-02:
- *A fork that rejoins:* A→B, B→C, B→D, C→E, D→E, E→F. The lead reaches B,
  goes to C and D at once, waits at E for the later arrival, then walks E→F
  once.
- *A loop:* A→B, B→C, C→D, D→B. The search reaches D with B on its path, so
  D→B closes the loop and is left out; the lead's branch ends at D. A crowd
  may still go round the ring.
- *Two starts:* S1→J, S2→J, J→E, with `leadStart` = S1. The lead walks
  S1→J→E; S2→J is not reachable from S1, so only a crowd uses it, and J is
  not a join for the lead.

The lead can be hidden; a hidden lead still times its route, so labels,
markers, arrival effects and a background reveal keep their sequence. That is
how the document reveal and annotated diagram presets work (§12).

**The crowd on a graph.** Dots are released at the starts, shared by start
weights; at a fork each dot picks one way by line weights (only among lines it
may take, so a two-way street's way back is not counted as a choice: held
check DEF-77.3); at an end it finishes, repeats, respawns or collects, as in
v3. Everything stays seeded: `hash(seed, dotIndex, hopIndex)`.

### What each v3 thing becomes

| v3 | v4 |
| --- | --- |
| The hero route (waypoints, major and minor) | A route: majors are stops, minors are bends |
| Split routes (branches, reconvergence) | Forks and joins in a route's lines; the lead's rules above |
| A crowd that follows the route ("Follow route") | A crowd feature on that route; the bridge goes |
| A crowd on a custom network (nodes, paths, Entry and Exit, Pass-through, weights, One-way and Two-way, node areas) | A route whose points and lines are the network, with a crowd feature: Entry and Exit become starts and ends, weights become the crowd's shares, node areas become crowd areas |
| Anchored nodes; Trace route into network | Gone: route and network are one geometry, so there is nothing to anchor or trace |
| An emitter (cards edit the first only) | The crowd's release settings; one crowd per route at v4.0 (INTAKE.2 weighs more) |
| Camera zoom per waypoint, following the head | The scene's camera feature, following a chosen route's lead or crowd, with zoom stops on that route's stops (§5) |
| Reveal: waypoints and path | The core's marker and line appearance |
| Reveal: background (spotlight, angle of view and their reveal forms) | The route feature Reveal background |
| On arrival (ripple, glow, pop, grow, pulse) | The route feature Arrival effects |
| Area highlight (circle, rectangle, drawn) | The route feature Highlighted areas |
| Path emphasis (casing, glow) | The route feature Line glow |
| Pacing: Duration, constant-time | The lead's Total time option (§4) |
| Pacing: Hold at end; Scale | The scene's clock; the scene's graphics scale |
| Video settings, Include in export | The core's export |

## 4. What sets the scene's length

### Today

v3's base timeline comes from the route (its legs, speeds, pauses, intro and
longest branch) or, with no route clock, from the author's Duration; crowd
releases, anchors, label fades and camera moves are fractions of it. The
playback duration adds what finishes later (crowds, beacons) and Hold at end
(`src/utils/sceneEnd.js`). Because so much is a fraction of a duration, one
change retimes unrelated things: held checks DEF-78 (the comet tail retimes
crowds), DEF-80 (the player retimes a constant-time project), TST-04.1 (the
saved duration follows the editor's mode), REL-703.2 and REL-698.1 (the
timeline on open differs from after a rebuild).

### Two questions, kept apart

Two things are easily run together: how the length is chosen, and whether a
change of length stretches the content or only trims it.

**Times are always saved as exact times (recommended, A2a).** Every time is
saved in milliseconds of scene time, never as a share of a duration, so
changing one route, or the length, never retimes anything else. The other
course, v3's, where releases, fades and camera moves are fractions of a
duration, is what produced the faults above.

**How the length is chosen (A2b):**

- **T1 — From the content, unless the author fixes it (recommended).** Each
  part says when it ends (below); the scene runs to the latest end, plus Hold
  at end. The author may fix a length instead: anything past it is cut,
  nothing is stretched. *Against:* a route longer than a fixed length is cut
  until the author lengthens it.
- **T2 — Always a length the author sets,** with exact times as above. A new
  scene starts at 10 seconds. *For:* the author always knows the length.
  *Against:* one more thing to set, and new content past the end is cut until
  the length is raised.
- **T3 — The first route sets it,** as v3's hero route does. *Against:* it
  brings back the "main route" the merge removes.

Stretching is a separate matter. With exact times, a whole scene could still
be stretched by scaling the clock, without fractions; it is not needed by any
preset, so it is a candidate for after v4.0 (§12), and changing a fixed
length only trims.

### Detail of T1

**When each part ends:**
- a lead: when it has reached its last end and its last pause there is over;
- a crowd whose dots finish (Disappear, Collect at the end): when its last dot
  finishes;
- a crowd whose dots go on (Repeat journey, Respawn at the start, or a
  network with no end they can reach): such a crowd never stops changing, so
  it does not end the scene by itself. It asks for its release end plus the
  time its slowest dot would take to cover every line it can reach once, at
  its own speed. That is a finite allowance on any route, loops included,
  enough to show the crowd moving over all its lines; it does not promise
  that every dot completes a whole journey, since a dot may go round a loop
  more than once before it leaves. A scene holding only such crowds is that
  long unless the author fixes a length;
- an arrival effect: when it settles; a label: when it has faded.

The scene's length is the latest of these plus Hold at end, or the fixed
length. Editor, video and player all call one function, `sceneLength(project)`.

**Times:**
- The lead: a speed in image widths a second (as v3's crowd speed is, "at 1,
  a dot covers the image's width"), with every distance measured in image
  widths in both directions, so a tall image's height counts by its true
  proportion; never a measure in canvas pixels, which made v3's timing depend
  on the window (DEF-79);
  or a Total time for the walk, with per-leg speed factors; a pause at each
  stop; a start time (v3's reveal intro becomes "Starts at"). A route's Total
  time is how an author speeds a route up or slows it down; nothing stretches
  the whole scene at v4.0 (a whole-scene speed control is a candidate, §12).
- The crowd: its release window is a start and an end, or a start set "when
  the lead reaches stop N" (v3's anchored window), worked out through the
  core's position-at-a-time contact point.
- Labels fade, and the camera moves, over a time around an arrival.
- Hold at start (candidate CROWD-05.1) becomes a clock setting, so Preview
  shows what video export shows.
- A project opens with its timing already built, in the same call that builds
  it after any edit, so the timeline on open equals the one after a rebuild.

## 5. How a crowd's path carries the camera

### Options weighed

- **C1 — The camera is the scene's; it follows a chosen target (recommended,
  A3).** Target: the whole picture (no camera feature), a route's lead, or a
  route's crowd. Following a lead, it follows the lead's main head (§3), and
  zoom stops sit on that route's stops, with v3's choices kept (Previous,
  This or Next zoom; Gradual over the leg or Quick at its start). Following a
  crowd, it holds one zoom at v4.0: a crowd has no stops to hang zoom changes
  on, and zoom changes over time come after v4.0.
  *For:* there is one view per scene, so one camera; it answers "crowd paths
  should be able to act as the camera". *Against:* v3's per-waypoint camera
  settings move to the camera's panel and to the followed route's stops.
- **C2 — Each route carries its own camera, and one is marked active.**
  *Against:* several cameras, one of which matters, is the confusion the merge
  removes.
- **C3 — Camera keyframes on the scene's timeline only.** *Against:* loses
  "zoom in when we reach the castle", the commonest map-route move.

### Detail of C1

- **The crowd's centre** at time t is the mean position of the dots on the
  route at t (released and not yet finished), taken from a fixed seeded sample
  of at most 256 dots so the cost is bounded. With no dot on the route it holds
  the route's first start.
- **Smoothing without a clock.** v3 eases the camera by wall time and by its
  own last frame, so the same instant shows a different view by seek history
  and by encoder speed (DEF-07; held checks TST-09.1, UI-06.11, UI-06.13). In
  v4 the camera at t is the average of the target's position over the window
  from t−W to t, sampled at fixed steps of scene time (W 600 ms by default).
  It depends only on t, the project and the seed, so play, scrub and export
  agree by construction and a still view queues no frame (DEF-44.1).
- A zoom the camera cannot reach in time is said on screen (DEF-69); a camera
  edit is one undo step (DEF-19) and settles on screen while paused (DEF-68).

## 6. How lines are drawn and styled

One line model for every route, whatever moves along it:

- **Shape.** A Catmull-Rom curve through the stops and bends of each run, as
  v3's `PathCalculator` draws it, ported with a sample budget for a whole
  route (INTAKE.12) and a curvature cache keyed by every input, so the shape
  never depends on edit history (DEF-10, CROWD-08.4).
- **Style** on the route, with per-leg overrides: colour (Okabe-Ito), width
  (scaled from the project's reference size), dash (solid, dashed, dotted),
  shape (line, squiggle, randomised, seeded).
- **Appearance over time** (core): always; revealed as the lead passes;
  hidden as it passes; a comet trail; or hidden, when the editor draws a faint
  guide that no export draws. A crowd-only route is hidden by its preset;
  vehicles as decoration keep the line, so a crowd's line can now be drawn in
  exports, which v3 could not do.
- Casing and glow are the Line glow feature (§7).

## 7. Every feature and its home

By the owner's rule (Q10), each feature lives where an author would look for
it. Recommended homes (A4):

| Feature | Home | Why, from an author's view | When | In the outline |
| --- | --- | --- | --- | --- |
| Background (image, show, darken or lighten, zoom) | Scene, core | There is one picture | Core | Scene → Background |
| Clock (length, Hold at start, Hold at end) | Scene, core | "How long is my animation" is asked of the whole | Core | Scene → Timing |
| Play and scrub, save and open | Scene, core | They act on the whole project | Core | (transport, menus) |
| Export (video aspect, what to include; HTML player) | Scene, core | One output per scene | Core | Scene → Export |
| Graphics scale | Scene, core | It sizes everything drawn | Core | Scene → Timing and size |
| Points and lines | Route, core | The route is its line | Core | Route → its stops |
| Line style and appearance | Route, core | "My route is red and dashed" | Core | Route → Line |
| The lead (show, head, rotation, speed or total time, starts at) | Route, core | What travels along my route | Core | Route → Lead |
| Markers, labels, pauses | Route, per stop, core | "Label this stop", "wait here" | Core | Route → stop |
| Crowd (dots, release, pace, journey end, shares) | Route, added | The dots move along this route's lines | v4.0 | Route → Crowd |
| Crowd extras: start and finish areas, waiting crowds, groups, final whistle | Route, inside the crowd's own section, added from its own short list | They change how this crowd starts and ends, so they belong to it | v4.0 | Route → Crowd → its extras |
| Arrival effects (ripple, glow, pop, grow, pulse) | Route, per stop, added | "Pulse when we arrive here" | v4.0 | Route → stop |
| Highlighted areas (circle, rectangle, drawn shape) | Route, per stop, added | "Highlight the square when we reach it" | v4.0 | Route → stop |
| Reveal background (spotlight, angle of view, and their reveal forms) | Route, added | It uncovers the picture where this route's lead goes; two routes uncover the union | v4.0 | Route → Reveal |
| Line glow (casing, glow) | Route, added | It is this line's emphasis | v4.0 | Route → Line |
| Camera (follow a lead or a crowd, zoom stops) | Scene, added; its zoom stops show on the followed route's stops | One view per scene; the zoom belongs to the moment the lead reaches a place | v4.0 | Scene → Camera |

Candidate features from MERGE-01's Notes and the held list (destinations,
pulse, back and forth, timed gates, start full, change on the way, lanes,
motion inside areas, waves, formations, trails and shaped dots, vehicles,
several crowds on one route, marquee selection, per-leg tension, transit
presets) are weighed in §12's last part and in round 2 of the question round.

## 8. Modules, the core's contact points, and the edges the gate enforces

### What a module is (A5)

A feature is one folder, `src/features/<id>/`, with three parts and its tests:

- `model/` — pure TypeScript, no DOM, no clock: its settings as a schema
  (defaults, bounds, units, a one-line description each: these are its save
  fields), any per-stop, per-line or per-start settings, its evaluation at a
  time, and when it ends;
- `draw/` — what it draws, in which layer, from what `model/` evaluated;
- `editor/` — its panel sections (`Panel.tsx`, and `StopPanel.tsx` or
  `LinePanel.tsx` where it has per-stop or per-line settings), built from the
  shared control kit, and its entries in the accessible outline.

Its contract, in three lines: given its own settings, a read-only view of its
route and a time, a feature evaluates itself, draws into named layers, shows
its controls and says when it ends; it reads the core through the contact
points and nothing else; it never imports another feature.

**The typed contract.** There are two, sharing one base. The base: identity
(`id`, title, one-line description, the Add list's group), the settings
schema, the panel and the outline entries, which change for the same reasons
in every module (the Add list, saving, undo, the outline). Then:

- a **route feature** is evaluated per route, from its route's read-only view,
  and draws into layers. At v4.0: the five core route parts and five added
  features (crowd, arrival effects, highlighted areas, reveal background, line
  glow).
- a **scene feature** is evaluated once per scene, from the travellers it
  points at, and may give **the view** (where the picture is looked at from,
  and how close). At v4.0: the scene's own core parts built in the same shape
  (background, clock, export settings) and the camera.

Splitting by kind, rather than one contract with a "home" switch, keeps any
mode string out of the composer's call sites (§16.1, question 10). A route
feature's definition holds:

- identity and the base, as above;
- schemas: `settings`, and optionally `stopSettings`, `lineSettings`,
  `startSettings`;
- `evaluate(input)`: pure, returns an immutable result for one time;
- `end(input)`: when it stops changing, or "continues" with the least time it
  asks for (§4);
- optionally `traveller`: a `positionAt` that the core can offer to others
  through P2 (the lead and the crowd provide one; the camera uses them);
- `layers`: a draw function for each layer it draws in.

A scene feature's definition holds the base, its `evaluate` and `end`,
`refersTo(settings)` (the routes and travellers its settings point at, so the
app can name dependants before a removal), and optionally `view` (the camera)
or `layers` (the background).

**What a module is given, and nothing more (§16.2's warning about a context
passed everywhere).** `evaluate` receives one immutable input: its own
settings and per-stop, per-line or per-start settings; a read-only view of
its own route (the shape, P1, and the lead's timing, P2); the time; a seed
derived for it (`hash(projectSeed, routeId, featureId)`); and the render
scale. A scene feature receives instead the positions of the travellers it
declared through `refersTo`, and nothing of any route's settings. No module
receives the project, the store, the app or another feature's settings. In
the editor, a module's controls receive its own settings and a setter scoped
to them; every change is a command (P7).

**Who composes.** `src/player/compose.ts`, shared by the editor's preview,
the video export and the exported player, is the one owner of composition.
For a time t it runs four stages, each pure up to the last:

1. **Routes.** For each route, the read-only view (P1, P2) is built once per
   project version (a memo keyed on every input), and the route's features
   are evaluated in catalogue order.
2. **Scene.** Scene features are evaluated, each given the positions of the
   travellers it declared. The camera's result is the view: a centre in image
   coordinates and a zoom. With no camera, the view is the whole picture.
3. **The view.** The composer combines the camera's view with the export's
   framing (video aspect) or, in the editor only, the author's own zoom and
   pan, into one transform.
4. **Drawing.** Layer by layer (P4), under that one transform: within a
   layer, routes in their list order, and within a route, features in
   catalogue order. The background mask layer is drawn to its own surface: a
   reveal draws the shapes it uncovers there, so two routes' reveals uncover
   the union of their shapes, and the composer then draws the background
   through that mask (or whole, if no feature drew into it). Editor overlays
   are drawn last, in screen space, and only by the editor.

The core's own parts are built as modules of the same shapes and listed
first: on a route the line, lead, markers, labels and pauses; on the scene the
background, the clock and the export settings. So both contracts are proved
by them before the first added feature exists. The geometry and the lead's
timing the route parts draw on stay in `src/core`, offered to every module
through P1 and P2. The
catalogue is two typed, ordered lists, `src/features/catalogue.ts`
(definitions and drawing, safe for the player) and
`src/features/catalogue.editor.ts` (panels): their order is the panel's fixed
order (Q17). Adding a feature therefore touches its own folder and one line in
each catalogue, and nothing else. This is the measure the owner asked for
(§10, M1).

**Walking through two additions.** *Adding the crowd:* a new folder
`src/features/crowd/` whose `model/` holds the ported engine (§15), its
settings, its per-start shares and per-line weights, its `end` and its
`traveller` (the dots' centre); `draw/` draws the dots layer; `editor/` its
section, its per-line and per-start controls, and its outline entries; then one
line in each catalogue. The core is not edited: per-line and per-start
settings, the traveller capability and the dots layer are already contact
points. *Adding the camera:* `src/features/camera/`, a scene feature; its
settings hold a target (a route and one of that route's travellers) and its
zoom stops; `refersTo` returns that target, so removing the crowd it follows
names it first; `evaluate` asks P2 for the target's position over its
smoothing window (§5) and returns the view (P4), which the composer applies
in stage 3; its zoom stops appear in the stop panel of the route it follows
through P6. Again, one line in each catalogue and no core edit. *Adding the
reveal:* `src/features/reveal-background/`, a route feature that draws its
uncovered shapes into the background mask layer in stage 4; the union across
routes comes from drawing into one surface, with no code of its own. The
three are tested alone, each against a fake route view or fake traveller
positions.

### The contact points (Q12) (A6)

| # | Contact point | What it gives | Real v4.0 users |
| --- | --- | --- | --- |
| P1 | Route shape | Points, lines, starts and ends, `leadStart`, the sampled curves and lengths | line, lead, markers, labels, crowd, highlighted areas, arrival effects, reveal |
| P2 | Position at a time | The lead's heads at t (one per active branch, the main head marked) and heading, when it reaches each stop, its pause windows; any traveller's `positionAt` (the crowd's centre) | line appearance, markers, labels, arrival effects, reveal, camera, crowd (a release set by the lead's arrival) |
| P3 | The clock | Each module's end; the scene's length; Hold at start and end | lead, crowd, arrival effects, labels, camera |
| P4 | Drawing | Fixed layers: background mask (what reveals uncover) → background → background effects (darken) → highlighted areas → lines → crowd dots → markers and arrival effects → lead head → labels → editor overlays (editor only, never exported); and the one view all of them are drawn under, which the camera sets and which the composer combines with the export's framing or the editor's own zoom | every drawing module; the camera sets the view; Reveal background reads it, its spotlight and angle of view following the camera as v3's DEF-27 fix made them |
| P5 | The save file | One schema composed from the scene's core, each route's core and each added module's settings, per stop, per line and per start; unknown fields reported | every module |
| P6 | Panels | The scene panel, the route panel (core sections, then added sections in catalogue order), the stop, line and start panels, and the Add feature list's entries | every module with controls |
| P7 | Commands and undo | One command per gesture, through a setter scoped to the module's own settings, never by timer | every module with controls |

### The layers and edges (A7)

The PM-Skills editor pack lays out `src/` as `core`, `adapters`, `player`,
`exported`, `editor` and `ui`. Its dependency-cruiser rules say: `core`
reaches only `core`; `adapters` reach `core` and `adapters`; `player` reaches
`core`, `adapters` and `player`; `exported` reaches `core`, `adapters` and
`exported`; and no package is imported in those four areas until the project
lists it by decision. v4 keeps the first two rules and the package list,
**replaces** the player and exported rules, and adds rules for
`src/features/`, which the pack does not have (each a `forbidden` entry):

1. `features/<x>/model/**` reaches only `src/core` and its own `model/`.
2. `features/<x>/draw/**` reaches `src/core`, `src/adapters/render` and its
   own `model/`.
3. `features/<x>/editor/**` reaches `src/editor/kit`, `src/ui` and its own
   `model/`.
4. No file in `features/<x>` reaches `features/<y>`; only the two catalogues
   import several features.
5. `src/core` and `src/adapters` never reach `src/features`.
6. Replacing the pack's player rule, and keeping the abstraction plan's
   narrower player closure (§11.1, rule 3): `src/player` reaches `src/core`,
   `src/adapters/render`, `src/player`, `src/features/catalogue.ts` and the
   `model/` and `draw/` parts it lists. It never reaches the rest of
   `src/adapters` (the ZIP and asset boundary, storage, the video encoder, the
   HTML export builder), an `editor/` part, `jszip`, `mediabunny`, `react`,
   `react-dom` or `@carbon/*`, directly or through another file; a closure
   test on the built player bundle checks the same.
7. Replacing the pack's exported rule: `src/exported` reaches what rule 6
   allows the player, and `src/exported`.

`src/core` holds the project model and the schema helper, geometry, the
lead's timing and the clock; `src/adapters` the canvas renderer's kit, the ZIP
and asset trust boundary, browser storage, the video encoder and the HTML
export builder; `src/player` the playback runtime and the composer that the
editor's preview and the exported player share; `src/exported` the exported
player's entry; `src/editor` the React and Carbon app, its store and
commands, and the control kit; `src/ui` the theme and shared Carbon-based
controls. The crowd's engine and the camera's maths live in their features'
`model/` folders.

### Checked against §16 (A5 to A7)

§16.1 asks each new abstraction to compare its consumers' inputs, outputs,
units and failures, to show they change for the same reason, and to count
real consumers. The four shared abstractions, each against its most unlike
consumers:

**1. The feature base and its two contracts.** Unlike consumers: the crowd (a
route feature: heavy evaluation, per-line settings, draws dots) and the
camera (a scene feature: no route, no layer, gives the view).
- *Inputs:* a route feature gets its route's view and its own settings; a
  scene feature gets the travellers it declared and its own settings. Units:
  image coordinates and milliseconds for both. *Outputs:* layer drawings, or
  a view. *Failure:* a setting out of range never reaches either, being
  refused at open (§13). An evaluation that cannot proceed returns a
  structured report (`{ ok: false, reason }`, the abstraction plan's §11.9
  convention for domain problems), never a throw into the composer; the
  composer then draws nothing for that module in that frame and passes the
  report on, which the editor shows and an export lists when it ends.
- *Same reason to change:* the shared base (schema, panel, outline, add and
  remove) changes when the Add list, saving or undo change, alike for both.
  The parts that differ (inputs, outputs) are split into the two contracts
  instead of one with a switch.
- *Evidence that per-feature folders lower the cost of change:* in v3 one
  option's change touched four modules (the abstraction plan's §18: "change a
  slider's scale touches MVS, UIController, editorPanel and persistence").
- *Consumers:* ten route features and four scene features at v4.0.

**2. The route graph.** Unlike consumers: the lead and the crowd.
- *Same:* both read the same points and lines, in the same units, through P1.
- *Different, and kept apart:* how each walks it. The lead's walk (§3) is a
  tree with joins worked out by one search; the crowd chooses by weights at
  every fork and may lap a loop. Each walk is owned by its traveller, not by
  the graph, so the graph has no traveller mode.
- *Failure:* a route the lead cannot walk (a single point) has an empty walk
  and an end at its start time.

**3. The contact points.** Each names its v4.0 users in the table above, at
least two real features each. The view is part of P4, drawing, not a contact
point of its own: the camera sets it, every drawing module is drawn under
it, and Reveal background reads it.

**4. The schema helper.** Unlike consumers: the crowd's numeric settings
(ranges and units) and the arrival effects' colours (the colour grammar).
Both need a type, a default, a check at open and a range or grammar for the
control, from one declaration. *Failure:* a structured report naming the
field, never a throw with a bare message.

§16.1's ten other questions (clear contract, less context, less coupling,
testable alone, smaller interface, domain names) are answered in the
contracts above. §16.2's warning signs: a generic registry serving two rules
(the catalogue serves fourteen modules in a fixed order the owner asked for);
a context passed everywhere (refused: each module gets a narrow, read-only
input); an abstraction for a hypothetical consumer (none: each contact point
names its v4.0 users). **The one place to watch** is the optional members
(`traveller`, `view`, `refersTo`, the per-stop and per-line schemas): each is
read by one core function, but if special cases gather at the composer's call
sites, the contract is narrowed (§16.3); STACK-04's measures count them. This
is recorded as a watched risk, not a departure.

## 9. On demand: a new route, adding and removing

**What a new route shows (A8).** The route panel holds the Points list and
three sections: Line (colour, width, dash, appearance), Lead (show, head,
speed or total time, starts at) and, for the selected stop, Marker, Label and
Pause. That is about fourteen controls, against v3's sidebars, which show
every card's controls (measure M5 in §10 counts both). At its end is one Add
feature button; the scene panel has its own.

**Adding (Q17).** The button opens a searchable list grouped by purpose:
Travellers (Crowd), At stops (Arrival effects, Highlighted areas), Background
(Reveal background), Line (Line glow); on the scene, View (Camera). Each entry
has a one-line description. A crowd's extras (start and finish areas,
waiting, groups, final whistle) are part of the crowd module, added from a
short list inside the crowd's own section, because they change the crowd's
own engine and §8 forbids one feature reaching into another. Adding puts the section in the
catalogue's fixed place, whatever the order of adding; it is announced
("Crowd added to Route 1") and focus moves to the new section's heading. It
is one undo step.

**Removing (Q18, P6).** Each added section has Remove. If another feature
depends on it (a camera following this route's crowd, found through the
camera's `refersTo`), the app names the dependant and asks first, offering
to remove both or to keep both. Removing hides the feature for the session:
its settings stay in memory, so Undo, or adding it back in the same session,
restores them; a saved project holds nothing for it, as the owner asked
("hide it during the session for undo, but dont save it"). The core cannot be
removed; the lead and the line can be hidden.

**In a saved project.** The core is always written; each added feature is
written under its route's (or the scene's) `features`, keyed by its ID; a
removed feature is absent.

## 10. Measures the owner can check

`npm run measures` prints this table, and CI shows it in the summary of every
v4 run, so the owner can read it from GitHub without running anything (A9).
v3's figures are its baselines from the abstraction plan's §18 or counted
once by STACK-04.

| # | Measure | How it is checked | v3 | v4 aim |
| --- | --- | --- | --- | --- |
| M1 | Adding a feature touches only its own folder and one line in each catalogue | A script lists, for each `features/<id>`, every file outside it that names it; dependency-cruiser's rule 4 | n/a (a v3 option touches four modules, §18 of the abstraction plan) | 0 files beyond the two catalogue lines |
| M2 | Feature-to-feature imports | dependency-cruiser | n/a | 0 |
| M3 | Import cycles and upward edges | dependency-cruiser | 0 cycles; 3 upward edges | 0 and 0 |
| M4 | Modules sharing one `this` | count of mixins | 16 mixins, 115 undeclared edges | 0 |
| M5 | Controls shown on a new route before any feature is added | an accessibility-tree count in the Playwright suite | counted once on v3 | at most 15 |
| M6 | Interface words: one per concept | a test of the interface's strings against the glossary (point, stop, bend, line, route, lead, crowd, start, end) and v3's retired words (node, edge, path, guide, emitter, flow layer, waypoint) | two vocabularies | 0 retired words |
| M7 | Dead code | knip | about 46 dead functions, 3 barrels | 0 |
| M8 | Functions over 60 lines; files over 400 lines | ESLint counts | 117 functions over 60 lines | down, each exception named |
| M9 | Gate time for a v4 change | CI timing | about 34 minutes | under 10 minutes |
| M10 | The exported player: size, and no React or Carbon inside | the build's report and a closure test | 415 KB | no React or Carbon; size reported |
| M11 | Steps to make each preset's scene from blank | the EX-01 scripted runs | n/a | reported per preset |

## 11. What happens to v3's projects, exports, player and autosaves

- **Projects.** v4 opens none (Q14). A v3 file is recognised by its
  `coordVersion` and refused with a message that names v3, never half
  opened.
- **Exports.** v3's MP4, WebM and HTML files are self-contained and keep
  working; v3's HTML exports carry v3's own player inside them.
- **The HTML player.** v4 has its own, free of React and Carbon (Q21).
- **Autosaves.** v4 never reads, writes or deletes v3's `routePlotter_*` keys
  or v3's image store (Q8). Whether v4 keeps keys of its own is round 1's
  third question. One fact bears on it: every GitHub Pages site of the
  account is served from one origin, `djdaojones.github.io`, so v2 at
  `/router-plotter-02/`, v3 and v4 share one browser storage space; names
  must not collide.
- **Examples.** v3's five built-in scenes stay in v3. v4 makes one scene per
  preset (EX-01).

## 12. Presets, and the candidate features

**A preset** is a starting point for one route: a named set of added
features with settings, applied when a route is made (P6, confirmed). New
route offers Blank (the core alone) and the owner's five (A10):

| Preset | What it shows (Q24's meanings) | Starts the route with |
| --- | --- | --- |
| Map route | A journey across a map | The core: line revealed as the lead passes, the lead shown as an arrow, markers and labels that fade up, pauses at stops; Arrival effects |
| Document reveal | "an image of a document uncovered step by step as a route passes over it" | The lead and the line hidden; Reveal background (spotlight reveal, revealed area kept) |
| Signal flow | Pulses flowing through a network | The line shown; the lead hidden; a Crowd of small dots repeating their journey, spread evenly |
| Annotated diagram | "a still diagram whose labels, markers and highlighted areas appear in sequence, with little or no travel" | The line and the lead hidden; markers and labels appearing on arrival; Highlighted areas; pauses carrying the sequence |
| Match-day crowd | Fans converging on a stadium from many places | The line hidden; the lead hidden; a Crowd collecting at the ends; crowd areas at starts and ends |

Presets are data written against the same schemas as a saved project, so
they are checked as a project is; saving one's own as a file comes after
v4.0 (Q20, wish PLAN-5.1).

**Candidate features, weighed one by one (A11).** MERGE-01 asks which
candidates join and in what order. Recommended: before v4.0, only what v4's
own model or the five presets need; after v4.0, in this order, which the owner
may change (V40-01 brings it to him):

| Candidate (source) | Recommendation | Why |
| --- | --- | --- |
| Insert a point into a line (DEF-77.4; INTAKE.3's edge split) | Before v4.0, core (CORE-06) | With one geometry, splitting a line is basic editing |
| Rename a point by its label; move it by arrow keys; a point's context menu (INTAKE.3) | Before v4.0, core (CORE-06) | Keyboard authoring at AAA needs the nudge; the label is the name |
| Hold at start (CROWD-05.1) | Before v4.0, core clock (CORE-02) | Preview then shows what video export shows |
| Ready-made starting points from crowds (EX-02.1) | Before v4.0, as the match-day crowd preset (PRESET-01) | It is one of his five presets |
| Crowd areas placed off their point (CROWD-08.3) | Before v4.0, by his answer to Q7 (FEAT-07) | His "the full feature in v4" |
| Drawn polygon areas for a crowd's starts and finishes (MERGE-01's Notes) | Before v4.0 only if he picks it in Q7; else after v4.0, beside 17 and 18 | More geometry, editing and checks |
| 1. Own presets as a file (PLAN-5.1) | After v4.0, first | His Q20 pick |
| 2. The riot march scene (EX-03.1) | After v4.0 | His "the riot march returns later" (Q24); needs no new feature |
| 3. Shaped dots: a crowd's dots drawn as an image or shape, turned along their line (MERGE-01's Notes) | After v4.0 | The first step to his "trains / buses / cars on transit routes, as decoration" (2026-10-13); v4 already draws a crowd's line in exports |
| 4. Speed per line (MERGE-01's Notes) | After v4.0 | Vehicles keep to road or rail speeds; one setting per line |
| 5. Start full: a crowd already spread along its lines at the start (MERGE-01's Notes) | After v4.0 | Vehicles are already running when the scene opens |
| 6. Trails behind dots (MERGE-01's Notes) | After v4.0 | Reads as movement in a still frame; a pure function of each dot's past positions |
| 7. Transit presets by mode and era (OWNER.1) | After v4.0, after 3 to 6 | Builds on them; he called the filing "distant wish list, ignore" (PLAN-4) |
| Reorder routes by drag and by keyboard (INTAKE.2's strip drag-reorder) | Before v4.0, core (CORE-12) | A scene's route list sets the drawing order, so reordering it is basic editing |
| 8. Several crowds on one route (INTAKE.2's multi-emitter authoring) | After v4.0 | One crowd per route is enough for the five presets; a second route on the same lines does it meanwhile |
| 9. Destinations: a dot picks where it is going and takes only lines leading there (MERGE-01's Notes) | After v4.0 | Match-day fans then find their own stand |
| 10. Marquee selection on the canvas (INTAKE.6) | After v4.0 | Editing comfort; the list and the outline select first |
| 11. A whole-scene speed control (§4) | After v4.0 | Stretches every time by scaling the clock; no preset needs it |
| 12. Back and forth: dots turn at the ends (MERGE-01's Notes) | After v4.0 | Shuttles and patrols; small |
| 13. Pulse: releases in timed bursts (MERGE-01's Notes) | After v4.0 | Signal flow could use it; v3's busyness curve covers the preset |
| 14. Change on the way: colour or size along the line (MERGE-01's Notes) | After v4.0 | Shows a change of state; small |
| 15. Timed gates and first-come queues, worked out in advance from arrival order (MERGE-01's Notes) | After v4.0 | Turnstiles and crossings; needs care to stay a pure function of time |
| 16. Lanes: dots keep to side-by-side lanes (MERGE-01's Notes) | After v4.0 | Roads and corridors; the sideways sway does part of it |
| 17. Wander and wait inside areas (MERGE-01's Notes) | After v4.0 | Crowds milling in a square; v3's waiting crowds come first |
| 18. Spread out inside areas (MERGE-01's Notes) | After v4.0 | Arrivals filling a space; v3's finish areas come first |
| 19. Vibrate in place (MERGE-01's Notes) | After v4.0 | A crowd at rest that still looks alive; small |
| 20. Bounce off walls inside areas (MERGE-01's Notes) | After v4.0 | Particles in a box; needs walls as data |
| 21. Orbit (MERGE-01's Notes) | After v4.0 | Circling a point; small |
| 22. Radiate out and draw in (MERGE-01's Notes) | After v4.0 | Spreading from or gathering to a point |
| 23. Flow fields (MERGE-01's Notes) | After v4.0, late | Motion with no lines at all; the largest of the area motions |
| 24. A wave through still dots (MERGE-01's Notes) | After v4.0 | Stadium waves; needs a still crowd first (19) |
| 25. Formation and morph (MERGE-01's Notes) | After v4.0, late | Dots forming shapes; a new kind of motion |
| 26. Combine and split (MERGE-01's Notes) | After v4.0, late | Groups merging and parting; builds on v3's groups |
| 27. Per-leg spline tension (INTAKE.1) | After v4.0, last | "if ever wanted" in its own words |
| AI-editable saves (AI-01) | Medium term, where he put it | The schema-first save (§13) makes it cheaper |
| Dots that react to each other, simulated live (MERGE-01's Notes) | Not proposed | State carried from frame to frame breaks the pure-function rule; baking it in advance could be weighed later |

**What v4.0 leaves out, said plainly.** v4.0 is the five preset scenes made and
exported in v4 (Q24), not everything v3 does. At v4.0 an author does not
have: opening a v3 file (Q14); the riot march scene; v3's example projects as
such (the five preset scenes replace them); the MediaRecorder video fallback,
v4 being Chromium-only as the profile says (A21); and v3's custom key
bindings, if anyone uses them (the key table is new, CORE-05).

## 13. The save format, written schema-first

- **Container.** A ZIP holding `project.json` and the images, as v3's is;
  jszip carries over with the port (the brief's Constraints). `project.json`
  starts with `"app": "route-plotter"` and `"format": "v4"` and a version
  number, which is how a v3 file is told apart.
- **Schema-first (AI-01's proposal, A12).** A small helper in `src/core/schema`
  declares each field once: its kind, default, minimum, maximum, unit and a
  one-line description. From that one declaration come the TypeScript type,
  the defaults, the check at open, the range every control uses, and later the
  description AI-01 would hand to a chat AI. So a value that opens is always
  one its control can show (DEF-20.2, INTAKE.29), and an unknown field is
  reported, never silently kept or dropped (INTAKE.13). The helper is our own
  code: no new package (the profile's Dependencies line).
- **Versions (A13).** Before the first publish the format may change freely.
  From the first publish on, every older v4 format version keeps opening,
  through a tested step from each version to the next. *Changed by PLAN-7
  (2026-11-19), provisionally: v4 was published early, before anything could
  be saved, so until v4.0 is declared the format may change between previews;
  a file from any other version, older or newer, is refused whole, and the
  editor says plainly wherever it offers Save that a preview's file may not
  open in a later preview. From v4.0 on, every older version opens through a
  tested step, as written here.* A file from a newer
  version than the build opening it, or holding a feature or field this build
  does not know, is refused before anything in the open project changes, with
  a message saying a newer v4 made it; it is never half read. Within a
  version, an unknown field is listed in that refusal, never silently kept or
  dropped.
- **Safety.** The v3 trust boundary is ported (§15): the ZIP's preflight and
  limits, the colour grammar, the asset admission planner, the staged open
  that leaves nothing behind if it fails (DEF-51), and a chunked text writer
  that never splits a character (DEF-101).
- **AI-01** stays medium term, as the owner put it; the schema-first save
  makes it cheaper whenever it comes.

# Part B — where the code lives, and the port

## 14. Where v4 lives, beside frozen v3

### Options weighed

Everything v3 needs is reached relative to its working folder or its own
file; nothing names the repository's root (read-only survey at `8005061`,
whose v3 code is byte-identical to tag `v3.3.726`). What breaks on a move is
whatever reaches a file that stays at the root.

- **L1 — v3 moves into `v3/`; its build and release scripts stay as they are
  (recommended, A14).** `git mv` v3's app set into `v3/`: `src/`, `tests/`,
  `styles/`, `images/`, `index.html`, `build.js`, `push.js`,
  `vitest.config.js`, v3's own scripts (`scripts/restart.sh`, `build.sh`,
  `perf-harness.js`, `build-examples.mjs` and their README; GATE-01's
  `scripts/gate.mjs` and its test are CI's and stay at the root),
  `public-assets.json`, `package.json` and `package-lock.json`. v3 gets copies of the three root files its build reads
  (`version.json`, `LICENSE`, `THIRD_PARTY_NOTICES.md`); the root files stay
  exactly as they are, because changing `version.json` or `docs/` is outside
  tonight's grants and is the owner's alone. Run from `v3/`, v3's build then
  writes `v3/docs/` (ignored by git), so the committed root `docs/` stays the
  live 3.3.726 site, untouched, until v4's first publish replaces it, and a
  v3 build can never overwrite v4's live site. About four v3 files change,
  none of them its build or release code: `v3/package.json`'s `check` script
  (the record checker runs from the root), `v3/tests/governance.test.js`
  (paths to `.github/` gain `../`, assertions unchanged),
  `v3/tests/helpers/bootApp.js` (it builds the example archives it serves,
  deterministically, instead of reading the root `docs/examples/`), and
  `.gitignore`; plus CI, which runs v3's suite with `v3/` as its working
  folder. Recovery: the tag `v3.3.726`, or `git worktree add <folder>
  v3.3.726`; `git log --follow` keeps each file's history across the move.
- **L2 — v3 moves into `v3/` and its build writes `../docs`.** About nine v3
  files change, two of them release-safety code (`build.js`, `push.js`), and
  once v4 owns Pages any v3 build or reset would overwrite or delete v4's
  live site.
- **L3 — v3 stays at the root; v4 goes in a folder.** Nothing of v3 changes,
  but v4 then cannot own `package.json`, `index.html`, `src/` or `tests/`,
  which is the "v4 in a folder" option the owner turned down in Q5; and the
  pack's `eslint src`, `depcruise src` and knip's globs would sweep v3's
  files. Two v3 tests also forbid a shared `package.json`
  (`tests/governance.test.js` :63 pins v3's six dependencies;
  `tests/buildScript.test.js` :297 pins its `dev` and `build` scripts).

A v3 release, should the owner ever call one (Q2's exception), then builds in
`v3/` for a new Xerte zip; publishing it to Pages would need its own decided
step, since `docs/` belongs to v4 once v4 replaces v3 there.

### The repository after the foundations

```text
AGENTS.md  CLAUDE.md  README.md  LICENSE  THIRD_PARTY_NOTICES.md (v4's, from STACK-02)
project/  verbs/  tools/  reviews/  pm_skills/  _Joe/  specs/     the record and history, unchanged
DEV-INFRASTRUCTURE.md  UI-STANDARDS.md                           v3's; v4's sections added by the items that change them
docs/          Pages: v3.3.726's committed build until v4's first publish
version.json   unchanged until PUB-01 asks the owner what it becomes
v3/            frozen v3: its app set, own package and lockfile, copies of version.json, LICENSE, notices
package.json  package-lock.json  index.html                      v4
tsconfig.base.json  tsconfig.json  tsconfig.core.json  vite.config.mjs  eslint.config.mjs  knip.json  .dependency-cruiser.cjs  playwright config
src/core/  src/adapters/  src/player/  src/exported/  src/editor/  src/ui/  src/features/
tests/         v4's tests that are not beside their modules (the a11y pack's tests/a11y/, fixtures)
.github/workflows/ci.yml   GATE-01's sorting, with v3's paths under v3/**
```

v4's TypeScript, lint, dead-code and test settings exclude `v3/**`, because
Vitest's default include would otherwise pick up v3's tests. The record's own
paths that name v3 files (the rules file's Always lines, item files' sources,
`project/architecture.md`) are re-pointed or redrafted by the item that moves
them (§19, STACK-01 and STACK-04); signed lines are redrafted for the owner's
signature, never changed unsigned.

### The exported player, a second build output (A20)

The pack's starter ships the player inside the editor's bundle and says
nothing of a separate one. v4 needs one, as v3 does: the HTML export inlines a
player that has no React, no Carbon and no network. So Vite builds a second
entry, `src/exported/player.ts`, into one self-contained script, and the
closure rule (§8, rule 6) plus a build check prove neither React nor Carbon is
inside it. v3's `docs/player.js` is 468,493 bytes, of which 244,854 are the
inlined drone image; v4 reports its size (M10) and loads path-head images as
the project's own assets.

## 15. The port of v3's engine (REFACTOR-01)

### The rules for porting tests (A18)

1. Porting works **assertion by assertion, not file by file.** A test file
   moves with its module, translated to TypeScript. Within it, each assertion
   of behaviour v4 keeps is ported unchanged; each assertion that pins an open
   defect is handled by rule 2; each that only exercises v3's wiring or
   harness is handled by rule 5. A file mixing the three is split along those
   lines, and the pull request lists which assertions went where.
2. **An assertion that pins an open defect as it stands is not ported as a
   requirement.** It is inverted to assert the fix, named with the defect's ID,
   or, where the right behaviour awaits the owner's ruling, replaced by the
   held check. The pins found (read-only surveys at `8005061`; each porting
   item searches its own files again for more):
   - DEF-79: `tests/dotsDomain.test.js` :152–201 and :204–221 (the golden
     stores the disagreement);
   - DEF-22: `tests/branchAuthoring.test.js` :469 (the run split by an
     inserted waypoint, pinned with TST-16);
   - DEF-51: `tests/branchLegHit.test.js` :649–651, :681, :714;
     `tests/projectRollback.test.js` :14–15;
   - DEF-05: `tests/cameraDomain.test.js` :361–375;
     `tests/headDirectionBranchWait.test.js` :168;
   - DEF-07: `tests/cameraDomain.test.js` :273, :305, :324, :350;
   - DEF-10 and CROWD-08.4: `tests/curvatureCache.test.js` :91–131, :134,
     :182;
   - DEF-11: `tests/minorEnd.test.js` :123, :194, :214;
   - DEF-12 and DEF-78's mechanism: `tests/crowdArrival.test.js` :268–410
     (:339, :354, :369, :395); `tests/timeDomains.test.js` :34–41, :255–256;
   - TST-09.1: `tests/cameraDomain.test.js` :273; TST-09.2:
     `tests/minorEnd.test.js` :268; TST-09.3 and TST-09.4: the
     `domains-time.json` golden;
   - TST-03.1: `tests/visibilityPathMatrix.test.js` :214; TST-03.2:
     `tests/visibilityWaypointMatrix.test.js` :323; TST-03.3:
     `tests/visibilityRevealMasks.test.js` :389; TST-03.6:
     `tests/visibilityPathMatrix.test.js` :311–336;
   - DEF-44's residual: `tests/pausedIdle.test.js` :716 (DEF-44.2);
   - DEF-77.3, probably: `tests/networkEdit.test.js` :997–1017 (unsure: the
     share is true for dots that start at that point);
   - the TST-09 goldens (`domains-camera`, `-curvature`, `-minor-end`,
     `-time`, `-dots`), and probably the Open day draw-log goldens for
     DEF-05's marker timing.
3. A test that reads source text is not ported (TST-11); v4's architecture
   rules are dependency-cruiser's, not text searches.
4. v3's draw-log and domain goldens are not ported byte for byte: they hold
   v3's faults and v3's canvas-pixel timing. v4 records its own with the
   ported recorder (given the clip region it lacked, INTAKE.30), and the first
   recording of each is compared with v3's frame of the same scene, every
   difference named.
5. Assertions that only exercise v3's app wiring (the boot harness, mixins,
   event transcripts, control goldens) are not ported; the behaviour they
   witness is tested again through v4's commands, components and Playwright.
6. Property tests are ported first, as fast-check properties: open after save
   gives the same project (CORE-03); play, seek and export give the same frame
   (CORE-10); and **what the interface can author, a project can open**
   (TST-06's `tests/authorableLoadable.test.js`, which explains at :12 why
   sampling the model alone cannot stand in for it). That last one is driven
   through v4's real commands, at their controls' limits, with v3's boundary
   cases carried: CORE-06 for drawing (points at the image's edge, the most
   points a route may hold), CORE-12 for the core panels' controls, and each
   feature item for its own controls.
7. No ported test relies on a real animation frame after its file ends
   (INTAKE.18): the engine is tested through its pure clock.
8. Where a held check says "unverified", its first test decides it, and the
   item says which way.

### Piece by piece (A17)

"Port" means translate to strict TypeScript, keep the logic and its tests;
"split" says along which seam; "rewrite small" keeps the rule and writes the
code fresh because it is tangled with v3's shared `this` or interface; "not
ported" says why. Line counts are v3's.

**Timing**

| v3 | Lines | Verdict | Tests that come with it | v4 item |
| --- | --- | --- | --- | --- |
| `src/core/PlayerCore.js` | 669 | Port and split: the lead's timeline from milliseconds (segments, pauses, timeline to path and back, branch composition) into `src/core/timing`; beacon schedules to the arrival-effects model | playerCore, branchTiming, routeBranches; timeDomains and minorEnd with their DEF-11 and DEF-12 pins inverted | CORE-02 |
| `src/utils/branchTiming.js`, `routeBranches.js` | 171, 410 | Port, generalised from a trunk with branches to the route graph (§3); v3's "no cycles" becomes "the lead never takes a line twice" | branchTiming, routeBranches; branchAuthoring's assertions with its DEF-22 pin (:469) inverted, in CORE-06 | CORE-02 |
| `src/utils/sceneEnd.js` | 231 | Port as `sceneLength` (§4) | sceneEnd and holdAtEnd, where they still hold under §4 | CORE-02 |
| `src/services/AnimationEngine.js` | 1,058 | Split: the transport (play, pause, speed, frame loop) into `src/player`; evaluation stays in core | reviewTimeline, performanceScheduling in part | CORE-05 |
| `src/app/pathTiming.js` | 888 | Rewrite small, as a pure `composeTimeline` in core; nothing measured in canvas pixels (DEF-79) | — (its mixin tests stay with v3) | CORE-02 |
| `src/models/AnimationState.js`; `src/core/EventBus.js` | 216; 220 | Not ported: transport state moves to the store; v4 has no string-event bus (A19), only typed commands, though the bus's idea that one failing subscriber never stops the others is kept | — | CORE-05 |

**Geometry**

| v3 | Lines | Verdict | Tests | v4 item |
| --- | --- | --- | --- | --- |
| `src/services/PathCalculator.js` | 635 | Port and split: pure geometry; a sample budget for a whole route (INTAKE.12); the curvature cache keyed on every input or dropped (DEF-10, CROWD-08.4) | curvatureCache inverted; units | CORE-02 |
| `src/utils/CatmullRom.js`, Easing | 69, 49 | Port | curvatureCache | CORE-02 |
| `src/services/CoordinateTransform.js` | 336 | Port | units, playerApp's mapping cases | CORE-02 |
| `src/utils/segmentHitTest.js` | 128 | Port, with DEF-64.1's one-point branch fixture | segmentHitTest, branchLegHit (its DEF-51 pins inverted) | CORE-06 |
| `src/utils/routeAnchors.js`, `routeTrace.js` | 177, 215 | Not ported: one geometry leaves nothing to anchor or trace; their start-and-end rules become tests of the graph's starts and ends | — | CORE-01 |
| Models: Waypoint, Scene, FlowLayer, Emitter, GraphModel, GraphNode, GraphEdge | 516–147 each | Rewrite small as v4's schema types: their checks and limits kept; ids injected, never `Date.now` or `Math.random` | the model tests' limits cases | CORE-01 |

**Camera and visibility**

| v3 | Lines | Verdict | Tests | v4 item |
| --- | --- | --- | --- | --- |
| `src/services/CameraService.js` | 602 | Split: zoom keyframes and framing maths ported; the wall-clock rate limit (:411–438), per-frame smoothing (:134–136, :201–203) and history (:186–189) replaced by the pure camera of §5 | cameraDomain with its DEF-05 and DEF-07 pins inverted; pausedIdle's camera cases | FEAT-06 |
| `src/services/MotionVisibilityService.js` | 1,459 | Split: the rules for line and marker appearance into core and those modules; reveal masks into Reveal background's drawing; dead parts left behind (`_lastAOV*`, `getPathPointOpacity`) | the visibility matrices with TST-03's pins ruled; revealTrail; visibilityRevealMasks | CORE-04, FEAT-03 |
| `src/utils/sliderScales.js` | 172 | Port where v4 keeps those sliders, without the readout quirks pinned at sliderScales.test :10–12, :129 | sliderScales | CORE-05 |

**Crowds**

| v3 | Lines | Verdict | Tests | v4 item |
| --- | --- | --- | --- | --- |
| `src/services/SwarmEngine.js` | 1,541 | Split: the seeded hash (:221); the release schedule (:1000–1032); the walkers for a line, a graph, a loop, a finish and a group (:1133, :1254, :1389); the plan builders (:419, :582, :799) as memos keyed on every input; one source of line geometry (the route's P1) instead of v3's two (:1481, :780); one clock, scene milliseconds | swarmEngine; crowdArrival and dotsDomain with their DEF-12 and DEF-79 pins inverted; crowdRelease; the entry-weight, finish-area, group and waiting engine tests | FEAT-04, FEAT-05 |
| busynessEnvelope, crowdArrival, groupRouting, groupJourney, crowdArea, finishArea | 173, 164, 80, 140, 89, 195 | Port | each its own test file | FEAT-04, FEAT-05 |
| `src/utils/graphRouting.js` | 106 | Port, then fix DEF-77.3 (shares counted with the way back) | graphRouting, groupRouting | FEAT-04 |
| `src/utils/finishReleaseClock.js`, `src/app/finishContexts.js` | 103, 69 | Not ported; their rule is: time comes from authored inputs, in reference space | — | FEAT-05 |
| `src/services/NetworkEditService.js` | 1,260 | Split: its edit commands (:436–777) become the route graph's commands; its overlay drawing (:873–1260) the editor's overlays; its interface not ported | networkEdit, networkBudget (limits) | CORE-06 |
| `src/app/crowds.js`, `crowdWaiting.js`, `network.js` | 2,017, 179, 1,132 | Not ported (interface on the shared `this`); their range table and hint wording are the crowd panel's specification | — | FEAT-04 |

**Drawing**

| v3 | Lines | Verdict | Tests | v4 item |
| --- | --- | --- | --- | --- |
| `src/services/RenderingService.js` | 2,691 | Split: the layer kit (P4) into `src/adapters/render`, the composing into `src/player/compose.ts`; background, darken and the camera transform there too; the line and head (:1548–2212) into the line and lead modules; markers and labels (:2265–2655) into theirs; every editor overlay (:182–457, :2442–2516) into an editor-only list that never receives selection state in an export or the player (DEF-99.1); browser globals (:1079, :1084) passed in | vectorLayers (order), exportFraming; draw goldens re-recorded (rule 4) | CORE-04 |
| `src/services/BeaconRenderer.js` | 1,198 | Port into the Arrival effects feature; reduced motion passed in, not read from `window.matchMedia` (:965) | shortHexGlow, the beacon timing cases | FEAT-01 |
| DotRenderer, TextLabelService | 58, 428 | Port into the crowd and labels modules | labelAutoPosition | CORE-04, FEAT-04 |
| `src/services/AreaHighlightRenderer.js` | 364 | Split: scene drawing, and edit mode (:77–96) as an editor overlay | renderReference | FEAT-02 |
| AreaDrawingService, AreaEditService | 391, 370 | Rewrite small as editor tools | areaEdit | FEAT-02 |
| pathWidthScale, renderReference, safeColor | 33, 41, 32 | Port | their own tests | CORE-04, CORE-03 |
| `src/utils/pathHeadPresets.js` | 61 | Split: the preset table, and an image loader passed in | pathHeadPresets | CORE-04 |
| `src/utils/sceneSemantics.js` | 329 | Rewrite small for v4's outline; its key encoding (:44–60) ports | the outline cases | CORE-07 |

**Export**

| v3 | Lines | Verdict | Tests | v4 item |
| --- | --- | --- | --- | --- |
| `src/services/VideoExporter.js` | 1,040 | Split: `createVideoFramePlan` and the WebCodecs path with mediabunny; the MediaRecorder fallback not ported, the profile being Chromium-only (A21) | videoExporter, videoExportConcurrency, exportSizeDuringExport, exportMinimisation, noRouteExport | CORE-08 |
| `src/services/HTMLExportService.js` | 408 | Split: the content security policy (:178), JSON embedding (:140), background check (:147) and sharing rule (:78–88) ported; the page shell written new around v4's player | htmlExportCache, publicationBoundary's export cases | CORE-10 |
| `src/player/PlayerApp.js`, `playerEntry.js` | 494, 329 | Rewrite small on v4's player runtime (they borrow v3's mixins) | playerApp's parity cases, as v4 tests | CORE-10 |
| `src/player/playerAccessibility.js` | 238 | Port, its words matched to the glossary (UI-06.7) | playerAccessibility, playerEntryAccessibility | CORE-10 |
| `build.js`'s publication manifest checks (:86–134, :414–447) | — | Port into v4's publishing step | releaseSafety, buildScript's manifest cases | PUB-01 |

**File safety**

| v3 | Lines | Verdict | Tests | v4 item |
| --- | --- | --- | --- | --- |
| `src/services/ImageAssetService.js` | 897 | Split: the ZIP preflight (:34–233), limits (:18–32) and import checks (:734–884) into `src/adapters/io`; v3's ZIP layout not ported; the save writes `project.json` as bytes encoded once, never a string JSZip cuts in chunks (DEF-101) | assetAdmission, archiveBound, imageAssetRoundTrip (v4 form); archiveText's table (:17–22) as DEF-101's check | CORE-03 |
| `src/models/ImageAsset.js` limits, MIME allowlist, magic bytes; `planImageAssetAdmission`; entityId; safeColor | — | Port | their tests | CORE-03 |
| `src/app/persistence.js` | 1,700 | Split: the limits table (:63–78), the forbidden-key guard (:80, :132–180), the settings checks (:345) and the stage-then-commit shape (:432) ported; the mixin, the live-state rollback (:871–1206) and formats 6 to 9 (:1478–1556, :1597–1599) not ported | projectRollback (DEF-51 inverted); authorableLoadable as a property; projectLimits | CORE-01, CORE-03 |
| `src/services/StorageService.js` | 808 | Rewrite small with v4's names; its honesty rules kept (every access guarded; never `localStorage.clear()`, which would wipe every github.io site of the account) | storage cases rewritten | CORE-09 |
| `src/services/RecoveryImageStore.js` | 831 | Split: the SHA-256-keyed IndexedDB store with Web Lock pinning, names passed in | recoveryImageStore | CORE-09 |
| `src/app/unrestoredAutosave.js`, `recoveryImages.js` | 499, 1,304 | Not ported (v3's record format); DEF-28's behaviour (a session that cannot be restored is kept and offered) is a v4 check | — | CORE-09 |
| `src/services/UndoService.js`, `src/app/undoRedo.js` | 235, 527 | Rewrite small on the store: one gesture, one step | undoService's cases | CORE-05 |
| `src/services/DiagnosticsService.js`, `src/app/privacy.js` | 152, 352 | Port diagnostics (allowlisted, redacting: the brief's decided foundation); rewrite the privacy notice's shell, keeping its wording | diagnostics, privacy | CORE-11 |

**Input, interface and the rest**

| v3 | Verdict | v4 item |
| --- | --- | --- |
| `src/handlers/InteractionHandler.js` (1,176) | Split: the pointer transaction (one primary pointer, a 3 px tap-or-drag threshold, capture, exactly one commit or a restoring cancel) as a pure state machine; its DOM binding new | CORE-06 |
| `src/utils/announcementQueue.js` (153) | Port (DEF-45's queue) | CORE-05 |
| `src/config/keybindings.js` (568) | Rewrite small: one key table for dispatch and help; no shortcut takes a browser chord (DEF-63) | CORE-05 |
| `src/config/constants.js` (415) | Split into the schemas' ranges and `src/core/config`; the unused constants are left behind | CORE-01 |
| `src/main.js`, `src/app/*` mixins, the controllers, components, wiring and start-up | Not ported: v4's editor is written new in React and Carbon (Q21); their behaviour is carried as held checks, and UI-06, CROWD-07 and UI-07's open findings as inputs | CORE-05, CORE-06 |
| `src/config/helpContent.js`, `tooltips.js` | Not ported as code; their text is the first draft of v4's help, reworded to the glossary | CORE-05, CORE-11 |
| `src/examples/index.js` | Not ported (format-9 code); 18 test files use these scenes as fixtures, so v4's fixtures are built from its schema | EX-01 |
| `styles/*.css` | Not ported: Carbon and the pack's theme; the UoN tokens and the Okabe-Ito values carry into the theme | STACK-02 |
| `scripts/`, `build.js`, `push.js` | Stay with v3 | STACK-01 |

**Size.** The ported pieces come to roughly 14,000 of v3's 54,700 source lines,
about a quarter (an estimate from the line counts above). The rest is v3's
interface and wiring, which v4 writes new.

**Dependencies.** jszip and mediabunny carry over with the ported save and
video code (the brief's Constraints: "carried into v4 by the port unless the
architecture plan rules otherwise"; this plan does not rule otherwise),
installed by STACK-02 with the rest of the stack so later items never touch
`package.json` (A26).

# Part C — homes, checks and decisions

## 16. Every held line's home

The stock take's held list (`reviews/v4-stock-take-2026-11-18.md`, "The held
list") is 111 lines: 72 checks, 22 port notes, 3 interface inputs, 9
candidate features and the 5 lost defects, with DEF-101's save fault and the
port hazard beside them. Each goes to the v4 item that must pass it (a check)
or weigh it (a note, an input, a candidate). Where a check says
"unverified", the item's first test decides it and the item says which way
(§15, rule 8). None is brought back to the owner to retire: each is a fault
or a choice in something v4 also does.

**The five lost defects, verified first.** Each was read at `8005061` against
the abstraction plan's register and TST-09's decision, and each is still
open, pinned by v3's tests as it stands: DEF-05 (a branched route's camera and
marker timing pair the full waypoint array with the trunk's progress:
`src/app/camera.js` :138–165, :286–287; `src/main.js` :1380, :1449), DEF-07
(the camera is not a function of time: `src/services/CameraService.js`
:134–136, :186–189, :411–438), DEF-10 (the curvature cache keys on three
points and a length: `src/services/PathCalculator.js` :509–520, :616–626),
DEF-11 (a route that starts or ends on minors changes timing regime:
`src/app/pathTiming.js` :698–720, `src/core/PlayerCore.js` :110–136) and DEF-12
(route time and engine time mixed under an intro or comet tail:
`src/utils/routeAnchors.js` :147–149, `src/services/RenderingService.js`
:1474, `src/utils/crowdArrival.js` :134). So all five are held as checks.

| v4 item | Must pass (checks) | Weighs (notes, inputs, candidates) |
| --- | --- | --- |
| STACK-02 | — | TST-11 (no test reads source text), DEL-01 (knip keeps v4 free of barrels), INTAKE.18 (no real frame after a test file ends) |
| CORE-01 | INTAKE.29, DEF-20.2 (one range per field, shared by open and control) | — |
| CORE-02 | DEF-05 (its timing half), DEF-10, DEF-11, DEF-12, CROWD-08.4, INTAKE.12, TST-09.2 | TST-03.5, TST-03.6 (one pause clock), DEL-03, DEL-04, CROWD-05.1 (Hold at start) |
| CORE-03 | DEF-101 (the chunked text fault), DEF-51, CROWD-08.7, TST-04.1, INTAKE.13 (its open half) | DEL-06 |
| CORE-04 | TST-03.1, TST-03.2, TST-09.3 (ruled, A25), CROWD-07.1 | INTAKE.21, INTAKE.30, INTAKE.31, DEL-02 |
| CORE-05 | DEF-15, DEF-62, DEF-63, DEF-67, DEF-70, DEF-74, DEF-92, DEF-97, DEF-13.1, DEF-20.1, CROWD-06.2, CROWD-06.3, CROWD-06.4, TST-04.2, INTAKE.26, REL-698.1, REL-703.2, UI-06.6, DEF-42.1 | DEL-05; inputs UI-06 and UI-07 (the shell, its layout, status and help) |
| CORE-06 | DEF-22, DEF-60, DEF-65, DEF-87, INTAKE.19, INTAKE.22 | DEF-64.1; candidates DEF-77.4 and INTAKE.3 (taken in, §12) |
| CORE-12 | DEF-54, DEF-55, DEF-73, DEF-88, DEF-32.1, DEF-13.2 | candidate INTAKE.2's route reordering (taken in, §12); input UI-06 (the panels) |
| CORE-07 | — | input UI-06 (the outline's rows) |
| CORE-08 | DEF-58, DEF-99.1, REL-725.2 | INTAKE.17 |
| CORE-10 | DEF-79, DEF-80, UI-06.7 | INTAKE.15, INTAKE.16 |
| CORE-09 | DEF-66, INTAKE.13 (its recovery half), TST-05.1, DEF-28.1 | — |
| PUB-01 | DEF-71, DEF-75 | — |
| FEAT-01 | DEF-56, DEF-57 | DEF-42.2 |
| FEAT-03 | TST-03.3 | TST-03.4 |
| FEAT-04 | DEF-78, DEF-85, DEF-90, DEF-93, DEF-95 (by Q8), DEF-77.3, CROWD-05.2, TST-09.4 (ruled, A25) | TST-16.1; input CROWD-07 (the crowd panel) |
| FEAT-07 | — | candidate CROWD-08.3 (by Q7) |
| FEAT-06 | DEF-05 (its camera half), DEF-07, DEF-19, DEF-68, DEF-69, DEF-44.1, TST-09.1, UI-06.11 | DEF-44.2, UI-06.13 |
| PRESET-01 | — | candidate EX-02.1 (as the match-day crowd preset) |
| V40-01 | — | candidates INTAKE.1, INTAKE.2's several crowds on one route, INTAKE.6, OWNER.1 (the after-v4.0 order, §12) |
| Every porting item | the port hazard: §15's rule 2 | — |

## 17. The plan checked against the record, and where it departs

**Against the abstraction plan's §16:** §8's last part. No departure; the
optional members are a watched risk.

**Against its §11, the target direction.** Kept: the layers (§11.1: L0
configuration is `src/core/config`; L1 pure domain is `src/core` and the
features' `model/`; L2 side effects are `src/adapters` and the features'
`draw/`; L3 components are `src/editor`; L4 composition is the editor app,
`src/player` and `src/exported`), its dependency rules enforced in the gate
(dependency-cruiser instead of esbuild's metafile), the player closure rule
(kept as narrow as §11.1's rule 3, and now also excluding React and Carbon),
no private cross-module calls, zero
cycles, no `utils/` dumping ground, §11.4 (renderers never write project
state, no wall clock in a frame, storage through one adapter, no hidden I/O),
§11.9's error conventions, §11.10's quiet logging, §11.11's two-consumer rule
and §11.13 (§16 answered in every pull request that adds an abstraction).
**Departures,** each on the owner's word: §11 kept "the static ES-module app,
with no framework", "the EventBus" and "the prototype-mixin orchestrator";
v4 has React and Carbon (Q21), typed commands instead of a string-event bus
(A19), and no mixins (Q1's new app). Its §1, "Never rewrite", is overruled
for v4 (Q1; PLAN-5 records it).

**Against the founding decision of 2026-08-17** (the frozen canon log,
`pm_skills/project/archive/decision-log-2026-08-17-to-2026-08-26.md` :1558).
Kept and strengthened: the deterministic-timeline mandate (the camera, which
broke it, becomes pure; one evaluation path, `compose.ts`, for play, scrub
and export). **Departures:** its coexistence model ("the existing Waypoint
chain remains the narrative "hero route" layer, and new flow layers") gives
way to one kind of route with travellers as features (Q11); "Crowd" stays the
user's noun, but v4's code takes the user's words too, where v3's kept its
own (`FlowLayer`, `scene` block); and v4 is built in the same repository,
where v3 began a fresh one (Q5).

**Against the brief's Direction** (signed 2026-11-18). Consistent with it, with
three things to note. Its "v3's engine is ported with its tests" is read
piece by piece, as Q1 says: about a quarter of v3's source is ported, and a
test that pins a defect is not ported as a requirement. If Q4 stands, the
first publish has a condition the Direction does not name. And its last
sentence, "The current work is the v4 programme (PLAN-5): the architecture
plan first, before any code", is out of date once PLAN-6 opens; a redraft is
in section 21, for his signature.

**Against MERGE-01's own criteria.** One departure, by his word G3: the
question round comes after building starts, not before (§22).

**Against the PM-Skills editor pack** (read at v5.0.1, build fd5fb94, under
G4). Departures, each recorded for the pack's maintainers as much as for the
owner: v4 lives at the root of a repository that already holds another app,
which the pack says is "never retrofitted" (the owner's Q5 is the decision it
asks for); `src/features/` is added with its own rules; the pack's player and
exported rules are replaced (§8, rules 6 and 7); a second build output, the
exported player, is added (§14); and v4's TypeScript, lint, dead-code and test
settings exclude `v3/**`, and knip's `tools/*.mjs` entry is narrowed so it
does not sweep the record's own tools.

**Against the signed lines.** The rules file's Always section still states
v3's invariants (`src/utils/imageCoordinates.js`, `InteractionHandler`, the
EventBus, `src/config/constants.js`, `index.html`); after STACK-01 they
describe `v3/`. STACK-04 drafts v4's for the owner's signature and leaves the
signed text unchanged until he signs.

## 18. Decisions taken for the owner, and what each would redo

Each is provisional under G3 until he rules. "Redo" names the items that
would be redone if he picks otherwise; the build order (§19) puts the least
settled last.

He answered the question round on 18 November (§22). As PLAN-6 (2026-11-19)
reads his answers, a reading his to correct: A1, A2b, A3, A4, A11, A15, A23
and A24 are ruled as recommended, and A16 is overturned by his word on
publishing; each is marked below. The rest stay provisional under G3.

| # | Decision | Section | Redo if overturned |
| --- | --- | --- | --- |
| A1 | A route's lines may fork, join, run both ways, start in several places and loop; the lead's walk is the deterministic tree of §3 (round 1, Q2). **Ruled 18 Nov: as recommended (§22).** | §3 | Small if he picks "forks only": the model is built general and gains a validation rule that refuses several starts, two-way lines and loops (CORE-01, CORE-06, FEAT-04) |
| A2a | Every time is saved as an exact time, never a share of a duration | §4 | CORE-01, CORE-02 |
| A2b | The scene's length comes from its content unless the author fixes it; a fixed length trims, never stretches (round 1, Q1). **Ruled 18 Nov: as recommended, with his added requirement for animation that cycles (§22; CORE-02).** | §4 | A small change to the clock (CORE-02) |
| A3 | The camera is a scene feature following a lead's main head or a crowd's centre, smoothed over a window of scene time (round 2, Q5). **Ruled 18 Nov: as recommended (§22).** | §5 | FEAT-06 |
| A4 | The feature homes of §7 (round 2, Q5). **Ruled 18 Nov: as recommended (§22).** | §7 | The feature whose home moves (FEAT-01, FEAT-02, FEAT-03 or FEAT-06) |
| A5 | A feature is one folder with `model/`, `draw/` and `editor/`; two contracts (route, scene) on one base; two ordered catalogues | §8 | Every feature item; it is grounded in his Q1 and Q12 |
| A6 | The seven contact points | §8 | CORE-02 to CORE-06 |
| A7 | The pack's layers kept, its player and exported rules replaced, seven rules for `src/features/` | §8 | STACK-04 |
| A8 | A new route shows the core only, about fourteen controls | §9 | CORE-12 |
| A9 | The measures M1 to M11, printed by `npm run measures` and in CI's summary | §10 | STACK-04 |
| A10 | The five presets' contents, and Blank | §12 | PRESET-01 |
| A11 | Before v4.0 only what v4's model and the presets need; the after-v4.0 order of §12 (round 2, Q6). **Ruled 18 Nov: as recommended (§22).** | §12 | None; items are added |
| A12 | Schema-first save with our own helper, no new package | §13 | CORE-01, CORE-03 |
| A13 | Format versions: free until the first publish; then older versions open by tested steps, newer ones are refused whole. **Changed 19 Nov by PLAN-7, provisionally: free until v4.0, another version refused whole meanwhile (§13).** | §13 | CORE-03 |
| A14 | v3 moves into `v3/` with its own package; its build and release scripts unchanged; root `docs/` and `version.json` untouched, v3 given copies | §14 | STACK-01 and the paths of everything after it; grounded in Q5's option text |
| A15 | v4 keeps its own browser storage, autosaving to IndexedDB under names that do not begin `routePlotter_` (round 1, Q3). **Ruled 18 Nov: as recommended (§22).** | §11 | CORE-09 |
| A16 | The Xerte copy working, with Gary holding its address, is a condition for the first publish (round 1, Q4). **Overturned 18 Nov by his word on publishing (§22): no condition; v4 may be published at any point, PUB-01 straight after STACK-02.** | §11 | PUB-01's first-publish step only |
| A17 | The port's verdicts, piece by piece | §15 | The item that ports the piece |
| A18 | The rules for porting tests | §15 | Every porting item |
| A19 | No string-event bus; a typed store with commands | §15 | CORE-05 |
| A20 | The exported player is a second Vite entry | §14 | CORE-10 |
| A21 | The MediaRecorder video fallback is not ported (Chromium-only) | §15 | Additive, if he wants it |
| A22 | Speeds in image widths a second; nothing timed in canvas pixels | §4 | CORE-02 |
| A23 | Crowd areas placed freely, rectangle or ellipse (round 2, Q7). **Ruled 18 Nov: as recommended (§22).** | §22 | FEAT-07 |
| A24 | A repeating dot's laps on a network are identical (round 2, Q8). **Ruled 18 Nov: as recommended for v4.0; his later wish is PLAN-6.1 (§22).** | §22 | FEAT-04's sway rule |
| A25 | TST-09.3 (a comet trail is empty during a final wait) is meant, as a stopped comet has no tail; TST-09.4 (a crowd walking before the lead moves) is meant when its release says so, crowd and lead timing being independent | §16 | CORE-04, FEAT-04 |
| A26 | jszip and mediabunny are installed by STACK-02 with the stack | §15 | STACK-02 |
| A27 | The five lost defects are held as checks, all still open | §16 | — |
| A28 | The build in 28 items, four phases, least settled last | §19 | — |
| A29 | STACK-01 is narrowed to moving v3 aside, its other criteria moving to STACK-02, STACK-03 and STACK-04; the canvas and the panels are two items (CORE-06, CORE-12), and v3's crowd extras and the free placement of areas are two (FEAT-05, FEAT-07) | §19 | — |
| A30 | One crowd per route at v4.0 | §12 | FEAT-04 |
| A31 | A crowd's extras are part of the crowd module, added inside its section | §9 | FEAT-04, FEAT-05, FEAT-07 |
| A32 | The accessible scene outline is part of the core (CORE-07), since keyboard-only authoring is the AAA path | §19 | CORE-07 |
| A33 | Help, diagnostics and the privacy notice are ported before v4.0 (CORE-11), the brief's decided foundation for support | §19 | CORE-11 |
| A34 | v3's `project/architecture.md` moves to `v3/ARCHITECTURE.md` before the pack's architecture record takes its path, by PLAN-6 (the pack asks for "its own decision") | §19 | STACK-04 |
| A35 | PM-Skills' Set 1 is pinned at STACK-02's install and its pilot row dated then, as the pack says for the first app; the pinned list is shown to him (G4) | §19 | STACK-02 |

# Part D — the build

## 19. v4's items, in build order

Each item is sized for one sub-chat session. "Writes" lists the paths it may
change; "Checks" are its own, on top of what every item does: its gate green
in CI, Codex's read-only review, `node tools/check.mjs` and `--commit HEAD`
at 0 failures, its held lines (§16) passed or weighed and named in the pull
request, and a merge under G2. IDs follow the record's families; CORE-09 to
CORE-12 are numbered in the order they were named and built in the order
below.

**Shared files have one writer at a time.** `package.json`, the lockfile,
`.github/workflows/ci.yml` and the two catalogues are touched by more than one
item. Items that change them run one after another. Where feature items run
side by side, each changes only its own folder, and the catalogue lines are
added by each in turn as it merges: the second to merge brings `main` in,
adds its line, and merges only once CI is green and Codex has approved that
exact head, as G2 requires.

*Added by PLAN-7 (2026-11-19):* since STACK-03, `tests/a11y/project.mjs` and
`project/a11y/coverage.json` are shared files too: every item that adds a
screen or control declares it there. The pairs below that both add controls
(CORE-06 with CORE-12, CORE-07 with CORE-08, CORE-10 with CORE-09) still run
side by side, on the catalogues' terms: each adds only its own entries, and
the second to merge brings `main` in, keeps both sides' entries, runs v4's
whole gate with the accessibility run on the joined head, and merges only once
CI is green and Codex has approved that head. The accessibility run holds port
4173 on the machine that runs it, so two items cannot run it locally at the
same moment; the second waits for the first. Every core item's pull request
also carries a `## What to try` section, which the publishing step copies to
the live `version.json`, and every merge leaves the published page working,
since every app merge publishes.

### Phase 6 — v4's foundations

**STACK-01 — Move v3 aside into `v3/`, frozen and still building.**
Delivers: §14's L1 move; v3's suite green from `v3/` in CI; GATE-01's sorting
with v3's paths under `v3/**`; the record's paths that name v3 files
re-pointed where the checker reads them. Depends on: GATE-01 merged; PLAN-6.
Checks: v3's whole suite green in CI from `v3/`. **The build compared, read
only:** in two throwaway folders outside the repository (a copy of `v3/`
after the move, and a checkout of the tag `v3.3.726`), v3's own build is run
so that it stamps version 3.3.726 and keeps its output in that folder's own
`docs/`; the throwaway folder absorbs whatever the build writes (its
`version.json` included), so nothing in the repository changes. The two
outputs are then compared file by file after two normalisations, and only
these: the `// Built:` timestamp line that esbuild's banner writes into
`app.js` (`build.js` :860) is masked, and the random staging folder names the
build records in `meta.json` (`build.js` :756; for example
`.docs-build-ANTSP4/app.js`) are replaced by one fixed name. Each output is
compared the same way with the committed root `docs/`. Any other difference
fails the item.
`git diff` shows the root `docs/`, `version.json`, `build.js`'s and
`push.js`'s contents and the tag untouched; `git log --follow` holds across
the move. Writes: `v3/**` (by `git mv`, plus copies of `version.json`,
`LICENSE`, `THIRD_PARTY_NOTICES.md`; GATE-01's `scripts/gate.mjs` stays),
`scripts/gate.mjs` and its test (v3's paths now under `v3/`), `.gitignore`,
`.github/workflows/ci.yml`, `DEV-INFRASTRUCTURE.md`, `project/structure.md`,
`project/items/*.md` (source paths only). Parallel: none. Redo: A14.

**STACK-02 — v4's skeleton on the editor stack.** Delivers: the PM-Skills
5.0.1 app pack (editor kind) and the accessibility pack's lint, installed at
the root by their own routes (the pack's ESLint config needs the
accessibility pack's file first); React 19, Carbon React, strict TypeScript,
Vite (the editor entry and the exported player entry), Vitest, ESLint, knip,
dependency-cruiser, fast-check, Sass, IBM Plex, jszip and mediabunny, each at
an exact version, listed for the owner (G4); Set 1 recorded (A35); an empty
shell that builds and shows a blank Carbon page; v4's gate (typecheck, lint,
boundaries, dead code, tests, build) in CI in GATE-01's place, under 10
minutes; settings that exclude `v3/**`; v4's third-party notices; the test
conventions of §15 (TST-11, INTAKE.18). Depends on: STACK-01. Checks: the gate
green in CI and its time reported; the player bundle holds no React or
Carbon; the profile's App opinion and Accessibility testing lines drafted for
the owner's signature, not written. Writes: `package.json`,
`package-lock.json`, `index.html`, `tsconfig*.json`, `vite.config.mjs`,
`eslint*.mjs`, `knip.json`, `.dependency-cruiser.cjs`, `src/**`, `tests/**`,
`project/app/set1.json`, `THIRD_PARTY_NOTICES.md`, `.github/workflows/ci.yml`.
Parallel: none. Redo: A26, A35.

**PUB-01 — Each app item publishes v4 to Pages, on the owner's advance word.**
Moved here from the end of Phase 7 by PLAN-6 (2026-11-19), on his word to "publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)"
(§22): STACK-02's build is the first that v4 has to publish. Delivers, as
its item file says: the publishing step, through which alone v4 reaches
Pages; the first publish waits for nothing more (A16 overturned), and
replaces v3 at the github.io address with v4 as it then stands, as he
confirmed (§22); a publish never makes later work wait; v3's publication
checks ported (DEF-71, DEF-75); what the root `version.json` becomes put to
him. Every guard is kept: an unknown flag never publishes; every file the
page refers to is checked; a dry run and a record-only merge publish nothing;
a bad publish's take-back is written down and tried once; CI fails a hand
change to `docs/` or `version.json`. Depends on: STACK-02, GATE-01. Checks:
a dry run on a branch publishes nothing; a record-only merge publishes
nothing; the two facts in its item file's Notes settled (the gate sorts the
root `docs/` as other, so a publish commit would run v3's whole suite; v3's
release tests read the root `docs/` as the last release). Writes:
`.github/workflows/publish.yml`, `scripts/publish*.mjs`; never `docs/` or
`version.json` by hand. Parallel: with STACK-03 (it touches neither
`ci.yml` nor `package.json`). Redo: none (A16, its old Redo, is
overturned).

**STACK-03 — Accessibility testing, standard depth, at AAA.** Delivers: the
accessibility pack's Playwright and axe run (its four specs: states,
keyboard, adaptation, journeys) green against the shell in CI. Depends on:
STACK-02. Checks: the run green in CI; a planted contrast fault fails it
(non-vacuity). Writes: `playwright.config.*`, `tests/a11y/**`,
`tools/a11y-run.mjs` (the pack's), `package.json` (scripts),
`.github/workflows/ci.yml`. Parallel: none (it shares `package.json` and
`ci.yml` with STACK-04). Redo: none.

**STACK-04 — The architecture record, the enforced edges and the measures.**
Delivers: v3's `project/architecture.md` moved to `v3/ARCHITECTURE.md` (A34);
v4's architecture record in the pack's format from this plan; §8's rules in
`.dependency-cruiser.cjs`, each proved by a planted violation that fails it,
with the player closure test; `npm run measures` (M1 to M11, with v3's
baselines counted once) and its table in CI's summary; v4's rules-file Always
lines drafted for the owner's signature. Depends on: STACK-03. Checks:
boundaries green; every planted violation fails; the measures table printed.
Writes: `project/architecture.md`, `v3/ARCHITECTURE.md`,
`.dependency-cruiser.cjs`, `scripts/measures.mjs`, `tests/architecture/**`,
`package.json` (scripts), `.github/workflows/ci.yml`. Parallel: none. Redo:
A7, A9, A34.

### Phase 7 — the core, end to end

**CORE-01 — The project model and the schema helper.** Delivers:
`src/core/schema` (§13); the scene, routes, points, lines, starts and ends,
`leadStart`; the core modules' settings; limits from v3's table; ids
(entityId's port). Depends on: STACK-04. Checks: fast-check properties (every
model the schema allows is valid; defaults are valid); a value outside a
field's range is refused with a report naming the field. Writes:
`src/core/model/**`, `src/core/schema/**`, `src/core/config/**`. Parallel:
with GATE-02 (added by PLAN-7). Redo: A1, A2a, A12.

**GATE-02 — The gate's loose ends after the foundations.** Added by PLAN-7
(2026-11-19). Delivers, as its item file says: the accessibility pack's files
sorted as v4; the publishing step's files in a class of their own; STACK-04's
scripts/measures.mjs placed; the publishing commit's check made to skip jobs
that did not run; PUB-01's trial recorded in its Notes. Depends on: STACK-04.
Checks: a gate test for each change that fails without it. Writes:
`scripts/gate.mjs`, `scripts/gate.test.mjs`, `project/items/PUB-01.md`
(Notes). Parallel: with CORE-01, CORE-02 and CORE-03, which touch none of its
files. Redo: none.

**CORE-02 — Geometry, the lead's timing and the clock.** Delivers: §15's
timing and geometry ports; the lead's walk; `composeTimeline` and
`sceneLength` (§4); Hold at start and end. Depends on: CORE-01. Checks: §3's
three worked examples as tests; the DEF-05, DEF-10, DEF-11 and DEF-12 pins
inverted; a route at 2,000 points samples within its budget. Writes:
`src/core/geometry/**`, `src/core/timing/**`, `src/core/clock/**`. Parallel:
with CORE-03. Redo: A1, A2b, A22.

**CORE-03 — Save and open.** Delivers: §13's format and §15's file-safety
ports in `src/adapters/io`; a v3 file recognised and refused with a message.
Depends on: CORE-01. Checks: DEF-101's check (an emoji across each
16,384-unit boundary, saved and reopened by every path); open after save
gives the same project, as a property; a newer version's file is refused
before anything changes. Writes: `src/adapters/io/**`. Parallel: with
CORE-02. Redo: A12, A13.

**CORE-04 — The renderer and the core's drawing.** Delivers:
`src/adapters/render` (the layers of P4, reference scaling, the recorder with
its clip region); `src/player/compose.ts` (§8's four stages); the core
modules' `model/` and `draw/` (line with its appearances, lead head and head
presets, markers, labels, pauses, background, clock, export settings);
editor overlays as a separate list. Depends on: CORE-02. Checks: the first
goldens, each compared with v3's frame of the same scene and every
difference named; a module whose evaluation fails is reported and skipped,
not thrown. Writes: `src/adapters/render/**`, `src/player/compose.ts`,
`src/features/{line,lead,markers,labels,pauses,background,clock,export}/{model,draw}/**`,
`src/features/catalogue.ts`. Parallel: none. Redo: A5, A6, A25.

**CORE-05 — The editor shell.** Delivers: the React and Carbon frame (the
pack's theme with UoN tokens and the Okabe-Ito map palette) with named slots
for the panels, the points list, the outline and the export panel, which
later items fill; the store and its typed commands; undo and redo; selection;
the transport (play, pause, scrub, J, K and L, skip) on `src/player`'s clock;
the control kit; the announcement queue; the key table; dialogs. Depends on:
CORE-03, CORE-04. Checks: one gesture is one undo step and Redo restores the
selection; a project opened from a file plays at once with its timing built;
no shortcut takes a browser chord; a slider dragged and paused makes one undo
entry. Writes: `src/editor/{shell,store,kit,transport}/**`,
`src/player/transport/**`, `src/ui/**`. Parallel: none. Redo: A19.

**CORE-06 — Drawing routes on the canvas.** Delivers: canvas authoring through
the ported pointer transaction; the pen (stops and bends, lines, forks, joins,
two-way lines, loops, `leadStart`, start and end marks); inserting a point
into a line, deleting, dragging and group dragging, duplicating, arrow-key
nudging, a point's context menu; the route graph's commands. Depends on:
CORE-05. Checks: the drawing half of "what can be authored can be opened"
(§15, rule 6); a drag that moves nothing records no undo; a point inserted on
a fork's run joins that run (DEF-22, its v3 pin inverted). Writes:
`src/editor/canvas/**`, `src/core/model/commands/**`. Parallel: with
CORE-12. Redo: A1.

**CORE-12 — The core panels and the points list.** Delivers: the points list
(selection, reorder by drag and keyboard); the route list, reorderable,
setting the drawing order; the route panel's Line and Lead sections; the stop
panel's Marker, Label and Pause sections; the scene panel's Background,
Timing and Export sections; the core modules' `editor/` parts, listed in
`src/features/catalogue.editor.ts`. Depends on: CORE-05. Checks: the panels'
half of "what can be authored can be opened", each control at its limits; a
new route shows about fourteen controls (M5); the panel shows what is
selected however it was selected. Writes: `src/editor/panels/**`,
`src/editor/lists/**`, `src/features/*/editor/**` (the core modules'),
`src/features/catalogue.editor.ts`. Parallel: with CORE-06. Redo: A8.

**CORE-07 — The scene outline.** Delivers: the accessible outline (scene,
routes, stops), mounted in the shell's outline slot, every core action by
keyboard alone. Depends on: CORE-06, CORE-12. Checks: a Playwright journey
makes a route, sets a stop's label and pause, plays and saves without the
pointer. Writes: `src/editor/outline/**`. Parallel: with CORE-08. Redo: A32.

**CORE-08 — Video export: the core works end to end.** Delivers: MP4 and WebM
through WebCodecs and mediabunny, the frame plan, aspect presets, what to
include, path-only, rendered through `compose.ts` with no editor overlay; the
export panel in the shell's slot. With it, an author can draw, play, save and
reopen, and export: the build Q13 names. Depends on: CORE-06, CORE-12.
Checks: a scripted run draws, plays, saves, reopens and exports; nothing done
during an export changes it; no selection box in it; the first export after
opening matches later ones. Writes: `src/adapters/video/**`,
`src/editor/export/**`. Parallel: with CORE-07. Redo: A21.

**CORE-10 — HTML export and the exported player.** Delivers:
`src/exported/player.ts` built as one script with no React or Carbon; the page
shell with its content security policy; the player's accessibility; the HTML
option in the export panel. Depends on: CORE-08. Checks: editor, video and
player show the same frame at the same instants; the closure test passes on
the built bundle. Writes: `src/exported/**`, `src/player/**` (runtime, not
`compose.ts`'s contract), `src/adapters/html/**`, `src/editor/export/**`,
`vite.config.mjs` (the second entry's settings only). Parallel: with
CORE-09. Redo: A20.

**CORE-09 — Autosave and recovery in v4's own storage.** Delivers: autosave to
IndexedDB under v4's own names (A15); the recovery image store's port; a Web
Lock across tabs; a session that cannot be restored kept and offered.
Depends on: CORE-03, CORE-05. Checks: no v3 key is read, written or deleted
(a test seeds v3's keys and finds them byte for byte afterwards); two tabs do
not write over each other. Writes: `src/adapters/storage/**`,
`src/editor/recovery/**`. Parallel: with CORE-10. Redo: A15 (round 1, Q3).

### Phase 8 — features as modules

**FEAT-01 — The Add feature list, with Arrival effects and Line glow.**
Delivers: §9's adding and removing; the outline's feature entries; Arrival
effects (BeaconRenderer's port, per stop) and Line glow (casing and glow).
Depends on: CORE-07. Checks: an added section takes its fixed place, is
announced and receives focus; removing then saving leaves nothing of it in the
file, and Undo restores it; a dependant is named before a removal; adding
either feature touches only its folder and one line in each catalogue (M1).
Writes: `src/editor/features/**`, `src/features/{arrival-effects,line-glow}/**`,
the two catalogues. Parallel: none. Redo: A4, A8.

**FEAT-02 — Highlighted areas.** Delivers: per-stop circle, rectangle and drawn
shape, with appearance over time; the area tools rewritten as its editor part.
Depends on: FEAT-01. Checks: its controls' half of "what can be authored can
be opened"; M1. Writes: `src/features/highlighted-areas/**`; its catalogue
lines on merge. Parallel: with FEAT-03, FEAT-04, CORE-11. Redo: A4.

**FEAT-03 — Reveal background.** Delivers: spotlight and angle of view and
their reveal forms, drawn into the background mask layer. Depends on:
FEAT-01. Checks: two routes' reveals uncover the union; the spotlight's intro
shows; M1. Writes: `src/features/reveal-background/**`; its catalogue lines on
merge. Parallel: with FEAT-02, FEAT-04, CORE-11. Redo: A4.

**FEAT-04 — The crowd.** Delivers: the ported crowd engine on the route graph
(release, pace, journey end, shares at starts and lines, seeded), its
traveller (the centre), its section and its per-line and per-start controls,
from v3's range table and hints and CROWD-07's findings. Depends on: FEAT-01.
Checks: the DEF-12 and DEF-79 pins inverted; a two-way line's way back is not
a choice (DEF-77.3); a 5,000-dot crowd's first walk does not block editing;
M1. Writes: `src/features/crowd/**`; its catalogue lines on merge. Parallel:
with FEAT-02, FEAT-03, CORE-11. Redo: A1, A24, A30.

**CORE-11 — Help, diagnostics and the privacy notice.** Delivers: help in the
glossary's words; the allowlisted, redacting diagnostics, previewable before
sharing; the privacy notice. Depends on: CORE-05. Checks: diagnostics hold no
project content; the help passes the glossary test (M6). Writes:
`src/editor/help/**`, `src/adapters/diagnostics/**`. Parallel: with FEAT-02,
FEAT-03, FEAT-04. Redo: A33.

**FEAT-05 — The crowd's extras, as v3 has them.** Delivers: start and finish
areas centred on their points, waiting crowds, groups and the final whistle,
ported from CROWD-08's parts B to G into the crowd module, added from its
own short list. Depends on: FEAT-04. Checks: each part's ported engine tests;
time comes from authored inputs only. If it runs long, it splits between the
areas and the rest. Writes: `src/features/crowd/**`. Parallel: with FEAT-06.
Redo: A31.

**FEAT-06 — The camera.** Delivers: §5's camera as a scene feature, following a
lead's main head or a crowd's centre, zoom stops on the followed route's
stops, the pure smoothing, the zoom warning. Depends on: FEAT-04. Checks: the
same instant shows the same view by play, seek and export (the DEF-05 and
DEF-07 pins inverted); a still view queues no frame; a camera edit is one
undo step; M1. Writes: `src/features/camera/**`; its catalogue lines on
merge. Parallel: with FEAT-05. Redo: A3 (round 2, Q5).

**FEAT-07 — Crowd areas placed freely.** Delivers: what round 2's Q7 decides
of "the full feature in v4" (provisionally: an area dragged off its point or
set by an offset, a point on its edge allowed, rectangle or ellipse). Depends
on: FEAT-05. Checks: seeded starts and ranked places stay inside an
off-point area; a project with one opens and saves unchanged. Writes:
`src/features/crowd/**`. Parallel: none. Redo: A23 (round 2, Q7).

### Phase 9 — presets and v4.0

**PRESET-01 — The five presets.** Delivers: New route from Blank or one of the
five (§12), each a starting point checked against the composed schema.
Depends on: Phase 8. Checks: a route made from each preset has the features
§12 lists. Writes: `src/editor/presets/**`. Parallel: none. Redo: A10.

**EX-01 — One scene for each preset, made and exported in v4.** As its item
file says: five built-in scenes on licensed backgrounds, each exported to
video and HTML and opened from disk; the steps to make each (M11). Depends
on: PRESET-01. Writes: `src/editor/examples/**`, `public/examples/**`, the
public-assets manifest, `tests/e2e/**`. Parallel: none. Redo: A10.

**A11Y-03 — Extended accessibility depth, before v4.0.** Delivers: the pack's
extended depth (Guidepup with VoiceOver, attended, on the owner's Mac after
his one-off permission grants), the five presets' journeys read aloud; its
evidence feeds REV-05. Depends on: EX-01; the owner. Writes:
`tests/a11y/extended/**`. Waits on the owner.

**REV-03 and REV-05** — as their item files say: the owner's evidence on
Android Chrome, NVDA or VoiceOver, forced colours and reduced motion. These two
existing assurance items are the owner's, not build items. Wait on the owner.

**V40-01 — Declare v4.0.** Delivers: the bar checked (Q24: one scene per
preset, made and exported in v4); the measures against v3's baselines; the
end of the publish-on-merge grant; the brief's v4.0 lines drafted for
signature; the after-v4.0 order of §12 put to the owner; Set 1 re-certified.
Depends on: A11Y-03, REV-03, REV-05. Waits on the owner's declaration.

### The order at a glance, and what runs side by side

| Step | Items | Side by side |
| --- | --- | --- |
| 6.1 | STACK-01 | — |
| 6.2 | STACK-02 | — |
| 6.3 | PUB-01, STACK-03 | yes |
| 6.4 | STACK-04 | — |
| 7.1 | CORE-01, GATE-02 | yes; GATE-02 may run on beside 7.2 |
| 7.2 | CORE-02, CORE-03 | yes |
| 7.3 | CORE-04 | — |
| 7.4 | CORE-05 | — |
| 7.5 | CORE-06, CORE-12 | yes |
| 7.6 | CORE-07, CORE-08 | yes |
| 7.7 | CORE-10, CORE-09 | yes |
| 8.1 | FEAT-01 | — |
| 8.2 | FEAT-02, FEAT-03, FEAT-04, CORE-11 | yes; catalogue lines added one merge at a time |
| 8.3 | FEAT-05, FEAT-06 | yes |
| 8.4 | FEAT-07 | — |
| 9.1 | PRESET-01 | — |
| 9.2 | EX-01 | — |
| 9.3 | A11Y-03, REV-03, REV-05 | the owner's |
| 9.4 | V40-01 | the owner's |

That is 28 build items (29 with GATE-02, added by PLAN-7), with the owner's two existing assurance items
(REV-03, REV-05) in Phase 9.

**Waiting on the owner:** his signature on the brief's redrafted sections
(§21), the profile's App opinion and Accessibility testing lines (STACK-02)
and v4's rules lines (STACK-04); whether Gary has the Xerte copy's address and
what the root `version.json` becomes (PUB-01, which neither holds up); A11Y-03's
VoiceOver permissions; REV-03's and REV-05's evidence; V40-01's declaration.
Everything else can be built overnight on the recommended options.

## 20. The phases, each to open by its own PLAN entry

| Phase | Direction | Items |
| --- | --- | --- |
| 6 — v4's foundations | v4 at the root on the editor stack, its own gate and edges enforced, before any feature; from STACK-02 on, each build published on the owner's advance word (PLAN-6, 2026-11-19) | STACK-01, STACK-02, PUB-01, STACK-03, STACK-04 |
| 7 — the core, end to end | Draw, play, save and reopen, export; autosave last, its storage having been the least settled; opened by PLAN-7 (2026-11-19), which adds GATE-02 beside the first items | CORE-01, GATE-02, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-12, CORE-07, CORE-08, CORE-10, CORE-09 |
| 8 — features as modules | The Add feature list and v4.0's features, each a module; the camera and free crowd areas last, being the least settled | FEAT-01, FEAT-02, FEAT-03, FEAT-04, CORE-11, FEAT-05, FEAT-06, FEAT-07 |
| 9 — presets and v4.0 | The five presets, a scene for each, the extended accessibility depth, v4.0 declared | PRESET-01, EX-01, A11Y-03, REV-03, REV-05, V40-01 |
| After v4.0 | What his answers place later, in §12's order | wishes PLAN-5.1 and EX-03.1; AI-01 (medium term); the candidates of §12 |

## 21. The brief's two v3 sections, redrafted for his signature

Unsigned drafts. `project/brief.md` keeps the signed text until he signs.

**What we are building** — new text:

> Route Plotter v4 — an animated route editor for maps and images. An author
> drops in a background image, draws one or more routes over it and plays the
> scene: on each route a lead travels from stop to stop, with labels, markers
> and pauses, and features the author adds build the story — a crowd of dots,
> arrival effects, highlighted areas, a background reveal, a line glow, and a
> camera that can follow a lead or a crowd. Five presets give a new route a
> starting set of features. The scene exports as MP4 or WebM video, or as a
> self-contained HTML player.
>
> v3, frozen at 3.3.726, is to stay as the teaching copy on Xerte: a hero route
> plus crowd layers over one master timeline, as its decided foundations
> describe.

**Platform and deployment** — new text:

> Web app. Single-page, client-side only. No server. Repo:
> `djDAOjones/route-plotter`. v4 is built at the repository's root; frozen v3
> lives in `v3/` and stays recoverable at tag v3.3.726. GitHub Pages serves
> `docs/` on `main` at `djdaojones.github.io/route-plotter/`: v4 from its
> first publish, made through PUB-01's step at any point on the owner's
> advance word, and then after each app item, until v4.0 (PLAN-6,
> 2026-11-19). v3 is also to be served from Xerte, from the 3.3.726 zip. The
> frozen v2 line remains at `djdaojones.github.io/router-plotter-02/`.

Redrafted on 19 November 2026 by PLAN-6 after his word on publishing (§22).
The draft as merged in #172 read, of Pages: "v3 until the first v4 build
whose core works end to end replaces it on the owner's call, then each app
merge he orders, until v4.0 (PLAN-5)".

**Direction's last sentence** — old: "The current work is the v4 programme
(PLAN-5): the architecture plan first, before any code." New: "The current
work is the v4 programme: v4's foundations (PLAN-6), then the core, its
features and presets, to v4.0."

**Direction's `main` sentence** — added on 19 November 2026 by PLAN-6, as
his word on publishing makes the signed sentence untrue. Old: "`main` is the
live site: branch, pull request, the owner orders each merge; once v4's core
works end to end, each app merge publishes until v4.0." New: "`main` is the
live site: branch, pull request, the owner orders each merge; v4 publishes at
any point and after each app item, until v4.0."

**Open questions** — the second entry, once his round is answered, becomes:
"None of the architecture plan's is open: its answers are in
`reviews/v4-plan-question-round-answers-2026-11-19.md`." His round is
answered (§22), so this now applies, awaiting his signature; until he signs
it stands as signed. (Changed on 19 November 2026 from pointing at this
plan, to point at the file that holds his answers.)

## 22. The owner's question round

MERGE-01's criteria say the owner answers one question round on the plan
before any code. On the night this plan was written he gave, in advance, a
different word for it (his grant G3, word for word in Appendix A): if the plan
was ready after 22:30, "building carries on overnight using the plan's
recommended options (Codex-reviewed), and each such decision goes on one list
for you to rule on in the morning". So the round below is put to him when he
is next available, building goes on meanwhile on the recommended options, and
each is recorded as provisional (section 18) with what would be redone if he
picks otherwise. This is a departure from the criterion, by his word, which
the PLAN-6 entry is to record.

**Answered.** He answered round 1 at about 22:35 UTC and round 2 at about
23:28 UTC on 18 November 2026, typing his own text each time, none of it an
option label; round 1 was shown to him in a shortened form, round 2 as
written below. His answers stand under each question, each with a reading
that is a proposal for him to confirm or correct. With what he was shown,
they are in `reviews/v4-plan-question-round-answers-2026-11-19.md`, and the
PLAN-6 entry of 2026-11-19 rules on them.

Written as he asks for them: up to four questions a round, each with a
recommendation first and its trade-off, in plain English. Round 1 holds the
questions whose answers the earliest items build on, and the two readings he
left unticked; round 2 the rest. The least settled work is placed last in the
build (section 19).

### Round 1

**Q1 — Scene length (A2b).** In v4 every time is saved as an exact time,
so changing one route never retimes another, and changing the length trims
the end, never stretches. Given that, how should the scene's length be set?
- "From what's in it, or fixed by me (Recommended)" — The scene runs until its
  last route, crowd or effect ends, plus Hold at end; a crowd that goes on for
  ever asks only for a set allowance (the time to cover each of its lines
  once). You may fix a length instead.
  Trade-off: a route longer than a length you fixed is cut until you lengthen
  it.
- "Always fixed by me" — Every scene has a length you set (a new one starts at
  10 seconds). Trade-off: you always know the length, but it is one more
  setting, and new content past the end is hidden until you raise it.
- "The first route sets it" — As v3's main route does. Trade-off: familiar,
  but it brings back a "main route" the merge removes.
- If overturned: a small change to the clock (CORE-02); stored times are
  unaffected.

**His answer** (typed about 22:35 UTC, 18 Nov 2026, shown the shortened form):
"scene ends when all animation has concluded (although some animation could be cyclical so will need a grace period or control for how long to last)"
Reading (a proposal, his to correct): the recommended option stands; animation that cycles needs a grace
period or a control for how long it lasts, which CORE-02 now carries as a
criterion and settles.

**Q2 — Route shape (A1).** Can one route start in several places, run both
ways along a street and go round a loop?
- "Yes, a route can be a network (Recommended)" — A new route is a simple
  line, and becomes a network only if you draw one. The lead follows fixed
  rules on it: it starts at one point you choose, takes every fork at once,
  takes each line at most once, and stops where a loop closes. A crowd uses
  all of it. Trade-off: those rules are one more thing to learn, and drawing
  gains two-way lines and loops.
- "A line with forks only" — A route has one start and may fork and rejoin,
  as v3's main route does; many approaches mean several routes. Trade-off:
  simpler, but a crowd cannot enter one route from several places or lap a
  ring road, and v3's Match day networks (10 entries) would not fit one route.
- If overturned: small, because the model is built general: a rule that
  refuses several starts, two-way lines and loops is added (CORE-01, CORE-06,
  FEAT-04).

**His answer** (typed about 22:35 UTC, 18 Nov 2026, shown the shortened form):
"recommendation good"
Reading (a proposal, his to correct): the recommended option stands.

**Q3 — v4's browser storage (A15).** You left this reading unticked: should
v4 keep browser storage of its own?
- "Its own storage (Recommended)" — v4 autosaves under names of its own and
  in its own image store, and never reads, changes or deletes v3's
  `routePlotter_*` saves. All your github.io sites share one browser storage
  space, so separate names are what keep them apart. Trade-off: someone moving
  from v3 to v4 at the same address does not see v3's unsaved work in v4; it
  stays in the browser, untouched.
- "No autosave in v4 yet" — v4 saves only to files until after v4.0.
  Trade-off: nothing can clash with v3, but closing a tab loses unsaved v4
  work.
- If overturned: only autosave and recovery change (CORE-09, placed late in
  Phase 7).

**His answer** (typed about 22:35 UTC, 18 Nov 2026, shown the shortened form):
"open to reccomendation but no backwards compatibility needed"
Reading (a proposal, his to correct): the recommended option stands; v4 need not read, import or migrate
v3's browser autosaves. A13 (older v4 files keep opening) is not changed by
it.

**Q4 — Xerte and the switch (A16).** You left this reading unticked. Your task
message of 18 November asked when Pages switches from v3 to v4, "ideally once
the v3 copy works on Xerte and Gary has its address" (Appendix A). Is that a
condition?
- "Yes, a condition (Recommended)" — The first v4 publish, already your call,
  waits until you confirm the Xerte copy works and Gary has its address.
  Trade-off: if Xerte is slow, v4 waits; I show progress by screenshots and a
  local run.
- "No, I'll judge at the time" — v4 replaces v3 at the first build whose core
  works end to end; I tell you where Xerte stands before that publish.
  Trade-off: an earlier review at the real address, but Gary could lose v3 at
  github.io before Xerte works.
- If overturned: nothing built is redone; only PUB-01's first-publish step
  changes, last in Phase 7.

**His answer** (typed about 22:35 UTC, 18 Nov 2026, shown the shortened form):
"Xerte copy works, progress with pages"
Reading (a proposal, his to correct): the condition's first half is met; he did not say whether Gary has the
Xerte copy's address. His word on publishing, below, then overturns A16
whole: the first publish waits for neither.

### Round 2

**Q5 — Where features live (A3, A4).** The full list is in §7, with a reason
for each. Do these homes stand?
- "The homes as listed (Recommended)" — The camera belongs to the scene: it
  follows a route's lead, with zoom changes at that route's stops, or a
  route's crowd, at one zoom (a crowd has no stops; zoom changes over time
  come after v4.0). A background reveal belongs to a route; arrival effects
  and highlighted areas belong to its stops. Trade-off: v3's per-waypoint
  camera settings move to the camera's panel and to the followed route's
  stops.
- "A camera on each route" — Each route has camera settings and one route is
  marked as the active camera. Trade-off: closer to v3, but several cameras of
  which only one matters.
- Under Other: correct any single home in §7.
- If overturned: the camera feature is redone (FEAT-06); a change to another
  home redoes that feature's schema and controls (FEAT-01, FEAT-02 or
  FEAT-03).

**His answer** (typed about 23:28 UTC, 18 Nov 2026, shown this wording):
"q5) as recommended"
Reading (a proposal, his to correct): the recommended option stands.

**Q6 — New features before v4.0 (A11).** Which new features join before
v4.0? (The one-by-one list is in §12.)
- "Only what v4 itself needs (Recommended)" — v4.0 is your five preset scenes,
  made and exported in v4. It brings v3's features across as modules, plus a
  few small things: inserting a point into a line and moving a point by arrow
  keys (which the new model needs), Hold at start, and crowd areas as Q7
  decides.
  After v4.0, in this order unless you change it: your own presets as a file,
  the riot march, vehicles as decoration, transit presets, several crowds on
  one route, destinations, marquee selection, the other movement ideas, per-
  leg tension. Trade-off: v4.0 leaves out the riot march scene, opening v3
  files, v3's example projects and v3's video fallback for other browsers.
- "Some now" — Name them under Other. Trade-off: v4.0 arrives later.
- If overturned: nothing is redone; items are added.

**His answer** (typed about 23:28 UTC, 18 Nov 2026, shown this wording):
"q6) as recommended"
Reading (a proposal, his to correct): the recommended option stands.

**Q7 — "The full area feature" (A23, CROWD-08.3).** You said of crowd areas
"the full feature in v4". What does full mean?
- "Placed freely (Recommended)" — A crowd's start or finish area can be
  dragged off its point or set by an offset, including a point on its edge;
  shapes stay rectangle and ellipse. Trade-off: a little more to build and
  test.
- "Placed freely, and drawn shapes" — As above, and an area may also be a
  shape you draw point by point. Trade-off: drawn shapes need their own
  drawing, editing and checks (where dots start inside an odd shape, how
  places are ranked in it), so v4.0 comes later.
- "As v3 has them" — Rectangle or ellipse, centred on its point. Trade-off:
  least to build; "full" waits.
- If overturned: only crowd areas are redone (FEAT-07, last in Phase 8).

**His answer** (typed about 23:28 UTC, 18 Nov 2026, shown this wording, its
last line naming FEAT-05, as written before that item was split):
"q7) as recommended"
Reading (a proposal, his to correct): the recommended option stands.

**Q8 — A repeating crowd (A24, DEF-95).** When a crowd repeats its journey on
a network, should each dot's lap look exactly the same every time, as it
already does on a simple route?
- "Every lap the same (Recommended)" — Each dot's sideways sway restarts with
  each lap, so its laps are identical. Trade-off: the sway can jump slightly
  where a lap ends and the next begins, and a long repeat can look mechanical;
  it does not by itself make a whole crowd's video loop seamlessly, since dots
  start at different times.
- "Each lap varies" — The sway carries on smoothly across laps, so no jump,
  but each lap differs (v3 does this on purpose today, for that smoothness).
  Trade-off: laps never line up.
- If overturned: the crowd's sway rule and its tests change (FEAT-04).

**His answer** (typed about 23:28 UTC, 18 Nov 2026, shown this wording):
"q8) as recommended for now, but future feature may include expressions that make it varied"
Reading (a proposal, his to correct): "Every lap the same" stands for v4.0; his addition is a wish for a
later feature (PLAN-6.1), and what "expressions" means is his to say when
that feature is planned.

### His word on publishing

Not a question of this round. Shown, with round 2, orchestrator 3's question
whether "build the publishing set-up, don't publish yet" was the right reading
of his "progress with pages", he answered at about 23:28 UTC, in the same
message:
"re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)"

Shown then that the first publish swaps working v3 at the github.io address
for v4 as it then stands, a near-empty page soon after STACK-02, with v3 kept
on Xerte and at tag v3.3.726, he replied at about 23:35 UTC:
"yes, publish, and I'm going to bed now, so hopefully no more pauses until 08:00"

Reading (a proposal, his to correct): his call, given in advance, for v4 to be published to Pages without
asking him again, at any point and after each work item, while publishing
causes no untoward delay or overhead; the first publish may replace v3 at the
github.io address. It goes only through PUB-01's step, which therefore moves
to straight after STACK-02 (§19), with every guard kept. It is not a v3
release, `npm run push`, a tag, a hand change to `docs/` or `version.json`,
or leave to skip the gate, Codex's review or PUB-01's guards. The signed
lines it makes untrue are redrafted for his signature (the brief's in §21,
the profile's Hosting line in the PLAN-6 entry), unchanged until he signs.

### Also for his signature, not a question

The brief's "What we are building" and "Platform and deployment" sections,
redrafted in section 21; they wait for his signature and stay unchanged in
`project/brief.md` until he signs.

## 23. Codex's review

Codex (gpt-6-astra), read-only, at its configured reasoning effort ("none"),
briefed from the record: the owner's three review files, PLAN-5, the item
files and the abstraction plan's §16. Claude built; Codex never wrote.

**Rounds 1 to 4: Part A and the question round, before they went to the
owner.**

- Round 1, REJECT, 11 findings, all applied: the grant G3 and the Xerte line
  were quoted from outside the repository (now Appendix A); the lead's walk on
  a graph was undefined (now §3's deterministic walk with three worked
  examples); a repeating crowd's end was undefined (§4); Q1 ran two choices
  together, and its units disagreed with §4 (split; exact times throughout);
  every module was handed the whole project, the context object §16.2 warns of
  (now a narrow, read-only input and a scoped setter, §8); the contract lacked
  branch-aware positions, a composition owner, the replaced pack rules and a
  walk-through (all added, §8); Q5 promised zoom stops when following a crowd
  and bundled four homes (reworded; any single home can be corrected); the
  candidate features were not weighed one by one (now §12's table); Q7 lacked
  drawn areas (now an option); Q8 promised seamless loops (reworded).
- Round 2, REJECT: seven fixed; four not, and three new (the §16 check lacked a
  comparison of unlike consumers; §13's promise on versions was unsafe for a
  newer file; the header and §22 stated pending records as facts). All
  applied: the two contracts on one base and the comparison in §8; newer
  versions refused whole (§13); pending records named as pending.
- Round 3, REJECT: all but two fixed; the repeating crowd's bound excluded a
  loop's closing line, and a separate "view" contact point had only one
  feature user, against the owner's Q12 condition. Applied: the bound covers
  every reachable line once; the view became part of P4, drawing, which the
  camera sets and the reveal reads.
- Round 4, APPROVE WITH FIXES: both fixed; one wording fix (the bound is an
  allowance, not a promise that every dot completes a journey), applied.

**Rounds 5 onwards: the whole plan, before the pull request merged.**

- Round 5, REJECT, 9 findings, all applied: tests are now ported assertion by
  assertion, and DEF-22's pin (`tests/branchAuthoring.test.js` :469) is
  listed; "what can be authored can be opened" has owners (CORE-06, CORE-12,
  each feature); the player closure is kept as narrow as §11.1's rule 3, and a
  failed evaluation returns a structured report; the export panel, the
  outline's mount and the scene's core panels have owners; shared files have
  one writer at a time; CORE-06 and FEAT-05 were each split (CORE-12, FEAT-07)
  and every item has checks of its own; the v3 build comparison was made
  executable; INTAKE.2's route reordering is weighed; counts, the composer's
  path, A1 against Q2 and §21's Xerte wording were made consistent.
- Round 6, APPROVE WITH FIXES: eight fixed, no new serious finding; one fix
  left, the comparison's second normalisation (the random staging folder
  names in `meta.json`) and keeping the build's output, applied.
- Round 7, APPROVE: the fix confirmed against `build.js`, and this record of
  rounds 5 and 6 found accurate; no new finding.
- Round 8, APPROVE: the summary's "Where it lives" corrected to agree with §14
  (v3 builds into `v3/`; the committed `docs/` untouched).


## Appendix A — the owner's words this plan relies on that are not yet in the repository

Kept word for word by the orchestrator in the session lane
(`JOE-TASK-MESSAGE-2026-11-18.txt`, `JOE-MESSAGE-2026-11-18-overnight.txt`,
`JOE-OVERNIGHT-GRANTS-2026-11-18.md`), outside this repository; copied here so
the record holds them. The questions and options are the orchestrator's
wording; each answer is the owner's.

From his task message of 18 November 2026, step 1's list of what the question
rounds must cover:

"how v4's previews reach GitHub Pages as it's built; when Pages switches from v3 to v4 (ideally once the v3 copy works on Xerte and Gary has its address); how v3 project files open in v4; and what v4 does with v3's browser autosaves, which stay with the github.io address (the routePlotter_* keys);"

His message of about 20:02 UTC on 18 November 2026, whole:

"please proceed as needed with route plotter development in automated fashion where possible. I am slightly confused what each chat is doing, which is the logical order, and what is needed from me. sub chats should be children of this chat, sub chats should be opus level and only fable if needed. I want development to be continuous, so flag any questions or permissions now, and accrue decisions that come up but dont stop dev unless impossible. I will check when I can, but go to bed around 22:30 and want dev to continue through the night. please plan for as many phases of work as possible."

Three of his answers of about 20:05 UTC, each an option label he picked, with
the option's text:

- G2, night merges. Answer: "Merge when checks pass (Recommended)". Option
  text: "A sub-chat may merge its own pull request into main when CI is green
  on the exact commit, Codex has approved it read-only and the record checker
  passes. Never auto-merge; nothing is published or released. Every merge is
  listed for you in the morning. Trade-off: work lands on main before you have
  read it; anything you dislike is undone by a new pull request."
- G3, this plan's question round. Question: "Your task says the architecture
  plan ends with your question round "before any code". The plan will
  probably be ready after 22:30. What should happen when it is?" Answer:
  "Proceed on recommendations (Recommended)". Option text: "If the plan is
  ready before 22:30 I bring you its questions. If not, building carries on
  overnight using the plan's recommended options (Codex-reviewed), and each
  such decision goes on one list for you to rule on in the morning.
  Trade-off: anything you overturn is redone."
- G4, PM-Skills. Answer: "Yes, read and install (Recommended)". Option text:
  "A read-only copy of tag v5.0.1 goes to a scratch folder and the pack's
  packages are installed at the versions it names. The pinned list is shown to
  you in the morning, not before installing. Trade-off: versions are pinned
  before you see them; changing one later is a small pull request."


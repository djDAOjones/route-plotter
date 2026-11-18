# The v4 vision and the owner's question rounds — 18 November 2026

This file is the word-for-word record of the owner's vision for v4 and of the
six rounds of questions put to him on 18 November 2026, before any plan was
written. His words are quoted exactly, typos included. The questions, the
options and the readings are the session's. A reading is a proposal until he
confirms it; the four he confirmed are in Q24. Nothing here is a decision: the
PLAN-5 decision entry, still to be written, cites this file.

The rounds ran in the clone at `main` 59d5a21, with nothing written to the
record until he had answered.

## The vision, in his words (18 Nov 2026)

"My vision is to rebuild or refactor the codebase to have have areas of abstraction where it would be useful for future development efficiency and quality (a lot more dev is planned over years). For the underlying routes to be a single entity with modular features (UI expands in step). The user start with a very simple set of controls and can add features to a route to expand the features and UI. There is a core that is always present. There are presets that folks can use as starting points that have some archtypes. I am happy to be questioned, challenged, and have gaps suggested."

## Already settled, in his words (18 Nov 2026)

- Who builds: "claude builds with codex astra as partner"
- The live site: "export the current site as a zip I can put on xerta, and then use github pages for the new site so progress can be reviewed"

His message added, of the second: the zip exists, build 3.3.726, the live
site's 24 files byte for byte, kept in his OneDrive project folder, not in this
repository.

Of pull request #167, a record-only change, he said on 18 Nov 2026: "lets bypass the checks this time, seems unnecessary".

## How to read the rounds

Each question is given as asked, then the options offered, then his answer.
Where he picked an option, his answer is that option's label and the option's
text carries the meaning; where he wrote his own text, it is marked so. Q1 to
Q24 number the questions across the rounds.

## Round 1 — the shape of the programme (asked and answered 18 Nov 2026)

### Q1 — Build route

Question, as asked: Your vision says "rebuild or refactor". The record says
refactor: the adopted abstraction plan (22 Sep) says "Never rewrite", and
REFACTOR-01 (your words of 14 Oct) puts a no-behaviour-change refactor of v3
before the merge. But your vision changes the two things v3's code is hardest
to change in: the route model, and an interface that grows. Which way should
v4 be built?

Options offered:
- "New shell, kept engine (Recommended)" — Write v4's route model and interface
  fresh, beside v3, and move v3's proven drawing, timing, crowd, export and
  file-safety code across with its tests. Trade-off: it overrules "Never
  rewrite"; v4 lacks each v3 option until it is rebuilt; REFACTOR-01 shrinks to
  the parts v4 keeps.
- "Staged refactor in place" — v3 is reshaped step by step into v4 and stays
  releasable throughout, as the record says now. Trade-off: safest for Gary but
  slowest; months go into tidying interface code that the new design then
  replaces.
- "Clean rebuild" — Everything is written new, with v3 used only as a
  reference. Trade-off: the cleanest design, but it throws away fixes that
  4,385 tests protect (timing, file safety, export) and carries the highest
  risk of never catching up with v3.

Joe's answer (his own text, not an option), verbatim:

"Rebuild v4 as a new app with the full PM-Skills stack from the start: the app opinion (editor), accessibility testing at AAA, and the architecture record. Port v3's engine (drawing, timing, crowds, export, file safety) into it with its tests rather than rewriting it; the architecture plan decides piece by piece where a port isn't worth it. This overrules "Never rewrite"; shrink REFACTOR-01 to match. Encapsulate wherever it makes development easier long term: each feature a module that owns its settings, drawing, controls, save fields and tests; layers and module edges enforced in the gate, not just written down; and §16's test applied to every new abstraction. Show me measures I can check, for example that adding a feature touches only its own module."

### Q2 — v3's fate

Question, as asked: The v3 zip (build 3.3.726) is made for Xerte. The backlog
still holds 54 open lines, nearly all v3 work: 3 live defects (DEF-15, DEF-19,
DEF-22), 32 found defects, 6 dead-code items and 3 design reviews. What happens
to v3 while v4 is built?

Options offered:
- "Freeze v3 now (Recommended)" — v3 stays at 3.3.726. A fix happens only when
  something blocks Gary's teaching, on your word each time, and each one means
  a new zip for Xerte. Open v3 defects become checks v4 must pass, or are
  retired on your word in the stock take. Trade-off: known defects stay in the
  app Gary uses.
- "Fix live defects, then freeze" — Fix DEF-15, DEF-19 and DEF-22 in v3,
  release, remake the zip, then freeze. Trade-off: v4 starts later, and the zip
  you have made is replaced.
- "Keep fixing v3 alongside" — v3 defects carry on being fixed while v4 is
  built. Trade-off: effort is split, two apps go through the gate, and every v3
  release needs a new zip.

Joe's answer, verbatim (an option label): "Freeze v3 now (Recommended)"

### Q3 — Preview site

Question, as asked: You said to "use github pages for the new site so progress
can be reviewed", ideally switching once the v3 copy works on Xerte and Gary
has its address. My challenge: the github.io address is public, so anyone
holding the link would land on a half-built v4. Where should v4's previews
appear while it is built?

Options offered:
- "Side address first (Recommended)" — Previews go to a side address on the
  same site (for example .../route-plotter/v4/). v3 stays at the main address
  until v4 is ready to replace it. Trade-off: for a while v3 lives in two
  places (Pages and Xerte), and the release script needs a small, decided
  change to publish the side folder.
- "Take over once Xerte works" — As soon as the Xerte copy works and Gary has
  its address, the main address becomes the v4 preview, with a notice pointing
  to v3 on Xerte. Trade-off: simplest to run, but visitors meet an unfinished
  app, and the v3 autosaves in their browser cannot be reached by the Xerte
  copy.

Joe's answer (his own text, not an option), verbatim:

"half build v4 is ok, use pages as is"

### Q4 — v4.0 bar

Question, as asked: The vision does not say when v4 is good enough to replace
v3. Without a bar, a rebuild's biggest risk is chasing everything v3 does and
never arriving. What must v4.0 do before it takes over from v3?

Options offered:
- "The teaching scenes (Recommended)" — v4.0 is reached when it can make and
  export the five built-in scenes (Site walk, Open day route, Signal flow,
  Match day, Reform riot 1831) and open v3 project files. Other v3 options
  return afterwards as add-on features, in an order you set. Trade-off: some v3
  options are missing at the switch; v3 on Xerte covers them.
- "Everything v3 does" — v4.0 waits until every v3 option is rebuilt.
  Trade-off: nobody loses anything, but it is the longest wait and rebuilds
  options that may never be used.
- "Core and a few features" — v4.0 is the always-present core plus a first
  handful of features; the rest follow. Trade-off: fastest to real use and
  feedback, but Gary keeps returning to v3 for longer.

Joe's answer, verbatim (an option label): "The teaching scenes (Recommended)"

### The session's readings of round 1 — proposals, not yet confirmed by Joe

- Q1: v4 is a new app; v3's engine is ported with its tests, not rewritten; the
  architecture plan rules piece by piece on what is not worth porting; the
  abstraction plan's "Never rewrite" is overruled for v4; REFACTOR-01 narrows.
  "the full PM-Skills stack" names three things (app opinion "editor", AAA
  accessibility testing, the architecture record) whose meaning in pm-skills
  5.0.1 the session still has to check in the repository.
- Q3: Pages keeps its present set-up (docs/ on main, the main address), and v4
  previews are published there in place of v3; no side address. Open for round
  4: the trigger (the Xerte copy working and Gary having its address), a notice
  pointing to v3, and the v3 autosaves.
- Q4 with Q3: the main address shows v4 before v4.0; "v4.0" is then the
  milestone at which v4 is declared ready for teaching, not the switch itself.

## Round 2 — what follows from round 1 (asked and answered 18 Nov 2026)

### Q5 — v4's home

Question, as asked: You chose a new app with the full PM-Skills stack.
PM-Skills' own rule says the app opinion is for new web apps and "an existing
repository is never retrofitted" except by its own decision, and you also said
"use pages as is". Where should the v4 app live?

Options offered:
- "This repo, v4 at the root (Recommended)" — v4 takes the root of
  route-plotter so the PM-Skills helpers install cleanly; v3's source moves
  into a v3/ folder as the porting reference and stays recoverable at tag
  v3.3.726. One record, one history, the same Pages address. Trade-off: your
  word is the exception to "never retrofitted"; one large move; the signed
  profile and rules are largely rewritten for v4, for you to re-sign.
- "A new repository" — v4 starts in a fresh repository with a clean PM-Skills
  intake, as v3 did in August; this one stays as frozen v3. Trade-off: the
  cleanest fit and a new record with room in its budgets, but the record splits
  in two, kept backlog lines must be carried across, and "use pages as is" then
  needs a repository rename or a redirect.
- "This repo, v4 in a folder" — v4 sits in its own folder beside v3's untouched
  source. Trade-off: least disturbance to v3, but the PM-Skills helpers expect
  the app at the root, so v4's lint, type and test set-up would collide with
  v3's and need fitting by hand.

Joe's answer, verbatim (an option label): "This repo, v4 at the root (Recommended)"

### Q6 — The stack

Question, as asked: The editor app opinion brings its own signed stack. From
this repository I can see it includes strict TypeScript, lint, a boundaries
check and accessibility tests, but no pack is installed here, so its full list
(any UI framework included) is not in this repository, and rule 2 bars me from
fetching a record from outside it. It would overrule the brief's "Pure
JavaScript, no frameworks" and "two bundled runtime dependencies". How should
the framework and type-checker decisions be made?

Options offered:
- "Read the pack, then ask (Recommended)" — You allow me to read the PM-Skills
  5.0.1 source on this Mac (give its folder under Other, or I look in ~/Code).
  I then put the framework and type-checker question to you with the stack's
  real contents and what each part overrules. Trade-off: one more question
  later, but you decide on the facts, not on my guess.
- "Take the stack as signed" — The editor opinion's stack is adopted whole for
  v4, whatever it lists; I record each package as approved by this word and
  name what it overrules in the brief and rules. Trade-off: fastest, but I
  would be recording dependency approvals without having shown you the list.
- "Tooling now, UI layer later" — Adopt the type checker, lint, boundaries
  check and accessibility tests now; the architecture plan weighs the UI
  framework and brings it to you. Trade-off: the biggest dependency choice gets
  a reviewed case, but the plan starts with one unknown.

Joe's answer, verbatim (an option label): "Read the pack, then ask (Recommended)"

### Q7 — The switch

Question, as asked: You answered "half build v4 is ok, use pages as is". I read
that as: the main github.io address becomes the v4 preview, with no side
address. When does the first v4 preview replace v3 there?

Options offered:
- "On your word, after Xerte (Recommended)" — v3 stays at the main address
  until you tell me the Xerte copy works and Gary has its address. The next
  preview then replaces it, and every v4 preview carries a line linking to v3
  on Xerte. Trade-off: the first previews may wait on Xerte; until then I show
  you v4 by screenshots and a local run.
- "At the first preview" — The first v4 preview replaces v3 as soon as it
  exists, whatever state Xerte is in. Trade-off: the earliest review at the
  real address, but if Xerte is not ready, Gary has no working v3 beyond the
  zip.

Joe's answer (his own text, not an option), verbatim:

"once it's releasable"

### Q8 — Autosaves

Question, as asked: Anyone who used v3 at the github.io address has autosaves
in their browser there (the routePlotter_* keys). The Xerte copy cannot see
them, because browsers keep storage per site; v4 at the same address can. What
should v4 do with them?

Options offered:
- "Rescue, never delete (Recommended)" — v4 keeps its own storage, never
  changes or deletes v3's, and on first run offers any v3 autosave it finds as
  a download in v3's project format, which opens in v3 on Xerte and, once the
  converter exists, in v4. Trade-off: this small rescue must exist before the
  first preview replaces v3, so it is among the first things built.
- "Open them in v4 directly" — v4 reads the v3 autosave and opens it as a v4
  project. Trade-off: the nicest for the user, but it depends on the v3-to-v4
  converter, which will not exist for the early previews.
- "Leave them alone" — v4 ignores v3's storage and offers nothing. Trade-off:
  nothing to build, but a user's unsaved v3 work becomes unreachable without
  developer tools.

Joe's answer, verbatim (an option label): "Leave them alone"

### The session's readings of round 2 — proposals, not yet confirmed by Joe

- Q5: v4 is built in this repository at its root; his word is the "own
  decision" PM-Skills asks for to adopt the app opinion in an existing
  repository. Moving v3's source into v3/ was the option's wording, the
  session's; the architecture plan settles the mechanics.
- Q6: permission to read the PM-Skills 5.0.1 source on this Mac, looked for in
  ~/Code, and a framework and type-checker question owed to him afterwards.
- Q7: "once it's releasable" is not yet clear to the session: either the first
  v4 build fit to release (it runs and passes its gate, on his call), or v4.0
  (the teaching scenes). To be asked.
- Q8: v4 neither reads, changes nor deletes the routePlotter_* keys. The
  session's proposal that follows: v4 stores under key names of its own, so
  the two never collide.

## Round 3 — the model (asked and answered 18 Nov 2026)

### Q9 — The core

Question, as asked: You said "There is a core that is always present" but not
what is in it. Too small and a beginner must add things before anything
happens; too large and it is v3 again. What should the always-present core be?

Options offered:
- "Smallest useful core (Recommended)" — Scene: a background, play and scrub,
  save and open, export. Route: points, a styled line, and one thing moving
  along it over a set time. Everything else (labels, markers, beacons, pauses,
  camera moves, areas, branches, many dots) is a feature. Trade-off: labels and
  pauses, which many would call basic, are one step away; presets soften that.
- "Core with storytelling basics" — The same, plus waypoint labels, markers and
  pauses always present. Trade-off: closer to v3's first impression, but the
  starting panel is two or three times larger and those parts can never be
  removed.
- "Scene only" — Even a route's line and motion are features. Trade-off: the
  purest modular design, but a new route does nothing, and a beginner faces a
  choice before seeing any result.

Joe's answer, verbatim (an option label): "Core with storytelling basics"

### Q10 — Scene or route

Question, as asked: Which features belong to the scene rather than to a route?
In v3 the camera, the reveal modes and the scene's length all hang off the one
hero route, which is what stopped a crowd's path carrying the camera. With
several routes in v4, whose camera wins?

Options offered:
- "One of each is the scene's (Recommended)" — The scene owns what there is
  exactly one of: the background, the camera, the clock (total length, hold at
  end) and export. A route owns what is drawn or timed along its own line. The
  camera can follow or frame any route but is not part of one. Trade-off: v3's
  per-waypoint camera and reveal settings must be converted into scene settings
  that point at a route.
- "Keep them on the route" — Camera moves, reveals and areas stay settings of a
  route's waypoints, as in v3. Trade-off: familiar and easier to convert, but
  with several routes it is unclear whose camera and whose timing win.

Joe's answer (his own text, not an option), verbatim:

"do what makes intuitive sense from a user point of view for a given case"

### Q11 — One route

Question, as asked: How should routes and crowds become one thing? Three real
differences do not vanish by renaming: a route's legs are timed by the author
while crowd dots are released and paced by rule; at a fork a route plays every
branch at once while each crowd dot picks one way; and today the route sets
the scene's length.

Options offered:
- "One route, travellers as features (Recommended)" — A route is only
  geometry: points, lines and forks. What moves along it is a feature: a single
  lead (timed leg by leg, with pauses), a crowd (released over time, each dot
  choosing a way), or both on the same route. Trade-off: the fork difference
  stays, moved into the two features, and the author must still learn that a
  lead and a crowd behave differently there.
- "Everything is a crowd" — A v3 route becomes a crowd of one. Trade-off: the
  simplest model, but leg-by-leg timing and pauses, which storytelling routes
  rely on, have to be rebuilt on crowd rules and may feel less direct.
- "Two kinds, shared tools" — Routes and crowds stay different kinds that share
  one pen and one vocabulary. Trade-off: least risk, but it keeps the
  two-things confusion you set out to remove.

Joe's answer, verbatim (an option label): "One route, travellers as features (Recommended)"

### Q12 — Feature links

Question, as asked: How should features depend on and talk to each other (a
camera following a crowd, labels on waypoints, pauses stretching the timeline)?
You asked for a measure such as "adding a feature touches only its own module",
and the abstraction plan's §16 warns against a generic registry built for
imagined future uses.

Options offered:
- "Through the core only (Recommended)" — Features never call each other. The
  core offers a few fixed contact points (a route's shape, its position at a
  time, the clock, draw order, the save file), each used by at least two real
  v4.0 features. A feature declares what it needs and adds; everything stays a
  pure function of time, as the founding decision requires. Trade-off: dots
  that react to each other live stay out, and the contact points must be right
  early, since changing one later touches every feature.
- "Features may use each other" — A feature can call another directly, for
  example the camera asking the crowd where it is. Trade-off: quicker at first,
  but dependencies tangle and your measure cannot hold.

Joe's answer, verbatim (an option label): "Through the core only (Recommended)"

### The session's readings of round 3 — proposals, not yet confirmed by Joe

- Q9: the core is the scene (background, play and scrub, save and open,
  export) and a route (points, a styled line, one thing moving along it over a
  set time), with waypoint labels, markers and pauses always present.
- Q9 against Q11: Q9's core has "one thing moving" and pauses always present,
  while Q11 makes the lead a feature. The session's reading, for him to
  confirm: the single lead with its pauses is the always-present traveller; a
  crowd is the traveller feature an author adds. The architecture plan settles
  it.
- Q10: no blanket rule. The architecture plan decides feature by feature where
  each lives, by what an author would expect, and brings him the list with the
  reason for each.
- Q12: the founding decision's pure-function-of-time mandate stands in v4.

## Round 4 — delivery (asked and answered 18 Nov 2026)

### Q13 — Releasable

Question, as asked: Asked when v4 replaces v3 at the main github.io address,
you answered "once it's releasable". What makes a v4 build releasable?

Options offered:
- "The core works end to end (Recommended)" — The first build in which an
  author can draw a route, play it, save and reopen it, and export it, passing
  v4's gate, released on your call. Later previews add features. Trade-off: the
  main address waits some weeks for its first v4, and I show you earlier
  progress by screenshots and a local run.
- "First build that runs" — The first v4 build that starts and passes its gate
  replaces v3, however little it does, on your call. Trade-off: the earliest
  review at the real address, but visitors may find an app that can do almost
  nothing.
- "v4.0, the teaching scenes" — v3 stays at the main address until v4 can make
  and export the five built-in scenes. Trade-off: no visitor meets a half-built
  app, but it sets aside "half build v4 is ok" and you would review progress
  some other way.

Joe's answer, verbatim (an option label): "The core works end to end (Recommended)"

### Q14 — v3 files

Question, as asked: How should v3 project files open in v4? v3 writes format 9
and still opens formats 6 to 8, and the brief has an open question of yours on
dropping older formats.

Options offered:
- "Convert on open, one way (Recommended)" — v4 opens a format 9 file through
  one tested converter and lists anything it could not carry, never dropping it
  silently. v4 saves only its own format, written schema-first as AI-01
  proposed. Formats 6 to 8 are re-saved in v3 first. The five built-in scenes
  are the converter's test set. Trade-off: a file using a feature not yet
  rebuilt opens only in part, and there is no saving back to v3.
- "Convert every format v3 opens" — As above, but the converter also takes
  formats 6 to 8 directly. Trade-off: nobody needs v3 to rescue an old file,
  but three more formats to test for files that may no longer exist.
- "v3 files stay with v3" — v4 does not open v3 files; a scene is rebuilt by
  hand. Trade-off: nothing to build, but Gary's existing projects are stranded
  in the Xerte copy.

Joe's answer, verbatim (an option label): "v3 files stay with v3"

### Q15 — Preview rhythm

Question, as asked: How often do you want to see a new v4 preview on Pages?
Today a merge releases nothing and only you call a release.

Options offered:
- "Each finished item, your call (Recommended)" — When an item that changes
  what you can see or do is finished and green, I offer a preview with a short
  list of what is new and what to try; you call it. Probably every few days
  while building. Trade-off: an uneven rhythm, and two words from you per item
  (merge, then release).
- "Every merge publishes" — Until v4.0, each merge you order also publishes the
  preview, as a standing grant. Trade-off: Pages is always current with one
  word from you, but it relaxes "a merge releases nothing", and a merged
  mistake is public at once.
- "Weekly" — A preview on a fixed day each week, on your call. Trade-off:
  predictable, but it can hold back finished work or arrive with little new.

Joe's answer, verbatim (an option label): "Every merge publishes"

### Q16 — Pack source

Question, as asked: You allowed me to read the PM-Skills 5.0.1 pack, but it is
not in ~/Code (only route-plotter is there) and this repository does not say
where its source lives. Your GitHub account has a private repository named
PM-Skills. Where should I read the pack from?

Options offered:
- "Clone PM-Skills at v5.0.1 (Recommended)" — I clone djDAOjones/PM-Skills at
  tag v5.0.1 into a scratch folder outside this project, read the app,
  accessibility and architecture parts, and install nothing. Trade-off: one
  read from outside this repository, on your word. If it lives in a folder on
  this Mac instead, give the path under Other.
- "Ask without the pack" — I put the framework and type-checker question from
  what this repository's intake verb says alone. Trade-off: no outside read,
  but you decide without the stack's list in front of you.

Joe's answer, verbatim (an option label): "Clone PM-Skills at v5.0.1 (Recommended)"

### The session's readings of round 4 — proposals, not yet confirmed by Joe

- Q13 with Q7 and Q3: v3 stays at the main address until the first v4 build in
  which the core works end to end (draw, play, save and reopen, export) passes
  v4's gate; that build replaces v3 there. Before it, he sees progress by
  screenshots and a local run. The Xerte copy's readiness is not a condition he
  chose; the session will still say so before that first publish.
- Q14 against Q4: Q4's option said v4.0 can "open v3 project files"; Q14, the
  later answer, says v4 does not open them. The session's reading: Q14
  governs. v4.0's bar is the five built-in scenes made and exported in v4,
  rebuilt by hand; v3 projects, v3 exports and v3 autosaves (Q8) stay with v3
  on Xerte. MERGE-01's criterion on how v3 projects carry over is answered:
  they do not. The brief's open question on older formats no longer bears on
  v4.
- Q15: a standing grant, until v4.0, that each merge he orders also publishes
  the preview. It relaxes the rules' "Only `npm run push` commits `docs/` and
  `version.json`" and the profile's "a merge releases nothing", so the PLAN
  decision must state its conditions and the signed lines change on his
  signature. Open: whether a record-only merge publishes (nothing visible
  changes), and that the grant starts only at Q13's first build.
- Q16: permission for one read of djDAOjones/PM-Skills at tag v5.0.1, cloned
  to a scratch folder outside the project; nothing installed.

## Round 5 — the interface and presets (asked and answered 18 Nov 2026)

### Q17 — Adding

Question, as asked: How should an author find and add a feature, and how does
that stay accessible as the panel grows? Your earlier words pictured "a
features pop up to add options and corresponding interface controls".

Options offered:
- "An Add feature list (Recommended)" — Each route, and the scene, has one Add
  feature button opening a searchable list grouped by purpose, each entry with
  a one-line description. Added features appear as sections in a fixed order,
  whatever order they were added; adding one is announced and moves keyboard
  focus to it. Trade-off: a beginner must learn to look there, and authors
  cannot reorder the panel.
- "Show everything, switched off" — Every feature is always listed, greyed
  until switched on. Trade-off: nothing is hidden, but it is the long panel v3
  has, which the vision set out to shorten.
- "Suggest as you work" — The app offers features from what the author does,
  for example a camera once a route is long. Trade-off: helpful when right, but
  unpredictable, hard to teach from, and harder to make accessible.

Joe's answer, verbatim (an option label): "An Add feature list (Recommended)"

### Q18 — Removing

Question, as asked: What should removing a feature from a route do to its
settings, and to anything that depends on it?

Options offered:
- "Hide it, keep its settings (Recommended)" — Removing stops the feature
  drawing and takes its controls away, in one undo step, but its settings stay
  in the project so adding it back restores them; a separate action deletes
  them for good. If another feature depends on it, the app names it and asks
  first. Trade-off: a saved project still carries settings for features the
  author removed.
- "Remove means delete" — The feature's settings are deleted from the project;
  only undo brings them back. Trade-off: project files hold only what is in
  use, but a removal after the undo history is gone loses work.

Joe's answer (his own text, not an option), verbatim:

"hide it during the session for undo, but dont save it"

### Q19 — Presets

Question, as asked: Which presets should v4 start with? I read a preset as a
starting point for one route: a named set of features with sensible settings,
while the built-in examples stay as whole demonstration scenes. The teaching
tasks on record are a site walk, an open-day route, a match-day crowd, the 1831
riot march and signal flow. The names below are mine.

Options offered:
- "Four from the record, plus Blank (Recommended)" — Journey (one lead with
  labels and pauses), Arriving crowd (many dots converging on a place), March
  (a group moving along a road), Flow (a steady stream through a network), and
  Blank (the core alone). EX-01's examples overhaul folds in: each example
  shows one preset. Trade-off: drawn from Gary's tasks so far, so perhaps
  narrow for other educators.
- "Two to begin" — Journey and Crowd only; March and Flow are made by hand
  from Crowd. Trade-off: less to build and keep working, but authors do more
  set-up for the commonest crowd scenes.
- "Ask Gary first" — Hold the list until Gary names the scenes he wants to
  teach with. Trade-off: presets come from the real user, but the list waits on
  him and v4.0's bar may move.

Joe's answer (his own text, not an option), verbatim:

"Map route; document reveal; signal flow; annotated diagram; match-day crowd"

### Q20 — Own presets

Question, as asked: Should authors be able to save their own presets?

Options offered:
- "Yes, as a file, after v4.0 (Recommended)" — Once v4.0's features have
  settled, an author can save a route's features and settings as a small preset
  file to reuse or hand to students. Trade-off: preset files become a second
  format to keep working across versions, which is why it waits.
- "Yes, in v4.0" — Saving presets ships with v4.0. Trade-off: useful sooner,
  but the preset format is fixed while features are still changing.
- "No, built-in only" — Only the built-in presets exist; an author copies a
  route from an old project instead. Trade-off: nothing extra to build or keep
  compatible, but no way to share a house style.

Joe's answer, verbatim (an option label): "Yes, as a file, after v4.0 (Recommended)"

### The session's readings of round 5 — proposals, not yet confirmed by Joe

- Q17: one Add feature list per route and for the scene; sections in a fixed
  order; adding is announced and moves focus.
- Q18: removing a feature hides it and keeps its settings in memory for the
  session, so undo, and adding it back in the same session, restore them; a
  saved project holds nothing for a removed feature. He did not answer the
  question's second half, what happens to a feature that depends on the
  removed one; the option's "names it and asks first" is the session's
  proposal.
- Q19: the five presets are his, in his words: "Map route", "document reveal",
  "signal flow", "annotated diagram", "match-day crowd". "document reveal" and
  "annotated diagram" are new to the record; what each shows is put to him in
  round 6. The 1831 riot march and a Blank preset are not in his list. Whether
  a preset is a starting point for one route (the question's reading) he did
  not contradict.
- Q20: saving a preset as a file comes after v4.0.

## Round 6 — the stack, the gate and four readings (asked and answered 18 Nov 2026)

Before this round the session read, on his word (Q16), djDAOjones/PM-Skills at
tag v5.0.1, build fd5fb94, cloned to a scratch folder outside the project:
`pm_skills/app/project/digests/app-opinion.md`, `pm_skills/app/package.fragment.json`
and `pm_skills/a11y/package.fragment.json`. Nothing was installed or copied.

### Q21 — The stack

Question, as asked: I read the PM-Skills 5.0.1 pack (build fd5fb94). The editor
opinion's stack is: three new runtime packages (React 19, React DOM, Carbon
React) and, for development, strict TypeScript, Vite, Vitest, ESLint, knip
(dead code), dependency-cruiser (boundaries), fast-check, Sass and IBM Plex
fonts; the exported player stays free of React and Carbon. It overrules the
brief's "Pure JavaScript, no frameworks", "two bundled runtime dependencies"
(they become five), Carbon "implemented, not installed", and esbuild. Do you
adopt it for v4?

Options offered:
- "Adopt the editor stack whole (Recommended)" — Every package above becomes
  the project's own dependency by this word; exact versions are pinned by the
  item that installs them and shown to you then. Trade-off: a larger download,
  React's and Carbon's releases become upkeep, and Carbon React is built for
  AA, so its colours and targets must be pushed to your AAA bar.
- "Tooling only, for now" — Take TypeScript, lint, boundaries, dead-code and
  tests now; the architecture plan weighs React and Carbon React and brings you
  a reviewed case. Trade-off: the biggest dependency choice is reviewed first,
  but the plan starts with one unknown and sets the editor opinion's lines
  aside for a while.
- "React, our own Carbon" — React and the tooling, with Carbon-style controls
  kept in our own code as in v3. Trade-off: AAA stays wholly in our hands and
  the download is smaller, but standard controls are rebuilt by hand, and it
  departs from your signed opinion, which you would sign as a decision.

Joe's answer, verbatim (an option label): "Adopt the editor stack whole (Recommended)"

### Q22 — A11y depth

Question, as asked: You asked for "accessibility testing at AAA". The pack
offers two depths at that level. Which?

Options offered:
- "Standard now, extended before v4.0 (Recommended)" — From the start:
  automated checks in a real browser (Playwright and axe) and accessibility
  lint rules, as part of the gate. Before v4.0 is declared: the extended depth,
  which also drives a screen reader (Guidepup with VoiceOver). Trade-off:
  screen-reader faults are found later than they could be; extended needs
  VoiceOver permissions that only you can grant on this Mac.
- "Extended from the start" — Screen-reader runs from the first interface
  work. Trade-off: the earliest evidence, but two more packages and Mac-only
  runs before there is much interface to test.
- "Standard only" — Browser checks and lint; screen-reader evidence stays your
  own manual check, as REV-05 is today. Trade-off: lightest, but an AAA claim
  rests on manual checks that have been waiting since October.

Joe's answer, verbatim (an option label): "Standard now, extended before v4.0 (Recommended)"

### Q23 — The gate

Question, as asked: The gate takes about 34 minutes a push because v3's 4,385
tests run one file at a time (2,139 of CI's 2,260 seconds are inside the tests;
a parallel run breaks, wish INTAKE.18). A record-only change cannot alter the
app, so in my view it does not need the app suite. What should the gate be?

Options offered:
- "Gate by what changed (Recommended)" — Record-only changes run the record
  checker alone (seconds). v4 changes run v4's gate: types, lint, boundaries,
  dead code, tests in parallel, build and accessibility checks, with a
  10-minute budget that is a finding if exceeded. v3's suite runs only when
  frozen v3 code changes. Anything not clearly record-only gets the full gate.
  Trade-off: the sorting rule is itself code that can be wrong, and the signed
  Gate line changes.
- "One gate, v3's suite made parallel" — Fix the parallel-run fault and keep
  running everything on every push, perhaps 10 minutes. Trade-off: no sorting
  rule to trust, but it spends work on frozen v3 code and a record-only change
  still waits.
- "Leave the gate as it is" — Every push runs everything, about 34 minutes.
  Trade-off: nothing changes or can be mis-sorted, but each record-only pull
  request, this one included, waits half an hour.

Joe's answer, verbatim (an option label): "Gate by what changed (Recommended)"

### Q24 — Readings (he could tick any number)

Question, as asked: Four of my readings of your answers need your yes. Tick
each one that stands; leave unticked any that is wrong, and say why under Other
if you wish.

Options offered:
- "The lead is in the core" — You chose a core with labels, markers and pauses,
  and travellers as features. I read: every route always has its single lead
  with those basics; a crowd is the traveller an author adds.
- "v4.0's bar follows your presets" — You chose "v3 files stay with v3" after a
  bar that mentioned opening them. I read: v4.0 is reached when one scene for
  each of your five presets is made and exported in v4; v4 never opens a v3
  file; the riot march returns later.
- "Record-only merges publish nothing" — "Every merge publishes" covers merges
  that change the app, and starts with the first build in which the core works
  end to end; a record-only merge publishes nothing.
- "Your two new presets" — Document reveal: an image of a document uncovered
  step by step as a route passes over it. Annotated diagram: a still diagram
  whose labels, markers and highlighted areas appear in sequence, with little
  or no travel.

Joe's answer, verbatim (all four ticked): "The lead is in the core,v4.0's bar follows your presets,Record-only merges publish nothing,Your two new presets"

### The session's readings of round 6 — proposals, not yet confirmed by Joe

- Q21: the brief's Constraints, the profile's Runtime, Dependencies and Carbon
  lines and the rules' runtime-dependency line all change for v4, on his
  signature; jszip and mediabunny carry over with the ported export code,
  which the architecture plan confirms. Versions in the pack are candidates,
  not pins. If v4 is the first app under PM-Skills' app flag, the pack says its
  set is pinned at that intake and a pilot row is dated before the first
  session: for him to say.
- Q22: the profile gains "Accessibility testing: standard", level AAA, and the
  change to extended is a step before v4.0 is declared.
- Q23: the faster gate is itself a change to `.github/workflows/ci.yml` and
  `package.json`, so it is an early item of the programme, not part of this
  record-only change; the profile's Gate line is redrafted for his signature.
- Q24: confirmed by him, so no longer proposals: the lead with labels, markers
  and pauses is the core's traveller; v4.0's bar is one scene per preset, made
  and exported in v4, with no v3 file opened and the riot march later; a
  record-only merge publishes nothing and the publish-on-merge grant starts at
  the first core-works build; the meanings of "document reveal" and "annotated
  diagram" as worded in the options.

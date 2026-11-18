# The stock take against the v4 vision — 18 November 2026

This file records the stock take the owner ordered on 18 November 2026 under
`verbs/stocktake.md`: every open backlog line and wish given one disposition
against his v4 vision (`reviews/v4-vision-question-rounds-2026-11-18.md`, whose
Q1 to Q24 are cited below), his ruling word for word, and every line that left
the backlog or the wish list, kept word for word. His words are quoted exactly.
The questions, options and readings are the session's; a reading is a proposal
until he confirms it.

## The owner's request, word for word

"3. Take stock of every open backlog line and wish with verbs/stocktake.md; this is my word to run it here. Give each line one disposition against the vision. Retire nothing without my word."

## Method

- Census pinned at commit `5b0493f`: 54 open backlog lines and 141 wishes, 195
  IDs, none twice. v3's code had not changed since tag `v3.3.726`.
- First pass: each line checked at source (its item file, decision, code or
  test) and given one disposition. Sealed by digest before any other answer
  was read:
- `774e3d735cfb5b96…` firstpass-A.txt
- `a197d0412d67b3f1…` firstpass-B.txt
- `a89dec90ebce7322…` firstpass-C.txt
- `865e2fa58a62e58e…` firstpass-lead-overrides.txt
- Blind pass: Codex (`gpt-6-astra`, read-only, at its configured reasoning
  effort of "none"), briefed from the owner's words and the same sources
  without the first pass.
- The two agreed that no line is done as v3 work and that faults in things v4
  will also do become v4 checks. They differed in form (Codex wrote "promote"
  or "narrow" with a v4 work area where the first pass wrote "merge" into one
  held list) and on retiring: Codex would retire only lines already paid. That
  difference was put to the owner, who ruled below. Taken from Codex: DEF-76 is
  paid; DEF-71, DEF-75 and DEF-93 carry into v4 as checks; the open findings of
  UI-06, CROWD-07 and UI-07 keep a home; port notes go to REFACTOR-01; AI-01
  and ICE-01 stay as they are.
- The working files (both passes row by row, Codex's answers word for word,
  the settled differences) are in the session family's lane, outside this
  repository.

## The owner's ruling, word for word

One batched question of four parts was put to Joe with the file
`dispositions-for-joe.md` (195 lines in groups A to K). His answers, exactly
as returned:

### 1 — Held lines (groups C, D, D2, E: 107 lines)

Question, as asked: Stock take, groups C, D, D2 and E in
dispositions-for-joe.md: 107 lines are faults, port notes, design findings and
feature ideas that bear on v4. You chose "Freeze v3 now", whose text says open
v3 defects "become checks v4 must pass". Where should they live until the
architecture plan gives each a home?

Options offered:
- "One held list (Recommended)" — They leave the backlog and wish list and are
  kept word for word on one list in reviews/. MERGE-01 gains one criterion: its
  plan gives every held line a v4 home or brings it back to you. Trade-off: the
  plan has 107 lines to sort; the backlog drops from 54 lines to 9, leaving
  room for v4's phases.
- "Keep them as lines" — They stay as lines in the backlog and wish list under
  a "held for v4" heading. Trade-off: nothing moves, but the backlog stays at
  about 1,000 of its 1,100 words, so the v4 plan will need a bigger budget from
  you.

Joe's answer (his own text, not an option), verbatim:

"as per your recommendation, but you can take the context higher if needed too"

### 2 — Retiring (groups H and I: 60 lines)

Question, as asked: Stock take, groups H and I: 60 lines I would retire. 9 are
already done in 3.3.726 (both passes agree on 5; 4 rest on my evidence alone).
51 are v3-only: dead code, v3 scripts, its test harness and flaky tests,
wording of v3 controls. Codex would retire none of the 51 and carry each into
v4 instead. Which do you rule?

Options offered: "Retire all 60 (Recommended)"; "Retire the 9 done only";
"Retire only the 5 agreed".

Joe's answer, verbatim (an option label): "Retire all 60 (Recommended)"

### 3 — The rest (groups A, B, F, G, J, K: 28 lines)

Question, as asked: Stock take, the remaining 28 lines (groups A, B, F, G, J,
K): MERGE-01 leads the v4 programme; REFACTOR-01 narrows to the port; EX-01
narrows to one scene per preset; 6 record lines join the programme; 5 older
owed export checks and UI-08.1 fold into REL-726.1; REV-03, REV-05 and EX-03.1
are parked with triggers; 9 stay as they are. Do you agree?

Options offered: "Yes, as proposed (Recommended)"; "Yes, but keep each export
check".

Joe's answer, verbatim (an option label): "Yes, as proposed (Recommended)"

### 4 — Found (he could tick any number)

Question, as asked: Four things the stock take found. Tick each one you want
acted on; leave the rest and nothing changes for them.

Options offered:
- "Hold the five lost defects" — DEF-05, DEF-07, DEF-10, DEF-11 and DEF-12
  have no open line anywhere. Ticked: they join the held list as checks, to be
  verified first.
- "Archive the oldest decisions" — 61 decisions are live against a guideline
  of 45 and the v4 plan adds more. Ticked: your word to archive the oldest with
  tools/archive.mjs, down to the guideline (wish V31-REFRESH.1).
- "Fix the save fault in v3" — CROWD-08.6: an ordinary Save Project can,
  rarely, lose text or write a file that will not reopen. Ticked: a v3 fix and
  a new zip for Xerte, the exception your freeze allows. Unticked: it is only a
  check v4 must pass.
- "None of these" — Leave all three as they are for now.

Joe's answer, verbatim (three ticked): "Hold the five lost defects,Archive the oldest decisions,Fix the save fault in v3"

### The session's readings — proposals, for Joe to confirm

- Part 1: "as per your recommendation" is the option "One held list
  (Recommended)", with its text, MERGE-01's new criterion included. "you can
  take the context higher if needed too" is read as his leave for this chat to
  run past the profile's 200k Session line to finish applying the ruling, this
  once; the signed Session line itself is unchanged.
- Part 4, "Fix the save fault in v3": his word, under Q2's exception, that
  CROWD-08.6 is fixed in v3 and a new zip made for Xerte. The stock take files
  it as a backlog item and writes no code; when it is done, and whether it
  waits for the v4 plan, is his to say.
- Part 4, "Archive the oldest decisions": his word, as the rules' Always asks,
  to archive the oldest live decisions down to the guideline of 45.
- Part 4, "Hold the five lost defects": DEF-05, DEF-07, DEF-10, DEF-11 and
  DEF-12 go on the held list as checks, each to be verified before it counts.

## Totals, as applied

| Disposition | Lines |
| --- | --- |
| Merged into MERGE-01: checks v4 must pass | 72 |
| Merged into MERGE-01: inputs to v4's interface design | 3 |
| Merged into MERGE-01: candidate features | 9 |
| Merged into REFACTOR-01: notes for the port | 22 |
| Merged into REL-726.1 | 6 |
| Merged into REV-05 | 1 |
| Retired: already done | 9 |
| Retired: v3 only | 51 |
| Promoted, narrowed, parked or kept | 22 |
| **All** | **195** |

## The held list — for the architecture plan

By the owner's ruling, MERGE-01's plan gives every line here a v4 item that
must pass or weigh it, or brings it back to him to retire. Nothing here is
fixed in v3.

### Checks v4 must pass (72)

Faults, proven or suspected, in things v4 will also do. Q2: open v3 defects "become checks v4 must pass".

- **DEF-15** — play and keyboard carry into v4 (Q9); Q2 freezes v3 and makes open defects checks v4 must pass: resuming play starts at normal speed.
  > [ ] DEF-15 — L resumes at the old J/K/L speed · Live defect P2 — since 2026-10-01
- **DEF-19** — the camera and undo carry into v4 (Q10); Q2 makes it a check v4 must pass: a camera-zoom edit is one undo step.
  > [ ] DEF-19 — Camera-zoom edits skip undo · Live defect P2 — since 2026-10-01
- **DEF-22** — Q11 keeps forks in a route's geometry; Q2 makes it a check v4 must pass: a point inserted on a fork's run joins that run.
  > [ ] DEF-22 — An inserted waypoint splits a branch run · Live defect P2 — since 2026-10-01
- **DEF-51** — save and open carry into v4 and file safety is ported (Q1); Q2 makes it a check: a failed load leaves nothing of the refused project behind.
  > [ ] DEF-51 — Failed load leaves caches — since 2026-10-05
- **DEF-54** — reordering a route's points carries into v4; Q2 makes it a check: a list drag let go outside the list changes nothing. The list itself is new code (Q21).
  > [ ] DEF-54 — Outside drop moves rows — since 2026-10-05
- **DEF-55** — Q11 keeps forks in a route; Q2 makes it a check v4 must pass: reordering the trunk leaves a fork's run where it was.
  > [ ] DEF-55 — List drop sends branch last — since 2026-10-05
- **DEF-56** — timing is ported (Q1) and Q9's core moves 'over a set time'; Q2 makes it a check: a project opens with its beacon timing already built.
  > [ ] DEF-56 — Constant-time open unscheduled — since 2026-10-05
- **DEF-57** — timing is ported (Q1) and Q11 keeps forks; Q2 makes it a check: a beacon on a fork's own point runs on that point's arrival.
  > [ ] DEF-57 — Branch majors lack clock — since 2026-10-05
- **DEF-58** — export is ported (Q1); Q2 makes it a check v4 must pass: nothing done in the editor during a video export changes the exported scene or its framing.
  > [ ] DEF-58 — Export edits change scene — since 2026-10-05
- **DEF-60** — Q11 keeps forks, and group drags are basic editing; Q2 makes it a check: a refused gesture puts back everything it moved, not one point.
  > [ ] DEF-60 — Refused rejoin half-restored — since 2026-10-05
- **DEF-62** — play and scrub are in v4's core (Q9); Q2 makes it a check: Space or K at the end restarts, as the Play button does.
  > [ ] DEF-62 — Space at end stalls — since 2026-10-05
- **DEF-63** — the keyboard carries into v4 at AAA (Q1, Q22); Q2 makes it a check: no shortcut takes a browser chord such as Ctrl or Cmd with L.
  > [ ] DEF-63 — Shortcuts take modifier chords — since 2026-10-05
- **DEF-65** — undo and forks carry into v4 (Q11); Q2 makes it a check v4 must pass: one authoring gesture is one undo step.
  > [ ] DEF-65 — Branch place: two undos — since 2026-10-05
- **DEF-66** — export and save are in v4's core (Q9); Q2 makes it a check: every saved setting autosaves and marks the project changed.
  > [ ] DEF-66 — Export settings skip autosave — since 2026-10-05
- **DEF-67** — announcements carry into v4 at AAA (Q22); Q2 makes it a check: opening a project announces the open, not a pause nobody asked for.
  > [ ] DEF-67 — Open announces "paused" — since 2026-10-05
- **DEF-68** — the camera carries into v4 (Q10); Q2 makes it a check: a camera edit made while paused settles on screen without a further input.
  > [ ] DEF-68 — Paused camera controls sleep — since 2026-10-05
- **DEF-69** — camera zoom carries into v4 (Q10); Q2 makes it a check: a zoom the camera cannot reach in time is said on screen.
  > [ ] DEF-69 — Zoom warning unattached — since 2026-10-05
- **DEF-70** — keyboard and focus carry into v4 at AAA (Q22); Q2 makes it a check: choosing a menu item returns focus. v4's menus are Carbon's (Q21).
  > [ ] DEF-70 — Menu item drops focus — since 2026-10-05
- **DEF-71** — Codex's point: Q15 publishes on every merge, so the fault class carries: an unknown or mistyped flag must never publish. v3's build.js itself stays frozen (Q2).
  > [ ] DEF-71 — Unknown build flag releases — since 2026-10-05
- **DEF-73** — Q11 keeps forks, so a leg's next point is the next on its own run; Q2 makes that a check. The Leg card itself is v3's (Q21).
  > [ ] DEF-73 — Leg card misnames waypoint — since 2026-10-05
- **DEF-74** — undo carries into v4; Q2 makes it a check v4 must pass: Redo restores the selection the action left.
  > [ ] DEF-74 — Redo restores no selection — since 2026-10-05
- **DEF-75** — Codex's point: Q21 changes the bundler and Q15 publishes more often, so the check carries: every file the published page refers to is checked before a publish.
  > [ ] DEF-75 — Index check misses references — since 2026-10-05
- **DEF-78** — timing and crowds are ported (Q1) and Q12 keeps everything a pure function of time; Q2 makes it a check: every mode times a crowd alike.
  > [ ] DEF-78 — Comet tail retimes crowds — since 2026-10-05 — (from: CROWD-05, 2026-10-05)
- **DEF-79** — export and the player are ported (Q1); Q2 makes it a check: a route moment falls at the same instant in editor, video and player.
  > [ ] DEF-79 — Render space moves crowd anchors — since 2026-10-05 — (from: CROWD-05, 2026-10-05)
- **DEF-80** — the player is ported (Q1) and Q9's core moves 'over a set time'; Q2 makes it a check: the player keeps an authored duration.
  > [ ] DEF-80 — Player retimes constant-time projects — since 2026-10-05 — (from: CROWD-05, 2026-10-05)
- **DEF-85** — crowds carry into v4 as a traveller (Q11); Q2 makes it a check: a release control shows the start the engine uses. Whether anchors exist is the plan's.
  > [ ] DEF-85 — Anchored window start misreads — since 2026-10-08 — (from: CROWD-07, 2026-10-08)
- **DEF-87** — Q11's one route may drop traced, anchored nodes, a reading he has not confirmed; Q2 keeps the check: a drag that moves nothing records no undo entry.
  > [ ] DEF-87 — Traced node drag no-op — since 2026-10-08 — (from: CROWD-07, 2026-10-08)
- **DEF-88** — selection and its inspector carry into v4; Q2 makes it a check: the panel shows what is selected, however the selection was made.
  > [ ] DEF-88 — Branch keeps crowd inspector — since 2026-10-08 — (from: CROWD-07, 2026-10-08)
- **DEF-90** — crowd release carries into v4 (Q11); Q2 makes it a check: a readout shows the value the engine uses, here the clipped window.
  > [ ] DEF-90 — Window length readout unclipped — since 2026-10-08 — (from: CROWD-07, 2026-10-08)
- **DEF-92** — undo carries into v4; Q2 makes it a check: one slider gesture is one undo entry, never merged with the next action by a timer.
  > [ ] DEF-92 — Crowd sliders undo on timer — since 2026-10-08 — (from: CROWD-07, 2026-10-08)
- **DEF-93** — Codex's point: under Q11 a crowd still picks its way through forks, so advice about where a journey ends must come from what dots can reach, not from a label. The v3 hint's wording stays frozen.
  > [ ] DEF-93 — Journey-end hint misadvises — since 2026-10-08 — (from: CROWD-07, 2026-10-08)
- **DEF-95** — crowds are ported (Q1); Q2 makes it a check once he rules: a repeating walk repeats exactly, sway included, or the drift is kept on purpose.
  > [ ] DEF-95 — Network loop sway varies per lap — since 2026-10-11 — (from: CROWD-07, 2026-10-11)
- **DEF-97** — keyboard and focus carry into v4 (Q22); Q2 makes it a check: a value typed and not yet committed is never lost. The fields are new code (Q21).
  > [ ] DEF-97 — Busyness fields drop typed values — since 2026-10-12 — (from: CROWD-07, 2026-10-12)
- **INTAKE.12** — a file-safety defect in path sampling, which Q1 ports. Q2 makes it a check v4 must pass: a sample budget for a whole route.
  > INTAKE.12 — `PathCalculator` samples a point per 0.002 of path length with no overall cap, so a crafted project at the 2,000-waypoint and coordinate limits can ask for tens of millions of samples; the DEF-03 range stops one stray coordinate, not a whole route. (canon provenance: 2026-09-23 DEF-03, Codex review) — (from: INTAKE, 2026-10-01)
- **INTAKE.13** — an autosave file-safety defect. Q2 makes it a v4 check: recovery holds only fields the schema names. Q14 keeps v3 files out of v4.
  > INTAKE.13 — Model-only autosave recovery shallow-copies `styles` and clears only the image fields it knows, so an extra field a crafted project file puts on `styles.pathHead` (a data URL, a filename) survives into the recovery point; export filtering (DEF-23) does not reach it. (canon provenance: 2026-09-23 DEF-23, Codex review) — (from: INTAKE, 2026-10-01)
- **INTAKE.19** — a waypoint-placement defect in route editing, which v4 also has. Q2 makes it a check v4 must pass.
  > INTAKE.19 — Two handlers in `wiringControllers.js` place a waypoint next to one that may be off the image, then pull it onto the image whatever the background zoom: inserting before the first or after the last (`waypoint:insert-adjacent`, which continues the route by 8% and clamps to 0–1) and duplicating (`waypoint:duplicate`, which caps each coordinate at 1, so a copy of (1.5, −0.3) lands at (1, −0.28)); DEF-03's rule would let the new point follow when zoomed out. (canon provenance: 2026-09-25 DEF-35) — (from: INTAKE, 2026-10-01)
- **INTAKE.22** — a marker hit-test defect. Markers are in Q9's core, so Q2 makes it a check v4 must pass.
  > INTAKE.22 — A waypoint's hit radius is a fixed 15 px (`INTERACTION.WAYPOINT_HIT_RADIUS`) while a beacon can draw its marker at up to 4×, so a click 22 px from the centre of a 4× marker adds a waypoint instead of selecting it (now while paused too, with DEF-08). (canon provenance: 2026-09-26 DEF-08 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.26** — an announcement defect in playback, which v4 also has. Q2 makes it a check: skipping to the end is announced.
  > INTAKE.26 — Skip to end announces nothing, from the button, `.`, `>` or End: `ui:animation:skip-end` seeks directly, and the "Skipped to end" announcement in `playback.js` is never called. (canon provenance: 2026-09-26 DEF-33 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.29** — open accepts a value the renderer will not draw. Q2 makes it a v4 check: a loaded value reads as it draws.
  > INTAKE.29 — Load accepts a Graphics scale up to 16 but the renderer clamps it to 0.25–4, so a hand-edited 16 reads "16×" while drawing at 4×, and a value below 0.25 draws at 0.25× but reads "0.0×". (canon provenance: 2026-09-26 DEF-37 review) — (from: INTAKE, 2026-10-01)
- **REL-698.1** — a candidate timing and playback defect, unverified. Q2 makes it a check v4 must pass: Play straight after open never meets duration 0.
  > REL-698.1 — Probe whether Play pressed just after an example loads reads duration 0: Open day saves a duration of 0, loading returns before the 50 ms deferred re-timing (`pathTiming.js`), and `playback.js` neither waits for nor flushes it, so a frame at duration 0 completes and pauses (`AnimationEngine.js`); a candidate, unverified, from Codex's review of REL-698 — (from: REL-698, 2026-10-05)
- **DEF-44.1** — a camera idle defect against the Always line. Q2 makes it a check v4 must pass: a still view queues no frame.
  > DEF-44.1 — Settle the camera's unseen 1× easing (after a canvas resize, as the exported player loads, and easing back to 1× from just above it, where a seek from 1.028× ends with eight flat frames) so a still view queues no frame at all, as the rules file's Always says; DEF-44 names them as bounded residuals — (from: DEF-44, 2026-10-05)
- **DEF-77.3** — a candidate crowd defect, now explained in a hint but not removed. Q2 makes it a v4 check: a share shown matches what arriving dots do.
  > DEF-77.3 — Path weights count the way back as an option, so a two-way path shows 34/33/33 while arriving dots split 50/50 (a candidate, unverified) — (from: DEF-77, 2026-10-05)
- **DEF-42.1** — a timing performance weakness in code Q1 ports. Q2 makes it a check: a dragged slider rebuilds timing at most once a frame.
  > DEF-42.1 — Coalesce continuous-input timing rebuilds (a slider dragged) to one per frame: every rebuild now composes a branched route's timeline afresh, about 31 ms per input at 2,000 waypoints (Codex, DEF-42 review r1) — (from: DEF-42, 2026-10-05)
- **CROWD-05.2** — a crowd performance defect in code Q1 ports. Q2 makes it a check: a large network crowd's first walk does not block editing.
  > CROWD-05.2 — The scene end's first walk of a large network crowd can block editing: one 5,000-dot crowd on a four-edge loop with a low-weight exit took about 900 ms cold (1 ms warm); each departure scans every edge, so the cold cost is dots × 2,048 hops × edges. Index departures by node, or move the walk off the main thread (Codex, CROWD-05 review r1, advisory) — (from: CROWD-05, 2026-10-05)
- **REL-703.2** — a candidate timing defect on open, probably paid by UI-06 but unverified. Q2 makes it a check: the timeline on open equals the one after a rebuild.
  > REL-703.2 — Open day's base timeline reads 12,262 ms right after the example loads in the pane and 11,594 ms after any rebuild, on the same 1404×790 canvas (seen on v3.2.702 and v3.2.703): find what the load composes against; a candidate defect, unverified — (from: REL-703, 2026-10-05)
- **TST-05.1** — a candidate restore and transport defect, unverified in a browser. Q2 makes it a check v4 must pass after its own recovery opens.
  > TST-05.1 — Check in Chromium: after a session restore the transport stands at the end while the path is at its start (seen in TST-05's jsdom transcript, unverified in a browser) — (from: TST-05, 2026-10-05)
- **TST-04.1** — a candidate save and timing defect. Q2 makes it a check v4 must pass: a saved duration does not depend on the editor's mode.
  > TST-04.1 — The saved `animationState.duration` follows the editor mode: with the authored-extras fixture, Preview saves 491.9 s where Edit saves 21.4 s (TST-04, the route golden's mode-switch row; values from 2026-09-28, before CROWD-05). Unverified whether that is meant. — (from: TST-04, 2026-09-28)
- **TST-04.2** — a candidate playback defect. Q2 makes it a check: after a pause, no event says the animation is playing.
  > TST-04.2 — After a pause, the frame already booked still emits `animation:update` saying `isPlaying: true` (TST-04, the playing golden). Unverified whether anything reads it. — (from: TST-04, 2026-09-28)
- **DEF-28.1** — a known race between tabs in browser recovery; Q1 ports file safety and Q8 gives v4 its own storage, so Q2 makes a shared lock a v4 check.
  > DEF-28.1 — A lock shared by the tabs of one browser (the Web Locks API) around browser recovery's writes: `localStorage` has none, so DEF-28's mark narrows, and cannot close, the moment in which a tab that has not yet seen another's mark writes over a record it holds, and two tabs choosing the same key for a kept record at the same moment could collide. The writes are synchronous today, and pagehide's flush must stay so. — (from: DEF-28, 2026-09-28)
- **CROWD-06.2** — undo is behaviour v4 has, so Q2 makes it a check: one history entry per gesture, never by timer. Same class as backlog DEF-92.
  > CROWD-06.2 — Several sliders record undo after 400 ms without input rather than at the gesture's end, so a drag paused mid-way makes two entries and quick separate changes can merge: Graphics scale, Path head size, Head rotation offset, Path glow intensity, every waypoint-card slider and the crowd sliders (seen while fixing CROWD-06's, which now records on `change`); a candidate defect, unverified in Chromium — (from: CROWD-06, 2026-10-06)
- **CROWD-06.3** — what is left is Duration with a route, which records no undo entry; undo is behaviour v4 has, so Q2 makes it a check.
  > CROWD-06.3 — The Duration slider records no undo entry at all (seen in CROWD-06's review round); a candidate defect, unverified — (from: CROWD-06, 2026-10-06)
- **TST-09.1** — the camera at one instant differs by seek history; Q12 keeps everything a pure function of time, so Q2 makes it a v4 check.
  > TST-09.1 — A seek to a 1× instant records no camera progress, so a later seek back near a zoomed spot eases in from 1× over 83 frames instead of snapping; the same instant then shows a different camera by seek history (TST-09's camera golden); a candidate defect, unverified in Chromium — (from: TST-09, 2026-10-06)
- **TST-09.2** — at the last instant the head draws one path point short of the camera and reveal; the lead is v4's core (Q24), so a check.
  > TST-09.2 — At the last instant every host (Edit, Preview, video export, player) draws the route head at path point n−2, while the camera and the reveal's head position use n−1 (TST-09's minor-end golden, `domains-minor-end.json`); a candidate defect, unverified in Chromium — (from: TST-09, 2026-10-06)
- **TST-09.3** — the comet tail draws no trail after a long last wait; Q1 ports timing, so the plan rules whether that is meant (Q2).
  > TST-09.3 — On Open day the comet trail has faded during the final 4.5 s wait, so the 1.17 s comet tail draws no trail (TST-09's time golden); whether that is meant is unverified — (from: TST-09, 2026-10-06)
- **TST-09.4** — a traced crowd walks through the reveal intro before the head moves; Q1 ports crowds and timing, so the plan rules on it (Q2).
  > TST-09.4 — On Open day the traced crowd walks during the reveal intro, before the head moves (TST-09's time golden); whether that is meant is unverified — (from: TST-09, 2026-10-06)
- **CROWD-06.4** — no rule fits a test gap in v3's undo, which v4 writes new (Q1); held as a v4 check: second Undo, then Redo, across two controls.
  > CROWD-06.4 — `tests/holdAtEnd.test.js`'s cross-control undo test proves undoing Hold keeps Graphics scale but not that a second Undo restores the original scale, then Redo (Codex, CROWD-06 short pass, advisory) — (from: CROWD-06, 2026-10-06)
- **TST-03.1** — the comet trail's maximum hides the first fifth of the path though documented as all of it; Q1 ports drawing, so Q2 makes it a check.
  > TST-03.1 — The comet trail's maximum is documented as "full path always visible", but its 80 % cap hides the first fifth of the path travelled: `getPathVisibleRange(1, {pathVisibility: 'instantaneous', pathTrail: 4}, 10000)` starts at 0.2 (TST-03's golden, unverified as a defect) — (from: TST-03, 2026-10-06)
- **TST-03.2** — under hide-before a waypoint just after the first shows at 98.6% on the first frame; markers are in v4's core (Q9), so a check.
  > TST-03.2 — Under hide-before, a waypoint just after the first shows at 98.6 % on the first frame instead of growing in: the first waypoint's authored wait counts as head start, though the engine never waits at 0 % (waypoints at 0 with a 1,500 ms wait, 0.006 and 1; seek to 0; TST-03's golden, unverified) — (from: TST-03, 2026-10-06)
- **TST-03.3** — the spotlight reveal's intro never shows; reveal is behaviour v4 has (Q19's document reveal), so Q2 makes it a check.
  > TST-03.3 — The spotlight reveal's intro never shows: the mask is empty for the whole 1 s intro, then appears at full size (a reveal engine at 500 ms); the intro-curve work of §20 Q10 (W10) is its likely home — (from: TST-03, 2026-10-06)
- **DEF-20.1** — at start-up two thumbs show the markup's values, not the project's; Q2 makes it a v4 check: every control shows the value it holds.
  > DEF-20.1 — Start-up leaves the Angle of View and path-trail thumbs at the markup's values until a project loads (`_syncInitialUIState`); DEF-20 covered Open, rollback and Clear All — (from: DEF-20, 2026-10-08)
- **DEF-32.1** — after a modifier-click multi-selection, focus falls to the page; keyboard and focus are behaviour v4 has at AAA (Q1), so Q2 makes it a check.
  > DEF-32.1 — After a Shift-, Cmd- or Ctrl-click that leaves a multi-selection, focus still falls to the page: the list's focus restore excludes multi-selection (`selectedWaypoints.size <= 1`); DEF-32 kept single selections only — (from: DEF-32, 2026-10-08)
- **DEF-13.1** — one Escape still does two things in two cases; keyboard behaviour v4 has, so Q2 makes it a check: one Escape, one effect.
  > DEF-13.1 — Escape still does two things in two cases, as on main: on the page with a dropdown open it closes the menu and clears the selection; with a hint open while drawing an area or a network it closes the hint and ends the drawing; those listeners act without cancelling the key (DEF-13 r2) — (from: DEF-13, 2026-10-08)
- **DEF-13.2** — arrows on an unselected row no longer scroll the list while something is selected; keyboard behaviour v4 has, so a check under Q2.
  > DEF-13.2 — On a waypoint-list row whose waypoint is not selected, the arrows no longer scroll the list while something else is selected (DEF-13 r2's guard) — (from: DEF-13, 2026-10-08)
- **DEF-20.2** — a stored value past a slider's reach makes the first step jump; v4 saves its own format (Q14), so the plan sets one range rule.
  > DEF-20.2 — A loaded value past a slider's reach (Angle of View 400°, View Distance 0.25%) shows its readout beside a thumb at the end, so the first step jumps the setting: CON-14's range policy, unchanged by DEF-20 (Codex, DEF-20's review) — (from: DEF-20, 2026-10-08)
- **CROWD-07.1** — at t = 0 the trunk draws fully while a rejoined branch does not; routes and forks are v4's geometry (Q11), so a check under Q2.
  > CROWD-07.1 — At t = 0 the trunk path draws fully while a rejoined branch does not until revealed (seen once in the walkthrough, 12-*.jpg vs 13-*.jpg); verify whether trunk and branch should match — (from: CROWD-07, 2026-10-08)
- **UI-06.6** — a dialog's first focus and Tab wrap can land on a control in a disabled fieldset; focus is behaviour v4 has at AAA (Q1), so a check.
  > UI-06.6 — Make focusTrap initial focus and Tab traversal reject `:disabled` candidates, including the generic tabindex selector; verify initial focus lands and add disabled-fieldset tests for preferred focus and forward/reverse Tab wrapping — (from: UI-06, 2026-10-09)
- **UI-06.7** — the player's summary says polygon where the editor says area and corner; the player is ported (Q1, Q21), so one word per concept is a check.
  > UI-06.7 — The exported player's summary still says "1 polygon, 3 polygon vertices" (`src/player/playerAccessibility.js` (:127–128)), words PR 8 retired in the editor for area and corner; it is player code, so changing it owes a save to disk under the owner's export rule (GATELESS-1, 2026-10-05) — (from: UI-06, 2026-10-11)
- **UI-06.11** — the Preview camera's centre carries across a load and a refit; Q12 keeps the camera a pure function of time, so a check under Q2.
  > UI-06.11 — The Preview camera's smoothed centre carries across a project load and a canvas refit: it eases 8% a frame from where the last canvas left it (`src/services/CameraService.js` (:135–136)), so the first preview frames after either show it still easing (the camera translate of `tests/goldens/draw-log-authored-extras-preview.txt`, PR 6 round 3); older than PR 6; Codex, round 5's brief check: resetting it would change Preview transitions and playback after a refit, and possibly export frames — (from: UI-06, 2026-10-12)
- **CROWD-08.4** — a path's shape depends on edit history through the curvature cache, so editor and player can differ; Q1 ports this geometry, so a check.
  > CROWD-08.4 — Broaden complete-input curvature-cache keys beyond eligible Finish-area journeys: the Part C design reviews reproduced warm/cold route and network differences after an internal bend edit, including network lengths 2.79668318121725 versus 2.796742803247161; C isolates its own calculations while legacy TST-09 behaviour remains pinned — (from: CROWD-08, 2026-10-14)
- **CROWD-08.7** — a project near its size limit may grow on open and re-save; v4 saves its own format (Q14), so the check is that open-then-save stays stable.
  > CROWD-08.7 — Near-limit ZIPs may grow on Open/re-save while waypoint timestamps and timing are normalised; investigate the observed CROWD-08 QA case (unjudged) — (from: CROWD-08, 2026-10-16)
- **DEF-99.1** — a selected waypoint's selection box is drawn into video exports; Q1 ports export, so Q2 makes it a check: no editing overlay in any export.
  > DEF-99.1 — A selected waypoint's dashed selection box is drawn into video exports (12 calls a frame on the path layer, seen while testing DEF-99); unjudged — (from: DEF-99, 2026-10-18)
- **REL-725.2** — the first video export after a project opens draws its middle frame's background differently; Q1 ports export, so Q2 makes repeatable frames a check.
  > REL-725.2 — The first video export after a project opens draws its middle frame's background differently from every later export of it, zoomed or not (Open day, background on: 524,329 pixels by up to 84 levels; the first and last frames match, path-only frames match); seen in REL-725's live check, unjudged — (from: REL-725, 2026-10-19)

### Notes for the port (REFACTOR-01) (22)

What the port of v3's engine must know: a behaviour no test pins, a test that pins a fault, dead code to leave behind.

- **TST-11** — Its behavioural tests shipped; what is left changes only v3's frozen suite. For the port: a test that reads source text cannot move to v4 as written, and the release script's restore-before-cleanup order is pinned by a source read alone.
  > [!] TST-11 — Behavioural tests for source-text assertions — since 2026-10-01 — blocked: the owner's word to retire the source-text assertions its new tests cover (GATELESS-1 bars deleting a test)
- **DEL-02** — v3's dead code is never removed now (Q2). This list sits in drawing files Q1 ports, so the port leaves it behind.
  > [ ] DEL-02 — Render dead code · Dead code P1 — since 2026-10-01
- **DEL-03** — v3's dead code is never removed now (Q2). This list sits in timing, geometry and event-bus files Q1 ports, so the port leaves it behind.
  > [ ] DEL-03 — Engine, geometry and bus dead code · Dead code P1 — since 2026-10-01
- **DEL-04** — v3's dead code is never removed now (Q2). Its dead timing functions sit in code Q1 ports; the rest is v3 wiring that is not ported.
  > [ ] DEL-04 — Wiring dead code · Dead code P1 — since 2026-10-01
- **DEL-05** — v3's dead code is never removed now (Q2). Nearly all of it is interface and CSS that v4 writes new; any config the port keeps is checked against this list.
  > [ ] DEL-05 — UI, config and CSS dead code · Dead code P1 — since 2026-10-01
- **DEL-06** — v3's dead code is never removed now (Q2). This dead API sits in file-safety code Q1 ports, and tests pin four dead symbols, so the port leaves both behind.
  > [ ] DEL-06 — Services dead API · Dead code P2 — since 2026-10-01
- **DEL-01** — v3's dead code is never removed now (Q2). Its list tells the port what to leave behind; Q21's knip then keeps v4 clean.
  > [ ] DEL-01 — Unused barrels · Dead code P2 — since 2026-10-01
- **INTAKE.15** — the player's on-screen sizing is export behaviour no test pins. Q1 ports export with its tests; Q21 keeps the player free of React.
  > INTAKE.15 — The exported player's on-screen path is untested: `PlayerApp.resize` returns early on a canvas with no parent, so no test sees its backing size, `pixelScale` or `setTransform`, and forcing `pixelScale: 1` in the player passed every test (Codex). (canon provenance: 2026-09-24 DEF-34) — (from: INTAKE, 2026-10-01)
- **INTAKE.16** — a hole in the app-equals-player golden, which Q1 ports with the drawing code; close it as the goldens move.
  > INTAKE.16 — `goldenDrawLogs`' first-frame camera exemption still accepts a player-only translation that does not depend on Graphics scale; settling the editor's camera before comparing, or asserting the expected eased transform, would remove it. (canon provenance: 2026-09-24 DEF-34) — (from: INTAKE, 2026-10-01)
- **INTAKE.17** — path-only export is export behaviour no draw golden pins. Q1 ports export with its tests.
  > INTAKE.17 — The draw goldens never draw a path-only export: `enterMode('export')` skips the step in `exportVideo` that hides the background, although `authoredExtras` asks for one (Codex). (canon provenance: 2026-09-24 TST-17) — (from: INTAKE, 2026-10-01)
- **INTAKE.18** — Q23's v4 gate runs tests in parallel; a ported engine test that books a frame carries this fault with it, so the port must close it, though v3's own suite stays serial.
  > INTAKE.18 — In a parallel run (`npx vitest run` without the gate's `--no-file-parallelism`) a frame that the setup's `setTimeout`-backed `requestAnimationFrame` booked can fire after its file's environment is torn down, so `AnimationEngine._scheduleFrame` throws `requestAnimationFrame is not defined` as an uncaught exception; vitest then reports `Errors  N errors` and exits 1 with every test passed (7 errors, attributed to `backgroundModeOverlay.test.js`, on `a69ab80`; the serial gate has not shown it). (canon provenance: 2026-09-25 PM prompt) — (from: INTAKE, 2026-10-01)
- **INTAKE.21** — the fixture's out-of-range trail makes the draw goldens miss every beacon window; mend it when Q1's port moves them. Q14 leaves v3 loading behind.
  > INTAKE.21 — The `authored-extras` fixture's `motionSettings.pathTrail` is 640, far outside the slider's 0.04–4, because load checks only that it is finite (`persistence.js:370-373`); its preview timeline runs about 14 minutes, so the goldens' later instants miss every beacon window. (canon provenance: 2026-09-26 DEF-08 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.30** — the draw recorder cannot see a clip, and src now has one. If Q1's port carries the recorder, it needs a clip region.
  > INTAKE.30 — The test recorder keeps no clip region, so its state view can see neither a clip left in force after a throw nor any clip at all; nothing in `src/` clips today. (canon provenance: 2026-09-28 DEF-38 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.31** — a latent drawing weakness no test pins. When Q1's port moves the overlays, each sets its own alpha and dash.
  > INTAKE.31 — Editing overlays inherit their opacity and line dash from whatever drew before them (area edit handles, the hover and leg-hover rings, the plus handle, selection rings, the network guide and selected-node overlays). Harmless today, since every layer that sets either does so inside a save or clears it (the route clears its dash), but one that left either would restyle them. (canon provenance: 2026-09-28 DEF-47 review) — (from: INTAKE, 2026-10-01)
- **DEF-44.2** — the tail test asserts the residual exists. If Q1's port carries it, it must allow zero frames, with DEF-44.1's check.
  > DEF-44.2 — Let DEF-44's near-1× tail test allow zero redundant frames, asserting the visible zoom-out and the next zoom-in instead of the tail's existence, so settling the tail does not fail it — (from: DEF-44, 2026-10-05)
- **DEF-42.2** — beacon timing on four control paths is timing behaviour no test pins. Q1 ports timing with its tests.
  > DEF-42.2 — Pin the beacon timing the other control paths give: the ripple-wait toggle, a multi-selection's pulse cycle, ripple scale and wait, and a card's On-arrival Reset and Apply onward (Codex, DEF-42 review r2, advisory) — (from: DEF-42, 2026-10-05)
- **TST-16.1** — a crowd-schedule assertion a mutant survives. Tighten it when Q1's port carries the crowd tests.
  > TST-16.1 — Assert a looping dot's `finishes` is strictly `false`, not merely falsy (Codex, TST-16 review r1, advisory: CA-UNDEFINED) — (from: TST-16, 2026-10-05)
- **DEF-64.1** — a surviving mutant in branch-leg hit geometry. Add the one-waypoint terminal branch if the plan ports that hit test (Q1).
  > DEF-64.1 — A branch-leg hit fixture with a terminal branch of one waypoint (its fork and `b1` only): a narrower N6, skipping runs of two waypoints or fewer, survives the four shapes `tests/branchLegHit.test.js` has (Codex, DEF-64 review r2, advisory) — (from: DEF-64, 2026-10-05)
- **TST-03.4** — a latent throw in reveal drawing that Q1 ports; harmless while the engine sends no negative progress, so a note for the port.
  > TST-03.4 — `buildAOVRevealMask` throws a TypeError at negative progress, which the engine never sends today (TST-03) — (from: TST-03, 2026-10-06)
- **TST-03.5** — at the end the engine's wait state differs between play and seek, with no output changed; Q12 wants a pure function of time, so a port note.
  > TST-03.5 — After playing to the end of a route whose last waypoint waits, the engine's wait state goes stale (played, it reports waiting; seeked to the same instant, it does not): `updateAnimation`'s end branch skips `_applyWaitState`; no visibility output differs today (TST-03) — (from: TST-03, 2026-10-06)
- **TST-03.6** — the renderer's pause clock counts the intro where the engine's does not, with no output changed; Q1 ports both, so a port note.
  > TST-03.6 — The renderer's `_getPauseElapsed` counts the intro: 500 ms into a wait after a 1 s intro it reads 1,500 ms, where the engine's pause state reads 500; `getPathVisibleRange` ignores it given the timeline context, so no output differs today (Codex, TST-03's review) — (from: TST-03, 2026-10-07)
- **UI-06.13** — the zoom's rate limit reads wall time, which Q12's pure function of time rules out; the camera fixtures need it settled in the port.
  > UI-06.13 — A camera domain fixture that opened at a zoomed waypoint could not come to rest under the camera tests' stopped wall clock, since the zoom's rate limit reads wall time (`src/services/CameraService.js` (:412)) and the opening's held frames run on a clock of their own: `openProject` would fail loudly at its 2,000-frame bound (`tests/helpers/domainGoldens.js` (:111), (:143–147)); none does today, and openings outside the domain goldens stay on real timers (PR 6 round 5's question 2; Codex r5: a fixture limitation, not a failure) — (from: UI-06, 2026-10-12)

### Inputs to v4's interface design (3)

Three v3 design reviews. What they shipped is in 3.3.726; their open findings stay in their item files and review files as inputs to v4's interface.

- **UI-06** — Its fixes shipped and are in 3.3.726; the judgement rows left are v3 interface work that Q1 and Q21 replace. Codex's point: keep those findings with a home, so they go to the plan as inputs to v4's interface.
  > [~] UI-06 — Review and tweak the app GUI against the UI standards — since 2026-10-06
- **CROWD-07** — Its two card changes shipped; the rows left are v3 crowd-card work that Q11 and Q21 replace. They go to the plan as inputs to v4's interface, with its one unverified drawing finding as a held check.
  > [~] CROWD-07 — Review the crowd features for novices and experts — since 2026-10-06
- **UI-07** — It reviews the layout of v3's cards, sidebars and header, which Q17 and Q21 write new; its parked rows go to the plan as inputs to v4's layout.
  > [ ] UI-07 — Review the layout and order of cards, sidebars and header — since 2026-10-08

### Candidate features (9)

Ideas the plan weighs under MERGE-01's criterion "which candidate features ... join, and in what order". None is promised.

- **INTAKE.1** — a feature idea. Q2 freezes v3, so per-leg tension can only come as a v4 route feature, if the owner ever wants it.
  > INTAKE.1 — Per-leg spline tension under Leg → More if ever wanted — per-waypoint segmentTension was retired unread; PathCalculator would need to consume it. (canon provenance: 2026-08-18 Phase 3.5) — (from: INTAKE, 2026-10-01)
- **INTAKE.2** — two feature ideas. Q11 makes a crowd a traveller added to a route, so several emitters and layer order are questions for v4's model.
  > INTAKE.2 — Crowd editing extras still outside the roadmap: multi-emitter authoring (cards edit `emitters[0]` only) and strip drag-reorder via `Scene.moveFlowLayer`. Seed re-roll and release/intensity shaping moved to CROWD-02/CROWD-03 on 2026-08-26. (canon provenance: 2026-08-18 Phase 4 layers strip) — (from: INTAKE, 2026-10-01)
- **INTAKE.3** — feature ideas. Labels are shipped; the edge split (the same as DEF-77.4), the nudge and the menu are left. Q2 freezes v3.
  > INTAKE.3 — Network extras after REV-03: click-on-edge splits it with a node, node labels/rename, arrow-key nudge and a network context menu. Edge-weight visualisation moved to CROWD-01 on 2026-08-26. (canon provenance: 2026-08-18 Phase 4 network edit) — (from: INTAKE, 2026-10-01)
- **INTAKE.6** — a feature idea for v4's canvas selection. Q2 freezes v3.
  > INTAKE.6 — Marquee / rubber-band selection on canvas — drag over empty space currently does nothing in edit mode; a selection rectangle is the natural next gesture. (canon provenance: 2026-08-18 Phase 4 multi-select) — (from: INTAKE, 2026-10-01)
- **DEF-77.4** — a feature idea, the same one as INTAKE.3's edge split. Q2 freezes v3.
  > DEF-77.4 — No tool inserts a junction node into an existing path (a candidate, unverified) — (from: DEF-77, 2026-10-05)
- **CROWD-05.1** — a feature idea. Q2 freezes v3, so a start hold in Preview joins v4's candidate features.
  > CROWD-05.1 — A "Hold at start", so Preview shows the 2 s start buffer that only video export adds today — (from: CROWD-05, 2026-10-05)
- **OWNER.1** — the owner's own feature words; not among Q19's five presets, so it joins the candidates for an order he sets (Q4).
  > OWNER.1 — Transit presets by mode and era, in the owner's words: "for trains it would be good to have preset imagery and movement i.e. wobble in old trains", and to "consider the transit options and eras"; today the only built-in path head is the drone (`src/utils/pathHeadPresets.js`) — (from: OWNER, 2026-10-13)
- **EX-02.1** — Q19 makes match-day crowd a v4.0 preset and Q24 says the riot march returns later; v3's Add crowd is frozen (Q2).
  > EX-02.1 — Offer the Match day and Reform riot, 1831 examples from Add crowd as ready-made starting points, as PLAN-4's wish line proposed; EX-02 shipped them as example projects only — (from: EX-02, 2026-10-17)
- **CROWD-08.3** — his word puts the full area feature in v4, and MERGE-01's candidates hold drawn areas; what "full" means is asked in the plan's round (Q4).
  > CROWD-08.3 — Lead #12's proposed reading of the owner's "the full feature in v4": allow an area placed off its node by dragging or offset, including a node on its edge; the interpretation awaits the owner — (from: CROWD-08, 2026-10-14)

### The five lost defects, held on the owner's word (5)

DEF-05 (index-space mis-pairing on branched routes), DEF-07 (the camera not a
function of time), DEF-10 (the curvature-cache key), DEF-11 (minor-end timing)
and DEF-12 are named in `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`
and in TST-09's decision as fixes its goldens gate, but have no backlog line,
wish, item file or trajectory line, and no commit carries their IDs. Whether
any was fixed before the October migration is not checked. Each is verified
first, then held as a check v4 must pass.

### Port hazard

v3's tests pin some open defects as they stand, so porting the engine "with
its tests" would port the fault as a requirement: DEF-79
(`tests/dotsDomain.test.js` :152, :204) and DEF-51
(`tests/branchLegHit.test.js` :649–651, `tests/projectRollback.test.js` :14).

## Folded into another line

### Into REL-726.1, the one owed export check (6)

The live and frozen build is 3.3.726; one saved-file check of it, or the owner's waiver, settles these.

- **REL-703.1** — an owed saved-file check of a release before 3.3.726. Q2 freezes v3 there, so the one check of 3.3.726 answers it.
  > REL-703.1 — v3.2.703's full export check: CROWD-05 changes export, so the Open day example exported from the live site as MP4 and HTML is owed a save to disk and an open from there, through the owner's Chrome with his word for each download — (from: REL-703, 2026-10-05)
- **REL-706.1** — an owed check of a release before 3.3.726; Q2 freezes v3 at 726. His save of 11 October did the same act on a later build.
  > REL-706.1 — v3.2.706's full export check: CROWD-06 changes export (the hold at end), so the Open day example exported from the live site as MP4 and HTML is owed a save to disk and an open from there, through the owner's Chrome with his word for each download — (from: REL-706, 2026-10-06)
- **REL-719.1** — an owed check of a release before 3.3.726; Q2 freezes v3 at 726, the only build left to save and open.
  > REL-719.1 — v3.3.719 MP4 and HTML saved-file check: the owner said “I’ll save and open both exports” on 2026-10-14; successful opening remains to be confirmed — (from: REL-719, 2026-10-14)
- **REL-721.1** — an owed check of a release before 3.3.726; Q2 freezes v3 at 726, the only build left to save and open.
  > REL-721.1 — v3.3.721 changes exports and the player; save and open its MP4 and HTML exports from disk, or obtain the owner's explicit waiver for this release — (from: REL-721, 2026-10-14)
- **REL-725.1** — an owed check of a release before 3.3.726; Q2 freezes v3 at 726, the only build left to save and open.
  > REL-725.1 — v3.3.725 changes exports and the player; save and open its MP4 and HTML exports from disk, or obtain the owner's explicit waiver for this release — (from: REL-725, 2026-10-19)
- **UI-08.1** — R0 would narrow. What is left, a hidden HTML export from disk and a WebM, is REL-726.1's own act on frozen 726 (Q2); add the WebM there.
  > UI-08.1 — UI-08's hidden background in a real browser: what an MP4 and a WebM show where the image was (H.264 carries no transparency; DEF-100 saw black), and a saved HTML export with the image left out opened from disk — (from: UI-08, 2026-10-19)

### Into REV-05 (1)

Joins REV-05's owner evidence, parked until v4's extended accessibility depth (Q22).

- **DEF-45.2** — no rule names it. The line itself joins REV-05's owner evidence; REV-05 re-parks before v4.0 with Q22's extended depth (R9).
  > DEF-45.2 — A screen-reader check of the announcement queue (NVDA or VoiceOver): during sustained input the same warning is written in consecutive turns, and a reader may not re-read identical text — joins REV-05's owner evidence (DEF-45 round 3) — (from: DEF-45, 2026-10-05)

## Retired

### Already done (9)

Checked at source: the work is in 3.3.726, or on this Mac. DEF-50, DEF-76, DEF-77.5, UI-03.1 and DEF-45.3 were found paid by both passes; DEF-77.1, TST-16.2, TST-04.3 and INTAKE.7 by the first pass alone.

- **DEF-50** — paid at source. UI-06's status PR (#120) shows 'Browser recovery failed' beside the title when an autosave fails; a test pins it, so Q2 leaves nothing open.
  > [ ] DEF-50 — Autosave failure unseen — since 2026-10-05
- **DEF-76** — Both passes traced it at source: DEF-42's fix clears the stale timeline the line names (src/app/pathTiming.js:842, src/app/wiringBus.js:377-388). Paid in 3.3.726; no test proves it by a run.
  > [ ] DEF-76 — Leg-speed edit stales timing — since 2026-10-05
- **INTAKE.7** — the installed Node now meets jsdom 30's floor, which was the line's only ask. A jsdom bump is v3 test tooling (Q23); Q21 sets v4's.
  > INTAKE.7 — jsdom 30 needs Node >= 24.15.0 and this checkout runs 24.5.0; no manifest change is required (engines already allows it, .nvmrc is just `24`) — only the installed Node. Owner's toolchain call. (canon provenance: 2026-08-28 DEPS-01) — (from: INTAKE, 2026-10-01)
- **DEF-77.1** — the Type and Guide hints have said it since UI-06 and CROWD-07, in v3.3.726. The node hint's own wording is v3-only (R3, Q21).
  > DEF-77.1 — The network node hint ("Dots appear at entries and finish at exits") and the Type hint do not say that a network with no Exit ends journeys at its one-connection nodes; reword under UI-03 — (from: DEF-77, 2026-10-05)
- **DEF-77.5** — the seed has been typed since CROWD-07, in v3.3.726, so a re-roll is reverted by typing the old seed.
  > DEF-77.5 — Re-roll pattern can be reverted only by Undo, because the seed is read-only (a candidate, unverified) — (from: DEF-77, 2026-10-05)
- **UI-03.1** — paid by UI-06's one word per concept, in v3.3.726.
  > UI-03.1 — The scene outline's crowd labels say "Release start" and "Release length" where the crowd card says "Window start" and "Window length": one concept, two names — (from: UI-03, 2026-10-05)
- **TST-16.2** — TST-03 pinned the moving cone two days after this wish was written. Q1's port carries that golden.
  > TST-16.2 — A moving-cone golden for `MotionVisibilityService`, whose moving direction no test pins today (Codex, TST-16 review r1, advisory: C09-MOVING) — (from: TST-16, 2026-10-05)
- **DEF-45.3** — paid by UI-06 on 2026-10-09, with a test, in v3.3.726.
  > DEF-45.3 — Announcement queue: a must-hear text that arrives assertive while its polite copy waits merges without taking the assertive place, so it is read after an older routine message; no caller sends one text at both priorities today (Codex, DEF-45 review r3, advisory) — (from: DEF-45, 2026-10-05)
- **TST-04.3** — UI-06 settled it on 2026-10-12, with a test, in v3.3.726.
  > TST-04.3 — Opening a project keeps the canvas aspect the session had: after a 16:9 preset, the authored-extras fixture opens 16:9 where a fresh start opens it square, and a project with no saved render or timing reference takes both from that, so its animation duration can differ (21.8 s against 21.4 s in TST-04's route context). Unverified whether that is meant. — (from: TST-04, 2026-09-28)

### v3 only (51)

About something only v3 has; v3 is frozen (Q2) and v4 writes these parts new (Q1, Q21, Q23).

- **INTAKE.4** — no rule fits. The script sits in the frozen canon 4.7.0 copy that nothing has run since the 2026-10-01 intake; INTAKE.32 covers the folder.
  > INTAKE.4 — `pm_skills/scaffold/gen-file-map.mjs` silently drops wrapped role descriptions — it keeps only the first line of a multi-line entry, so re-running it flattened six `reviews/` roles to "(role needed)". (canon provenance: 2026-08-27 UI-02) — (from: INTAKE, 2026-10-01)
- **INTAKE.5** — v3's esbuild watch build. Q21 adopts the editor stack (Vite), which replaces build.js and what its dev build leaves in docs/.
  > INTAKE.5 — `npm run dev` leaves `docs/player.js.map` behind: the watch build emits a player sourcemap the production build's 17-file inventory does not, so the generated tree drifts from what is published. (canon provenance: 2026-08-27 ROUTE-01b) — (from: INTAKE, 2026-10-01)
- **INTAKE.8** — v3's dev-server scripts. Q21's stack (Vite) replaces them, and Q5 puts v4, with its own scripts, at the root.
  > INTAKE.8 — `npm run serve` serves the unbuilt source shell at `/` (only `/docs/` runs the app) and `start` duplicates `dev`: fix or remove both (plan SEG-026). (canon provenance: 2026-09-22 DOC-02) — (from: INTAKE, 2026-10-01)
- **INTAKE.9** — v3's dev-server script. Q21's stack replaces it; the readiness rule itself is rewritten with the signed lines for v4 (Q5).
  > INTAKE.9 — `restart.sh` proves only that the server answers, while AGENTS' recovery rule asks it to verify readiness, which DEV-INFRASTRUCTURE defines as no console errors and a rendered version stamp. (canon provenance: 2026-09-22 DOC-02) — (from: INTAKE, 2026-10-01)
- **INTAKE.11** — v3's test harness. Parts 3 and 4 were paid by UI-06; Q23 runs v3's suite only when frozen v3 code changes.
  > INTAKE.11 — `bootApp`'s teardown is incomplete, four ways. (1) It returns before `app.ready` resolves and never awaits it, so a pending startup from one test can install bus listeners during the next; tests that touch the UI must await `ready` themselves today (2026-09-23 TST-06, Codex review). (2) `backgroundModeOverlay.test.js`'s `bootPlainRoute` never awaits `app.ready`, so startup's console output can race the worker's teardown: once, under load, 11 `EnvironmentTeardownError`s failed `npm run check`, and the rerun passed; awaiting each app's `ready` in `bootApp`'s teardown would cover every file (2026-09-26 DEF-33 review). (3) It leaves each app's `document` keydown listener attached, so in a file that boots several apps an earlier one claims a key (`preventDefault`) before the current app sees it; DEF-21's test calls `app.interactionHandler.handleKeyDown` directly to get round it (2026-09-23 DEF-21). (4) `goldenDrawLogs.test.js` grows its heap through the whole file (a peak of about 1.8 GB, of the test worker's 4.3 GB), because booted apps are never let go, probably through that keydown listener; DEF-38's first draft ran the gate's worker out of heap until `takeFrame` dropped the frames it takes (2026-09-28 DEF-38). (canon provenance: four lines merged 2026-09-28) — (from: INTAKE, 2026-10-01)
- **INTAKE.14** — a v3 test-harness oddity never seen in a browser, probably explained by UI-06's trap stack. Q23 parks v3's suite.
  > INTAKE.14 — ⌘S delivered for real to a booted app under jsdom opens the save dialog and overflows the stack; unexplained, and not seen in a browser. DEF-21's test records the bus events with a no-op `eventBus.emit` spy instead. (canon provenance: 2026-09-23 DEF-21) — (from: INTAKE, 2026-10-01)
- **INTAKE.20** — a flaky v3 test. Q23 runs v3's suite only when frozen v3 code changes.
  > INTAKE.20 — `bootApp`'s "bundled example background loads" waits `vi.waitFor`'s default 1 s, and timed out once (1.75 s) on a loaded machine during a mutation run; a longer wait would stop it flaking. (canon provenance: 2026-09-25 DEF-35, part B) — (from: INTAKE, 2026-10-01)
- **INTAKE.23** — a stale v3 header comment. Q2 freezes v3.
  > INTAKE.23 — `AreaDrawingService`'s header names an event that does not exist (`canvas:click-intercepted`) and credits `AreaHighlightRenderer` with the preview, which `RenderingService` draws. (canon provenance: 2026-09-26 DEF-17 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.24** — two unused v3 constants and a stale README row. Q2 freezes v3.
  > INTAKE.24 — Two unused constants: `AREA_HIGHLIGHT.DRAW_VERTEX_HIT_RADIUS` ("snap radius for closing polygon"; closing uses `DRAW_CLOSE_THRESHOLD`, in image units) and `INTERACTION.DOUBLE_CLICK_TIME`, which README's constants table still advertises ("double-click 300 ms"). (canon provenance: 2026-09-26 DEF-17 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.25** — help-only metadata in v3's key table. Q1 and Q21 write v4's controls new, each feature owning its own.
  > INTAKE.25 — The playback `action` names in `keybindings.js` are help text only, not the events the app emits (`InteractionHandler` emits `ui:animation:toggle`, `animation:jkl-*`, `ui:animation:skip-*`); K's is `animation:pause`, the engine's own state event, so a dispatcher built on them would announce a pause without pausing. (canon provenance: 2026-09-26 DEF-33 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.27** — a v3 developer script. Q2 freezes v3 and Q21's stack brings v4 its own tooling.
  > INTAKE.27 — The perf harness silences autosave, but Clear All after a benchmark clears storage directly (`projectReset.js:75`) and so deletes the restored recovery point, and a reload comes back empty; also suppressing `clearAutoSave` for the page's life was verified to fix it. (canon provenance: 2026-09-26 DEF-30 review) — (from: INTAKE, 2026-10-01)
- **INTAKE.28** — a dead path in v3, with no caller. Q2 freezes v3; Q12 has v4's features meet through the core's contact points.
  > INTAKE.28 — `EventBus.emitAsync` neither awaits an async `once` callback nor passes on its rejection, because the wrapper returns nothing; it does both for an `on` listener. No caller today. (canon provenance: 2026-09-26 DEF-30 review) — (from: INTAKE, 2026-10-01)
- **DEF-53.1** — a v3 test comment. Q2 freezes v3; Q23 runs its suite only when v3 code changes.
  > DEF-53.1 — Reword DEF-53's held-export test comment so the 100 ms wait reads as fixture settling: export startup already cancels the pending 50 ms re-timing (exporting.js, pathTiming.js), so no re-timing can land mid-export there — (from: DEF-53, 2026-10-05)
- **SPL-06.1** — a test host for v3's build and release scripts, which Q21's stack and Q15's publishing replace.
  > SPL-06.1 — Widen SPL-06's build host if a check ever needs it: it compares listener counts, not identities, and does not watch process.argv, process.title or functions returned by accessors; the tests claim only the APIs and state it names — (from: SPL-06, 2026-10-05)
- **DEF-77.2** — one v3 hint's wording. Q21 writes v4's controls new; the finding is input to v4's interface.
  > DEF-77.2 — A traced network's nodes are pinned to their waypoints, but the node hint says "Choose Edit network to move nodes" (a candidate, unverified) — (from: DEF-77, 2026-10-05)
- **UI-03.2** — one v3 control's styling. Q21 adopts Carbon React for v4's hints, and Q22's accessibility gate tests them.
  > UI-03.2 — In forced-colours mode a parameter hint has no visible border — (from: UI-03, 2026-10-05)
- **UI-03.3** — the behaviour of one v3 control, which Q21's stack writes new; the advisory is input to v4's hints.
  > UI-03.3 — A click on a hover-opened hint closes it, so the first click of a double-click meant to select its text dismisses it (Codex, UI-03 review r2, advisory) — (from: UI-03, 2026-10-05)
- **UI-03.4** — a v3 interface test gap that two other tests already cover. Q23 parks v3's suite.
  > UI-03.4 — The test of Escape in a scene-outline field checks where focus lands, not that the form resets (Codex, UI-03 review r2) — (from: UI-03, 2026-10-05)
- **TST-14.1** — a v3 interface test gap. Q21 writes v4's menus new and Q23 parks v3's suite; the rule it guards is input to v4.
  > TST-14.1 — Context-menu Insert before/after and Rename on a multi-selection: today's tests use one selected waypoint, so a mutant acting on the primary instead of the right-clicked waypoint survives (TST-14 round 3, advisory) — (from: TST-14, 2026-10-05)
- **TST-08.1** — a guard on v3's prototype mixins. Q1 enforces module edges in v4's gate, and Q21 brings dependency-cruiser for it.
  > TST-08.1 — Mixin guards: a built-in reached another way (a global handed to a service, `Function.prototype.bind` itself), a function changed through `Object.assign(f, src)` with a non-literal source on an alias, and `window.app` outside `main.js` and `src/app/` stay unchecked (TST-08 round 3) — (from: TST-08, 2026-10-05)
- **DEF-45.1** — v3 suite speed. Q23 runs v3's suite only when frozen v3 code changes.
  > DEF-45.1 — `tests/areaDrawTarget.test.js` waits on the real clock for the load's announcements to play out (about 26 s added to the gate); a fake clock would make it fast (DEF-45 round 3) — (from: DEF-45, 2026-10-05)
- **TST-04.4** — a guard inside v3's control-golden harness. Q23 runs v3's suite only when frozen v3 code changes.
  > TST-04.4 — TST-04's evaluated-modules guard takes its last "before" snapshot inside `recordHandlers()`: an import inserted after it, before the remaining patches, would pass; take one more snapshot just before the permitted imports (Codex, TST-04 review r9, advisory) — (from: TST-04, 2026-10-06)
- **TST-04.5** — a limit of v3's control-golden harness. Q23 parks v3's suite; sequences of actions are a note for v4's own tests.
  > TST-04.5 — TST-04's isolated mode replaces an app whose booked frame was dropped, so a stuck-frame defect seen only on a later action in the same app is not caught; isolated equivalence covers single actions, not uninterrupted sequences (Codex, TST-04 review r9, advisory) — (from: TST-04, 2026-10-06)
- **DEF-28.2** — a real-clock deadline in one v3 test; Q23 runs v3's suite only when frozen v3 code changes, and Q2 freezes that code.
  > DEF-28.2 — `tests/unrestoredAutosave.test.js`'s two real-clock waits for an idle live region have an 8 s deadline that a loaded machine could miss; a controlled clock would remove that (Codex, DEF-28 review r12, advisory) — (from: DEF-28, 2026-10-06)
- **CROWD-06.1** — v3 dead code; under Q1 the port moves only what v4 uses, so waitForCrowdMs and its tests stay behind in frozen v3 (Q2).
  > CROWD-06.1 — `waitForCrowdMs` (src/utils/crowdArrival.js) is unused by the app since CROWD-06 retired "Wait here for this crowd"; W4's dead-code pass may remove it with its tests under its mutation criterion — (from: CROWD-06, 2026-10-06)
- **UI-04.1** — it documents one v3 control; under Q21 v4's help comes with Carbon React and is written new. The file's budget is re-signed with the rules (Q5).
  > UI-04.1 — UI-STANDARDS § Help could name the "?" hint trigger (UI-04), but the file is at 1,848 of its 1,850-word budget; a trim or a budget raise first — (from: UI-04, 2026-10-06)
- **DEF-81.1** — suite speed. Q23 runs v3's suite only when frozen v3 code changes and passed over making it faster; the 14-of-30 figures are stale.
  > DEF-81.1 — Verify runs about 14 minutes of its 30 (DEF-81): TST-11's `buildScriptMain` runs six real builds and TST-03's goldens add about a minute; a faster suite (fewer real builds, or the slow suites split into a job of their own) would keep it well inside — (from: DEF-81, 2026-10-07)
- **TST-11.1** — v3's developer perf harness, replaced with Q21's stack; Q8 gives v4 storage of its own and Q2 freezes v3. Sibling of INTAKE.27.
  > TST-11.1 — The perf harness silences `app.autoSave`, but DEF-28's Discard of a held offer (`where === 'held'`, `unrestoredAutosave.js:452`) writes the editor's project to browser recovery through `saveRecovery()`, which the harness does not silence: the editor booted over a held record, a benchmark stopped after its route phase (the probe made `addCrowd` throw), the editor then holding 12 synthetic waypoints, then Discard left `routePlotter_autosave` holding those 12; an ordinary kept offer's Discard writes nothing, and whether a finished benchmark (2,000 waypoints) does the same is unprobed (the class of the Clear All line above) — (from: TST-11, 2026-10-06)
- **DEF-81.2** — a v3 test-harness timeout; Q23 runs v3's suite only when frozen v3 code changes, and v4's build tests are written new (Q21).
  > DEF-81.2 — `tests/publicationBoundary.test.js:59` and `tests/releaseSafety.test.js:24` call `spawnSync` with no subprocess timeout, so a stuck child blocks the worker and only CI's job limit stops it (Codex, DEF-81's review) — (from: DEF-81, 2026-10-07)
- **GATELESS-1.3** — nothing rests on them. "Tonight" and no resumption are spent; agents together sat within a run he stopped on 19 October; v4's builder is his 18 November word.
  > GATELESS-1.3 — The owner to confirm the run's three readings of his chat 12 words ("whole hog", "tonight", no scheduled resumption) — (from: GATELESS-1, 2026-10-08)
- **GATELESS-1.4** — nothing rests on them. Three are spent one-offs of 8 October; 707's export debt was met in page by 708 and by his 11 October save; Q2 freezes v3.
  > GATELESS-1.4 — The owner to confirm the run's readings of his chat 13 words (one release for three merges; the halt replaced; Phase 3's record left to its chat) and REL-708's retiring of v3.2.707's owed export check — (from: GATELESS-1, 2026-10-08)
- **UI-06.1** — the layout of v3's canvas area, which v4 writes new on Q21's stack (Q1); Q2 freezes v3.
  > UI-06.1 — A real-window resize check at 2560×1440: in the desktop app's emulated viewport the canvas stayed at 718 px until a resize event was dispatched by hand; unverified in a real window — (from: UI-06, 2026-10-08)
- **PLAN-3.1** — the readings set how v3's reviews ran, and he answered their question rounds; Q2 freezes v3, so what is left of Phase 3 feeds v4's interface instead.
  > PLAN-3.1 — The owner to confirm PLAN-3's filing-session interpretations and proposed review sequence and method — (from: PLAN-3, 2026-10-08)
- **UI-06.2** — a limit of v3's pane-side checking; Q22 puts Playwright checks in a real browser in v4's gate, where the exported player is served.
  > UI-06.2 — The exported player could not be run inside the editor's page (its inline script is blocked by the editor's CSP); a pane-side check of its playback needs a served copy — (from: UI-06, 2026-10-08)
- **UI-06.3** — a flaky v3 test; Q23 runs v3's suite only when frozen v3 code changes.
  > UI-06.3 — `npm run check` once ended in an unhandled EnvironmentTeardownError from `tests/waypointListFocus.test.js` (a vitest worker torn down while that suite's console output was still forwarding); the same bytes passed on the rerun and the suite passes alone — a worker-timing flake to pin down — (from: UI-06, 2026-10-08)
- **UI-06.4** — a timing margin in one v3 test; Q23 runs v3's suite only when frozen v3 code changes.
  > UI-06.4 — One gate run of the words PR failed a load-sensitive case in `tests/announcements.test.js` once under two parallel suites; it passed alone and under load afterwards — a timing margin to find — (from: UI-06, 2026-10-08)
- **UI-06.5** — a retention in v3's test harness; Q23 confines v3's suite to frozen-code changes, and ported tests are set up anew on Q21's stack.
  > UI-06.5 — `MotionVisibilityService.initRevealMask` replaces its canvas, so a test harness that releases an app's recording contexts by the canvases the app holds leaves earlier masks unreleased (a retention, not a wrong release; Codex, words PR r3) — (from: UI-06, 2026-10-08)
- **REL-711.1** — the layout of one v3 list, which v4 writes new with Carbon React (Q21); Q2 freezes v3.
  > REL-711.1 — The right sidebar's waypoint names break mid-word at a 1,200 px viewport ("Waypoi / nt 1", "Main entranc / e") on live v3.2.710 and v3.2.711 alike: the list's name column has no minimum width or word-break rule; pre-existing, seen while checking PR 2's narrow layout — (from: REL-711, 2026-10-08)
- **UI-06.8** — the wording of one v3 control, the scene outline, which v4 writes new (Q1, Q21); Q2 freezes v3.
  > UI-06.8 — The outline's bend messages still say "bend point" ("Bend point added.", "Bend point N updated.", "Bend point deleted. Undo available.", "That bend point no longer exists."; `src/app/sceneOutline.js` (:418, :808, :815, :825, :842, :869)), a word the glossary retires under Bend (`tests/uiStrings.test.js` (:47)), where the outline's own entries say "Bend N" — (from: UI-06, 2026-10-11)
- **UI-06.9** — v3 dead code in the interface wiring, which Q1 does not port; Q2 freezes v3.
  > UI-06.9 — `src/app/wiringControllers.js` (:633–668): the first `waypoint:add-at-center` handler is dead, since `this.backgroundImage` is never set and it returns at once; the second (:1288) adds the waypoint; PR 8 touched the first only to respell its announcement "centre", as it did the second's — (from: UI-06, 2026-10-11)
- **UI-06.10** — teardown of v3's app shell, met only by tests; Q1 writes v4's shell new and Q23 confines v3's suite to frozen-code changes.
  > UI-06.10 — `destroy()` leaves the app's own window `resize` listener, added anonymously (`src/main.js` (:531)), so a resize after it runs against the destroyed app and throws; `stopApp` releases it as a boot listener, so no test meets it; older than PR 6, whose round 2 found it (Codex r2: keep the handler, remove it in `destroy()` and test a resize after) — (from: UI-06, 2026-10-12)
- **UI-06.12** — v3's test harness and where it writes; the clone no longer sits in OneDrive, and v4's Vite and Vitest set-up is new (Q21).
  > UI-06.12 — Every Vitest run, single files and the gate, has Vite bundle `vitest.config.js` into `node_modules/.vite-temp` and delete it, so through the worktrees' `node_modules` symlink it writes, briefly, inside the OneDrive clone; older than PR 6, whose round 4 saw it (Codex r4: importing the config directly with `config: false` runs without the temporary file; Vite 8's `--configLoader runner` untried) — (from: UI-06, 2026-10-12)
- **UI-06.14** — a timing property of v3's event-transcript harness; Q23 runs v3's suite only when frozen v3 code changes.
  > UI-06.14 — The event transcripts inherit the announcement queue's real 2 s hold (`src/utils/announcementQueue.js` (:81), its callback at (:86)), a real timer still pending in every row when the fake clock takes over; only `quietAnnouncer` reads the region and it waits the hold out, so no row records it today, but a runner that held a row past 2 s of real time could show it (PR 6 round 6's question 1; Codex r6: no CI risk to today's rows) — (from: UI-06, 2026-10-12)
- **UI-06.15** — dead CSS in v3; v4's styles are written new with Carbon React and Sass (Q21).
  > UI-06.15 — The two dormant `body[data-mode="preview"]` rules (`styles/main.css` (:4257–4260), (:4262–4264): the left sidebar hidden, the canvas area across every column) match nothing, since no page sets `body[data-mode]`; PR 6 keyed the Preview badge to its own `hidden` instead (Codex r1) and left them as they were, dead CSS for W4 — (from: UI-06, 2026-10-12)
- **CROWD-08.1** — isolation in v3's control-golden harness; Q23 runs v3's suite only when frozen v3 code changes.
  > CROWD-08.1 — The isolated control-golden toast-dismiss row fails on main too: focus is #toast-container rather than #timeline-slider; preserve the assertion and investigate test isolation — (from: CROWD-08, 2026-10-14)
- **CROWD-08.2** — a tidy of v3's Duration wiring, left "for the refactor"; Q1 shrinks REFACTOR-01 to the port, and v4 writes this control new.
  > CROWD-08.2 — Clear All writes the Duration thumb three times synchronously as it crosses below two waypoints and resets the base; accepted for the MVP, simplify that sync sequence in the refactor — (from: CROWD-08, 2026-10-14)
- **CROWD-08.5** — the state of one v3 control; Q11 makes a route plain geometry, so Follow route against a custom network does not carry into v4.
  > CROWD-08.5 — Outline Start/Finish area controls remain enabled on Follow route, while the area setter refuses that inactive network with a Type-only reason; observed in Part D browser QA and present before D — (from: CROWD-08, 2026-10-15)
- **CROWD-08.8** — the layout of one v3 header, which v4 writes new (Q1, Q21); Q14 keeps v3 files out of v4, so no import brings the long name.
  > CROWD-08.8 — A very long imported crowd name can expand the left scope header until Settings has zero height; independently reproduced on the pre-G Part F build, unjudged — (from: CROWD-08, 2026-10-16)
- **REL-723.1** — v3 test time limits; Q23 runs v3's suite only when frozen v3 code changes, and the clone already runs outside OneDrive.
  > REL-723.1 — The local gate's slowest jsdom tests exceed their time limits when other work or OneDrive sync loads the Mac: labelInName's shell test and three keyTable tests (10 s, Vitest's default, as `vitest.config.js` sets none) and goldenControls' "major" row (180 s); this stopped v3.3.723's release three times before any commit, while CI and a quiet machine passed. Give them headroom, or run releases outside OneDrive — (from: REL-723, 2026-10-18)
- **UI-08.2** — how v3's Background card behaves while the image is hidden; v4 writes that control new (Q1, Q21), and Q2 freezes v3.
  > UI-08.2 — With Show image unticked, Darken / lighten and Zoom stay live: the tint shows nothing until the image is shown, and Zoom still moves the route with the hidden image's place; unjudged — (from: UI-08, 2026-10-19)
- **REL-726.2** — v3's release scripts; Q15 publishes v4 on merge and Q2 freezes v3, whose next release is a zip. The two scripts sit outside the repository.
  > REL-726.2 — release.sh and release-from-push.sh do not keep the Mac awake: a lid closed on battery slept it mid `npm run push` and timed out seven tests (REL-726); nothing was pushed, but the check had to run again; unjudged — (from: REL-726, 2026-10-19)

## Promoted, narrowed, parked and kept

Promoted wishes stay in the wish list until the v4 plan gives each an item.

| ID | Disposition | Where | Why |
| --- | --- | --- | --- |
| REV-03 | re-park | when v4's pointer input exists and the owner has an Android phone to hand | Q1 ports only the engine, so v4's pointer input is new code and a pass on v3's would prove little; Q2 freezes v3. |
| REV-05 | re-park | before v4.0 is declared, with Q22's extended depth | Q22 puts screen-reader evidence in v4's extended depth before v4.0 is declared; manual passes on frozen v3 (Q2) would test an interface v4 replaces. |
| REFACTOR-01 | narrow | the port: which pieces of v3's engine move into v4, how, and with which tests; written as one plan with MERGE-01 | 'Port v3's engine (drawing, timing, crowds, export, file safety) into it with its tests'; 'shrink REFACTOR-01 to match'. Q2 ends refactoring v3 in place. |
| MERGE-01 | promote | the v4 programme's first item, the architecture plan | Q1's rebuild makes this the architecture plan; Q10, Q11 and Q12 leave it the model, each feature's home and the contact points to settle first. |
| EX-01 | narrow | one built-in scene for each of the five presets, made and exported in v4: v4.0's bar, scheduled by the architecture plan (MERGE-01) | Q19 and Q24 give the direction it waited for, for v4: one scene per preset is v4.0's bar. v3's examples stay frozen (Q2); the riot march returns later. |
| AI-01 | keep |  | Stays where you put it, "medium term". v4 gets a new save format (Q14), so it cannot start before that format settles; the architecture plan reads it as an input. |
| REV-07 | keep |  | Q23 names what the new gate holds and REV-07's coverage thresholds, Node matrix and update automation are not in it; adding them would re-scope his answer. It stays in the Icebox, its own trigger unchanged; Q21's new packages are a reason to raise it when the gate item is planned. |
| ICE-01 | keep |  | Stays in the Icebox with its own trigger. The palette it concerns is v3's, but dormant is no reason to retire and the same need could show in v4's panel. |
| ICE-02 | keep |  | Already triaged into the Icebox with its own trigger, "promote only on user demand"; nothing in the vision changes that, so it stays where it is. |
| INTAKE.10 | promote | the publish-on-merge set-up (Q15) | Q15 makes each app merge publish, so who may change docs/ and version.json is settled there; this guard belongs in that set-up. |
| INTAKE.32 | keep |  | unpaid, and not v3 app code. It waits on the owner's word; Q5's move of v4 to the root is the moment to ask. |
| GATELESS-1.1 | promote | the signed-lines redraft with PLAN-5 | Q5 has the brief and rules largely rewritten for v4 and re-signed; that redraft replaces both stale lines. |
| GATELESS-1.2 | promote | the signed-lines redraft with PLAN-5 | Q5 has the profile rewritten for v4 and re-signed; its Conventions line drops or reconciles "PM: summary" there. |
| REL-720.1 | promote | the publish-on-merge set-up (Q15) | Q15's every-merge-publishes changes what a deploy commit is; its shape and the commit checker are reconciled there. |
| CROWD-08.6 | promote | DEF-101 | On the owner's word of 2026-11-18 it is fixed in v3, the exception his freeze allows (Q2), with a new zip for Xerte; v4 must pass the same check when it ports saving. |
| EX-03.1 | re-park | after v4.0, when the riot march returns (Q24) | no rule names an example upgrade. Q2 freezes v3's examples and Q24 says "the riot march returns later", so it waits for v4.0 and his direction. |
| DEF-99.2 | keep |  | an unanswered question to the owner, so no check can be written yet; once he answers it is R2's (Q2), on Q19's match-day crowd. |
| REL-726.1 | keep |  | the one saved-file check left for frozen v3 (Q2), on the build in the Xerte zip; earlier releases' owed checks merge here. |
| V31-UPGRADE.1 | promote | the signed-lines redraft with PLAN-5 | Q23 redrafts the profile's Gate line for his signature; the checker's name is corrected in the same redraft. |
| V31-REFRESH.1 | keep |  | 61 live decisions against 45, and PLAN-5 adds more; the rules allow archiving only on his word, so ask it in the batch. |
| V31-REFRESH-4.1 | promote | the signed-lines redraft with PLAN-5 | Q5 and Q21 rewrite the profile for v4 and he re-signs it; his signed Harness sentence and the budget go in that redraft. |
| REFRESH-501.1 | keep |  | true and small, about six headings a start read; the remedy is pm-skills' own tool or his word on the headings, not v4 work. |

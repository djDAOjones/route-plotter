# Decision Log

<!-- Append new decisions at the top. Don't edit old entries. -->

## 2026-09-28 — the big run, amended: Joe answers what it would have parked

**Joe's answers, 2026-09-28,** to the calls "the big run" left parked:

1. **The pause's range (Q19):** "go with your recommendation". The true range
   is the scene outline's 0–600 s; the slider stays a 0–30 s fine control, so
   nothing that loads or can be entered today is refused or cut short.
2. **Files from other versions (Q18):** "no backwards compatibility needed
   now, but we should start to design with it in mind", then "refuse newer,
   drop older. for now. start to plan compatibility so that from now on old
   versions can be imported and upgraded". A newer-version file is refused
   with a clear message and never re-saved; Q18's "allow viewing" is
   withdrawn. An earlier-version file no longer has to load: the run may drop
   old-format handling, naming each drop in its PR, and refuses such a file
   with a clear message; a refused autosave gets DEF-28's notice, never
   today's silent clear of an older record (DEF-28's own treatment, applied).
   DEP-03 and ABS-06 plan compatibility from here on:
   one format version, one gate, and a version bump with a tested upgrade step
   for each later format change, written into `architecture.md`. **The
   agent's reading, for Joe to confirm:** the promise starts with the run's
   release, so files saved by v3.2.692 aren't covered.
3. **Devin and Windsurf:** "dont use anymore". DOC-08 deletes `.devin/` and
   `.codeiumignore`.
4. **`_Joe/`:** "you rename or delete". The run deletes DEL-07's two scripts
   and, once DOC-08 has moved its valid parts out and retired AGENTS.md's
   read, the dev guide. Nothing else in `_Joe/` changes.
5. **Defects found on the way:** "fix defects along the way". Each gets a DEF
   row with its evidence and its own PR stating the new behaviour, under the
   merge bar; no longer proposed and parked.
6. **DEF-07:** "I dont need to see the old camera feel". No side-by-side; it
   merges under the bar, and ABS-03's camera half follows it.
7. **Browsers:** "we can skip firefox and safari checks and call this a
   chromium only app for now". REV-04 closes on its Chromium evidence
   (2026-09-24), REV-03's physical pass is Android Chrome alone, and README
   says so.
8. **The wish-list** keeps its items (see the maintenance entry below).

**Approval.** "The big run" approved each row's treatment as it read when #51
merged; it now reads as of this entry's merge (#53), which adds the above as
dated notes on CON-14, ABS-06, DEF-07, DOC-08, DEL-07, §12.1, §13 rule 3, W10,
§17 and §20 Q5, Q16, Q18 and Q19. The run's hard-prohibition approvals gain the
old-format drops and the three `_Joe/` deletions. The rest of "the big run"
stands, its merge authority included.

## 2026-09-28 — memory maintenance: the era before the programme goes cold

Joe called a maintenance pass before the big run starts. **Diagnose** (all 13
checks) failed three budgets: the decision log at 31 live entries (budget 20),
the trajectory at 2,159 words (2,000) and the wish-list at 35 open items (25).
The rest passed: the file-map is 5,945 words against 11,970 (342 mapped files
× 35), and every mapped path is on disk; the backlog's Active lane is 1,381
words and 39 items; the archive index lists every chunk; the trajectory's
seven decision-log pointers resolve; there are no lite closes and no open doc
deltas. PM-Skills stays 4.7.0 (Joe, 2026-08-27; not raised again). REV-03,
REV-04 and REV-05 have waited on owner evidence since 2026-08-26.

**Prune, approved by Joe.** Fifteen entries from 2026-08-27 to the morning of
2026-09-22, the era before the abstraction programme, moved verbatim to
`archive/decision-log-2026-08-27-to-2026-09-22.md`, and the trajectory's seven
phases from those days (release v3.2.690 back to the programme close-out) to
`archive/trajectory/trajectory-0004-2026-08-27-to-2026-09-22.md`. Five of
those days' entries stay live because open work cites them: the prune bar
(AGENTS.md and the big-run prompt); ROUTE-01d, ROUTE-01b and the branch
wait-index rule, which the plan quotes for DEF-05, CON-09 and TST-07; and the
accessibility audit, which, with the accessibility-assurance trajectory phase,
is REV-05's evidence boundary, as Joe kept them on 2026-09-22. The live log
goes from 31 entries to 16 before this one, and the trajectory from 2,159
words to 1,555. Both splits were verified lossless before the swap.

**The wish-list keeps its items,** by Joe's call: "keep the wish list items
(except where naturally consolidated or deleted)". Four lines on `bootApp`'s
teardown became one, so 35 open items are now 32, over budget by his choice.

## 2026-09-28 — the big run: Joe answers the open calls, and delegates merges and planned fixes

**Joe's calls, 2026-09-28,** in two question rounds:

1. **DEF-28, option A** (#44): announce a failed restore; a notice offers
   **Download it** and **Discard**; the record moves to a storage key autosave
   never writes. Clear All discards it too. If storage can't also hold a new
   autosave, it stays, and the autosave failure report points to the notice.
2. **DEF-40 to DEF-46 accepted,** each by its row's first remedy: P2 for
   DEF-40, 41, 44 and 46; P3 for DEF-42, 43 and 45.
3. **TST-04 lands before W4,** and W4's characterisation mutates every branch
   of each moved function and accounts for every survivor.
4. **Budgets:** the run archives the trajectory's oldest phases at wave
   closes without waiting, keeping phases that feed open work. This log stays
   over budget by Joe's choice; wish-list triage stays Joe's.
5. **Scope:** `### Next` through W12; later P3 rows are follow-ups.
6. **One release, at the run's end:** the exact candidate first passes a
   Chromium smoke test with a real MP4 export, then DEV-INFRASTRUCTURE →
   Deployment runs in full. If it fails after publishing, the run rolls back
   as Deployment prescribes (a branch at `v3.2.692`, Pages pointed at it),
   then stops. Firefox and Safari stay Joe's.
7. **The Browser pane** may serve checks all run, through the temporary
   `launch.json` entry, restored after each use.

**A standing merge authority, for this run.** The agent squash-merges its own
pull requests, close-outs and reverts included, when Verify is green on the
head; `npm run check` passes with the current `main` merged in; an
independent review saw that head, or every substantive change since, and
each finding is fixed or rebutted; the mutation table is complete; the diff
has no `docs/` or `version.json`; and the goldens moved only as the PR
predicted. Merges are serialized, each new `main` verified. A PR short of
that waits for Joe; the run moves on. It may strengthen its own gates (CI,
`push.js`, test config and reporters, these rules), never loosen them, save
by an exact revert of its own merge that turned `main` red. The authority
ends when the release's record merges, or when Joe ends the run without one;
`AGENTS.md` and DEV-INFRASTRUCTURE now allow such a grant.

**Planned defects are approved in advance,** as their rows read when this
entry merges, and so are §20's behaviour-changing defaults (Q10–Q13, Q18,
Q19), each quoted word for word in its new DEF row. Still Joe's: DEF-07's
camera feel; whatever a row or default leaves open (Q18's viewing mode, Q19's
pause range); defects found on the way. The run is `task.md`'s gateless
`auto-jazz` with refactor mode's contract, parking where task.md would stop;
the rows' persisted-format changes, Q8's deletions and TST-11's replacements
count as approved. Each PR closes full; an item closes when its whole scope
has merged; each wave gets one entry here.

**Scheduling** (refines DOC-06 (i) and the 2026-09-23 entry): `### Next`
holds W5 with SPL-06 (TST-11 needs it), W4 behind TST-04, ten defects
runnable now, DEF-06 among them (DEF-08 made its leak visible, so it lands
before the release), and seven awaiting a W5 test. Later waves enter as those
they depend on complete. DEP-03 opens W8: CON-11 and CON-05 need it, so the
plan's order was a cycle.

**Gates that were claims:** ten plan rows and three waves read "owner
decides" for questions answered on 2026-09-22, and TST-11 read ready without
SPL-06; each now has a dated note. #51 lists what two independent reviews
found.

**Link:** `reviews/route-plotter-continuation-prompt-big-run-2026-09-28.md`;
plan §12, §13, §20.

## 2026-09-28 — the post-W2 follow-ups: what a frame leaves behind no longer decides the next

Three pull requests, one item each, merged on Joe's word and not yet released:
DEF-38 (#46), DEF-39 (#47) and DEF-47 (#48). Gate at close: **86 test files ·
1,259 tests · 2 todo · shell 0 · build:check 0** (1,239 when the post-W2 queue
closed).

**Each PR's stated behaviour change.**
- **DEF-38** — a throw in the main canvas's background pass unwinds its saves,
  so the next frame draws what a steady frame draws; frames that do not throw
  are unchanged.
- **DEF-39** — each frame starts the vector layer with round caps and joins,
  so outlines that set neither (area borders, marker outlines, the editor's
  minor dots, a selection rectangle's corners) draw round wherever they drew
  square: on a freshly sized layer until an unzoomed route drew, and for as
  long as a viewport zoom or the camera was on. Each of the 66 draw-golden
  frames gains those two lines; nothing else moved.
- **DEF-47** — the area-drawing preview sets its own blue before its first
  stroke, so its placed edges no longer take the last stroke's colour and
  width.

**Joe, 2026-09-28:** merge #46, #47 and #48; DEF-47, which Codex found in
DEF-39's review, accepted with the preview's blue (P3).

**Codex (`gpt-6-astra`) was available again** and reviewed each PR in a clone
with no remote. Each time it found a hole in the test, not the fix, closed
before the merge. DEF-38's test threw only from canvas calls, so a read moved
between a `save` and its `try` passed; the test now also throws from the
pass's inputs. DEF-39's statement said steady frames were unchanged, but under
a zoom or the camera the square look had lasted indefinitely, and leaving the
fix out under a zoom passed; the statement was corrected and the case added.
DEF-47's own test wrapper hid a preview that leaked its styles, and dashed
vertex rings passed.

**The test harness.** DEF-36's throw helpers now serve both canvases, and
DEF-39 added a drawn view (`takeFrame(host, { state: 'drawn' })`) that compares
frames by what each call draws with. DEF-38's first draft ran the gate's test
worker out of heap: each canvas kept every call it recorded, holding a copy of
the background's data URL once read, and the recorder made a Vitest mock per
gradient. `takeFrame` now drops the frames it takes, and `addColorStop` is a
plain function.

**Found, not fixed** (wish-list lines): the recorder keeps no clip region;
editing overlays inherit their opacity and dash; the draw-log file's heap
still grows as it runs.

**Metrics (§18):** open defects 29 → 27 (three closed, DEF-47 found); tests
1,239 → 1,259; golden diffs only DEF-39's 132 lines; no dependency edge
changed; on Joe's Mac the gate's test run takes 76–81 s (70 s before DEF-38)
and peaks at 1.8 GB of heap (2.2 GB before). **Budgets:** this log is 30/20
live entries, over by Joe's choice; the wish-list is 35/25 and the trajectory
2,159/2,000 words, with a triage pass and archiving still proposed; backlog
Active is 611 words and 4 open items.

## 2026-09-28 — W3's pilot: the slider scales move, and nothing guards the readouts

SPL-01 (#43), behaviour-preserving. The six pure slider functions moved
verbatim from `MotionVisibilityService` into `src/utils/sliderScales.js`,
which imports nothing. `angleToSlider`, uncalled, was deleted as §14.1 says,
and DEF-20's row says where to recover it.

**Preserved contract** (`task.md` refactor mode): no `window.*` global, DOM
id, EventBus event or persisted format changed. The review recorded the same
bytes on both trees for every slider position, reveal sync, real project load
and editor state it drove, and all 15 goldens regenerated identically.

**§14.5's answers.**
1. A reviewer still opens two or three files to understand a readout, but the
   module is 137 lines instead of a 1,619-line service.
2. Plain exported functions were enough: no state, options or imports.
3. **No: nothing but the new table catches a readout regression.** Breaking
   every non-integer readout failed only that table, and breaking three
   migrated call sites failed nothing. The W1 goldens record canvas calls and
   save shapes, not the sidebar. §14.5 makes this a W1 gap to close before
   W4; TST-04 is its home, and it is put to Joe.
4. The ceremony took about 80 minutes of wall-clock time for a 160-line move,
   most of it the independent review; the move itself took about 15.

**The process lesson.** §14.4's single non-vacuity mutation did not prove the
table. Mutating each branch of each moved function found a rule nothing
pinned, that positive readouts from 10 round up, and one row now pins it.
Proposed for W4's characterisation step: mutate every branch of each moved
function, and account for every survivor.

**§14.6:** no invalidation criterion applies, so the broader approach stands.

## 2026-09-28 — the post-W2 queue: the defects W1 left, and what their reviews found

Eleven pull requests, one item each, merged on Joe's word and not yet
released: DEF-34 (#31), TST-17 (#32), DEF-36 (#34), DEF-35 (#35, #36), DEF-08
(#37), DEF-17 (#38), DEF-33 (#39), DEF-30 (#40), DEF-37 (#41) and DEF-29
(#42). Gate at close: **86 test files · 1,239 tests · 2 todo · shell 0 ·
build:check 0** (85 / 1,182 / 3 todo when W2 closed).

**Each PR's stated behaviour change.**
- **DEF-34** — the exported player draws at the project's Graphics scale.
- **TST-17** — test-only: the draw log names the canvas each frame
  composites; 78 golden lines changed by name only.
- **DEF-36** — a frame that throws part-way leaves no stacked transform, and
  a clean frame records exactly what it did.
- **DEF-35** — crowd anchors, dots, area drags and the scene outline follow
  points off the image, within `IMAGE_COORDINATES`.
- **DEF-08** — pop, grow and pulse scale their marker in export, scrubbing and
  pause, not only while playing; the named golden cells changed.
- **DEF-17** — a finished polygon names its waypoint, so the sidebar and the
  outline refresh; the banner no longer promises a double-click.
- **DEF-33** — a cold start announces nothing, and a restored session keeps
  "Previous session restored".
- **DEF-30** — a refused benchmark changes nothing and a failed one says so;
  `EventBus.once` runs at most once, and `off` removes it.
- **DEF-37** — a `null` Graphics scale opens at 1×, and its next save reopens.
- **DEF-29** — a video export draws pulse, ripple and glow as authored,
  whatever the author's reduced-motion setting; the editor and the player
  still hold them.

**Joe, 2026-09-25:** merge #34; DEF-38 accepted at P2 and DEF-39 at P3,
keeping the round caps and joins that steady frames draw; branches may carry
their item's name; Claude watches the PRs it opens. DEF-28 waits on Joe's
design call: what an author sees when a session cannot be restored.

**Codex was unavailable in the cloud container**, so an independent Claude
agent with Codex's falsification brief reviewed each PR from #34 on. It found
a real hole in every one, each fixed before the PR opened. The worst: DEF-29's
hold froze a ripple or glow in the editor after every export; DEF-08's stale
beacons scaled paused frames; DEF-17's listeners trusted a waypoint that might
no longer be selected; DEF-35's outline put a new polygon's corner off the
image for a waypoint on it; DEF-30's `once` still re-ran; and DEF-37's tests
reached the app only through recovery. Several suites were weaker than
claimed, and a mutation now fails each.

**Found, and proposed to Joe:** DEF-40 (an outline entry opens empty on a real
click), DEF-41 (traced bends stay on the image), DEF-42 (a beacon-style change
keeps the old schedule), DEF-43 (a polygon draw outlives its target), DEF-44
(a paused editor never idles, against a hard rule), DEF-45 (announcements
overwrite each other) and DEF-46 (a second export spoils the first). DEF-08's
review made DEF-06's leak visible; its row has a dated note.

**Metrics (§18):** open defects 28 → 29 (nine closed; DEF-37 to DEF-46 found);
tests 1,182 → 1,239; test wall time on this cloud container 148 s at `2fb72ff`
and 166 s with the whole queue (W2's 62.6 s came from another machine).
**Budgets:** this log is 29/20 live entries, over by Joe's choice and
reported; the wish-list is 32/25 open, so a triage pass is proposed; the
trajectory is 2,046/2,000 words, so archiving its oldest phases is proposed;
backlog Active is 822 words and 9 open items.
## 2026-09-24 — W2 closes: projects that would not reopen now do

Seven pull requests (#22–#28), merged on Joe's word and released as
v3.2.692 (entry below). Gate at close: **85 test files · 1,182 tests · 3 todo
· shell 0 · build:check 0** (82 / 1,156 / 7 when W1 closed).

**Each PR's stated behaviour change, approved by Joe on 2026-09-24.**
- **DEF-02** (#23) — the exported player builds `waypointsById`, so a traced
  crowd follows a moved waypoint in HTML exports as it does in the editor.
- **DEF-03** (#24) — waypoints, polygon vertices and area centres authored off
  the image reload, within `IMAGE_COORDINATES` (−10…11); every zoomed-out
  authoring path stops at that edge. `AGENTS.md`'s "0–1" hard rule now says so.
- **DEF-31** (#25) — ids derived from the longest legitimate waypoint ids are
  bounded and unique within a trace; ids that fit never change.
- **DEF-23** (#26) — a saved project and an HTML export carry only the images
  the project references; the HTML page carries no stored filenames.
- **DEF-26** (#27) — every stored hex form draws in the glow, alpha kept, and a
  throwing frame stops neither playback nor redrawing.
- **DEF-21** (#28) — Help and the File menu describe the keys that exist.
- #22 pointed `reviews/README.md` at the current prompt.

**Plan rows patched with dated notes.** DEF-03's example range was too small,
and so was the first choice (−5…6); authoring had no outer bound at all. The
DEF-26 row credited the ISO-02 hook with surfacing render errors; only
listener errors reach it.

**Codex found real holes in four of the five fixes it reviewed**, all adopted
before merge: a missed authoring path and a range too small (DEF-03); crafted
id clashes that silently dropped nodes, and the older `__` ambiguity
(DEF-31); a test hole and an over-promised filename claim, since original image
bytes carry their own metadata (DEF-23); a test hole (DEF-26).

**W2's own validation ran in Chromium on the release candidate:** an HTML
export with a traced crowd whose waypoint had moved, opened from another
origin — one request, every anchored node on its waypoint; Angle of View
Reveal with nothing drawn over the canvas; and DEF-26's probe, a `#f80` glow
played to the end without an error. Joe allowed the temporary
`.claude/launch.json` server for this (2026-09-24).

**The queue after W2** (Joe, 2026-09-24): DEF-34 approved; DEF-35, DEF-36 and
TST-17 accepted; the long label stays DEF-04's. W3 enters `### Next`.

**Metrics against the baseline (§18):** open defects 33 → 28 (DEF-01, 02, 03,
18, 21, 23, 26 and 31 closed; DEF-34, 35 and 36 added); render goldens 0 → 11
(W1); test wall time 44.8 s → 62.6 s. **Budgets:** this log is 27/20 live
entries, over by Joe's choice and reported; backlog Active 1,185 words and 17
open items; trajectory within 2,000 words.

## 2026-09-24 — v3.2.692: W2's fixes go live

**Released on the owner's instruction** ("release all features"), by the
Deployment steps, from a fresh clone. Pages served `main` `/docs`, built at
`4ae5d80`, whose `docs/` tree is identical to `v3.2.691`'s, so that tag
remained the rollback point. Then: gate green, `npm run push:dry-run`,
`npm run push` → `14e3656`, **Verify** green on it, the `github-pages`
deployment at that SHA, **all 22 published files SHA-256-identical** to
`docs/`, and annotated tag `v3.2.692` pushed.

**Smoke test** on the exact published bytes served locally, so the live
site's storage was never touched: ready as "Route Plotter v3.2.692",
`nervous-system-flow` played, and exported to HTML (625 KB, project and
player inlined) and MP4 (773 KB, `ftyp` at offset 4).

**What users notice:** HTML exports put traced crowds on their waypoints;
projects with points off the image, or crowds traced from very long waypoint
ids, open again; shared files leave behind images only undo could reach; a
short hex glow colour no longer freezes playback; Help tells the truth.
**HTML files exported before today keep the player they were made with** —
re-export them to get DEF-02.

**Link:** PRs #22–#28; release v3.2.692 (`14e3656`).

## 2026-09-23 — the backlog's Next lane also carries runnable unwaved defects

**Refines DOC-06 (i)** ("Backlog `### Next` holds only the current wave",
adopted 2026-09-22). W1's close made two things schedulable at once: the W2
wave, and the eight defects in plan §13 ground rule 8's "After W1" slot —
DEF-08, 17, 21, 26, 28, 29, 30, 33. Those are not a wave; the rule says each
lands as soon as its prerequisite exists, and theirs has. A lane that listed
only W2 would have hidden eight runnable P1–P3 defects, so `### Next` now holds
both groups, plus DEF-34 marked as needing Joe. The original purpose stands:
nothing enters the lane until it is runnable, and the plan is never imported
wholesale. `file-map.md`'s description of the plan was corrected to match.

**Two gate flags were false.** DEF-03 and DEF-23 were marked `[gated: owner]`
for §20 Q3 and Q4 — decisions Joe made on 2026-09-22 when he accepted all 22
recommended defaults. The plan's own DEF-03, DEF-23 and DEF-29 rows still
carried pre-acceptance "owner decides" wording, which is where the error came
from; all three now carry a dated note. The backlog's gate vocabulary gained
`[owner: …]` and a warning that a gate is a claim to be checked.

**Codex reviewed the refactored lane and the W2 continuation prompt** and found
seven ways they would have misled the next session. The two that mattered: the
prompt told it to "flip the `todo`s", but a `todo` has no body and the active
test beside it asserts the *broken* behaviour, so the real work is to turn each
characterisation into a regression; and DEF-03's accepted policy contradicts
`AGENTS.md`'s still-live hard rule that waypoints are "0–1", which would stop
an obedient agent or push it to clamp. Reconciling that rule is now part of
DEF-03. Also corrected: the camera snaps only at 1× zoom (so "render until
settled" is bounded, not impossible), `authoredExtras` carries four of the five
non-`none` beacon styles and not `pop`, and the release rules had lost the two
owner-authorised exceptions to "never push `main`".

**Budgets:** Active is 1,418 words against a 1,500 soft cap, 19 open items
against 40. The decision log is 29 live entries against 20 — over by Joe's
standing choice, reported, not pruned.

## 2026-09-23 — W1 closes: the safety net is built

Six pull requests (#11, #14, #15, #16, #18, #19), all test-only. Nothing a
user sees changed, and `main` is at `180d354`; the live site stays v3.2.691.
Gate at close: **82 test files · 1,156 tests · 7 todo · shell 0 ·
build:check 0** (was 72 / 1,065 at the programme's baseline).

**The preserved contract of each PR.**
- **TST-01** (#9, #11) — boot harness and a browser-true `setup.js`. No `src/`
  change; existing assertions untouched.
- **ISO-02** (#14) — `new EventBus({ onListenerError })` and counters, with
  today's default (log and continue) unchanged.
- **TST-10** (#15) — strict bus in tests, a console guard, the min-count
  canary. No production change.
- **TST-07** (#16) — the player host contract derived from the mixin source,
  and the bundle-closure rule. No production change.
- **TST-06** (#18) — the save shape. `_buildProjectSnapshot` untouched.
- **TST-02** (#19) — the draw log. The only non-test edit is additive and
  opt-in: `tests/setup.js`'s recorder now also keeps a shared cross-canvas
  transcript. `ctx.calls` keeps its shape.

**What is now pinned.** A file golden of the save shape per bundled example
plus an every-field-non-default fixture; `load(save(x)) == save(x)`; the
"authorable ⇒ loadable" property over every slider and select of the shipped
shell, each proved individually to reach the saved project; and whole draw
transcripts for four fixtures × five instants × editor/preview/export, with
`play == seek` and `app == player` at the draw level.

**Two defects were found that the plan did not have, both characterised, not
fixed.**
- **An unbounded label field** produces a project that will not reload
  ("Project contains an oversized text value"). It is DEF-04's class, so the
  DEF-04 row is annotated with it rather than given a number of its own.
- **DEF-34, proposed:** the exported HTML player never calls
  `setGraphicsScale`, so a project authored at any Graphics scale but 1
  exports to video correctly and to HTML at the wrong size. Added to §12.1 as
  **Proposed**, awaiting Joe; the test states it exactly — every differing
  draw line is a width, dash, radius or rect, each out by precisely the scale.

**One thing that looks like a defect and is not,** recorded so nobody
re-discovers it: the editor eases its camera toward the authored centre while
a freshly loaded player starts on it, so the very first instant of a camera
project is the one frame where app and player legitimately differ, and only in
the camera transform.

**`modified` is already owned by the plan** (§13 ⑬, §20 Q12, answered
"restore it", W8). The round trip loses it because the `Waypoint` constructor
restamps unconditionally; TST-06 characterises that rather than adding a
second record of it.

**Codex earned its place twice.** On TST-06 it broke a draft whose
example-only goldens passed while custom-marker assignments and authored
camera zooms were silently dropped, and whose non-vacuity check passed with
twenty selects and four sliders silenced. On TST-02 it found six gaps: capture
that could not see cross-canvas interleaving (compositing the vector layer
before drawing it passed), a warm-up frame that discarded the layer's
persistent scale transform, examples rendered with no background at all,
an uncaptured reveal-mask canvas, a `play == seek` check that compared the
played host with itself, and a false claim in a file header. Each fix was
re-verified by re-running the mutation that exposed it.

**Test wall time is 62.7 s, up from the 44.8 s baseline** — the price of
booting the real app. TST-15 (node environment for pure files) is the lever if
it becomes a nuisance.

## 2026-09-22 — v3.2.691: the debug overlay leaves the live site

**Released on the owner's instruction** ("progress as much as possible without
gating… commit, push, and deploy"), by the GOV-01 steps written this morning,
from a fresh clone: rollback tag `v3.2.690` confirmed live, gate green,
`npm run push:dry-run`, `npm run push` → `fb3426c`, **Verify** green on that
commit, the `github-pages` deployment at that SHA, all **22 published files
SHA-256-identical** to `docs/`, annotated tag `v3.2.691` pushed afterwards.

**DEF-01, the behaviour change.** "Angle of View Reveal" painted a black panel
and four lines of developer text over the canvas every frame — preview, video
export and the standalone player — and had done since the mode shipped.
Reproduced in a browser on a production build of `main` (pixel (20,20) =
rgba(0,0,0,179)), and gone afterwards (fully transparent, no text drawn, and
the string absent from the live bundle). The reveal geometry is untouched:
Codex compared **300 before/after mask transcripts**, all identical.

**Release smoke test** (the exact published bytes, served locally so the live
site's storage was never touched): the `uon-open-day` example opens, its
timeline composes to 12.0 s, stepping the engine advances play, an HTML export
is a 1.98 MB self-contained file carrying the player and snapshot, and an MP4
export completes to a 4.9 MB file with `ftyp` at offset 4.

**TST-01 shipped too** (W1's first item, test-only): a boot harness that starts
the real app from `index.html`, and a `setup.js` that behaves like a browser —
absent keys read `null`, each canvas records its own calls, style state and
resize resets, and mock history no longer leaks between tests. Codex's review
caught a recorder that logged `save`/`restore` without restoring state, which
would have baked wrong values into the render goldens W1 adds next.

**Two process lessons.**
- A pull request stacked on another merged into *its base branch*, not `main`,
  because GitHub had not retargeted it yet, and deleting that branch nearly
  lost the work (recovered by cherry-pick). Open each PR against `main`, and
  merge them one at a time.
- In a Browser pane narrower than 1440 px the app's layout gate collapses the
  canvas, so timings read 0 and a probe looks like a defect. Emulate ≥1440 px
  before judging anything.

**Memory:** this log is 23/20 live entries — reported under the owner's prune
bar, not pruned.

**Link:** DEF-01, TST-01; PRs #9, #11, #12; release v3.2.691 (`fb3426c`).

## 2026-09-22 — W0 closes: no accidental release, and docs that match the code

**Owner calls this wave.** Merges are squash merges, keeping the
`<ITEM-ID>: summary` title; the agent runs each merge only on the owner's
word. No "Protected infrastructure" list: the owner merges every change
anyway. DEF-18's stated new behaviour was approved, including the two typo
routes the plan row missed and the trade-off that `yes=false` in an npm
config makes `npm run push` refuse. Merges and releases are separate calls:
a pull request per concern, and the owner calls each release.

**Each PR and what it preserved** (all text-only except #2; `docs/`,
`version.json` and `src/` unchanged; live bytes still v3.2.690, 22/22 by
SHA-256):

- #1 DOC-06 (a): the `AGENTS.md` branch-and-release rule. No runtime change.
- #2 DEF-18: refuses unknown options, npm settings resembling a dry run, and
  `-n`; reads `dry_run` case-insensitively; runs `npm run check`.
  Preserved: every documented push and dry-run form, the clean-tree gate, the
  generated-path allowlist, argv safety. +6 tests, each failing on the old
  helper; the shared test helper now drops inherited npm settings.
- #3 DOC-06 (b)–(f): Quality gate, 12 framework aliases, the refactor-mode,
  re-pointing, boot-check and prune-bar clauses.
- #4 GOV-01: working setup and eight release steps.
- #5 DOC-02: SEG-030 items 1–14 all closed (item 8 by #3, item 13 earlier).
- #6 DOC-03: the Q15 rule in `AGENTS.md`, `architecture.md` and
  `conventions.md`, with its exceptions listed.

Codex (`gpt-6-astra`) reviewed every PR adversarially and changed five of
them, including two blockers in GOV-01 and two in DOC-03.

**Plan rows patched, with dated notes:** DEF-18 (wider refusal),
DOC-06 (all 12 references, not 3–4), GOV-01 (a branch per concern; releases
called separately), DOC-02, DOC-03, and W0's status.

**Owner call, same day:** the two exceptions DOC-03 found — NetworkEditService
editing the model while only bound for inspection, and AreaEditService calling
an app-supplied coordinate callback — belong to **CON-01** (W9), which already
removes UIController's writes. The plan row and `architecture.md` say so. Also logged as
ideas: `restart.sh` proves only that the server answers; `serve` is broken;
CI could refuse a pull request that touches `docs/`.

**Metrics against the §18 baseline:** open defects 33 → 32; doc
contradictions 13 → 0 known; dangling framework references 12 → 0; tests
1,065 → 1,071 across 72 files. Unchanged: about 46 dead functions, 47
functions over 100 lines, 0 render goldens, 5 source-text test sites, 52 of
77 orchestrator events never exercised.

**Noted:** rapid merges make the Pages builds API report the superseded
builds as "errored"; they are cancelled runs. Check the build for the SHA you
care about. This entry makes the log 22/20: reported under the prune bar, not
pruned.

**Link:** DOC-06, DEF-18, GOV-01, DOC-02, DOC-03; PRs #1–#6; plan §12, §13, §18.

## 2026-09-22 — adopt the codebase abstraction plan, on every recommended default

**Owner's call: all 22 recommended defaults in the plan's §20 are accepted**,
in their words: "agree with all recommendations". The plan is a two-round
Claude (Opus 5) and Codex (`gpt-6-astra`) review at `2e4d78e`: 111 items (33
behaviour defects, each still needing approval of its stated new behaviour,
and 78 behaviour-preserving refactors) in waves W0–W12. Per Q20 it now lives
at `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, and its
§20 is the answer sheet. The answers that shape how the work runs:

- **Q1/Q2 — where work lands.** Every wave runs on a short-lived branch from
  `main`, in a fresh clone outside OneDrive; merges reach `main` in small
  batches, each a tagged release. DOC-06 (a) writes this into `AGENTS.md`
  first, because without it `task.md` step 11 commits and pushes every close
  onto the live `main`.
- **Q8 — tests that pin dead code** are deleted with it, one entry here per
  batch naming each test and symbol. A test that uses a dead symbol inside a
  live assertion is rewritten with its assertions kept. Re-pointing an import
  when code moves is not weakening a test.
- **Q15 — the communication rule** becomes: components reach the app through
  the bus; the app calls components through named public methods; modal tools
  make provisional edits and commit them through events. DOC-03 rewrites it in
  `AGENTS.md`, `architecture.md` and `conventions.md` together.

**How the programme runs in memory** (DOC-06 (i), (j)). Backlog `### Next`
holds only the current wave, W0 now; the next wave enters from the plan's §13
when this one closes. This log gets one entry per wave, listing each PR's
preserved contract, not one per PR, so a programme of about 100 PRs does not
churn it. This entry makes the log 21/20: a note under the prune bar, not a
prune trigger.

**Supersedes** the merge-hold half of "2026-08-27 — owner sets the prune bar,
and holds the merge", which the v3.2.690 release had already overtaken. Its
prune bar stands, and outranks the plan's own budget remarks.

**Memory changes made with this entry** (DOC-06 (g), (h)): `file-map.md` is
marked hand-maintained, because its generator keeps only the first line of
each row, and its counts are corrected; `conventions.md` now gives the commit
format, verify line and gate this repository actually uses; the trajectory and
wish-list headers name the current prompts; and the wish-list's
Duration-slider idea is cut, as it is now the plan's DEF-20.

**Link:** DOC-06, DEF-18, GOV-01, DOC-02, DOC-03; plan §2.9, §12, §13, §20.

## 2026-08-28 — a branch run must not read the trunk's wait index

**Found while re-verifying export for DEPS-01, not by looking for it.** The
ticket asks for an export re-verification after the mediabunny bump; the
export threw instead — `Cannot read properties of undefined (reading 'imgX')`
— on the autosaved branched project. Video export was broken outright for
that shape, and scrubbing to the end of the timeline threw the same way.

**Not caused by this session.** The only app source touched here was
`ParamTooltip.js` and two stylesheets; `RenderingService.js` was untouched
since the handover baseline. Confirmed by diff before diagnosing further, so
the bump was never a suspect.

**Root cause, caught live rather than reasoned about.** Instrumenting
`getHeadDirection` in the browser showed the failing call receiving a
three-waypoint array — `Trent Building, Sports fields, Library`, the *branch
run* — while `animationEngine.state.pauseWaypointIndex` was `4`, an index into
the whole six-waypoint route. `waypoints[4]` was `undefined`, and the guard
checked only `waypoints.length > 1`, never that the index was in range.

**The fix has an in-repo precedent, which is why it is a one-liner and not a
redesign.** `MotionVisibilityService` performs the identical calculation and
already guards it with `pauseWaypointIndex < waypoints.length`; the renderer's
copy — written explicitly to match it ("same as AOV") — simply missed that
clause. Out of range means the wait belongs to another run, so the run falls
through to its own path-based direction, exactly as the AOV path does. The
comment says why the bounds check is load-bearing rather than defensive, so it
does not get "simplified" away later.

**Evidence.** A unit test reproduces the crash from the observed shape (a
three-waypoint run with the wait at index 4) and pins the fall-through, plus
two tests that the guard does not disable the behaviour it protects — an
in-range wait still steers waypoint-to-waypoint. In Chromium after the fix,
export produces a valid 1.78 MB MP4 (`ftyp isom`) and a valid 3.70 MB WebM
(EBML magic) with nothing thrown. Nothing was written to disk: the blob was
captured at `URL.createObjectURL` and the anchor click swallowed.

**Link:** DEPS-01 (whose verification surfaced it), ROUTE-01b, REV-04.

## 2026-08-27 — owner sets the prune bar, and holds the merge

Two owner calls following the memory prune. **Pruning must never harm
development quality**: archive freely once context is closed, but content
still feeding open work — open-item rationale, the active era's trajectory —
stays live, and budget/prune-to targets yield to that bar (today's stopping
points, log at 16/20 entries and trajectory at 91% of budget, are the rule
applied, not an overrun to fix). Post-prune audit confirmed no open item's
needed context went cold: REV-03's archived design entry covers implemented,
green work, with live detail in its ticket. And **review-remediation does
not merge to main yet** — the live site stays on v3.2.618 until the owner
calls the release.

## 2026-08-27 — the accessibility audit, and what it is honest to claim

**Ran and green in production Chromium:** unique ids, every control named,
one h1, no heading-rank skips, a main landmark, `lang`, alt text everywhere,
a polite live region. Contrast measured on every visible text node against its
effective background at the AAA thresholds. Target size on every rendered
control. Reflow at 320 CSS px — the WCAG 1.4.10 equivalent of 400% zoom at
1280 px — with no horizontal document scroll and, after the fix below, no
undersized control.

**Two AAA failures, found and fixed:**
- The Edit/Preview label measured 6.37:1. `--text-03` is exactly 7:1 on white,
  but that label sits on the toggle's own `--ui-02` surface. Moved to
  `--text-02`, now 19.17:1.
- The skip link was 37 px tall. It is the first thing a keyboard or switch user
  reaches, so it now fills the 44 px target.

**Two findings ticketed rather than folded in.** An assurance pass that
quietly turns into a redesign is exactly the failure this programme warns
against, so:
- **A11Y-01** — `ParamTooltip` gives every `[data-tip]` label `role="button"`
  and `tabindex="0"`. That announces ~80 hint labels as buttons that perform no
  action, and obliges each to a 44 px target it does not meet at 96×19. The
  right shape is `aria-describedby` on the control the label describes; that is
  a semantics change across the sidebar and deserves its own run.
- **A11Y-02** — only the UI-02 and ROUTE-01c row affordances declare
  `forced-colors` fallbacks. Selection accent bars, focus rings, the leg "+"
  and beacon colours have none.

**What is NOT claimed.** axe-core was not run: it would be a new dev
dependency, and that is an approval, not an assumption. Forced-colours and
reduced-motion emulation need devtools media overrides this automation cannot
drive. NVDA and VoiceOver remain owner-run by standing policy. The regression
test asserts only what static analysis can settle and says so in its header —
a jsdom "pass" on contrast or a screen reader would be worth less than nothing.

**Link:** REV-05, still `[~]` with a named residual.

## 2026-08-27 — the exported player inherits branches rather than reimplementing them

**Decision:** ROUTE-01d needed almost no new export code. `PlayerApp` already
takes `pathTimingMixin` wholesale, so it builds the same splines and composes
the same master timeline the editor does; the work was carrying `branchPaths`
and `branchTimeline` into its render state and proving nothing is lost in
between. A second, player-local branch implementation was never on the table —
it is exactly how play, scrub and export would drift apart.

**Timeline length:** a terminal branch can outlive the trunk, so
`updateAnimationDuration` now takes the max of the trunk-derived duration and
the composed branch total (plus the same handles, intro and tail, which sit
outside the composition). Without this the route ended when the trunk did and
a longer branch was cut off mid-animation. A branch that fits inside the trunk
changes nothing — it must not pad a route it already fits in.

**Cache correctness:** the composed timeline is a function of geometry *and*
base speed, so its cache is keyed on both. Keying on geometry alone reported a
branch's duration at the previous speed after a speed change.

**Partial-mixin hosts, a third time:** `updateAnimationDuration` calling
`this.getBranchTimeline()` broke the player-parity harness, which
cherry-picks mixin methods. Fixed on both sides — the harness takes the new
accessor (it is part of the timing contract it exercises) and the call is
optional, because a host without the accessor has no branch data either.

**Evidence:** 60 files / 878 tests. Live Chromium: composed total and engine
duration agree at 7269 ms on a branched route, the coordVersion-9 snapshot
carries `branchId`/`branchFrom`/`branchRejoin` on exactly the one branch
waypoint and adds no key to the other five, and the `player.js` bundle inlined
into every standalone export contains the branch composition and render code.
Opening an exported file in a browser end-to-end remains REV-04's outstanding,
owner-run evidence.

**Link:** ROUTE-01d.

## 2026-08-27 — a branch borrows the trunk's transport, never its own

**Decision:** `AnimationEngine` keeps exactly one authoritative transport — the
trunk's. Branch timing is pure derived data: `branchTiming.js` turns each run's
geometry into a leg, `PlayerCore.composeBranchTimeline` places the legs, and the
renderer asks `branchPathProgressAt(masterTimeMs, …)` for a branch's position.
No branch installs segment markers, holds playback state or accumulates time.

**Rationale:** the deterministic-timeline mandate says the scene is a pure
function of (timelineMs, projectState, seed). A per-branch transport would have
given every branch its own accumulating clock and broken that at the first
scrub. Deriving each branch's position from the master instant keeps play,
scrub and export agreeing by construction, exactly as they already do for the
trunk.

**Shared mapping, not a second one:** each leg carries its own `{segments,
pauses, pathDuration, totalPauseTime, hasVariableSpeed}` in precisely the shape
`PlayerCore.timelineToPath` consumes, and branches resolve position through
that same function. A first attempt approximated it (local time minus pause
time already spent) and drifted the moment a pause sat mid-branch rather than
at its end. An interleaved pause now holds a branch head still for the same
reason and by the same arithmetic as the trunk.

**Render seam:** two additive vector layers — `branch-paths` beneath the trunk
so the trunk still reads as the primary line, `branch-heads` above it, since
every enabled branch animates simultaneously and so owns a head. `renderPath`
and `renderPathHead` read a small fixed slice of the engine, so each branch
passes a facade that differs only in `getPathProgress()` and delegates the
rest. Branch waypoints, labels, beacons and areas needed no change at all:
those layers already iterate the whole waypoint array. Both branch layers
return early when `state.branchPaths` is empty, so a linear route never enters
the branch pass.

**Assumption at the skipped gate (camera):** the follow-camera keeps tracking
the trunk head. Trunk timing now reads `routeOf(app)` — the trunk, not the full
array — and `CameraService.toMajorKeyframes` follows it, so this falls out of
the model rather than being special-cased. Choosing per-fork which head the
camera follows, or framing all live heads, is a product decision left to
ROUTE-01c's sign-off.

**Mixin safety:** `routeOf(app)` is a module helper, not a mixin method,
because `PlayerApp` borrows only part of `pathTiming`; a `this.trunkRoute()`
call was undefined there and broke seven export-parity tests.

**Link:** ROUTE-01b. 58 files / 832 tests green. Verified in production
Chromium on a branched route: trunk and branch splines both start at the fork
point, two heads advance simultaneously from t=0, the shorter branch completes
and holds, zero console entries. A linear route reports `isLinear` with no
branch paths and renders unchanged.

## Archived: 2026-08-27 → 2026-09-22 (15 entries) — see archive/decision-log-2026-08-27-to-2026-09-22.md
## Archived: 2026-08-27 (11 of 19 entries) — see archive/decision-log-2026-08-27-to-2026-08-27.md
## Archived: 2026-08-17 → 2026-08-26 — see archive/decision-log-2026-08-17-to-2026-08-26.md
## Archived: 2026-06 — see archive/decision-log-2026-06.md
## Archived: 2026-04 — see archive/decision-log-2026-04.md

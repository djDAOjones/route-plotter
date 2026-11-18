# The v4 programme — 18 November 2026

This file records how the v4 programme was planned on 18 November 2026 under
`verbs/plan.md`: the owner's three rounds of answers on the programme, word for
word (P1 to P11); the session's readings of them; the review findings the
programme answers or defers (F1 to F12); the phases in order; and every signed
line that changed, old beside new. His words are quoted exactly. The questions,
the options and the readings are the session's. The decision is the PLAN-5
entry in `project/decisions.md`, which cites this file. His vision and his
answers Q1 to Q24 are in `reviews/v4-vision-question-rounds-2026-11-18.md`; the
stock take is in `reviews/v4-stock-take-2026-11-18.md`.

## The owner's request, word for word

"4. Propose the v4 programme with verbs/plan.md: the brief's Direction amendment for me to sign, a PLAN-N decision, and phases in order with item files. The first item is the architecture plan (MERGE-01 and REFACTOR-01's written plan, reviewed by Codex, then my question round), before any code. Keep within the record's budgets; if a budget bites, ask me rather than squeeze the text."

"5. Put the record change on one branch and pull request. Show me the diff and wait for my word before merging. End with a Session-end line naming the first item."

And, among the matters his step 1 said the question rounds must cover, the one GATE-01 answers:

"how fast the gate is: about 34 minutes a push, all 4,385 tests one file at a time, even for a record-only change (why: DEV-INFRASTRUCTURE.md and wish INTAKE.18). Of #167, a record-only change, I said on 18 Nov: "lets bypass the checks this time, seems unnecessary". Propose a faster gate, and say whether a record-only change needs the app suite;"

## Round 1 — the shape of the programme (asked and answered 18 Nov 2026)

### P1 — Signed lines

Question, as asked: You named two signed lines to draft now: the brief's
Direction and the profile's Handoff line. Your v4 answers also touch about ten
other signed lines (the brief's Constraints, Core features and Open questions;
the profile's Runtime, Gate, Hosting, Dependencies and Carbon lines; two rules
lines). When should those others be redrafted for your signature?

Options offered:
- "Later, by one item (Recommended)" — Only Direction and Handoff change now. A
  new item, SIGN-01, redrafts the others for your signature once v4's stack,
  gate and publishing are really installed, so no signed line describes
  something the repository does not yet have. Trade-off: for some weeks those
  lines still describe v3, and the PLAN-5 decision governs where they differ.
- "Redraft them all now" — Every touched line is drafted in this pull request
  for one signing. Trade-off: the lines would describe a stack that is not
  installed yet, the profile goes over its 400-word budget, and the
  architecture plan may change details, so you would probably sign again.

Joe's answer, verbatim (an option label): "Redraft them all now"

### P2 — Profile size

Question, as asked: The profile is 386 of its 400 words. The new Handoff line
("Claude builds with Codex (gpt-6-astra) as partner...") takes it to 391. The
Harness sentence you signed on 12 Nov ("most of what each harness keeps in its
own memory repeats this ledger; where they differ, this ledger is the record")
adds 16 more, making 407. What do you rule?

Options offered:
- "Raise to 410, take both (Recommended)" — The profile's budget rises from 400
  to 410 words by your recorded decision, and both the Handoff line and your
  signed Harness sentence go in now (407 of 410). Trade-off: every chat reads
  about 20 more words at its start, and the signed Budget line changes too.
- "Handoff now, Harness later" — Only the Handoff line changes (391 of 400).
  The Harness sentence waits for SIGN-01. Trade-off: the sentence you signed on
  12 Nov stays unapplied for some weeks more.

Joe's answer (his own text, not an option), verbatim:

"raise to 500"

### P3 — DEF-101

Question, as asked: DEF-101 is the v3 save fault you ticked for fixing (a save
can, rarely, lose text or write a file that will not reopen). It needs a small
code fix to frozen v3, a v3 release (over an hour) and a new zip for Xerte.
When should it be built, against the architecture plan?

Options offered:
- "Alongside the plan (Recommended)" — Its own chat fixes and releases it while
  the architecture plan is being written; the two touch different files.
  Trade-off: two chats draw on your plan allowance at once, and you replace the
  zip on Xerte when it is done.
- "Before the plan starts" — DEF-101 is built and released first, then the
  architecture plan begins. Trade-off: the corrected zip is ready soonest, but
  the plan starts about a day later.
- "After the plan's questions" — The fix waits until you have answered the
  architecture plan's question round. Trade-off: nothing distracts from the
  plan, but the fault stays in the copy Gary uses for some weeks.

Joe's answer (his own text, not an option), verbatim:

"drop this fix, concentrate on building new"

### P4 — Faster gate

Question, as asked: The faster gate you chose ("Gate by what changed") is a
change to the CI set-up and package.json, not to the app. Until it exists,
every push still waits about 34 minutes, including each push of the
architecture plan, which is record-only. Where should the gate item (GATE-01)
sit?

Options offered:
- "Alongside the plan (Recommended)" — GATE-01 is built in its own chat while
  the architecture plan is written, so the plan's own pushes are checked in
  seconds. It changes CI set-up only, no app code. Trade-off: it bends "before
  any code" for CI set-up, and adds a chat running at the same time.
- "After the plan, as ordered" — The architecture plan stands alone in its
  phase; GATE-01 is the first item of the next phase. Trade-off: each push of
  the plan's pull request still waits about 34 minutes.

Joe's answer, verbatim (an option label): "Alongside the plan (Recommended)"

## Round 2 — readings and two owed lines (asked and answered 18 Nov 2026)

### P5 — Readings of the day's answers (he could tick any number)

Question, as asked: Four readings of answers you gave today. Tick each one that
stands; leave unticked any that is wrong (say why under Other if you wish).

Options offered:
- "Budget 500, both lines in" — Your "raise to 500": the profile's word budget
  becomes 500 (from 400), and both the new Handoff line and the Harness
  sentence you signed on 12 Nov go into the profile now.
- "DEF-101 retired, check kept" — Your "drop this fix, concentrate on building
  new": DEF-101 is retired unbuilt, with no v3 release and the zip you already
  have unchanged. The save fault stays on the list of checks v4 must pass when
  it ports saving.
- "Archive one more decision" — Your tick earlier today, "Archive the oldest
  decisions", also covers moving the single oldest decision to the archive now,
  so that adding PLAN-5 leaves 45 live decisions, not 46.
- "Context line, that once" — Your "you can take the context higher if needed
  too" let the stock-take chat pass the 200k Session line that one time. The
  signed Session line stays 200k for every other chat, this one included.

Joe's answer, verbatim (two ticked, with his own text first): "context can go up to 300k on all chats,Budget 500, both lines in,Archive one more decision"

### P6 — Readings from the question rounds (he could tick any number)

Question, as asked: Four readings left unconfirmed from the six question
rounds. Tick each one that stands; unticked ones go to the architecture plan's
question round as open points.

Options offered:
- "Removing asks first" — If another feature depends on the feature an author
  is removing, the app names the dependant and asks before removing (the half
  of Q18 you did not answer).
- "v4 has its own storage" — v4 saves in the browser under key names of its
  own, so it never reads, changes, deletes or collides with v3's routePlotter_*
  autosaves.
- "A preset starts one route" — A preset is a starting point for one route (a
  named set of features with sensible settings); the built-in examples stay
  whole demonstration scenes.
- "Xerte is not a condition" — v4 replaces v3 on GitHub Pages at the first
  build whose core works end to end, whether or not the Xerte copy is up; I
  tell you where the Xerte copy stands before that first publish.

Joe's answer, verbatim (two ticked): "Removing asks first,A preset starts one route"

### P7 — REL-726.1

Question, as asked: REL-726.1 is the one check still owed on build 3.3.726, the
build in your Xerte zip: save and open from disk one MP4 and one HTML export,
one of each with Show image unticked. With DEF-101 dropped, that build is
final. What do you rule?

Options offered:
- "Keep it owed to me (Recommended)" — The line stays open until you have
  opened the two exports and told me the result; about five minutes of your
  time. Trade-off: one v3 line stays on the wish list until you do.
- "Waive it" — Recorded as your explicit waiver for this release and the line
  is retired. Trade-off: the build Gary will use never had its exports opened
  from disk.

Joe's answer, verbatim (an option label): "Waive it"

### P8 — DEF-99.2

Question, as asked: DEF-99.2 records that on 18 Oct you said Match day's
playback was "coming out weird" in v3; what looked weird was asked and never
answered. v3 is now frozen. What should happen to the line?

Options offered:
- "Retire it (Recommended)" — The line is retired on your word; the match-day
  crowd preset is judged by your eye at v4's previews. Trade-off: whatever
  looked weird in v3 is never written down.
- "Keep it open" — The line stays until you describe what looked weird; it then
  becomes a check for v4's match-day crowd. Trade-off: one more open line
  waiting on you.

Joe's answer, verbatim (an option label): "Retire it (Recommended)"

## Round 3 — budgets, DEF-101 and the signature (asked and answered 18 Nov 2026)

Before this round the session sent him a file showing the twenty drafted
changes to signed lines, old beside new; they are the last section of this
file.

### P9 — Budgets

Question, as asked: With every touched line redrafted now, two word budgets are
exceeded: the profile is 534 words against the 500 you ruled today, and the
brief's Direction is 160 against its 150. You asked me to ask rather than
squeeze. What do you rule?

Options offered:
- "Raise both (Recommended)" — The profile's budget becomes 575 words and the
  Direction's 175, by your recorded decision; the drafts stay as you see them,
  with a little room for the architecture plan's later amendment. Trade-off:
  every chat reads about 45 more words at its start than under today's budgets.
- "Shorten the drafts to fit" — I cut the profile to 500 words and the
  Direction to 150 and show you the shorter lines before you sign. Trade-off:
  the lines say less (the Gate and Hosting lines would point to the PLAN-5
  decision for their detail), and it takes one more round.

Joe's answer, verbatim (an option label): "Raise both (Recommended)"

### P10 — DEF-101 again

Question, as asked: You answered "drop this fix, concentrate on building new"
about DEF-101 (the v3 save fault), and left my reading "DEF-101 retired, check
kept" unticked. Which of these is right?

Options offered:
- "No v3 fix, v4 check kept (Recommended)" — DEF-101 is retired unbuilt: no v3
  fix, no v3 release, your zip unchanged. The fault stays on the list of checks
  v4 must pass when it ports saving. Trade-off: the rare fault stays in the v3
  copy Gary uses.
- "Drop it altogether" — DEF-101 is retired and no check is kept for v4 either.
  Trade-off: v4's port of v3's saving code could carry the same fault without
  anyone looking for it.
- "Keep DEF-101, not now" — The line stays open and unscheduled; nothing is
  built until you say. Trade-off: one more open v3 line in the backlog.

Joe's answer, verbatim (an option label): "No v3 fix, v4 check kept (Recommended)"

### P11 — The signature

Question, as asked: The file SIGNED-LINES-old-and-new.md (sent to you in this
chat) shows the 20 drafted changes to signed lines, old beside new: 8 in the
brief, 10 in the profile (your 300k Session line and 500-word budget among
them), 2 in the rules. Signing means your own words, recorded with today's date
in the PLAN-5 decision; the Signed line at the foot of each file stays as it
is. Do you sign them?

Options offered:
- "I sign all 20 as drafted" — Your signature is recorded in your words and the
  lines go into the pull request as you see them (this needs "Raise both" in
  the first question; if you chose shortening, I show you the shorter lines and
  ask again).
- "Changes needed first" — Say which lines and what to change under Other; I
  redraft and show you again before anything is recorded as signed.
- "I'll sign at the pull request" — The pull request carries the lines marked
  as drafted and unsigned; you sign when you review its diff, and one more
  commit then records your words before the merge.

Joe's answer, verbatim (an option label): "I sign all 20 as drafted"

## The session's readings — proposals, for Joe to confirm

- P1: every signed line his answers touch is redrafted in this change. The
  session kept to the lines its question named, with the four the promoted
  wishes cover (the Harness sentence, the Budget line, the Conventions' "PM:
  summary", and the rules' mention of the big run's delegation) and the
  Session line of P5. The rules' Environment section is left as it is; it was
  outside this job.
- P2 with P9: "raise to 500" set the profile's budget at 500 words; "Raise
  both (Recommended)" then set it at 575 and the Direction's at 175. The
  Budget line he was shown read 500; it now reads 575 and 175 by that later
  answer, and two header comments that restate the figures follow it.
- P3 with P10: DEF-101 is retired unbuilt; the fault is a check v4 must pass
  when it ports saving. Confirmed by him in P10, so no longer a proposal.
- P4: GATE-01 is in Phase 5 and runs in a chat of its own while the plan is
  written. The architecture plan is still the first item.
- P5: "context can go up to 300k on all chats" changes the profile's signed
  Session line from 200k to 300k for every chat, this one included. He saw
  that line among the twenty and signed it (P11). The reading it replaced, that
  the stock-take chat had leave to pass 200k that once, is overtaken by it.
- P5: his tick covers moving one more decision to the archive; the oldest live
  entry (REL-711, 2026-10-08) moved.
- P6: confirmed by him: the app names a dependant and asks before a feature is
  removed; a preset is a starting point for one route, and the built-in
  examples stay whole demonstration scenes. Left unticked, so open points for
  the architecture plan's question round: whether v4 keeps browser storage
  keys of its own; and whether the Xerte copy's readiness is a condition for
  v4 replacing v3 on Pages.
- P7 and P8: REL-726.1 is retired by his waiver, and DEF-99.2 on his word.
- P11: his signature is the option label he picked, recorded with the date in
  PLAN-5. The `## Signed` line at the foot of the brief, the profile and the
  rules file is untouched, as it was when the Handoff line changed on
  2026-10-14 (REL-719) and the Budget line on 2026-10-19 (UI-08).
- Not put to him, and still proposals: that PM-Skills' pilot row and Set 1 pin
  apply to v4, and that today's `project/architecture.md` moves aside before
  the architecture record is adopted. Both are in STACK-01's file.

## Review findings

The plan verb's review, against the brief and the adopted standards: what is
broken, missing or short of a rule that bites.

- F1 — The brief's Direction named the big run as the current work and "Pure
  JavaScript" as the stack (`project/brief.md`, Direction; wish GATELESS-1.1).
  Answered: redrafted and signed.
- F2 — The record said refactor v3, then merge: the abstraction plan's "Never
  rewrite" (§1), the REFACTOR-01 entry of 2026-10-14 and the backlog's heading
  "After CROWD-08: a refactor, then v4". His Q1 answer says a new app with a
  ported engine. Answered: PLAN-5 supersedes.
- F3 — The profile's Handoff line and the REL-719 entry said Codex implements;
  he says "claude builds with codex astra as partner". Answered: redrafted and
  signed.
- F4 — v3's code resists the two things the vision changes, the route model
  and an interface that grows: sixteen mixins share one `this` through 115
  undeclared edges (the abstraction plan, §1); the route sets the scene's
  length (`src/utils/sceneEnd.js`) and alone carries the camera
  (`src/services/CameraService.js`). Answered: the architecture plan is the
  first item, before any code.
- F5 — The gate takes about 34 minutes a push, the record included: CI run
  44322370111 took 2,260 seconds, 2,139 inside the tests (203 files, 4,385
  tests, one worker). Answered: GATE-01, alongside the plan.
- F6 — No linter or type checker exists (the profile's old Gate line), and the
  abstraction plan's layer rules (§11.1) are written down, not enforced.
  Deferred: STACK-01.
- F7 — AAA is the target, but the owner's evidence has been owed since
  2026-10-01 (REV-03, REV-05) and no screen reader is driven in any test.
  Deferred: Phase 8, with Q22's extended depth before v4.0 is declared.
- F8 — A merge releases nothing and only `npm run push` commits `docs/`
  (`project/rules.md`, Always); Q15 asks that each app merge publish.
  Deferred: PUB-01, which takes wishes INTAKE.10 and REL-720.1.
- F9 — v3's tests pin some open defects as they stand (DEF-79, DEF-51), so a
  port "with its tests" could port a fault as a requirement
  (`reviews/v4-stock-take-2026-11-18.md`, Port hazard). Deferred: MERGE-01 and
  REFACTOR-01's plan.
- F10 — The profile stood at 386 of 400 words with a signed sentence unapplied
  (wish V31-REFRESH-4.1), and the redraft passed both it and the Direction's
  budget. Answered: his rulings of P2 and P9. The rules file's Always section
  is 457 words against a guideline of 400, a standing warning (442 before);
  most of it is v3's invariants, which move with v3's source in STACK-01.
- F11 — `project/architecture.md` is v3's own file, without the mark the
  architecture record carries. Deferred: STACK-01.
- F12 — The brief's "What we are building" and "Platform and deployment"
  sections still describe v3 alone and were not among the lines shown to him.
  Deferred: MERGE-01's plan brings their amendment.

## The programme: phases in order

The plan verb opens one phase; he asked for "phases in order". The record
holds both this way: Phase 5 is the one open phase, under the backlog's
Current, governed by PLAN-5's Items list. The later phases stand in order in
the backlog's Next, with the items already known, and each opens under Current
by its own PLAN entry once the architecture plan has named its items. No item
of v4's build is invented ahead of that plan.

| Phase | Direction | Items known now |
| --- | --- | --- |
| 5 — the architecture plan, before any code | Nothing of v4 can be built until its model, its modules and the port are decided; the faster gate is built beside it so the plan's own pushes are quick | MERGE-01 (first, with REFACTOR-01's port plan as one document; Codex's review; then his question round), REFACTOR-01, GATE-01 |
| 6, proposed — v4's foundations | v4 at the root on the editor stack, with its own gate running and its layers enforced, before any feature | STACK-01 |
| 7, proposed — the core, end to end | Draw, play, save and reopen, export; the first v4 build on Pages, then each app merge he orders publishes | PUB-01, and the core's items from the architecture plan |
| 8, proposed — features, presets and v4.0 | Features as modules, the Add feature list, the five presets; v4.0 is one scene for each preset made and exported in v4, with the extended accessibility depth | EX-01, REV-03, REV-05, and the feature items from the architecture plan |
| After v4.0 | What his answers place later | wishes PLAN-5.1 (own presets as a file, Q20) and EX-03.1 (the riot march, Q24) |

AI-01 stays "medium term", where he put it on 2026-10-15; the architecture plan reads it as an input and says where it falls.

## The signed lines, old beside new

Signed by the owner on 18 November 2026: "I sign all 20 as drafted" (P11).
Each numbered pair shows the text before, then the text he signed. Where a pair
shows part of a line, only that part changed. Pair 9 was shown to him reading
"profile 500"; by his answer P9 in the same round the Budget line reads
"profile 575" and "Direction 175". Two comments that restate those figures,
at the head of the profile ("Under 575 words (hard budget)") and of the brief
("under 175 words"), follow that ruling.

### The brief (project/brief.md)

**1. Direction**

Old:

> v3
> is a layered scene over one master timeline: the hero route plus flow
> layers of crowd animation, rendered as a pure function of (timelineMs,
> projectState, seed). Pure JavaScript and Canvas 2D; two bundled runtime
> dependencies; WCAG 2.2 AAA with Carbon productive UI in our own code and
> Okabe-Ito for map data; Chromium-only for now. `main` is the live site:
> branch, pull request, the owner merges and calls each release. The
> current work is the big run from the 2026-09-22 abstraction plan under
> the owner's standing delegation of 2026-09-28.

New:

> v3 is frozen at 3.3.726. v4 is a new app at this
> repository's root: a scene and its routes, with a core that is always
> present and features an author adds, each feature a module; presets
> are starting points. v3's engine is ported with its tests, and every
> frame stays a pure function of (timelineMs, projectState, seed). The
> editor is strict TypeScript with React and Carbon React; the exported
> player has neither. WCAG 2.2 AAA; Okabe-Ito for map data; Chromium-only
> for now. `main` is the live site: branch, pull request, the owner
> orders each merge; once v4's core works end to end, each app merge
> publishes until v4.0. The current work is the v4 programme (PLAN-5):
> the architecture plan first, before any code.

**2. Core features**

Old:

> - Drag-and-drop background images with waypoint placement (major + minor)
> - Catmull-Rom spline path with per-segment speed control
> - Per-waypoint markers, beacons, text labels, area highlights, camera zoom
> - Multiple visibility modes (path, waypoint, background)
> - Video export (MP4/WebM via WebCodecs) and self-contained HTML export
> - Auto-save to localStorage, project save/load as ZIP

New:

> v4, on the owner's answers of 2026-11-18:
>
> - The core, always present: a scene (background, play and scrub, save
>   and open, export) and a route (points, a styled line, a single lead)
>   with waypoint labels, markers and pauses
> - Features an author adds, to a route or to the scene, from an Add
>   feature list; a crowd is one; the architecture plan lists the rest
>   and where each lives
> - Presets as starting points: Map route; document reveal; signal flow;
>   annotated diagram; match-day crowd
> - v4.0 is reached when one scene for each preset is made and exported
>   in v4
>
> v3, frozen at 3.3.726:
>
> - Drag-and-drop background images with waypoint placement (major + minor)
> - Catmull-Rom spline path with per-segment speed control
> - Per-waypoint markers, beacons, text labels, area highlights, camera zoom
> - Multiple visibility modes (path, waypoint, background)
> - Video export (MP4/WebM via WebCodecs) and self-contained HTML export
> - Auto-save to localStorage, project save/load as ZIP

**3. Constraints: language and dependencies**

Old:

> - Pure JavaScript, no frameworks. Two bundled runtime dependencies:
>   mediabunny (video mux) and jszip (project ZIPs). Nothing from CDNs.

New:

> - v4's editor is strict TypeScript with React 19 and Carbon React; the
>   exported player is free of React and Carbon. v3, frozen, is pure
>   JavaScript with no framework. mediabunny (video mux) and jszip
>   (project ZIPs) are v3's two bundled runtime dependencies, carried
>   into v4 by the port unless the architecture plan rules otherwise.
>   Nothing from CDNs.

**4. Constraints: the timeline mandate**

Old:

> - **Deterministic timeline (v3 mandate):** the scene is a pure function

New:

> - **Deterministic timeline (v3 mandate, kept in v4):** the scene is a pure function

**5. Constraints: build, tests and modules**

Old:

> - npm + esbuild for bundling (target es2022; lockfile committed),
>   Vitest for testing.

New:

> - **Modules (v4):** each feature is a module that owns its settings,
>   drawing, controls, save fields and tests; features talk through the
>   core only; layers and module edges are enforced in the gate; the
>   abstraction plan's §16 is applied to every new abstraction.
> - npm with a committed lockfile; v4 builds with Vite, v3 with esbuild
>   (target es2022); Vitest for testing.

**6. Constraints: accessibility**

Old:

> - WCAG 2.2 AAA is the product target; the semantic authoring model now ships,
>   while REV-03/REV-05 track the remaining pointer-parity and assurance evidence
>   before it can be claimed as verified support.
> - IBM Carbon Design System for UI patterns (implemented, not installed).

New:

> - WCAG 2.2 AAA is the product target. v4 tests accessibility in its
>   gate from the start (a real browser, axe and lint rules) and with a
>   screen reader before v4.0 is declared; REV-03/REV-05 track the
>   pointer-parity and assurance evidence before it can be claimed as
>   verified support.
> - IBM Carbon Design System for UI patterns: Carbon React installed in
>   v4 and pushed to the AAA bar; implemented, not installed, in v3.

**7. Constraints: v3 files and autosaves**

Old:

> - UoN semantic design tokens for UI chrome.

New:

> - UoN semantic design tokens for UI chrome.
> - v4 opens no v3 project file and leaves v3's browser autosaves alone;
>   v3's files, exports and autosaves stay with v3.

**8. Open questions**

Old:

> - Whether "drop older" project formats reaches format 9 (the owner's
>   pending confirmation, 2026-09-28); until he answers, format 9 keeps
>   loading.

New:

> - None of the owner's is open on v3's formats: v3 is frozen and keeps
>   opening formats 6 to 9, and v4 opens no v3 file (2026-11-18).
> - For the architecture plan (MERGE-01) to bring to the owner: where
>   each feature lives, scene or route; which pieces of v3's engine are
>   not worth porting; whether v4 keeps browser storage keys of its own;
>   and whether the Xerte copy's readiness is a condition for v4
>   replacing v3 on Pages.

### The profile (project/profile.md)

**9. Budget**

Old:

> contract 500, profile 400,

New:

> contract 500, profile 500,

**10. Session**

Old:

> - Session: 200k tokens of context

New:

> - Session: 300k tokens of context

**11. Runtime**

Old:

> - Runtime: vanilla JavaScript, Canvas 2D, esbuild (`build.js`), Vitest with jsdom; Chromium-only; Node 24

New:

> - Runtime: v4: strict TypeScript, React 19 and Carbon React in the editor, Canvas 2D, Vite, Vitest, the exported player free of React and Carbon; v3, frozen at 3.3.726: vanilla JavaScript, Canvas 2D, esbuild (`build.js`), Vitest with jsdom; Chromium-only; Node 24

**12. Gate**

Old:

> - Gate: `npm run check` — non-mutating: Vitest, the restart-script shell contract, a temp-directory build, then the v3 checker; CI runs it on every push; no linter or type checker exists

New:

> - Gate: `npm run check` — non-mutating, and from GATE-01 on sorted by what changed: a record-only change runs the record checker alone; a v4 change runs v4's gate (types, lint, boundaries, dead code, tests, build, accessibility) inside 10 minutes; frozen v3's suite runs only when v3 code changes; anything unclear runs everything. Until GATE-01, CI runs v3's whole suite, then the record checker, on every push

**13. Hosting and deploy**

Old:

> - Hosting and deploy: GitHub Pages from `docs/` on `main`; a merge releases nothing; `npm run push` releases when the owner calls it

New:

> - Hosting and deploy: GitHub Pages from `docs/` on `main`: v3 until the first v4 build whose core works end to end replaces it on the owner's call; from then until v4.0 each app merge he orders also publishes, a record-only merge nothing (PLAN-5); any other release is `npm run push`, on his call

**14. Harness**

Old:

> then verified in the client · this ledger is the record

New:

> then verified in the client · most of what each harness keeps in its own memory repeats this ledger; where they differ, this ledger is the record

**15. Handoff**

Old:

> - Handoff: Codex implements; a separate fresh read-only Codex reviews under the item's recorded review bar; one writer per checkout, each session in its own clone or worktree

New:

> - Handoff: Claude builds with Codex (gpt-6-astra) as partner: Codex reviews read-only under the item's recorded review bar and never writes; one writer per checkout, each session in its own clone or worktree

**16. Dependencies**

Old:

> - Dependencies: two bundled runtime dependencies, jszip and mediabunny; a third is the owner's decision

New:

> - Dependencies: v3 bundles jszip and mediabunny; v4 takes the editor stack the owner adopted whole (PLAN-5), each version pinned by the installing item and shown to him; any other package is the owner's decision

**17. Carbon**

Old:

>   - our own code, never installed; Okabe-Ito for map data, UoN tokens for chrome, never collapsed

New:

>   - v4 installs Carbon React and pushes it to the AAA bar; v3's is our own code; Okabe-Ito for map data, UoN tokens for chrome, never collapsed

**18. Conventions**

Old:

> commits `ID: summary` with the house `Verify:` line; memory-only commits `PM: summary`

New:

> commits `ID: summary` with the house `Verify:` line, the ID one the ledger holds

### The rules file (project/rules.md)

**19. Always: runtime dependencies**

Old:

> - Runtime dependencies: jszip and mediabunny only; no package without explicit approval.

New:

> - Runtime dependencies: v3's jszip and mediabunny, and v4's editor stack as adopted (PLAN-5); no other package without explicit approval.

**20. Always: main is the live site**

Old:

> an advance grant is a decision stating conditions (the big run's, 2026-09-28). Only `npm run push` commits `docs/` and `version.json`.

New:

> an advance grant is a decision stating conditions (PLAN-5's publish-on-merge, 2026-11-18). Only `npm run push`, or the publishing step that grant sets up, commits `docs/` and `version.json`.

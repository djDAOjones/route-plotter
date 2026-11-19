# The architecture plan's question round, and the owner's word on publishing — his answers of 18 November 2026

This file is the word-for-word record of the owner's answers to the question
round in section 22 of `reviews/v4-architecture-plan-2026-11-18.md`, and of his
two messages on publishing v4 to GitHub Pages, all typed by him on the evening
of 18 November 2026, while v4 was being built overnight under his grants. His
words are quoted exactly, spelling included ("reccomendation"). The questions,
the options and the readings are the orchestrator chats'. A reading is a
proposal until he confirms it. Nothing here is a decision: the PLAN-6 decision
entry of 2026-11-19 cites this file and rules on it.

The orchestrator chats kept each of his messages whole, between markers, in
the night's session notes, outside this repository
(`JOE-ANSWERS-ROUND-1-2026-11-18.md` and `JOE-ANSWERS-ROUND-2-2026-11-18.md`);
everything quoted from him below is copied from between those markers.

## How to read this file

- Every answer is his own typed text; none is an option label he picked.
- Round 1 was shown to him in a shortened form. He pasted that text back and
  typed his answer after " - " on each line, so in each numbered line of his
  round 1 message the text before the last " - " is orchestrator 2's wording
  and the text after it is his.
- Q1 to Q8 are the plan's numbers; the plan's provisional decisions each
  question bears on are in brackets (A1 onwards, its section 18). The night's
  decisions list kept for him outside the repository called them D8 to D15.
- His answers are first, each with what he was shown; the readings follow, in
  a section of their own, marked as readings.

## Round 1 (shown about 22:27 UTC, answered about 22:35 UTC, 18 Nov 2026, in orchestrator 2's chat)

What he was shown: a shortened form of the plan's round 1, written by
orchestrator 2, not the plan's full wording. The text he pasted back gives each
question with its recommended option only, and none of the other options or
trade-offs; the plan's full wording of round 1 is in its section 22.

His whole message, word for word:

```text
1. Scene length: recommended “From what’s in it, or fixed by me”. The scene runs until its last route, crowd or effect ends; you may fix a length instead. - scene ends when all animation has concluded (although some animation could be cyclical so will need a grace period or control for how long to last)
2. Route shape: recommended “Yes, a route can be a network”. A new route is a simple line and becomes a network only if you draw one. Overturning this later redoes the most work. - recommendation good
3. v4’s browser storage: recommended “Its own storage”. v4 never reads or changes v3’s autosaves. - open to reccomendation but no backwards compatibility needed
4. Xerte and the switch: recommended “Yes, a condition”. The first v4 on Pages waits until you confirm the Xerte copy works and Gary has its address. - Xerte copy works, progress with pages
```

### Q1 — Scene length (A2b; D8)

As he was shown it (orchestrator 2's wording, from his message): "Scene length: recommended “From what’s in it, or fixed by me”. The scene runs until its last route, crowd or effect ends; you may fix a length instead."

The plan's options: "From what's in it, or fixed by me (Recommended)"; "Always
fixed by me"; "The first route sets it".

His answer (his own text), verbatim:

"scene ends when all animation has concluded (although some animation could be cyclical so will need a grace period or control for how long to last)"

### Q2 — Route shape (A1; D9)

As he was shown it (orchestrator 2's wording, from his message): "Route shape: recommended “Yes, a route can be a network”. A new route is a simple line and becomes a network only if you draw one. Overturning this later redoes the most work."

The plan's options: "Yes, a route can be a network (Recommended)"; "A line
with forks only".

His answer (his own text), verbatim:

"recommendation good"

### Q3 — v4's browser storage (A15; D10)

As he was shown it (orchestrator 2's wording, from his message): "v4’s browser storage: recommended “Its own storage”. v4 never reads or changes v3’s autosaves."

The plan's options: "Its own storage (Recommended)"; "No autosave in v4 yet".

His answer (his own text), verbatim:

"open to reccomendation but no backwards compatibility needed"

### Q4 — Xerte and the switch (A16; D11)

As he was shown it (orchestrator 2's wording, from his message): "Xerte and the switch: recommended “Yes, a condition”. The first v4 on Pages waits until you confirm the Xerte copy works and Gary has its address."

The plan's options: "Yes, a condition (Recommended)"; "No, I'll judge at the
time".

His answer (his own text), verbatim:

"Xerte copy works, progress with pages"

## Round 2 (shown about 22:40 UTC, answered about 23:28 UTC, 18 Nov 2026, in orchestrator 3's chat)

What he was shown, at about 22:40 UTC: round 2 copied in full from the plan's
section 22, with every option and trade-off (below, as shown); a list of
orchestrator 3's readings of his round 1 answers; and a closing question on
publishing, which his message also answers (see "His word on publishing").
The text shown differs from the plan's section 22 as merged in one place
only: Q7's last line read "(FEAT-05, last in Phase 8)" where the plan reads
"(FEAT-07, last in Phase 8)", the item having been split before the plan
merged.

His whole message, word for word (he typed all of it):

```text
q5) as recommended
q6) as recommended
q7) as recommended
q8) as recommended for now, but future feature may include expressions that make it varied

re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)
```

Round 2 as he was shown it, word for word (the plan's wording at the time):

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
- If overturned: only crowd areas are redone (FEAT-05, last in Phase 8).

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

His answers, verbatim, from his message above:
- Q5 (A3, A4; D12): "q5) as recommended"
- Q6 (A11; D13): "q6) as recommended"
- Q7 (A23; D14): "q7) as recommended"
- Q8 (A24; D15): "q8) as recommended for now, but future feature may include expressions that make it varied"

## His word on publishing (18 Nov 2026, in orchestrator 3's chat)

### The question it answered

Shown to him at about 22:40 UTC, with round 2, as the closing question, word
for word (orchestrator 3's wording): "One thing to confirm when you can: is
"build the publishing set-up, don't publish yet" the right reading of
"progress with pages" — yes, build only, or no, you'll explain?"

The reading of Q4 he was shown in the same message, word for word
(orchestrator 3's wording): "I take "Xerte copy works" as the condition met,
so the publishing set-up (PUB-01) is built in its turn. I have not taken it as
your word to publish: nothing goes on Pages tonight. You did not say whether
Gary has the Xerte address."

### His answer (about 23:28 UTC)

The last paragraph of his round 2 message above, verbatim:

"re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)"

### His confirmation on the first publish (about 23:35 UTC)

What he was shown, word for word (orchestrator 3's wording): "One consequence
to be sure of: the first publish swaps working v3 at the github.io address for
v4 as it then stands, which soon after STACK-02 is a near-empty page. v3 stays
on Xerte and at tag v3.3.726. Is that fine — yes, publish, or wait for the
core? If you are asleep, your typed word stands and I publish when the set-up
is ready." The message above it said PUB-01 would be built straight after
STACK-02 and v4 published after each app item while cheap.

His whole reply, word for word:

```text
yes, publish, and I'm going to bed now, so hopefully no more pauses until 08:00
```

## Readings — proposals, not yet confirmed by him

The orchestrator chats' readings, as the PLAN-6 entry of 2026-11-19 records
them. Each is a proposal for him to confirm or correct; none is his word.

- Q1: the recommended option stands ("From what's in it, or fixed by me"): the
  scene ends when all its animation has ended. He adds a requirement: animation
  that cycles needs a grace period or a control for how long it lasts. The
  plan's "set allowance" for a crowd that goes on for ever is the nearest thing
  the plan has; which of the two it becomes, a grace period or a control the
  author sets, is CORE-02's to settle, not a hidden rule.
- Q2: the recommended option stands ("Yes, a route can be a network").
- Q3: the recommended option stands ("Its own storage"). "no backwards compatibility needed"
  is read as: v4 need not read, import or migrate v3's
  browser autosaves. It is not read as changing the plan's A13 (older v4 files
  keep opening), which he was not asked about here.
- Q4 and publishing: "Xerte copy works" is read as the first half of the plan's
  Xerte condition (A16) met. His word on publishing then overturns the
  condition and goes further: it is read as his call, given in advance, for v4
  to be published to GitHub Pages without asking him again; the first publish
  waits neither for the core to work end to end, nor for his call, nor for Gary
  to have the Xerte copy's address; and each work item may be published once
  it is developed, provided publishing does not cause
  "untoward delay or overhead". His confirmation is read as: the first publish may replace v3 at
  the github.io address with v4 as it then stands. It is not read as a v3
  release, `npm run push`, a tag, a hand change to `docs/` or `version.json`,
  or leave to skip the gate, Codex's review or the publishing step's guards;
  publishing goes only through the step PUB-01 builds. Whether Gary has the
  Xerte copy's address he did not say.
- Q5, Q6, Q7: the recommended options stand.
- Q8: the recommended option stands for v4.0 ("Every lap the same"). His
  addition is read as a wish for a later feature that lets a repeating crowd's
  laps vary; what "expressions" means is his to say when that feature is
  planned.
- "no more pauses until 08:00" is read as: he is away until about 08:00 UK time
  on 19 Nov, and nothing is put to him before then.

## Where his words now stand in the record

Each quotation below is copied from between the markers of the session notes
file named; every place listed holds it, inside double quotes, character for
character. Quotations of part of an answer are listed after the whole ones.

| His words (verbatim) | Lane file | Where it stands in the record |
| --- | --- | --- |
| "scene ends when all animation has concluded (although some animation could be cyclical so will need a grace period or control for how long to last)" (Q1) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/CORE-02.md` |
| "recommendation good" (Q2) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/CORE-01.md`, `project/items/CORE-02.md`, `project/items/CORE-06.md`, `project/items/FEAT-04.md` |
| "open to reccomendation but no backwards compatibility needed" (Q3) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/CORE-09.md` |
| "Xerte copy works, progress with pages" (Q4) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/PUB-01.md` |
| "q5) as recommended" (Q5) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/FEAT-01.md`, `project/items/FEAT-02.md`, `project/items/FEAT-03.md`, `project/items/FEAT-06.md` |
| "q6) as recommended" (Q6) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md` |
| "q7) as recommended" (Q7) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/FEAT-07.md` |
| "q8) as recommended for now, but future feature may include expressions that make it varied" (Q8) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/FEAT-04.md` |
| "as recommended for now, but future feature may include expressions that make it varied" (Q8, from "as recommended") | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `project/wish-list.md` |
| "re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)" (Publishing) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/PUB-01.md` |
| "publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)" (Publishing, part) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `project/decisions.md` |
| "so long as doesn't cause untoward delay or overhead" (Publishing, part) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `project/items/PUB-01.md` |
| "yes, publish, and I'm going to bed now, so hopefully no more pauses until 08:00" (Confirmation) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/items/PUB-01.md` |
| "cyclical" (Q1, part) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `project/decisions.md` |
| "a grace period or control for how long to last" (Q1, part) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `project/decisions.md` |
| "will need a grace period or control for how long to last" (Q1, part) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `project/items/CORE-02.md` |
| "no backwards compatibility needed" (Q3, part) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md` |
| "Xerte copy works" (Q4, part) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/items/PUB-01.md` |
| "progress with pages" (Q4, part) | `JOE-ANSWERS-ROUND-1-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `project/decisions.md`, `reviews/v4-architecture-plan-2026-11-18.md` |
| "expressions" (Q8, part) | `JOE-ANSWERS-ROUND-2-2026-11-18.md` | `reviews/v4-plan-question-round-answers-2026-11-19.md`, `reviews/v4-architecture-plan-2026-11-18.md`, `project/wish-list.md`, `project/items/FEAT-04.md` |

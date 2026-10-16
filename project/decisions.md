# Decisions

<!-- Newest first. Never edit an old entry; supersede it. Rule 1 reads
     exactly the latest ten entries' heading, Decision line and Deferred
     line, newest first. The Decision line states the what and its
     one-line why; Rationale holds evidence and detail, read on demand.
     The slice fails at close over 1,000 words. Entries the migration
     inventory lists are inherited and read as heading and Deferred
     line only; this ledger inherits none — the canon decision log is
     frozen under pm_skills/ and indexed by project/history.md. Grammar:
     ## YYYY-MM-DD — ID — title
     **Decision:** what was decided and its one-line why.
     **Rationale:** evidence and detail, in the terms another session
     would need.
     **Supersedes:** YYYY-MM-DD — ID — title, or "none".
     Optional **Deferred:** comma-separated target IDs, or "none".
     Budget 45 live entries: when the validator warns, tools/archive.mjs
     moves the oldest entries verbatim to project/archive/ — on the
     owner's word, as the rules file says. -->


## 2026-10-16 — CROWD-08 — All seven MVP parts shipped; phase closed

**Decision:** CROWD-08's seven-part football and mob MVP is shipped and its
phase closes; REFACTOR-01 remains first next because the owner put refactoring
before v4, and the lead asks what comes next before starting it.

**Rationale:** Reconciled against PLAN-4's list and every A–G acceptance section
in project/items/CROWD-08.md: A crowds without a route shipped in v3.3.719 (PR
#139, also DEF-84); B centred Start areas in v3.3.720 (PR #142); C
arrival-ranked Finish areas in v3.3.721 (PR #144 and checked area-storage
correction #145); D relative Entry weights (#147), E independent checked copies
(#148), F Groups (#150), and G waiting/nearest-first Final whistle (#151) ship
together in v3.3.722. Source PRs own design/code reviews, full gates,
legacy/mutation proofs and committed browser/export evidence; REL-719 through
REL-722 own publication. Both private football and mob scenes were exercised
without publishing examples. Legacy off/inactive paths, additive persistence,
separate per-emitter settings, finite lifecycle bounds and the Groups/Final
whistle exclusion remain the recorded MVP limits. Carbon's native
controls/helpers, Nielsen 3 and 9's reversible actions and actionable refusals,
WCAG 2.2 AAA's 44 px targets/keyboard/focus/contrast, and house conventions'
event ownership, persistence and tests were applied. REV-03/REV-05 still own
manual assurance; the existing export wishes and general ZIP, layout and cache
observations remain open, with no scope added. The new very long crowd-name
observation gets one unjudged wish line.

Before the owner’s v3.3.722 waiver, local recall on this reconciled record
was first self-scored 8/8; independent record review R1 corrects it to
7/8 (1,2,2,2). Its original answers, produced before writing the result, are
retained: (1) project/trajectory.md → MVP and Ahead of
Phase 2's last defects names CROWD-08, DEF-84, DEF-98 and DEF-94, newest first;
(2) decisions.md → Part G: waiting crowds leave nearest first preserves seeded
identities while ranking release slots, for the football leaving scene; (3)
project/wish-list.md retains the 719/721/722 saved-file checks, presets/v4 area
proposal and general ZIP/cache/layout observations, while backlog.md's
REV-03/REV-05/EX-01 and defect lines retain their scope; (4) backlog.md → Next →
After CROWD-08 names REFACTOR-01 before MERGE-01, because the 14 October
REFACTOR-01 decision puts modularisation before v4. This is local recall, not a
fresh-session handoff test. The earlier pre-close baseline was separate and is
not this phase-close result. After the owner’s explicit 722 waiver changed the
open checks, a separate local recheck was also self-scored 8/8 and is corrected
to 7/8 (1,2,2,2). Its original answers, produced before its result write, are
retained. Answers (1), (2) and (4) keep the same anchors;
answer (3) now cites REL-722’s waiver and wish-list.md’s remaining 719/721 checks.
Both corrected scores and original answers are retained in order. R1 found
answer (1) partial in both rounds: DEF-94 should have been DEF-89 and the
Phase 3 — Design reviews anchor was missing. tools/ledger.mjs reads the latest
line of each phase first, so CROWD-08 now follows DEF-84 within the MVP phase;
this restores the reader’s newest-first order without moving any prior item.
After both R1 repairs, a separate local recall scored 8/8 (2,2,2,2), with
answers produced before its result write: (1) the canonical trajectory reader
now returns CROWD-08, DEF-84, DEF-98, DEF-89, under MVP, Ahead of Phase 2’s last
defects and Phase 3 — Design reviews; (2) Part G’s decision explains seeded
identities and nearest-first release for the football scene; (3) REL-722 and
wish-list.md retain the 719/721 saved-file checks and all earlier open export
wishes, including REL-703/REL-706; other deferred work remains in backlog.md; (4) backlog.md → Next and project/items/REFACTOR-01.md retain the
owner’s refactor-before-v4 sequence and owner-decided plan. This third result
has its own trajectory line and remains local. REFACTOR-01 is not begun; the
lead asks what comes next.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — REL-722 — v3.3.722 publishes CROWD-08 D–G together

**Decision:** v3.3.722 publishes Entry weights, checked crowd duplication,
Groups and Final whistle together under the owner's consolidated-release call.

**Rationale:** The existing part decisions own their implementation choices.
Each source merge matched its independently approved final source/PNG tree: D:
PR #147, merge b0e883862e3e6982ef962a1a01b0aaea038cfe7d, final head
6c8052912fa52234b816b8f382f0ba024b7b29a9, independent gpt-6-astra xhigh round 3
approved, pull_request Verify 38726961801 succeeded; E: PR #148, merge
6ba84d388816b4ff1e050b343bdaa9f6f0410456, final head
a21a6d26704ea9812e3cd99c0aaa77188f52dcf0, independent gpt-6-astra xhigh round 3
approved, pull_request Verify 38789757329 succeeded; F: PR #150, merge
6650e7645dc8357190641837882484172500a5f3, final head
ac5edb1b385e9a98afa6f0562cccec0a0a33807a, independent gpt-6-astra xhigh round 3
approved, pull_request Verify 38844165787 succeeded; G: PR #151, merge
5daf698687a3b98d6d31aebfeb138b3d4af9566a, final head
69083409bb89718a0380d6e66272825bc869f469, independent gpt-6-astra xhigh round 1
approved, pull_request Verify 38860680318 succeeded. The final combined
runtime's local gate and both mandatory publication gates retained every test:
201 test files, 4323 passing tests and 2 existing todos; shell/build/check
passed, zero unhandled errors. Deploy 148de6114b3091179b20545bf9af5ccc232f1f99
was pushed from clean matching main; main-branch Verify 38871256324 and Pages
checks succeeded, github-pages deployment 7114094439 reached that SHA, and
published comparison was match 22, mismatch 0, errors 0. The player is
byte-identical to the final G committed archive; the app differs only in
build.js's single build-time comment, with every other byte identical. Live
checks after cleared localStorage, sessionStorage and IndexedDB, six-waypoint
Open day played to 3002 ms and reached its end with zero queued frames; MP4
9819817 bytes, 1920×1080, 29.033333 s, decoded frames differ in 7525 sampled
pixels; original HTML 2070460 bytes carries CSP/project/exact live player and
plays to exact end with moving pixels, no external resources or exceptions;
rendered version stamp visible, no unexpected console/JS errors or failed
application resources. Annotated tag v3.3.722 was pushed at that deploy SHA.
Part G's PR owns 32 exact saved-ZIP reopens, five decoded moving MP4 variants
with 131 matching normalised evaluations, the original current-player HTML
reaching its exact end/idle, 37 inspected PNGs and the preserved failed attempts
preceding successful corrections. These browser checks do not replace the
separate owner saved-file check. After publication, the owner answered
“Waive v3.3.722’s disk check”. That explicit waiver retires only v3.3.722's
saved-file check. The existing v3.3.719 promise and v3.3.721 question stay
pending; v3.3.720's earlier waiver remains limited to 720. House conventions: testing and persistence, positive publication
evidence and one owning record per fact; no general accessibility assurance is
claimed.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — CROWD-08 — Part G: waiting crowds leave nearest first

**Decision:** Final whistle shows seeded waiting dots from zero and assigns
ordinary release slots nearest-first, with checked per-emitter Apply/Cancel.

**Rationale:** These are the lead's MVP choices under the owner's Sol High
D–G continuation, not new owner instructions. Fresh Astra xhigh approved the
canonical design against the actual Part F merge, after preliminary review.
The strict optional boolean defaults false and omits false from saved data.
It acts on an emitter's own nonempty network with explicit Entries, every Entry
carrying a Start area, and Disappear or Collect. Zero-length paths and stranded
Entries remain valid. Inactive settings persist with a reason and an off escape;
authored-on Final whistle suppresses Groups even while waiting is ineligible.

Original dot indices retain D's Entry choice, B's sample, pace, junction hashes
and drawing order. Intrinsic-image distance to each chosen Entry ranks dots,
ties by index. The numerically sorted ordinary onset-fraction multiset is
assigned by that rank, so variance and Busyness retain their distribution
without reversing departures. Waiting has no sway. Negative instants are absent;
at exactly zero the initial sample wins even for a zero-duration journey.
At positive instants cumulative terminal time wins. No epsilon or artificial
duration is added; the actual export callers retain their no-duration refusal.

Every active waiting dot uses C/F's reference clock, including without a Finish
area, across hosts, migration, load rollback and export freezes. B keeps its
no-image aspect1 while C keeps reference packing. Active waiting reuses F's
compact indexed true-arc routes independently per original dot; the new-G-only
junction rounding/arc exception is explicit. Inactive motion stays exact. C
ranks actual arrivals jointly across all emitter kinds; nonending bounded walks
park without a place or scene extension. At20,000 full2048-hop routes, codes and
checkpoints occupy92,320,000 typed bytes, excluding descriptors and other heap.
Ranks and release slots are cached, with no per-frame ranking or route rebuild.

A separate app method group owns waiting drafts and complete canonical loader,
text, retained-background and ZIP-bound admission before mutation or undo flush.
Acceptance records one undo/save. Waiting tokens bind actual identities and the
accepted flag, separately from Groups serials. Eligibility is rechecked at Apply,
preserving clearable pending-on drafts through prerequisite edits. Other-kind,
cross-panel and hidden drafts refuse acceptance; duplication exempts neither
and rechecks ownership after its asynchronous ZIP. Newer feedback remains owned.
Carbon native fields/tokens, Nielsen visible status and recovery, WCAG AAA
keyboard/targets/focus/checked submissions and house ownership/persistence/tests
apply. Source verification belongs to the PR, combined publication to REL-722.
This advances G; the whole item remains open until that publication and close.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — CROWD-08 — Verify has room for the complete crowd suite

**Decision:** Verify's job ceiling rises from 30 to 90 minutes so the complete
crowd suite can finish on the hosted runner without dropping checks.

**Rationale:** GitHub cancelled PR #150's Verify run `38829142491` on
`35b480799c4f34c10e11312c83bfce5e35e23804` after 30 minutes, annotating
“The job has exceeded the maximum execution time of 30m0s”. Its log records
3,800 passing test rows across 139 files and no assertion failure before the
cutoff; the complete local R3 gate passed 184 files and 4,187 tests. This is
the lead's capacity adjustment under GATELESS-1 and the owner's continuation
with all tests retained, not a new owner instruction. The ceiling gives the
remaining storage cases and subsequent parts room; it does not make a run
passing or extend any individual test timeout. Every test, assertion, fixture,
canonical command, independent review and exact-head CI requirement remains.
The earlier interrupted local R4 attempt is preserved and is not passing;
the complete correction, configuration and record receive a fresh full gate.
House conventions' truthful verification and behavioural testing rules apply.

**Supersedes:** 2026-10-07 — DEF-81 — Verify gets 30 minutes, since the suite reached 15

**Deferred:** none

## 2026-10-15 — CROWD-08 — Part F: shared group journeys and checked edits

**Decision:** Groups share seeded choices, release and pace on a reference
clock, while checked crowd edits prove whole-project ZIP headroom before mutation.

**Rationale:** These are the lead's narrow MVP choices under PLAN-4 and the
owner's instruction to continue D–G on Sol High with tests and independent
reviews, then publish together. Independent Astra xhigh approved the design
and the storage proof before implementation; approval of the code remains a
separate requirement. Defaults are off, four dots and 2% width; strict size
1–5,000 and finite width 0–20% persist additively, retaining inactive settings.
Off, ineligible and configured-size1 keep the old movement and clocks.

Each emitter's group index owns its Entry, release, pace and junction hashes;
original member indices own start samples, sway and render identity. Actual
members occupy a fixed row-major grid across and behind the front. Width is
normalised Euclidean image distance, so a square looks rectangular on a
nonsquare image. True arc distance pins canonical spline endpoints. A bounded
chord normal narrows U-turns without normalising tiny chords. Members approach
their staging places, wait for the last, lag along the network, then collapse
at a terminal and take C's places in actual arrival order. Walking variation
stops at collapse or nonterminal parking; a nonzero-sway phase step is explicit,
not a promise of general formation continuity. Nonending walks park after the
2,048-hop bound and do not extend the scene or count as arrivals.

Active groups use indexed topology and shared logarithmic weighted sum trees,
rebuilding the excluded arrival path rather than subtracting a huge weight
from a rounded root. New active-group junction rounding is accepted; ordinary
choices retain their exact arithmetic. Packed per-group routes and 32-hop
checkpoints share edge arcs. All active groups use C's reference clock, even
without an Exit area, across editor/player/export/load/rollback. This is a
new-group-only exception to the previous clock choice, not an unrelated fix.

Groups forms use native fields under Motion More and per-emitter outline
forms, context-owned provisional drafts, Apply groups and Cancel edits.
Inactive-on controls permit turning off. Shared readiness errors name applying
groups for this form while ordinary copy feedback stays literal. All three
fields keep their own parameter hints alongside the form instructions through
refreshes and errors. The native Groups grid and checkbox styles are scoped to
these controls, preserving the existing beacon scope. Motion keeps Speed, Pace
variation and At journey end in its primary tier, with Groups under More. Empty
crowds retain disabled Groups controls and usable hints; scoped disabled tokens
and cursors restore on an eligible emitter. Feedback remains with its original
emitter across an empty selection. One app owner checks the complete
canonical candidate before undo flush, mutation or one undo/save. Cross-panel
conflicts name the other panel's cancel route; pending drafts and accepted
edits invalidate E's asynchronous copy. Unrelated newer errors stay owned.

The proven B/C/D completed-ZIP gap is closed by the same checked-edit helper.
Node areas, Entry weights and Groups count exact prepared UTF-8 JSON, every
binary, both path copies, the assets folder and ZIP overhead using the reviewed
browser DEFLATE upper bound. Retained background bytes cannot be omitted.
This sufficient guarantee can refuse a compressible project that still saves;
that deliberate tradeoff keeps these actions synchronous and is explained in
README. The refusal recommends smaller background/fewer images; text failures
retain their own correction. Global Save/prepareArchive/exportZip admission
is unchanged. Exact prepared/post-accept JSON equality is required.

Digest rules: house app ownership, additive persistence and behavioural tests;
Carbon native fields/disclosure/tokens; Nielsen provisional status, prevention
and recovery; WCAG 2.1.3 keyboard, 2.5.5 targets, 3.3.6 checked reversible edits.
Physical-device and screen-reader assurance remains REV-03/REV-05.

**Supersedes:** none

**Deferred:** none

## 2026-10-15 — CROWD-08 — Checked crowd copies preserve drafts and ZIP text

**Decision:** Duplication preserves pending edits and refuses prepared ZIP text
that the browser would split or replace before accepting a checked copy.

**Rationale:** The independent storage preflight found that successful ZIP
creation alone does not prove text can reopen intact. A browser reproduction
saved and reopened the original with its emoji, then accepted a copy whose
extra metadata shifted that emoji across a 16,384-code-unit string boundary;
the generated ZIP failed the loader's fatal UTF-8 decoder. Node's encoder can
instead replace the character, so tests compare exact restored text as well.

The independently approved correction checks the exact prepared JSON for
surrogate pairs crossing every chunk boundary and for raw lone surrogates.
Well-formed JSON escapes remain safe. A regression pins the reviewed browser
JSZip distribution, because its chunking and encoder own this assumption.
Duplication still validates the complete model and actual compressed ZIP, with
its existing asynchronous ownership guards. A refusal preserves source,
selection, inspection, history and recovery; a label or image-name correction
permits retry. The existing native error owners link the recovery instruction.
Readiness also checks live Node-area, all Entry-weight rows, both Path-weight
editors and Busyness number drafts before validation and acceptance. Tracking
compares the last displayed value, preserving unchanged rounded readouts. An inline rename can blur and commit during a strip rebuild
after validation. Starting one now abandons the current check before creating
the new input; its old completion cannot redraw, commit or steal focus. An
already open rename is refused without rebuilding its row, preserving the
field even when a native action activates without first moving focus. The user
finishes the name and retries as a separate reversible action.

This applies house persistence and behavioural testing, Nielsen prevention and
recovery, Carbon helper text, and WCAG checked reversible submissions.

**Supersedes:** none

**Deferred:** none

## 2026-10-15 — CROWD-08 — Part E: a checked independent crowd copy

**Decision:** Both native authoring surfaces duplicate a crowd above its source
in drawing order, with fresh identities and seeds, only after its complete
candidate passes the loader and actual ZIP exporter.

**Rationale:** The lead follows the independently approved E design under the
owner's Sol High continuation and consolidated-publication instruction. Above
means source index plus one in the existing bottom-first scene order; UI-07
remains parked. The detached canonical copy keeps hidden state, dormant graphs,
all emitters, areas, shares, curves, precision and waypoint/image references.
Compact IDs avoid the project's existing identities and remap graph endpoints;
Emitter.reseed supplies fresh authoring-time seeds with its same-value fallback.
The bounded copy name avoids splitting a surrogate pair. Redo restores these
allocated values rather than generating another pattern.

One app-owned operation performs JSON/load and metadata checks, then awaits
successful real compressed ZIP generation with retained original background
bytes. Preparation alone cannot prove the completed 50 MiB limit. While checking,
no model, selection, history or save changes. A project/channel token plus scene,
source identity, authored revision, canonical model, asset values/references,
background, selection and undo owner checks reject obsolete completion. Pointer
transactions and unsubmitted Crowd number/seed drafts are refused before checking
and again before acceptance. Copied waypoint anchors resolve before the first
draw; original live layers remain intact. Accepted insertion selects the copy,
records one reversible change and autosaves once.

Layers and the outline expose native actions, visible loading and persistent
linked refusal reasons. Outline duplication alone owns asynchronous settlement;
its per-form/context feedback cannot erase or replace an unrelated form's newer
error, and ordinary commands retain their synchronous contract. Source replacement
invalidates old controls; obsolete project work cannot steal selection or focus.
Carbon native actions/tokens; Nielsen 1/3/4/5/9; WCAG AAA contrast, 44 px targets,
keyboard, focus and checked reversible submissions; and house app ownership,
persistence and behavioural tests apply. REV-03/REV-05 retain device and screen
reader assurance. The source PR owns regression, mutation, golden and browser
verification. This is a part advance, not whole-item closure or publication;
F and G precede the one combined release and record.

**Supersedes:** none

**Deferred:** none

## 2026-10-15 — CROWD-08 — Sol High implements D–G with consolidated publication

**Decision:** On the owner's word, GPT-6.1 Sol High implements the remaining
CROWD-08 parts, and their releases are consolidated while tests and independent
Astra Extra High reviews remain required.

**Rationale:** The owner, verbatim: “at a timely point, switch the route plotter
CRM task to Sol High and consolidate the releases to speed it up, while keeping
the tests and independent reviews.” This instruction was verified in his human
message in the coordinating chat and relayed with the implementing task's
model/effort override. The running Part D gate was preserved through its
successful exit: 158 files, 3770 passing tests and two existing todos, with
shell/build/check passing. The switch takes its checkpoint there.

The lead's concrete plan is independently reviewed source parts D, E, F and G,
merged in that order, followed by one combined deployment and one release-record
PR where feasible. This replaces GATELESS-1 condition 7's release after every
shipping merge for these remaining parts only. Earlier release evidence and
owner checks stand: v3.3.719's promise is not completion, v3.3.720 alone was
waived, and v3.3.721's saved-file question is still pending. No feature or
required verification is dropped. Fresh read-only reviewers remain
`gpt-6-astra` at `xhigh`, round after round until approval; the implementing
session never approves itself. Source tests, regression and browser/export
checks, exact-head CI and final integration verification remain required.
Focused checks run early; evidence is reused only while the code it checked
is unchanged. The final combined runtime receives the full gate and release
verification. The deadline and A–E priority remain PLAN-4's; changing F/G scope
still requires the owner's word. House conventions: record the authority and
its narrow replacement without rewriting historical decisions.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** none

## 2026-10-15 — CROWD-08 — Part D: relative Entry weights preserve equal choices

**Decision:** Explicit Entries gain relative weights through the Node card and
scene outline, while equal weights keep every dot's existing seeded choice.

**Rationale:** Under the approved Part D brief and the owner's easier-safe-MVP
preference, the lead chooses a strict optional finite number from 0.01 to
Number.MAX_VALUE, default 1 omitted from saved data. Type changes retain it;
implicit starts and Follow route ignore it. Max-scaled normalization avoids
overflow. Unequal choices reuse one cumulative distribution per guide and a
binary first-greater lookup; equal values retain the exact old floor
expression, including its floating-point boundaries. The same single hash
draw and hop feed all lifecycles, journey measurement and first-terminal
selection. Both journey and finish-geometry cache keys include ordered node
id/weight tuples. Nominal shares use the existing Path percentage rounding;
finite seeded crowds need not match those percentages, and the help says
very small weights may never be chosen. Stranded Entries remain in the pool.

One app-owned setter checks a detached canonical candidate against the whole
loader and asset-aware archive budgets before any live mutation or undo
flush. Both native surfaces preserve decimal precision, commit one reversible
edit and autosave, and clear corrected no-op errors without a new edit.
App-owned identity/state tokens preserve drafts on unrelated refreshes and
reject stale commands after replacement, Type changes or accepted edits from
the other surface. No component receives the app. Legacy absent/default node
JSON stays unchanged. The source PR owns regression, mutation, golden-trace,
committed-build browser and independent review evidence; publication belongs
to its REL record. Standards: carbon's existing native fieldset/number/output
pattern and tokens; nielsen 1, 3, 4 and 9 for visible shares, reversible edits,
consistent names and specific errors; wcag-2.2-aaa 2.5.5, 2.1.3, 2.4.12 and
3.3.6 for targets, keyboard, retained focus and checked submissions;
house-conventions' app ownership, additive persistence and behavioral tests.
Physical-device and screen-reader assurance remain REV-03/REV-05. This is a
part advance; CROWD-08 remains open for E–G.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — REL-721 — v3.3.721 ships CROWD-08 Part C's finish areas

**Decision:** v3.3.721 ships CROWD-08 Part C's centred Exit finish areas, while the item remains in progress for D–G.

**Rationale:** Released under GATELESS-1 and PLAN-4 after PR #144 merged as 722ba1d7deb7068aefce8ef7baa69187f108c479; final source head 353e40276d3bb565608850e6093a2d776c061f08 had independent gpt-6-astra xhigh approval in round 1 and successful pull_request Verify 38625793245. The existing Part C decision owns the geometry and interaction choices. Before publication, the area-storage correction PR #145 merged as c20be408fbbf69bce696f0c065fc0418b4e806dc; its final head b598a3707b47159a77a29b227148145cd17364f7 had independent xhigh approval in round 1 and successful pull_request Verify 38637633075. The separate area-budget decision owns the stopped prepublication attempt and the shared Start/Finish refusal fix. This release includes both reviewed changes. Deploy 2c2ae17c3c607d0f98f31d8058c50a46f7fbcefa: 154 test files, 3708 passing tests and 2 existing todos; shell/build/check passed, zero unhandled errors; push succeeded, main-branch Verify 38645187383 and Pages checks succeeded, github-pages deployment 7078404693 reached that exact SHA, and published SHA-256 comparison was match 22, mismatch 0, errors 0. Live readiness and Open day playback/export smoke passed after clearing localStorage, sessionStorage and IndexedDB: six-waypoint Open day played to 3002 ms, then the end in 1442 further frames with zero queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.033333 s, decoded frames at 1 and 2 s differ in 7525 sampled pixels; HTML 2,054,517 bytes with CSP, embedded project and exact live player; no unexpected console/JS errors or failed application resources. The original live HTML export also played from start to end in a fresh tab, with moving pixels, a hidden error panel and no external resources; these headless checks do not substitute for the owner's saved-file check. Annotated tag v3.3.721 was pushed at the deploy SHA. These export/player changes independently require saving and opening MP4 and HTML from disk; that check is owed pending the owner's completion or an explicit waiver for this release. For the separate v3.3.719 check, the owner answered on 14 October, verbatim: “I’ll save and open both exports”. The lead records a promise, pending confirmation that both opened successfully; it is neither completion nor a waiver and does not cover v3.3.721. CROWD-08 continues with Part D after this release record; no phase or whole-item close is claimed. House conventions: publication evidence lives in this record, implementation choices in the existing Part C decision, and outstanding owner assurance remains open.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — CROWD-08 — Area edits preserve a project that can be saved and reopened

**Decision:** Start and Finish area edits validate a detached canonical project against the loader and archive limits before changing the model or undo history, so an area cannot make a previously storable project exceed those limits.

**Rationale:** Part D's independent brief review found that a new Entry weight could cross whole-project budgets; the implementing lead then reproduced the same gap in the shared B/C area setter on main after PR #144. A canonical project accepted at 100,000 tree values became 100,005 after adding an Exit area, and the loader refused it. The v3.3.721 release was stopped before publication: its first local gate and dry run passed, but the publishing helper's second gate was interrupted; no deploy commit or version bump occurred and live v3.3.720 remained unchanged. This focused correction stays under CROWD-08 and precedes the renewed release cycle.

The existing app-owned setter now validates the proposed saved scene with the loader and the real ZIP metadata preparation, including referenced image manifests and the matching background filename. The check precedes pending-undo flushing and mutation. A refusal retains the model, selection, history and saved state; the card shows a linked, announced error, and the outline uses its existing form-error path. Rejected shape choices and numeric drafts remain unaccepted until validation succeeds; correcting an error to the unchanged stored value clears it without an edit. Both Entry and Exit use this owner. Packing, clocks and playback are unchanged. Standards: house conventions for one mutation owner, additive persistence and regression/mutation evidence; carbon native number/select fields; nielsen 3 and 9 for preserving work and actionable errors; wcag-2.2-aaa 3.3.6 and 2.1.3 for validated reversible submissions and keyboard correction. The source PR owns verification; publication evidence belongs to REL-721. CROWD-08 remains in progress for D–G.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — CROWD-08 — Part C: arrival-ranked places in centred finish areas

**Decision:** Collect dots reaching an area Exit take reference-sized grid places in arrival order, using a derived reference clock so their places and finishing times survive changes of output.

**Rationale:** The lead adopts the independently approved Part C brief under GATELESS-1 condition 2 and the owner's easier-MVP preference; these are implementation calls, not new owner words. All emitters compete at each reached explicit Exit, ranked by unextended arrival, then emitter order and dot index. The largest size among all emitters sets a diameter-plus-quarter grid. A whole disc must fit: ellipses use their true inward parallel curve, including its cusp, rather than subtracting radii from axes. Stored-coordinate bounds filter centres without clamping them. Bounded integer intervals and a lazy merge materialise only the requested prefix; capacity is exact when counted, otherwise a truthful lower bound. Overflow repeats places and zero capacity collects at the node. The final straight walk suppresses walking variation. Terminal time wins over Exit, then Entry, using one seconds-to-milliseconds sum; the lead accepts the possible sideways step from the old network sway at the exact Exit, as in Part B.

Packing uses the persisted render reference, intrinsic image and authored background zoom. Without an image, Finish uses the reference rectangle while Start retains B's square plane; both surfaces explain the difference. An eligible dot's release uses reference-space route geometry, editor-canonical speed, pauses, reveal intro and positive Comet tail, or A's authored base without a route. Arbitrary saved constant-time route duration does not set that span; the hints state this and its possible difference from other dots and the visible route. Only Collect dots actually reaching an area Exit use this clock, including zero-capacity areas; mixed journeys keep per-dot clocks. The release span is never written into the legacy animation duration. Missing references migrate through timingReference, then 1920×1080, consistently in both hosts. DEF-78/79/80 remain open.

Fresh calculators on complete authored tuples isolate eligible route and network geometry from the legacy incomplete curvature key. Warm edits, cancellation and same-id reloads agree with cold results; legacy curvature goldens remain unchanged. The broader cache defect remains a wish line. Geometry and arrival allocations have separate caches with weak model ownership. App-owned context is installed coherently during load and rollback and frozen through path-only export suppression. Both authoring surfaces share one description and durable area setter, preserve drafts and refresh capacity after relevant edits. Standards: carbon native fields and More disclosure; nielsen 1, 3, 4 and 9 for truthful capacity, reversible edits and matching reasons; wcag-2.2-aaa 2.5.5, 2.1.3 and 2.4.12 for targets, keyboard and focus; house-conventions for ownership, additive persistence and regression tests. Physical-device and screen-reader assurance remain REV-03/REV-05. The source PR owns checks and review evidence; publication belongs to its release record. CROWD-08 remains open for D–G.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — REL-720 — v3.3.720 ships CROWD-08 Part B's start areas

**Decision:** v3.3.720 ships CROWD-08 Part B's centred Entry start areas, while the item remains in progress for C–G.

**Rationale:** Released under GATELESS-1 and PLAN-4 after PR #142 merged as 04be29e4700f69934bdf74cc2dffe2aa9cbb785a; final source head b66a7515e7e278a624ed36d60e9aac3d29d4b715 had independent gpt-6-astra xhigh approval in round 1 and successful pull_request Verify 38596381929. The existing Part B decision owns the geometry and interaction choices. Deploy baa3a4c1a4800679908798edb3b49b1f0d51c620: 148 test files, 3658 passing tests and 2 existing todos; shell/build/check passed, zero unhandled errors; push succeeded, main-branch Verify 38605180272 and Pages checks succeeded, github-pages deployment 7072193377 reached that exact SHA, and published SHA-256 comparison was match 22, mismatch 0, errors 0. Live readiness and Open day playback/export smoke passed after clearing localStorage, sessionStorage and IndexedDB: six-waypoint Open day played to 3002 ms, then the end in 1442 further frames with zero queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.033333 s; HTML 2,041,847 bytes with CSP, embedded project and exact live player; no unexpected console/JS errors or failed application resources. The original live HTML export also played from start to end in a fresh tab, with moving pixels, a hidden error panel and no external resources; these headless checks do not substitute for the owner's saved-file check. Annotated tag v3.3.720 was pushed at the deploy SHA. This tenth build and its export/player changes independently require saving and opening MP4 and HTML from disk; that check is waived by the owner on 2026-10-14, verbatim: “Waive v3.3.720’s disk check”. For the separate v3.3.719 check, the owner answered on 14 October, verbatim: “I’ll save and open both exports”. The lead records a promise, pending confirmation that both opened successfully; it is neither completion nor a waiver and does not cover v3.3.720. CROWD-08 continues with Part C after this release record; no phase or whole-item close is claimed. An extra generic item-commit shape probe (`check.mjs --commit HEAD`) rejected the helper’s prescribed `chore: deploy` subject and absent Verify body; the normal ledger check passed. The lead treats this as a pre-existing convention/checker mismatch, recorded for reconciliation, without changing the generated commit; it is separate from the required release checks, which passed. House conventions: publication evidence lives in this record, implementation choices in the existing Part B decision, and outstanding owner assurance remains open.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — CROWD-08 — Part B: seeded starts inside centred node areas

**Decision:** Entry nodes gain rectangle or ellipse start areas, centred on the node and set by width, height and turn, so Disappear and Collect dots walk from seeded points to the unchanged network.

**Rationale:** The independently approved Part B brief applies the owner's centred-area MVP choice and gateless preference. The lead chooses image fractions 0.01–0.8 (default 0.1), clockwise degrees -180–180 (default 0), and intrinsic image-plane rotation; without an image the fixed square plane keeps playback independent of viewport size, with an explanatory hint. Rectangle draws are uniform and ellipse radius uses sqrt; a separate seed namespace preserves every old graph, onset and pace draw. At the outer stored-coordinate bounds, clipping the centre-to-point ray keeps samples inside both the shape and allowed box, intentionally sacrificing uniformity there. Shared journey totals include the approach; total terminal state wins over coincident onset/Entry boundaries. Walking variation is suppressed through the exact Entry instant, then resumes its old network value: the lead accepts the resulting sideways step as the easier MVP, pinned in adjacent-instant tests and Chromium. Respawn, Repeat journey, Follow route and non-Entry Types retain inactive data. Absent areas preserve old JSON and node event payloads. The app owns both card and outline edits through one validation/undo/autosave path, separate from the pen's older mutation exception; stable owner identity preserves drafts through unrelated sync and discards drafts superseded by an accepted outline edit. Image replacement refreshes timing only when its relevant intrinsic aspect changes; late-load rollback restores the old context. The Edit-only overlay uses shared geometry below guide edges. Standards: carbon's native select/number fields and single More disclosure; nielsen 1, 3, 4 and 9 for matching state, reversible edits and specific errors; wcag-2.2-aaa 2.5.5, 2.1.3 and 2.4.12 for 44 px controls, keyboard paths and retained focus; house-conventions' app ownership, additive persistence and regression tests. Physical-device and screen-reader evidence remain REV-03/REV-05. The source PR owns gate, mutant, golden-trace and browser evidence; publication belongs to its release record. CROWD-08 remains open for C–G under the owner's continuation instruction recorded by REL-719.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — REL-719 — v3.3.719 ships CROWD-08 Part A; Codex takes over implementation

**Decision:** v3.3.719 ships CROWD-08 Part A, closing DEF-84, and Codex takes over implementation under the run's grant while a separate read-only Codex reviews each CROWD-08 PR at xhigh until approval.

**Rationale:** Released under GATELESS-1 and PLAN-4 after PR #139 merged as 5e03a4caeea87a707270f922ed10d6bc23c2aa96, with final PR head 681aef1417f003add144735bbd6cfe1e2b88c391, independent gpt-6-astra xhigh approval in round 3, and successful pull_request Verify 38564372857. Deploy 457ead0c82e0c0466d514c19a029e9e3488812f0: 142 test files, 3579 passing tests and 2 existing todos; shell/build/check passed, zero unhandled errors, push succeeded, main-branch Verify 38573554808 and Pages deploy succeeded, github-pages deployment 7066952839 reached that exact SHA, published SHA-256 comparison match 22, mismatch 0, errors 0. Live readiness and Open day playback/MP4/HTML smoke passed after clearing localStorage, sessionStorage and IndexedDB: six-waypoint Open day played to 3002 ms, then the end in 1442 further frames with zero queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.033333 s; HTML 2,038,373 bytes with CSP, embedded project and exact live player; no unexpected console/JS errors or failed application resources. The first wrapper run flagged the pre-existing root-site favicon 404, documented before publication, in its raw resource list while already classifying it as known in the console list; the lead corrected that harness inconsistency using exact resource URLs and retaining the first evidence, then reran the full live smoke successfully with no failed resource entries or JavaScript errors. No production test or release code was changed for that correction. Annotated tag v3.3.719 pushed at the deploy SHA. The release changes export admission and the HTML player, so its MP4 and HTML saved-file check is owed pending the owner's completion or an explicit waiver for this release; v3.3.720 will independently owe the tenth-build check.

The owner's 14 October words, recorded verbatim by the handing-over lead: "I would like to handover development to codex, where I have 80% of usage left, as I need to use claude usage for other projects. can you write a handover prompt? it has directory access"; later "close out here, codex at large". The implementing lead initially read this as transferring the existing build, gate, commit, push, merge and release authority to Codex. At ~13:21 BST the owner directly instructed this Codex session: "when you have a moment, can you factor this in: Read and follow ~/route-plotter-bigrun/CODEX-MERGE-PROMPT.md". That prompt explicitly directs those steps through the reviewed REL-719 record and says, "After REL-719, carry on with part B as the handover prompt says." This confirms implementation authority and continuation for this session; every PR still receives the recorded independent review, and the implementing session never approves its own work. No numeric session budget is changed. The profile's Handoff line is updated to that division of work. This replaces only the implementing harness in GATELESS-1; the grant's other conditions and PLAN-4's CROWD-08 review bar stand. On "autojazz or run gateless as possible - mvp decisions err on the side of easiness", the lead's reading is to choose the easier safe MVP option under GATELESS-1 condition 2 and report that as its own call, asking only where a safe choice is unavailable; review and release conditions stand.

The owner chose "Keep the row (Recommended)" for Play's reason after seeing the 1280×800 shots; the lead keeps the row and corrects portrait fitting around its wrapped height. His area-placement answer was "as per your reccomendation, but the full feature in v4": MVP areas stay centred on the node, with width, height and turn only. Reading "full feature" as an off-node area dragged or offset is lead #12's proposal, now a wish line, not an owner decision. His "yes, but provide a prompt to start in fresh chat" authorized Part A's complete cycle. His "ok" acknowledged being asked at release about saved-file checks. The pause and resume were local to lead #13 and are finished.

GATELESS-1 condition 9: Part A already records lead #12's one-off 500k context and 98% stop. For lead #13 the owner picked "500k, as chat #12 (Recommended)" and "99%; agents after reset (Recommended)": 500k for that chat alone, no new agents past about 460k, weekly stop 99%, and Opus agents waiting until the 15 October 02:00 BST reset. These Claude-chat limits do not enlarge the Codex session's standing context budget.

Standards: house event ownership and regression/mutation checks; nielsen 1 and 9, Carbon helper text/disabled state, and WCAG 4.1.2/1.3.1. Chromium exposes Play's computed description; screen-reader speech remains REV-05's owner evidence. Required archival before the Part A close preserved all previous decision text verbatim.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** none

## 2026-10-14 — REFACTOR-01 — After CROWD-08, a refactor in light of PM-Skills 3.1 comes before v4's merge

**Decision:** On the owner's word, REFACTOR-01, a major refactor in light of PM-Skills 3.1's code-management frameworks, follows CROWD-08 and comes before MERGE-01, so that v4's merge of routes and crowds lands on more modular code. It replaces PLAN-4's "MERGE-01 first in Next"; the rest of PLAN-4 stands.

**Rationale:** The owner, 2026-10-14, after CROWD-08's part A was built, verbatim: "my intention is that we will get the MVP out, then do a major refactor in light of pm-skills 3.1 where various code management frameworks (e.g. for encapsulation, dead code, etc) are coming into play that should make dev work more manageable going forwards, then we will do the major work of consolidating paths and crowds and introducing new features where everything is more modular. so things like duration setting values can hopefully be fixed then."

The lead then asked: "shall I record it in part A's record as your stated sequence, with the refactor as an item in Next ahead of MERGE-01? Or leave the record alone until CROWD-08 ships?" He answered "leave until crowd 8 ships". Later the same day he asked: "is the following in the backlog? if not, add it in:", followed by the sequence above, from "my intention" to "more modular." That request supersedes his earlier answer.

It was not in the backlog: Next held MERGE-01 alone, first, under PLAN-4's heading. REFACTOR-01 is filed ahead of it, under one heading for both.

The filing session's readings, for the owner to confirm:
- the refactor changes no behaviour;
- its scope, the frameworks it applies, and their fit with the adopted abstraction plan of 2026-09-22 (whose W4 dead-code items are in Next) are for a plan he decides;
- "encapsulation, dead code, etc" are his examples, not a list.

CROWD-08, its parts and its deadline of 2026-10-20 are unchanged. The item file holds the proposed criteria (`project/items/REFACTOR-01.md`).

**Supersedes:** 2026-10-13 — PLAN-4 — A football crowd and mob MVP comes first; v4 merges routes and crowds

**Deferred:** REFACTOR-01

## 2026-10-14 — CROWD-08 — Part A: crowds play and export without a route; DEF-84 closes by playing

**Decision:** With fewer than two route waypoints, a crowd the engine draws now plays and exports over a base timeline that starts at 10 s and that Duration sets from 1 s to 5 min, while with nothing to play Play and both exports stay off with the owner's reasons, so DEF-84 closes by playing.

**Rationale:** The owner's answers of 2026-10-13 ~22:15 BST to CROWD-08 lead chat #12's task-1 round, labels verbatim, each option's text as the lead wrote it. On PLAN-4's four readings, "All four stand (Recommended)": "specialised … at the expense of being generally useful" cuts features, not the quality standards; parts A to G, their order and supported combinations as CROWD-08 designs them; if the week runs short, each part ships as it lands, A to E first; CROWD-08 stays one backlog line. On DEF-84, "Play, as part A says (Recommended)": "Play, Space, J/K/L and both exports work for a crowd-only project, which a mob scene may need. Your 9 Oct choice still holds when there's nothing to play: Play stays disabled with a visible reason. DEF-84 closes by playing, and the record notes this replaces your 9 Oct pick for that case." His 2026-10-09 pick was "Disable Play with a visible reason (Recommended)". On wording, "…or draw a crowd's network (Recommended)": "Names what's actually missing. A new crowd with no route starts on an empty network, so "or a crowd" would still show after you'd added one." Its preview: Play "Add at least two route waypoints, or draw a crowd's network, to play."; Export MP4 and WebM "Export MP4 and WebM need at least two route waypoints, or a crowd's network."; Export HTML "Export HTML needs at least two route waypoints, or a crowd's network." and "Export HTML needs at least two route waypoints, or a crowd's network, and a background image."; unchanged where a route is still needed, "Add at least two route waypoints first." (Trace) and "Add at least two route waypoints before tracing the route into a crowd.". On Duration with no route (~22:25), "1 s to 5 min (Recommended)": "Enough for a match-day arrival or a mob crossing, with fine steps at the short end. 10 s sits just under halfway." The question had put the same slider setting the scene's length directly, today's direction, a log scale, the readout in seconds, a crowd-only project starting at 10 s, unchanged with a route. His 2026-10-11 suggestion to lead chat #10, "accept "at least two route waypoints" everywhere … your call on best approach", was adopted then by the lead (the lead's call, not his decision); it now applies only where a route is still required, the 2026-10-13 picks governing Play and the exports. The lead's settlements, as the lead's: a hidden crowd still makes the scene playable, as a hidden route does; a refused start (Space, K, J, L, a direct play) is said once through the announcer, no toast, and changes nothing, a pause never refused; the Guide card's sentence shows only while nothing can play, in the owner's export phrasing; with no route the Duration breakdown names the "timeline", and its hint reads "Sets the timeline the crowds release across. Dots keep their own speed. The time shown includes crowds still finishing and Hold at end"; "can release dots" is read as the engine's `evaluate` drawing a dot at some finite instant of the playback (`SwarmEngine.canRelease`, checked against `evaluate` over 360 generated networks). The no-route Duration is undoable, one entry per committed gesture, and autosaved; the route-mode Duration's missing undo is older and already a wish line ("The Duration slider records no undo entry at all", from CROWD-06). Codex checked the brief five times at xhigh; its folds are the brief's §9–§13. Digest rules applied: wcag-2.2-aaa 4.1.2 (name, role, state) and 1.3.1 (info and relationships) for the disabled Play described by its visible line; nielsen 1 (visibility of system status) and 9 (recognise, diagnose, recover: the reason names what to add); carbon's disabled state (the `--disabled-*` tokens, the reason at ordinary text contrast). A screen-reader check of Play's reason and the refusal's announcement (NVDA or VoiceOver) is owner evidence outstanding under REV-05. GATELESS-1 condition 9: on 2026-10-13 the owner let CROWD-08 lead chat #12 run to 500k tokens of context, stopping new agents at 98% weekly all-models use ("500k context, stop at 98% (Recommended)"); later chats keep the profile's 200k.

**Supersedes:** none

**Deferred:** none

## 2026-10-13 — REL-718 — After DEF-98 the next item is CROWD-08, not DEF-15

**Decision:** REL-718 named DEF-15 as the next item. It is CROWD-08, because PLAN-4, merged first, put its MVP heading ahead of Phase 2. REL-718's release facts stand.

**Rationale:**
- **What happened:** REL-718 was written before #135 (PLAN-4) landed. It was rebased onto `5ad50cb` to resolve conflicts, but its next-item sentence and its recall answer 4 were not re-read against PLAN-4's placement ("comes first in Current after DEF-98").
- **The backlog order:** the closed DEF-98 heading, then "MVP — football crowds and mobs — the owner's word of 2026-10-13" with CROWD-08, then Phase 2, where DEF-15 now waits behind CROWD-08.
- **Recall:** the recheck stored as 8/8 had answer 4 wrong, so it should have scored 1 (7/8). After this correction a local recheck answers 4 with CROWD-08 in the MVP heading (PLAN-4's placement), 8/8, stored as its own trajectory line.

**Supersedes:** none

**Deferred:** none

## 2026-10-13 — REL-718 — v3.2.718 ships DEF-98's recovery images; DEF-98 closes, and its heading with it

**Decision:** v3.2.718 is live from deploy `9864efc` (tag `v3.2.718`), released on the owner's word for DEF-98's merge (`e8c361c`, PR #133). DEF-98 closes with its heading, and Phase 2 resumes at DEF-15. The player changed only by minifier renames, so its disk save is waived.

**Rationale:**
- **Release** (`release.sh`): rollback tag `rollback-v3.2.717-e8c361c`; gate green (137 files, 3,484 tests, 2 todo); dry run, then push; deploy `9864efc`; report-build-status, deploy, test-and-build and build all succeeded; Pages built `9864efc`; all 22 live files SHA-256-identical.
- **Live smoke** (the lead's observation in the pane, 2026-10-13 ~18:37 BST, storage and the image store cleared):
  - the Open day route loads 6 waypoints, plays to 3,002 ms of 26,763 ms, then to its end in 1,426 frames with none queued;
  - MP4 9,910,489 bytes, ftypisom, 1920×1080, 28.8 s;
  - HTML 2,037,331 bytes, with the project, its CSP and the live `player.js` embedded;
  - no non-200 resource.
- **DEF-98 on the live site** (the lead's observation): before storage was cleared, the pane held a recovery record in v3.2.717's format, left by earlier smokes. v3.2.718 restored its 6 waypoints and offered "Background not restored: recovery before this release kept no images. Choose the image this route was made on." with Choose image and Dismiss.
- **The player:** `docs/player.js` differs from v3.2.717's only by the minifier's renames. It has the same length, 435,031 bytes, though the raw bytes differ, and it is the same text once every one- and two-character identifier is masked (`perl -pe 's/\b[A-Za-z_\$][A-Za-z0-9_\$]?\b/X/g'`, both SHA-1 `d5b5ac7a5009…`). Masked equality shows the renames are all that changed; it is not, on its own, a proof of identical behaviour. By the owner's export rule (GATELESS-1), a release that changes `player.js` has its exports saved to disk. Asked, the owner waived it for this release only: "Waive this one (Recommended)".
- **What DEF-98 delivers:**
  - Recovery keeps the background, bundled or uploaded, custom markers and the custom path head, each with its file name, size and custom style.
  - Images live in IndexedDB, keyed by SHA-256, and the record carries a version-2 manifest.
  - Each tab holds a shared Web Lock per image it shows, saves or reads, and a deletion needs that image's lock exclusively. Without Web Locks nothing is deleted.
  - A toast names any image not kept, and why. A background that cannot come back is offered by name in the banner slot, never replaced.
  - Clear All removes the images only once nothing needs them, and says so only then.
  - `coordVersion`, the project file format and the player's behaviour are unchanged. No package was added.
- **The owner's words on the PR**, 2026-10-13 (labels verbatim):
  - "Merge and release (Recommended)", whose option text was: "I squash-merge #133 and release v3.2.718 with the usual release script from your OneDrive copy, after checking no other chat is busy. Then I run the live smoke test and file the release record that closes DEF-98."
  - On its six open questions, "Keep all six (Recommended)": (1) the keeping order, background, then the path head, then the markers; (2) no background name in Save Project yet; (3) Choose image keeps the prompt until a background is set; (4) Dismiss is final; (5) the warning toasts stay until dismissed; (6) a browser that cannot store images warns as built.
  - The filing's other readings stand as proposals, tracked by a wish line. "Markers in waypoint order" is the implementation's detail; his option said "then markers".
- **Before releasing** (the lead's observation): two other chats were busy, but neither was in `route-plotter/`. One worked in the PM-Skills Lab folder; the other had just gone idle.
- **The pull request's own record:** five lead rounds (`ab4592a` → `b797a79`). Codex reviewed the brief twice and the code four times (r1: 1 blocking and 7 real; r2: 1 blocking and 3 real; r3: 1 real; r4: approve). The lead checked it in Chromium: real IndexedDB and Web Locks, two tabs, Clear All across tabs.
- **Recall, local** (verbs/recall.md). The lead first scored it 8/8; Codex r1 on the record found answer 3 partial, so the original result is 7/8 (2,2,1,2). After the repair below, a local recheck is 8/8, stored as its own trajectory line:
  1. The last four shipped: DEF-98, DEF-89, DEF-86, DEF-96 (`project/trajectory.md`).
  2. One decision of this heading: DEF-98's, that recovery keeps every image, because a restored session came back with dots on a blank canvas.
  3. What is deferred: the original answer, "every Deferred line below is none", missed the backlog's deferred items (score 1). The repaired answer: EX-01, DEF-78, DEF-79 and DEF-80 (from CROWD-05), DEF-84, 85, 87, 88, 90, 92, 93, 95 and 97 (from CROWD-07), each a `— (from: …)` line in `project/backlog.md`, and the open ideas in `project/wish-list.md`. DEF-98's remaining readings are a new wish line there.
  4. The next item: DEF-15, in Phase 2 (the DEF-98 decision's placement, "before DEF-15").

**Supersedes:** none

**Deferred:** none
## 2026-10-13 — PLAN-4 — A football crowd and mob MVP comes first; v4 merges routes and crowds

**Decision:** On the owner's word, CROWD-08, a football crowd and mob MVP specialised for his client's task, comes first in Current after DEF-98, due by 2026-10-20 and released as v3.3; the run builds it, Codex reviewing at its highest setting until it approves. Once it ships, the bulk of the work goes to v4, which merges routes and crowds (MERGE-01).

**Rationale:** The owner, 2026-10-13, in a read-only analysis session, asked how crowds would show "a mob moving from one area to another" and "attendees of a football match arriving by various routes … then converging on an area (probably one for each of the four sides of the stadium)". He then asked for "the ability to define areas, not just paths". Next: "the top features I need for my client are football crowd; and mob moving from market square, down a road, and to another open space. I also want to be able to have trains / buses / cars on transit routes, as decoration (so running in parralel to other things going on). is there a case to merge routes and crowds with extra settings and features that are selectable … having routes and crowds separately does confuse things a little from a user point of view. one thing with options might feel more cognitively coherent... but maybe I'm misjudging. what do you think?" After the session advised converging in steps: "but crowd paths should be able to act as the camera. what are the pros and cons of unifying the system vs keep seperate?" Then the decision: "I want the next major version to be a merge. but for now, we do MVP for football crowds and mobs - app development can be specialised towards this for next minor versions at the expense of being generally useful so the client can complete their upcoming task. But the bulk of development work will go into the next major version as soon as mvp football crowd and mob have shipped".

The session then put six questions to him in two rounds; his picks, labels verbatim:
- On "When does your client need the football crowd and mob features working?", "Within a week", whose option text read "Cut the MVP to the essentials: items 1–5, groups simplified, presets later." Items 1–5 were crowds without a route, start areas, finish areas, entry shares and duplicating a crowd.
- On extras, "Final whistle", unpicked: "Camera follows a crowd", "Vehicles as decoration" and "Milling in areas".
- On recording, "I write a plan PR (Recommended)".
- On a session filing transit presets at the same time, "distant wish list, ignore". That session's wish line, transit presets by mode and era, was PR #134.
- On areas, "Simple shapes (Recommended)": "An Entry or Exit node gets an area: rectangle or ellipse, set by width, height and turn, drawn on the map."
- On review depth for the MVP's pull requests, in his own words: "max codex, got loads of compute".

After Codex approved the draft, the session asked him four more questions; his answers, verbatim:
- On "The run's standing grant says "no new feature work" and one Codex review at 'high'. For CROWD-08 only, do you confirm these changes?", "Confirm both (Recommended)", whose option text read "The run may build the MVP. Its PRs get Codex at xhigh, round after round until it approves. Everything else in the grant stays as it is."
- On "Do these readings stand: deadline 2026-10-20, released as v3.3, placed after DEF-98 and ahead of Phase 2 (Phase 2 and 3 wait), and MERGE-01 first in Next once the MVP ships?", "All stand (Recommended)".
- On how PR #134 and this record should land, "you take charge and resolve". The session merged #134 as it stood, its CI green, as `d0382c8`, so the transit line sits in `main` once, beside this record's lines.
- On pushing this record and opening its pull request, "Yes, push and open it".

Confirmed by the owner, then:
- the deadline, by 2026-10-20, his "Within a week";
- his word lifting GATELESS-1's "no new feature work" (its condition 2) for CROWD-08 alone, so the run builds it under the grant's other conditions;
- "max codex, got loads of compute" changing GATELESS-1's condition 5 for CROWD-08's pull requests: Codex at its highest reasoning setting, `xhigh` in place of `high`, and rounds until it approves in place of one review and a short pass on a large fix;
- those two replacing GATELESS-1's conditions 2 and 5 for CROWD-08's pull requests alone, hence the Supersedes line; every other condition, and both conditions for all other work, stand;
- v3.3, with `package.json` set to 3.3.0 by CROWD-08's first release;
- CROWD-08 under a heading of its own after DEF-98 (#133, deployed as v3.2.718) and ahead of Phase 2, whose items and Phase 3's wait;
- MERGE-01 first in Next once CROWD-08 ships.

The filing session's readings and proposals still for him to confirm:
- "specialised … at the expense of being generally useful" as cutting breadth, not the quality bars: the brief's mandate, loadable saves, exports and the player, the outline and the profile's standards, tests, and no new dependency.
- The parts' design within his picks, A to G, with the supported combinations in the item file; "groups simplified" as a size and a width only, and "Final whistle" as part G. If the week runs short, the parts done ship first, A to E (the football scene) leading, and the run asks him about F and G.
- DEF-84 closed by playing, since its criteria left disabling or playing to the run.
- One backlog line with seven parts in its item file, since the backlog had 930 of its 1,000 words.

The analysis ran on a scratch clone of main at `86ad88a`. A probe of `SwarmEngine` on a match-day network (four entries, a two-way ring road, four stand Exits, 2,000 dots set to Collect) found:
- each entry sending about a quarter of the dots (482, 509, 510, 499), since entries are picked evenly (`src/services/SwarmEngine.js` (:868));
- station and town fans splitting alike once their streets met, since a junction's choice reads only path weights;
- journeys from 1.3 s to 12.7 s, median 2.7 s, as dots lapped the ring;
- the 2,000 collected dots on 4 points (CROWD-07's X-16).

`play()` returns without a route (`src/app/playback.js` (:288); DEF-84). Both exports refuse fewer than two waypoints (`src/app/exporting.js` (:213), (:421)), and Clear All leaves a zero base timeline (`src/app/projectReset.js` (:76)).

The session advised against merging the models in v3: the route sets the base timeline and carries the camera, labels, beacons and pauses, and a merged object would need a mode switch the abstraction plan's §16 rejects. It proposed converging in steps instead. After the owner's point that crowd paths should be able to carry the camera, it set out both sides; MERGE-01's item file keeps them, with the session's catalogue of movement types as candidate features. That catalogue is a page private to the owner (<https://claude.ai/artifact/Dn8NTvrNok2HMufMtPfsE8>); the item file carries its content.

v4 departs from the founding decision of 2026-08-17 (the frozen canon log; `project/history.md`) and from the brief's Direction. Direction also names the big run as the current work. The brief is the owner's to sign, so it is left unedited: this entry governs where they differ, as GATELESS-1 did, and MERGE-01's plan brings the amendment. The criteria are in the item files (`project/items/CROWD-08.md`, `project/items/MERGE-01.md`); ready-made presets are a wish line.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** MERGE-01

## 2026-10-13 — DEF-98 — Browser recovery is to keep every image, warning when one is not; filed first in Current

**Decision:** On the owner's word, DEF-98 is filed first in Current, to be done as soon as possible: browser recovery is to keep every image, within feasible limits, with its file name, and to warn on screen, naming the file and why, when one is not kept. This supersedes the model-only boundary for images.

**Rationale:** The owner, 2026-10-13, asked: "why does the app load up without a background image? should this potentially be ammended? it's confusing when you have auto-resume with dots but no background, and it makes no sense to select a background other than the one the dots are designed for, so it's a confusing user experience. would it be ok to to immediate backlog?" The cause: recovery's snapshot keeps the route model and clears every image field it knows, bytes and file names alike (`src/app/persistence.js` (:636–668); the wish list's known exception aside), and custom markers and path heads fall back to built-ins (:613–634). Start-up loads the default map only when nothing was restored (`src/app/startup.js` (:14)). The only notice goes to the screen-reader announcer, once per project opened, restored or cleared. Backgrounds the app ships, which carry no privacy cost, are dropped along with uploaded ones. The filing session confirmed it in Chromium on live v3.2.717: the Open day example's route and crowd came back on a white canvas. Asked three questions, the owner picked (labels verbatim). On what the fix covers, he picked "Also keep uploads", whose option text read "Store uploaded backgrounds in the browser too, so everything comes back. This reverses August's privacy rule, and large images may not fit."; the other options were "Built-in + banner (Recommended)" (shipped backgrounds reload, an uploaded one prompts to choose it again, the August rule kept) and "Built-in maps only". On placement, he picked "Top of Current (Recommended)" ("A new 'the owner's word of 2026-10-13' heading ahead of everything, so the run's next pick is DEF-98, before DEF-15."). On timing, he picked "Yes, file it now". The session then put three readings to him, and he answered each, verbatim. On "'Uploads' means uploaded backgrounds only. Custom marker and path-head images still drop on restore.", he said "lets keep everything, within feasible limits, and prove a warning if not happening". On "The on-screen 'choose it again' prompt for a background that can't be restored.", he said "ok, with an indication of file name and why not stored". On "Priority P2.", he said "lets get it done asap". The filing session's readings of those answers, for the owner to confirm: "prove" as "provide"; "everything" as every image the live project references, with its file name, and not images found only in undo history (DEF-23's rule for exports); the feasible limits as no larger than a project file's; a custom marker or path head that is not kept falling back as it does today; the background kept first when the images do not all fit; and "asap" as P1, the item already being first in Current. What the August rule avoided: an uploaded image and its file name now stay in that browser's storage until Clear All, which matters on a shared computer; the option he chose said it reverses that rule. Size: the recovery record is capped at 4 MiB (`src/services/StorageService.js` (:7)), while a background may be 16 MiB (`src/models/ImageAsset.js` (:6)) and a project's custom images 40 MiB in all (`src/services/ImageAssetService.js` (:28)). So not every supported image fits in today's record, whose text grows by a third in base64. Where the bytes are kept is the fix's to decide, within the two-dependency rule. The brief's boundary line (`project/brief.md` (:97–98)) and README's stay as they are until DEF-98 ships and updates them. It replaces, in the canon entry titled "2026-08-26 — REV-10 uses minimum-loss transactional image admission" (frozen; `project/history.md` → Decision lookup), its persistence boundary, "Autosave remains deliberately model-only", for images, from DEF-98's release; its transaction, history and Clear All guarantees stand. Supersedes names only this ledger's headings, which the checker enforces, so the canon entry is named here, as GATELESS-1 named its canon predecessor. The item file holds the criteria (`project/items/DEF-98.md`).

**Supersedes:** none

**Deferred:** none

## 2026-10-12 — REL-717 — v3.2.717 ships UI-06's banner slot PR

**Decision:** v3.2.717 is live from deploy commit `8f0d2be` (tag `v3.2.717`), released under GATELESS-1 because UI-06's banner slot merge (`f6b062c`, PR #130) changed `index.html`, `styles/` and `src/`; UI-06's J-12 and J-05's remainder and CROWD-07's X-02 are made; `docs/player.js` changed, so a disk save is waived.

**Rationale:** release.sh: rollback tag `rollback-v3.2.716-f6b062c`, gate green (135 files, 3,417 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.717 (pane, 2026-10-12 ~22:03 BST, storage cleared, first-start welcome dismissed by the script, 1280×800): Open day route loads 6 waypoints; plays to 3,002 ms of 27,028 ms, then to its end in 1,442 frames with 0 queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.03 s; HTML 2,037,312 bytes with the project, its CSP and the live player.js embedded; no non-200 resource; two downloads captured (route-animation-2026-10-12T21-02-43.mp4, route-animation.html). The duration, frames and MP4 differ from v3.2.716 (27,283 ms; 1,457; 9,664,123 bytes, 29.3 s) because opening a project now fits the canvas to its own 16:9 export size (PR 6), where it kept the default image's 1.41 fit until a resize; the HTML is 1,352 bytes larger, the player bundle it embeds having grown 1,362 bytes (433,669 → 435,031: the viewport mixin's refit, bundled and not called). The PR, the run's PR 6, changed no player code (`src/player/`, `src/services/HTMLExportService.js` and `docs/` are unchanged in `f6b062c^..f6b062c`; `src/app/exporting.js`, the editor's side of an export, now drops a refit's path rebuild as a video export starts and clears the held refit as it ends, (:121), (:164)), but `docs/player.js` changed between the deploys `6ee24fc` and `8f0d2be` (433,669 → 435,031 bytes) in one module it bundles: of the PR's 19 `src/` files, only `src/app/viewport.js` is among the 46 modules `src/player/playerEntry.js` reaches, and its refit's refactor (`canvasAreaOf` and `canvasAreaRoom`, (:19), (:29); `_fittedRoom`, (:56); `_canvasFit` and `_restoreCanvasFit`, (:145), (:167)) comes with the mixin, since `PlayerApp` borrows four of its other functions (`src/player/PlayerApp.js` (:462–465)) and never calls `updateCanvasAspectRatio`; the rest is the minifier's renames, so the change is inert in the player. By the owner's export rule (GATELESS-1), a release that changes `player.js` has its exports saved to disk and opened there, so v3.2.717's disk save is waived, for that release only: the owner, 2026-10-12, "Waive this one (Recommended)" (his pick when asked, ~22:08 BST), the bundled refit never called in the player. The design review of 2026-10-08 found each mode's banner over the header (the area draw's and Edit network's inline-styled, the branch gesture's a toast), so the mode switch, Undo, File and Export were covered while a mode was on (UI-06 J-12, CROWD-07 X-02's banner half, and the wish list's line asking for one shared ModeBanner); toasts at the top over the header, painting over a dialog's backdrop; the Preview badge a pseudo-element nothing could pin; and Edit network's entry said twice; and PR 4 had left the scope chip, the empty-list row and the two banners live beside the announcer for PR 6 (J-05's remainder; its merge body, `48d3864`). J-12: one slot, `#mode-banner`, has a grid row of its own between the header and the main area (`src/components/ModeBanner.js`, new): empty it takes no room; a mode shows one line of 3 rem there (two where the width wraps it), easing over 150 ms and not under reduced motion; the header never moves and nothing covers it. One banner at a time: a mode claims the slot before it becomes active, and a second claim runs the holder's own exit, its Escape's path, first, so a replacement never leaves two modes on, nor revives one that has left; a claim made while another is being replaced is refused before its owner activates. Each banner takes its owner's scope colour, as the scope chip does: route modes and the first-start tip in UoN blue, network editing in the crowd's green. The branch gesture's banner, "Branch from Main entrance — click where it should go. Esc to cancel.", has a Cancel; the gesture ends when its fork leaves the model or any restore runs, focus then placed after the list has rebuilt (the element focused at arm, else the fork's row, else the Route button). The first-start tip waits for the welcome to close and for a mode to leave the slot; a mode replaces a tip, which does not come back. When the slot's height settles the canvas is refitted as a resize refits it, once, at the final height, held while playing and left to an export's own exit. Toasts stand bottom-centre, under a dialog, never over the header, wholly above or below the transport's controls and never over them, capped to the room in the viewport where neither fits, the stack's own scrolling kept. The Preview badge is a real element at the canvas's own top-right corner, shown in Preview and hidden in Edit. A focused banner action keeps a 4 px ring under hover too. J-05's remainder: the scope chip and the empty-list row are not live, nor the banners or the slot; entering each mode is said once, by its owner, the network's duplicate gone; each region's line is said once through the one announcer, a later line in the same operation replacing the first, and a line the operation's own message already covers not said again. X-02's banner half: Edit network's banner is the slot's, so X-02 is whole (its select half in REL-716). Found by the lead on live v3.2.716 and fixed in the PR, not a DEF row: opening a project kept the previous image's canvas fit until a resize (Open day at 1600×640 kept the default image's 697×493, 1.41, until a window resize made it 806×453), so the first banner's refit would have changed it; applying a project now fits the canvas to its own export size (`src/app/persistence.js` (:1090)), its geometry restored if the load fails, an export's identity transform included. Two CI-only races, test-only and older than the PR, were fixed in it: the camera domain goldens' setup frame count (round 5) and the event transcript's boot scene-end timer (round 6). The owner's picks and words: on 2026-10-08, "One slot below the header (Recommended)", to the option that read "One banner slot below the header (the shared ModeBanner of wish-list 22), toasts bottom-centre, the Preview badge top-right of the canvas *(recommended)*", which settled the toasts' and the badge's places with the slot; on 2026-10-10 (~23:55), to his audit, "Proceed as per your recommendations" (its §E.5, outside the repository), which ratified the lead's settled policy for the slot (one line of 3 rem, two where it wraps, the canvas shrinking by the slot's height, a replacement ending the running mode, a 150 ms ease); on 2026-10-11 (~22:30), "PR 6: accept all four proposals as written.": (a) the first-start tip in the slot once the welcome closes, (b) the moved toast container's `z-index` below the modal's 999, (c) the branch Cancel's keyboard focus fallback, the element focused at arm, else the fork's row, (d) the branch banner keeping the Escape hint; and on 2026-10-12 (~11:15 BST), asked what colour each mode's banner should be, "Scope colours, as built (Recommended)" (the option's text: "Each banner takes the colour of the scope it belongs to, as the header's scope chip already does. Route modes (area drawing, the branch gesture) and the first-start tip use UoN blue; network editing keeps its crowd green."). The lead's settlements, from the rules and the four proposals as accepted (folded into the brief from Codex's check of `9466a3f` and its recheck): a mode claims the slot before it activates, the replacement complete first; the gesture ends when its fork goes, and any Undo, Redo, Open or Clear All cancels an armed gesture, its focus placed after the list's rebuild; a tip never replaces a mode but waits, and a tip a mode replaced stays seen and does not come back; the Route button as the last focus step; toasts clear of the transport; a refit skipped while actively playing is held and run once on a pause, completion or reset, an export's exit standing for it; in round 2, the refit at the slot's final height, compared with the room last fitted, and at narrow widths toasts that stay in view and a badge on the canvas's own corner; the badge keyed to the preview state (Codex r1); the banners' words their own, "Esc" written and "Escape" said; the route's duration following the canvas a banner leaves, as a resize does (Codex r1: settled by the policy); in round 3, the opened project's canvas fitted to its export size. The agents' calls the lead kept, Codex agreeing where it was asked: a region's later line in an operation replaces its first; with no room above or below the transport's controls the toast stack is capped to 0, heard but not seen; the cap takes the larger room, below on a tie; a project with no visual reference of its own adopts the canvas it is fitted to as it opens (Codex r3: can stay); a stack first capped by a scroll keeps its scroll (Codex r4: keep); a failed load leaves superseded refit work dropped (Codex r4: no change needed); the domain goldens opened at rest, not after a fixed frame count (Codex r5: keep rest); no per-row guard in the transcripts (Codex r6: the audit suffices). Round 2 (`753f93f`) took Codex r1's blocking and six real findings (no path rebuild inside an export or while playing; the badge shown; no holder overwritten without its exit; a region's line unsaid only where its change's own message says it; focus stopping the chip's line only on the control that names it; the action's ring under the pointer; nothing said after teardown) and its advisories; round 3 (`bc2d3a4`) r2's six (the late end's refit kept after an early fallback; toasts over none of the transport's controls at narrow widths, capped; a region's line covered by the operation that changes it; a scope change named by focus cancelling the chip's waiting line; a 4 px ring for WCAG 2.4.13's area; a claim past the bound refused before its owner is active) and its advisory, with the leg's "+" covering its chip line (Codex r2, on the report's question); round 4 (`1298e2b`) r3's blocking and three real (a failed load during an export leaves the export's canvas and transform alone; a claim its replacements suspend is checked again before it draws; a capped stack keeps the author's scrolling; an oversized stack is capped with the controls out of view) and its advisory, opening a project superseding refit work held or due; round 5 (`1cb8514`, test-only): CI's runner drew one camera frame fewer while a project opened (the centre eases 8% a frame), failing `tests/cameraDomain.test.js` on `bc2d3a4` and `1298e2b`, so the domain goldens open their project on frames run by hand to rest; round 6 (`6f30c69`, test-only): the event transcript's setup settles the scene end an empty route's opening queues on a real 50 ms timer before its fake clock starts (a race older than PR 6, from TST-05, that CI's runner lost on `e83cd7d`, dropping two rows). Codex: the brief on `9466a3f`, 3 blocking, folded as the lead's settlements, and its recheck, 3 real, folded; r1 on `7a74755`: 1 blocking, 6 real, 4 advisories, taken in `753f93f`; r2 on `753f93f`: 6 real, 1 advisory, taken in `bc2d3a4`; r3 on `bc2d3a4`: 1 blocking, 3 real, 1 advisory, taken in `1298e2b`; r4 on `1298e2b`, r5 on `1cb8514` and r6 on `6f30c69`: approve (the Checked line of `f6b062c`); each round's brief checked before it ran, rounds 5's and 6's diagnoses corrected by that check (per-frame easing, not wall-clock time; the scene-end timer, not the duration debounce); the golden churn, the reference change, the five adapted tests and the CI causes each verified by reproduction. CI test-and-build green on `7a74755` (run 38233600692); failed on `bc2d3a4` (run 38283095471) and on `1298e2b` (run 38288517712), `tests/cameraDomain.test.js` "linear.seek", fixed in `1cb8514`; failed on `e83cd7d` (run 38294027421), `tests/eventTranscript.test.js` "waypoint:add, the first waypoint of an empty route", fixed in `6f30c69`; green on `6f30c69` (run 38300376659, 20m07s, completed 21:11 BST; the cancelled run beside it, 38300377691, is the duplicate push run). Tests: 169 added across the six rounds (67, 46, 38, 16, 1 and 1), 3,248 to 3,417, none deleted, skipped or weakened, each changed expectation with its reason; 87 mutants (30, 26, 20, 9, 1 and 1), each killed but m41, a deliberately redundant `:hover:focus-visible` selector whose fix m41b kills; goldens 0 untraced (round 1, 464 control lines in 22 goldens, 2 new contexts and 103 event lines; round 2, 146 control and 118 event lines; round 3, 3,879 lines in 35 files, all but two from a project opening on its own export size, which Codex reproduced on round 2's runtime with that change alone; round 4 none; round 5, 9 lines of `domains-camera.json`; round 6, 2 lines of `event-transcript-wiring-controllers.txt`). The lead's pane pairs (1280×800, before on live v3.2.716) are in `reviews/design-review-2026-10-08-shots/after/` named `pr6-*` (`e83cd7d`, images only). No DEF row closes. The wish list's ModeBanner line retires, and six follow-ups the PR's rounds found are added, the lead's proposals, the owner told. Not in the PR: UI-06's J-06, J-07, J-09, J-10, J-11, J-14, J-15, J-22 and W-06 (UI-07 and W4, as REL-715 split them) and CROWD-07's F7, X-10, X-12, X-16 and F13 (UI-07), X-13 (W4) and DEF-92 (its own brief), as REL-716 split them; UI-06 and CROWD-07 stay open for them. UI-07 is ready, PRs 5a, 5b, 6 and 7 merged and its prompt repaired (outside the repository), and the owner runs it.

**Supersedes:** none

**Deferred:** none

## 2026-10-12 — REL-716 — v3.2.716 ships CROWD-07's crowd cards PR 5b; DEF-86 and DEF-89 close; DEF-97 filed

**Decision:** v3.2.716 is live from deploy commit `6ee24fc` (tag `v3.2.716`), released under GATELESS-1 because CROWD-07's second crowd cards merge (`9466a3f`, PR #128, the run's PR 5b) changed `index.html`, `styles/` and `src/`; CROWD-07's rows X-02 (its select half), X-04, X-05, X-06, X-09, F5, F15 and F16 are made with it, and DEF-86 and DEF-89 close, since a stored value past a crowd slider's reach is no longer rewritten and the Guide card is true after a trace. The owed disk save is made; `docs/player.js` changed, so a disk save of v3.2.716 is waived.

**Rationale:** release.sh: rollback tag `rollback-v3.2.715-9466a3f`, gate green (134 files, 3,248 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.716 (pane, 2026-10-12 ~10:00 BST, storage cleared, first-start welcome dismissed by the script, 1280×800): Open day route loads 6 waypoints; plays to 3,002 ms of 27,283 ms, then to its end in 1,457 frames with 0 queued; MP4 9,664,123 bytes, ftypisom, 1920×1080, 29.3 s; HTML 2,035,960 bytes with the project, its CSP and the live player.js embedded; no non-200 resource; two downloads captured (route-animation-2026-10-12T09-00-27.mp4, route-animation.html). The PR changed no export code (`src/app/exporting.js`, `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `9466a3f^..9466a3f`), but `docs/player.js` changed between the deploys `f211c7c` and `6ee24fc` in one fragment of the shared modules it bundles, the build differing from the deployed bundle only by that block and the minifier's renames: RenderingService's `network-guide` layer now draws after the path (X-04, `src/services/RenderingService.js` (:1347)); in the player it returns at once, since `PlayerApp` sets `networkEditService` to null (`src/player/PlayerApp.js` (:99), (:381)), so exported frames are unchanged; `src/utils/uiReadouts.js`, which the player also bundles (through `src/app/pathTiming.js`), brings only functions no player module calls. By the owner's export rule (GATELESS-1), a release that changes `player.js` has its exports saved to disk and opened there, so v3.2.716's disk save is waived, for that release only: the owner, 2026-10-12, "Waive this one (Recommended)" (his pick when asked, ~10:02 BST), the moved layer drawing nothing in the player. The one disk save owed since REL-712 is made: its HTML half on 2026-10-11 at 15:34 BST (REL-715), and its MP4 half the same evening, when the owner saved the Open day example's MP4 export from the live site, v3.2.715, through his Chrome at 22:18 BST (route-animation-2026-10-11T21-18-33.mp4, its name's stamp UTC) and opened it from disk; his words, 2026-10-11 ~22:30 BST: "MP4: done — <filename>, opened from disk, plays. HTML (2) opened from disk too." (the "<filename>" as he wrote it), and, late that evening (~23:40 BST), "mp4 is route-animation-2026-10-11T21-18-33.mp4". So the HTML was opened from disk too, and the wish line for the MP4 half retires, settling v3.2.710's debt and any v3.2.712 owed (the owner, 2026-10-09: "One save covers both"; REL-712). The crowd review of 2026-10-08 found Custom network a mode, not a setting (X-02, WCAG 3.2.5), the Guide helper stale after a trace (X-03, DEF-89), a traced network invisible under the path (X-04), traced nodes named by their type (X-05), Guide and Motion collapsed on a new crowd (X-09), the card sliders narrower than the model and rewriting a stored value on the first nudge (F5, DEF-86), Share's slider 48 CSS px wide (X-06), the seed read-only (F16) and the outline's Release bias a signed number (F15). X-02: choosing Custom network refreshes the Guide card and leaves the header alone, Edit network being the request, and + Add crowd with no route no longer enters the mode, saying "Crowd 1 added — press Edit network to draw the network its dots will follow"; the empty network's helper reads "No network yet — press Edit network to draw one, or Trace route into network."; the banner half stays for PR 6. DEF-89: a trace refreshes the Guide card at once. X-04: a selected crowd's network is drawn between the path and its head, each path over an opaque `--ui-background` casing a reference px wider each side; preview, export and the player draw no guide. X-05: the Node card's header names the node ("Node · Main entrance · entry", "Node 3 · entry" with no name), and in Edit network each named node is labelled beside its glyph, 14 reference px, cased, but for a traced node under a waypoint whose label is set to show, so each place is named once. X-09: all four crowd cards start open, a stored layout still winning. F5 and DEF-86: a number field beside each crowd slider and the Path card's Share holds the stored value as it is, to the model's whole range, Count to the scene's 20,000-dot budget by its field and its slider; a slider writes only where it is moved, and one whose value lies past its ends sits off at its nearer end, described by "Beyond the slider's reach — use the number field."; a value the model cannot take is refused in the field's error line and announced; a value typed and not committed goes to the crowd or path it was typed for; Release bias keeps "Earlier 40%" and Release timing "20% uneven" beside their fields, read unrounded. X-06: Share's slider takes the card's width. F16: the seed is a whole-number field, a seed from 0 to 4294967295 one undo entry, said "Crowd 1 pattern seed set to 42. Undo is available.", anything else refused with "Seed is a whole number from 0 to 4294967295.". F15: the outline's Release bias is a direction and an amount, an untouched stored −0.375 surviving, Even turning the amount off at 0 with "Even favours neither end.". With them the brief's layout amendment: helper lines at 1.5 (WCAG 1.4.8), the Guide and At journey end selects whole on a line under their label. The owner's picks of 2026-10-08 (labels verbatim): "Custom network stops auto-entering draw mode (Recommended)", "Draw the crowd's network above the path (Recommended)", "All crowd cards start open (Recommended)", "Number field beside each crowd slider + full-width Traffic (Recommended)", "Editable Pattern seed (Recommended)" and "Node labels on the canvas and in the Node card title (Recommended)". His answer of 2026-10-10 (~23:55) to his audit, "Proceed as per your recommendations" (REL-713), stopped + Add crowd with no route entering Edit network, its announcement rewritten. His word of 2026-10-11, "proceed with your recommendations for PR 8 and 5b", settled the lead's recommendations Q5 to Q9: Q5, the wording (the announcement, the helper lines, the number-field errors) as proposed, the glossary applied; Q6, the two crowd selects on a second line under their label; Q7, the guide's 1 px lighter casing; Q8, node labels with the title, the "Node 3" fallback and 14 px type; Q9, Even turning the outline's amount off at 0 with its reason. His answer of 2026-10-11, late evening (~23:40 BST), "proceed with your reccomendations on 5b. mp4 is route-animation-2026-10-11T21-18-33.mp4", took the lead's recommendation on four questions from the PR's first round: Release timing keeps its words beside its field, as Release bias does; the round-1 agent's error sentences stay; the outline's Release bias labels and hints stay; and no node label is drawn where a named waypoint sits on the node. The lead's settlements, from the rules: the seed's announcement in the app's one form, "Undo is available.", as Re-roll's; full stops on "Beyond the slider's reach — use the number field." and "Seed is a whole number from 0 to 4294967295."; the outline's Even reason "Even favours neither end." in place of the lead's earlier "Shares are already even.", "share" being the Path card's word; a refused value committed again in the field is said again, each refused attempt told once, the dedupe stopping one refusal being said twice by two controls (Codex r3 read it the same way); and a Trace route into network within 400 ms of choosing Custom network sharing that choice's undo entry is DEF-92's existing defect, noted there, not fixed in the PR (Codex r1's reading). The round-2 agent's three calls, which the lead kept and Codex r2 found sound: Release timing's words read the stored amount unrounded ("12.5% uneven", "Even" only at 0); "sits on" is tested by the trace's link and the waypoint's label set to show (`hasLabel()`), not its list name or a radius; and a field holding the kept value after a refusal is not marked invalid. Round 2 (`f3a8ae7`) took Codex r1's six real findings: a slider writes only where it is moved, so a stored Speed of 0.12345 survives an unmoved `input`; Release bias's readout reads its stored amount; the fields show the shortest round trip, and a field committed as shown writes nothing; a value typed and not committed goes to its own path or crowd before a canvas selection or a rebuild replaces the field; Count's slider keeps to the dot budget; an announcement test installs its tip reader before boot. Round 3 (`c35eacf`) took Codex r2's two: a seed typed and not committed goes to its own crowd, found in the live scene by identity, and Count's field is no longer left marked invalid by the slider's refusal; with Codex r2's advisory, the network-edit draw-log golden ending before the path's head. Codex reviewed the PR in three rounds (r1 on `e1747ae`: 0 blocking, 6 real, 2 advisories on browser evidence, the real taken in `f3a8ae7`; r2 on `f3a8ae7`: 0 blocking, 2 real and 1 advisory, taken in `c35eacf`; r3 on `c35eacf`: approve, no blocking and no real in the round, with two real findings of round 3's audit, already on main before the PR, to be recorded apart; the Checked line of `9466a3f`), having checked the PR's brief on `1ec4ef9` (three blocking, folded) and again on `f211c7c` (no blocking, no real), and each round's brief before it ran (round 2's: four tightenings and an advisory, folded; round 3's: no blocking, no real, four advisories, folded); CI on `e1747ae` (run 38179981931) and on `c3198e4` (run 38185050645; the cancelled run beside it, 38185048254, is the duplicate push run) green, and on the head: CI test-and-build green on c35eacf (run 38187346735, 13m53s, completed 01:29 BST; the cancelled run beside it, 38187342962, is the duplicate push run). Tests: 60 added across the rounds (41, 12 and 7), none deleted, skipped or weakened; 64 mutants killed (34, 23 and 7); 733 control-golden lines in round 1 and 48 in round 2, and a network-edit draw-log golden added in round 2 and trimmed in round 3, 0 untraced. The lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr5b-*` (`c3198e4`, images only). The same record files DEF-97 at P3, since the owner chose to file it, 2026-10-12, "File DEF-97 (Recommended)" (his pick when asked, ~10:02 BST): on a crowd's busyness graph, a value typed in a handle's Busy field or an interior handle's Time field and not committed is lost when a waypoint is clicked on the canvas (Crowd scope closes with focus kept in the field, and the `change` that follows finds no crowd selected, `src/app/crowds.js` (:702)), when a handle is dragged on the graph (the rows rebuilt on every move, (:814)) and when a drag is cancelled (:828); it was on main before PR 5b, was found by its round-3 audit and Codex r3, and was confirmed in Chromium by the lead on live v3.2.715; the crowd rename field, which the audit's jsdom repro also lost, was found safe in Chromium (its blur commits the name as the Layers row is rebuilt, no row doubled), and its hardening, settled before the strip is replaced and safe against a rebuild inside a rebuild (Codex r3's follow-up), rides in the same row; no fix is decided. Not in the PR: X-02's banner half (PR 6); F7, X-10, X-12 and X-16 (UI-07) and X-13 (W4), as REL-713 split them; F13 (UI-07, since 2026-10-08); DEF-92 (its own brief); CROWD-07 stays open for them.

**Supersedes:** none

**Deferred:** none

## 2026-10-11 — REL-715 — v3.2.715 ships UI-06's follow-ups PR; DEF-96 closes

**Decision:** v3.2.715 is live from deploy commit `f211c7c` (tag `v3.2.715`), released under GATELESS-1 because UI-06's follow-ups merge (`24d3891`, PR #126, the run's PR 8) changed `index.html`, `styles/` and `src/`; UI-06's rows B-32 to B-36 close with it, B-15, B-16, B-18, B-31 and J-18 are made whole, and the low items, J-04, J-16, J-20, W-02 and CROWD-07's F12 and F18 are made; DEF-96 closes, since the Marker card's Size reads the diameter it draws. The owner's disk save is half made: the HTML is saved, the MP4 still owed.

**Rationale:** release.sh: rollback tag `rollback-v3.2.714-24d3891`, gate green (133 files, 3,188 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.715 (pane, 2026-10-11 ~21:22 BST, storage cleared, first-start welcome dismissed by the script): Open day route loads 6 waypoints; plays to 3,002 ms of 27,283 ms, then to its end in 1,457 frames with 0 queued; MP4 9,664,123 bytes, `ftypisom`, 1920×1080, 29.3 s; HTML 2,035,960 bytes with the project, its CSP and the live `player.js` embedded; no non-200 resource; two downloads captured (route-animation-2026-10-11T20-22-29.mp4, route-animation.html). The PR changed what the Export menu disables and how, not what an export writes: its items are `aria-disabled` behind a click guard, and a Cancel button sits beside the status line while a video exports (`src/app/exporting.js`, `src/components/Dropdown.js`), while `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `24d3891^..24d3891`. One of the files it changes is a module the player bundle imports, `src/utils/uiReadouts.js` (through `src/app/pathTiming.js`), but what it brings is a comment and `formatMarkerSize`, which no module of the player calls; `docs/player.js` is unchanged between the deploys `1ec4ef9` and `f211c7c`, and 715 does not end in 0, so no new disk save is owed. The one disk save owed since REL-712 is half made: on 2026-10-11 at 15:34 BST the owner saved the Open day example's HTML export from the live site through his Chrome ("route-animation (2).html", 2,032,129 bytes, SHA-256 beginning `b2101fb724c44508`) and attached it to the lead chat with the words "export attached"; the file carries the project, its CSP and the live `player.js` embedded verbatim (433,669 bytes, the same file from v3.2.712 to v3.2.714, so it came from a build of v3.2.712 or later), so it is the HTML half of the one save that settles v3.2.710's debt and any v3.2.712 owes (the owner, 2026-10-09: "One save covers both"; REL-712). The MP4 half is still owed: the lead asked the owner for it on 2026-10-11 (~15:40), and the wish line now asks for it alone. The owner's audit of 2026-10-10 of UI-06's four shipped PRs on live v3.2.712 (REL-713) found five breaches the review had missed and five rows closed only partly. B-32: a swatch picker's options were 16 px wide, its grid fallen into the 6rem label track; the grid is now the picker's full width under its legend, 47.2 px per option or more. B-33, B-34 and B-35: focus fell to the page when the Layers strip rebuilt, when Edit network disabled its own button and when a toast went with focus on its Dismiss; the strip now gives focus to the rebuilt row, eye or delete (a gone crowd's to the Route row), Edit network to the banner's Done, and a leaving toast to the control focused before, else the next toast, an earlier one, then the container. B-36: the layer swatch and the current-colour chip have `--border-interactive` borders, 3:1 or more in every state, a hidden crowd's swatch dimming its fill only. B-18: the Export items are `aria-disabled`, reached by the menu's keys with their reasons, a click on one refused with the menu left open. B-16: a failed download says what to do next, and an error toast stays until it is dismissed. J-18: a Cancel button follows the status line while a video exports. B-15: the outline's running text says "Select major waypoint 1". B-31: an empty crowd's line says "This crowd has no dots. To start again, delete it in Layers and choose + Add crowd." The audit's three low items, which UI-06's Notes record under the rows they extend (the PR 8 brief's proposal): one word per concept, area and corner where the outline, its messages and the drawing banner said polygon and vertices (B-24); Undo's and Redo's shortcuts in hints, not `title` (B-07); an expanded, focused card header's ring painted over its accent (B-02). The owner's §C.7 rows: J-04, Choose image described by the background drop tip; J-16, the switch named "Preview mode"; J-20, no redundant landmark `role`, and `aria-haspopup="menu"` written once, in the markup; W-02, the outline's position fields at the heading's two decimals, a field never edited writing the exact stored value and one typed in writing what it holds. CROWD-07's F12 (a Layers button's `title` is its `aria-label`) and F18 (the Pattern seed's label and hint; Reset to even's hint and its reason while it is off). DEF-96: the Marker card's Size reads twice the stored value, "16 reference px" at the default, a nominal diameter (a flag draws 3 × tall and 1.5 × wide), what is stored and drawn unchanged. The lead's addendum: "centre" where "center" survived. The owner's word on the PR's four calls, 2026-10-11: "proceed with your recommendations for PR 8 and 5b", the lead's recommendations being Q1, the colour grid full width under its label; Q2, a deleted crowd's focus to the Route row, Edit network's to the banner's Done and a dismissed toast's to the control focused before; Q3, a Cancel button beside the export status line now, which PR 6 may move into its slot; Q4, the words bundle, the triangle sentence included, the lead applying the glossary. The lead's settlements, from the rules: errors stay by `priority: 'assertive'`, with no second classification (one announcement route); J-04's guidance is a described line, not a `data-tip`; a Layers button's `title` is its `aria-label`; a toast's fallbacks end on the container. The implementing agent's calls, accepted by the lead as the glossary's consequences, not the owner's: "corner" in the singular too, since "Vertex N" under "Drawn area — 4 corners" would be the synonym pair the glossary forbids; `#bg-drop-hint` stays `sr-only`, the brief's change line governing its test line; + Add crowd keeps focus on entering Edit network, as the Guide select does. Round 2 (`e0a3c2b`), from Codex r1, gives W-02 an edit mark, so a field typed in writes what it holds even when that is the value shown ("18.91" retyped stores 0.1891), and lets a bend off the image apply as its field shows it; the mark reaches every field with a stored exact value (a wait, a fade, a path's weight, a crowd's name, a node's label), which the lead kept as built and told the owner, a name stored with stray spaces and typed back being saved trimmed, and Codex r2 found that reach appropriate. Codex reviewed the PR in two rounds (r1 on `4cd7da6`: 1 blocking, the off-image bend; 2 real, the retyped value and a concurrency helper that read a natively disabled Export item as free; 3 advisories, the chord's key names, the "center" census and DEF-96's comment; all taken in `e0a3c2b`, with Codex's check of the round-2 brief folded; r2 on `e0a3c2b`: approve, all six r1 findings closed, nothing new (reviews/ui06-follow-ups-r2-summary.md); the Checked line of `24d3891`); CI on the head `e0a3c2b`: CI test-and-build green on e0a3c2b (run 38158345497, completed 18:25 BST; the cancelled run beside it, 38158334798, is the duplicate push run). Tests: 48 added, none deleted, skipped or weakened; 63 mutants killed; 1,397 golden lines, 0 untraced. The lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr8-*` (`af6743f`, images only). Not in the PR, as REL-713 split them: §C.7's J-06, J-07, J-09, J-10, J-11, J-14, J-15, J-22 and W-06 (UI-06) and F7, X-10, X-12, X-13 and X-16 (CROWD-07) stay open for UI-07 and W4, and UI-06 and CROWD-07 stay open for PRs 5b and 6. What PR 8's checks saw outside its rows is captured as three wish lines (from: UI-06, 2026-10-11): the exported player's "polygon vertices", the outline's "Bend point" messages and a dead `waypoint:add-at-center` handler.

**Supersedes:** none

**Deferred:** none

## 2026-10-11 — REL-714 — v3.2.714 ships CROWD-07's crowd cards PR 5a

**Decision:** v3.2.714 is live from deploy commit `1ec4ef9` (tag `v3.2.714`), released under GATELESS-1 because CROWD-07's first crowd cards merge (`15b4b8a`, PR #123, the run's PR 5a) changed `index.html` and `src/`; CROWD-07's rows F1, F6 and F14 are made with it, since a crowd's dot Size now reads the diameter drawn in reference px, "At journey end" says how its four options differ, on the card and in the outline alike, and on a custom network the Guide card says where journeys start and end; F8 and F17, found already made, are pinned by tests. F20 waits for DEF-93, which stays open, and no DEF row closes. The PR follows the owner's answers of 2026-10-09 and 2026-10-10, recorded below with the lead's glossary calls.

**Rationale:** release.sh: rollback tag `rollback-v3.2.713-15b4b8a`, gate green (133 files, 3,140 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.714 (pane, 2026-10-11 ~03:08 BST, storage cleared, first-start welcome dismissed by the script): Open day route loads 6 waypoints; plays to 3,002 ms of 27,283 ms, then to its end in 1,457 frames with 0 queued; MP4 9,664,123 bytes, `ftypisom`, 1920×1080, 29.3 s; HTML 2,035,960 bytes with the project, its CSP and the live `player.js` embedded; no non-200 resource; two downloads captured (route-animation-2026-10-11T02-06-38.mp4, route-animation.html). The PR changed no export code (`src/app/exporting.js`, `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `15b4b8a^..15b4b8a`). Two of the files it changes are modules the player bundle imports, `src/services/DotRenderer.js` (through `src/services/RenderingService.js`) and `src/utils/uiReadouts.js` (through `src/app/pathTiming.js`), but what they bring to the player is a comment, an `export` on `DOT_BASE_RADIUS_PX`, whose value (10) the bundle already writes in place, and `formatCrowdDotSize`, which no module of the player calls; `docs/player.js` is unchanged between the deploys `a2939af` and `1ec4ef9`, and 714 does not end in 0, so no new disk save is owed; the one disk save of the live build, v3.2.712 or later, through the owner's Chrome, stays owed and settles v3.2.710's debt too (the owner, 2026-10-09: "One save covers both"; REL-712), and v3.2.714 is such a build. The crowd review of 2026-10-08 found that a crowd's dot Size read "0.40×" where the other map-bound sizes read reference px (F1), that "At journey end" did not say how Respawn at the start differs from Repeat journey (F6), and that on a pen network the Guide card did not say where journeys start and end, which a node's Type decides (F14). Size now reads the diameter drawn, 20 reference px per 1× (1, 8 and 40 reference px at the slider's 0.05×, default 0.40× and 2.00×), in its readout and `aria-valuetext` alike, written by the shell, the slider and a crowd's selection, its hint naming the export scaling; `dotSize` is stored as before, and the scene outline still edits Dot size in ×, its hint giving the reference px the value draws. "At journey end" carries one sentence on the Motion card and in the outline, word for word, a test holding the two equal: "Disappear removes a dot at its journey's end; Collect at the end parks it there; Respawn at the start sends a new dot from the start with its own pace and walking variation; Repeat journey follows the same paths again at the same pace". On a Custom network, empty or drawn, the Guide hint says that journeys start at entry nodes and end at exit nodes, and what happens with neither, never on Follow route; with no route, the card asks for two route waypoints once, in the Trace reason (UI-06's B-07, unchanged). F8 (the outline's "At journey end" options are the card's, value for value; the Guide counts paths, never edges) and F17 (Edit network, Trace route into network, Add handle, Swap direction, + Add crowd and each crowd row's rename hint show their help by keyboard) were already made, by UI-06's words PR (#115) and, for the rename hint, its targets PR (#118), and are now pinned by tests; F20, the endless-network hint, is DEF-93's, its text pinned unchanged. The owner's answers (AskUserQuestion, labels verbatim): on 2026-10-09, for the outline's "At journey end" hint, "Same sentence in both (Recommended)" (option text: "One description for one control wherever it appears (the consistency rule). A small extra commit on PR 5a."), and on the two smaller calls "go with your reccomendations", the lead's recommendations being that Size keeps the previous crowd's value on a crowd with no emitter, as every set control does under UI-06's B-31, and that the outline's hint writes "0.4" as its field shows it; on 2026-10-10 (~22:45), for the Repeat journey clause Codex r1 found too strong (the first wording, "Repeat journey replays the same walk exactly", is false on a network with Walking variation, whose sway runs on from one journey to the next), "Keep the new wording (Recommended)", and for that drift "File a DEF row (Recommended)", DEF-95, filed in REL-713; and on 2026-10-10 (~23:55), to his audit of Phase 3 (REL-713), "Proceed as per your recommendations", which on PR 5a corrected the pull request's claim that Size reads as the Marker card's does (the Marker's "8 reference px" is a radius: DEF-96, filed in REL-713; the Marker card is unchanged here), asked for the two route waypoints once on the Guide card, not in both its Trace reason and its hint, and brought the new sentences into the panel's words. The glossary calls in round 3 are the lead's, not the owner's, the first two being the audit's glossary consequences, which REL-713 records as going with the audit's seven decisions unless the owner says otherwise: "sway" becomes "walking variation", the control's name; "Entry" and "Exit" take the lower case the Node Type hint writes in running text; and "master timing", an engine term the panel never shows, leaves the Guide hint, whose no-route sentence is now "It takes at least two route waypoints before previewing or exporting." Codex reviewed the PR in two rounds (r1 on `b23f14a`, the rows and round 1: 0 blocking, 1 real, the Repeat journey clause, fixed in `81d4af6`; no separate r2, the lead folding round 2 into r3; r3 on `7951c88`, covering round 2, the rebase onto `2c9f5f8` and round 3: approve, no findings; the Checked line of `15b4b8a`); CI on the head `0c5ae3c`: CI test-and-build green on 0c5ae3c (run 38100415864, 17m48s; the cancelled run beside it is the duplicate push run). The lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr5a-*`, the three that round 3 changed taken again in `0c5ae3c`, images only. DEF-95 and DEF-96, which PR 5a's checks surfaced, stay open as REL-713 filed them, and DEF-93 stays open for F20.

**Supersedes:** none

**Deferred:** none

## 2026-10-11 — REL-713 — v3.2.713 ships UI-06's Help PR; DEF-82 closes; DEF-95 and DEF-96 filed

**Decision:** v3.2.713 is live from deploy commit `a2939af` (tag `v3.2.713`), released under GATELESS-1 because UI-06's Help merge (`2c9f5f8`, PR #122) changed `index.html`, `styles/` and `src/`; UI-06's row J-01 closes with it (the v3.1.473 audit's N6-4 and N10-1), since Help is now a dialog of its own with every shortcut open and the welcome shows on the first start only, and so does DEF-82 (a dialog's focused heading passed the page's shortcuts through), since they now stand down while focus is anywhere inside an open modal dialog. The PR follows the owner's pick of 2026-10-08, his answers of 2026-10-09 and his word of 2026-10-10 on the audit of Phase 3 he asked for, recorded below with the lead's settlements.

**Rationale:** release.sh: rollback tag `rollback-v3.2.712-2c9f5f8`, gate green (133 files, 3,127 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.713 (pane, 2026-10-11 ~01:42 BST, storage cleared, first-start welcome dismissed by the script): Open day route loads 6 waypoints; plays to 3,002 ms of 27,324 ms, then to its end in 1,460 frames with 0 queued; MP4 9,653,696 bytes, `ftypisom`, 1920×1080, 29.33 s; HTML 2,035,955 bytes with the project, its CSP and the live `player.js` embedded; no non-200 resource; two downloads captured (route-animation-2026-10-11T00-41-02.mp4, route-animation.html). The PR changed no export or player code (`src/app/exporting.js`, `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `2c9f5f8^..2c9f5f8`; none of the `src/` files it changes is a module the player bundle imports, and `docs/player.js` is unchanged between the deploys `00b89f4` and `a2939af`) and 713 does not end in 0, so no new disk save is owed; the one disk save of the live build, v3.2.712 or later, through the owner's Chrome, stays owed and settles v3.2.710's debt too (the owner, 2026-10-09: "One save covers both"; REL-712), and v3.2.713 is such a build. The owner's pick of 2026-10-08 (label verbatim): "A Help dialog of its own (Recommended)" (option (a)'s text: "A 'Help' dialog of its own: shortcuts grid open, no 'Get started', splash first-run only (recommended)"). His answers of 2026-10-09 (AskUserQuestion, labels verbatim): the crowd how-tos "These five lines (Recommended)", now Help's Crowds and networks, verbatim, each bold label the live control's text; Report a bug "Close Help, then open it (Recommended)"; the words the implementing agent wrote (Mouse and pen lines 6 and 7, About) "Keep as written (Recommended)"; `?` on the first start's welcome "Help on top of the welcome" (option text: "As built. Closing Help goes back to the welcome. The focus-trap stack from PR 4 already handles this."), which also makes the one focus exception: from Help opened over a welcome already open, the bug report's Cancel gives focus back to the welcome's title, because the Help button is inert behind it; and, on "Open Help" or "Open help", "go with your reccomendations", the lead's recommendation being "Open help", so `?` reads "Open help" and "Help" is no longer an allowed word in the sentence-case test. The lead's settlements, as built in rounds 1 to 3: the crowd lines pinned verbatim, not run through the prose rule, since they quote option names in parentheses; Help wired from the app mixin, as Report a bug beside it is; the layout (48rem, scrolling inside itself, the grid in two columns where they fit), for the lead's pane check; and the shortcuts that still ran behind a dialog's focused title (the PR's report, its sixth question) left out of the PR. The last two were reopened by the fresh-eyes audit of Phase 3 the owner asked for on 2026-10-10, run by the lead: the four shipped UI-06 PRs against live v3.2.712, PRs #122 and #123 at their heads, the remaining briefs and UI-07's readiness, by three read-only agents, the lead verifying the top claims in the pane; the audit and its reports are outside the repository (`scratch-backup/deliverables/AUDIT-2026-10-10.md` in the run's session folder) and this record does not commit them. It put seven decisions to the owner, who answered "Proceed as per your recommendations" (2026-10-10 ~23:55), so each takes the audit's recommended option: (1) PR 7 gets a round 4 before it merges; (2) DEF-82, open since 2026-10-08 (found by DEF-13's implementing agent), is folded into that round; (3) the Marker card's Size readout becomes the diameter, filed as DEF-96 below; (4) "+ Add crowd" with no route stops entering Edit network (PR 5b's item 5, X-02), its announcement rewritten; (5) PR 6's slot takes one line when a mode shows and the canvas shrinks; (6) the judgement rows no question or brief held split as proposed: UI-06's J-04, J-16, J-20 and W-02 and CROWD-07's F12 and F18 into PR 8 (UI-06's follow-ups), J-06, J-07, J-09, J-10, J-22, F7, X-10, X-12 and X-16 parked to UI-07, and J-11, J-14, J-15, W-06 and X-13 noted for W4 and DEL-05; (7) DEF-95 at P3. The glossary consequences go with them unless the owner says otherwise: "sway" becomes "walking variation", "Entry/Exit" takes the Node hints' case, and the grid's shortcut names take one form each. Round 4 (`d6a3a31`) made the first two and the audit's other points on PR 7: the page's shortcuts stand down while focus is anywhere inside an open modal dialog, in both `InteractionHandler` and the network editor's key listener (the second found by Codex's check of the round's brief), with `?` kept, so Help still opens over the welcome; Help's header and footer stay in view while its body scrolls, the body reachable by the keyboard while it overflows; the shortcuts are a definition list per group, falling to one column down to 320 CSS px; the welcome is bounded the same way, so no line is clipped mid-line at 1440×900; the grid's words take one form each ("Home" and "End", "centre", one "Play/pause", Shift from the platform table on Windows, "Open help" in place of "View all controls"); and About's GitHub link is a 44 px target. Codex reviewed the PR in four rounds (r1 one real, Show the welcome again from Help opened over the first start's welcome leaving focus on the page, and two advisories, fixed in `728250f`; r2 one advisory, the exception's wording, fixed in `0f02e80`, comment only; r3 approve; r4 on `d6a3a31` approve, no findings; the Checked line of `2c9f5f8`); the lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr7-*`, the four that round 4 changed taken again in `cb3b542`, images only. The same record files DEF-95 at P3 on the owner's answer of 2026-10-10, "File a DEF row (Recommended)" (option text: "Record it as a defect, to be decided and fixed later in the DEF queue. Nothing changes in the app now."): a crowd on Repeat journey repeats its walk exactly on a route, but on a network with Walking variation its sway differs on every lap, because `_walkLoop` wraps the path position but passes the unwrapped distance to the sway (`src/services/SwarmEngine.js` (:852, :859)); Codex found it in round 1 of CROWD-07's PR 5a (#123), whose "At journey end" hint now reads "Repeat journey follows the same paths again at the same pace" (the owner, 2026-10-10: "Keep the new wording (Recommended)"), true either way; no fix is decided, and the row is not a design decision. It also files DEF-96 at P3: the Marker card's Size readout says "8 reference px" at the default while the drawing uses that value as the radius (`src/services/RenderingService.js` (:2439, :2470)) and the hint says "diameter" (`index.html` (:186)); the audit found it checking PR 5a's readout for CROWD-07's F1, whose "8 reference px" is a true diameter, so a default crowd dot reads the same as a default marker but is half its width; by decision 3 the readout becomes the diameter ("16 reference px" at the default), the stored value, the drawing and the hint unchanged, in PR 8. And it adds the audit's five new breaches in the shipped PRs to UI-06's findings as B-32 to B-36, with the five rows it found closed only partly (B-15, B-16, B-18, B-31, J-18), all for PR 8 (UI-06's Notes).

**Supersedes:** none

**Deferred:** none

## 2026-10-09 — REL-712 — v3.2.712 ships UI-06's status PR; DEF-91 closes

**Decision:** v3.2.712 is live from deploy commit `00b89f4` (tag `v3.2.712`), released under GATELESS-1 because UI-06's status merge (`48d3864`, PR #120) changed `index.html`, `styles/` and `src/`; DEF-91 (a failed example background said nothing) closes with it, since both background loaders now toast and announce the reason and mark the canvas area busy while they decode. The PR follows the owner's answers of 2026-10-09, recorded below with the lead's settlements and scope amendment.

**Rationale:** release.sh: rollback tag `rollback-v3.2.711-48d3864`, gate green (132 files, 3,091 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke at 1280×800: title v3.2.712, Open day played 3,002 ms, then to its end at 27,028 ms with no frame queued; MP4 1920×1080 29.0 s `ftypisom` (9.82 MB); HTML (2.04 MB) with its CSP, the project and the live `player.js`; no failed requests. The smoke script now closes the first start's welcome before it opens the example: with the welcome open the example menu behind it does nothing, as PR 4's dialogs take turns. The PR changed the export paths' availability, refusals and progress messages (`src/app/exporting.js`); `src/services/HTMLExportService.js` and `src/player/` are unchanged in `48d3864^..48d3864`, but `docs/player.js` changed between the deploys `ced318b` and `00b89f4` in three fragments of the shared modules it bundles: the new `VIDEO_EXPORT.SPOKEN_PROGRESS` constant (`src/config/constants.js`), an aborted file read settling as a failure (`src/models/ImageAsset.js`) and a lost crowd anchor's message no longer announced beside its toast (`src/app/pathTiming.js`). On the disk save the owner answered on 2026-10-09 "One save covers both" (option text: "A single disk save of the live build (712 or later) through your Chrome settles both 710's and 712's debt; the record says so."): the owner ruled that one disk save of the live build, v3.2.712 or later, through his Chrome settles both v3.2.710's debt and any v3.2.712 owes, so v3.2.710's wish line now reads as that one save and no v3.2.712 line is added. The owner's answers on the PR (AskUserQuestion, labels verbatim): status placement "Keep it beside the title (Recommended)", which also confirms the lead's placement; spoken status "Speak changes, not repeats (Recommended)" (option text: "Through the one announcer, politely: 'Unsaved changes' the first time an opened or saved project changes, 'Saved to browser recovery' the first time recovery saves after that, then quiet until the next open or save. Export progress spoken at 25%, 50% and 75%."); tips "Speak them again (Recommended)" ("Tips are read politely, as before PR 4, queued after the start-up recovery messages so they never cut in."); delete toast "Keep the toast on every delete (Recommended)" ("Delete key, the row's ×, the outline, the context menu and Shift-click all show 'Waypoint deleted' with Undo, heard once. Deleting several at once keeps its spoken message."); and, when Codex r2 read that option text literally, the toast's words "Keep today's wording (Recommended)": all five waypoint delete routes show "Deleted <name> — press Cmd+Z to undo", heard once, matching the crowd, node and path toasts, with no new button (the earlier option text's "Waypoint deleted" with Undo was a loose description). The lead's settlements, from the rules: after a confirmed Discard, focus moves to the next control past the notice by DEF-28's tested rule (Codex r1's sixth point); the harness lets go of an earlier app's dialog traps rather than retiring the app, because a full retire broke six draw-log tests; the scope chip, the empty waypoint list's row, the area and network banners and `network.js`'s double channel stay outside PR 4's rows, for PR 6, which owns the banners and one announcement route; "File reading was stopped: <name>" is the aborted read's wording (unreachable today). The lead's scope amendment (round 2), not the owner's answer: the diagnostics dialog joins the one announcer because it spoke on two channels, and stays in PR 4; its comments credit the amendment, and PR 6's brief check notes diagnostics as done. Round 1c: CI failed one test on `882123d` because the start's tip, armed on the real clock before `bootIdleApp` moved to the fake one, fell due mid-test on a slow runner; the harness marks the tip seen before such boots (`9e1a46d`, no change in `src/` behaviour). Codex reviewed the PR in four rounds (r1 one blocking and five real, r2 five real, r3 two real, r4 approve, with one advisory moved to the wish-list; the Checked line of `48d3864`); the lead's pane check found the empty crowd's disabled controls looking enabled, fixed in round 2. The wish line on two focus traps handing focus back and forth retires on the lead's Chromium check of the 2eeb13d build, and Codex r4's advisory (disabled candidates in the focus trap's first focus and Tab cycle) becomes a new wish line.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — REL-711 — v3.2.711 ships UI-06's targets PR; DEF-83 closes; UI-07 filed

**Decision:** v3.2.711 is live from deploy commit `ced318b` (tag `v3.2.711`), released under GATELESS-1 because UI-06's targets merge (`c0e9213`, PR #118) changed `index.html`, `styles/` and `src/`; DEF-83 (a collapsed header's focus ring) closes with it, since every header's ring is now drawn inside the header. The same record files UI-07, the layout-and-ordering review of the cards, sidebars and header the owner asked for on 2026-10-08 ("file a new backlog item for a layout-and-ordering review of the cards, sidebars and header … It runs after PRs 5–7 land and proposes options with before/after screenshots as one question round for me. It is Fable work, so the next chat asks me before launching it."), taking CROWD-07's F13 (the Variation card) and its layer-order note with it.

**Rationale:** release.sh: rollback tag `rollback-v3.2.710-c0e9213`, gate green (130 files, 3,027 tests), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke at 1280×800 with the pane's visibility overridden: title v3.2.711, Open day played 3,002 ms, then to its end at 27,028 ms with no frame queued; MP4 1920×1080 29.0 s `ftypisom` (9.82 MB); HTML (2.04 MB) with its CSP, the project and the live `player.js`; no failed resource or console error beyond the known stale `version.json` probe. The PR changed no export or player code (`src/services/HTMLExportService.js`, `src/player/` and `docs/player.js` are unchanged in `c0e9213^..c0e9213`, and `docs/player.js` is unchanged between the deploys `72fcaf9` and `ced318b`) and 711 does not end in 0, so no new disk save is owed; v3.2.710's stays owed. Codex reviewed the PR in three rounds (r1 one blocking and three real, r2 two real and one advisory, r3 approve; the Checked line of `c0e9213`); the lead's own pane check at 1,200 px found the readout row's first wrap rule incomplete, fixed in the same PR.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — REL-710 — v3.2.710 ships UI-06's words PR

**Decision:** v3.2.710 is live from deploy commit `72fcaf9` (tag `v3.2.710`), released under GATELESS-1 because UI-06's words merge (`9adb695`, PR #115) changed `src/`, `index.html` and `styles/`; the build ends in 0, so the owner's export-save rule makes a disk save owed (a wish line tracks it).

**Rationale:** release.sh: rollback tag `rollback-v3.2.709-9adb695`, gate green (129 files, 3,003 tests), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke at 1280×800 with the pane's visibility overridden: title v3.2.710, Open day played 3,002 ms, then to its end at 27,283 ms with no frame queued; MP4 1920×1080 29.3 s `ftypisom` (9.66 MB); HTML (2.04 MB) with its CSP, the project and the live `player.js`; no failed resource or console error. The PR changed the exported player's words (`src/services/HTMLExportService.js`, `src/player/playerAccessibility.js`: the player's Skip to start button and announcement), so `docs/player.js` changed, and the build ends in 0: both halves of the owner's export-save rule apply, and the disk save is owed on both counts. Codex reviewed the PR in three rounds (r1: one blocking, the test harness released every disconnected canvas, and four real; r2: one blocking, ownership inferred from timing, and two real; r3: approve), all fixed before the merge, and the PR was rebased onto v3.2.709 with its control golden regenerated (one line) and its path-weight error text moved to the new error-text token. The words PR made two wish lines, retired here with their text: "The help screen still says Alt+Click force-adds a major waypoint (`src/config/helpContent.js`), but Alt+click on a major waypoint now forks a branch, and it says nothing of crowds, networks or branching (a candidate, unverified) — (from: DEF-77, 2026-10-05)" and "The Zoom transition option "Quick — on arrival" zooms in the incoming leg's first 500 ms, not on arrival: its label misdescribes it, as its hint did (Codex, UI-03 review r2) — (from: UI-03, 2026-10-05)".

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — REL-709 — v3.2.709 ships UI-06's colour and tokens PR; DEF-94 closes

**Decision:** v3.2.709 is live from deploy commit `6b7f861` (tag `v3.2.709`), released under GATELESS-1 because UI-06's colour and tokens merge (`1bc07cd`, PR #114) changed `styles/` and one line of `src/`; DEF-94 (the outline's error marks) closes with it, since the tokens the stylesheets used are now defined.

**Rationale:** release.sh: rollback tag `rollback-v3.2.708-1bc07cd`, gate green (127 files, 2,976 tests), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke at 1280×800 with the pane's visibility overridden: title v3.2.709, Open day played 3,002 ms, then to its end at 27,283 ms with no frame queued; MP4 1920×1080 29.3 s `ftypisom` (9.66 MB); HTML (2.04 MB) with its CSP, the project and the live `player.js`; no failed resource or console error. The PR changes no export code and 709 does not end in 0, so no disk save is owed. Codex reviewed the PR in three rounds (one blocking: the primary Play button lost its fill under the icon hover rule; eight real, in the stylesheets and the new test helper), all fixed before the merge. The pane's after-shots are in `reviews/design-review-2026-10-08-shots/after/`.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — PLAN-3 — Phase 3 reviews the GUI and the crowd features; the review half ran read-only ahead of Phase 2's last defects

**Decision:** UI-06 (the app GUI against UI-STANDARDS.md) and CROWD-07 (the crowd features for novices and experts) are Phase 3, after Phase 2 and ahead of W4 and the found defects; breaches of the standards are fixed without asking, judgement calls go to the owner as one question round with screenshots; the review half of both ran on 2026-10-08 against live v3.2.707 (= main a312b55) without touching the repo, because Phase 2's DEF-20, DEF-13 and DEF-32 were in flight in another chat.

**Items:** UI-06, CROWD-07, DEF-83, DEF-84, DEF-85, DEF-86, DEF-87, DEF-88, DEF-89, DEF-90, DEF-91, DEF-92, DEF-93, DEF-94

**Rationale:** the owner, 2026-10-06: "please add a task to review and tweak the app gui as per the design requirements, and another to review the layout, interface, and functionality of the crowd features to ensure is useful, usable for novices, depth available for experts, and meets the design criteria. please advance this work to take place relatively soon at a suitable point"; his picks "After Phase 2 (Recommended)" (option text: "New Phase 3, ahead of W4 and the found defects. The reviews see every Phase 2 UI fix, and the tweaks don't clash with them. About 8 items away.") and "Fix breaches, ask on taste (Recommended)" (option text: "The run fixes clear breaches of the UI standards directly (contrast, target size, labels, sentence case). Layout and feature changes come to you as one question round, with screenshots."); and on 2026-10-08: "run UI-06 and CROWD-07, but without modifying the code base, since there is another chat that is modifying files. please do necessary groundwork, analysis, etc, and pause at the point of code editing so I can halt the other work and give you unfettered control". Reading the option texts as the placement (ahead of W4 and the found defects) and the method (one question round with screenshots), "the design requirements" as UI-STANDARDS.md plus the brief's constraints, "breaches" as a hard rule broken and everything else as a judgement, and the five novice tasks as the walk are the filing session's calls, for him to confirm; a wish line tracks that confirmation. The reviews found 28 breaches and 28 judgements app-wide, 10 breaches and 26 judgements on the crowd features, 15 behaviour-defect candidates, and triaged 20 wish-list lines (each item file's Notes). Codex (gpt-6-astra, read-only) reviewed the findings: 27 breaches confirmed, two refuted, two moved to judgement, three judgements moved to breach, four breaches added; its answer is `reviews/design-review-second-opinion-2026-10-08.md`. Wish-list lines 55 (scheduleDots counting Disappear/Collect dots and unreachable Exits as finishing) and 69 (the journey-end hint refreshing only when the timeline length changes) are retired: CROWD-05's `ends` flag excludes unreachable ends while `finishes` has no live application consumer (its two readers, `waitForCrowdMs` and `lastArrivalMs` in `crowdArrival.js`, are unused utilities), and the hint no longer depends on the timeline (crowd review §9). The tweak PRs follow the owner's question round and DEF-20/13/32; DEF candidates become rows only on his acceptance.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — REL-708 — v3.2.708 ships DEF-20, DEF-13 and DEF-32

**Decision:** v3.2.708 is live from deploy commit `acbf290` (tag `v3.2.708`), released under GATELESS-1 because DEF-20's, DEF-13's and DEF-32's merges (`72164a1`, `7355522`, `93b647b`; PRs #109, #111, #110) changed `src/`; one release for the three, the run's reading of the owner's "deploy", for him to confirm.

**Rationale:** release.sh: rollback tag `rollback-v3.2.707-93b647b`, gate green, dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke at 1280×800: title v3.2.708, Open day played 3,002 ms, then to its end at 27,283 ms with no frame queued; MP4 1920×1080 29.3 s `ftypisom`; HTML with its CSP, the project and the live `player.js`; no failed resource or console error. None of the three changes export and the build does not end in 0, so no disk save is owed. This in-page export check pays v3.2.707's owed one, which the hidden pane had suspended: the same export code, and 707 is no longer live; the run's call, for the owner to confirm.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — GATELESS-1 — The owner closes chat 13 after DEF-20, DEF-13 and DEF-32 ship; Phase 3 runs in another chat

**Decision:** On the owner's word, chat 13 landed DEF-20, DEF-13 and DEF-32, deployed them, ran past the profile's 200k line and closed out; one release for the three is the run's reading, for him to confirm; these are one-offs for this chat, and the grant's standing conditions are unchanged; Phase 3 (UI-06, CROWD-07) runs in another chat, which writes once this run has paused; this run resumes Phase 2 at DEF-15 when he opens a fresh chat.

**Rationale:** the owner, 8 October ~11:45: "phase 3 is starting in another chat. it wont edit files until you have paused, so keep going through other items until asked"; ~13:00: "halt when reach end of current ticket"; ~13:10: "conclude DEF-13, DEF-20, and DEF-32, the commit, push, deploy, and close out this chat"; ~13:15: "dont worry about going beyond 200k context". The run's calls, for him to confirm: the later instruction replaced "halt when reach end of current ticket"; "deploy" as one release for the three merges in place of one each; and Phase 3's record, UI-06 and CROWD-07 included, belongs to that other chat, so this run files neither.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — DEF-32 — Activating a list row keeps focus on that row

**Decision:** DEF-32 lands: a row's selection rebuilds the waypoint list once, by the app's `waypoint:selected` handler, whose restore puts focus back on the selected row; the row rebuilds the list itself only when nothing else has. It merges after DEF-13.

**Rationale:** the row's own second rebuild replaced the row the app's restore was about to focus, after focus had already fallen to the page, so every activation left focus on `<body>` (WCAG 2.4.3; REV-02 added the restore's "focus was in the list" guard). 4 tests fail on main; 3 of 3 mutants are killed. Codex r1: with the second rebuild gone, the restore frame also overrode a move to another row before it ran; it now restores only focus that was dropped (to the page or a removed node), 3 tests, 5 mutants killed. 25 control-golden rows gain a settled focus line on the row, all single selections. With focus kept on a row, main's key guard ignores Delete, the arrows and Cmd+Z/S there (TST-13's table), where today focus on the page lets them work: so DEF-13 lands first, the run's call. Multi-selection clicks still leave focus on the page, as the restore has always excluded them: the narrowest reading, the run's call. Digest rules: wcag-2.2-aaa (2.4.3 focus order); nielsen 1.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — DEF-13 — A focused control keeps only its own keys; every other shortcut runs

**Decision:** DEF-13 lands: `handleKeyDown`'s guard keeps every key in a field (input, textarea, select, contenteditable) and for a control inside a modal dialog, as before; any other focused control (button, link, summary, `role=button`) keeps only Space, a menu item or option also the four arrows; every other shortcut runs and is prevented. DEF-32 merges after it.

**Rationale:** the guard returned early for every key on any button, link, summary or menu item, and Chromium keeps focus on a clicked button, so Delete, the arrows, Undo and Save did nothing after a click and Cmd+S opened the browser's Save dialog (round 2, C2). 8 tests fail on main; every mutant is killed. TST-13's key table moves on purpose: those keys now run from a control, and its listener sweeps set the page's handler aside. The run's calls: an open dropdown menu keeps only Space and its arrows (the register's "in-widget arrows"), so Delete and Cmd+S act there, while a waypoint context menu keeps every key through its own capture listener, as before; a modal dialog's controls keep every key, as today. Codex r1 found two newly reachable actions, fixed in r2: Escape on a focused hint "?" also deselected (the hint now cancels the Escape it consumes, and the dispatcher skips cancelled keys, so Escape on the page with a hint open keeps the selection too); Delete on an unselected row deleted the selected waypoint (a row whose waypoint is not selected, and its × and move buttons, cancel Delete, Backspace, the arrows, T and Cmd/Ctrl+D when something is selected; the run's call, T and Cmd/Ctrl+D included because they too act on a waypoint the row does not name). Found on main: a dialog's heading passes shortcuts to the editor behind (DEF-82). Digest rules: wcag-2.2-aaa (2.1.1 keyboard; 2.1.2 no trap); nielsen 3 (user control).

**Supersedes:** none

**Deferred:** DEF-82

## 2026-10-08 — DEF-20 — After Open, rollback and Clear All, the controls show the project they hold

**Decision:** DEF-20 lands: a load (Open, and a failed Open's rollback, through `syncLoadedProjectControls`) writes the Duration thumb on the slider that exists and the reveal and Angle of View sliders; Clear All leaves Preview through the one mode setter, after its own non-restoring cancel of a held gesture; the 50 ms `isUpdatingSlider` flag, which dropped real Duration input, is deleted.

**Rationale:** the load wrote the Duration thumb only when the removed left slider existed, so after Open the thumb stayed where the last project left it (3,901 under a 12.7 s readout) and one +5 nudge made the duration hundreds of seconds; the reveal and Angle of View sliders were never written; Clear All sent `mode:changed`, which nothing hears, so the switch still said Preview. `angleToSlider` is recovered from `2fb72ff`. 7 tests fail on main; 13 of 14 mutants are killed, the 14th equivalent (the handler skips a missing slider). Thirteen control goldens move on purpose: the Duration thumb reads the fixture's 275 px/s, the Angle of View thumbs follow it, and the Spotlight rows show in the route context. Codex r1 found Clear All mid-drag restoring the deleted waypoint as the selection when the mode switch ran first; fixed by order, with a test. Start-up still leaves the Angle of View and trail thumbs at the markup: outside the item, a wish line, the run's call. Digest rules: nielsen 1 (status visible); house conventions (speed via `ui:slider:update-speed`).

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — GATELESS-1 — The owner paused chat 12 for the weekly reset, then let it run to his stop time

**Decision:** Chat 12 paused on 6 October and resumed on 7 October with no context line, under the owner's stop time, then stopped; nothing was scheduled to resume it. After the weekly reset the run may launch its items' agents together, one each, within the grant's limit of up to three in flight; gates, merges and releases stay one at a time.

**Rationale:** the owner, 6 October ~12:15: "lets pause at suitable moment until usage resets, then you can go whole hog with agents"; 7 October 00:08: "resume, and allow an unrestricted context window for this chat, but, importantly, cease at 01:59 tonight"; ~01:09: "you can go for one more hour or until usage is maxed. dont come back on when the usage resets". The run's calls, for him to confirm: "whole hog" as launching up to three items' agents together, within the grant; "tonight" as 01:59 on 7 October; and the last as scheduling no resumption, so a chat he opens after the reset carries on. The pause followed the usage tool's reading of 97% of the weekly plan.

**Supersedes:** none

**Deferred:** none

## 2026-10-08 — DEF-81 — TST-03's cancelled run stopped at 15m18s

**Decision:** DEF-81's Rationale is corrected in one fact: TST-03's pull_request run on `ec83404` was cancelled at 15m18s, and TST-11's on `c95c85e` at 15m17s; the decision is unchanged.

**Rationale:** Codex's review of DEF-81 found the timing; an old entry is never edited, so this supersedes it for that one fact.

**Supersedes:** 2026-10-07 — DEF-81 — Verify gets 30 minutes, since the suite reached 15

**Deferred:** none

## 2026-10-07 — TST-11 — Behavioural tests stand beside the source-text assertions; retiring those waits on the owner

**Decision:** TST-11's first round lands: 25 behavioural tests pin every source-text assertion its row names that has behaviour, on the booted editor or by running `build.js` in the SPL-06 harness's copy; the source-text assertions stay unchanged, and the item stays open, `[!]`, until the owner says they may go.

**Rationale:** the row says "Replace", but GATELESS-1 bars deleting a test and the record does not say whether a replacement counts, so the narrowest reading adds and keeps (the run's call, for the owner to confirm; Codex, asked first: "corrected A—add coverage; keep TST-11 open pending explicit replacement authority"). Of 64 source mutants, all 49 that break behaviour fail the suite (48 on the new tests, the version predicate on `buildScript`'s), 18 of them missed by the old reads (the rollback made unreachable among them); all 15 moves counted neutral (an extracted `isCurrent()`, renamed locals) pass the new tests and fail the old reads, though one, the rollback's cleanup before its restore (RS-N14), keeps the final state but not the order, which only the old read pins (Codex). Two contracts are comments and stay source-only. `publicationBoundary`'s check build also runs in the copy now, beside the original. One candidate defect is a wish line. Digest rule applied: house conventions → Testing and persistence.

**Supersedes:** none

**Deferred:** none

## 2026-10-07 — DEF-81 — Verify gets 30 minutes, since the suite reached 15

**Decision:** DEF-81 lands: the Verify job's limit (`.github/workflows/ci.yml`, `timeout-minutes`) rises from 15 to 30 minutes, the only change, because the suite now runs about 14 minutes on GitHub and runs were being cancelled at 15.

**Rationale:** on 6–7 October both pull_request runs, TST-03's on `ec83404` and TST-11's on `c95c85e`, were cancelled at 15m17s with tests still running; TST-03's re-run passed in 14m06s; main's own runs took about 13 minutes, and TST-11 adds a minute more. Nothing is skipped, sharded or changed in the suite; a faster one is a wish line. The record does not cover CI's limit, so this narrowest fix is the run's call under GATELESS-1, for the owner to confirm; Codex checked it. CI configuration ships nothing, so no release.

**Supersedes:** none

**Deferred:** none

## 2026-10-07 — TST-03 — Every visibility mode is pinned as a golden table, and seek equals play for each

**Decision:** TST-03 lands: three suites (179 tests; goldens `tests/goldens/visibility-*.json`, regenerated with UPDATE_VISIBILITY_GOLDENS=1) pin `getPathVisibleRange` for all five path modes and the comet trail, `getWaypointVisibility` for all five waypoint modes, and both reveal-mask builders, as they stand, and show seek equal to play for every mode.

**Rationale:** the plan row asks for "a mode-matrix golden table; seek == sequential for every mode": each mode is sampled at every window edge and clamp, on bare inputs and along a real engine timeline with waits, intro and tail, cold against one instance run forwards, backwards and scrambled; no mode differed, so nothing was pinned as a difference. 117 of 138 source mutants fail it (every mode branch, swapped hide windows, edges, easings, trail length, mask radius); the 21 survivors are equivalent at a boundary or by construction, unreachable, dead code, or killed by `revealTrail`. Codex's review found the mask goldens blind to drawing state (an alpha of 0, or a 1×1 clip, set before the clear passed every test): each draw now carries the state it draws with and a clip on the mask fails, and those mutants and an alpha of 0 at each build's clear now fail it. Area, text and the non-reveal background modes are not MVS code (§8.4). Six candidates are wish lines until verified, one a DEL-02 note. Digest rule applied: house conventions → Testing and persistence.

**Supersedes:** none

**Deferred:** none

## 2026-10-06 — REL-707 — v3.2.707 ships UI-04 and DEF-14

**Decision:** v3.2.707 is live from deploy commit `6f4c731` (tag `v3.2.707`), released under GATELESS-1 because UI-04's merge (`7298e65`, PR #103, closing DEF-14) changed `src/`, `styles/` and `index.html`.

**Rationale:** release.sh: rollback tag `rollback-v3.2.706-7298e65`, gate green (116 files, 2,698 tests), dry run, push, the Pages deploy green, 22 of 22 live files SHA-256-identical; the deploy commit's Verify was cancelled in the one-job queue and re-run. Live smoke, partial: title v3.2.707, 90 hint triggers, Open day loaded (27,028 ms) and played to its end, no failed resource; the MP4 and HTML export did not finish because the hidden browser pane suspends the page, so that check is owed (a wish line). UI-04 does not change export, so no disk save is owed for it.

**Supersedes:** none

**Deferred:** none

## 2026-10-06 — REL-706 — v3.2.706 ships CROWD-06

**Decision:** v3.2.706 is live from deploy commit `24cdfa8` (tag `v3.2.706`), released under GATELESS-1 because CROWD-06's merge (`ea9b09a`, PR #101) changed `src/`, `styles/` and `index.html`.

**Rationale:** release.sh: rollback tag `rollback-v3.2.705-ea9b09a`, gate green (110 files, 2,628 tests), dry run, push, Verify and the Pages deploy green, 22 of 22 live files SHA-256-identical. Live smoke: Open day, a saved project, opens with no hold and reads as before (27,028 ms, MP4 1920×1080 29.0 s); the HTML export carries `holdAtEndMs`; no failed resource or console error. CROWD-06 changes export, so a disk save of the smoke exports is owed through the owner's Chrome with his word (a wish line, beside v3.2.703's).

**Supersedes:** none

**Deferred:** none

## 2026-10-06 — UI-04 — Each hint has a "?" of its own, and DEF-14 closes with it

**Decision:** UI-04 lands: every parameter hint gets a visible "?" button beside its label, opened by hover after UI-03's delay, keyboard focus or tap, described to screen readers as before, so a click on a label toggles or focuses its control; DEF-14 closes with it, every range now naming its readout through `aria-describedby` and `setRangeReadout`.

**Rationale:** the hint's delegated click handler cancelled every click on a `[data-tip]` label (`ParamTooltip.js`), so six hinted checkboxes never toggled from their text and about 70 labels never focused their control; 28 ranges lacked their readout. The "?" sits in a 44 px slot after the label, a Carbon ghost icon button in UoN tokens with a forced-colours rule; rows added later gain and lose theirs. Two adjacent fixes the "?" needs, the run's call: a hidden label hides (the reveal-trail row always showed), and ranges may shrink to keep rows inside the sidebar. 36 tests fail on main; six mutants are killed. UI-STANDARDS gains no "?" line, at 1,848 of its 1,850 words (a wish line). Digest rules applied: WCAG 2.2 AAA → 2.5.5 Target Size, 2.1.3 Keyboard, 2.4.13 Focus Appearance; Nielsen → 4, consistency; Carbon → productive; house conventions → Testing and persistence, and Patterns to follow (readouts through `setRangeReadout`).

**Supersedes:** none

**Deferred:** none

## 2026-10-06 — TST-09 — Camera, dots, curvature, minor-end and time domains are pinned as they stand

**Decision:** TST-09 lands: five suites (41 tests, goldens under `tests/goldens/domains-*.json`, regenerated with UPDATE_DOMAIN_GOLDENS=1) pin today's camera, dot positions, curvature cache, minor-end timing and the time domains from before the start to past the playback end, on the branched Open day route, so the fixes they gate (DEF-05, DEF-07, DEF-10, DEF-11, DEF-12, DEF-79) each move a baseline on purpose.

**Rationale:** each domain compares play, seek and export where the harness allows; eight source mutants (camera state kept across seeks, a frame-late dot, a cache key ignoring the middle point, a minor end counted as major, the tail evaluated on B, releases on F, beacons ignoring the intro, a rate limit never released) fail it. It confirmed DEF-79 (a linear-route video export re-measures a bound crowd's arrival, 5,915 ms against 2,292 ms) and found four candidates, wish lines until verified. The checker asks for an archive at 46 live entries, but the oldest is now GATELESS-1's founding grant, which open lines cite and the run works under, so it stays live under the owner's prune bar (2026-08-27: budgets yield to context feeding open work); the run's call. It ran alongside UI-04 and CROWD-06, which PLAN-2 orders first, under GATELESS-1's rule of up to three items in flight with merges one at a time; it lands when ready. Digest rule applied: house conventions → Testing and persistence.

**Supersedes:** none

**Deferred:** none


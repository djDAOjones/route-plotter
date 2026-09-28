<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: the big run, W4 to W12, merged as you go

This supersedes `route-plotter-continuation-prompt-open-calls-2026-09-28.md`,
whose calls Joe answered on 2026-09-28; it remains as provenance. The same
day, #53 amended it with Joe's answers to the calls the run would have parked
(decision log, "the big run, amended"). Paste everything below into a fresh
chat. It stays the current prompt for every
session of the run until one supersedes it: a session that picks the run up
again starts from the last handoff, the backlog and the open pull requests.

You are continuing an adopted refactoring programme for Route Plotter v3, in
a **long, low-gate run**. W0, W1 and W2 are closed, and W2's fixes are live as
v3.2.692. The post-W2 queue, W3's pilot and their follow-ups are merged on
`main`, unreleased. **Joe has answered every open call and, for this run,
delegated to you the merges and the planned behaviour changes** (decision
log, 2026-09-28, "the big run" and "the big run, amended"). Your job: take the backlog's `### Next`,
then plan waves W6 to W12 as the waves they depend on complete, one item per
pull request, each reviewed and, once it clears the merge bar below, merged
by you. Close each item, and each wave, in project memory. Park whatever
needs Joe and keep going. Release once, at the end.

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3` — Joe's. Read it; never write it.

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and
the repository disagree, the repository wins, except on what the decision-log
entries "the big run" and "the big run, amended" settle for this run; tell Joe
of any disagreement.

## Purpose

The programme makes the codebase **auditable and safe to change with AI
assistance** without changing what users see, apart from the defects Joe has
approved. The strategy is still *pin, then prune, then clarify, then
consolidate. Never rewrite.* This run is measured by merged work that is
reviewed and provably behaviour-preserving, not by its pull-request count. One
wave done well beats three done loosely.

## What Joe has decided — don't ask again

The decision-log entries "the big run" and "the big run, amended" (both
2026-09-28) are the authority; this is their summary.

- **The open calls.** DEF-28 takes option A: announce the failed restore and
  show a notice with **Download it** and **Discard**, and move the record to a
  second storage key that autosave never writes, until the author chooses.
  **Clear All discards the parked record too,** and says so. If storage can't
  hold both the parked record and a new autosave, the parked record stays: the
  autosave fails and is reported as today, and the report points to the
  notice's Download it and Discard. DEF-40 to DEF-46 are accepted, each by its
  plan row's first remedy: P2 for DEF-40, 41, 44 and 46; P3 for DEF-42, 43
  and 45. TST-04 lands before W4, and W4's characterisation mutates every
  branch of each moved function and accounts for every survivor.
- **You merge your own pull requests** when they clear the merge bar. One
  that doesn't stays open for Joe, and the run moves on.
- **Planned defects are approved in advance,** each by its plan row's stated
  treatment **as it reads when #53 merged** (#53 added Joe's answers below as
  dated notes on CON-14, ABS-06, DEF-07, DOC-08, DEL-07, §12.1, §13 rule 3,
  W10 and §20 Q5, Q16, Q18 and Q19). For DEF-40 to DEF-46 that means
  the first remedy only, never a row's "or …" alternative. A row patched since
  is not approved beyond its old text: a PR that relies on the patch parks.
  Also approved are the §20 choices of 2026-09-22 that change behaviour: Q10
  (one intro curve and time base), Q11
  (anchored crowd nodes can't be dragged, and say so), Q12 (a saved 0 stays
  0), Q13 (the drone image ships only when used), Q18 (diagnostics may carry
  an EventBus error *count*, behind a `DIAGNOSTICS_SCHEMA_VERSION` bump, with
  no error text or project content; its future-version half is now Joe's
  refusal, under Files from other versions) and Q19 (the UI's ranges are the
  true ones; the pause's is the scene outline's 0–600 s, and the slider stays
  a 0–30 s fine control, so nothing that loads or can be entered today is
  refused or cut short). Each of those
  becomes its own PR, with a DEF row marked decided that quotes §20's default
  word for word; the reviewer checks the fix against that quote. Every defect
  PR still states its new behaviour.
- **Every §20 default** was accepted on 2026-09-22, and the plan rows that
  still read "owner decides" now carry a dated note saying so. Earlier calls
  stand: a `null` Graphics scale means 1× (DEF-37), round caps and joins
  (DEF-39), the preview's blue (DEF-47), branches named for their item, and
  pull requests watched once opened.
- **Files from other versions** (Joe: "refuse newer, drop older. for now.
  start to plan compatibility so that from now on old versions can be
  imported and upgraded"). A file from a newer version is refused with a clear
  message and never re-saved; nothing opens it for viewing. A file from an
  earlier version no longer has to load: where old-format handling
  complicates a change, drop it, name the drop in the PR, and refuse such a
  file with a clear message rather than misread it. Plan compatibility from
  here on, in DEP-03 and ABS-06: one version for the persisted format, one
  gate for autosave, ZIP and player, and, for each later change to the format,
  a version bump with a tested step that upgrades the previous version's
  files, all written into `architecture.md`. The promise starts with this
  run's release: from it on, every later version imports and upgrades every
  earlier file. That starting point is this prompt's reading of Joe's words,
  and he may move it.
- **Defects found on the way are fixed** (Joe: "fix defects along the way"),
  including a defect a wish-list line records in code your work reaches. Each
  gets a DEF row (plan §12.1, the next free number) with its evidence, marked
  decided by this call, and its own PR that states the new behaviour and pins
  it with a regression test; it merges under the bar like a planned defect.
  Where the fix is a real choice between behaviours users would notice, make
  the smallest change that removes the defect and say so in the PR. Delete the
  wish-list line it resolves.
- **DEF-07 needs no side-by-side** (Joe: "I dont need to see the old camera
  feel"). It merges under the bar like any planned defect, and ABS-03's
  camera half follows it.
- **Devin, Windsurf and `_Joe/`.** Devin and Windsurf are no longer used
  (Joe: "dont use anymore"), so DOC-08 deletes `.devin/` and
  `.codeiumignore`. In `_Joe/`, delete DEL-07's two scripts and, once DOC-08
  has moved the dev guide's valid parts out and retired AGENTS.md's read, the
  dev guide itself (Joe: "you rename or delete"). Nothing else in `_Joe/`
  changes.
- **Chromium only, for now** (Joe: "we can skip firefox and safari checks and
  call this a chromium only app for now"). No check needs Firefox or Safari.
  REV-04 closed on its Chromium evidence, REV-03's physical pass is Android
  Chrome alone, and README says so (#53).
- **Budgets.** At a wave's close-out, archive the trajectory's oldest phases
  **without waiting**, keeping any phase that feeds open work (Joe's prune bar,
  decision log 2026-08-27). `end-of-task.md`'s size check and the Prune verb
  of `memory-maintenance.md` would propose and wait (Prune P2): Joe has
  answered, so run P1 and P3 to P6, and put P2's table in the PR body. The
  decision log was pruned on 2026-09-28 (#52), leaving 18 live entries after
  #53; if the run's entries take it over budget again, it stays over by Joe's
  choice. The wish-list keeps its items, by Joe's call: append lines, and
  consolidate or delete one only where that is natural (a duplicate, or a
  line your work resolves); never triage.
- **One release, at the end of the run,** after a smoke test of the exact
  candidate (below). If it fails after publishing, **roll it back yourself**
  as DEV-INFRASTRUCTURE prescribes, then stop. Nothing needs Firefox or
  Safari.
- **The Browser pane, all run long.** Joe's permission for this run
  (2026-09-28): you may add the temporary server entry to the parent folder's
  `.claude/launch.json` whenever a check needs a browser, and you restore that
  file byte-identical after each use (see Browser checks).

## The vendored workflows, in this run

`AGENTS.md` sends non-trivial work through `pm_skills/integrations/task.md`,
whose default mode, `checkpoint`, waits for approval at a scope gate and an
option gate. **This run is `auto-jazz`:** no gates. At each skipped gate,
make task.md's conservative choice and state it in one line in the PR. A
behaviour-preserving item also keeps `refactor` mode's preservation contract,
with its declared surface (the plan row's paths and the tests that pin them)
named in the PR rather than approved at a gate.

task.md's hard prohibitions stand. Five of them this run meets are already
approved:
- deleting a test that pins only dead code (Q8, each named in the wave's
  decision-log entry);
- the persisted-format changes planned rows state (DEF-09 drops
  `styles.pathHead.rotation` from snapshots; Q12 keeps a saved 0 and restores
  `modified`; DEF-28's new storage key; ABS-06's version gate, which names
  the current `coordVersion`, and the upgrade path Joe asked for, in which a
  later change to the format bumps it with a tested upgrade step; Q18's
  diagnostics count behind a `DIAGNOSTICS_SCHEMA_VERSION` bump);
- dropping old-format handling under Joe's "drop older", each drop named in
  its PR;
- deleting three never-edit files in `_Joe/`: DEL-07's two scripts, and the
  dev guide once DOC-08 has moved its valid parts out;
- more than five files, inside a row's declared surface.

Anything else on that list (a runtime dependency, any other never-edit file, a
destructive migration, deleting data) still goes to Joe. **Each PR closes
full** (`end-of-task.md`), with one exception: DOC-06 (j) gives each wave a
single decision-log entry, written at the wave's close-out from its PRs'
evidence. Nothing else is deferred, so no `Close: lite` trailer is needed. An
item that takes several PRs stays open until the last one (see Closing items
and waves). task.md's step 11 commits to the item's branch and pushes only that
branch. The comparative review stands in for the `review.md` pass task.md
suggests after a gateless run. **Where task.md would stop and ask** (step 7's
blocking concern, or a hard prohibition not approved here), park instead. A
source-text test that a row replaces with a behavioural one (TST-11) is
replaced in the same PR, both named in it. The new test must fail on the
mutation the old one caught.

## What still goes to Joe — park it, don't stop

To park: leave the pull request (if there is one) open, with a first line
`Waiting on Joe: <the question, and your recommendation>`; put it in the
ledger and the handoff; carry on with whatever doesn't depend on it.

- **Behaviour beyond a row's treatment,** or evidence that a row is wrong in a
  way that changes what users see: patch the row with a dated note, propose,
  park. The same goes for whatever a row or a §20 default leaves open. (A
  defect found on the way is not this: fix it, as What Joe has decided says.)
- **CON-01's two UI-only defaults** (`wiringBus.js:300` and
  `sceneOutline.js:867` at `2e4d78e`): keep today's values, so the PR
  preserves behaviour. If that proves impossible, park it with the values
  stated.
- **Anything else in `_Joe/`,** beyond the three deletions Joe allowed.
- **Owner-run evidence:** REV-03's physical Android Chrome pass and REV-05
  stay Joe's and never block the run. A browser check the plan names for an item
  (its wave's Validation row, or a §2.9 probe for its defect) is part of that
  item: run it (see Browser checks), and if your environment cannot, park the
  item with the check listed. A check nobody requires, which you would like
  Joe to see, goes in the PR and blocks nothing.
- **The run's own gates may only be strengthened.** These are
  `.github/workflows/`, `push.js`, `vitest.config.js`, `tests/setup.js`,
  `tests/helpers/minCountReporter.js`, `tests/helpers/consoleGuard.js`, and
  the rules that authorise this run (`AGENTS.md` → Commit, push and release;
  DEV-INFRASTRUCTURE → Quality gate and Deployment; the decision-log entries). A
  PR that touches them says what it adds, removes nothing that fails today,
  and its review shows every existing check still fails on its old mutation.
  Anything that loosens one parks, with one exception: a reviewed,
  exact-inverse revert of this run's own merge that turned `main` red may
  restore the green gate before it. Nothing else may weaken one.
- **A new runtime dependency,** any change to repository settings, rulesets
  or the Pages source, and anything else outside the authority. The one
  exception is the rollback `DEV-INFRASTRUCTURE.md` prescribes when the release
  fails (see The release).

## Where things stand (verify first; it may have moved)

Check with `git fetch` then `git log -1 origin/main`; the Pages source and
latest build; the last CI runs; the open pull requests (`gh` on Joe's Mac, the
GitHub MCP tools in a cloud container, which has no `gh`); a read-only
`git status` in the OneDrive copy; and whether another agent session is
working the repository (`ListAgents`; see Traps).

- **`main`** ends with #53, which recorded Joe's answers and amended this
  prompt, on #52 (a memory maintenance pass) and #51 (the backlog refactor and
  this prompt). **If the decision-log entries "the big run" and "the big run,
  amended" are not on `origin/main`, stop and ask Joe: the authority begins
  with them.** `main` is
  protected: no force-push, no deletion. Remote branches: `main` and the
  frozen `review-remediation`.
- **Live: v3.2.692** (`14e3656`, tag `v3.2.692`), served by Pages from `main`
  `/docs`. Everything merged from #31 on is **not live**. Rollback tags:
  `v3.2.689`, `v3.2.690`, `v3.2.691`, `v3.2.692`.
- **Gate on `main`:** `npm run check` → 86 test files · 1,259 tests · 2 todo ·
  shell 0 · build:check 0. On Joe's Mac the test run takes 76–81 s and peaks
  near 1.8 GB of heap; a cloud container took 166 s.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`.
  Its line references are at `2e4d78e` unless a dated note says otherwise,
  and `src/` has moved since: re-verify every reference before relying on it.
- **Open defects: 27** — twenty planned rows, and DEF-40 to DEF-46.

## The queue, and the order to take it

The backlog's `### Next` holds 33 items; each plan row is its item's detail.
TST-04 and three other tests unblock the most, so a sensible order is:

1. **TST-04** first (it gates W4, DEF-14, DEF-19 and DEF-20), one golden
   family per PR: control→bus for every control, then model→control state per
   selection path, readouts included (the pilot found nothing checks them).
   Pin observable end state, not call counts.
2. **The ready defects,** interleaved with W5: DEF-28, DEF-44, DEF-46,
   DEF-40, DEF-41, then DEF-06 (before the release: DEF-08 made its leak
   visible), DEF-42, DEF-43, DEF-45 and DEF-27.
3. **TST-13, TST-05, TST-09 and TST-03,** then SPL-06 and TST-11, TST-08,
   TST-14 and TST-16.
4. **W4** once TST-04 has merged in full, both golden families; DEL-05 also
   waits for TST-13.
5. **The defects waiting on a W5 test,** as each test merges.
6. **Then the later waves.** Each enters `### Next` at a close-out, once the
   waves it depends on (§13's "Depends on" rows) are complete:

| Wave | Enters when | Items (plan §13) |
| --- | --- | --- |
| W6 | W4 and W5 are complete | CLR-02 with DEF-16; ISO-01; ISO-03; ISO-04; DEP-01; DEP-02 |
| W7 | W5 is complete, including TST-09 and the branched and intro/tail fixtures §13 W7 names | DOC-04; DOC-05; ABS-01 with DEF-12; ABS-02 with DEF-05 |
| W8 | W6 and W7 are complete | **DEP-03 first** (moved up from W9 on 2026-09-28: CON-11 and CON-05 need it, which made W8 and W9 a cycle; its own prerequisite, TST-06, has shipped); then CON-04; CON-07; CON-11 with DEF-04; CON-06, then DEP-05; CON-05 with DEF-24; CON-10; CON-12; CON-13; CON-09; CON-14 with Q19; DEF-09; DEF-25; Q11; Q12; Q13 |
| W9 | W5 and W8 are complete | the registration-order snapshot of the wired handlers first (§13 W9); CON-01; CON-02; CON-03; CLR-01; SPL-02; SPL-03 on DEP-03's extraction, then ABS-06 with Q18's future-version policy and the upgrade path (Joe, 2026-09-28); SPL-04; DEP-04 (SPL-06 went ahead of TST-11) |
| W10 | W7 is complete | DEF-10; CON-08 with DEF-11; Q10; DEF-07 (no side-by-side for Joe); ABS-03's timeline half once CON-08 merges, its camera half once DEF-07 does |
| W11 | W6 to W10 are complete | the compatibility exports and wrappers they left; the `setSelectedWaypoint` shim; deprecated aliases |
| W12 | W1 to W11 are complete | GOV-03; GOV-02 (after DOC-08's link fixes); TST-12; TST-15; DOC-07; DOC-08, with the deletions Joe allowed (`.devin/`, `.codeiumignore`, then the `_Joe` dev guide once its valid parts have moved); DEL-07 (delete its two `_Joe/` scripts); Q18's diagnostics error count; `AGENTS.md` pointers to plan §15 and §16 |

- §13's lists don't name CON-09, DEP-05, ABS-06 or CON-15; they sit where
  their code and prerequisites put them. CON-15 joins once DEL-05 and TST-13
  have merged.
- **A row whose prerequisite sits in a later wave pulls that prerequisite
  forward,** as its own PR (DEP-03 into W8; SPL-06 ahead of TST-11).
- **Out of this run's scope:** the P3 rows CLR-03, ISO-05, SPL-05, SPL-07,
  SPL-08, ABS-04, ABS-05 and CLR-04. List them in the final handoff as
  follow-up candidates. SPL-09 stays deferred.
- **A wave held up by a parked item.** A later item may go ahead only once its
  own prerequisites and the characterisation it needs are listed and met. That
  doesn't complete its wave, or satisfy any later wave's entry condition.
- Keep `### Next` within the Active budget (`pm_skills/memory-policy.md`):
  promote a wave's rows when it enters, not before.

**Notes that cross items:**
- DEF-28 and DEF-45 both touch what recovery announces: do DEF-28 first, and
  let DEF-45's queue carry its message.
- DEF-28 adds a storage key: name it in `constants.STORAGE` beside
  `AUTOSAVE_KEY`, and add it where `README.md` describes autosave and Clear
  All. Clear All's removal (`clearAutoSave`) must reach it too, per Joe's
  call.
- DEF-06 lands before the release: since DEF-08 (unreleased), a route cut to
  one waypoint draws its last marker, paused, at a stale grow scale.
- DEF-20 recovers `angleToSlider` from `2fb72ff`
  (`MotionVisibilityService.js:1579-1610`) rather than rewriting it.
- DEF-41 widens `GraphEdge._clampPoint` and `FlowLayer`'s load check together,
  with a trace → save → reload test: widening the model alone saves projects
  that won't reopen.
- DEF-46: DEF-29's tests show how to run the real `exportVideo()` with only
  the encoder replaced.
- **W4:** before deleting, grep the whole tree, including `index.html`,
  `tests/`, `scripts/` and `_Joe/`, for string and dynamic references; never
  remove a `window.*` surface; attach the grep output to the PR. Under Q8, a
  test that pins only dead code goes with it, named with its symbol in the
  wave's decision-log entry; DEL-06's two tests that use a dead symbol inside a
  live assertion are rewritten, not deleted. DEL-05 changes the published
  inventory (`tooltip.css`): update `index.html`'s `<link>`, `build.js` and
  `publicationBoundary.test.js` deliberately, and merge it only with a
  before/after browser check of the Tooltip system and the CSS. §20 Q9's
  `RoutePlotter.destroy()` (never called) goes with DEL-04's `main.js` dead
  code.
- DEF-04's fix retires the last two `todo`s, in `authorableLoadable.test.js`.

## The run loop

For each item:

1. **Pick** the next item whose prerequisites have merged. Fetch first.
2. **Branch** from the current `origin/main`, named for the item (e.g.
   `w5/tst-04-control-goldens`, `def/def-28-restore-notice`). Always base the
   pull request on `main`, never on another branch.
3. **Characterise first,** and watch the test fail for the right reason. For
   a defect already characterised, the active test beside its `todo` asserts
   today's broken behaviour: turn it into the regression, keep its
   reproduction, and retire the `todo`. For a move, pin what moves, then
   mutate every branch of each moved function and account for every survivor.
4. **Make the smallest change.** One concern per PR: a mechanical move and a
   behaviour change never share one. Keep a PR to about 300 changed lines,
   excluding moves; a deletion PR to about 600 removed lines in one segment.
5. **`npm run check`**, plus targeted tests, and a **mutation table**: at
   least one mutation per fix site (per branch, for moves), each run from a
   script that restores the file and checks it by SHA-256, under a watchdog.
   Record what caught each.
6. **Goldens:** for a defect, write down the cells you expect to move (in
   the PR) before you regenerate; regenerate only the goldens the change means
   to move, and read the diff against that list.
7. **Where a user sees the result, run the matching §2.9 probe** (or the
   row's own) on `main` and on the branch, in a real browser (see Browser
   checks), and record both. jsdom cannot show a real click's order of events:
   DEF-40's jsdom tests pass on the broken code.
8. **Review** (see The comparative reviewer) in the background, and record
   the base and head SHAs the reviewer saw. While it runs, start the next item
   that touches different files, in a second clone: at most one item in
   implementation and two in review.
9. **Fix or rebut** each finding with evidence, re-run the mutation it used,
   and push.
10. **Open the pull request.** Title `<ITEM-ID>: summary`. The body: the
   behaviour statement (a defect) or the preserved contract (a refactor: no
   `window.*` global, DOM id, EventBus event or persisted format changed); the
   evidence; the mutation table; which reviewer ran, at which SHAs, and what
   it found; the checks left for Joe; and the merge bar, ticked.
11. **Close the PR full** (see Closing items and waves). Write the plan note,
   and any permanent-document change, before the review, so the reviewer sees
   them. Only mechanical updates made after it (the PR's number, a shipped
   status, a count) need no further review. A change to behaviour, scope,
   prerequisites, authority or a permanent contract needs review on the head
   that results.
12. **Merge or park.** Before merging, merge the current `main` into the
   branch, whatever files it touches, and re-run `npm run check`; after a
   merge, update the ledger.

## The merge bar

Merge only when **all** of these hold, with
`gh pr merge <n> --squash --delete-branch --match-head-commit <sha>` (the SHA
from `git rev-parse`, never typed from a short one):

- **Verify** is green on that head. By the time a review is back it has
  usually finished: read its result once, and if it is still running, work on
  something else and come back. Don't poll it in a loop.
- `npm run check` passes on the branch with the current `main` merged in.
- The independent review ran, and every finding is fixed or rebutted with
  evidence in the PR. The reviewer saw the PR's current head, or every
  substantive change since the head it saw has had its own review. That
  includes a conflict resolution in code or tests; one confined to
  mechanical memory lines (backlog ticks, trajectory lines, file-map rows and
  counts) needs none.
- The mutation table is complete: every fix site's mutation killed and, for
  a move or a deletion, every branch of each moved function mutated and every
  survivor accounted for.
- The diff has no `docs/` or `version.json`.
- The goldens moved only as the PR states: byte-identical for a
  behaviour-preserving PR; for a defect, only the cells it listed before
  regenerating, each of which the reviewer agrees follows from the row.
- A browser check the item's row, §2.9 probe or wave Validation names carries
  its real-browser result; with no real browser available, the item parks.
- A defect PR's behaviour is within its row's treatment as approved above, or
  a call Joe made above.
- Nothing in it waits on Joe.

The same bar applies to `PM:` close-outs and to revert PRs. A close-out
changes documentation only, since a test or reporter change is an item PR,
and a stand-in review is enough for it. A revert's review checks that it is
the exact inverse of the merge.

**Merges are serialized.** After each one, read Verify on the resulting
`main` SHA before you merge another PR (CI cancels a superseded run on `main`,
so merging quickly hides a failure); implementation and review carry on
meanwhile. **If `main` goes red,** freeze merges, open a revert PR, merge it
once it clears the bar, and park the item with the failure. In a cloud
container, if the merge tool takes no head SHA, read the PR's head just
before merging and confirm the merged content just after.

## Closing items and waves (you are the single memory writer)

**Each PR closes full** (`end-of-task.md`), so the repository is the record
after every merge. **An item closes only when its whole scope has merged:**
TST-04's two golden families, DEL-02's two or three PRs, DEL-04's three or
four, and any other item whose row or wave says it takes several PRs. Until
then, its backlog row reads `[~]` with the merged PRs and the work left, and
its plan row gets a dated progress note, not a shipped marker.
- **Backlog:** when the item is complete, remove its line; until then, keep
  its `[~]` row current. A gate is a claim, so keep every other flag honest.
- **Trajectory:** one line, starting with its ID, under its wave's phase
  (create the phase heading if it isn't there yet), when the item completes.
- **Plan:** a dated note of what each PR did. When the item completes, mark
  its row `Shipped (<wave>, PRs #N…; unreleased)`. A defect found on the way
  goes in as a row decided by Joe's "fix defects along the way".
- **File-map:** a row for each file it adds, removes or re-roles, and the
  counts corrected. **Never run `gen-file-map.mjs`**, and recount after
  merges.
- **Permanent documents** whose owned facts changed (README,
  `architecture.md`, `conventions.md`, DEV-INFRASTRUCTURE, UI-STANDARDS);
  wish-list lines for ideas it set aside.

**Each wave closes in a `PM:` PR**, reviewed like any other:
- **The decision log:** one entry for the wave (DOC-06 (j)). Give each PR's
  stated behaviour or preserved contract, what the reviews found, the tests
  deleted under Q8 (each named with its dead symbol), the §18 metrics (open
  defects, tests, golden diffs, dependency edges changed, test wall time, peak
  heap) and the budgets. Keep it under 600 words; never edit an old entry.
- **The plan:** the wave's `Status` line.
- **The backlog:** the next wave's rows promoted, once the waves it depends
  on are complete.
- **The trajectory:** the phase's one-line outcome. Past 2,000 words, archive
  its oldest phases to `archive/trajectory/` and keep `archive/INDEX.md`
  current, leaving any phase that feeds open work.

**The min-count canary** (`tests/helpers/minCountReporter.js`, 72 files /
1,000 tests): keep its floor, unless a reviewed item PR raises it with room to
spare for W4's planned test deletions. A change to it is an executable change,
never a close-out's.

## The release, at the end

**When:** once the run's scope is exhausted — every item from the backlog's
`### Next` through W12 merged or parked — and `main` is green, or earlier if
Joe calls it. An interruption,
a context summary, a usage limit or a whole-run stop suspends the run; none of
them triggers the release.

1. **Smoke-test the exact candidate first.** DEF-06 must have merged. If it
   is still parked, park the release unless Joe waives it. Build the `main`
   SHA you will release in a separate throwaway clone, serve it, and check
   that it loads to ready, that a built-in example plays, that an HTML export
   opens and plays as a recipient would, and that a real MP4 export works in Chromium (`ftyp` at
   offset 4). On Joe's Mac that means the Browser pane; a cloud container
   cannot encode H.264. **Missing Chromium or MP4 evidence parks the release:**
   ask Joe. Route Plotter is Chromium-only for now, so no other browser is
   checked.
2. **Then release** from a fresh, clean clone at that SHA, by
   `DEV-INFRASTRUCTURE.md` → Deployment, steps 1 to 8, exactly:
   - **Step 1:** check the Pages source is `main` `/docs`, and that the latest
     build is `built` at the SHA you expect. Stop if either differs. That
     exact live SHA needs a pushed, annotated rollback tag. If it has none,
     add one there (name it for what it is, e.g. `rollback-<short SHA>`;
     existing tags never move), and confirm its `docs/` and `version.json`
     match `v3.2.692`'s (`git diff --quiet v3.2.692 <live SHA> -- docs
     version.json`).
   - `npm run check`, `npm run push:dry-run`, then `npm run push`. Note the
     deploy commit.
   - **After publishing:** check Verify on the deploy commit, the
     `github-pages` deployment at that SHA, and every published file's
     SHA-256 against `docs/`. Then run step 5's checks on the published bytes,
     served locally so the live site's storage is never touched.
   - **Any failure:** roll back at once, as Deployment → Rollback prescribes
     and Joe allowed: push a branch (e.g. `rollback-v3.2.692`) at tag
     `v3.2.692`, point the Pages source at it, request a build
     (`gh api -X POST repos/djDAOjones/route-plotter/pages/builds`), and
     confirm the deployment SHA. That is the one Pages-source change this run
     may make. Check the restored site the same way, then stop and report.
   - **Tag** the deploy commit `v3.2.<build>`, annotated, from `package.json`
     and the pushed `version.json`, and push that one tag.
3. **Record it** in a `PM:` PR that clears the merge bar. It holds the
   release's own decision-log entry: every user-visible change since v3.2.692
   (#31 on), Q12's effect on old files that saved a 0, and what was verified
   and what stays Joe's. It also adds the trajectory phase. **The run ends
   when that PR merges,** or
   when Joe ends it without a release.

## Stop the whole run only when

- `main`'s gate cannot be made green again by a revert;
- another session is changing the repository (commits, branches or pull
  requests that are neither yours nor Joe's): stop, report, wait. Joe merging
  or closing one of your parked pull requests is an answer, not a collision;
- a step would need a force-push, a history rewrite, a settings or ruleset
  change, a Pages-source change other than the release's documented rollback,
  or `docs/` or `version.json` changed outside `npm run push`;
- the release needed a rollback;
- the release is done and recorded: the run is over, so hand off;
- Joe says so.

A stop suspends the run; it never triggers the release. Everything else is
parked, not stopped. The plan's stop-and-re-plan
conditions (a §14.6 invalidation, a golden that cannot be made deterministic,
a wave running past about twice its PR estimate, a finding that changes
sequencing) park the wave concerned, with a dated plan note and a line for
Joe; the independent lanes carry on.

## Staying on course in a long run

- Keep a **ledger** in your scratchpad, outside the repository: `main`'s SHA
  after each merge; each pull request and its state; parked items and their
  questions; the current wave; the next item; where the mutation runners live.
  Update it after every merge or park.
- **After any context summary,** re-read this prompt from your clone and the
  ledger, and re-verify against GitHub before you act.
- Send Joe a line as items merge and a short summary at each wave close.
  Don't wait for replies.
- The scratchpad can be wiped between days, and a session can end abruptly.
  Full item closes make the repository the record after every merge. A later
  session reconciles the merged and open pull requests against the backlog,
  the plan rows and the ledger (if it survived), then takes the first
  incomplete item.

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole;
   the backlog Active section; the latest decision-log headings, starting with
   "the big run, amended", "the big run" and the other 2026-09-28 entries.
2. **From the plan, only what the current item needs:** its §12.1 or §12.2
   row; §13's ground rules and its wave's table; §17 (testing); §18
   (metrics); §20 before calling anything open; §2.9 for the round-2 browser
   probes; §14.4 to §14.7 before W4; §8.5, §10 and §16 before any
   consolidation or split.
3. **`DEV-INFRASTRUCTURE.md`** (Quality gate, Runtime lifecycle, Deployment)
   and **`pm_skills/memory-policy.md`**, whenever you touch memory or the
   release.

## The safety net — use it, do not rebuild it

- **`tests/helpers/bootApp.js`** boots the real app: `const app = await
  bootApp(); await app.ready;`. It does not await `ready` for you. **Every app
  booted in a file leaves its `document` keydown listener behind**, so a
  second app in the same file loses keys to the first: call
  `app.interactionHandler.handleKeyDown(event)` directly
  (`tests/helpTellsTheTruth.test.js` shows how). Spy on `eventBus.emit` with
  `mockImplementation` when you only need to know what a key *asks for*: ⌘S
  delivered for real opens the save dialog, which overflowed the stack under
  jsdom (unexplained; on the wish-list).
- **`tests/helpers/projectSnapshot.js`** — `freezeClock()`, `loadSnapshot()`
  (the real recovery path), `LOAD_REFUSED`, `comparableSnapshot()`.
- **`tests/helpers/drawLog.js`** — one transcript across every canvas:
  `frameAt`, `takeFrame`, `discardFrame`, `setUpFrame`, `differingLines`. A
  composited canvas carries its surface's label, and a surface the transcript
  does not know appears as `other#<id>`, which the goldens reject.
  `takeFrame(host, { state: true })` ends each line with the full state its
  call was made in (transform, open saves, styles); `{ state: 'drawn' }` keeps
  only what a marking call draws with. It sees no clip region, pattern
  smoothing, `putImageData` or text spacing, and nothing in `src/` uses them.
  `takeFrame` also drops the frames it takes from the canvases' own
  transcripts (see Traps).
- **`tests/goldenDrawLogs.test.js`** — four fixtures × five instants × three
  modes, `play == seek`, `app == player` (including `authored-extras` at its
  authored Graphics scale 1.6), the DEF-34 regression at scales 0.5, 1.6 and 8,
  a check that every frame composites `[canvas vector]` onto `main`, and a
  pixel-density-2 composite test. **Fixed defects stay fixed:** DEF-36 and
  DEF-38 throw at every call a frame makes on the vector layer or the main
  canvas, and DEF-38 also at every read of the background pass's inputs
  (`renderThrowingAtRead`); DEF-39 draws every instant four ways; DEF-47
  checks the area-drawing preview's blue. Shared helpers: `surfaceCalls`,
  `deepestSave`, `renderThrowingAt(host, surface, index)`. DEF-38's test shows
  how to run the player at its display size (a sized parent, then
  `player.resize()`). Still unseen, on the wish-list: a path-only export.
- **`tests/fixtures/authoredExtras.js`** — the every-field fixture; still no
  `pop` beacon, and its `pathTrail` of 640 puts its later instants past every
  beacon window (on the wish-list).
- **`tests/goldens/`** — regenerate deliberately with
  `UPDATE_SNAPSHOT_GOLDENS=1` / `UPDATE_DRAW_GOLDENS=1`, then justify every
  changed cell in the PR.
- **`tests/helpers/consoleGuard.js`** — undeclared console output fails its
  test; declare it with `allowConsole(/…/)`.
- **From W2 and after:** `tests/shortHexGlow.test.js` has a manual
  `requestAnimationFrame` harness; `tests/exportMinimisation.test.js` drives
  the real `saveProject()` and `exportHTML()` and reads the blobs back;
  `src/utils/imageCoordinates.js` and `boundedEntityId`
  (`src/utils/entityId.js`) are the one rule each for image-point ranges and
  derived ids; DEF-29's tests run the real `exportVideo()` with only the
  encoder replaced (`app.videoExporter` stubbed, `VideoExporter.downloadBlob`
  spied, both restored in `finally`); DEF-37's round-trip a real `.zip`
  through Open Project; DEF-33's record every announcement by spying on
  `announce`, because the live region clears itself after 2 s; and
  `tests/sliderScales.test.js` pins the slider maths value for value.

## Standing rules (non-negotiable)

**Environment**
- Work in a **fresh full clone outside OneDrive**, never `--single-branch`.
  Re-clone rather than trust a scratchpad from another day.
- The OneDrive copy is Joe's, and other sessions may be in it: never write
  there, and never fast-forward it; Joe does.
- Never run `npm run dev`, `npm run build` or `scripts/restart.sh` as a check.
  The gate is `npm run check`, which is non-mutating. (A build in a throwaway
  clone for a browser check is fine.)

**Git and releases** — the authority is `AGENTS.md` → Commit, push and
release, `DEV-INFRASTRUCTURE.md` → Deployment, and the decision-log entry
"the big run".
- One concern per PR, on a short-lived branch from `main`, named for its
  item. Verify must be green.
- **Never commit to or push `main`** except to merge a PR that clears the
  merge bar (or that Joe tells you to merge), and `npm run push` for the
  run's one release.
- **Parallel PRs collide on shared lines:** `file-map.md`'s header counts, a
  test file's header, `wish-list.md`'s last line (keep both sides). Identical
  edits on both sides merge "cleanly" and *wrongly* (two PRs that each bump a
  count from 331 to 332 leave 332), so recount after merges. Neighbouring
  lines conflict too (see Traps).
- **Commit messages:** `<ITEM-ID>: summary`, one what/why line, then
  `Verify: <F> test files · <T> tests · shell 0 · build:check 0`.

**Behaviour**
- Each defect PR states its new behaviour and changes only the golden cells
  it means to. Behaviour-preserving PRs leave the goldens byte-identical. A
  test that pinned the old behaviour changes with the stated behaviour and is
  listed in the PR, never silently.
- Never delete, skip or weaken a test to get a pass. Re-pointing a test's
  import when code moves, assertions unchanged, is not weakening; deleting a
  test that pins only dead code is allowed under Q8, named in the decision
  log.
- Never touch `docs/`, `version.json` or `node_modules/` by hand, nor `_Joe/`
  beyond the three deletions Joe allowed.
- A compatibility export or wrapper lives for at most one wave (§13 rule 7).

**Plan fidelity**
- If evidence shows a row is wrong, patch it with a dated note, say so in the
  wave's decision-log entry, and tell Joe in the handoff. A patch never widens
  what is approved. A defect found on the way is fixed (see What Joe has
  decided); any other new behaviour change becomes a proposed row for Joe and
  is not made in this run.

## The comparative reviewer

**Assume your work has a hole.** On 2026-09-28 Codex (`gpt-6-astra`, Codex
CLI 0.155.1 on Joe's Mac) reviewed DEF-38, DEF-39 and DEF-47 in 20 to 30
minutes each and found a real hole in every test: a read moved between a
`save` and its `try`, a square look that lasted under a zoom, a test wrapper
that hid a leak. In a cloud container, where Codex is unavailable, an
independent Claude agent stood in and found a hole in each of #34 to #43.

- **Codex:** `codex exec -m gpt-6-astra -s workspace-write -C <throwaway-clone> -o <out.md> - < <brief.md>`
  in a clone with **no remote** (`git clone --no-local`, create `main`,
  `git remote remove origin`, copy `node_modules`). Run it in the background,
  never with a bare `&`, so you are told when it ends. Its full report lands
  in the clone (`reviews/<ITEM>-falsification-review.md`); the `-o` file holds
  only its summary.
- **The stand-in:** an agent given the same brief and the same clone rules,
  told where to write its report and that it must not commit or push.
- **If Codex is unavailable or hits a usage limit,** switch to the stand-in
  for that PR without waiting, say so in the PR, and tell Joe in the handoff.
- **A brief that works** says what changed and what the gate reports; points
  at `AGENTS.md` and the plan rows; **numbers the claims to attack**; names
  what you fear most; and asks for a verdict per claim, substantiated by
  `file:line` and probes.
- Reproduce each finding yourself before adopting it; rebut with evidence
  when it is wrong.

## Browser checks

- **Chromium only.** Route Plotter is a Chromium-only app for now (Joe,
  2026-09-28): every check runs in Chromium, and none needs Firefox or Safari.
- **In a cloud container** there is no Browser pane: Playwright's headless
  Chromium stands in. Build `main` and the branch in throwaway clones, serve
  each `docs/` with a small Node server on its own port, and drive the real
  app. Its WebCodecs has VP9 (WebM) but no H.264. An item's frame-for-frame
  export comparison may use WebM there, since the frames come from the same
  render; say so in the PR. The release's MP4 check may not (see The
  release). `page.emulateMedia({ reducedMotion })` fires the app's real
  `matchMedia` listener.
- **On Joe's Mac:**
  - Build a throwaway clone (`npm run build`) and serve it through a
    **temporary** entry in the parent folder's `.claude/launch.json` (the
    session's working folder is the parent folder); restore that file
    byte-identical afterwards (SHA-256 `d29f63e6…`; check it). **Joe has
    allowed this for the whole run** (see What Joe has decided). A session's
    permission mode once refused it ("Unauthorized Persistence") until Joe
    allowed it in that chat: if that happens, quote Joe's permission above and
    ask once. If it stays refused, the browser checks the plan names park
    their items, and the release waits; everything else carries on, using the
    headless route below where it suffices.
  - The headless route: drive the app's own `exportHTML()` with each build's
    `docs/player.js`, parse the embedded project out of the file, load it into
    `PlayerApp` and compare transcripts (#31 shows how).
  - pyenv and the Xcode-stub `python3` fail here; use a small Node server. To
    check an HTML export **as a recipient would**, give the server an upload
    endpoint, capture the export's Blob in the page (stub
    `URL.createObjectURL`, swallow the `<a download>` click), POST it back, and
    open the saved file from a second port. The pane cannot open `file://`
    paths in the scratchpad.
  - **Emulate ≥1440 px before judging anything.** A hidden pane throttles
    `requestAnimationFrame`: step `animationEngine.updateAnimation(dt, ts)` by
    hand, or seek. Exported pages expose `window.__routePlotterPlayer`.

## Traps this programme has already hit

- **Another agent session may be working the same repository.** On
  2026-09-28 a cloud session merged #35 to #45 and rewrote the brief a local
  session had been handed, while that session was starting. Check
  `ListAgents` (cloud sessions show there, not in `list_sessions`) and fetch
  before every write; a branch you mean to fix may move under you.
- **The gate's test worker has about 4.3 GB of heap.** A test that reads
  thousands of frames can crash it ("Worker exited unexpectedly"): each canvas
  kept every call it recorded, and the recorder made a Vitest mock per
  gradient. Both are fixed; `goldenDrawLogs.test.js` still grows its heap as it
  runs (wish-list). Measure with `npx vitest run --pool=threads
  --no-file-parallelism --logHeapUsage`, and split a heavy test into one per
  case so Vitest clears mock history between them.
- **A parallel run exits 1 with every test passed.** The whole suite runs in
  about 15–25 s on Joe's Mac as `npx vitest run --silent` (about 75 s in a
  cloud container), so mutation tables are cheap; but a frame one test booked
  can fire after its environment is torn down (`requestAnimationFrame is not
  defined`, from `AnimationEngine._scheduleFrame`), and Vitest then reports
  `Errors  N errors`. For a mutation run, `--reporter=json
  --outputFile=<file>` gives `numFailedTests` and the failing names. It
  replaces the configured reporters, the min-count canary included, so it
  never stands in for the gate. A timeout, a worker crash, an unhandled error
  or an incomplete collection makes that mutation's result inconclusive
  unless the intended assertion failure is shown against a valid baseline.
  **Guard mutation runs with a watchdog:** a mutation can make a loop infinite
  (DEF-31), and Vitest cannot time out a synchronous hang.
- **The camera** snaps to its target on a seek of more than 0.05 of the route
  and otherwise eases (at 1× it snaps once close). With the test clock frozen
  its zoom rate limiter never moves. To compare two frames at one instant,
  reach each by a seek from another instant (DEF-39's test).
- jsdom's `Image` stub reports 100×100, and loading a background makes the
  export resolution follow it; restore the authored resolution.
- `esbuild` cannot run under jsdom: `// @vitest-environment node`.
- A debounced duration rebuild leaves the timeline at 0 right after a load;
  call `app.invalidateAnimationTiming()` before an export or a timed check.
- `start + (edge − start)` is not always `edge` in floating point; clamp after
  applying a shared delta.
- The vector canvas's base transform lives outside any `save`, set once at
  resize; every other transform is paired inside one frame (DEF-36). The main
  canvas's base transform and smoothing belong to its host (DEF-38). Each
  frame starts the vector layer with round caps and joins (DEF-39).
- In zsh a variable named `path` clobbers `PATH`; `IFS=':'` splits PR titles
  at their colons; `echo =====` fails (a leading `=` expands to a command's
  path).
- **Neighbouring lines conflict.** Two PRs that edit adjacent plan rows or
  file-map rows conflict in git, though they touch different lines, and the
  plan's one-line rows make that common. Check with
  `git merge-tree --write-tree` before merging the second.
- Never `git checkout <rev> -- <file>` in a tree with uncommitted edits: it
  overwrote a test file on 2026-09-28 (recovered from the dangling stash with
  `git fsck --no-reflog`). Time or test another revision in its own clone.
- `pgrep -f "<name>"` matches the shell that runs it, so a `while pgrep` wait
  never ends; write `pgrep -f "[n]ame"`.
- Vitest's `clearMocks` resets calls but restores nothing: restore spies and
  unstub globals in a `finally`.
- Until DEF-44 lands, the paused editor never idles, so a probe that counts
  frames sees about 60 a second even when nothing moves.
- `formatUIValue` rounds positive readouts up and negative ones away from
  zero, whatever its comment says; `tests/sliderScales.test.js` pins both.
- The event bus swallows every listener error (console only): when a UI event
  "does nothing", suspect a throwing handler.

## Long-term health: protect these

- The §8.5 retain list and the §10 "don't abstract" list: visibility modes;
  the save, autosave and undo projections; beacon curves; per-control
  handlers; explicit post-edit pipelines.
- Apply §16 before creating anything new. No permanent parallel paths.
- Leave every touched area truer than you found it. Never add a second copy
  of a fact; link to its owner.

## Working with Joe

Joe is a novice coder who owns macro structure, UX and conceptual design. Do
the work; explain only when asked. Joe prefers momentum: ask nothing this
prompt answers, and collect genuine questions in the ledger and the handoff,
each with a recommended default. Joe's call wins; trust Joe's bug instincts
and reproduce before disputing.

## End every session with a handoff

The current state (`main`'s SHA, open PRs and their states, CI, the live
version); what merged, released or was parked, each parked item with its
question and your recommendation; memory written; plan rows patched; the
metrics at each wave close; the exact next step; and anything waiting on Joe.

**Begin** by verifying the state above, making the clone and the ledger, and
reconciling. For each `<ITEM-ID>:` commit on `origin/main` that memory
doesn't yet record, judge from its merged diff and the row's acceptance
criteria what it completed; a title proves neither completion nor that the
change wasn't reverted. Record it, then take the first runnable item (TST-04,
on the run's first day). Ask Joe nothing this prompt already
answers.

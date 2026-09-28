<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: the big run, W4 to W12, merged as you go

This supersedes `route-plotter-continuation-prompt-open-calls-2026-09-28.md`,
whose calls Joe answered on 2026-09-28; it remains as provenance. Paste
everything below into a fresh chat. It stays the current prompt for every
session of the run until one supersedes it: a session that picks the run up
again starts from the last handoff, the backlog and the open pull requests.

You are continuing an adopted refactoring programme for Route Plotter v3, in
a **long, low-gate run**. W0, W1 and W2 are closed, and W2's fixes are live as
v3.2.692. The post-W2 queue, W3's pilot and their follow-ups are merged on
`main`, unreleased. **Joe has answered every open call and, for this run,
delegated to you the merges and the planned behaviour changes** (decision
log, 2026-09-28, "the big run"). Your job: take the backlog's `### Next`,
then plan waves W6 to W12 as their prerequisites merge, one item per pull
request, each reviewed and, once it clears the merge bar below, merged by
you. Close each wave in project memory. Park whatever needs Joe and keep
going. Release once, at the end.

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3` — Joe's. Read it; never write it.

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and
the repository disagree, the repository wins, and you tell Joe.

## Purpose

The programme makes the codebase **auditable and safe to change with AI
assistance** without changing what users see, apart from the defects Joe has
approved. The strategy is still *pin, then prune, then clarify, then
consolidate. Never rewrite.* This run is measured by merged work that is
reviewed and provably behaviour-preserving, not by its pull-request count. One
wave done well beats three done loosely.

## What Joe has decided — don't ask again

The decision-log entry "the big run" (2026-09-28) is the authority; this is
its summary.

- **The open calls.** DEF-28 takes option A: announce the failed restore and
  show a notice with **Download it** and **Discard**, and move the record to a
  second storage key that autosave never writes, until the author chooses.
  DEF-40 to DEF-46 are accepted, each by its plan row's first remedy: P2 for
  DEF-40, 41, 44 and 46; P3 for DEF-42, 43 and 45. TST-04 lands before W4,
  and W4's characterisation mutates every branch of each moved function and
  accounts for every survivor.
- **You merge your own pull requests** when they clear the merge bar. One
  that doesn't stays open for Joe, and the run moves on.
- **Planned defects are approved in advance.** An open plan row's stated
  treatment is its approved behaviour, and so are the §20 choices of
  2026-09-22 that change behaviour: Q10 (one intro curve and time base), Q11
  (anchored crowd nodes can't be dragged, and say so), Q12 (a saved 0 stays
  0), Q13 (the drone image ships only when used), Q18 (a future-version file
  opens for viewing, not editing) and Q19 (the UI's ranges are the true
  ones). Each of those becomes its own PR with a DEF row marked decided.
  Every defect PR still states its new behaviour.
- **Every §20 default** was accepted on 2026-09-22, and the plan rows that
  still read "owner decides" now carry a dated note saying so. Earlier calls
  stand: a `null` Graphics scale means 1× (DEF-37), round caps and joins
  (DEF-39), the preview's blue (DEF-47), branches named for their item, and
  pull requests watched once opened.
- **Budgets.** At a wave close you may archive the trajectory's oldest phases,
  keeping any phase that feeds open work (Joe's prune bar, decision log
  2026-08-27). The decision log stays over its entry budget by Joe's choice.
  Wish-list triage stays Joe's: append lines, never triage.
- **One release, at the end of the run** (below). Firefox and Safari
  evidence stays Joe's.

## What still goes to Joe — park it, don't stop

To park: leave the pull request (if there is one) open, with a first line
`Waiting on Joe: <the question, and your recommendation>`; put it in the
ledger and the handoff; carry on with whatever doesn't depend on it.

- **DEF-07's camera feel.** Build it, attach side-by-side captures (the same
  instants on `main` and the branch, played and exported), and park it.
  ABS-03 waits for it.
- **Behaviour beyond a row's treatment,** or evidence that a row is wrong in a
  way that changes what users see: patch the row with a dated note, propose,
  park.
- **Defects found on the way** become proposed DEF rows (plan §12.1, the next
  free number) with their evidence. They are never fixed in this run.
- **CON-01's two UI-only defaults** (`wiringBus.js:300` and
  `sceneOutline.js:867` at `2e4d78e`): keep today's values, so the PR
  preserves behaviour. If that proves impossible, park it with the values
  stated.
- **Anything in `_Joe/`:** DEL-07's scripts, and the dev-guide file itself
  once DOC-08 has moved its valid parts out and retired the read. Also
  whether Devin and Windsurf are still used (`.devin/`, `.codeiumignore`).
- **Owner-run evidence:** REV-03, REV-04 (Firefox, Safari) and REV-05. List
  any manual browser check you cannot run in its PR; it does not block the
  merge.
- **A new runtime dependency,** any change to repository settings, rulesets
  or the Pages source, and anything else outside the authority.

## Where things stand (verify first; it may have moved)

Check with `git fetch` then `git log -1 origin/main`; the Pages source and
latest build; the last CI runs; the open pull requests (`gh` on Joe's Mac, the
GitHub MCP tools in a cloud container, which has no `gh`); a read-only
`git status` in the OneDrive copy; and whether another agent session is
working the repository (`ListAgents`; see Traps).

- **`main`** ends with #51, which refactored the backlog and added this
  prompt, on `ac80222` (#50). **If #51 is not merged, stop and ask Joe: the
  authority begins with its decision-log entry on `main`.** `main` is
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

The backlog's `### Next` holds 30 items; each plan row is its item's detail.
TST-04 and three other tests unblock the most, so a sensible order is:

1. **TST-04** first (it gates W4, DEF-14, DEF-19 and DEF-20), one golden
   family per PR: control→bus for every control, then model→control state per
   selection path, readouts included (the pilot found nothing checks them).
   Pin observable end state, not call counts.
2. **The ready defects,** interleaved with W5: DEF-28, DEF-44, DEF-46,
   DEF-40, DEF-41, then DEF-42, DEF-43, DEF-45.
3. **TST-13, TST-05 and TST-09,** then TST-03, TST-08, TST-11, TST-14 and
   TST-16.
4. **W4** as soon as TST-04's readout goldens merge; DEL-05 also waits for
   TST-13.
5. **The defects waiting on a W5 test,** as each test merges.
6. **Then the later waves.** Each enters `### Next` at a close-out, once its
   prerequisites have merged:

| Wave | Enters when | Items (plan §13) |
| --- | --- | --- |
| W6 | W4 and TST-05 have merged | CLR-02 with DEF-16; ISO-01; ISO-03; ISO-04; DEP-01; DEP-02 |
| W7 | TST-09 has merged, with the branched and intro/tail fixtures §13 W7 names | DOC-04; DOC-05; ABS-01 with DEF-12; ABS-02 with DEF-05 |
| W8 | W6 and W7 have closed | CON-04; CON-07; CON-11 with DEF-04; CON-06, then DEP-05; CON-05 with DEF-24; CON-10; CON-12; CON-13; CON-09; CON-14 with Q19; DEF-06; DEF-09; DEF-25; DEF-27; Q11; Q12; Q13 |
| W9 | W8 has closed | CON-01; CON-02; CON-03; CLR-01; SPL-02; DEP-03, then SPL-03, then ABS-06 with Q18; SPL-04; SPL-06; DEP-04 |
| W10 | W7 has closed | DEF-10; CON-08 with DEF-11; Q10; DEF-07 (parked for Joe); ABS-03 once DEF-07 merges |
| W11 | W6 to W10 are done | the compatibility exports and wrappers they left; the `setSelectedWaypoint` shim; deprecated aliases |
| W12 | W11 is done | GOV-03; GOV-02 (after DOC-08's link fixes); TST-12; TST-15; DOC-07; DOC-08 outside `_Joe/`; `AGENTS.md` pointers to plan §15 and §16 |

- CON-15 joins once DEL-05 and TST-13 have merged. The P3 rows (CLR-03,
  ISO-05, SPL-05, SPL-07, SPL-08, ABS-04, ABS-05, CLR-04) come after W12 if
  the run gets there, each only if §16 still justifies it. SPL-09 stays
  deferred.
- When a wave waits only on a parked item, take the parts of later waves that
  don't depend on it.
- Keep `### Next` within the Active budget (`pm_skills/memory-policy.md`):
  promote a wave's rows when it enters, not before.

**Notes that cross items:**
- DEF-28 and DEF-45 both touch what recovery announces: do DEF-28 first, and
  let DEF-45's queue carry its message.
- DEF-28 adds a storage key: name it in `constants.STORAGE` beside
  `AUTOSAVE_KEY`, and add it where `README.md` describes autosave.
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
  inventory (`tooltip.css`): update `build.js` and
  `publicationBoundary.test.js` deliberately, and merge its CSS deletions only
  with a before/after screenshot comparison, or park them.
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
6. **Goldens:** regenerate only those the change means to move, and read the
   diff.
7. **Review** (see The comparative reviewer) in the background. While it runs,
   start the next item that touches different files, in a second clone: at
   most one item in implementation and two in review.
8. **Fix or rebut** each finding with evidence, re-run the mutation it used,
   and push.
9. **Open the pull request.** Title `<ITEM-ID>: summary`. The body: the
   behaviour statement (a defect) or the preserved contract (a refactor: no
   `window.*` global, DOM id, EventBus event or persisted format changed); the
   evidence; the mutation table; which reviewer ran and what it found; the
   manual checks left for Joe; and the merge bar, ticked.
10. **Merge or park.** After a merge, update the ledger and merge `main` into
   any open branch that touches the same files.

## The merge bar

Merge only when **all** of these hold, with
`gh pr merge <n> --squash --delete-branch --match-head-commit <sha>` (the SHA
from `git rev-parse`, never typed from a short one):

- **Verify** is green on that head. By the time a review is back it has
  usually finished: read its result once, and if it is still running, work on
  something else and come back. Don't poll it in a loop.
- `npm run check` passes on the branch with the current `main` merged in.
- The independent review ran, and every finding is fixed or rebutted with
  evidence in the PR.
- The diff has no `docs/` or `version.json`.
- The goldens moved only as the PR states: byte-identical for a
  behaviour-preserving PR; only the named cells for a defect.
- A defect PR's behaviour is within its row's approved treatment, or a call
  Joe made above.
- Nothing in it waits on Joe.

`PM:` close-outs need only the gate and Verify. **If `main` goes red after a
merge,** open a revert PR at once, merge it when green, and park the item
with the failure.

## Wave close-outs (you are the single memory writer)

An item's PR touches only its own plan row (a dated note of what was done),
the `file-map.md` rows for files it adds or removes, and wish-list lines.
Everything else waits for a `PM:` close-out PR, **at each wave's end and at
least every ten merged PRs**, so memory never lags far behind `main`:

- **Backlog:** remove merged items, promote the next runnable rows, and keep
  every gate flag honest. A gate is a claim, so check it.
- **Plan:** each merged row gets `Shipped <date> (<wave>, PR #N; unreleased)`;
  proposed rows are added; each wave gets its `Status` line.
- **Decision log:** one entry per wave, not per batch. Give each PR's stated
  behaviour or preserved contract, what the reviews found, the §18 metrics
  (open defects, tests, golden diffs, dependency edges changed, test wall
  time, peak heap) and the budgets. Tests deleted under Q8 are each named with
  their dead symbol. Keep an entry under 600 words, and never edit an old
  one.
- **Trajectory:** one line per shipped item, starting with its ID. Past 2,000
  words, archive the oldest phases to `archive/trajectory/` and keep
  `archive/INDEX.md` current, leaving any phase that feeds open work.
- **File-map:** a row for every new file and the counts corrected. **Never run
  `gen-file-map.mjs`.** Recount after merges.
- **The min-count canary** (`tests/helpers/minCountReporter.js`, still 72
  files / 1,000 tests): raise it as the suite grows; never lower it.

## The release, at the end

When every runnable item is merged or parked, or when the run must end, and
`main` is green, release once by `DEV-INFRASTRUCTURE.md` → Deployment, steps 1
to 8, in a fresh clone:

- **Pre-flight:** the Pages source is `main` `/docs` and the latest build is
  `built` at the SHA you expect; stop if either differs. That build's `docs/`
  and `version.json` should be identical to tag `v3.2.692`'s (`git diff
  --quiet v3.2.692 <live SHA> -- docs version.json`), so that tag stays the
  rollback point, as it did at the last release; if they differ, stop.
- `npm run check`, then `npm run push:dry-run`, then `npm run push`; note the
  deploy commit.
- **Confirm:** Verify on the deploy commit; the `github-pages` deployment at
  that SHA; every published file's SHA-256 against `docs/`.
- **Smoke test** the published bytes served locally, so the live site's
  storage is never touched: load to ready (the title shows the new version),
  play a built-in example, export HTML and open it as a recipient would, and
  export video where the browser can encode it. Record what the environment
  cannot run (an MP4 export in a cloud container) in the release entry as
  Joe's.
- **Any failure:** roll back by DEV-INFRASTRUCTURE, check the restored site
  the same way, then stop and report.
- **Tag** the deploy commit `v3.2.<build>` (annotated, from `package.json` and
  the pushed `version.json`) and push that one tag.
- **Record it** in a `PM:` PR: the release's own decision-log entry, listing
  every user-visible change since v3.2.692 (#31 on), Q12's effect on old files
  that saved a 0, and what was verified and what stays Joe's; its trajectory
  phase; REV-04's Chromium evidence if you re-ran it.

## Stop the whole run only when

- `main`'s gate cannot be made green again by a revert;
- another session is changing the repository (commits, branches or pull
  requests that aren't yours): stop, report, wait;
- a step would need a force-push, a history rewrite, a settings or ruleset
  change, or `docs/` or `version.json` changed outside `npm run push`;
- the release needed a rollback;
- Joe says so.

Everything else is parked, not stopped. The plan's stop-and-re-plan
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
  The close-outs make the repository the durable record: a later session
  resumes from the last handoff, the backlog and the open pull requests.

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole;
   the backlog Active section; the latest decision-log headings, starting with
   "the big run" and the other 2026-09-28 entries.
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
- Never touch `docs/`, `_Joe/`, `version.json` or `node_modules/` by hand.
- A compatibility export or wrapper lives for at most one wave (§13 rule 7).

**Plan fidelity**
- If evidence shows a row is wrong, patch it with a dated note, say so in the
  wave's decision-log entry, and tell Joe in the handoff. A new behaviour
  change becomes a proposed DEF row for Joe; it is not fixed in this run.

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

- **In a cloud container** there is no Browser pane: Playwright's headless
  Chromium stands in. Build `main` and the branch in throwaway clones, serve
  each `docs/` with a small Node server on its own port, and drive the real
  app. Its WebCodecs has VP9 (WebM) but no H.264, so an MP4 export stays a
  manual check; `page.emulateMedia({ reducedMotion })` fires the app's real
  `matchMedia` listener.
- **On Joe's Mac:**
  - Build a throwaway clone (`npm run build`) and serve it through a
    **temporary** entry in the parent folder's `.claude/launch.json` (the
    session's working folder is the parent folder); restore that file
    byte-identical afterwards (SHA-256 `d29f63e6…`; check it). Joe allowed
    this on 2026-09-24, but a later session's permission mode refused it
    ("Unauthorized Persistence") until Joe allowed it in that chat. **If it is
    refused, don't wait:** use the headless route and list the check in the
    PR for Joe. The one exception is the release's smoke test: ask Joe once in
    the chat, because a real browser is worth waiting for there.
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
  `Errors  N errors`. Read the result, not the exit code:
  `--reporter=json --outputFile=<file>` gives `numFailedTests` and the failing
  names. **Guard mutation runs with a watchdog:** a mutation can make a loop
  infinite (DEF-31), and Vitest cannot time out a synchronous hang.
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
starting TST-04. Ask Joe nothing this prompt already answers.

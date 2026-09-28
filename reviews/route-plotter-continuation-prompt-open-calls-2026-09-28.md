<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: Joe's open calls, after the post-W2 follow-ups

This supersedes `route-plotter-continuation-prompt-2026-09-28.md`, which
briefed DEF-38 and DEF-39 and remains as provenance: both merged on
2026-09-28, with DEF-47, which their reviews found. Paste everything below
into a fresh chat.

You are continuing an adopted refactoring programme for Route Plotter v3.
**W0, W1 and W2 are closed, and W2's fixes are live as v3.2.692. The post-W2
queue, W3's pilot and their follow-ups (DEF-38, DEF-39, DEF-47) are merged on
`main` and recorded in project memory, and none of it is released yet.
Nothing is ready to start: every next step waits on a call only Joe can
make.** Your job now: put those calls to Joe, few and concrete, each with its
recommended default; then take DEF-28 once Joe has made its design call, and
whatever Joe accepts of the proposed rows DEF-40 to DEF-46 and of TST-04. A
release happens only when Joe calls one.

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and
the repository disagree, the repository wins, and you tell Joe.

## Purpose

The programme makes the codebase **auditable and safe to change with AI
assistance** without changing what users see, apart from defects Joe approves
one by one. The strategy is still *pin, then prune, then clarify, then
consolidate. Never rewrite.*

## Where things stand (verify all of this first; it may have moved)

Check with `git fetch` then `git log -1 origin/main`; the Pages source and
latest build; the last CI runs; the open pull requests (`gh` on Joe's Mac,
the GitHub MCP tools in the cloud container, which has no `gh`); a read-only
`git status` in the OneDrive copy; and whether another agent session is
working the same repository (see Traps).

- **`main`** ends with this prompt's own merge, on the follow-ups' close-out
  (#49), DEF-47 (#48), DEF-39 (#47) and DEF-38 (#46), all squash-merged on
  Joe's word on 2026-09-28, after the post-W2 queue and W3's pilot (#31 to
  #45). **Verify** green. Protected: no force-push, no deletion. No pull
  request was left open, and every merged pull request's branch was deleted
  (each can be restored from its pull request's page); `main` and the frozen
  `review-remediation` remain.
- **Live: v3.2.692** (`14e3656`, tag `v3.2.692`), served by GitHub Pages from
  `main` `/docs`. Everything merged since (#31 onwards) is **not live**.
  Rollback tags: `v3.2.689`, `v3.2.690`, `v3.2.691`, `v3.2.692`.
- **Gate on `main`:** `npm run check` → 86 test files · 1,259 tests · 2 todo ·
  shell 0 · build:check 0 (2026-09-28). On Joe's Mac the test run takes
  76–81 s and peaks at about 1.8 GB of heap; the cloud container took 166 s
  before the follow-ups.
- **What merged on 2026-09-28**, each PR body holding its behaviour
  statement, evidence, mutation table and review: the post-W2 queue (#35 to
  #42), SPL-01, W3's pilot (#43), their close-out (#44) and prompt (#45), then
  DEF-38 (#46), DEF-39 (#47), DEF-47 (#48) and their close-out (#49).
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`.
  Joe accepted all 22 §20 defaults on 2026-09-22. On 2026-09-24 Joe approved
  DEF-34 and accepted DEF-35, DEF-36, TST-17 and DEF-37 (a `null` Graphics
  scale means 1×). On 2026-09-25 Joe accepted DEF-38 (P2) and DEF-39 (P3,
  keeping the round caps and joins), allowed branches named for their item,
  and asked for the pull requests to be watched. On 2026-09-28 Joe accepted
  DEF-47 with the preview's own blue. **DEF-40 to DEF-46 are proposed**,
  awaiting Joe. Check §20 and the decision log before telling Joe anything
  needs a decision.
- **Line references in the plan are at `2e4d78e`** unless a dated note says
  otherwise, and `src/` has moved. Re-verify every reference before relying
  on it.
- **The OneDrive copy** was brought up to `main` on Joe's word when the
  session that wrote this prompt closed; check it read-only. Other sessions
  may use it: pause before writing anything there.

## What waits on Joe

Project memory is current: the close-outs (#44, #49) removed the merged items
from the backlog, marked their plan rows shipped (unreleased) and wrote
decision-log entries and trajectory phases. The backlog's `### Next` holds
only DEF-28, gated on Joe. These are Joe's, each with a recommended default;
ask the ones this chat has not already answered:

1. **DEF-28:** what an author sees when a session cannot be restored. Options
   in #44's description: **A** (recommended) announce it and show a notice
   with **Download it** and **Discard**, keeping the record under a second
   storage key that autosave never writes until the author chooses; **B**
   announce it and move the record aside silently; **C** announce it and pause
   autosave until the author chooses.
2. **DEF-40 to DEF-46:** accept, change or decline each. Suggested: P2 for
   DEF-40, DEF-41, DEF-44 and DEF-46; P3 for DEF-42, DEF-43 and DEF-45.
3. **TST-04 before W4**, to guard the sidebar's readouts, which the pilot
   showed nothing checks.
4. **W4's characterisation step:** add "mutate every branch of each moved
   function and account for every survivor", the pilot's lesson.
5. **Budgets,** reported and proposed, never pruned without Joe: the
   decision log is 30 of 20 live entries (Joe's standing choice); the
   wish-list 35 of 25 open items (a triage pass is proposed); the trajectory
   2,159 of 2,000 words (archiving its oldest phases is proposed).
6. **A release,** whenever Joe wants #31 onwards live.

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole;
   the backlog Active section; the latest decision-log headings (start with
   "W2 closes", then the three 2026-09-28 entries above it).
2. **From the plan, only what the current item needs:** its §12.1 or §12.2
   row; §13 ground rules; §17 (testing); §18 (metrics); §20 before calling
   anything open; §2.9 for the round-2 browser probes; §14 before W4.
3. **`DEV-INFRASTRUCTURE.md`** (Quality gate, Runtime lifecycle, Deployment)
   and **`pm_skills/memory-policy.md`**, whenever you touch releases or
   memory.

## The work in order

1. **Ask Joe what waits on Joe** (above), unless this chat already carries
   the answers.
2. **DEF-28,** once Joe has chosen what an author sees. Characterise first,
   as always.
3. **Whatever Joe accepts** of DEF-40 to DEF-46 and TST-04, in the order Joe
   gives. Accepted rows enter `### Next`; nothing else does.
4. **Memory:** the budget proposals above, only with Joe's word.
5. **A release,** only when Joe calls one (`DEV-INFRASTRUCTURE.md` →
   Deployment). It records itself with its own decision-log entry.

## The safety net — use it, do not rebuild it

- **`tests/helpers/bootApp.js`** boots the real app: `const app = await
  bootApp(); await app.ready;`. It does not await `ready` for you. **Every app
  booted in a file leaves its `document` keydown listener behind**, so a
  second app in the same file loses keys to the first: call
  `app.interactionHandler.handleKeyDown(event)` directly
  (`tests/helpTellsTheTruth.test.js` shows how). Spy on `eventBus.emit` with
  `mockImplementation` when you only need to know what a key *asks for* — ⌘S
  delivered for real opens the save dialog, which overflowed the stack under
  jsdom (unexplained; see the wish-list).
- **`tests/helpers/projectSnapshot.js`** — `freezeClock()`, `loadSnapshot()`
  (the real recovery path), `LOAD_REFUSED`, `comparableSnapshot()`.
- **`tests/helpers/drawLog.js`** — one transcript across every canvas:
  `frameAt`, `takeFrame`, `discardFrame`, `setUpFrame`, `differingLines`.
  Since TST-17 a composited canvas carries its surface's label; a surface the
  transcript does not know appears as `other#<id>`, and the goldens reject
  it. Two views of state: `takeFrame(host, { state: true })` ends each line
  with the full state its call was made in (transform, open saves, styles;
  DEF-36), and `{ state: 'drawn' }` with only what a marking call draws with
  (DEF-39), to compare frames by what they draw while a style no call uses
  differs. It sees no clip region, pattern smoothing, `putImageData` or
  text spacing, and nothing in `src/` uses them. `takeFrame` also drops the
  frames it takes from the canvases' own transcripts (DEF-38; see Traps).
- **`tests/goldenDrawLogs.test.js`** — four fixtures × five instants × three
  modes, `play == seek`, `app == player` (including `authored-extras` at its
  authored Graphics scale 1.6), the DEF-34 regression at scales 0.5, 1.6 and
  8, a check that every frame composites `[canvas vector]` onto `main`, and a
  pixel-density-2 composite test. **Fixed defects stay fixed:** DEF-36 and
  DEF-38 throw at every call a frame makes on the vector layer or the main
  canvas (and, for DEF-38, at every read of the background pass's inputs:
  `renderThrowingAtRead`); DEF-39 draws every instant four ways (steady,
  after another instant, after leftover caps and joins, on a freshly sized
  layer); DEF-47 checks the area-drawing preview's blue. The shared helpers
  are `surfaceCalls`, `deepestSave` and `renderThrowingAt(host, surface,
  index)`. DEF-38's test shows how to run the player at its display size
  (give its canvas a sized parent, then `player.resize()`). Still unseen, on
  the wish-list: a path-only export (`enterMode('export')` skips the step that
  hides the background).
- **`tests/fixtures/authoredExtras.js`** — the every-field fixture; still no
  `pop` beacon. DEF-08 drew its scaling cases on Open day instead, because the
  fixture's `pathTrail` of 640 puts its later instants past every beacon
  window (on the wish-list).
- **`tests/goldens/`** — regenerate deliberately with
  `UPDATE_SNAPSHOT_GOLDENS=1` / `UPDATE_DRAW_GOLDENS=1`, then justify every
  changed cell in the PR.
- **`tests/helpers/consoleGuard.js`** — undeclared console output fails its
  test; declare with `allowConsole(/…/)`.
- **`tests/helpers/minCountReporter.js`** — its floor is still 72 files /
  1,000 tests against a suite of 86 / 1,259; raise it as the suite grows,
  never lower it.
- **From W2:** `tests/shortHexGlow.test.js` has a manual
  `requestAnimationFrame` harness for frame-by-frame scheduling tests;
  `tests/exportMinimisation.test.js` drives the real `saveProject()` and
  `exportHTML()` and reads the blobs back; `src/utils/imageCoordinates.js`
  and `boundedEntityId` (`src/utils/entityId.js`) are the one rule each for
  image-point ranges and derived ids.
- **From the post-W2 queue:** DEF-29's tests run the app's real
  `exportVideo()` with only the encoder replaced (`app.videoExporter`
  stubbed, `VideoExporter.downloadBlob` spied, both restored in `finally`);
  DEF-37's round-trip a real `.zip` through Open Project (`exportZip`, then
  `loadProject`); DEF-33's record every announcement by spying on `announce`,
  because the live region clears itself after 2 s; and
  `tests/sliderScales.test.js` pins the slider maths value for value.

The only `todo`s left are DEF-04's two, in `authorableLoadable.test.js`,
each beside an active test that asserts today's broken behaviour; DEF-04 is
not scheduled. When you meet that pattern: turn the active test into a
regression, keep its reproduction, retire the `todo`, and watch it fail for
the right reason before touching `src/`.

## Standing rules (non-negotiable)

**Environment**
- Work in a **fresh full clone outside OneDrive**, never `--single-branch`.
  The session scratchpad can be wiped between days: re-clone rather than
  assume.
- The OneDrive copy is Joe's, and other sessions may be in it. **Pause before
  writing anything there.**
- Never run `npm run dev`, `npm run build` or `scripts/restart.sh` as a check.
  The gate is `npm run check`, which is non-mutating.

**Git and releases** — the authority is `AGENTS.md` → Commit, push and
release, and `DEV-INFRASTRUCTURE.md` → Deployment.
- One concern per PR, on a short-lived branch from `main`, named for its
  item, opened with `gh pr create` on Joe's Mac or the GitHub MCP tools in the
  cloud container. CI (`Verify`) must be green. **Always base a PR on
  `main`.**
- **Never commit to or push `main` except** merging a PR Joe has told you to
  merge, and `npm run push` for a release Joe has called. Approving a merge
  does not call a release.
- **Parallel PRs collide on shared lines**: `file-map.md`'s header counts, a
  test file's header, `wish-list.md`'s last line (#31 and #32 met there;
  keep both sides). Identical edits on both sides merge "cleanly" and
  *wrongly* (two PRs that each bump a count from 331 to 332 leave 332). After
  a batch of merges, recount. Neighbouring lines conflict too (see Traps).
- **Commit messages:** `<ITEM-ID>: summary`, one what/why line, then
  `Verify: <F> test files · <T> tests · shell 0 · build:check 0`.

**Behaviour**
- Each DEF PR states its new behaviour for Joe and changes only the golden
  cells it means to. Behaviour-preserving PRs leave the goldens
  byte-identical. A test that pinned the old behaviour changes with the
  stated behaviour and is listed in the PR — never silently.
- Never touch `docs/`, `_Joe/`, `version.json` or `node_modules/` by hand.

**Memory** (`pm_skills/project/`, single writer)
- One decision-log entry per wave; releases get their own. Don't edit old
  entries. One trajectory line per shipped item, starting with its ID.
- The backlog `### Next` is the schedulable queue; keep its flags honest —
  a gate is a claim, so check it.
- Add a `file-map.md` row for every new file and correct the counts. **Never
  run `gen-file-map.mjs`.**
- Budget overruns are reported and proposed, never pruned without Joe; the
  owner's prune bar (decision log, 2026-08-27) outranks the prune-to targets.

**Plan fidelity**
- If evidence shows a row is wrong, patch it with a dated note, say so in the
  wave's decision-log entry, and tell Joe. Any *new* behaviour change becomes a
  proposed DEF row for Joe first (DEF-47 went that way).

## How to run each PR

1. **Characterise first**, and watch the test fail for the right reason.
2. Make the smallest change.
3. `npm run check`, plus targeted tests. **Prove every new test can fail**:
   run a mutation per fix site from a script that restores the file
   afterwards (and checks it by SHA-256), and record what caught each. The
   whole suite runs in about 15–25 s on Joe's Mac as `npx vitest run
   --silent` (about 75 s in the cloud container) — files in parallel, unlike
   the gate's serial `npm test` — so a mutation table is cheap. **Read the
   result, not the exit code**: in a parallel run a frame one test booked can
   fire after its environment is torn down (`requestAnimationFrame is not
   defined`, from `AnimationEngine._scheduleFrame`), and vitest then reports
   `Errors  N errors` and exits 1 with every test passed (on the wish-list).
   `--reporter=json --outputFile=<file>` gives you `numFailedTests` and the
   failing names to script against. **Guard mutation runs with a watchdog**:
   a mutation can turn a loop infinite (it did in DEF-31), and a synchronous
   hang cannot be timed out by Vitest.
4. Regenerate only the goldens the change means to move, and read the diff.
5. Where a user sees the result, run the matching §2.9 browser probe.
6. **The comparative review** (below), then fix or rebut with evidence, and
   re-run the mutation it used.
7. Open the PR with the behaviour statement, the evidence and the review.
8. Joe decides the merge. When Joe says merge: check CI is green, squash with
   `gh pr merge --squash --match-head-commit <sha>`, where the SHA comes from
   `git rev-parse`, never typed from a short one.

**At a wave's close:** all PRs merged; Joe decides the release; one
decision-log entry, trajectory lines, the next wave into `### Next`, the §18
metrics.

**Stop and re-plan when** a §14.6 invalidation condition appears, a golden
cannot be made deterministic, a wave runs past about twice its PR estimate, a
plan finding proves wrong in a way that changes sequencing, or Joe changes
direction.

## The comparative reviewer

**Codex (`gpt-6-astra`, Codex CLI 0.155.1) works on Joe's Mac.** On
2026-09-28 it reviewed DEF-38, DEF-39 and DEF-47 in 20 to 30 minutes each and
found a real hole in every test: a read moved between a `save` and its `try`,
a square look that lasted under a zoom, a test wrapper that hid a leak. In
the cloud container, where Codex was unavailable, an independent Claude agent
stood in and found a hole in each of #34 to #43. **Assume your work has a
hole like that.**

- Codex: `codex exec -m gpt-6-astra -s workspace-write -C <throwaway-clone> -o <out.md> - < <brief.md>`
  in a clone with **no remote** (`git clone --no-local`, create `main`,
  `git remote remove origin`, copy `node_modules`). Run it in the background,
  never with a bare `&`, so you are told when it ends. Its full report lands
  in the clone (`reviews/<ITEM>-falsification-review.md`); the `-o` file
  holds only its summary.
- The stand-in: an agent given the same brief and the same clone rules, told
  where to write its report and that it must not commit or push.
- A brief that works says what changed and what the gate reports; points at
  `AGENTS.md` and the plan rows; **numbers the claims to attack**; names what
  you fear most; and asks for a verdict per claim, substantiated by
  `file:line` and probes.
- Reproduce each finding yourself before adopting it; rebut with evidence
  when it is wrong. Say in the pull request which reviewer ran, and offer
  Codex's view when the stand-in ran. If a reviewer hits a usage limit, ask
  Joe; don't wait silently.

## Browser checks

- **In the cloud container** there is no Browser pane: Playwright's headless
  Chromium stands in. Build `main` and the branch in throwaway clones, serve
  each `docs/` with a small Node server on its own port, and drive the real
  app. Its WebCodecs has VP9 (WebM) but no H.264, so an MP4 export stays a
  manual check; `page.emulateMedia({ reducedMotion })` fires the app's real
  `matchMedia` listener.
- **On Joe's Mac:**
  - Joe allowed the temporary parent-folder `.claude/launch.json` entry on
    2026-09-24, and DEF-34 used it (vector pixels 153,827 → 525,136 at 2×).
    In that session the `preview_start` was first refused by the permission
    mode ("Unauthorized Persistence") until Joe allowed it in the chat, so
    **ask Joe in the session before relying on the pane**, and keep the
    headless route ready: drive the app's own `exportHTML()` with each build's
    `docs/player.js`, parse the embedded project out of the file, load it into
    `PlayerApp` and compare transcripts (#31 shows it).
  - Build a throwaway clone (`npm run build`), then serve it through a
    **temporary** entry in the parent folder's `.claude/launch.json` (the
    session cwd is the parent folder), and restore that file byte-identical
    afterwards — it is at SHA-256 `d29f63e6…` now; check it. pyenv and the
    Xcode-stub `python3` fail here; use a small Node server.
  - To check an HTML export **as a recipient would**: give the server an
    upload endpoint, capture the export's Blob in the page (stub
    `URL.createObjectURL`, swallow the `<a download>` click), POST it back, and
    open the saved file from a second port. The Browser pane cannot open
    `file://` paths in the scratchpad.
  - **Emulate ≥1440 px before judging anything.** A hidden pane throttles
    `requestAnimationFrame`: step `animationEngine.updateAnimation(dt, ts)` by
    hand, or seek. Exported pages expose `window.__routePlotterPlayer`.
- DEF-38, DEF-39 and DEF-47 each list a short manual browser check in their
  PR; none was run.

## Traps this programme has already hit

- **Another agent session may be working the same repository**: on
  2026-09-28 a cloud session merged #35 to #45 and rewrote the brief a local
  session had been handed, while that session was starting. Check
  `ListAgents` (cloud sessions show there, not in `list_sessions`) and
  `git fetch` before every write; a branch you mean to fix may move under
  you.
- **The gate's test worker has about 4.3 GB of heap.** A test that reads
  thousands of frames can crash it ("Worker exited unexpectedly"): each
  canvas kept every call it recorded, and the recorder made a Vitest mock per
  gradient. Both are fixed; `goldenDrawLogs.test.js` still grows its heap as
  it runs (wish-list). Measure with `npx vitest run --pool=threads
  --no-file-parallelism --logHeapUsage`, and split a heavy test into one per
  case so Vitest clears mock history between them.
- **The camera** snaps to its target on a seek of more than 0.05 of the route
  and otherwise eases (at 1× it snaps once close). With the test clock frozen
  its zoom rate limiter never moves. To compare two frames at one instant,
  reach each by a seek from another instant (DEF-39's test).
- jsdom's `Image` stub reports 100×100, and loading a background makes the
  export resolution follow it; restore the authored resolution.
- `esbuild` cannot run under jsdom: `// @vitest-environment node`.
- A debounced duration rebuild leaves the timeline at 0 right after a load;
  call `app.invalidateAnimationTiming()` before an export or a timed check.
- `start + (edge − start)` is not always `edge` in floating point; clamp
  after applying a shared delta.
- The vector canvas's base transform lives outside any `save`, set once at
  resize; every other transform is paired inside one frame (DEF-36). The
  main canvas's base transform and smoothing belong to its host (DEF-38).
  Each frame now starts the vector layer with round caps and joins (DEF-39).
- In zsh a variable named `path` clobbers `PATH`; `IFS=':'` splits PR titles
  at their colons; `echo =====` fails (a leading `=` expands to a command's
  path).
- **Neighbouring lines conflict.** Two pull requests that edit adjacent plan
  rows or file-map rows conflict in git, though they touch different lines,
  and the plan's one-line rows make that common. Check each pair with
  `git merge-tree --write-tree` before giving Joe a merge order.
- Never `git checkout <rev> -- <file>` in a tree with uncommitted edits: it
  overwrote a test file on 2026-09-28 (recovered from the dangling stash with
  `git fsck --no-reflog`). Time or test another revision in its own clone.
- `pgrep -f "<name>"` matches the shell that runs it, so a `while pgrep` wait
  never ends; write `pgrep -f "[n]ame"`.
- Vitest's `clearMocks` resets calls but restores nothing: restore spies and
  unstub globals in a `finally`.
- The paused editor never idles today (DEF-44), so a probe that counts frames
  sees about 60 a second even when nothing moves.
- `formatUIValue` rounds positive readouts up and negative ones away from
  zero, whatever its comment says; `tests/sliderScales.test.js` pins both.

## Long-term health: protect these

- The §8.5 retain list and the §10 "don't abstract" list: visibility modes;
  the save, autosave and undo projections; beacon curves; per-control
  handlers; explicit post-edit pipelines.
- Apply §16 before creating anything new. No permanent parallel paths.
- Leave every touched area truer than you found it. Never add a second copy
  of a fact; link to its owner.

## Working with Joe

Joe is a novice coder who owns macro structure, UX and conceptual design. Do
the work; explain only when asked. Ask only what is genuinely Joe's to
decide, few and concrete, each with a recommended default — check §20 and the
decision log first. Joe's call wins; trust Joe's bug instincts and reproduce
before disputing. Short updates while you work; Joe prefers momentum.

## End every session with a handoff

The current state (`main` SHA, open PRs, CI, live version); what merged or
released; memory written; plan rows patched; metrics deltas at a wave close;
the exact next step; and any question waiting on Joe.

**Begin** by verifying the state above, making the clone, and asking Joe
what waits on Joe.

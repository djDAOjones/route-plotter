<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: land the post-W2 queue and W3's pilot, then close them out

This supersedes `route-plotter-continuation-prompt-2026-09-25.md`, which
briefed the rest of the post-W2 queue and the W3 pilot and remains as
provenance: every item in it now has a pull request. Paste everything below
into a fresh chat.

You are continuing an adopted refactoring programme for Route Plotter v3.
**W0, W1 and W2 are closed; W2's fixes are live as v3.2.692; DEF-34, TST-17
and DEF-36 are merged on `main` and not yet released. Every other item of the
post-W2 queue, and W3's pilot, is an open pull request waiting on Joe, and the
close-out `PM:` pull request is open as a draft.** Your job now: see those
pull requests merged cleanly, resolving the text conflicts between them;
finalise and land the close-out; then take DEF-28 once Joe has made its
design call, and whatever Joe accepts from the proposals.

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and
the repository disagree, the repository wins, and you tell Joe. The one
exception is the close-out pull request (#44), which is newer than the memory
on `main` until it merges; tell Joe you are working from it.

## Purpose

The programme makes the codebase **auditable and safe to change with AI
assistance** without changing what users see, apart from defects Joe approves
one by one. The strategy is still *pin, then prune, then clarify, then
consolidate. Never rewrite.*

## Where things stand (verify all of this first; it may have moved)

Check with `git fetch` then `git log -1 origin/main`; the Pages source and
latest build; the last CI runs; the open pull requests (`gh` on Joe's Mac,
the GitHub MCP tools in the cloud container, which has no `gh`); and a
read-only `git status` in the OneDrive copy.

- **`main` @ `2fb72ff`** (DEF-36, #34, merged on Joe's word on 2026-09-25),
  on DEF-34 (#31), TST-17 (#32) and the `PM:` commit of the 2026-09-25 prompt
  (#33). **Verify** green. Protected: no force-push, no deletion.
- **Live: v3.2.692** (`14e3656`, tag `v3.2.692`), served by GitHub Pages from
  `main` `/docs`. DEF-34, TST-17 and DEF-36 are merged and **not live**.
  Rollback tags: `v3.2.689`, `v3.2.690`, `v3.2.691`, `v3.2.692`.
- **Gate on `main`:** `npm run check` → 85 test files · 1,190 tests · 2 todo ·
  shell 0 · build:check 0 (2026-09-26). The test run took about 65 s on the
  machine that ran W2, and takes 148 s in the cloud container.
- **Open pull requests,** all green on CI and all waiting on Joe:

  | PR | Item | Branch |
  | --- | --- | --- |
  | #35 | DEF-35 part A: crowds, dots and area drags follow points off the image | `post-w2/def-35-readers` |
  | #36 | DEF-35 part B: the scene outline edits points off the image | `post-w2/def-35-outline` |
  | #37 | DEF-08: pop, grow and pulse scale their marker in export, scrubbing and pause | `post-w2/def-08-beacon-scale` |
  | #38 | DEF-17: a finished polygon names its waypoint | `post-w2/def-17-polygon-complete` |
  | #39 | DEF-33: a cold start no longer announces "Animation paused" | `post-w2/def-33-startup-announce` |
  | #40 | DEF-30: a refused benchmark changes nothing, and `once` means once | `post-w2/def-30-harness-and-once` |
  | #41 | DEF-37: a `null` Graphics scale opens at 1×, and its next save reopens | `post-w2/def-37-null-graphics-scale` |
  | #42 | DEF-29: a video export bakes its beacons whatever the author's reduced motion | `post-w2/def-29-export-motion` |
  | #43 | SPL-01, W3's pilot: the slider scales move to `utils/sliderScales` | `w3/spl-01-slider-scales` |
  | #44 | `PM:` close-out, a **draft, merged last** | `pm/close-out-post-w2` |

  Merged together, #35 to #43 pass the gate: 86 test files · 1,239 tests ·
  2 todo. Each PR body states its behaviour change, its evidence, its
  mutation table and its review.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`.
  Joe accepted all 22 §20 defaults on 2026-09-22. On 2026-09-24 Joe approved
  DEF-34 and accepted DEF-35, DEF-36, TST-17 and DEF-37 (a `null` Graphics
  scale means 1×). On 2026-09-25 Joe accepted DEF-38 (P2) and DEF-39 (P3,
  keeping the round caps and joins), allowed branches named for their item,
  and asked for the pull requests to be watched. DEF-40 to DEF-46 are
  **proposed**, awaiting Joe. Check §20 and the decision log before telling
  Joe anything needs a decision.
- **Line references in the plan are at `2e4d78e`** unless a dated note says
  otherwise, and `src/` has moved. Re-verify every reference before relying
  on it.
- **The OneDrive copy** could not be reached from the cloud container this
  prompt was written in. Joe fast-forwards it; you never do.

## What the close-out pull request holds

The memory on `main` still lists DEF-34, TST-17 and DEF-36 as open, and has no
entry, trajectory line or plan marker for them. **#44 is the record**,
written for the state after #35 to #43 merge:
- the backlog's `### Next` without the merged items, with DEF-38 and DEF-39
  in, and DEF-28 gated on Joe's design call;
- plan markers for DEF-34, TST-17 and DEF-36; DEF-38 and DEF-39 marked
  accepted; proposed rows DEF-42 to DEF-46 (DEF-40 and DEF-41 arrive with #36
  and #35); and a dated note on DEF-06;
- two decision-log entries (the post-W2 queue; W3's pilot, with §14.5's
  answers), trajectory lines and eleven wish-list lines.

**Before #44 is marked ready:** merge `main` into it; add a "shipped" marker
to each merged item's plan row, in the W2 form with `unreleased` for the
version (`**Shipped 2026-09-24 (post-W2 queue, PR #31; unreleased)**`); take
out whatever did not merge (its backlog row stays; its trajectory line and
its place in the entry go); recount `file-map.md` against the tree; and rerun
the gate. The queue's own pull requests edit those plan rows, which is why #44
has not marked them yet.

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole;
   the backlog Active section; the latest decision-log headings (start with
   "W2 closes"), then #44's two entries.
2. **From the plan, only what the current item needs:** its §12.1 or §12.2
   row; §13 ground rules; §17 (testing); §18 (metrics); §20 before calling
   anything open; §2.9 for the round-2 browser probes; §14 before W4.
3. **`DEV-INFRASTRUCTURE.md`** (Quality gate, Runtime lifecycle, Deployment)
   and **`pm_skills/memory-policy.md`**, whenever you touch releases or
   memory.

## The work in order

1. **Land the open pull requests as Joe merges them.** Seven pairs conflict
   with each other, in text only; the table is in #44. Whichever of a pair
   merges second needs `main` merged into it: do that on its branch with a
   merge commit (never rebase or force-push a pull request's branch), keep
   both sides, rerun `npm run check`, and push. If Joe tells you to merge them
   yourself, take them in number order, one at a time, waiting for green CI
   between merges; squash, keeping the `<ITEM-ID>: summary` title.
2. **Finalise and land #44**, as above, once #35 to #43 are merged or Joe says
   which to leave out. It merges last.
3. **DEF-28,** once Joe chooses what an author sees when a session cannot be
   restored. #44 sets out options A, B and C, and recommends A. Characterise
   first, as always.
4. **Joe's calls on the proposals:** DEF-40 to DEF-46; TST-04 before W4, which
   §14.5 asks for because nothing guards the sidebar's readouts; and the
   pilot's lesson for W4's characterisation step. Accepted rows enter
   `### Next`; nothing else does.
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
  it, because a raw recorder id depends on test order.
- **`tests/goldenDrawLogs.test.js`** — four fixtures × five instants × three
  modes, `play == seek`, `app == player` (now including `authored-extras` at
  its authored Graphics scale 1.6), the DEF-34 regression at scales 0.5, 1.6
  and 8 with labels on and the camera off, a check that every frame
  composites `[canvas vector]` onto `main`, and a pixel-density-2 test of
  the layer's backing size and display-size composite. What it does not see,
  both on the wish-list: the player's display transform (`PlayerApp.resize`
  returns early with no parent) and a path-only export (`enterMode('export')`
  skips the step that hides the background).
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
  1,000 tests against a suite of 85 / 1,190 (86 / 1,239 once the queue
  merges); raise it as the suite grows, never lower it.
- **From W2:** `tests/shortHexGlow.test.js` has a manual
  `requestAnimationFrame` harness for frame-by-frame scheduling tests;
  `tests/exportMinimisation.test.js` drives the real `saveProject()` and
  `exportHTML()` and reads the blobs back; `src/utils/imageCoordinates.js`
  and `boundedEntityId` (`src/utils/entityId.js`) are the one rule each for
  image-point ranges and derived ids.
- **From the post-W2 queue, once merged:** DEF-29's tests run the app's real
  `exportVideo()` with only the encoder replaced (`app.videoExporter`
  stubbed, `VideoExporter.downloadBlob` spied, both restored in `finally`);
  DEF-37's round-trip a real `.zip` through Open Project (`exportZip`, then
  `loadProject`); DEF-33's record every announcement by spying on `announce`,
  because the live region clears itself after 2 s; and
  `tests/sliderScales.test.js` pins the slider maths value for value.

The only `todo`s left are DEF-04's two, in `authorableLoadable.test.js`,
each beside an active test that asserts today's broken behaviour; DEF-04 is
not in this queue. When you meet that pattern: turn the active test into a
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
  proposed DEF row for Joe first.

## How to run each PR

1. **Characterise first**, and watch the test fail for the right reason.
2. Make the smallest change.
3. `npm run check`, plus targeted tests. **Prove every new test can fail**:
   run a mutation per fix site from a script that restores the file
   afterwards, and record what caught each. The whole suite runs in about
   13 s on the machine that ran W2 as `npx vitest run --silent` (about 75 s in
   the cloud container) — files in parallel, unlike the gate's serial `npm test` — so
   a mutation table is cheap. **Read the result, not
   the exit code**: in a parallel run a frame one test booked can fire after
   its environment is torn down (`requestAnimationFrame is not defined`,
   from `AnimationEngine._scheduleFrame`), and vitest then reports
   `Errors  N errors` and exits 1 with every test passed (seen 2026-09-25 on
   `a69ab80`; on the wish-list). `--reporter=json --outputFile=<file>` gives
   you `numFailedTests` and the failing names to script against. **Guard
   mutation runs with a watchdog**: a mutation can turn a loop infinite (it
   did in DEF-31), and a synchronous hang cannot be timed out by Vitest.
4. Regenerate only the goldens the change means to move, and read the diff.
5. Where a user sees the result, run the matching §2.9 browser probe.
6. **The comparative review** (below), then fix or rebut with evidence, and
   re-run the mutation it used.
7. Open the PR with the behaviour statement, the evidence and the review.
8. Joe decides the merge.

**At a wave's close:** all PRs merged; Joe decides the release; one
decision-log entry, trajectory lines, the next wave into `### Next`, the §18
metrics.

**Stop and re-plan when** a §14.6 invalidation condition appears, a golden
cannot be made deterministic, a wave runs past about twice its PR estimate, a
plan finding proves wrong in a way that changes sequencing, or Joe changes
direction.

## The comparative reviewer

**Codex (`gpt-6-astra`)**, where it is available, found real holes in four of
the five W2 fixes it reviewed and in both DEF-34's and TST-17's pull
requests. **It was not available in the cloud container that ran #34 to
#43**, so an independent Claude agent stood in: a fresh context, its own
clone with no remote, the same falsification brief Codex would get, and
jsdom probes, Chromium and mutation runs of its own. It found a real hole in
every one of those ten pull requests — a regression, a vacuous test, a
missed route — and each was fixed before the pull request opened. **Assume
your work has a hole like that.**

- Codex: `codex exec -m gpt-6-astra -s workspace-write -C <throwaway-clone> -o <out.md> - < <brief.md>`
  in a clone with **no remote** (`git clone --no-local`, create `main`,
  `git remote remove origin`, copy `node_modules`). Run it in the background,
  never with a bare `&`, so you are told when it ends.
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

## Traps this programme has already hit

- jsdom's `Image` stub reports 100×100, and loading a background makes the
  export resolution follow it; restore the authored resolution.
- The camera snaps only at 1× zoom; elsewhere use
  `CameraService.isZoomTransitioning()` and a bounded loop.
- `esbuild` cannot run under jsdom: `// @vitest-environment node`.
- A debounced duration rebuild leaves the timeline at 0 right after a load;
  call `app.invalidateAnimationTiming()` before an export or a timed check.
- `start + (edge − start)` is not always `edge` in floating point; clamp
  after applying a shared delta.
- The vector canvas's base transform lives outside any `save`, set once at
  resize; every other transform is paired inside one frame (DEF-36's whole
  subject).
- In zsh a variable named `path` clobbers `PATH`, and `IFS=':'` splits PR
  titles at their colons.
- **Neighbouring lines conflict.** Two pull requests that edit adjacent plan
  rows or file-map rows conflict in git, though they touch different lines,
  and the plan's one-line rows make that common. Check each pair with
  `git merge-tree --write-tree` before giving Joe a merge order.
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

**Begin** by verifying the state above (`main`'s SHA, which of #35 to #44 are
merged, CI, and each open pull request's mergeability), making the clone, and
telling Joe you are working from #44. Then resolve whatever conflicts the
merges so far have left, and take the first open step of "The work in order".

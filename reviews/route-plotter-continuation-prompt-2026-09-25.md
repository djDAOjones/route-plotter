<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: the rest of the post-W2 queue, then the W3 pilot

This supersedes `route-plotter-continuation-prompt-2026-09-24.md`, which
briefed the post-W2 queue and remains as provenance: its first two items,
DEF-34 and TST-17, are merged. Paste everything below into a fresh chat.

You are continuing an adopted refactoring programme for Route Plotter v3.
**W0, W1 and W2 are closed; W2's fixes are live as v3.2.692; DEF-34 and
TST-17 are merged on `main` and not yet released.** Your job now: clear the
rest of the approved queue — one defect or test fix per pull request, each
proved by a test written first and attacked by Codex — then run the W3
pilot, then write the memory the queue still owes.

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and
the repository disagree, the repository wins, and you tell Joe. The one
exception is the section "What the repository's memory does not hold yet",
which is newer than the repository; tell Joe you are working from it.

## Purpose

The programme makes the codebase **auditable and safe to change with AI
assistance** without changing what users see, apart from defects Joe approves
one by one. The strategy is still *pin, then prune, then clarify, then
consolidate. Never rewrite.*

## Where things stand (verify all of this first; it may have moved)

- **`main` @ `a69ab80`** (TST-17, #32) on `1b598ed` (DEF-34, #31), both
  merged on Joe's word on 2026-09-24, plus the `PM:` commit that added this
  prompt. No open PRs; **Verify** green. Protected: no force-push, no
  deletion.
- **Live: v3.2.692** (`14e3656`, tag `v3.2.692`), served by GitHub Pages from
  `main` `/docs`. Pages rebuilt at `a69ab80`, but from the same committed
  `docs/`, which no PR since the deploy has touched, so **DEF-34 is merged
  and not live**: an HTML export made on the live site still draws at
  Graphics scale 1 until Joe calls a release. Rollback tags: `v3.2.689`,
  `v3.2.690`, `v3.2.691`, `v3.2.692`.
- **Gate:** `npm run check` → 85 test files · 1,187 tests · 2 todo · shell 0 · build:check 0, run on `a69ab80` on 2026-09-25. Wall time about 65 s.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`,
  111 items plus DEF-34–37 and TST-17. **Joe accepted all 22 §20 defaults on
  2026-09-22, and on 2026-09-24 approved DEF-34 and accepted DEF-35, DEF-36,
  TST-17 and DEF-37** (DEF-37's acceptance is not in the plan yet; see the
  next section). Check §20 and the decision log before telling Joe anything
  needs a decision — more has been answered than you think.
- **Line references in the plan are at `2e4d78e`**, and `src/` has moved.
  Re-verify every reference before relying on it.
- **The OneDrive copy** was clean at `989f11d` (#30) when this was written,
  two merges behind `main`. Joe fast-forwards it; you never do.

**Shipped:** W0 (#1–#6); v3.2.691 with DEF-01; W1 (#9–#19) and its close
(#20, #21); W2 (#22–#28: DEF-02, DEF-03, DEF-31, DEF-23, DEF-26, DEF-21) and
its close (#29, #30), released as v3.2.692; then, unreleased, **DEF-34**
(#31: `PlayerApp.load` hands `styles.graphicsScale ?? 1` to
`setGraphicsScale`, the editor's setter with the editor's fallback; no golden
changed) and **TST-17** (#32: a composited canvas is recorded by its surface —
`[canvas vector]`, `[canvas mask]`, `[canvas main]` — 78 golden lines changed
by name only, plus a pixel-density-2 test).

Check with `git fetch` then `git log -1 origin/main`;
`gh api repos/djDAOjones/route-plotter/pages --jq .source` and
`…/pages/builds/latest --jq '{status,commit}'`; `gh run list -L 3`;
`gh pr list`; and a read-only `git status` in the OneDrive copy.

## What the repository's memory does not hold yet

Joe deferred the bookkeeping for #31, #32 and DEF-37 to one batch `PM:`
close-out pull request, as at a wave's close. Until it lands, project memory
lags in three places, and this prompt is the record:

1. **`backlog.md` → `### Next` still lists DEF-34 and TST-17 as open.** They
   are merged. Do not redo them; the close-out PR ticks them.
2. **DEF-37 is accepted, not "awaiting".** Its plan row (§12.1) still says
   "awaiting the owner's decision — not yet scheduled". Joe accepted it on
   2026-09-24 at **P3**, with this call: **a `null` Graphics scale means
   1×.** Today load's finite check reads `Number(null)` as 0, normalisation
   stores 0, the editor draws at 0.25× and shows "0.0×", and the next save
   or autosave writes 0, which load refuses — a file that opened will not
   reopen. Only a hand-edited or third-party file carries `null`. The plan's
   first remedy is the one Joe chose: treat `null` as absent when styles are
   normalised (`persistence.js`; check `undoRedo.js`'s restore path too), so
   it takes the default. It has no backlog row yet; it is in the queue below.
3. **No decision-log entry, trajectory lines or plan "shipped" markers exist
   for DEF-34 and TST-17.** The W2 close's §18 count of open defects, 28,
   still holds: DEF-34 closed and DEF-37 opened.

**The close-out PR is due when the queue closes, or when Joe calls a
release, whichever comes first** (a release records itself through a `PM:`
PR anyway); Joe may ask for it sooner. It carries: DEF-34 and TST-17 ticked;
DEF-37 into `### Next` and its plan row marked accepted; DEF-34's and
TST-17's plan rows marked shipped; one decision-log entry for the post-W2
queue, with Codex's finds in it; one trajectory line per item, starting with
its ID; the §18 metrics; and the file-map counts recounted after every
merge.

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole;
   the backlog Active section; the latest decision-log headings (start with
   "W2 closes").
2. **From the plan, only what the current item needs:** its §12.1 or §12.2
   row; §13 ground rules; §17 (testing); §18 (metrics); §20 before calling
   anything open; §2.9 for the round-2 browser probes; §14 when W3 starts.
3. **`DEV-INFRASTRUCTURE.md`** (Quality gate, Runtime lifecycle, Deployment)
   and **`pm_skills/memory-policy.md`**, whenever you touch releases or
   memory.

## The work in order

`pm_skills/project/backlog.md` → `### Next` is the authority, less the two
merged items and plus DEF-37. **One item per PR**; each DEF states its new
behaviour for Joe and names the goldens it changes. None of these has a
characterisation test yet: write it first, and watch it fail for the right
reason.

1. **DEF-36** (P2, accepted 2026-09-24) — one throwing frame can leave the
   vector context with a `save()` it never restored: the viewport or camera
   `save` around `renderVectorLayerTo` (`RenderingService`, about line 555
   at `a69ab80`) and the beacons' own (`BeaconRenderer`), so later frames
   compound the zoom — Codex measured 4× under a 2× camera. The plan says
   "reset the drawing context at the start of each frame", **but read the
   code before taking that literally.** The vector canvas's pixel-scale
   transform is set once, in `getVectorCanvas` at a resize
   (`setTransform(1, 0, 0, 1, 0, 0)` then `scale(dpr, dpr)`), and is meant to
   persist across frames, so a reset to the identity would draw every frame
   at the wrong density; and a clean frame must record exactly the calls it
   records today, because the goldens must stay byte-identical when nothing
   throws. So the reset has to re-establish that base transform, and it
   probably belongs only after a frame that threw — a `try`/`finally` around
   the layer that restores to a recorded save depth, or re-applies the base
   transform — not in every frame. Prove it with a throw injected mid-layer:
   the next frame's transcript must equal a clean host's, in the editor and
   in the player, which draws through the same service. The recorder in
   `tests/setup.js` models only the methods in `CONTEXT_METHODS`
   (`setTransform` and `resetTransform`, not `reset()`), so a browser
   `ctx.reset()` would have to be added there and modelled, style stack
   included.
2. **DEF-35** (P2, accepted) — off-image points (legal since DEF-03, within
   `IMAGE_COORDINATES`, −10…11) are still pinned or refused by four readers:
   the scene outline shows an off-image waypoint as out of range and will not
   submit any edit to it (`SceneOutlineController`); area-vertex and centre
   drags snap onto the image (`AreaEditService`); a crowd node anchored to an
   off-image waypoint resolves to the image edge (`GraphNode`); dots on an
   off-image route stop at the edge (`SwarmEngine`). One PR per reader is
   fine, each stating its new behaviour. The default is to let each reader
   accept the range; the plan's alternative — declare off-image points
   editor-only geometry and say so in the outline — is Joe's to choose, and
   only worth raising if the code makes a case for it.
3. **The remaining defects, in any order** (§13 ground rule 8, plus DEF-37):
   **DEF-08** (P1; beacon scaling only while playing — needs `pop` added to
   `authoredExtras`, and golden cells change), **DEF-17** (P1), **DEF-28**
   (P2), **DEF-33** (P3), **DEF-30** (P3), **DEF-29** (P3, §20 Q7b decided),
   **DEF-37** (P3, accepted as above; the same normalisation turns a `null`
   thickness, dot size, head size or glow into 0, and those reopen, so leave
   them unless Joe widens the row).
4. **W3, the pilot:** SPL-01 — move the pure slider-scale functions out of
   `MotionVisibilityService` into `utils/sliderScales`, per §14, consumers
   migrated in the same PR and no wrapper left behind. Characterise
   `formatUIValue`'s existing rounding rather than "fixing" it. Taking the
   queue above first is a scheduling choice Joe confirmed on 2026-09-24, not
   a dependency; if Joe wants the pilot sooner, that is Joe's call.
5. **The close-out `PM:` PR** described above.

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
  `pop` beacon (DEF-08 adds it).
- **`tests/goldens/`** — regenerate deliberately with
  `UPDATE_SNAPSHOT_GOLDENS=1` / `UPDATE_DRAW_GOLDENS=1`, then justify every
  changed cell in the PR.
- **`tests/helpers/consoleGuard.js`** — undeclared console output fails its
  test; declare with `allowConsole(/…/)`.
- **`tests/helpers/minCountReporter.js`** — its floor is still 72 files /
  1,000 tests against a suite of 85 / 1,187; raise it as the suite grows,
  never lower it.
- **From W2:** `tests/shortHexGlow.test.js` has a manual
  `requestAnimationFrame` harness for frame-by-frame scheduling tests;
  `tests/exportMinimisation.test.js` drives the real `saveProject()` and
  `exportHTML()` and reads the blobs back; `src/utils/imageCoordinates.js`
  and `boundedEntityId` (`src/utils/entityId.js`) are the one rule each for
  image-point ranges and derived ids.

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
- One concern per PR, on a short-lived branch from `main`, opened with
  `gh pr create`. CI (`Verify`) must be green. **Always base a PR on `main`.**
- **Never commit to or push `main` except** merging a PR Joe has told you to
  merge, and `npm run push` for a release Joe has called. Approving a merge
  does not call a release.
- **Parallel PRs collide on shared lines**: `file-map.md`'s header counts, a
  test file's header, `wish-list.md`'s last line (#31 and #32 met there;
  keep both sides). Identical edits on both sides merge "cleanly" and
  *wrongly* (two PRs that each bump a count from 331 to 332 leave 332). After
  a batch of merges, recount.
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
   13 s as `npx vitest run --silent` — files in parallel, unlike the gate's
   serial `npm test` — so a mutation table is cheap. **Read the result, not
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
6. **Codex review** (below), then fix or rebut with evidence, and re-run the
   mutation it used.
7. Open the PR with the behaviour statement, the evidence and the review.
8. Joe decides the merge.

**At a wave's close:** all PRs merged; Joe decides the release; one
decision-log entry, trajectory lines, the next wave into `### Next`, the §18
metrics.

**Stop and re-plan when** a §14.6 invalidation condition appears, a golden
cannot be made deterministic, a wave runs past about twice its PR estimate, a
plan finding proves wrong in a way that changes sequencing, or Joe changes
direction.

## Codex is the comparative reviewer

**Codex (`gpt-6-astra`)** found real holes in four of the five W2 fixes it
reviewed, and in both post-W2 PRs: in DEF-34, two test holes — labels were
never compared, because the fixture exports without text, and a first-frame
camera exemption accepted any `translate` — and the DEF-37 loader gap; in
TST-17, a defect the lead had introduced (the rename ran over label text,
differently on two hosts) and a compositing mistake no golden could see
(backing size for display size, identical at pixel density 1). **Assume your
work has a hole like that.**

- `codex exec -m gpt-6-astra -s workspace-write -C <throwaway-clone> -o <out.md> - < <brief.md>`
  in a clone with **no remote** (`git clone --no-local`, create `main`,
  `git remote remove origin`, copy `node_modules`). Run it with the Bash
  tool's `run_in_background`, never a bare `&`, so you are told when it ends.
- A brief that works says what changed and what the gate reports; points at
  `AGENTS.md` and the plan rows; **numbers the claims to attack**; names what
  you fear most; and asks for a verdict per claim, substantiated by
  `file:line` and probes.
- Verify each finding before adopting it; rebut with evidence when it is
  wrong. If it hits a usage limit, ask Joe; don't wait silently.

## Browser checks

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

**Begin** by verifying the state above, making the clone, telling Joe you
are working from the "not held yet" section, and picking up **DEF-36**.

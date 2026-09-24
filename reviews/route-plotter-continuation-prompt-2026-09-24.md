<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: the post-W2 queue, then the W3 pilot

This supersedes `route-plotter-continuation-prompt-w2-2026-09-23.md`, which
briefed W2 and remains as provenance. Paste everything below into a fresh chat.

You are continuing an adopted refactoring programme for Route Plotter v3.
**W0, W1 and W2 are closed, and W2's fixes are live as v3.2.692.**
Your job now: clear the approved queue — one defect or test fix per pull
request, each proved by a test written first and attacked by Codex — then run
the W3 pilot.

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

- **`main` @ `14e3656`** (the v3.2.692 deploy commit), plus the `PM:` commit that
  closed W2 and added this prompt. Protected: no force-push, no deletion.
- **Live: v3.2.692** (`14e3656`, tag `v3.2.692`),
  served by GitHub Pages from `main` `/docs`. Rollback tags: `v3.2.689`,
  `v3.2.690`, `v3.2.691`, `v3.2.692`.
- **Gate:** `npm run check` → 85 test files · 1,182 tests · 3 todo · shell 0 · build:check 0. Wall time about 60 s.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`,
  now 111 items plus DEF-34–36 and TST-17. **Joe accepted all 22 §20
  defaults on 2026-09-22, and on 2026-09-24 approved DEF-34 and accepted
  DEF-35, DEF-36 and TST-17.** Check §20 and the decision log before telling
  Joe anything needs a decision — more has been answered than you think.
- **Line references in the plan are at `2e4d78e`**, and `src/` has moved.
  Re-verify every reference before relying on it.

**Shipped:** W0 (#1–#6); v3.2.691 with DEF-01; W1 (#9–#19) and its close
(#20, #21); W2 (#22–#28: DEF-02, DEF-03, DEF-31, DEF-23, DEF-26, DEF-21) and
its close (#29), released as v3.2.692.

Check with `git fetch` then `git log -1 origin/main`;
`gh api repos/djDAOjones/route-plotter/pages --jq .source` and
`…/pages/builds/latest --jq '{status,commit}'`; `gh run list -L 3`;
`gh pr list`; and a read-only `git status` in the OneDrive copy (Joe keeps it
fast-forwarded).

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

`pm_skills/project/backlog.md` → `### Next` is the authority. **One item per
PR**; each DEF states its new behaviour for Joe and names the goldens it
changes.

1. **DEF-34** (P1, approved 2026-09-24) — the exported player never calls
   `setGraphicsScale`, so an HTML export draws every vector element at
   Graphics scale 1 while the editor and video are right. The fix is one call
   in `PlayerApp.load`. `goldenDrawLogs.test.js` characterises it exactly (the
   "DEF-34 (proposed)" test plus its `todo`): turn that into a regression,
   retire the `todo`, and let the `authored-extras` fixture join the plain
   `app == player` parity test. Expect no file golden to change.
2. **TST-17** (P1, accepted) — the draw recorder writes every source canvas
   as `[canvas]` (`tests/setup.js`, `describeValue`), so compositing the wrong
   canvas passes every golden; this was reproduced on 2026-09-23. Name the
   source by the same surface label the transcript uses, then regenerate the 11
   draw goldens deliberately and justify every changed line. Test-only, but it
   hardens every golden after it, so do it early.
3. **DEF-36** (accepted) — one throwing frame can leave the vector context
   with a `save()` it never restored: the camera `save` in
   `RenderingService` and the beacons' own `save`s, so later frames compound
   the zoom. Reset the drawing context each frame (`ctx.reset()` where the
   browser has it, otherwise an explicit reset) and prove a throw mid-layer
   leaves the next frame identical to a clean one. Behaviour-preserving when
   nothing throws: the goldens must stay byte-identical.
4. **DEF-35** (P2, accepted) — off-image points (legal since DEF-03) are still
   pinned or refused by four readers: the scene outline will not submit any
   edit to an off-image waypoint, area-vertex and centre drags snap onto the
   image, crowd anchors and dots stop at the image edge. One PR per reader is
   fine.
5. **The remaining defects W1 released** (§13 ground rule 8), in any order:
   **DEF-08** (P1; beacon scaling only while playing — needs `pop` added to
   `authoredExtras`, and golden cells change), **DEF-17** (P1), **DEF-28**
   (P2), **DEF-33** (P3), **DEF-30** (P3), **DEF-29** (P3, §20 Q7b decided).
6. **W3, the pilot:** SPL-01 — move the six pure slider-scale functions out of
   `MotionVisibilityService` into `utils/sliderScales`, per §14.
   Characterise `formatUIValue`'s existing rounding rather than "fixing" it.
   Doing the queue above first is a scheduling choice, not a dependency; Joe
   may prefer to start the pilot sooner — ask once.

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
- **`tests/fixtures/authoredExtras.js`** — the every-field fixture; still no
  `pop` beacon (DEF-08 adds it).
- **`tests/goldens/`** — regenerate deliberately with
  `UPDATE_SNAPSHOT_GOLDENS=1` / `UPDATE_DRAW_GOLDENS=1`, then justify every
  changed cell in the PR.
- **`tests/helpers/consoleGuard.js`** — undeclared console output fails its
  test; declare with `allowConsole(/…/)`.
- **`tests/helpers/minCountReporter.js`** — raise the floor as the suite
  grows (it is still 72 files / 1,000 tests; the suite is now 85
  files); never lower it.
- **New in W2:** `tests/shortHexGlow.test.js` has a manual
  `requestAnimationFrame` harness for frame-by-frame scheduling tests;
  `tests/exportMinimisation.test.js` drives the real `saveProject()` and
  `exportHTML()` and reads the blobs back; `src/utils/imageCoordinates.js`
  and `boundedEntityId` (`src/utils/entityId.js`) are the one rule each for
  image-point ranges and derived ids.

A defect with a characterisation has an **active test asserting today's broken
behaviour** beside an **empty `test.todo`**: turn the active test into a
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
  test file's header, `wish-list.md`'s last line. Identical edits on both
  sides merge "cleanly" and *wrongly* (two PRs that each bump a count from 331
  to 332 leave 332). After a batch of merges, recount.
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
   afterwards, and record what caught each. **Guard mutation runs with a
   watchdog**: a mutation can turn a loop infinite (it did in DEF-31), and a
   synchronous hang cannot be timed out by Vitest.
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
reviewed — a missed authoring path (a P0), a range that was too small, crafted
id collisions that silently dropped nodes, two test holes and an
over-promised privacy claim. **Assume your work has a hole like that.**

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

## Browser checks (Joe allowed this on 2026-09-24)

- Build a throwaway clone (`npm run build`), then serve it through a
  **temporary** entry in the parent folder's `.claude/launch.json` (the
  session cwd is the parent folder), and restore that file byte-identical
  afterwards — check the SHA-256. pyenv and the Xcode-stub `python3` fail
  here; use a small Node server.
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

**Begin** by verifying the state above, making the clone, and picking up
**DEF-34**.

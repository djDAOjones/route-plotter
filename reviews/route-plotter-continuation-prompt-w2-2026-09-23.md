<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: fix the live defects (W2 onward)

**Superseded by `route-plotter-continuation-prompt-2026-09-24.md`**, which carries the programme on from the post-W2 queue. This prompt briefed W2, which closed on 2026-09-24 and was released as v3.2.692; it remains as provenance.

This supersedes `route-plotter-continuation-prompt-2026-09-23.md`, which briefed W1 and
remains as provenance. Paste everything below into a fresh chat.

You are continuing an adopted refactoring programme for Route Plotter v3. **W0 and W1 are
closed. The safety net exists. Your job now is to use it: fix the defects that are live in
front of users, one per pull request, each proved by a test written before the fix.**

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and the
repository disagree, the repository wins — **except where this prompt names a stale
contract**, which it does once, for DEF-03. Tell Joe either way.

## Purpose

The programme makes the codebase **auditable and safe to change with AI assistance**
without changing what users see, apart from defects Joe approves one by one. W2 is the
exception that proves the rule: every item below is a deliberate, stated behaviour change.

The strategy is still *pin, then prune, then clarify, then consolidate. Never rewrite.*

## Where things stand (verify all of this first; it may have moved)

- **`main` @ `ad3a38a`**, protected (no force-push, no deletion).
- **Live: v3.2.691** (`fb3426c`, tag `v3.2.691`), served by GitHub Pages from `main`
  `/docs`. Rollback tags: `v3.2.689`, `v3.2.690`, `v3.2.691`.
- **Gate:** `npm run check` → 82 test files · 1,156 tests · 7 todo · shell 0 ·
  build:check 0. Wall time about 63 s.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, 111
  items plus DEF-34 proposed, waves W0–W12. **Joe accepted all 22 §20 defaults on
  2026-09-22** (decision log, "adopt the codebase abstraction plan"). Check §20 and the
  log before ever telling him something needs his decision — several DEF rows still carry
  pre-acceptance "owner decides" wording.
- **Line references in the plan are at `2e4d78e`**, and `src/` has moved. Re-verify every
  reference before relying on it.

**Shipped:** W0 (#1–#6), v3.2.691 with DEF-01, W1 (#9, #11, #14, #15, #16, #18, #19) and
its close (#20).

Check with `git fetch` then `git log -1 origin/main`;
`gh api repos/djDAOjones/route-plotter/pages --jq .source` and
`…/pages/builds/latest --jq '{status,commit}'`; `gh run list -L 3`; `gh pr list`; and a
read-only `git status` in the OneDrive copy (Joe keeps it fast-forwarded).

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole; the backlog
   Active section; the latest decision-log headings (start with "W1 closes").
2. **From the plan, only what the current item needs:** its §12.1 row; §13 ground rules
   and the W2 table; §17 (testing); §18 (metrics); §20 before calling anything open;
   §2.9 for the round-2 browser probes.
3. **`DEV-INFRASTRUCTURE.md`** (Quality gate, Runtime lifecycle, Deployment) and
   **`pm_skills/memory-policy.md`**, whenever you touch releases or memory.

## The safety net W1 built — use it, do not rebuild it

- **`tests/helpers/bootApp.js`** boots the real app from the shipped `index.html`:
  `const app = await bootApp({ viewport })`. **It does not await `app.ready` — you must.**
  Before `ready` resolves, pointer interaction is still disabled. Separately, *every*
  programmatic speed-slider update starts a 50 ms window in which the slider ignores
  input (`UIController.js:828-840`), and `app.ready` does not await that timer; the
  authoring tests wait again afterwards. Two different waits — conflating them makes a
  live control look inert.
- **`tests/helpers/projectSnapshot.js`** — `freezeClock()` fakes only `Date`, so `created`
  and `modified` hold fixed values in their real fields while timers stay real;
  `loadSnapshot(app, project)` is the real recovery path back in; `LOAD_REFUSED` is the
  warning it prints on refusal; `comparableSnapshot()` rounds for comparison.
- **`tests/helpers/drawLog.js`** — one transcript across *every* canvas in the order the
  calls were made (main, the offscreen vector layer, the reveal mask), rounded and
  diffable: `frameAt`, `takeFrame`, `discardFrame`, `setUpFrame`, `differingLines`.
- **`tests/fixtures/authoredExtras.js`** — an extended authored project: image assets, a
  custom marker, camera zooms, an area polygon, spotlight reveal, a path-only export, and
  four of the five non-`none` beacon styles (ripple, pulse, glow, grow — **not `pop`**).
  `projectSnapshotShape.test.js` guards that every top-level waypoint field is moved off
  its default somewhere; it does **not** prove every nested field or enum alternative is
  exercised. Extend it rather than starting a new fixture.
- **`tests/goldens/`** — 4 snapshot goldens, 11 draw logs, about 1.4 MB. The draw logs
  capture the **app** in editor, preview and export; the player comparisons are separate
  assertions that write no golden. Regenerate deliberately with
  `UPDATE_SNAPSHOT_GOLDENS=1` / `UPDATE_DRAW_GOLDENS=1`, then **read the diff and justify
  every changed cell in the PR**.
- **`tests/helpers/consoleGuard.js`** — undeclared `console.error`/`warn` fails its test.
  Declare with `allowConsole(/…/)`; never silence console with a spy.
- **`tests/helpers/minCountReporter.js`** — an unfiltered run under 72 files or 1,000
  executed tests fails. Raise the floor as the suite grows; never lower it. Passing
  `--reporter` on the command line replaces it.

## How W1's defect tests are actually shaped — read this before your first fix

Each known defect has **an active test that asserts today's broken behaviour**, plus an
**empty `test.todo`** naming the fix. Flipping a `todo` is not the job: a `todo` has no
body, and the active test beside it will start failing the moment you fix the defect.

For each defect: **turn the active characterisation into a regression for the intended
behaviour, keeping its reproduction intact, and retire the matching `todo`.** Watch the
active test fail for the right reason before you touch `src/`.

The characterisations live at `playerHostContract.test.js:65-75`,
`goldenDrawLogs.test.js:356-389`, and `authorableLoadable.test.js:214-230` and `:276-304`.

## The work in order

`pm_skills/project/backlog.md` → `### Next` is the authority. **One defect per PR**, each
stating its new behaviour for Joe, naming the goldens it changes and why.

**W2 — the urgent live defects.**

1. **DEF-02** — the player never builds `waypointsById`, so every anchored crowd node in
   an exported HTML player draws at its authored position. Restore moved-anchor parity
   between the export canvas and the player. The two characterisations are structural
   (`playerHostContract`) and render-level (`goldenDrawLogs`). **Expect the committed file
   goldens to stay byte-identical** — they capture the app, not the player.
2. **DEF-03** — waypoints and polygon vertices authored below 100% background zoom will
   not reload. **Policy decided** (§20 Q3, accepted 2026-09-22): *widen what load accepts
   to the range the UI can author*, not clamp at authoring. **Do not reopen Q3.**
   - **A stale contract blocks the obedient reading:** `AGENTS.md` still states as a hard
     rule that waypoints store normalised `imgX`/`imgY` "(0–1)". Reconcile it in this PR —
     the values stay normalised image coordinates; accepted values need not lie inside
     0–1. Say so in the PR so Joe sees the invariant change.
   - The existing characterisation covers an out-of-bounds **waypoint** only. Polygon
     vertices and the player's load path need their own regression coverage.
3. **DEF-31** — `gn_trace_<id>` / `ge_trace_<from>__<to>` reach 265/523 characters from
   legitimate 256-character IDs, so "Trace route into crowd" produces a project that will
   not reopen. Bounded deterministic derived IDs, reference mapping preserved.
4. **DEF-23** — exports carry images reachable only through undo, and the HTML carries
   original filenames. **Policy decided** (§20 Q4): filter to live references in both ZIP
   and HTML, keep filenames in the ZIP only. Filter **at export** — the store's retention
   is correct and `assetPruning.test.js` pins it. Needs a new test.

**W2's own validation** (plan §13 W2): the gate, a manual check of AoV Reveal in the
browser, and **an HTML export containing a traced crowd, opened offline**. The last is not
optional and is not covered by any automated test.

**Then the eight defects W1 released** (§13 ground rule 8, "After W1"), with the backlog's
priorities. Doing all eight before W3 is a scheduling choice, not a dependency — Joe may
prefer to start the W3 pilot sooner.

- **DEF-26 first** (P1, and §13 permits it joining W2): a short hex glow colour throws
  every frame, stopping playback and latching `queueRender` until reload. Parse every form
  `safeColor` accepts — `#rgb`, `#rgba`, `#rrggbbaa` — and **preserve alpha**, which
  eight-digit hex currently loses silently rather than throwing. In the same PR make one
  bad frame survivable: reset the latch in a `finally`, reschedule `_loop` before
  `onUpdate`.
- **DEF-08** (P1): pop/grow/pulse marker scaling applies only while `isPlaying()`, so it
  is absent from video export, scrubbing and paused preview. Visible change; needs active
  scaling cases **including `pop`**, which `authoredExtras` does not yet carry.
- **DEF-17** (P1), **DEF-21** (P1, text only), **DEF-28** (P2), **DEF-30** (P3 — note
  the throwing `once` has no production caller), **DEF-33** (P3), **DEF-29** (P3, policy
  decided by §20 Q7b).

**Then W3, the pilot:** SPL-01, move the six pure slider-scale functions out of
MotionVisibilityService into `utils/sliderScales`, per §14. Characterise `formatUIValue`'s
existing rounding rather than "fixing" it.

## Two things are waiting on Joe

Ask both **once**, early, in one message — then get on with what does not depend on them.

1. **HTML exports ignore Graphics scale**, so their graphics differ from both the editor
   and the video export. Approve fixing this in W2? *Recommended: yes, in its own PR.*
   (Plan §12.1 carries it as DEF-34, marked **Proposed**; the backlog's P1 is a
   recommendation, not an adopted priority. `goldenDrawLogs.test.js` characterises it.)
2. **Very long labels can make a saved project impossible to reopen.** Keep this inside
   DEF-04's W8 authoring-limit work, or bring the label case forward? *Recommended: keep
   the DEF-04 classification; decide the timing separately.* Nothing is blocked either
   way.

## Standing rules (non-negotiable)

**Environment**
- Work in a **fresh full clone outside OneDrive**, never `--single-branch`.
- The OneDrive copy is Joe's, and other sessions may be in it. **Pause before writing
  anything there**; update it only by fast-forward when clean.
- Never run `npm run dev`, `npm run build` or `scripts/restart.sh` as a check. The gate is
  `npm run check`, which is non-mutating.

**Git and releases** — the authority is `AGENTS.md` → Commit, push and release, and
`DEV-INFRASTRUCTURE.md` → Deployment. In short:
- One concern per PR, on a short-lived branch from `main`, opened with `gh pr create`. CI
  (`Verify`) must be green.
- **Always base a PR on `main`.** Never stack one on another: GitHub merges it into its
  base branch, and deleting that branch loses the work.
- **Never commit to or push `main` except in the two owner-authorised cases** AGENTS.md
  names: merging a pull request Joe has told you to merge, and running `npm run push` for
  a release Joe has called. **Approving a merge does not call a release.**
- A merge releases nothing: Pages serves the committed `docs/`. A release is the 8 steps
  in DEV-INFRASTRUCTURE → Deployment.
- **Commit messages:** `<ITEM-ID>: summary`, one what/why line, then
  `Verify: <F> test files · <T> tests · shell 0 · build:check 0`. Never report lint or
  typecheck; the gate has neither.

**Behaviour**
- Each DEF PR states its new behaviour for Joe, and changes only the golden cells it means
  to. Paste the changed cells, or a fair summary, into the PR.
- Behaviour-preserving PRs leave the goldens byte-identical.
- A compatibility wrapper lives at most one wave (ground rule 7).
- Deleting a test that pins only dead code needs a decision-log entry listing each test
  (§20 Q8). Re-pointing an import when code moves is not weakening a test.
- Never touch `docs/`, `_Joe/`, `version.json` or `node_modules/` by hand.

**Memory** (`pm_skills/project/`, single writer)
- One decision-log entry **per wave**, listing each PR's preserved contract or stated
  behaviour change; releases get their own entry. Don't edit old entries.
- The backlog `### Next` is the schedulable queue. Keep its flags honest: `[ready]`,
  `[gated: X impl]`, `[verify: …]`, `[owner: …]`. **A gate is a claim — check it.** On
  2026-09-23 two items carried `[gated: owner]` for decisions Joe had made the day before.
  `[ready]` means ready to implement and open a PR — never pre-approved to merge.
- One trajectory line per shipped item, starting with its ID.
- Add a `file-map.md` row for every new file, and correct the counts. **Never run
  `gen-file-map.mjs`.**
- Budget overruns are reported and proposed, never pruned without Joe. His prune bar
  (decision log, 2026-08-27) outranks the prune-to targets. The decision log is over its
  entry budget by Joe's choice.

**Plan fidelity**
- If evidence shows a row is wrong, patch that row with a dated note, say so in the wave's
  decision-log entry, and tell Joe.
- Any *new* behaviour change becomes a proposed DEF row for Joe first, as DEF-34 is now.

## How to run each PR

1. **Characterise first.** Write the regression, or reshape the existing characterisation,
   and watch it fail for the right reason before touching `src/`.
2. Make the smallest change.
3. Run `npm run check`, plus targeted tests. **Prove every new golden or rule can fail** by
   mutating one thing; record the mutation and what caught it in the PR.
4. Regenerate only the goldens the change intends to move, and read the diff.
5. Where a user sees the result, re-run the matching §2.9 browser probe.
6. **Get a Codex review** (below), then fix or rebut its findings with evidence.
7. Open the PR with the behaviour-change statement and the verify evidence.
8. Joe decides the merge.

**At wave close:** all PRs merged; Joe decides whether to release; write one decision-log
entry, the trajectory lines and the next wave into `### Next`; report the §18 metrics.

**Stop and re-plan when:** a §14.6 invalidation condition appears; a golden cannot be made
deterministic; a wave runs past about twice its PR estimate; a plan finding proves wrong in
a way that changes sequencing; or Joe changes direction.

## Codex is the comparative assistant

**Codex (`gpt-6-astra`)** is Joe's independent reviewer, and it has repeatedly found
blockers this programme would otherwise have shipped — including, on 2026-09-23, two
finished-looking test suites that were silently not testing what they claimed. **Assume
your work has a hole like that, and make Codex look for it.**

- `codex exec -m gpt-6-astra -s read-only -C <clone> -o <out.md> - < <brief.md>`
- `-s workspace-write` **only** in a throwaway clone with no remote.
- If it hits a usage limit, ask Joe; don't wait silently.

**Its value tracks the precision of the brief.** A brief that works: says what changed and
what the gate reports; gives it `AGENTS.md` and the plan rows so it can judge intent;
**numbers the exact claims to attack**, one per thing you believe ("this golden would
catch a real regression: name a change a user would see that it would *not* fail on");
names the failure modes you fear most — what the fixture never exercises, what the capture
cannot see, whether a test is circular; and asks it to say plainly when a claim survives,
substantiating every finding against code.

**Verify its findings before adopting them**: reproduce each one, and after fixing,
re-run the mutation it used to prove the fix took. Rebut with evidence when it is wrong;
it sometimes is. Used comparatively, it is also worth asking for its reading of a defect's
mechanism *before* you write yours — where you differ, one of you has misread the code.

## Browser checks

- Build a throwaway clone (`npm run build`), then serve its `docs/` with a small Node
  static server through a *temporary* entry in the parent folder's `.claude/launch.json`,
  restoring that file byte-identical afterwards (check the SHA-256). pyenv and the
  Xcode-stub `python3` fail here.
- **Emulate ≥1440 px before judging anything**: below that the layout gate collapses the
  canvas, durations read 0, and a healthy build looks broken.
- A hidden pane throttles `requestAnimationFrame`: step
  `animationEngine.updateAnimation(dt, ts)` by hand, or seek.
- Exported pages expose `window.__routePlotterPlayer`. To check an export without writing
  a file, capture the Blob by stubbing `URL.createObjectURL` and swallowing the
  `<a download>` click; MP4 has `ftyp` at offset 4.
- **CI and Pages:** `gh run watch`, `gh api …/pages/builds/latest`. Rapid merges leave
  superseded Pages builds reported as `errored`; check the build for the SHA you care about.

## Traps this programme has already hit

- **This repository's** jsdom `Image` stub reports 100×100 (`tests/setup.js`), and loading
  a background makes the app follow that as the export resolution. Restore the authored
  resolution afterwards.
- A background's base64 `src` lands in every recorded `drawImage`, which made the draw-log
  goldens enormous until `drawLog.js` shortened it. Gradient labels are numbered per
  context for its whole life, so a transcript must renumber per frame or play ≠ seek.
- **Do not wait for exact floating-point equality from the camera.** It snaps to final
  values only when the zoom is effectively 1×; at any other zoom the centre eases
  asymptotically. Use `CameraService.isZoomTransitioning()` and a bounded loop, and
  remember the rate limiter needs time to advance. A freshly loaded player starts on its
  target while the editor is still easing, which is why their first frames differ — in the
  camera transform only, for the fixture and sequence tested.
- `esbuild` cannot run under jsdom: use `// @vitest-environment node`.
- Stepping the engine 50× by `duration/100` lands a few ulps past 0.5, and on a branched
  route one ulp is a whole extra path point. Compare against the progress actually reached.

## Long-term health: protect these

- Keep the §8.5 retain list and the §10 "don't abstract" list: visibility modes; the save,
  autosave and undo projections; beacon curves; per-control handlers; explicit post-edit
  pipelines.
- Apply §16 before creating anything new. No permanent parallel paths.
- Goldens and architecture rules (eventually GOV-03) are the guard against drift.
- Leave every touched area truer than you found it. Never add a second copy of a fact;
  link to its owner.

## Working with Joe

Joe is a novice coder who owns macro structure, UX and conceptual design. Do the work;
explain only when asked. Ask only what is genuinely his, few and concrete, each with a
recommended default — and check §20 and the decision log first, because he has already
answered more than you think. His call wins; trust his bug instincts and reproduce before
disputing. Short updates while you work; he prefers momentum.

## End every session with a handoff

The current state (`main` SHA, open PRs, CI, live version); what merged or released;
memory written; plan rows patched; metrics deltas at a wave close; the exact next step;
and any question waiting on Joe.

**Begin** by verifying the state above, making the clone, asking Joe the two open
questions in one message, and picking up **DEF-02**.

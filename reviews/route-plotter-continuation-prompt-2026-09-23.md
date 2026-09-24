<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: the codebase abstraction programme (W1 onward)

**Superseded by `route-plotter-continuation-prompt-w2-2026-09-23.md`**, which carries the programme on from W2. This prompt briefed W1, which closed on 2026-09-23; it remains as provenance.

This supersedes `route-plotter-continuation-prompt-2026-09-22.md`, which briefed W0 and remains as provenance. Paste everything below into a fresh chat.

You are continuing an adopted refactoring programme for Route Plotter v3.

**Repository:** `djDAOjones/route-plotter`.
**Maintainer's working copy (OneDrive):** `/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

The owner is Joe. Follow `AGENTS.md` (via `CLAUDE.md`). Where this prompt and the repository disagree, the repository wins, and you tell Joe.

## Purpose

The programme makes the codebase **auditable and safe to change with AI assistance** without changing what users see, apart from defects Joe approves one by one. Every step should leave the code:
- easier to read accurately;
- pinned by tests;
- honest in its documentation.

Two things are never the goal: more abstraction for its own sake, and speed at the cost of reversibility. The strategy is *pin, then prune, then clarify, then consolidate. Never rewrite.*

## Where things stand (verify all of this first; it may have moved)

- **`main` @ `1d2a06b`**, protected (no force-push, no deletion).
- **Live: v3.2.691** (`fb3426c`, tag `v3.2.691`), served by GitHub Pages from `main` `/docs`. Rollback tags: `v3.2.689`, `v3.2.690`, `v3.2.691`.
- **Gate:** `npm run check` → 79 test files · 1,106 tests · 1 todo · shell 0 · build:check 0.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`. 111 items, waves W0–W12. Joe accepted every §20 default on 2026-09-22. Rows shipped since carry dated notes.
- **Line references in the plan are at `2e4d78e`**, and `src/` has moved since (DEF-01). Re-verify every reference before relying on it.

**Done so far (2026-09-22 → 23):**
- **W0 closed**, 6 PRs (#1–#6): DOC-06 (a)–(f), DEF-18, GOV-01, DOC-02, DOC-03. No release needed.
- **Released v3.2.691** with **DEF-01** (the live "Background Mode Debug" overlay, gone from preview, exports and the player).
- **W1 so far:** TST-01 (boot harness + browser-true `setup.js`), ISO-02 (EventBus `onListenerError` + counter), TST-10 (console guard, strict bus, min-count canary), TST-07 (player host contract + bundle closure).

**Backlog `### Next` now holds W1's remainder: TST-06 and TST-02.**

Check with:
- `git fetch`, then `git log -1 origin/main`;
- `gh api repos/djDAOjones/route-plotter/pages --jq .source` and `…/pages/builds/latest --jq '{status,commit}'`;
- `gh run list -L 3`; `gh pr list`;
- a read-only `git status` in the OneDrive copy (Joe keeps it fast-forwarded).

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole; the backlog Active section; the latest decision-log headings (start with "W0 closes" and "v3.2.691").
2. **From the plan, only what the current step needs:** §1; §13 (ground rules and your wave); §12 (its rows); §17 (testing); §18 (metrics); §16 (before any new abstraction); §8.5 and §10 (what to keep and not abstract); §2.9 (round-2 evidence and browser probes).
3. **`DEV-INFRASTRUCTURE.md`** (Quality gate, Runtime lifecycle, Deployment) and **`pm_skills/memory-policy.md`**, whenever you touch releases or memory.

## What the safety net already gives you

Use these rather than rebuilding them:

- **`tests/helpers/bootApp.js`** boots the real app from the shipped `index.html`: `const app = await bootApp({ viewport })`. It stubs `APP_VERSION`, `matchMedia`, a `fetch` that serves the repository, and the layout jsdom lacks; it fails on a swallowed bus error, and stops each app after its test.
- **`tests/setup.js`** gives every canvas its own **recording context**: `ctx.calls` is an ordered transcript of draw calls and style changes, `ctx.takeCalls()` drains a frame, `contextFor(canvas)` fetches it without creating one. `save`/`restore` and canvas resize behave as a real context. It also tolerates the node environment.
- **`tests/helpers/consoleGuard.js`**: any `console.error`/`warn` a test does not declare fails that test. Declare with `allowConsole(/…/)`, read back with `recordedConsole()`. Never silence console with a spy: the guard refuses that.
- **`tests/helpers/minCountReporter.js`**: an unfiltered run executing fewer than 72 files or 1,000 tests fails. Raise the floor as the suite grows; never lower it.
- **Contract tests**: `tests/playerHostContract.test.js` (derived from the mixin source) and `tests/playerBundleClosure.test.js` (esbuild metafile, node environment).

## Standing rules (non-negotiable)

**Environment**
- Work in a **fresh full clone outside OneDrive**, never `--single-branch`.
- The OneDrive copy is Joe's, and other sessions may be in it. **Pause before writing anything there**; update it only by fast-forward when clean.
- Never run `npm run dev`, `npm run build` or `scripts/restart.sh` as a check. The gate is `npm run check`, which is non-mutating.

**Git and releases**
- One concern per PR, on a short-lived branch from `main`, opened with `gh pr create`. CI (`Verify`) must be green.
- **Always base a PR on `main`.** Never stack one PR on another: GitHub merges it into its base branch, and deleting that branch loses the work (this happened on 2026-09-22 and was recovered by cherry-pick).
- **Never commit to or push `main` yourself** (`AGENTS.md` → Commit, push and release). Joe decides every merge; on his word the agent runs `gh pr merge <n> --squash`, keeping the `<ITEM-ID>: summary` title.
- A merge releases nothing: Pages serves the committed `docs/`. A release is `npm run push`, which Joe calls, by the 8 steps in `DEV-INFRASTRUCTURE.md` → Deployment (rollback tag first, then check, dry run, push, Verify, byte comparison, live smoke test, annotated tag, memory PR).
- **Commit messages:** `<ITEM-ID>: summary`, one what/why line, then `Verify: <F> test files · <T> tests · shell 0 · build:check 0`. Never report lint or typecheck; the gate has neither.

**Behaviour**
- Behaviour-preserving PRs leave the characterisation goldens byte-identical.
- Each **DEF** PR states its new behaviour in the description for Joe, and changes only the golden cells it means to.
- A compatibility wrapper lives at most one wave (ground rule 7).
- Deleting a test that pins only dead code needs a decision-log entry listing each test (§20 Q8). Re-pointing an import when code moves is not weakening a test.
- Never touch `docs/`, `_Joe/`, `version.json` or `node_modules/` by hand.

**Memory** (`pm_skills/project/`, single writer)
- One decision-log entry **per wave**, listing each PR's preserved contract; releases get their own entry. Don't edit old entries.
- The backlog `### Next` holds only the current wave; the next enters from plan §13 when it closes.
- One trajectory line per shipped item, starting with its ID.
- Add a `file-map.md` row for every new file, and correct the counts. **Never run `gen-file-map.mjs`.**
- Budget overruns are reported and proposed, never pruned without Joe. His prune bar (decision log, 2026-08-27) outranks the prune-to targets. The decision log is currently over its entry budget by Joe's choice.

**Plan fidelity**
- If evidence shows a row is wrong, patch that row with a dated note, say so in the wave's decision-log entry, and tell Joe.
- Any new behaviour change becomes a proposed DEF row for Joe first.

## How to run the programme

**For each PR**
1. Characterise first: test, golden or `todo` (§17; TST-16's list in §2.9).
2. Make the smallest change.
3. Run `npm run check`, plus targeted tests. Prove every new golden or rule can fail (mutate one thing).
4. Where a user sees the result, re-run the matching §2.9 browser probe.
5. Get a **Codex adversarial review** (below) for anything non-trivial, then fix or rebut its findings with evidence.
6. Open the PR, with the preserved-contract or behaviour-change statement and the verify evidence.
7. Joe decides the merge.

**At wave close:** all PRs merged; Joe decides whether to release; write one decision-log entry, the trajectory lines and the next wave into `### Next`; report the §18 metrics.

**Stop and re-plan when:** a §14.6 invalidation condition appears; a golden cannot be made deterministic; a wave runs past about twice its PR estimate; a plan finding proves wrong in a way that changes sequencing; or Joe changes direction.

## The work in order

**W1, finish the safety net:**
1. **TST-06** — snapshot-shape goldens: a file snapshot per example, `load(save(x))` idempotence, and the "authorable ⇒ loadable" property test (random projects within the UI's reach must pass `stageProject`). Its known failures are `todo` with their DEF IDs (DEF-03/04/31) until W2 fixes them. `_buildProjectSnapshot` is the one save shape.
2. **TST-02** — golden draw logs: 3 examples × 5 instants × edit/preview/export, through the recording context; render-level play == seek, and app == player. Round numbers when serialising so the goldens are stable across machines; prove non-vacuity per golden family.

**Then W2, the urgent live defects**, each its own PR with Joe's approval of the stated behaviour:
- **DEF-02** first: the player never builds `waypointsById`, so every anchored crowd node draws at its authored position. `tests/playerHostContract.test.js` already states this gap and carries the `todo` to flip.
- Then DEF-03 (widen what load accepts, §20 Q3), DEF-23 (filter exports to live references, Q4), DEF-31 (bounded trace IDs). DEF-26 (a short hex glow colour freezes playback) may join them.

**Then W3, the pilot:** SPL-01, move the six pure slider-scale functions out of MotionVisibilityService into `utils/sliderScales`, per §14. Characterise `formatUIValue`'s existing rounding rather than "fixing" it.

Follow §13 for the rest, including ground rule 8's slots for the defects not tied to a wave.

## Co-workers and tools

**Codex (`gpt-6-astra`)** is Joe's preferred independent reviewer, and it has repeatedly found blockers this programme would otherwise have shipped:
- `codex exec -m gpt-6-astra -s read-only -C <clone> -o <out.md> - < <prompt.md>`
- `-s workspace-write` **only** in a throwaway clone with no remote.
- Give it a falsification brief ("try to prove this wrong"), name the exact claims to attack, and verify its findings before adopting them. It is worth writing the brief carefully: its value has tracked the precision of the questions.
- If it hits a usage limit, ask Joe; don't wait silently.

**Browser checks:**
- Build a throwaway clone (`npm run build`), then serve its `docs/` with a small Node static server through a *temporary* entry in the parent folder's `.claude/launch.json`, and restore that file byte-identical afterwards (check the SHA-256). pyenv and the Xcode-stub `python3` fail here.
- **Emulate ≥1440 px before judging anything**: below that the app's layout gate collapses the canvas, durations read 0, and a healthy build looks broken.
- A hidden pane throttles `requestAnimationFrame`: step `animationEngine.updateAnimation(dt, ts)` by hand, or seek.
- Exported pages expose `window.__routePlotterPlayer`. To check an export without writing a file, capture the Blob by stubbing `URL.createObjectURL` and swallowing the `<a download>` click; MP4 has `ftyp` at offset 4.

**CI and Pages:** `gh run watch`, `gh api …/pages/builds/latest`. Rapid merges leave superseded Pages builds reported as `errored`; check the build for the SHA you care about.

## Long-term health: protect these

- Keep the §8.5 retain list and the §10 "don't abstract" list: visibility modes; the save, autosave and undo projections; beacon curves; per-control handlers; explicit post-edit pipelines.
- Apply §16 before creating anything new. No permanent parallel paths.
- Goldens and architecture rules (eventually GOV-03) are the guard against drift.
- Leave every touched area truer than you found it: comments, docs and tests. Never add a second copy of a fact; link to its owner.

## Working with Joe

- Joe is a novice coder who owns macro structure, UX and conceptual design. Do the work, and explain only when asked.
- Ask questions first when a decision is genuinely his, few and concrete, each with a recommended default.
- His call wins. Trust his bug instincts: reproduce before disputing.
- Short updates while you work. He prefers momentum: when he has given a standing go, keep going rather than asking again.

## Open, for Joe

- **DEF-02** is live and now visible as a `todo` in the player contract test.
- **`restart.sh`** proves only that the server answers, while `AGENTS.md` asks runtime recovery to verify readiness as DEV-INFRASTRUCTURE defines it (no console errors, version stamp). Logged on the wish-list.
- **`npm run serve`** does not run the app at `/` and `start` duplicates `dev` (plan SEG-026). Logged on the wish-list.
- **CI could refuse a pull request that touches `docs/` or `version.json`**; today the release steps rely on reading the diff. Logged on the wish-list.

## End every session with a handoff

Include: the current state (`main` SHA, open PRs, CI, live version); what merged or released; memory written; plan rows patched; metrics deltas at a wave close; the exact next step; and any question waiting on Joe.

**Begin** by verifying the state above, making the clone, and picking up TST-06.

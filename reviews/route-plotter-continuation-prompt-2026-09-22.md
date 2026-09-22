<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3: the codebase abstraction programme

This supersedes `route-plotter-continuation-prompt-2026-08-27.md`, which remains as provenance. Paste everything below into a fresh chat.

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

- **`main` @ `cbe4094`**, plus the `PM:` commit that added this prompt. Live site: v3.2.690, served by GitHub Pages from `main` `/docs`. Rollback tags: `v3.2.689`, `v3.2.690`.
- **`main` is protected** (REL-02): no force-push, no deletion.
- **The plan:** `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, about 53k words. It has 111 items: DEF-01..33 are behaviour defects; the rest (TST, DEL, DOC, CON, ABS, SPL, CLR, ISO, DEP, GOV) are behaviour-preserving refactors. It is organised as waves W0–W12.
- **Owner decisions:** on 2026-09-22 Joe accepted **every recommended default in the plan's §20**. See the decision-log entry "2026-09-22 — adopt the codebase abstraction plan, on every recommended default".
- **The backlog** (`pm_skills/project/backlog.md` → `### Next`) holds only W0: DOC-06, DEF-18, GOV-01, DOC-02, DOC-03.
- **DOC-06 progress:** (g) and (h) are done; (i) and (j) are adopted as practice; (a)–(f) remain. **Nothing else is implemented.**
- **Line references in the plan are at `2e4d78e`.** Re-verify every reference before relying on it.

Check with:
- `git fetch`, then `git log -1 origin/main`;
- `gh api repos/djDAOjones/route-plotter/pages --jq .source`;
- `gh run list -L 3`;
- a read-only `git status` in the OneDrive copy.

## Reading order

1. **`AGENTS.md` tiers:** README, brief, architecture and conventions whole; the backlog Active section; the latest decision-log headings.
2. **From the plan, only what the current step needs:**
   - §1 (summary);
   - §13 (ground rules 1–8 and the wave you're in);
   - §12 (the rows for that wave);
   - §17 (testing);
   - §18 (metrics);
   - §16 (before any new abstraction);
   - §8.5 and §10 (what to keep and what not to abstract);
   - §2.9 (round-2 evidence and its browser probes).
3. **`DEV-INFRASTRUCTURE.md`** (Deployment, Runtime lifecycle, Canonical scripts) and **`pm_skills/memory-policy.md`**, whenever you touch releases or memory.

## Standing rules (non-negotiable)

**Environment**
- Work in a **fresh full clone outside OneDrive**, not `--single-branch`.
- The OneDrive copy is Joe's, and other sessions may be working in it. **Pause before writing anything there.** Update it only by fast-forward once it is clean.
- Never run `npm run dev`, `npm run build` or `scripts/restart.sh` as a check; they rewrite tracked `docs/` and `version.json`. The gate is `npm run check`, which is non-mutating.

**Git and releases**
- One concern per PR. Each PR goes on a short-lived branch from `main`, named for example `w0/doc-06a-push-rule`, and is opened with `gh pr create`. CI (`Verify`) must be green.
- **Never commit to or push `main` yourself.** Joe approves every merge.
- Ask Joe once for the merge method (default: squash, keeping the `<ITEM-ID>: summary` title). Record his answer in the wave's decision-log entry.
- A merge that changes shipped code is not live until `npm run push`, and that is a **release**. Joe calls every release. Run it from a fresh clone, tag it, and follow the DEV-INFRASTRUCTURE Deployment steps.
- Until DOC-06 (a) is merged, **ignore `pm_skills/integrations/task.md` step 11** (commit and push after every close). That step is exactly what DOC-06 (a) turns off.
- **Commit messages:** `<ITEM-ID>: summary`, then one what/why line, then `Verify: <F> test files · <T> tests · shell 0 · build:check 0`. Never report lint or typecheck; the gate has neither.

**Behaviour**
- Behaviour-preserving PRs must leave the characterisation goldens byte-identical.
- Each **DEF** PR needs Joe's approval of the *stated new behaviour* before it merges, even though the policy questions are answered. It changes only the golden cells it intends to change, and says so in the PR description.
- A compatibility wrapper lives at most one wave (ground rule 7).
- Deleting a test that pins only dead code needs a decision-log entry listing each test (§20 Q8). A test that uses a dead symbol inside a live assertion is rewritten, not deleted. Re-pointing an import when code moves is not weakening a test.
- Never touch `docs/`, `_Joe/`, `version.json` or `node_modules/` by hand.

**Memory** (`pm_skills/project/`, single writer)
- One decision-log entry **per wave**, listing each PR's preserved contract. The log header says "Don't edit old entries".
- The backlog `### Next` holds only the current wave. When a wave closes, the next wave's rows enter from plan §13.
- Add one trajectory line per shipped item, starting with its ID.
- `file-map.md` is hand-maintained; **never run `gen-file-map.mjs`**.
- Budget overruns are reported and proposed, never pruned without Joe. His prune bar (decision log, 2026-08-27) outranks the prune-to targets.

**Plan fidelity**
- The plan is the design reference. If evidence shows a row is wrong, don't diverge silently: patch that row with a dated note, say so in the wave's decision-log entry, and tell Joe.
- Any new behaviour change becomes a proposed DEF row for Joe first.

## How to run the programme

**At wave kickoff**
- Re-verify each item's evidence against current code.
- Confirm its prerequisites.
- Draft the PR list, each with scope, size (§13 limits), tests-first, preserved contract or intended change, and rollback.
- Show Joe the list in a few lines and get a go. Surface only decisions that are genuinely his.

**For each PR**
1. Characterise first: test, golden or `todo` (§17; TST-16's list in §2.9).
2. Make the smallest change.
3. Run `npm run check`, plus targeted tests.
4. Where a user sees the result, re-run the matching §2.9 browser probe.
5. For anything non-trivial, get a Codex adversarial review (below), then fix or rebut its findings with evidence.
6. Open the PR, with the preserved-contract or behaviour-change statement and verify evidence.
7. Joe approves, and it merges.

**At wave close**
- All PRs are merged.
- Joe decides whether to release.
- Write one decision-log entry, trajectory lines, and the next wave into `### Next`.
- Report the §18 metrics against the baseline:
  - 33 open defects;
  - about 46 dead functions;
  - 47 functions over 100 lines;
  - 0 render goldens;
  - 5 source-text test sites;
  - 52 of 77 orchestrator events never exercised;
  - 13 doc contradictions.

**Stop and re-plan when:**
- a §14.6 invalidation condition appears;
- a golden can't be made deterministic;
- a wave runs past about twice its PR estimate;
- a plan finding proves wrong in a way that changes sequencing;
- Joe changes direction.

## The plan in order

**W0: safe setup (now).** PRs, in this order:
1. **DOC-06 (a).** `AGENTS.md` `## Commit, push and release`: agents use short-lived branches and never commit to or push `main`; `docs/` and `version.json` change only through `npm run push`.
2. **DEF-18.** `push.js` rejects unknown flags and runs `npm run check`. Add the `releaseSafety.test.js` case first: `--dryrun` exits non-zero with no git side effect.
3. **DOC-06 (b)–(f):**
   - a DEV-INFRA `## Quality gate`;
   - alias headings (`Files to never edit`, `Capturing deferred ideas`, the quality-gate label; `Protected infrastructure` is Joe's choice);
   - the testing and refactor-mode one-liners;
   - the boot-check note;
   - the budget/prune-bar clause.
4. **GOV-01.** The branch-per-wave and clone-outside-OneDrive steps go into DEV-INFRASTRUCTURE.
5. **DOC-02.** Fix the 14 doc contradictions in §6 SEG-030, linking rather than restating.
6. **DOC-03.** The §20 Q15 communication rule, in `AGENTS.md`, `architecture.md` and `conventions.md` together.

W0 changes no shipped code, so merging it needs no release.

**Then:**
- **W1, the safety net:** TST-01 boot harness and `setup.js` fidelity first, then TST-10 with ISO-02, TST-07, TST-06 and TST-02.
- **W2 alongside W1:** DEF-01, the live debug overlay, first. DEF-26 may join it.
- **W3, the pilot:** SPL-01 `sliderScales`, per §14.

Follow §13 for the rest, including ground rule 8's slots for the defects that aren't tied to a wave.

## Co-workers and tools

**Codex (`gpt-6-astra`)** is Joe's preferred independent reviewer:
- `codex exec -m gpt-6-astra -s read-only -C <clone> -o <out.md> - < <prompt.md>`
- Use `-s workspace-write` only in a throwaway clone.
- Give it a falsification brief ("try to prove this wrong"), and verify its claims before adopting them.
- If it hits a usage limit, ask Joe; don't wait silently.

**Browser checks:**
- Serve the clone's `docs/` with a small Node static server on its own port, through a *temporary* entry in the parent folder's `.claude/launch.json`, and restore that file byte-identical afterwards. pyenv and the Xcode-stub `python3` fail here.
- A hidden Browser pane throttles `requestAnimationFrame`, so drive `animationEngine._loop` by hand for playback checks.

**CI and Pages:** `gh run watch`, `gh api …/pages/builds/latest`.

## Long-term health: protect these

- Keep the §8.5 retain list and the §10 "don't abstract" list:
  - visibility modes;
  - the save, autosave and undo projections;
  - beacon curves;
  - per-control handlers;
  - explicit post-edit pipelines.
- Apply §16 before creating anything new.
- No permanent parallel paths.
- Goldens and architecture rules (eventually GOV-03) are the guard against drift.
- Leave every touched area truer than you found it: comments, docs and tests. Never add a second copy of a fact; link to its owner instead.

## Working with Joe

- Joe is a novice coder who owns macro structure, UX and conceptual design. Do the work, and explain only when asked.
- Ask questions first when a decision is his, and keep them few and concrete, with a recommended default.
- His call wins. Trust his bug instincts: reproduce before disputing.
- Short updates while you work.

## Known traps

- OneDrive can evict files, and git then stalls; that's why you work in a clone outside it.
- `npm run push` refuses untracked or dirty trees.
- A single-branch clone won't fetch `main`.
- The vendored framework is pristine. Change the root docs, never `pm_skills/*` framework files.
- Two ID look-alikes, left as they are: the plan's DEP-0x is not the dependency ticket DEPS-01, and an old closed `DOC-01` sits in the trajectory archive.

## End every session with a handoff

Include:
- the current state: `main` SHA, open PRs, and CI;
- what merged or was released;
- memory written;
- plan rows patched;
- metrics deltas at a wave close;
- the exact next step;
- any question waiting on Joe.

**Begin** by verifying the state above. Make the clone, then present the W0 PR list for Joe's go.

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

## 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Decision:** the owner's words of 2026-10-05, "continue the dev in gateless fashion, commiting and deploying incrementally" and "using codex as project partner", are the advance grant the rules file asks for: Claude Code plans and executes the backlog, merges each pull request once Verify is green on a head Codex has checked, and releases every merge that changes what ships, on the conditions in the Rationale; this replaces the big run's merge and release conditions of 2026-09-28.

**Rationale:** the conditions are the owner's prompt of 2026-10-05; quoted words are the owner's.
1. Nothing waits for the owner's approval: the prompt is "my standing instruction to plan and execute (plan.md Step 5), my grant for merges and releases, and my word for tools/archive.mjs if the checker asks for an archive."
2. Where the record does not answer a question that rule 2 would put to the owner, the session takes "the narrowest, most conservative reading", says so in one line in the pull request, records it as its own call for the owner to confirm, "never as my decision", and has Codex check the call when it matters. Where no safe reading exists, "or only I can give what's needed (evidence, a dependency, a design call)", the item becomes a `[!]` backlog line with its blocker, listed for the owner, and the run moves on. Work stays "within the brief and the backlog: no new feature work."
3. Each item: a branch from current `main`, named for it; `npm run check` green with current `main` merged in; no test deleted, skipped or weakened; nothing under `docs/` and no `version.json` in the diff; a Chromium check wherever user-facing behaviour changed; closed by `verbs/close.md` and recorded in `project/`, never `pm_skills/`; committed, pushed and opened as a pull request. Up to three items in flight; gates, merges and releases one at a time.
4. Codex reviews read-only, as the profile's Handoff says, briefed from the record as close step 6 says: the item's criteria, the diff against `main`, the rules file's Always and any routed document. It is asked to falsify the change (defects, rule breaks, tests that do not test what they claim) and to rank its findings. Real findings are fixed and the gate re-runs; the rest are rebutted in the pull request body; advisories go to the wish-list. No further rounds, unless a fix is large; then one short pass on that fix alone. Codex also reviews each PLAN-N before it executes. If Codex cannot run, the `Checked:` line says so.
5. Merge once Verify is green on the head, by `gh pr merge N --squash --match-head-commit <sha>` with the `Checked:` line in the body, then delete the branch on the remote; every other branch merges the new `main` before its next push.
6. A merge that changes what ships (`src/`, `styles/`, `index.html`, assets or the build) is released by `DEV-INFRASTRUCTURE.md` → Releasing, in full, every time, from `route-plotter/`; a merge that touches only tests or the record is not. If a check after a release fails, the run rolls back as documented, opens a DEF item, fixes it next and releases nothing else until it is fixed. The browser pane is allowed for the whole run, including saving each release's smoke-test exports: a built-in example, from the live site, as MP4 and as HTML. The first release ships `main` as it stands, everything merged since v3.2.692 (2026-09-24), before anything else lands.
7. One line in chat after each merge and each release. The profile's Session line governs a session's length: past it, the next close is the last (close → Session end), and only Codex reviews stay in flight.

It replaces, in the canon entry "2026-09-28 — the big run: Joe answers the open calls, and delegates merges and planned fixes" (frozen; `project/history.md` → Decision lookup), the standing merge authority and its bar (an independent review of every substantive change, each finding fixed or rebutted, a complete mutation table, goldens moved only as predicted) and the single release at the run's end. That entry's other calls stand: the planned defects and §20's defaults approved in advance, DEF-28's option A, TST-04 before W4 and W4's own mutation criterion, the budgets and the scope, and what stays the owner's (DEF-07's camera feel, and whatever a row or default leaves open); so do the amended entry's answers, "fix defects along the way" among them. Supersedes reads none because this ledger's graph can name only its own headings.

The session's calls, for the owner to confirm: the grant holds for the run, which stops and reports when nothing runnable is left, unless the owner ends it sooner; the brief's Direction and the rules file's Always, both owner-signed, still name the 2026-09-28 delegation and are left unedited, with a wish-list line for the refresh; and the pull request carries this entry's ID, not `PM:`, because `node tools/check.mjs --commit` accepts only a title whose ID the ledger holds.

**Supersedes:** none

**Deferred:** none

## 2026-10-03 — V3-CONFIRM — The working clone sits beside the owner's checkout, kept on the device; gh runs outside the sandbox

**Decision:** sessions work in the fresh clone `route-plotter/` beside the owner's OneDrive checkout, in the same folder, with OneDrive's Always Keep on This Device set on it, because the owner keeps the project's working copy with its other files; and `gh` runs outside the sandbox (`sandbox.excludedCommands`), so each `gh` call asks unless the owner pre-approves it.

**Rationale:** the owner's instruction of 2026-10-03: a fresh clone, but inside the project's OneDrive folder rather than elsewhere on the disk. The working setup in `DEV-INFRASTRUCTURE.md` said "outside OneDrive" because OneDrive can evict `.git` internals to online-only, and git then fails with `mmap failed: Operation timed out`; keeping the clone's folder on the device removes that cause, so the setup and the rules file now name the clone and the setting. The owner's checkout stays his: fast-forward only, when clean. The clone was made on 2026-10-03 from `main` at 662b2e2 with `npm ci`; `npm run check` passed there (93 test files, 1566 tests) and the session hook ran from its path. On `gh` (8ebaad9, #80): under the strict allowlist a sandboxed `gh` is refused, and with `api.github.com` added it fails TLS verification on macOS (x509 OSStatus -26276, the sandbox denies Go the system trust service); tested headless on Claude Code 2.1.267, an excluded `gh` reaches GitHub and a sandboxed `git push` authenticates. The owner chose this over `api.github.com` plus `enableWeakerNetworkIsolation`, which keeps `gh` sandboxed but which the client marks as reduced security.

**Supersedes:** none

## 2026-10-02 — V3-CONFIRM — The owner signs the ledger, confirms Network and Handoff, installs the session hooks

**Decision:** the profile, brief and rules carry the owner's reviewed signature of 2026-10-02 in place of the delegated lines; the Network line (listed hosts github.com, registry.npmjs.org) and the Handoff split (Claude Code executes; Codex reviews read-only) are confirmed and lose their `[guess]`; `.claude/settings.json` and `.claude/settings.intake.json` are committed from `tools/harness.mjs`, with the two session hooks, and `.gitignore` admits those two files — because the owner answered the three open intake questions on 2026-10-02 ("sign both now", the recommended Network and Handoff, "install Claude Code side in both").

**Rationale:** the owner's answers, given in chat on 2026-10-02 after the merge. Two edits to the generated settings, reviewed on his behalf and recorded here: the home directory is written as `~/` rather than an absolute path, since this repository is public; and the denies on `gh`, `git fetch` and `git pull` are removed, since github.com is a listed host and the project's own rules require `gh` for every pull request and a fetch to keep a clone current. The Codex profile is not installed: the lab found the generated profile fails to start a session on Codex 0.155.1, so that side waits for a verified generator. The hooks run only where the client runs them; the first attended session should confirm with `/hooks` that the two SessionStart and PostToolUse hooks are loaded. `[guess]` stays on "Prose: en-GB", which the owner has not addressed. This change lands by pull request under the owner's instruction of 2026-10-02 to progress both projects to full v3 now.

**Supersedes:** none

**Deferred:** none

## 2026-10-01 — INTAKE — Route Plotter adopts pm-next v3 from canon 4.7.0

**Decision:** the project's contract, verbs and tools are pm-next v3's (PM-Skills-lab commit 155f145), the ledger under `project/` is written from the canon record at 75ba7ae — Direction and the full brief from the brief, the rules file from `AGENTS.md` with `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, the dev guide and the abstraction plan kept in place and routed, the architecture carried as a routed file and the conventions as a house digest, every open item as a backlog line with an item file holding its canon text verbatim, every wish line carried — and the canon record under `pm_skills/` is frozen in place, pinned by `project/migration/inventory.json`, because the maintainer named this project for the lab's V3-FIELD on 2026-10-01 and v3's intake verb is the route for a canon project.

**Rationale:** the maintainer's word of 2026-10-01 ("V3-FIELD with uon video helper and route plotter"); the lab's item is V3-FIELD-2 and the pre-registration row is in the lab's V2-FIELD-1 record. Inventory: `project/migration/inventory.json` at the snapshot commit 75ba7ae, written by the lab's `lab/tools/migrate-canon.mjs`; census: `project/migration/census.md`, 499 rows from seven sources — the canon `AGENTS.md`, `CLAUDE.md`, `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, the brief, the conventions and the architecture; the source list was closed by reading the canon contract, its two rulebooks, the three hot memory files it names, the README (product description, no rule), the one ticket (its obligations are its own item's criteria, carried into the item file, not standing rules) and the big run's two decisions of 2026-09-28, whose standing delegation is cited from the rules file and the Direction, never restated; every row was read in its destination's context by this session and, read-only, by Codex Astra, whose twelve findings — a dropped search obligation, a lost scope exclusion, document-maintenance rules and a harness tip retired as machinery, the refactor contract and the W4 group condition uncarried, a close-out read and a watcher-stop step lost, two additions without a source, a contradictory claim on the Network line, the item schema file missing, stale references — were each repaired before the push (the lab's V3-FIELD-2 item). Where each obligation went: the hard rules, the commit-push-release rules, the protected paths and the owner's archive rule to the rules file's Always; the read tiers, workflow, memory budgets, document ownership and framework section aliases retired as canon machinery, replaced by v3's rule 1, the verbs and the checker; the engineering rules (minimal change, documentation, testing and persistence) and the conventions to the house digest; the rulebook rules to their kept files, routed by task; the brief to the full brief, summarised by Direction, with the owner's pending format-9 confirmation as its open question. The canon framework files beside the record stay frozen with it: nothing routes to them, and a retire is a wish line. The Push line keeps the project's own route — the working branch with a pull request, never `main` — which v3's harness-push default admits as the project's origin. What the tool cannot establish, and this session does not claim: that the source list is complete, that each destination keeps its obligation's force; the owner has not yet confirmed the Network line or reviewed the signatures — both are proposals until he does. Settings: `tools/harness.mjs` output recorded in the lab's raw-evidence lane, nothing written into the tree; the two session hooks are offered, installed only on the owner's word. The Network line and the Handoff split are proposed from recorded practice and marked `[guess]`; the three signatures are delegated under the instruction to run V3-FIELD and name it, the owner's reviewed lines due within two weeks (3.8). Known hazard, recorded: the big run was live at migration time with ten open pull requests (#64, #69–#77) whose closes write the canon memory; this migration lands as a pull request the owner merges when the run allows, and any canon write after the snapshot is a reconciliation against the inventory, never a loss. The migration commit carries no product work; its one gate-plumbing edit is the line above.

- Migration edit: package.json — re-applied — `check` ends with `node tools/check.mjs`, so the gate and the Verify workflow run the v3 checker
- Migration edit: AGENTS.md — retired — replaced by v3's contract verbatim; every canon obligation routed by the census
- Migration edit: CLAUDE.md — retired — v3's adapter; its guidance moved to the profile's Harness line and the rules file's Environment

**Supersedes:** none

**Deferred:** none

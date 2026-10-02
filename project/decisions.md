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

## 2026-10-01 — INTAKE — Route Plotter adopts pm-next v3 from canon 4.7.0

**Decision:** the project's contract, verbs and tools are pm-next v3's (PM-Skills-lab commit 155f145), the ledger under `project/` is written from the canon record at 75ba7ae — Direction and the full brief from the brief, the rules file from `AGENTS.md` with `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, the dev guide and the abstraction plan kept in place and routed, the architecture carried as a routed file and the conventions as a house digest, every open item as a backlog line with an item file holding its canon text verbatim, every wish line carried — and the canon record under `pm_skills/` is frozen in place, pinned by `project/migration/inventory.json`, because the maintainer named this project for the lab's V3-FIELD on 2026-10-01 and v3's intake verb is the route for a canon project.

**Rationale:** the maintainer's word of 2026-10-01 ("V3-FIELD with uon video helper and route plotter"); the lab's item is V3-FIELD-2 and the pre-registration row is in the lab's V2-FIELD-1 record. Inventory: `project/migration/inventory.json` at the snapshot commit 75ba7ae, written by the lab's `lab/tools/migrate-canon.mjs`; census: `project/migration/census.md`, 499 rows from seven sources — the canon `AGENTS.md`, `CLAUDE.md`, `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, the brief, the conventions and the architecture; the source list was closed by reading the canon contract, its two rulebooks, the three hot memory files it names, the README (product description, no rule), the one ticket (its obligations are its own item's criteria, carried into the item file, not standing rules) and the big run's two decisions of 2026-09-28, whose standing delegation is cited from the rules file and the Direction, never restated; every row was read in its destination's context by this session and, read-only, by Codex Astra, whose twelve findings — a dropped search obligation, a lost scope exclusion, document-maintenance rules and a harness tip retired as machinery, the refactor contract and the W4 group condition uncarried, a close-out read and a watcher-stop step lost, two additions without a source, a contradictory claim on the Network line, the item schema file missing, stale references — were each repaired before the push (the lab's V3-FIELD-2 item). Where each obligation went: the hard rules, the commit-push-release rules, the protected paths and the owner's archive rule to the rules file's Always; the read tiers, workflow, memory budgets, document ownership and framework section aliases retired as canon machinery, replaced by v3's rule 1, the verbs and the checker; the engineering rules (minimal change, documentation, testing and persistence) and the conventions to the house digest; the rulebook rules to their kept files, routed by task; the brief to the full brief, summarised by Direction, with the owner's pending format-9 confirmation as its open question. The canon framework files beside the record stay frozen with it: nothing routes to them, and a retire is a wish line. The Push line keeps the project's own route — the working branch with a pull request, never `main` — which v3's harness-push default admits as the project's origin. What the tool cannot establish, and this session does not claim: that the source list is complete, that each destination keeps its obligation's force; the owner has not yet confirmed the Network line or reviewed the signatures — both are proposals until he does. Settings: `tools/harness.mjs` output recorded in the lab's raw-evidence lane, nothing written into the tree; the two session hooks are offered, installed only on the owner's word. The Network line and the Handoff split are proposed from recorded practice and marked `[guess]`; the three signatures are delegated under the instruction to run V3-FIELD and name it, the owner's reviewed lines due within two weeks (3.8). Known hazard, recorded: the big run was live at migration time with ten open pull requests (#64, #69–#77) whose closes write the canon memory; this migration lands as a pull request the owner merges when the run allows, and any canon write after the snapshot is a reconciliation against the inventory, never a loss. The migration commit carries no product work; its one gate-plumbing edit is the line above.

- Migration edit: package.json — re-applied — `check` ends with `node tools/check.mjs`, so the gate and the Verify workflow run the v3 checker
- Migration edit: AGENTS.md — retired — replaced by v3's contract verbatim; every canon obligation routed by the census
- Migration edit: CLAUDE.md — retired — v3's adapter; its guidance moved to the profile's Harness line and the rules file's Environment

**Supersedes:** none

**Deferred:** none

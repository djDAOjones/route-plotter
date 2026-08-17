# Changelog — 3.x epoch (archived)

Archived verbatim from `pm_skills/CHANGELOG.md` (CL-HORIZON,
4.5.0). Append-only history: never rewrite an entry here.
`prompts/upgrade.md` Step 2 walks this file when a project's
version gap starts in this epoch.

---

## 3.17.0 — 2026-07-16

ITEM-AGE: standing human-owned work no longer ages invisibly. The
framework already keeps `[maintainer]`/`[sign-off]`/`[blocked]` items
*visible*, but visibility without age decays into wallpaper (the Hub
left a leaked API key tracked-but-unrotated for ~7 weeks). This surfaces
age at the moment a human is already choosing what to do — the Start B
pick — adds a new `[security]` flag for live exposure that banners at
every session start until closed, and gives Diagnose a matching check.
Informational only: age never reorders the queue. Minor.

### Added

- `pm_skills/prompts/session-start.md` — a **Security banner (both
  starts)** section: any open `[security]` item prints one banner line
  at the top of every session, on Start A and Start B alike, until it is
  closed (one line maximum — a wall of nags gets ignored). Start B's
  "Present the pick" output gains item 7, **Ageing standing items**: up
  to the 3 oldest `[maintainer]`/`[sign-off]`/`[blocked]` items with
  their age, computed from each item's date (`since <date>` fallback
  when shell date arithmetic is unavailable).
- `pm_skills/prompts/memory-maintenance.md` — Diagnose gains check 12,
  **Ageing standing items**: WARN on items past the age threshold or on
  any open `[security]` item; action is maintainer review.
- `pm_skills/memory-policy.md` — a **Standing-item age** row (WARN at
  30 days); it is a visibility nudge, not a size budget, and never
  auto-escalates an item's position.

### Changed

- `pm_skills/project/backlog.md` — ticket-grammar comment (the canonical
  copy) documents the `[maintainer]` and `[security]` flags and the
  convention that standing items carry their creation date
  (`YYYY-MM-DD`). `[security]` is reserved for live exposure (a leaked
  credential or open auth hole; nothing weaker) and a leaked-credential
  tracking item is flagged `[security]` on creation.
- `pm_skills/GUIDE.md` — the "Pick" section notes that the pick surfaces
  standing-item age and that a `[security]` item banners every session.

### Upgrade actions

- `session-start.md`, `memory-maintenance.md`, `memory-policy.md`, and
  `GUIDE.md` are `framework` — overwrite wholesale with the new
  versions after the Step 4 customisation check.
- `pm_skills/project/backlog.md` is `project-memory` (never overwritten):
  add the new flags and the standing-item date convention to your own
  ticket-grammar comment by hand — copy the `[maintainer]`/`[security]`
  flag lines and the "Standing items … carry their creation date"
  paragraph from the template. Then, going forward, put a creation date
  on new standing (`[maintainer]`/`[sign-off]`/`[blocked]`) items so
  Start B can age them, and flag any live-exposure item `[security]`.
- No migration of existing items is required; undated standing items
  simply show no age until you add a date. No MANIFEST or root-template
  change.

## 3.16.0 — 2026-07-16

NEXT-CMD: the proven `/next` loop ships as a distributed workflow —
one word picks the next backlog item, builds it auto-jazz, and closes
it. Composes existing pieces (Start B + task.md + end-of-task.md); no
new mechanism, backward compatible.

### Added

- `pm_skills/integrations/next.md` — one-word "run the next backlog
  item" trigger. Runs `session-start.md` → Start B to pick, then
  `task.md` auto-jazz to build, then `end-of-task.md` to close; the
  invocation is the go-ahead (no stop-for-confirm) and it ships one
  item per invocation. Guardrails preserved: `[sign-off]` items
  escalate to `full` mode, wish-list triage and the reconcile gate
  still run, and the `task.md` hard prohibitions still stop-and-ask.
  Inherits the `framework` class (`integrations/*`).

### Changed

- `pm_skills/GUIDE.md` — `integrations/` file tree lists `next.md`;
  the "Pick" section documents the one-word trigger and its
  guardrails.
- `README.md` — commands table gains a "Run next" row.

### Upgrade actions

- Copy `pm_skills/integrations/next.md` into the project. If your AI
  tool uses a workflow directory, also copy it there (alongside the
  other `integrations/*` files). No migration; no project-memory or
  root-template change.

## 3.15.3 — 2026-07-16

REPO-REVIEW: fixes from a full source-tree review. One code defect and
one doc clarification; no new files, no migration.

### Changed

- `pm_skills/scaffold/gen-file-map.mjs` — idempotence fix: the role
  parser read the generated `<!-- file-map-index -->` block's section
  lines (`` - `dir` — N file(s) ``) as path roles, so every re-run over
  an existing map flagged each section name under "No longer on disk".
  The index block is now excluded from role parsing; running the
  generator twice with no tree change again produces no diff, as its
  header promises.
- `pm_skills/GUIDE.md` — the scaffold file tree now notes that
  `gen-file-map.mjs` runs in place from `scaffold/` (copy it out only
  to customise), matching the file's own header and init.md Step 9,
  which copies the other scaffold files but not this one.

### Upgrade actions

- `pm_skills/GUIDE.md` — pick up via the normal `prompts/upgrade.md`
  diff; no per-project change to apply.
- `pm_skills/scaffold/gen-file-map.mjs` — the `scaffold` class is never
  overwritten by upgrade. **Manual action if you use the generator:**
  running it in place from `pm_skills/scaffold/`, replace that file with
  the new version; running a copied-out fork, port the fix (exclude the
  `<!-- file-map-index -->` block before parsing existing roles). A map
  already carrying a spurious "No longer on disk" block from this bug:
  delete the spurious directory-name lines once, then regenerate.

---

## 3.15.2 — 2026-07-16

REVIEW-FIXES: hygiene from the first review pass over the self-hosted
releases (3.15.0–3.15.1). Prose correction only; no behaviour change.

### Changed

- `pm_skills/CHANGELOG.md` — the 3.15.1 entry pointed two closed
  findings at a repo-specific decision-log path that means nothing to
  consuming projects (distributed files never reference source-only
  paths). Reworded to repo-neutral prose; that entry's Upgrade
  actions are untouched.

### Upgrade actions

- None. Changelog prose correction only; nothing to apply.

---

## 3.15.1 — 2026-07-16

ADOPT-FIXES: fixes from adopt.md's first real run (the SELF-HOST
dogfood). One distributed change plus two findings closed as
record-why-not.

### Changed

- `pm_skills/integrations/adopt.md` — Step 0 gains a **framework
  source tree** exception: a `pm_skills/VERSION` that belongs to the
  product itself (a clone/fork of the framework, root templates still
  carrying placeholders, no populated `pm_skills/project/*`) is not a
  prior deployment and must not route to `upgrade.md`. Prevents the
  confusing misroute anyone self-hosting a framework fork would hit.

Findings closed without a change (recorded in the framework
repository's own decision log): the `gen-file-map.mjs` `IGNORE` knob
worked as designed (copy-it-out path), and the `pm_skills/project/`
memory-home assumption is a repo-contract concern, not a prompt
change.

### Upgrade actions

- No file copies. One edit to an existing framework file
  (`pm_skills/integrations/adopt.md`) — pick it up via the normal
  `prompts/upgrade.md` diff. No per-project change to apply.

---

## 3.15.0 — 2026-07-16

CODEBASE-AUDIT: an invocable whole-codebase audit path. Composes the
existing review machinery into an outer loop instead of leaving the
"review the whole repo" habit in the maintainer's head. New `GUIDE.md`
subsection "Auditing the whole codebase" (under "The daily loop", after
"After an autonomous run"): the recipe — enumerate chunks from
`file-map.md` sections (directory-grouped, budget-aware), review each
chunk via `review.md` feature-area mode (findings-only, bounded
per-chunk read cost, resumable across sessions), aggregate into one
severity-tagged report stored cold, then triage into backlog/wish-list
with structural items spun out as `refactor`-mode tasks — never edited
inline. Adopt-tier repos with no generated file map chunk by top-level
directory; a dedicated `audit.md` is deferred until real use shows the
recipe under-specifies. New `prompts/review.md` "Whole-repo audit (all
sections)" note in Inputs: review.md is the per-chunk engine the recipe
calls; run it once per section, don't pass one oversized area. Chunking
is the point — a single unbounded pass is the anti-pattern the
sectional file map fixed. No new files; MANIFEST unchanged. Minor.

### Upgrade actions

- No file copies. Two edits to existing framework files
  (`pm_skills/GUIDE.md`, `pm_skills/prompts/review.md`) — pick them up
  via the normal `prompts/upgrade.md` diff. No per-project change to
  apply; the recipe is available from the next review/audit session.

---

## 3.14.1 — 2026-07-16

MODEL-TIER: model-tier guidance (Wave 4 tail). Guidance-only, no
mechanism — tells users which work is safe on a cheaper/faster model and
which wants the stronger tier. New `GUIDE.md` paragraph in "Looking
after project memory": memory maintenance is mostly mechanical (counts,
greps, `tail`/`diff` verification, log harvesting) and that half runs
cheap; judgement steps (scoping, design options, validation, review, any
**propose** step) and multi-step protocol closes (release + end-of-task
checklists) want the stronger tier — protocol adherence and judgement
degrade first on cheap models. The split is per-*step*, not per-session.
New scoping line in `prompts/memory-maintenance.md`'s shared-rules
header: the mechanical halves (every count, Diagnose's greps, Prune
P1/P4/P5 detect/execute/verify, Reconcile's log harvesting) run cheap;
the propose steps (Prune P2, Refactor R3, Reconcile RE3) and any
judgement call want the stronger tier — per-step, cross-referencing the
GUIDE. Evidence: the 2026-07-16 self-hosting burst directly tracked
session quality to model tier — the weak-model SPIKE session skipped the
preflight note and release consistency check, never re-ran the gate, and
introduced the burst's only semantic defect (evaluations/
2026-07-16-recent-dev-review.md W2). No new files; MANIFEST unchanged.
Patch.

### Upgrade actions

- No file copies. Documentation-only: the guidance applies from the next
  memory-maintenance or release/close on any repo — no per-project
  change to apply.

---

## 3.14.0 — 2026-07-16

MULTI-WRITER: parallel-session and multi-machine hardening. Turns the
`memory-policy.md` "one writer at a time" rule — which named the
constraint but gave parallel/multi-machine work no mechanism — into a
concrete, advisory protocol (no lockfiles; a crashed session must never
block the next one). New `session-start.md` "Parallel-session claim
(skip if solo)" section: a session declares its file set in chat and
checks `git status` before writing, and — the same-repo failure this
framework hit on 2026-07-16 — states the **provenance** of any
uncommitted changes it did not make (which session/machine/human, or
"unknown") before building on them, treating "unknown" as external code
(verify + gate before folding). New `end-of-task.md` "Secondary-session
close (parallel work)" section: the non-primary session runs the gate +
boot check but defers memory writes, emitting a structured `Handoff:`
block the primary (or the next Reconcile) applies — making concrete
memory-policy's "report their updates for the next serial close". New
`GUIDE.md` "Parallel and multi-machine work" subsection: git is the sync
channel, never the filesystem; the arrival procedure; the
single-worktree concurrency limitation. `task.md` step 11 staged-set
echo gains the "stage explicit paths only, never `git add -A` while
parallel" caveat. `memory-policy.md` one-writer rule now points at all
three mechanism homes. Advisory-only (no `.claims` lockfile — the
manual chat + `git status` pattern worked ~15 times on the Hub; add a
scratch file only if a real collision recurs). No new files; MANIFEST
unchanged. Minor.

### Upgrade actions

- No file copies. From the next session on a repo where parallel or
  multi-machine work happens: declare your file set and check
  `git status` at start (`session-start.md` → "Parallel-session
  claim"); if you find uncommitted changes you did not make, state their
  provenance before building on them and treat "unknown" as external
  code. Parallel secondary sessions close via the new
  `end-of-task.md` "Secondary-session close" handoff block instead of
  writing memory. Solo, single-machine projects need do nothing — the
  claim step is skipped when solo.

## 3.13.0 — 2026-07-16

COMMIT-STEP: per-task commit checkpoints in the task workflow. Codifies
the per-ticket commit habit the Digital Art Audience Hub converged on by
trial (per-ticket, ID-titled commits carrying gate results in the body),
so a rollback point and a `git log` verification ledger exist from a
project's first week instead of emerging by trial. Recommend-commit
only — never auto-commit or push. New `integrations/task.md` step 11
"Recommend a commit (checkpoint)": message shape aligned with the
`Close: lite` trailer grammar (`<ITEM-ID>: <summary>` title + what/why +
`Verify:` line); a **staged-set echo** (files about to be committed vs
files the task touched, flagging any omission — the failure mode where a
release commit shipped without its own changelog entry); a shell-safety
one-`-m`-per-line example (the Hub misfired bare ` -m ` chains); a
long-run per-milestone checkpoint note mirroring `init-mvp.md`; and a
non-git skip. `end-of-task.md` step 5 report gains a commit-status line
(`committed` / `staged — commit recommended` / `not staged`). GUIDE
daily-loop "Commit as you close" paragraph. No new files; MANIFEST
unchanged. Minor.

### Upgrade actions

- No file copies. When you next run `integrations/task.md`, its close
  now ends with a recommend-commit step (step 11): after the gate is
  green and memory is written, the agent stages the change set, echoes
  the staged files against the files touched, and proposes a commit with
  the `<ITEM-ID>: <summary>` + `Verify:` message shape — it does not
  auto-commit or push. Adopt the message shape for your project's
  commits so lite and full closes read the same in `git log`.

## 3.12.1 — 2026-07-16

Consistency fixes from a same-day review of the 3.2.0–3.12.0 burst
(eleven releases in one sitting). No new capability; five cross-file
inconsistencies the burst left behind. Patch.

### Fixed

- **Spike close mode** (`integrations/task.md`) — the spike section said
  "close `lite` by default", contradicting step 10's "never default to
  lite" and, worse, breaking Reconcile: a spike writes its findings
  decision-log entry and resolves its backlog item at close, so a
  `Close: lite` trailer would later hand Reconcile an item it cannot
  evict (RE4 lossless-check mismatch). A spike now closes **full with a
  reduced surface** — the findings entry and backlog resolution are the
  memory writes; trajectory/file-map are skipped because throwaway code
  does not ship. Never lite.
- **Generator path** — `scaffold/gen-file-map.mjs` resolved from no
  project root (the file ships at `pm_skills/scaffold/`). All operative
  references now use the full path: `AGENTS.md` (read tiers),
  `prompts/session-start.md`, `prompts/end-of-task.md` (the `node`
  command), `memory-policy.md`, the `project/file-map.md` template
  comments, and the generator's own usage lines and emitted header/index
  text.
- **Scaffold class on upgrade** (`prompts/upgrade.md` Step 3) — "never
  touched on upgrade; skip" made the 3.5.0 upgrade action ("copy
  `gen-file-map.mjs` into the project") a dead letter. The rule now
  reads: never overwrite an existing copy, but a **new** scaffold file
  named by a changelog entry's Upgrade actions is copied in once.
- **Mode-list drift** — `prompts/session-start.md` Start B's
  recommended-mode line gains `refactor` (3.10.0 omission);
  `init.md` Step 11's mode list gains `spike` and `refactor`
  (3.9.0/3.10.0 omissions).

### Upgrade actions

- Overwrite the `framework` files: `pm_skills/integrations/task.md`,
  `pm_skills/prompts/session-start.md`, `pm_skills/prompts/end-of-task.md`,
  `pm_skills/prompts/upgrade.md`, `pm_skills/memory-policy.md`,
  `pm_skills/init.md`, and `pm_skills/scaffold/gen-file-map.mjs`*
  (*scaffold-class: overwrite only if the project has not customised its
  copy — the change is comment/emitted text only).
- `AGENTS.md` is `root-template` (3-way merge): in the hot-sectional
  `file-map.md` bullet, correct the generator path to
  `pm_skills/scaffold/gen-file-map.mjs`.
- `pm_skills/project/file-map.md` is `project-memory` — not overwritten.
  Optionally correct the generator path in its header comments by hand,
  or let the next generator run refresh the index line.
- No new files, no `MANIFEST.md` change, no migration. Projects that
  never used spike mode or the generator are unaffected.

## 3.12.0 — 2026-07-16

Adds a **protected-doc sync loop**. Protected docs (SPEC, ADRs, and kin)
are correctly edit-on-request only, but nothing scheduled their
reconciliation, so flagged deltas accumulated silently (the Hub's DOC-1
ticket ballooned to 13 KB — 4× the ticket soft cap — with per-file edit
lists deferred for weeks). This gives the debt a **ledger**, an **age**,
and a **batched sign-off pass**. A new cold-tier
`pm_skills/project/doc-deltas.md` captures one line per delta at task
close; session start surfaces the open count + oldest age; a 5th
`Doc-sync` verb in `memory-maintenance.md` presents each doc's batched
diff for sign-off, applies approved edits, and ticks the lines; Diagnose
gains a ledger-health check. The ledger is **capture-only** (the DOC-1
lesson — the edit is derived fresh from the source at sync time, never
stored) and nothing auto-edits a protected doc. Implements DOC-SYNC
(Wave 3). Minor.

### Added

- `pm_skills/project/doc-deltas.md` — new `project-memory` (cold-tier)
  ledger template: capture-only, one checkbox line per delta, mirrors the
  wish-list template's capture/triage-boundary comments.

### Changed

- `pm_skills/prompts/memory-maintenance.md` — new **Doc-sync** verb
  (DS1–DS6 + rules); intro now lists five verbs; Diagnose gains check 11
  (doc-delta ledger health); Prune P2 gains a `doc-deltas.md` handling
  line (delete `[x]` lines, propose Doc-sync for open overrun);
  frontmatter description updated.
- `pm_skills/prompts/end-of-task.md` — step 3 gains a `doc-deltas.md`
  capture bullet; size-check full sweep counts open deltas; overrun
  action proposes Doc-sync.
- `pm_skills/prompts/session-start.md` — Start B surfaces
  `doc-deltas: N open, oldest DATE` (nudge, not gate); cold-tier
  reference list gains the ledger.
- `pm_skills/prompts/review.md` — the feature-area protected-doc
  currency check now also appends a one-line delta to the ledger.
- `pm_skills/memory-policy.md` — new budget row: `doc-deltas.md` open
  deltas (10 open **or** oldest 30 days).
- `pm_skills/MANIFEST.md` — `pm_skills/project/doc-deltas.md` →
  `project-memory` row.
- `AGENTS.md` (root template) — cold-tier bullet for `doc-deltas.md`.
- `pm_skills/GUIDE.md` — file tree, memory-update table, and the
  maintenance-verbs list (now five) document the ledger and Doc-sync.

### Upgrade actions

- Adopt the updated `pm_skills/prompts/memory-maintenance.md`,
  `end-of-task.md`, `session-start.md`, `review.md`,
  `pm_skills/memory-policy.md`, `pm_skills/MANIFEST.md`, and
  `pm_skills/GUIDE.md` (all `framework` — distributed via existing
  globs). Projects that customised any of these should re-apply the
  doc-sync additions.
- **New `project-memory` file:** create
  `pm_skills/project/doc-deltas.md` from the source template (upgrade
  Step 8 "new project-memory file → create from template, skip if
  exists"). There is nothing to preserve; it starts empty.
- Merge the `AGENTS.md` cold-tier `doc-deltas.md` bullet into the
  project's `AGENTS.md` (root-template 3-way merge, Step 7).
- **Optional migration** — a project that has been tracking protected-doc
  drift in an ad-hoc ticket (the Hub's `tickets/DOC-1.md`) can fold its
  per-doc flags into `doc-deltas.md` as one capture line each, then
  delete the ticket. One-time, Reconcile-style; do it only if the ledger
  is a better home than the existing ticket.

## 3.11.0 — 2026-07-16

Extends `review.md` to accept a **feature area** as its review scope, not
just a diff range. Give it a name plus its IDs (epic letter, ticket IDs)
and/or entry-point files; the Load step assembles the change set with
`git log --grep='<ID>'` per ID, unions the touched files, and pulls the
matching `trajectory.md` / `decision-log.md` entries — stating the
assembled commit list and file set before auditing so the scope is
explicit and correctable. This is the natural review unit once batches
ship gateless and lite-closed. Everything downstream (scope adherence,
contract audit, risk, verdict) runs unchanged; the intent map groups by
ticket ID. Feature-area reviews add one protected-doc currency check
(does the doc still describe this area's current behaviour?) as a
punch-list flag. Cross-referenced from `memory-maintenance.md` Reconcile:
a reconciled batch is a ready-made area to review. Based on the Hub's
improvised Wave-6 "concept-alignment audit". Implements REVIEW-AREA
(Wave 3). Minor.

### Changed

- `pm_skills/prompts/review.md` — Inputs gains a feature-area shape
  (name + IDs/entry points, one area per run, refuse areas that don't map
  to greppable IDs or named files);
  Load step documents change-set assembly and mandates an assembled-scope
  statement before auditing; intent map groups by ticket ID for area
  reviews; contract audit gains a protected-doc currency check.
- `pm_skills/prompts/memory-maintenance.md` — Reconcile RE6 suggests a
  feature-area review of the reconciled batch (propose, don't run).
- `pm_skills/GUIDE.md` — `review.md` file-tree line notes "or feature
  area"; "After an autonomous run" section documents the feature-area
  input.

### Upgrade actions

- Adopt the updated `pm_skills/prompts/review.md`,
  `pm_skills/prompts/memory-maintenance.md`, and `pm_skills/GUIDE.md`.
  No new files, no memory-contract change, no MANIFEST change —
  distributed via existing globs. Projects that customised `review.md`
  should re-apply the feature-area Inputs/Load additions.

## 3.10.0 — 2026-07-16

Adds **refactor mode** to `task.md` — a behaviour-preserving
restructuring mode whose acceptance criterion is fixed: **observable
behaviour unchanged**. It gates like `checkpoint` (scope approves the
declared surface, option approves the restructuring shape) and lifts the
">5 files not in scope" hard prohibition **within the declared surface
only**. Carries a named preservation contract (tests green before and
after, no event/data-model/API/route delta, an explicit
preserved-interface list re-verified by grep, build-artefact sanity) and
a green-`check` baseline precondition. Based on three Hub refactors
(HELP-9, MOD-2, LINKS-2) that each had to improvise this contract
through generic modes. The `refactor` mode (code/structure) is distinct
from the `Refactor` verb in `memory-maintenance.md` (project memory).
Implements REFACTOR-MODE (Wave 3). Minor.

### Changed

- `pm_skills/integrations/task.md` — new `refactor` row in the mode
  table; mode-inference paragraph maps "refactor this" / "restructure
  without changing behaviour" → refactor mode; the >5-file prohibition
  notes the in-surface lift; new "Refactor mode" section (declared
  surface, baseline precondition, preservation-contract checklist,
  constraints, memory Refactor-verb disambiguation); frontmatter mode
  list updated.
- `pm_skills/prompts/validation.md` — generic pointer: in `refactor`
  mode, also run the task.md preservation contract. Prompt stays
  mode-agnostic; the checklist lives in task.md.
- `pm_skills/GUIDE.md` — mode table and `task.md` file-tree listing gain
  the `refactor` row; one-line disambiguation from the memory Refactor
  verb.

### Upgrade actions

1. Replace `pm_skills/integrations/task.md` with the new version (adds
   the `refactor` mode row, inference, in-surface prohibition lift, and
   the "Refactor mode" section).
2. In `pm_skills/prompts/validation.md`, add the `refactor`-mode pointer
   bullet to the Rules block.
3. In `pm_skills/GUIDE.md`, add the `refactor` row to the mode table and
   the `task.md` file-tree line, plus the one-line disambiguation.
4. No new files. MANIFEST unchanged.

---

## 3.9.0 — 2026-07-16

Adds **spike mode** to `task.md` — a timeboxed exploratory mode where
findings are the deliverable and code is throwaway. Use it when a
backlog item carries the `[spike]` flag or you say "spike this". One
session, one question; the spike delivers a decision-log entry (and
optionally a `spec/<topic>-findings.md`), then resolves or replaces the
item with concrete follow-up tickets. Closes `lite` by default. Based
on two Hub precedents (REC-VERIFY, NET-1) that had to bend task.md to
do what spike mode now documents directly. Implements SPIKE (Wave 3).
Minor.

### Changed

- `pm_skills/integrations/task.md` — new `spike` row in the mode table;
  new "Spike mode" section (contract, deliverables, constraints, steps);
  mode-inference paragraph now maps `[spike]` → spike mode; frontmatter
  updated.
- `pm_skills/prompts/session-start.md` — Start B "Recommended mode"
  line now lists `spike` and recommends it for `[spike]`-flagged items.
- `pm_skills/project/backlog.md` — ticket grammar comment annotates
  `[spike]` with its mode mapping (`→ spike mode in task.md`) and
  `[sign-off]` with `→ full mode` for parity.
- `pm_skills/GUIDE.md` — mode table gains the `spike` row; file-tree
  listing for `task.md` includes spike in the mode list.

### Upgrade actions

1. Replace `pm_skills/integrations/task.md` with the new version.
2. In `pm_skills/prompts/session-start.md`, update the "Recommended
   mode" line (item 4 under "Present the pick") to include `spike` and
   the `[spike]`-flag recommendation.
3. In `pm_skills/project/backlog.md`, update the ticket-grammar comment
   to annotate `[spike]` with `→ spike mode in task.md`.
4. No new files. MANIFEST unchanged.

---

## 3.8.0 — 2026-07-16

Adds a **security baseline** as the fifth tiered build/run/ship
capability, joining runtime recovery (2.3.0), self-explaining runtime
(2.4.0), quality gate (2.6.0), and version identity (3.1.0). Expressed
the same way — an `AGENTS.md` hard rule whose implementation scales by
tier plus a populated `DEV-INFRASTRUCTURE.md` section — and it carries
the piece the Hub incident proved matters most: a **rotation-first
leaked-credential response playbook**. The Hub left a real API key
unrotated for ~7 weeks with a standing tracking item that did nothing;
tracking is not remediation, rotation is. Implements SEC-BASE (Wave 3).
Minor.

### Changed

- `AGENTS.md` (root template) — new **Security baseline** hard rule
  (secrets outside the repo; never in URLs, logs, QR codes, or the
  diagnostics bundle; committed template values are placeholders;
  dependency advisories triaged on a cadence and at upgrade;
  rotate-first on a leak), tiered like the other four capabilities and
  cross-referencing the diagnostics-redaction rule rather than
  restating it. Matching anti-pattern bullet added.
- `DEV-INFRASTRUCTURE.md` (root template) — new **Security baseline**
  section after "Quality gate": Tier 0–2 shape (secret storage, `.env`
  workflow, `.gitignore` coverage, a report-only key-shape scan folded
  into `check`, dependency-audit cadence) plus the rotation-first
  response playbook.
- `pm_skills/init.md` — Step 8 populate list gains a "Security baseline"
  item (renumbered 7–14); a Step 10 readiness checkbox; and an
  "Appendix B — Security baseline example" (Tier 1 worked shape).
- `pm_skills/prompts/deploy.md` — the pre-flight "Secrets are external"
  check now points at the Security baseline section and its
  rotation-first playbook.
- `pm_skills/prompts/scoping.md` — new secret-surface flag (mirrors the
  runtime / diagnostics / quality-gate flags).
- `pm_skills/prompts/validation.md` — new "Secret surface" check
  (inserted as item 6; test-plan/edge/signs renumbered 7–9).

### Upgrade actions

- `AGENTS.md` and `DEV-INFRASTRUCTURE.md` are `root-template` (3-way
  merge): add the new **Security baseline** hard rule + anti-pattern
  bullet, and the new **Security baseline** section (after "Quality
  gate"), preserving every populated section verbatim. A project that
  already documents secrets handling folds it under this heading.
- `pm_skills/init.md`, `pm_skills/prompts/deploy.md`,
  `pm_skills/prompts/scoping.md`, and `pm_skills/prompts/validation.md`
  are `framework`: overwrite wholesale after the Step 4 customisation
  check.
- No `MANIFEST.md` change (no new paths; the scaffold secret-compose
  script is deferred to a follow-up — documented pattern only for now).

## 3.7.0 — 2026-07-16

Makes **session transcripts** a first-class (but cold, gitignored)
artefact. Framework evaluations, retrospectives, and prompt-tuning now
have observable session evidence instead of inference — the 2026-07-16
Hub case study was blind to May–June because no transcripts existed for
those months. Documents a convention only; no scripts, no new prompt
file, tool-dependent export stays a habit not a mechanism. Implements
TRANSCRIPTS (Wave 2). Minor.

### Added

- `pm_skills/GUIDE.md` — "Saving session transcripts" section: the
  `_transcripts/` convention (folder at project root, naming
  `YYYY-MM-DD-<ITEM-ID-or-topic>.md`, cold tier, gitignored by default,
  redact-before-commit rule cross-referencing the diagnostics redaction
  invariant, and a retrospective-evaluation pointer).
- `pm_skills/scaffold/.gitignore` — ignores `_transcripts/` by default,
  so transcripts stay local unless deliberately committed after a
  redaction pass.

### Changed

- `AGENTS.md` (root template) — new cold-tier bullet for
  `_transcripts/*.md` (never auto-read; points at the GUIDE section).
- `pm_skills/prompts/end-of-task.md` — the closing report gains one
  non-blocking reminder to save the conversation to `_transcripts/`
  (redact before committing). Never gates the close.

### Upgrade actions

- `AGENTS.md` is `root-template` (3-way merge): add the `_transcripts/*.md`
  cold-tier bullet under "Cold — never auto-read", after the
  `tickets/<ITEM-ID>.md` bullet, preserving all populated sections.
- `pm_skills/GUIDE.md` and `pm_skills/prompts/end-of-task.md` are
  `framework`: overwrite wholesale after the Step 4 customisation check.
- `pm_skills/scaffold/.gitignore` is `scaffold` (never touched on
  upgrade): the project owns its copy. Optionally add `_transcripts/`
  to the project's own root `.gitignore` to adopt the convention — not
  required, and no effect until a `_transcripts/` folder is created.
- No `MANIFEST.md` change (no new paths; all touched files already
  classed).

## 3.6.0 — 2026-07-16

Adds an **adoption path** for projects that already have code.
`init.md` interviews for a new project and `init-mvp.md` builds one
from an idea; neither covers arriving with a mature or half-built
repository. `integrations/adopt.md` reverse-engineers project memory
from the source tree and git history, then interviews only for the gaps
the repo cannot fill — the retrofit the Hub proved by hand, now a
first-class workflow. Implements ADOPT (Wave 2). Minor.

### Added

- `pm_skills/integrations/adopt.md` — retrofit workflow (`framework`
  class, inherited from `integrations/*`). Step 0 detects prior
  pm-skills and routes to `upgrade.md`; Phase 1 is a read-only inventory
  (file-map via `gen-file-map.mjs`, stack from manifests, trajectory
  seed from `git log`, brief that links existing docs, conventions by
  sampling) with a per-directory read-cost cap; Phase 2 is a single
  gap interview (~8 questions, batched) writing the memory files with a
  single seed decision-log entry and `(reverse-engineered — verify)`
  markers; Phase 3 runs `init.md` Step 10 readiness and hands off to
  `session-start.md` → Start B. Adopt-only (no build band). Proposes,
  never overwrites; degrades without git history.

### Changed

- `pm_skills/init.md` — new "Arriving with an existing codebase?"
  pointer to `adopt.md` in the agent-mode intro.
- `pm_skills/GUIDE.md` — `adopt.md` added to the `integrations/` file
  tree; "Existing codebase, no pm-skills yet" entry under "Starting a
  project".
- `README.md` — existing-codebase entry point after the init-mvp block;
  `adopt.md` row in the commands table.

### Upgrade actions

- Copy `pm_skills/integrations/adopt.md` into the project (new
  `framework` file; no migration).
- No project-memory changes. `MANIFEST.md` unchanged — `adopt.md` is
  covered by the `pm_skills/integrations/*` glob (inherits `framework`).
- If your tool uses workflow files, copy `adopt.md` into your workflow
  directory alongside the other `integrations/*` files.

## 3.5.0 — 2026-07-16

Makes `file-map.md` — the biggest per-task hot-read line-item and the
highest-maintenance memory file — a **generated skeleton read
sectionally**. A dependency-free script owns the mechanical bookkeeping
(the path list, grouped by directory) so the agent writes only the
judgement (each file's role), and the hot read drops from whole-file to
an index block plus the sections the task touches. Implements FILEMAP-GEN
(Wave 1); mirrors the headings-first decision-log read 3.0.0 proved.

### Added

- `pm_skills/scaffold/gen-file-map.mjs` — dependency-free Node generator
  (`scaffold` class). Discovers source files via `git ls-files` (honours
  `.gitignore`, no full-tree walk), groups them by top-level directory
  into `## <dir>` sections (root files under `## (root)`), and merges
  role text **by path**: an existing role is preserved verbatim, a new
  file gets `(role needed)`, and a path no longer on disk is flagged
  under a "No longer on disk" block, never silently dropped. Emits a
  `<!-- file-map-index -->` block (per-section counts + total) so the
  sectional read is cheap and the BUDGET-SCALE budget can read the file
  count from it. Idempotent and stably sorted; `--stdout` prints without
  writing; a target path arg overrides the default; an `IGNORE` knob at
  the top of the file is the documented tuning point.

### Changed

- `AGENTS.md` — `file-map.md` moves from **hot whole-file** to **hot
  sectional**: read the `<!-- file-map-index -->` block plus the sections
  whose directory the task touches; read whole-file only for
  cross-cutting work (renames, conventions, upgrades). It remains
  accreting and budgeted.
- `pm_skills/prompts/session-start.md` — the quick-reference read list
  mirrors the new tier (file-map under hot sectional).
- `pm_skills/prompts/end-of-task.md` — the file-map update step offers
  `node scaffold/gen-file-map.mjs` for adds/renames/deletes, leaving only
  `(role needed)` lines and flagged stale paths to resolve by hand.
- `pm_skills/project/file-map.md` (template) — comments describe the
  index + section + generator convention; carries the
  `<!-- file-map-index -->` anchor. Existing populated maps are untouched
  (project-memory class); projects adopt by running the generator once.
- `pm_skills/memory-policy.md` — the derived file-map budget may read the
  file count straight from the generated index block.
- `pm_skills/GUIDE.md` — scaffold tree lists the generator; the read-tier
  summary and folder listing reflect the sectional file map.

### Upgrade actions

- Copy `pm_skills/scaffold/gen-file-map.mjs` into the project. It is
  `scaffold` class: copied once, then project-owned — never force-upgraded
  (covered by the existing `pm_skills/scaffold/*` glob; no `MANIFEST.md`
  change).
- Overwrite the `framework` files after the Step 4 customisation check:
  `GUIDE.md`, `memory-policy.md`, `prompts/session-start.md`,
  `prompts/end-of-task.md`.
- `AGENTS.md` is `root-template`: 3-way merge the "Before every task"
  read tiers — move `file-map.md` out of hot whole-file into the hot
  sectional group with the index-plus-sections instruction, preserving
  any project-specific customisations.
- `pm_skills/project/file-map.md` is `project-memory` — **not**
  overwritten. To adopt the generated skeleton, run
  `node scaffold/gen-file-map.mjs` once (it preserves existing role text
  and adds the index block) and tune the `IGNORE` list. Optional: an
  existing hand-maintained map still reads correctly whole-file.
- No data migration.

## 3.4.0 — 2026-07-16

Makes the two remaining **fixed** memory budgets **scale-aware**, so a
project that succeeds never carries a permanently-red alarm that trains
agent and maintainer to ignore the size check — the exact pathology
2.1.0 removed for the hot-set cap, recreated at the file level. Numbers
still live only in `memory-policy.md`; the prompts point, never restate.

- **`file-map.md` budget = f(file count).** The fixed 2,000-word budget
  becomes **~35 words × mapped files, floor 2,000**, re-derived each
  check from the mapped-file count
  (``grep -cE '^- `' file-map.md``). A ~180-file map now budgets ~6,300
  words: its stripped current-role floor reads **green**, while accreted
  history (task tags, dates, test counts) still trips it. The budget
  measures **noise, not size**. The coefficient (~35) is tunable per
  project; the check prints the derivation (`180 × 35 = 6,300`) so a red
  result is self-explaining. New "Deriving the file-map budget" section
  documents the arithmetic.
- **`decision-log.md`: per-entry runaway guard replaces the file-level
  word budget.** The ~6,000-word file guard tripped on healthy
  accumulated density (many tight entries) rather than the bloat it was
  meant to catch. Entry count (20) stays the primary trigger; the
  secondary guard is now **any single entry > ~600 words** — a
  runaway-entry detector, which is what the word budget was actually
  for.

Minor: memory-policy change, backward compatible. No files added,
renamed, or removed; no `MANIFEST.md` change; no memory-contract or data
migration. Backlog Active and `trajectory.md` budgets are unchanged
(both stayed satisfiable in practice) — this is not a general loosening.

### Changed

- `pm_skills/memory-policy.md` — file-map row now `~35 words × mapped
  files, floor 2,000`; decision-log row's `~6,000 words` secondary guard
  replaced by `any single entry > ~600 words`; new "Deriving the
  file-map budget" section; age-row wording aligned to "per-entry".
- `pm_skills/prompts/end-of-task.md` — full-sweep size check: file-map
  budget described as derived (print the derivation); decision-log
  checks entry count + per-entry guard, not file words.
- `pm_skills/prompts/memory-maintenance.md` — Diagnose budget check and
  Prune P1/P2 aligned to the derived file-map budget and per-entry
  decision-log guard.

### Upgrade actions

- Apply this version's edits to the four files above in any project that
  has customised copies. All are wording/number changes inside existing
  sections — no structural migration.
- If a consuming project's `file-map.md` sat over the old 2,000-word
  budget as an "accepted floor" (a large codebase), re-derive its budget
  (`mapped files × ~35`, floor 2,000): a healthy stripped map should now
  read green. Only re-run a Prune if it is still over the derived budget
  (i.e. carries genuine accreted history).
- If a project tuned its file-map density away from ~35 words/file,
  record its coefficient in `conventions.md` (or a `file-map.md`
  comment) and derive against that.
- No `VERSION`-gated data or file moves; a project already on 3.3.0
  needs only the text edits.

## 3.3.0 — 2026-07-16

Adds an **environment & sync-conflict preflight** plus a **sync-repair
playbook** — the framework's memory model assumes a sane filesystem, and
cloud-sync folders (OneDrive, Dropbox, Google Drive, iCloud) break that
assumption by silently reverting tracked files mid-session and spawning
conflict copies. Generalises a heavy consuming project's seven-plus
recorded OneDrive incidents (including a `.git` divergence and repeated
mid-task stale-reverts) into a standing, repeatable procedure.

One canonical block, referenced not restated:

- **Environment preflight (shared)** (`memory-maintenance.md`) — three
  dependency-free shell checks (cloud-sync path match, hostname-derived
  conflict-artefact scan, git-sanity/HEAD check), a classification +
  repair playbook (byte-identical-to-HEAD → delete; HEAD + live edits →
  restore over the stale file; worktree superset → keep and re-stage;
  uncertain → stop and show diffs), and a one-line-per-repair record
  rule. Never auto-deletes a conflict copy without byte-verification.
- **Severity by caller** — session start runs it **warn-only** (a daily
  blocker gets disabled); Prune (P3) and Upgrade (Step 5) run it
  **blocking** before they move files.
- **Standing advice with teeth** — an AGENTS hard rule marks
  cloud-synced repo paths unsupported for project memory, and the
  session-start preflight repeats the warning every session so the
  advice cannot silently lapse.

Minor: new capability, backward compatible. No files added, renamed, or
removed; no `MANIFEST.md` change; no memory-contract or data migration.
Projects on a non-synced path are effectively unaffected (the preflight
is a fast no-op).

### Added

- `pm_skills/prompts/memory-maintenance.md` — an **Environment preflight
  (shared)** section (E1 detect / E2 classify + repair playbook / E3
  record, plus severity and standing-advice notes), positioned before
  the four verbs.

### Changed

- `pm_skills/prompts/session-start.md` — a new **Environment preflight
  (warn-only)** section running the E1 checks at session start.
- `pm_skills/prompts/memory-maintenance.md` — Prune **P3** now runs the
  preflight as a blocking gate before backup.
- `pm_skills/prompts/upgrade.md` — **Step 5** now runs the preflight as
  a blocking gate before backup.
- `AGENTS.md` (root template) — a new **Hostile-filesystem guard** hard
  rule under "Hard rules (invariants)".
- `pm_skills/GUIDE.md` — a Quick-answers entry on cloud-synced repo
  paths pointing at the preflight and repair playbook.

### Upgrade actions

- Overwrite the four `framework` files
  (`pm_skills/prompts/memory-maintenance.md`,
  `pm_skills/prompts/session-start.md`, `pm_skills/prompts/upgrade.md`,
  `pm_skills/GUIDE.md`) with the source versions (Step 4 customisation
  check applies — surface any local edits before overwriting).
- `AGENTS.md` is a `root-template`: 3-way merge (Step 7). Add the
  **Hostile-filesystem guard** bullet as the last item under "Hard rules
  (invariants)", preserving every populated section verbatim. If the
  project already added the bullet, skip.
- No new files, no `MANIFEST.md` change, no project-memory migration.

## 3.2.0 — 2026-07-16

Adds a **sanctioned lite close + Reconcile verb** — a cheap close-out
for burst development that defers project-memory writes without ever
bypassing them. Formalises the ad-hoc "source of truth = commits, not
the backlog" bypass observed in a heavy consuming project (~200 shipped
items) into a first-class, lossless loop.

Two moving parts:

- **`Close: lite`** (`end-of-task.md`) — a close mode where the quality
  gate and runtime-boot checks still run, but the memory updates and
  size check are deferred and the task is recorded as a structured
  commit trailer (`Item:` / `Outcome:` / `Decision:` / `Verify:` /
  `Close: lite`). The trailer grammar is defined in exactly one place
  (`end-of-task.md`) because Reconcile parses it as data. Forbidden for
  `[sign-off]` items and `full`-mode runs — their rationale is the
  record.
- **Reconcile** (`memory-maintenance.md`, the 4th verb beside
  Diagnose / Prune / Refactor) — reads `Close: lite` trailers from
  `git log` since the last reconcile marker, evicts each backlog item,
  adds one trajectory line per item, and appends ONE consolidated
  decision-log entry naming every folded item plus a `Reconcile marker:`
  SHA. A lossless ID check (trailer IDs = evicted backlog IDs + new
  trajectory IDs) refuses to write partial memory; unparseable commits
  go to manual triage, never a guess. Never auto-run — proposed like
  Prune.

Session start now counts unreconciled lite closes and enforces a hard
cap (`memory-policy.md`: 5 closes or oldest 7 days) that makes a
reconcile mandatory before the next-batch pick, so deferral can't become
a memory hole. Diagnose gains a matching check.

Minor: new capability, backward compatible. No files renamed or
removed; no `MANIFEST.md` change; no memory-contract or data migration.
Projects that never use lite closes are unaffected.

### Added

- `pm_skills/prompts/end-of-task.md` — a **Close mode: full or lite**
  section defining the canonical `Close: lite` commit-trailer grammar
  and the lite prohibitions; steps 3–4 note the lite path defers memory
  writes and the size check; step 5 reports "lite close — reconcile
  pending".
- `pm_skills/prompts/memory-maintenance.md` — the **Reconcile** verb
  (RE1 find window → RE2 parse trailers → RE3 propose → RE4 lossless
  check → RE5 apply → RE6 verify + Reconcile rules), plus Diagnose
  check 10 (unreconciled lite closes) and a four-verb intro.
- `pm_skills/prompts/session-start.md` — a **Check for unreconciled
  lite closes** section (count + oldest date at session start) and a
  Start B gate that blocks the next-batch pick past the cap.
- `pm_skills/memory-policy.md` — an **Unreconciled `Close: lite`
  closes** budget row (5 closes / 7 days) — the single home for the cap
  numbers.

### Changed

- `pm_skills/integrations/task.md` — step 10 gains `close: lite|full`
  inference (lite only if the user asks; never the default; forbidden
  for `[sign-off]` / `full`).
- `AGENTS.md` (`root-template`) — one Workflow pointer line (item 4) to
  the lite close + Reconcile loop.
- `pm_skills/GUIDE.md` — a "Closing lite (for burst work)" note in the
  daily loop; Reconcile added to the memory-maintenance verb list (now
  four); the prompts file-tree description updated.

### Upgrade actions

- Replace the `framework` files with their new versions after the
  Step 4 customisation check: `pm_skills/prompts/end-of-task.md`,
  `pm_skills/prompts/memory-maintenance.md`,
  `pm_skills/prompts/session-start.md`, `pm_skills/memory-policy.md`,
  `pm_skills/integrations/task.md`, `pm_skills/GUIDE.md`.
- `AGENTS.md` is `root-template`: 3-way merge — add the new Workflow
  item 4 (lite close + Reconcile pointer), preserving every populated
  section verbatim.
- No `MANIFEST.md` change (no new/removed/renamed paths). No
  project-memory migration. Existing full closes are unchanged; lite is
  opt-in per task.

---

## 3.1.1 — 2026-07-04

Clarifies the upgrade source flow so agents suggest the public PM-Skills
GitHub repository as the first port of call, while preserving local
checkouts, forks, and pasted files as accepted sources.

### Changed

- `pm_skills/prompts/upgrade.md` — Step 0 now names
  `https://github.com/djDAOjones/PM-Skills.git` as the first source to
  suggest when the user has not provided one, with local checkouts,
  alternate Git URLs, and pasted files still supported.
- `pm_skills/GUIDE.md` — upgrade guidance mirrors the default source
  wording.

### Upgrade actions

- Replace `pm_skills/prompts/upgrade.md` and `pm_skills/GUIDE.md` with
  the new versions after the Step 4 customisation check.
- No root-template merges, `MANIFEST.md` changes, or project-memory
  migrations.

---

## 3.1.0 — 2026-07-04

Adds **Traceable version identity** — the framework's first opinion on
how a *consuming project* names and traces its releases, and the fourth
build/run/ship capability alongside *One-command runtime recovery*
(2.3.0), *Self-explaining runtime* (2.4.0), and *One-command quality
gate* (2.6.0). The framework already demanded version-stamped,
commit-mapped, rollback-ready deploys (`deploy.md`) but never defined
what a version *is*: `DEV-INFRASTRUCTURE.md` → Version management was an
empty placeholder, the only example (`init.md`) taught an unrelated
`major.minor.build` scheme, and the diagnostics bundle referenced an
undefined "app version / build".

This release fills the hole with a two-part identity, expressed the same
way as the other three capabilities — a hard rule whose implementation
scales by tier:

- **Product version** — the release name, `vMAJOR.MINOR.PATCH`
  (SemVer-shaped, `v`-prefixed). MAJOR = product era / breaking
  data-or-workflow change / real users now depend on it; MINOR = a
  shipped milestone or feature batch; PATCH = fix, polish, copy. Start at
  `v0.1.0`; reserve `v1.0.0` for "users can trust it". Answers "what
  release is this?".
- **Build identity** — the trace, `vMAJOR.MINOR.PATCH+YYYYMMDD.shortsha`
  (SemVer build metadata pinning the exact commit). Answers "exactly what
  code is live?".

Git tags use the product version; multiple deploys of one product
version are told apart by build identity; production exposes both in the
diagnostics bundle (`appVersion` / `buildId`, ideally `commit`). It is
deliberately identity-only — not Git Flow, branch naming, PR rules, or
Conventional Commits. The framework's own version (`pm_skills/VERSION` +
`release.md`) is unchanged and separate; `deploy.md` already states that
boundary.

Minor: a new `AGENTS.md` hard rule and anti-pattern, a populated
`DEV-INFRASTRUCTURE.md` template section, and sharpened `deploy.md` /
`init.md` wiring. Backward compatible — no files renamed or removed, no
`MANIFEST.md` change, no memory-contract change, no data migration.

### Added

- `AGENTS.md` (`root-template`) — hard rule **Traceable version
  identity** (two-part identity, tag = product version, expose both,
  tiered) plus a matching anti-pattern rejecting untraceable builds and
  collapsing the release name into the build trace.

### Changed

- `DEV-INFRASTRUCTURE.md` (`root-template`) — the **Version management**
  section replaces its bare placeholder with the two-part default policy,
  its sources / injection / exposure mechanics, and the Tier 0–2 shape,
  cross-referencing the new hard rule and the diagnostics bundle. The
  **Maintainer diagnostics** INCLUDE list names `product version + build
  identity` and `commit` explicitly.
- `pm_skills/init.md` — Step 8 item 8 (**Version management**) points at
  the two-part identity; Appendix B's **Version management example**
  replaces `major.minor.build` with the product-version + build-identity
  table; the Tier 1 diagnostics example copies the build id; Step 10
  readiness gains a version-identity checkbox; the never-hand-edit
  examples label `version.json` as the generated build identity.
- `pm_skills/prompts/deploy.md` — step 2 **Version stamped** sets the
  product version and derives/tags the build identity per
  `DEV-INFRASTRUCTURE.md`; step 3 notes the produced build identity;
  step 4 **Version match** checks the live `buildId` against this
  deploy's commit; step 6 records both in `trajectory.md`.

### Upgrade actions

- `AGENTS.md` (`root-template`, 3-way merge — preserve every populated
  section verbatim): add the **Traceable version identity** hard rule
  after *One-command quality gate*, and the matching bullet in
  *Anti-patterns to reject*.
- `DEV-INFRASTRUCTURE.md` (`root-template`, 3-way merge): take the new
  **Version management** guidance (if the project already populated that
  section, keep its content and reconcile it against the new default
  shape); add `product version + build identity` / `commit` to the
  **Maintainer diagnostics** INCLUDE list.
- Replace these `framework` files wholesale (after the Step 4
  customisation check): `pm_skills/init.md`, `pm_skills/prompts/deploy.md`.
- Adopt the invariant in practice: define the product version + build
  identity in `DEV-INFRASTRUCTURE.md` → Version management (or record
  that it is deliberately deferred for a pre-deploy MVP). If the project
  still documents a `major.minor.build` scheme, migrate it to the
  two-part identity.
- No new or removed paths; `MANIFEST.md` unchanged. No data migration.

---

## 3.0.0 — 2026-07-03

The **token-efficiency and consolidation release**: cuts the fixed
per-task meta-cost (fewer approval round-trips, a lighter always-loaded
contract, less over-fetching) and shrinks the framework surface from 48
distributed files to 36 — without weakening any guardrail. It lands the
conclusions of an external review of the framework repo. The review's
key finding: the framework's dominant historical bug class was
cross-file drift between near-identical files (see 2.4.1, 2.7.1,
2.7.2); consolidation deletes that class at source.

**1. One task workflow with gating modes.** The former `feature.md`,
`auto-jazz.md`, and `auto-jazz-lite.md` (plus a short-lived
`checkpoint.md` draft) merge into `integrations/task.md` — one
skeleton, four modes: `full` (4 gates, for `[sign-off]`/high-risk),
**`checkpoint` (2 gates — scope approval and design pick — the new
default)**, `auto-jazz` (0 gates), `auto-jazz-lite` (0 gates,
compressed). The old names survive as spoken modes. One canonical
hard-prohibition list, a small-task escape hatch to the quick path,
and a resume-insurance rule (persist approved scope + picked option to
the item's ticket file when work will span sessions).

**2. One memory-maintenance workflow with verbs.** `doctor-memory.md`,
`prune-memory.md`, and `roadmap-refactor.md` merge into
`prompts/memory-maintenance.md` — **Diagnose / Prune / Refactor** as
sections of one file; run only the verb asked for. The wrapper
integrations (`integrations/prune-memory.md`, `integrations/upgrade.md`)
are deleted; `prompts/upgrade.md` and `memory-maintenance.md` carry
workflow frontmatter and are consumed directly.

**3. One session entry point.** `next-batch.md` and `corrections.md`
merge into `prompts/session-start.md`: Start A (you name the task),
Start B (the agent picks the next batch, with the wish-list triage),
and the drift-correction snippets.

**4. One greenfield workflow.** `spec-to-prod.md` merges into
`integrations/init-mvp.md` as **scope bands**: Band 0 (local MVP — the
default, the old init-mvp behaviour), Band 1 (deployed MVP), Band 2
(deployed Current milestone), Band 3 (full backlog to production).
`integrations/init-project.md` merges into `pm_skills/init.md` via an
"Agent mode" preamble — one init document for both the manual and
agent-driven paths, ending the documented mirror-drift between them.

**5. `memory-policy.md` (new framework file).** The memory size budget
table and overrun actions move out of the always-loaded `AGENTS.md`
into `pm_skills/memory-policy.md`, read only at task close. `AGENTS.md`
keeps the read tiers and a summary pointer — the per-turn constant
drops by roughly a third. Also adds the end-of-task size-check **fast
path** (≤ 2 memory files touched → count only those) and a
**one-writer rule** for parallel agent sessions.

**6. Leaner reads and outputs.** Decision-log hot read becomes
headings-first (scan the latest 10 headings, open only relevant
bodies). `DEV-INFRASTRUCTURE.md` tier docs now state that its Quality
gate section is a sectional read at task close. Every stage prompt
gains a be-terse output rule ("n/a" where empty). The backlog template
comment becomes the canonical ticket grammar (flags enumerated);
`release.md` gains a changed-vs-named coverage check on its verify
step.

Major: files are renamed/merged and the `AGENTS.md` root template is
restructured — but there is **no project-memory data migration**; all
`project/` content is untouched.

### Added

- `pm_skills/integrations/task.md` (`framework`) — the task workflow;
  modes `full` / `checkpoint` (default) / `auto-jazz` /
  `auto-jazz-lite`.
- `pm_skills/prompts/memory-maintenance.md` (`framework`) — Diagnose /
  Prune / Refactor verbs; carries workflow frontmatter.
- `pm_skills/memory-policy.md` (`framework`) — canonical memory
  budgets, overrun actions, size-check fast path, one-writer rule.
  Declared in `MANIFEST.md`.

### Removed

- `pm_skills/integrations/feature.md`, `auto-jazz.md`,
  `auto-jazz-lite.md` → merged into `integrations/task.md` as modes.
- `pm_skills/prompts/doctor-memory.md`, `prune-memory.md`,
  `roadmap-refactor.md` → merged into `prompts/memory-maintenance.md`
  as verbs.
- `pm_skills/prompts/next-batch.md`, `corrections.md` → merged into
  `prompts/session-start.md` (Start B; Drift corrections).
- `pm_skills/integrations/spec-to-prod.md` → merged into
  `integrations/init-mvp.md` as scope Bands 1–3.
- `pm_skills/integrations/init-project.md` → merged into
  `pm_skills/init.md` (Agent mode).
- `pm_skills/integrations/prune-memory.md`,
  `pm_skills/integrations/upgrade.md` — thin wrappers deleted; the
  canonical prompts carry frontmatter and are used directly.

### Changed

- `AGENTS.md` (`root-template`) — "Memory size budgets" collapses to a
  pointer at `pm_skills/memory-policy.md`; decision-log tier read is
  headings-first; the `DEV-INFRASTRUCTURE.md` conditional bullet notes
  the Quality-gate sectional read; Workflow rule 1 points at `task.md`
  with checkpoint as the default mode; wish-list triage and
  document-ownership rows re-point at `session-start.md` Start B and
  `memory-maintenance.md`.
- `pm_skills/prompts/session-start.md` — absorbs Start B (next-batch)
  and the drift corrections; tier quick-ref re-grouped (conditional
  split out; headings-first decision-log; Quality-gate sectional
  note); continuing-a-task points at the item's ticket file.
- `pm_skills/prompts/end-of-task.md` — size check gains the fast path;
  budgets referenced from `memory-policy.md`; maintenance proposals
  point at the `memory-maintenance.md` verbs.
- `pm_skills/prompts/scoping.md`, `design-options.md`,
  `implementation-plan.md`, `validation.md`, `quick-task.md` — be-terse
  output rules.
- `pm_skills/prompts/upgrade.md` — gains workflow frontmatter; intro
  names `memory-policy.md`; the migration pre-flight references the
  Diagnose verb.
- `pm_skills/prompts/review.md` — reviews `task.md` auto-jazz runs and
  `init-mvp` builds; memory-hygiene step cross-references the Diagnose
  verb.
- `pm_skills/prompts/release.md` — step 5 lists `task.md`; step 6
  gains the changed-vs-named coverage check with a matching verify
  snippet.
- `pm_skills/integrations/bugfix.md` — context-load step adopts the
  headings-first decision-log read.
- `pm_skills/integrations/init-mvp.md` — absorbs the scope bands,
  version-control expectation, and deploy phase; foundation steps now
  reference `init.md` agent mode; prohibitions reference the canonical
  `task.md` list.
- `pm_skills/init.md` — gains the Agent mode preamble and workflow
  frontmatter; Step 3 reads the canonical ticket grammar from the
  backlog template; Step 11 lists `task.md` modes; memory-hygiene
  section points at the maintenance verbs.
- `pm_skills/project/*` templates (`project-memory`) — comment-only:
  `brief.md`, `architecture.md`, `conventions.md`, `file-map.md`,
  `trajectory.md`, `wish-list.md`, `backlog.md`, `decision-log.md`
  point budget references at `pm_skills/memory-policy.md` and
  maintenance references at the verbs; `backlog.md`'s ticket-grammar
  comment is marked canonical and gains the full flag list;
  `decision-log.md` notes the headings-first read. Existing populated
  files are unaffected.
- `pm_skills/GUIDE.md` — rewritten novice-first for the consolidated
  shape: plain-language mental model (memory / rulebooks / workflows,
  compress-on-ship, read tiers), the file tree with one-liners, both
  driving styles, starting paths with the scope-band table, the daily
  loop with a mode table and rationale, the manual paste flow, memory
  upkeep, and a quick-answers FAQ.
- `pm_skills/MANIFEST.md` — adds the `pm_skills/memory-policy.md` row.

### Upgrade actions

- Add the new `framework` files: `pm_skills/integrations/task.md`,
  `pm_skills/prompts/memory-maintenance.md`,
  `pm_skills/memory-policy.md`.
- **Delete** (per-file confirmation, per upgrade Step 6) the merged
  files listed under Removed above. Any local customisation found in
  them by the Step 4 check moves to the absorbing file.
- Replace these `framework` files wholesale (after the Step 4
  customisation check): `pm_skills/GUIDE.md`, `pm_skills/init.md`,
  `pm_skills/MANIFEST.md`, `pm_skills/prompts/session-start.md`,
  `pm_skills/prompts/end-of-task.md`, `pm_skills/prompts/scoping.md`,
  `pm_skills/prompts/design-options.md`,
  `pm_skills/prompts/implementation-plan.md`,
  `pm_skills/prompts/validation.md`, `pm_skills/prompts/quick-task.md`,
  `pm_skills/prompts/upgrade.md`, `pm_skills/prompts/review.md`,
  `pm_skills/prompts/release.md`, `pm_skills/integrations/bugfix.md`,
  `pm_skills/integrations/init-mvp.md`.
- `AGENTS.md` (`root-template`, 3-way merge — preserve every populated
  section verbatim): replace the "Memory size budgets" table with the
  new pointer paragraph **only if the project kept the default table**;
  if the project customised budget numbers, move the customised rows
  into its `pm_skills/memory-policy.md` copy first. Take the new
  Workflow rules, tier bullets, wish-list triage pointers, and
  document-ownership rows.
- If your AI tool's workflow directory contains copies of the removed
  workflows, replace them with `task.md` (and optionally
  `prompts/upgrade.md` / `prompts/memory-maintenance.md`, which now
  carry frontmatter).
- `pm_skills/project/*` templates are `project-memory`: no action for
  populated files; the comment-only re-pointing applies to fresh
  projects (optionally update the guidance comments in place — they
  are comments, not content).
- No data migration: no memory content moves.

---

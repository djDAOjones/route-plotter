# PM Skills — Guide

The full manual for the framework. You don't need to memorise it —
your AI agent reads the rules for you. Read this once to understand
the moving parts; come back when you want the "why" behind something.

For solo and small-team builders who own product direction and macro
structure but want AI agents to handle implementation without losing
context, drifting, or wasting tokens.

Defaults to Carbon Design System, WCAG 2.2 AAA, Nielsen heuristics,
JSDoc, and a lean invariant-led testing doctrine. All customisable,
none apologised for.

## How it works — the mental model

An AI chat session has no memory: close the window and everything it
learned about your project is gone. This framework fixes that with
**files the agent reads at the start of every session and updates at
the end of every task**:

- **Project memory** (`project/`) — the living state: what you're
  building, what's next, what shipped, and why choices were made.
- **Rulebooks** (`AGENTS.md`, `UI-STANDARDS.md`,
  `DEV-INFRASTRUCTURE.md` in your project root — copied out of
  `templates/` at init) — the permanent rules: invariants, UI and
  accessibility standards, build and deploy facts. Populated once
  during setup; updated only when big decisions change.
- **Workflows** (`integrations/` and `prompts/`) — the procedures:
  how to scope, design, plan, validate, implement, and close a task.

Two habits make the memory work:

- **Compress on ship.** When a task finishes, its backlog item is
  removed, one line goes to `trajectory.md` (what happened), and the
  reasoning goes to `decision-log.md` (why). Nothing is written twice,
  so the files the agent reads every day stay small.
- **Read tiers.** Not every file is read every time. Hot files (the
  brief, the architecture) are read every task; `backlog.md` and the
  file map are read by section; `trajectory.md` only on demand; the
  wish-list and archives never load automatically. This keeps each
  session's context — and token bill — bounded as the project grows.
  The canonical tier policy lives in `AGENTS.md` → "Before every
  task"; the size budgets live in `memory-policy.md`.

AI tools that support global rules load `AGENTS.md` automatically.
For other tools, `prompts/session-start.md` lists what to read.

Where the tool also supports **rules imports** (memory imports and
kin), import the identity documents — the brief, architecture, and
conventions — into the rules position rather than reading them each
session. Measured on a live pair at equal verified quality,
pre-loading cut tool round-trips by about a third and total tokens
by about a seventh, partly because an agent that starts oriented
searches less. Pre-load identity documents only — never
work-target files: the file being edited must still be read from
disk.

## What's in this folder

```text
VERSION          Current framework version (semver). The upgrade check.
CHANGELOG.md     Append-only release log; each entry is an upgrade plan.
CHANGELOG-*.md   Archived epochs (1.x/2.x/3.x), verbatim; the upgrade
                 walk follows the live file's index into them.
MANIFEST.md      Path classes: framework / template / memory / scaffold.
GUIDE.md         This guide.
init.md          Project setup, step by step (manual or agent-run).
memory-policy.md Memory size budgets + overrun actions (read at task close only).

templates/       Rulebook templates. Copied to your project root at init
  AGENTS.md          (init.md Step 0), then populated there — the copies
  UI-STANDARDS.md    are yours; upgrades merge new sections in, never
  DEV-INFRASTRUCTURE.md  overwrite.
  PROCESS.md         Optional fourth: macro phases, ADR closure, DoD —
                     for complex multi-phase projects only; conditional
                     read tier, skippable without nag.

project/         Your living project memory. Fill once, maintain ongoing.
  brief.md         What we're building, for whom, what's out of scope.
  architecture.md  Tech stack, structure, key modules.
  conventions.md   Style, naming, patterns, tooling.
  backlog.md       Open work only (Current, Next, Icebox).
  trajectory.md    Shipped-work history, one line per item.
  wish-list.md     Parked ideas, waiting for triage.
  doc-deltas.md    Protected-doc drift ledger; reconciled in a doc-sync pass.
  file-map.md      One line per source file: its role. Skeleton generated; read by section.
  decision-log.md  Append-only record of the WHY behind decisions.

prompts/         Reusable per-task prompts (paste, or run as commands).
  session-start.md        Begin a chat: context, task starts, next-batch pick, drift corrections.
  scoping.md              Stage 1: what needs to change and why.
  design-options.md       Stage 2: 2–3 ways to do it, with a recommendation.
  implementation-plan.md  Stage 3: files, sequence, acceptance criteria.
  validation.md           Stage 4: pre-code sanity and risk checks.
  quick-task.md           Single-stage scope-and-plan for small tasks.
  bug-scoping.md          Bug diagnosis: reproduce, root cause, minimal fix.
  end-of-task.md          The closing ritual: quality gate + memory updates.
  review.md               Read-only audit of an autonomous run or feature area.
  memory-maintenance.md   Diagnose / Prune / Refactor / Reconcile / Doc-sync project memory.
  backlog-authoring.md    Ideas or a transcript → grammar-true backlog items + tickets; the ticket skeleton and external authoring contract.
  upgrade.md              Move a project to a newer framework version.
  release.md              Maintainer release checklist (source repo only).
  deploy.md               Production deploy + live verification.

integrations/    Tool-workflow files (copy to your AI tool's workflow dir).
  task.md      The task workflow — modes: full / checkpoint (default) / auto-jazz / auto-jazz-lite / spike / refactor.
  next.md      One-word "run the next backlog item": Start B pick → auto-jazz build → close. One item per invocation.
  dispatch.md  Initiate parallel chats: disjoint pick, lane briefs; the dispatching chat integrates.
  bugfix.md    Diagnosis-before-fix workflow for bugs.
  init-mvp.md  Sign off foundation + scope band, then autonomous build (and optional deploy).
  adopt.md     Retrofit pm-skills onto an existing codebase; reverse-engineer memory, interview for gaps.

scaffold/        Starter config to copy into your project root once.
  .editorconfig       Editor style enforcement (indent, encoding, etc.).
  .gitignore          Common ignores for JS/npm projects.
  .markdownlint.json  Markdown lint baseline: strict on breakage, relaxed on style.
  check-links.mjs     Dependency-free internal Markdown link checker (Node).
  gen-file-map.mjs    Dependency-free file-map skeleton generator (Node).
                      Runs in place from scaffold/; copy it out only to customise.
```

## Two ways to drive it

- **Workflow-capable AI tools** (slash commands or similar): copy the
  files from `integrations/` into your tool's workflow directory —
  plus `prompts/upgrade.md` and `prompts/memory-maintenance.md` if you
  want those as commands too (they carry workflow frontmatter). Then
  you just invoke a workflow and talk.
- **Any other AI tool**: paste the prompt files into chat at the right
  moments. The "Manual paste flow" section below gives the exact
  sequences. Same rigour, more copy-paste.

## Starting a project

**New project, you drive the setup:** follow [init.md](./init.md) step
by step (~30 minutes) — or tell the agent "Run pm_skills/init.md in
agent mode" and approve each artifact as it drafts them. Either way
you end with populated memory, populated rulebooks, and a first
backlog.

**New project, the agent builds it too:** run
[`integrations/init-mvp.md`](./integrations/init-mvp.md), e.g.

> Run init-mvp: I want a web app that tracks my houseplants'
> watering schedules.

You approve the **foundation** (its reading of what you want, the
stack, the task list) and a **scope band** — how far this run may go:

| Band | It builds… | Then |
| --- | --- | --- |
| 0 (default) | the first milestone (an MVP) | hands back, running locally |
| 1 | the MVP | deploys it to production |
| 2 | everything in the Current milestone | deploys |
| 3 | the full committed backlog | deploys |

After sign-off it runs to that ceiling without further questions,
committing rollback checkpoints as it goes, and stopping early only if
the plan proves wrong (or a hard limit is hit).

**Existing codebase, no pm-skills yet:** run
[`integrations/adopt.md`](./integrations/adopt.md). It reverse-engineers
your project memory from the source tree and git history — file map,
architecture, a seeded trajectory, a brief that points at your existing
docs — then interviews you only for what the repo can't tell it
(product intent, invariants, deploy target, what's next). It proposes,
never overwrites: existing READMEs and specs are linked and digested,
not clobbered. Ends at the `init.md` readiness check, ready for Start B.

**Existing project on an older pm-skills:** point the agent at the
public repo (`https://github.com/djDAOjones/PM-Skills.git`) as the first
port of call, or another newer source (sibling clone, fork Git URL, or
pasted files), and run [`prompts/upgrade.md`](./prompts/upgrade.md). It
reads the version gap, applies only the documented deltas, and never
overwrites your memory or customisations.

## The daily loop: pick → build → close

### Pick

Open a fresh chat. Name the task ("My task: add CSV export to the
reports page") or say **"pick the next batch"** — the agent triages
any parked wish-list ideas, proposes the next logical backlog item
with a recommended mode, and waits for your go-ahead. At the pick it
also surfaces the **age of standing items** — the
`[maintainer]`/`[sign-off]`/`[blocked]` work that waits across sessions
— so long-lived items can't fade into wallpaper; and any open
`[security]` item (a live exposure) banners at every session start
until it's closed.

Or, when you trust the backlog order, run
[`integrations/next.md`](./integrations/next.md): one word picks the
next item, builds it auto-jazz, and closes it — no per-item sign-off.
It ships **one item per invocation** (run it again for the next), and
the invocation itself is the go-ahead, so it doesn't wait. The
guardrails still hold: `[sign-off]` items escalate to full mode,
wish-list triage and the reconcile gate still run, and every hard
limit still stops and asks.

With two or three genuinely independent items and attention to
spare, [`integrations/dispatch.md`](./integrations/dispatch.md)
initiates parallel chats instead: a disjoint pick, one lane and one
paste-ready brief per chat, and integration back in the dispatching
session.

### Build

Run `task.md`. Its **modes** set how often it stops for you:

| Mode | Stops for you at… | Use for |
| --- | --- | --- |
| `checkpoint` (default) | scope approval + design pick | everyday non-trivial tasks |
| `full` | every stage (scope, options, plan, validation) | `[sign-off]` items, high-risk work |
| `auto-jazz` | nothing — states assumptions and continues | work you'd accept sight-unseen |
| `auto-jazz-lite` | nothing, and compresses the stages | small, low-risk tasks |
| `spike` | nothing — timebox, then findings | timeboxed exploration (items flagged `[spike]`) |
| `refactor` | scope (declared surface) + design pick | behaviour-preserving restructuring within a named file set |

(The `refactor` **mode** restructures code with no behaviour change; the
`Refactor` **verb** in `memory-maintenance.md` tidies drifted project
memory — different files, same word.)

Why checkpoint is the default: scope and design choice are where your
judgement genuinely changes the outcome; plan and validation approvals
are usually rubber stamps that cost a whole round-trip each. You keep
the two decisions that matter and skip the ceremony.

In every mode the same hard limits apply (see `task.md`): no new
runtime dependencies, no touching protected or never-edit files, no
destructive migrations or data deletion, no refactors sprawling past
the agreed scope, no weakening tests. The agent stops and asks rather
than crossing one.

**Small tasks** take the quick path (one combined scope-and-plan)
instead of four stages — say "this is a quick task", or let the size
triage in `task.md` spot it. **Bugs** go through `bugfix.md`:
reproduce, diagnose the root cause with evidence, and only fix after
you confirm the diagnosis.

### Close

Say "run end-of-task" (`prompts/end-of-task.md`). The agent:

1. Runs the project's one-command quality gate (`check`).
2. Verifies the app still boots, if the task touched the runtime.
3. Updates project memory — removes the shipped backlog item, records
   the why in `decision-log.md`, adds the trajectory line, refreshes
   the file map and any rulebook that changed.
4. Size-checks the memory files (a fast path skips the full audit on
   most tasks) and proposes maintenance if a budget tripped.
5. Reports what it did.

This ritual is what makes the *next* session start smart. Don't skip
it.

**Commit as you close.** After the gate is green and memory is
written, the agent commits — titled with the item ID and carrying the
gate results — and pushes when a remote is already configured, first
echoing the files it staged against the files the task touched, so
nothing (like a changelog entry) is left behind. Standard since
4.2.0; a project can restore propose-only behaviour with one line in
its root `AGENTS.md`. The agent never adds or changes a remote to
make a push possible, and on long runs it makes a checkpoint commit
per milestone so there's always a recent rollback point.

**Closing lite (for burst work).** If you're closing a run of small
tasks fast and don't want a full memory write each time, say "close
lite". The agent still runs the quality gate and boot check, but
records the task as a structured `Close: lite` trailer in the commit
message instead of updating the memory files — deferring, never
skipping, the write. Later, `memory-maintenance.md` → **Reconcile**
reads those trailers from git history and back-fills the backlog,
trajectory, and decision-log in one pass. Session start counts any
unreconciled lite closes and, past a cap, insists on a reconcile before
picking new work — so the deferral can't quietly become a memory hole.
`[sign-off]` items and fully-gated runs can't close lite; their
reasoning is the record.

### After an autonomous run

If the work ran gateless (`auto-jazz`, `auto-jazz-lite`, an `init-mvp`
build), paste `prompts/review.md` before accepting it: a read-only
audit that maps the changes to intent, checks every stated assumption
and hard rule, names what only a human can verify, and ends with a
verdict and punch list. It proposes; it never silently rewrites.

`review.md` also accepts a **feature area** (a name plus its IDs and/or
entry-point files) instead of a diff range: it assembles the change set
from `git log --grep` per ID plus the matching memory entries — the
natural review unit once batches ship gateless and lite-closed (a
reconciled batch is a ready-made area).

### Auditing the whole codebase

Sometimes you want a holistic pass over the *entire* repo — the
overnight-hardening habit of picking an area, reviewing it, folding
findings into the backlog — not a review of one recent change. Run it
as an orchestrated loop over `review.md`, never one unbounded session
(a big repo blows the very context budget the sectional file map
exists to bound):

1. **Enumerate the chunks.** Use the `file-map.md` sections as the
   chunk list — they're already directory-grouped and budget-aware.
   State the chunk list and the order up front, so the audit stays
   auditable about what it did and didn't cover.
2. **Review each chunk.** Run `review.md` in feature-area mode with the
   chunk as the declared area, findings-only (spike posture), bounded
   read cost per chunk. Each chunk closes cleanly, so a large audit
   spans sessions without a monolithic context.
3. **Aggregate.** Collect the per-chunk findings into one
   severity-tagged report with a per-chunk coverage statement and an
   explicit "not audited" list. Store it cold — a dated file next to
   project memory — never a hot read.
4. **Triage, don't fix.** An audit never edits code. Append accepted
   findings to the backlog or wish-list per normal grammar; structural
   items become `refactor`-mode tasks spun out per finding, not run
   inline. Protected-doc drift spotted per chunk feeds `doc-deltas.md`,
   reconciled later in a `doc-sync` pass.

For a repo with no generated file map (adopt-tier), chunk by top-level
directory instead. If real use ever shows this recipe under-specifies,
a dedicated `audit.md` prompt gets considered — until then it composes
the pieces that already exist (`review.md` area mode, `refactor` mode,
the doc-deltas ledger) rather than duplicating them.

### Parallel and multi-machine work

Project memory assumes **one writer at a time**. You can still run
sessions in parallel, or across machines — the coordination is advisory,
never a lock (a crashed session must never block the next one):

- **Parallel sessions (same repo).** Each session's first act is to
  declare the files it will touch in chat and check `git status`, so two
  sessions don't append to `decision-log.md` or `backlog.md` at once.
  Only one session (the **primary**) writes memory at close; the others
  emit a handoff block (`end-of-task.md` → "Secondary-session close")
  that the primary — or the next `memory-maintenance.md` → Reconcile —
  applies. Stage your own paths only; never `git add -A` while parallel.
- **Records mode changes the arithmetic.** Where the backlog runs as
  per-item records under a generated view, two sessions working
  different items touch different files: work each session on its own
  branch and merge at close — no claims needed for item work. The
  merge rule is mechanical: record files merge clean; on any view
  conflict, **regenerate from the merged records and stage the
  result — never hand-merge the view**. (Verified live:
  insert-collisions conflict only in the view and regenerate away;
  field edits usually merge clean everywhere.) The advisory-claim
  protocol above remains for prose-memory projects and for the
  genuinely shared files — decision log, trajectory — where
  same-file appends stay git's weakest case.
- **Initiating a parallel set.** The entry move is packaged as
  `integrations/dispatch.md`: pick two or three disjoint items,
  assign lanes (branch, mode, a working tree each) and the one
  primary, emit paste-ready briefs, then integrate in the
  dispatching session — merges, handoffs, one release.
- **Multi-machine: git is the sync channel, never the filesystem.** Work
  crosses machines as commits and branches — pull the branch; don't let
  a sync folder (OneDrive, Dropbox, iCloud) carry a working tree between
  machines. A file-synced tree silently reverts tracked files and spawns
  conflict copies (see "Quick answers").
- **Arrival procedure.** When a session finds uncommitted changes it did
  not make — a second machine's in-flight work, or another session's —
  it states their **provenance** (which machine / session / human, or
  "unknown") before building on them. "Unknown" provenance is treated
  like external code: verify it is coherent and run the quality gate
  before folding it in. (The framework learned this the hard way: a
  self-hosting session once found uncommitted work, assumed the
  maintainer had written it, and closed a release on that premise —
  correct only by luck.)
- **Known limitation.** Truly concurrent agents on a *single* worktree
  (two tools editing the same checkout at the same instant) are out of
  scope — the advisory claim assumes each session sees the other's
  committed or in-flight state via `git status`, not a live shared
  buffer.

## Manual paste flow

For AI tools without workflow support. Start every session by pasting
the relevant parts of `prompts/session-start.md` (context list + one
Start block), then:

**Non-trivial task (4-stage):**

1. Paste `prompts/scoping.md` → approve the scope.
2. Paste `prompts/design-options.md` → pick an option.
3. Paste `prompts/implementation-plan.md` → approve the plan.
4. Paste `prompts/validation.md` → confirm readiness.
5. "Go ahead and implement."
6. Paste `prompts/end-of-task.md`.

Checkpoint variant (recommended): after step 2, say "run plan and
validation without stopping, state assumptions, then implement" —
saving two round-trips.

**Small task:** paste `prompts/quick-task.md` → approve the plan →
"go ahead" → `prompts/end-of-task.md`.

**Bug:** paste `prompts/bug-scoping.md` → approve the diagnosis and
fix plan → "go ahead and fix" → verify → `prompts/end-of-task.md`.

**Ship to production:** when work is merged and green, paste
`prompts/deploy.md` — it runs the pipeline documented in
`DEV-INFRASTRUCTURE.md` → Deployment and verifies the live result.

## Looking after project memory

Mostly automatic: `end-of-task.md` keeps the files current, and you
approve a maintenance pass when the agent proposes one. For reference,
what changes when:

| File | When it updates |
| --- | --- |
| `brief.md` | Rarely — only if the project's direction fundamentally changes. |
| `architecture.md` | When major modules or the stack change. |
| `conventions.md` | When a convention is established or changed. |
| `backlog.md` | Every task — shipped items leave, follow-ups join. |
| `tickets/<ITEM-ID>.md` | Optional, for one big item's working detail; deleted when it ships. |
| `trajectory.md` | Every task that ships — one line per item. |
| `wish-list.md` | Whenever an idea is parked; drained at the next-batch pick. |
| `doc-deltas.md` | Whenever a task changes behaviour a protected doc (SPEC, ADR) describes — one capture line; reconciled in a `doc-sync` pass. |
| `file-map.md` | When files are created, renamed, or deleted. |
| `decision-log.md` | During each task's design phase. |
| Root `README.md` + rulebooks | When architecture, UI conventions, or build/deploy facts change. |

**When a size budget trips** (the end-of-task check tells you), the
agent proposes `prompts/memory-maintenance.md` and waits for your
approval. Its five verbs:

- **Diagnose** — read-only health check; finds structural drift and
  points at the right fix. Also worth running after a long gap.
- **Prune** — archives the oldest content whole (never rewritten,
  never summarised) and leaves an index pointer in the live file.
- **Refactor** — tidies a drifted backlog: evicts shipped work,
  merges duplicates, regroups by milestone.
- **Reconcile** — back-fills memory from `Close: lite` commit trailers:
  evicts the reconciled backlog items, adds their trajectory lines, and
  writes one consolidated decision-log entry for the batch.
- **Doc-sync** — reconciles protected docs (SPEC, ADRs) against the
  `doc-deltas.md` ledger: one batched, sign-off-gated pass that applies
  the drifted edits and ticks each delta. Nothing else edits a
  protected doc.

Budgets and the actions per file live in
[`memory-policy.md`](./memory-policy.md) — the agent reads it at task
close; you never need to.

**Which model tier?** Memory maintenance is mostly mechanical — counts,
greps, `tail`/`diff` verification, log harvesting — and that half runs
fine on a cheaper, faster model. Two things do not: judgement steps
(scoping, design options, validation, review, and any **propose** step,
such as Prune's archive proposal or Reconcile's batch write), and
multi-step protocol closes (the release and end-of-task checklists).
Both want the stronger tier — protocol adherence and judgement are the
first things to degrade on a cheap model. Split the work per-step, not
per-session: run the mechanical verification cheap, switch up for the
calls that need it.

**Harness auto-memories.** Many AI tools now accrete their own
memories as you work (observed patterns, auto-generated notes).
Treat them as a per-tool cache, never as the record: the canonical
project memory is these files — curated, git-versioned, portable.
When a tool memory contradicts a memory file, the file wins;
periodically reconcile anything durable a tool memory holds into
the files, or deliberately ignore it. Never let the two fork.

**Authoring a backlog from raw material.** "Draft a backlog from
these notes" runs `prompts/backlog-authoring.md`: it extracts
candidate items from loose ideas or a transcript, writes them in
the ticket grammar grouped by milestone, and authors
`tickets/<ID>.md` files (from its canonical skeleton) for items
that outgrow one line. The same file is the contract an external
agent follows when asked to write tickets.

Two folders are created lazily, so don't be surprised they're missing
on a fresh project: `project/archive/` (first prune) and
`project/tickets/` (first item that needs a detail file).

## Saving session transcripts

An optional practice for projects that want a record of their
sessions: if your AI tool can export a conversation, save it to a
`_transcripts/` folder at your project root. It costs nothing
during the work and compounds into evidence: future evaluations,
retrospectives, and prompt-tuning get to read what actually
happened in a session instead of inferring it from the decision
log. (The framework itself learned this the hard way — a later
review was blind to months of sessions because no transcripts
existed for them.)

The convention:

- **Folder:** `_transcripts/` at the project root — short, sortable,
  obviously not source.
- **Naming:** `YYYY-MM-DD-<ITEM-ID-or-topic>.md`, one file per session.
- **Header:** the first line records the session's starting commit —
  `Start SHA: <sha>` — so a saved transcript is a ready scenario seed
  for behavioural evaluations (starting state plus trajectory).
- **Tier:** cold — never auto-read. Listed in `AGENTS.md` → cold tier
  alongside the wish-list and archives; it carries zero read-tier cost.
- **Gitignored by default.** The scaffold `.gitignore` ignores
  `_transcripts/`, so transcripts stay local unless you deliberately
  commit them.
- **Redact before committing.** Transcripts can contain secrets (env
  values, URLs with codes, tokens). Committing any transcript is an
  explicit, per-file choice that requires a redaction pass first — the
  same "redact by default" rule as the diagnostics bundle
  (`AGENTS.md` → "Self-explaining runtime").

Nothing in the close depends on this — save or skip as your project
needs. If you later run a retrospective evaluation of your sessions,
point it here — the evidence lives in `_transcripts/`.

## Quick answers

- **Do I have to read the memory files?** No — the agent does. Skim
  `backlog.md` when you want to see what's queued; everything else is
  primarily for the agent.
- **The agent is going off-track mid-task.** Use the one-line drift
  corrections in `session-start.md`: "Tighten scope", "Reset to plan",
  "Re-ground in codebase", "Stay in design mode".
- **I had an idea mid-task.** Say **"park it"** — one line goes to the
  wish-list and work resumes. It gets triaged at the next batch pick.
- **A chat died mid-task.** Start a new one with the "Continuing a
  previous task" block in `session-start.md`. For long tasks the
  workflow saves the approved scope and chosen design to the item's
  ticket file, so nothing needs re-deriving.
- **Will upgrading break my memory?** No. `MANIFEST.md` classes every
  file; project memory is never overwritten on upgrade, and populated
  rulebook sections are preserved verbatim.
- **My repo lives in OneDrive / Dropbox / iCloud — is that OK?** It's
  unsupported for project memory: sync folders silently revert tracked
  files and spawn conflict copies. Session start runs a cheap
  warn-only environment preflight, and prune/upgrade block on it before
  moving files, with a sync-conflict repair playbook in
  `prompts/memory-maintenance.md`. If the location is unavoidable, pause
  syncing during sessions or exclude `.git`.
- **What does a task cost me in attention?** Checkpoint mode: two
  decisions (scope, design pick) plus reading the closing report.
  Everything else is the agent's job.

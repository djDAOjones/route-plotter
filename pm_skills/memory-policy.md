# Memory Policy

The canonical **memory size budgets** for project memory, and the
actions to take when a budget trips. Moved out of `AGENTS.md` so the
always-loaded contract carries only always-needed rules; this file is
read **only** by the workflows that consult budgets:
`prompts/end-of-task.md` (size check) and
`prompts/memory-maintenance.md` (Diagnose / Prune / Refactor).

Read-tier definitions (hot / sectional / warm / cold) stay in
`AGENTS.md` → "Before every task" — they govern every session start.
This file governs the checks that run at task close.

## Machine-readable budgets

The canonical numbers, in the form a **memory validator** reads (a
`check-memory` script — one command implementing the end-of-task
size check mechanically). The table below explains the same numbers
for human readers; when a budget changes, **update the block and the
table together** — they live in this one file precisely so they
cannot drift apart silently, but within the file the block is what
tools parse.

```json
{
  "$comment": "Canonical machine-readable budgets. Keep in step with the table below. Units: words unless the key says otherwise.",
  "referenceDocSoftWords": 3500,
  "fileMap": { "wordsPerFile": 35, "floorWords": 2000 },
  "backlogActive": { "softWords": 1500, "maxOpenItems": 40 },
  "trajectoryWords": 2000,
  "decisionLog": {
    "maxLiveEntries": 20,
    "entryGuardWords": 600,
    "maxOldestDays": 90,
    "liveFloorEntries": 10,
    "minEntriesBeyondFloor": 5
  },
  "wishListMaxOpen": 25,
  "docDeltas": { "maxOpen": 10, "maxOldestDays": 30 },
  "ticketSoftWords": 600,
  "liteClose": { "maxCount": 5, "maxOldestDays": 7 },
  "standingItemWarnDays": 30,
  "pruneToFraction": 0.7
}
```

## Memory size budgets

Memory files have word/entry budgets: **hard, prunable** limits on
accreting files (`file-map.md`, the sectional `backlog.md` /
`decision-log.md`, `trajectory.md`) and **soft** size guidelines on
reference docs (see the table). The end-of-task update check flags
overruns and proposes the Prune verb of
`pm_skills/prompts/memory-maintenance.md`. Do not auto-prune — always
propose first.

**Prune-to targets (hysteresis).** When any prune or archive action
in this table fires, reduce the file to at most **70%** of its
budget (`pruneToFraction`), never merely just under it — a prune
that lands at 99% re-fires within a few tasks, and the pass costs
more than the words it moves. The 30% gap makes the re-fire period
roughly a third of the budget divided by the file's accretion rate;
tune the fraction per project if velocity demands.

| Scope | Soft limit | Action when exceeded |
| --- | --- | --- |
| Reference doc (`README`, `brief.md`, `architecture.md`, `conventions.md`, + project standards/process/infra docs) | soft ~3,500 words each | Not a prune target — reference docs don't accrete. If one is genuinely bloated, tighten it or split detail into a permanent contract file; never strip to hit a number. |
| `file-map.md` (accreting) | **derived: ~35 words × mapped files, floor 2,000** (see "Deriving the file-map budget" below) | Propose Prune: strip accreted history (task tags, dates, test counts) to `archive/file-map-*-historical.md`, keep current roles. The derived budget measures **noise, not size** — a large healthy map reads green at its current-role floor; only history accretion (tags, dates, counts) pushes it over. Floor = the irreducible current-role list. |
| Every-task read load | structural (no aggregate word cap) | A fixed sum fires permanently on a mature project (each hot file's budget scales with the project), so there is none. Healthy = each file within its own row above. If the always-read set keeps growing, review whether a hot read should move to _conditional_ or _warm_, or whether a reference doc has bloated. |
| `backlog.md` Active | 1,500 words **or** ~40 open items (whichever trips first) | Propose Refactor: restructure by lifecycle, evict done-work, dedupe stale rounds. A low item count with high words means items are too verbose — tighten them. |
| `backlog.md` shipped work | 0 — done `[x]` items do not live here | Move each to `trajectory.md` (one line) + `decision-log.md` (the why). Flagged by `end-of-task.md` and the Diagnose verb. |
| `trajectory.md` | 2,000 words | Propose archiving the oldest phases to `archive/trajectory/`, keeping `archive/INDEX.md` current. |
| `decision-log.md` live log | 20 entries (primary) **or** any single entry > ~600 words (runaway-entry guard) | Propose an archive split to `archive/decision-log-*.md` (by whole month; by date-range when one month alone exceeds a budget). Entry count is the primary trigger; the per-entry guard catches a single runaway entry — a healthy entry is ~150–300 words (Decision, Rationale, Alternatives, Link), not an essay. This replaces the old file-level word budget, which tripped on healthy accumulated density (many tight entries) rather than the bloat it was meant to catch. Keep at least the read-tier latest 10 live. |
| `decision-log.md` oldest entry age | 90 days | Propose an archive split, oldest first — but only when ≥ 5 entries lie beyond the latest-10 read-tier floor (live log ≥ 15). Below that, note the overrun and skip: on low-velocity / sporadic projects the age budget keeps tripping with little to move, so the entry-count and per-entry budgets are the meaningful triggers. |
| `wish-list.md` open items | 25 items | Propose a triage pass (promote each into `backlog.md`, or cut). Never archive — the wish-list shrinks by triage, not by moving content to `archive/`. |
| `doc-deltas.md` open deltas (cold) | **10 open** `[ ]` lines **or** oldest **30 days** (whichever trips first) | Sign-off debt, not a file size. Under the threshold it's a session-start nudge; at or over it, propose a **Doc-sync** pass (`memory-maintenance.md`) to reconcile the protected docs. Never archive — the ledger shrinks by ticking-then-sweeping (Prune deletes `[x]` lines) and by syncing. See `end-of-task.md` step 3. |
| `tickets/<ITEM-ID>.md` (per-item, cold) | soft ~600 words each | Working detail for one open item; not counted in the every-task read load. Shrinks by lifecycle eviction, not archiving — deleted when the item ships or is cut. An orphan file (no matching open item) is structural, not a size issue: Refactor evicts it, Diagnose flags it. |
| `archive/` chunk | one epoch per file (whole month / migration boundary) | Chunk cold archives by **sequence boundary for INDEX browsability**, not size — they're never auto-read (grep + line-range only), so word count barely matters and an epoch bounds its own growth. Sub-split a single epoch only if it's genuinely unwieldy to grep; never split or merge epochs just to hit a number. Maintain `archive/INDEX.md`. |
| Unreconciled `Close: lite` closes | **5 closes** since the last reconcile marker, **or** oldest **7 days** (whichever trips first) | Deferred memory writes, not a file size. Under the cap it's a session-start nudge; at or over it, a **Reconcile** (`memory-maintenance.md`) is mandatory before the next-batch pick. Counted from `git log` since the marker, not from a file. See `end-of-task.md` → "Close mode". |
| Standing-item age (`[maintainer]`/`[sign-off]`/`[blocked]`, informational) | **WARN at 30 days** | Not a size budget — a visibility nudge so human-owned work can't age into wallpaper. Start B surfaces the oldest at the pick; the Diagnose verb counts items past the threshold. Age **never** auto-escalates an item's position — ordering stays dependency-driven. A `[security]` item (live exposure) additionally banners at every session start until closed, regardless of age. |

## Deriving the file-map budget

`file-map.md` grows with the project — it maps every source file — so a
fixed word budget goes permanently red on any codebase that succeeds,
training agent and maintainer to ignore the size check (the exact
pathology the hot-set cap was removed for). Its budget is therefore
**derived from the number of mapped files**, so it measures accreted
**noise**, not legitimate size:

- **Budget = ~35 words × mapped files, with a floor of 2,000 words.**
  Count mapped files each check — one file-map entry per line
  (``grep -cE '^- `' pm_skills/project/file-map.md``, or the project's
  bullet convention), or read the total straight from the generated
  `<!-- file-map-index -->` block when the map is produced by
  `pm_skills/scaffold/gen-file-map.mjs`. A ~180-file map budgets
  ~6,300 words: its stripped current-role floor reads green, while
  accreted history (task tags, dates, test counts) still pushes it over.
- **The coefficient (~35) is tunable per project.** 35 fits a dense
  one-line-plus-parenthetical style; a leaner map runs ~20. A project
  may state its own coefficient in `conventions.md` (or a comment in
  `file-map.md`) and derive against that — record the choice so the
  budget stays arithmetic, not archaeology.
- **The floor (2,000) protects small projects** from a budget below
  the point where the check is useful.
- **Self-explaining:** when the check reports this budget, print the
  derivation, e.g. `file-map budget: 180 files × 35 = 6,300 words`, so
  a red result is legible without re-deriving it.

Budgets are periodically re-derived from real mature projects rather
than guessed — if the coefficient drifts from what healthy maps
actually run, recalibrate it here.

## Size-check fast path

The end-of-task size check scales with what the task actually touched
(see `prompts/end-of-task.md`):

- **Fast path** — if the task appended little or nothing to project
  memory (≤ 2 memory files touched, no accreting file grew
  materially), count only the files touched and skip the rest.
- **Full sweep** — run the whole table when the task did real memory
  work (a prune, a refactor, a shipped milestone), when several files
  were touched, or if no full sweep has happened in the last ~5 tasks.
  If you cannot tell when the last full sweep ran, run one.
- The Diagnose verb of `memory-maintenance.md` remains the periodic
  deep check for structural drift the size check cannot see.

## Rules

- Budget numbers live **only** here. `AGENTS.md`, the prompts, and the
  template comments point at this file; they never restate the numbers.
- **One writer at a time.** Project memory assumes a single active task
  session. If parallel agent sessions run, only one may perform
  end-of-task memory updates; the others report their updates for the
  next serial close (parallel appends to `decision-log.md` /
  `backlog.md` conflict). The Prune verify step treats an unexpected
  concurrent edit as a stop-and-report, never a "fix". This rule has a
  mechanism, not just a constraint: the claim declaration + provenance
  check at `prompts/session-start.md` → "Parallel-session claim", the
  secondary-session handoff block at `prompts/end-of-task.md` →
  "Secondary-session close", and the multi-machine arrival procedure in
  `GUIDE.md` → "Parallel and multi-machine work". Coordination is
  advisory (chat-declared file set + `git status`), never a lockfile
  that could strand a crashed session.
- Changing a budget is a framework change (this is a `framework`-class
  file): bump `VERSION` and add a `CHANGELOG.md` entry per
  `prompts/release.md`.

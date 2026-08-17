# End of Task

Run this at the end of every task session, after implementation
and verification are complete. This is the canonical housekeeping
ritual. The integration workflows reference this file rather than
duplicating its contents.

## Close mode: full (default) or lite

Two ways to close. **Full** (the default) runs every step below.
**Lite** is a sanctioned cheap close for burst / low-ceremony work: the
quality gate and runtime-boot checks (steps 1–2) run **unchanged**, but
the memory updates and size check (steps 3–4) are deferred — the commit
message *is* the per-item record, and a later batch **Reconcile**
(`memory-maintenance.md`) back-fills project memory from git history.
Lite exists so the memory loop is never bypassed informally; it defers
the writes, it never skips them.

Use lite only when it was chosen for this run (see `task.md` →
`close: lite|full`). **Lite is forbidden** for `[sign-off]` items and
any `full`-mode run — their rationale is the record, and a one-line
trailer cannot carry it. When in doubt, close full.

### The `Close: lite` commit trailer (canonical grammar)

A lite close records the task as a **structured trailer** at the foot of
its commit message. This is the *only* place this grammar is defined; it
is a data format Reconcile parses, so keep it exact and grep-stable
(`^Item:` / `^Close:` anchored):

```text
Item: <BACKLOG-ID>
Outcome: <one line>
Decision: <one line, or "none">
Verify: typecheck 0 · <N> tests · build 0
Close: lite
```

- One trailer block per item closed in that commit.
- `Item:` must be a real backlog ID; Reconcile refuses to guess and
  lists any commit lacking a parseable `Item:` for manual triage.
- `Decision:` is a one-liner or `none`; if the decision needs more than
  one line, the task is not lite-eligible — close full.
- `Verify:` mirrors the gate result (adapt the fields to the stack;
  keep the `typecheck / tests / build` shape where it applies).

Wish-list capture (`AGENTS.md` → "Capturing deferred ideas") still
applies during a lite close — appending one line is cheap and is not
deferred.

## Secondary-session close (parallel work)

If this session ran **in parallel** with another that owns the memory
writes (see `prompts/session-start.md` → "Parallel-session claim" and
`memory-policy.md` → "One writer at a time"), do **not** write project
memory here — concurrent appends to `decision-log.md` / `backlog.md`
collide. Instead:

- Run steps 1–2 (quality gate + boot check) as normal.
- **Emit a handoff block** for the primary session (or the next serial
  close / `memory-maintenance.md` → Reconcile) to apply, carrying
  exactly what would have gone into memory:

  ```text
  Handoff: <BACKLOG-ID>
  Trajectory: <one line — outcome (date)>
  Decision: <the why, or "none">
  Files: <file-map role changes, or "none">
  Backlog: <status change — remove / update>
  ```

- Stage and commit **only your own paths** — never `git add -A` while
  parallel (`integrations/task.md` → step 11) — so you don't sweep up
  the primary's in-flight edits.
- **Records mode** (a generated backlog over per-item records): your
  backlog changes ride your branch as record edits and merge
  mechanically at integration — the handoff block shrinks to the
  shared-file appends only (`Trajectory:` and `Decision:`), and the
  `Backlog:` line becomes "record updated on branch". On any view
  conflict at merge, regenerate from the merged records; never
  hand-merge the view.

The single active session, or the **primary** of a parallel set, closes
normally with steps 3–5 below (and applies any handoff blocks it was
given). This defers the secondary's writes to a serial close; it never
skips them.

## 1. Run the quality gate

Run the project's one-command quality gate before closing — the `check`
command in `DEV-INFRASTRUCTURE.md` → "Quality gate" (see `AGENTS.md` →
"One-command quality gate").

- Run `check` and confirm it is green: format/lint, type check, tests,
  build, and doc/link integrity as the stack provides.
- `check` is non-mutating. If it reports fixable issues, run the separate
  auto-fix verb, then re-run `check`; never skip or weaken a check to pass.
- A red gate means the task is not done. Fix the cause, or — if a rule is
  genuinely wrong for this project — record why and adjust the rule as
  part of the change.
- If the project has no gate yet (early MVP), say so and verify manually,
  noting what was checked.

## 2. Verify the runtime still boots (if this task touched it)

If this task changed the runtime — a server, worker, port, env var,
generated output, build step, dependency, or a boot/reboot/status
script — confirm the app still recovers cleanly before closing:

- Boot from cold via the canonical command in `DEV-INFRASTRUCTURE.md`
  → "Runtime lifecycle" (`reboot` / `dev` for most projects).
- Confirm it reaches a verified-ready state (health endpoint or
  expected output), not merely that a process launched.
- Report the dev URL, the log location, and any manual step that is
  not yet automated.
- If the runtime surface changed, update `DEV-INFRASTRUCTURE.md` →
  "Runtime lifecycle" (see step 3) to match.

If the task did not touch the runtime, say "not applicable" and move on.

## 3. Update project memory

**Lite close:** skip this step — the memory writes are deferred to the
next **Reconcile** (`memory-maintenance.md`). Instead, record the
`Close: lite` trailer (grammar above) in the commit message. Jump to
step 5 and report "lite close — reconcile pending". Steps 1–2 still ran.

Update each of the following if relevant to this task:

- `pm_skills/project/decision-log.md` — record the key design decision
  from this task (the WHY). This is the canonical home for the
  reasoning; other files point here, they never restate it.
- `pm_skills/project/backlog.md` — when this task ships, **remove** its
  item (there is no Completed section); add any follow-ups to Active as
  open items. If the task isn't finished, update its status in place.
- `pm_skills/project/tickets/<ITEM-ID>.md` — if the active item carries
  the `[detail]` flag: when it ships or is cut, fold any durable
  conclusions into `decision-log.md` (the why) + `trajectory.md` (the
  outcome), then **delete** the ticket file — it does not outlive the
  item. If the item continues, update it with new context (soft ~600
  words). If scoping created one this task, confirm the `[detail]` flag
  is on the item.
- `pm_skills/project/trajectory.md` — when this task ships, add ONE
  line under the current phase: `ITEM-ID — outcome (date) — see
  decision-log`. Compress on ship: outcome here, why in the log, file
  roles in file-map. Never paste the decision-log prose.
- `pm_skills/project/wish-list.md` — append any out-of-scope ideas
  surfaced this task, one line each.
- `pm_skills/project/doc-deltas.md` — if this task changed behaviour a
  **protected doc** (SPEC, ADR, or its kin — edit-on-request only)
  describes, append one capture line
  (`- [ ] YYYY-MM-DD <doc §> — <one-line delta> (source: <ID/entry>)`)
  rather than editing the doc or burying the flag in a decision entry.
  ADR status closures (Proposed → Accepted) are a delta too. The
  reconciliation itself happens later in the batched `doc-sync` pass
  (`memory-maintenance.md`), never here. Skip if the project has no
  protected docs.
- `pm_skills/project/file-map.md` — if files were added, renamed, or
  deleted, run `node pm_skills/scaffold/gen-file-map.mjs` (if the
  project has it):
  it refreshes the skeleton mechanically — regrouping paths, preserving
  existing role text, marking new files `(role needed)`, and flagging
  paths no longer on disk. Then write role text for the `(role needed)`
  lines only, and confirm any flagged stale paths. No generator (or role
  edits only): update the affected lines by hand. Map roles, not change
  history.
- `pm_skills/project/conventions.md` — if new conventions were
  established or existing ones changed.
- `README.md` — if architecture, dev workflow, or key infrastructure
  changed significantly.
- `AGENTS.md` — if this task established new invariants, data model
  changes, protected modules, event namespaces, or anti-patterns.
  Check whether `AGENTS.md` still reflects current architecture and
  conventions.
- `UI-STANDARDS.md` — if this task established new token systems, UI
  conventions, or the diagnostics affordance.
- `DEV-INFRASTRUCTURE.md` — if this task changed build, dev server,
  versioning, script conventions, the runtime lifecycle (boot/reboot/
  status commands, process ownership, health checks, protected paths),
  or maintainer diagnostics (the logger, buffer, redaction, or copy
  bundle).

## 4. Run the memory size check

**Lite close:** skip — no memory was written, so there is nothing to
size-check. The deferred writes are budget-checked at Reconcile.

Budgets are defined in `pm_skills/memory-policy.md`. Do not duplicate
the numbers here.

**Memory validator (preferred when the project keeps one).** If the
project has a memory validator — one command that checks the ticket
grammar, hygiene (`[x]` eviction, ticket orphans, merge residue,
lite-close trailers), and every budget mechanically, reading the
machine-readable block in `pm_skills/memory-policy.md` — run it and
use its report for this whole section: structural failures must be
fixed before closing; its WARN lines feed the proposals below. The
manual counts below remain the fallback when no validator exists.
It validates the form of memory, never the truth of it — the
judgement steps of this close are not delegated to it.

**Fast path (most tasks).** If this task touched ≤ 2 memory files and
added no material content to an accreting file, count only the files
touched and skip the rest of this section — note "size check: fast
path" in the report. Run the **full sweep** below when the task did
real memory work (a prune, refactor, or shipped milestone), touched
several memory files, or if no full sweep has run in the last ~5
tasks (`memory-maintenance.md` → Diagnose also covers this
periodically).

Full sweep:

- Word-count `file-map.md` against its accreting budget, which is
  **derived from the mapped-file count** (see `memory-policy.md` →
  "Deriving the file-map budget"); print the derivation, not just the
  verdict. Word-count each reference doc (`README.md`, `brief.md`,
  `architecture.md`, `conventions.md`, + any project-added
  standards/process/infra docs) against its soft guideline. Do not sum
  them into an aggregate hot-set cap — there isn't one. The conditional
  reads (`UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`) are not part of the
  every-task check (step 1 reads only the Quality gate section, not the
  whole file).
- Count the backlog **Active** section's words and open items, and
  confirm **no `[x]` list items remain** in `backlog.md`
  (`grep -cE '^\s*[-*] \[x\]'`, so the status-legend line is not a false
  positive) — shipped work belongs in `trajectory.md`.
- Word-count `trajectory.md`.
- Count entries in `decision-log.md`, flag any single entry over the
  per-entry guard, and check the oldest entry's date. The entry count
  is the primary trigger; the per-entry guard catches a single runaway
  entry (keep entries ~150–300 words), not normal accumulated density.
- Count open items in `wish-list.md`.
- If `pm_skills/project/doc-deltas.md` exists: count open (`[ ]`) delta
  lines and note the oldest date, against the ledger budget in
  `memory-policy.md`. Over budget is drained by a `doc-sync` pass
  (`memory-maintenance.md`), not by archiving.
- If `pm_skills/project/tickets/` exists: word-count each file against its
  soft ~600-word guideline, and confirm every ticket file maps to an open
  backlog item that carries `[detail]` (`ls` the folder, grep the backlog)
  — an orphan left by a shipped or cut item must go.

If any budget is exceeded:

- Do not auto-prune.
- Output one line per overrun: which file, which budget, current
  value.
- Exception: if only the `decision-log.md` age budget is exceeded
  and fewer than ~5 entries lie beyond the latest-10 floor, just
  note it — don't propose a prune. On low-velocity / sporadic
  projects the age budget trips repeatedly with little to archive;
  the entry-count and per-entry budgets are the meaningful triggers.
- An over-budget `wish-list.md` is drained by triage, not archiving.
  Propose a triage pass (promote or cut) — via the next-batch pick
  (`session-start.md` → Start B) or the Prune triage action — rather
  than an archive split.
- An over-budget `doc-deltas.md` is drained by a `doc-sync` pass, not
  archiving. Propose `memory-maintenance.md` → Doc-sync (present each
  doc's batched diff for sign-off, apply, tick lines).
- `[x]` items left in the backlog, or a backlog Active over budget, are
  a structural issue, not a size one: propose `memory-maintenance.md`
  → Refactor (move shipped work to `trajectory.md`, restructure the
  queue) rather than a generic prune.
- An orphan ticket file (no matching open `[detail]` item) is structural
  too: delete it here if its item shipped/was cut this task, else propose
  `memory-maintenance.md` → Refactor to sweep orphans.
- Propose the Prune verb of `pm_skills/prompts/memory-maintenance.md`
  and wait for user approval.

## 5. Report

Output a one-line summary:

- Whether the quality gate (`check`) passed (or n/a).
- Whether the runtime was verified to boot to a ready state (or n/a).
- Which memory files were updated — or, on a **lite close**, "lite
  close — reconcile pending" plus the `Item:` IDs recorded in the
  trailer.
- Which budgets were checked (or "size check: fast path", or "n/a —
  lite close").
- Whether any tripped (and the proposal made if so).
- Commit status: `committed and pushed` / `committed — no remote` /
  `blocked: <cause>`. Committing — and pushing when a remote is
  already configured — is a standard close step (4.2.0), with the
  staged-set echo and parallel-session staging rules of
  `integrations/task.md` → step 11. A project may restore
  propose-only behaviour in its root `AGENTS.md`. Say "not a git
  repo" and skip if it isn't one.

Present the report to the user before closing the task.

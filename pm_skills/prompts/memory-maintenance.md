---
description: Maintain project memory — diagnose drift, prune by size, refactor the roadmap, reconcile lite closes, sync protected docs
---

# Memory Maintenance

The one file for keeping project memory healthy. Five verbs, each a
self-contained procedure — run only the section you were asked for
(the others are context, not obligations):

- **Diagnose** — read-only health check. Run periodically, after a
  long gap, or when memory "feels" noisy. Proposes the right repair;
  never edits.
- **Prune** — archive by size. Run when the end-of-task size check
  flags a file over budget.
- **Refactor** — repair the roadmap's structure. Run when the backlog
  has drifted (done-work mixed in, dated rounds, duplicates).
- **Reconcile** — back-fill project memory from git history after
  `Close: lite` closes (`end-of-task.md`). Run when lite closes have
  accumulated, or when session-start / the cap says one is due.
- **Doc-sync** — reconcile protected docs (SPEC, ADRs, and kin) against
  the `doc-deltas.md` ledger in one batched, sign-off-gated pass. Run
  when the ledger is over threshold, or when session-start flags it.

Diagnose/Prune/Refactor replace the former `doctor-memory.md`,
`prune-memory.md`, and `roadmap-refactor.md`; those names survive as
verbs. Budgets and the reconcile cap come from
`pm_skills/memory-policy.md`; tier names from `AGENTS.md` → "Read
tiers". Read them from there; do not restate the numbers.

Shared rules for all five verbs: prefer plain shell (`wc`, `head`,
`tail`, `grep`, `ls`, `cp`, `mv`, `git log`, output redirection) and
no retry loops — if a step fails, **stop and report**; never
improvise around a failed move. Minimise meta-cost: single pass,
batch the work.

Model tier (per-*step*, not per-*verb*): the mechanical halves — every
count, Diagnose's greps, Prune's P1/P4/P5 detect/execute/verify,
Reconcile's log harvesting — run fine on a cheaper, faster model; the
**propose** steps (Prune P2, Refactor R3, Reconcile RE3) and any
judgement call want the stronger tier. See `GUIDE.md` → "Looking after
project memory".

---

## Environment preflight (shared)

The memory model assumes a sane filesystem — a repo that stays where
git left it. Cloud-sync folders (OneDrive, Dropbox, Google Drive,
iCloud) break that assumption: they silently revert tracked files
mid-session, drop content, and spawn conflict copies. This is the
**canonical** preflight; `session-start.md`, **Prune** (P3), and
**Upgrade** (Step 5) all reference it rather than restating it.

**Severity depends on the caller.** At **session start** it is
**warn-only** — a daily blocker gets disabled. Before **file surgery**
(Prune P3, Upgrade Step 5) it **stops** on any finding: those flows are
about to move files, and moving files on top of sync corruption is how
the good copy gets lost.

### E1. Detect (cheap, shell-only — no packages)

Three checks, each a single command from the repo root:

- **Cloud-sync path** — does the repo path sit under a sync root?

  ```sh
  pwd -P | grep -Ei 'Library/CloudStorage|OneDrive|Dropbox|Google Drive|iCloudDrive|iCloud~'
  ```

  A match means every check below matters; a clean path usually makes
  this preflight a no-op.
- **Conflict artefacts** — derive the hostname, never hard-code it, and
  scan for sync conflict copies:

  ```sh
  HOST="$(scutil --get LocalHostName 2>/dev/null || echo "${HOST:-$(hostname -s)}")"
  find . -path ./node_modules -prune -o \
    \( -name "*-${HOST}*" -o -name "* (1).*" -o -name "*-conflict-*" \
       -o -name "*conflicted copy*" \) -print
  ```

- **Git sanity** — uncommitted state and a HEAD check against the last
  known SHA when one is recorded (the `Reconcile marker:` in
  `decision-log.md` pairs well):

  ```sh
  git status --porcelain
  git log -1 --format=%H
  ```

  Unexpected reverts on files you did not touch, or a HEAD behind the
  recorded marker, are the sync-corruption signature.

### E2. Classify and repair (the sync-repair playbook)

For each conflict copy found, classify it against `HEAD` before
touching anything — sometimes the conflict copy holds the only good
content, sometimes the working tree does. Never bulk-delete.

| State | Test | Action |
| --- | --- | --- |
| Byte-identical to HEAD | `git show HEAD:<path> \| diff -q - <conflict-copy>` reports no difference | Safe to delete the conflict copy. |
| Conflict copy = HEAD + live edits (working file was stale-reverted) | working file matches HEAD but the copy carries the session's edits | Move the conflict copy over the stale working file, then re-verify. |
| Working tree is the superset (the `.env.example` case) | the working file is the fuller version; the copy is stale | Keep the worktree, re-stage it, delete the copy only after byte-verifying it adds nothing. |
| Uncertain | diffs disagree or content is genuinely divergent | **Stop.** Show the diffs and ask; never guess. |

Always run `git status` **before and after** any move or delete.
Never auto-delete a conflict copy without a byte-verification against
HEAD (`diff -q` / `cmp`) — a stale-revert can leave the copy as the
sole carrier of real work.

### E3. Record

Log one line per repair to the consuming project's `decision-log.md`
(top, append-only): the date, "Sync-conflict repair", and a one-line
summary (files restored / copies deleted, classification used). This
keeps a standing record so a recurring hostile-filesystem problem
becomes visible rather than repeatedly re-improvised.

### Standing advice

Cloud-synced repo paths are **unsupported** for project memory. If the
location is unavoidable, pause syncing during sessions or exclude
`.git` from sync. Session start repeats this warning every time
precisely so the advice cannot silently lapse.

---

## Diagnose (read-only health check)

Catches *structural* drift the end-of-task size check cannot see:
done-work in the wrong place, stale paths, duplication, version lag.
It never edits files itself.

Run each check and record a row: **Check | Status (OK / WARN / FAIL) |
Detail | Proposed action**.

1. **Budgets** — word-count `file-map.md` against its accreting budget
   (derived from the mapped-file count — show the derivation) and each
   reference doc (soft per-doc guideline); count backlog Active
   words and open items; count decision-log entries, flag any single
   entry over the per-entry guard, and note oldest-entry age; count
   trajectory words; count wish-list open items.
   Compare against `memory-policy.md` — there is no aggregate hot-set
   cap. FAIL on an accreting or sectional overrun (action: **Prune**);
   a reference doc over its soft guideline is a WARN, not a FAIL (not a
   prune target — tighten or split only if genuinely bloated).

2. **Done-work in the backlog** — `grep -cE '^\s*[-*] \[x\]'
   pm_skills/project/backlog.md`. The backlog holds open work only;
   shipped items belong in `trajectory.md`.
   WARN/FAIL if any `[x]` present, or if a `## Completed` section
   exists. Action: **Refactor**.

3. **Backlog hygiene** — count dated "round" / "follow-up" / "triage"
   history headings under Active. Many such sections = the backlog is
   doubling as an audit trail.
   WARN past a handful. Action: **Refactor**.

4. **Stale file-map paths** — for each `path` referenced in
   `file-map.md`, check it exists on disk. List any that no longer
   resolve (deleted/renamed without a map update).
   FAIL on any missing path. Action: update `file-map.md`.

5. **Cross-file duplication** — sample the largest backlog items and
   decision-log entries; flag where the same prose appears in both
   (a completed item narrated in full in the backlog *and* the log).
   WARN. Action: compress the backlog/trajectory side to a pointer.

6. **Archive hygiene** — confirm `archive/INDEX.md` exists and lists
   every file in `archive/`; confirm INDEX rows resolve to real files;
   note any chunk that spans more than one epoch (a browsability nicety,
   not a size check — cold archives are never auto-read).
   WARN on a missing/stale INDEX; a multi-epoch chunk is INFO only.
   Action: **Prune** (rebuild INDEX / split on epoch boundary).

7. **Archive referential integrity** — verify every dated decision-log
   pointer in the trajectory resolves to real content, the silent-loss
   mode checks 4 and 6 are blind to (they verify *files*, not *content
   coverage*). Harvest pointers:
   `grep -ohE 'decision-log 20[0-9]{2}-[0-9]{2}(-[0-9]{2})?' pm_skills/project/trajectory.md pm_skills/project/archive/trajectory/*.md 2>/dev/null | sort -u`.
   Harvest coverage: the live log's `## YYYY-MM-DD` headings in
   `pm_skills/project/decision-log.md` plus each archive's INDEX date
   range. A referenced date covered by neither is an orphan. FAIL on any
   orphan, each with a git-recovery hint
   (`git log -S '## <date>' -- <decision-log path>`). Anchor the harvest
   to the established cross-ref phrasing and word the finding
   "unresolved reference", not "data loss" — a small false-positive rate
   is the price of one cheap single pass. Action: propose restoring the
   missing entries into a dated archive chunk with a provenance header
   (append-only; applies only with approval, per Diagnose-never-edits).

8. **Version drift** — read `pm_skills/VERSION`. If a framework source
   is available, compare to its `VERSION`. If behind, note the gap.
   WARN if behind. Action: `prompts/upgrade.md`.

9. **ADR / decision status** (only if the project uses ADRs or a status
   field) — best-effort grep for decisions referenced as final whose
   source still reads "Proposed"/"Draft". Surface mismatches; do not
   resolve them.
   WARN. Action: maintainer review.

10. **Orphan ticket files** (only if `pm_skills/project/tickets/` exists) —
    for each `tickets/*.md`, confirm a matching open backlog item exists
    and carries `[detail]`; and for each `[detail]` flag in the backlog,
    confirm its file exists.
    WARN on an orphan file (item shipped/cut, file lingered) or a dangling
    flag (file missing). Action: **Refactor**.

11. **Unreconciled lite closes** — count `Close: lite` trailers in
    `git log` since the last reconcile marker (see **Reconcile** RE1 for
    how to find it). Compare against the reconcile cap in
    `memory-policy.md` (count and oldest-age).
    WARN past the cap, or if the oldest exceeds the age cap. Action:
    **Reconcile**.

12. **Doc-delta ledger health** (only if `pm_skills/project/doc-deltas.md`
    exists) — count open (`[ ]`) delta lines and note the oldest date.
    Compare against the ledger threshold in `memory-policy.md`.
    WARN past the threshold (open count or oldest age). Action:
    **Doc-sync**.

13. **Ageing standing items** — count open `[maintainer]`/`[sign-off]`/
    `[blocked]` items whose creation date is older than the standing-item
    age threshold in `memory-policy.md`; list the oldest few with their
    age. Also flag any open `[security]` item regardless of age (live
    exposure). WARN past the threshold, or on any open `[security]`.
    Action: maintainer review — they surface at the next Start B pick,
    and a `[security]` ager banners at every session start until closed.
    Diagnose never reorders the queue; age is informational.

Report: the health table, FAILs first; below it, a short prioritised
action list grouping checks by the verb that fixes them (e.g. "Run
**Refactor** — addresses checks 2, 3, 5"). If everything is OK, say so
in one line and stop. A check that does not apply (no ADRs, no
framework source) is "n/a", not failed. Propose the verb, then let the
user run it (or approve running it). Keep it cheap — single-pass
counts and greps, no deep reads beyond the samples check 5 needs.

---

## Prune (archive by size)

Run when the end-of-task size check flags any project memory file over
budget, or when the user requests a memory prune.

### P1. Detect

Word-count each hot whole-file read listed in `AGENTS.md` →
"Read tiers" against the budgets in `pm_skills/memory-policy.md`: the
reference docs (`README.md`, `brief.md`, `architecture.md`,
`conventions.md`, + any project-added standards / process / infra
docs) against their soft per-doc guideline, and `file-map.md` against
its accreting budget (**derived from the mapped-file count** — see
`memory-policy.md` → "Deriving the file-map budget"; show the
derivation). Do **not** sum them into a single hot-set
cap — there is no aggregate word budget. Count the backlog **Active**
words and open items, and any shipped `[x]` items still in
`backlog.md` — anchor the count to list items
(`grep -cE '^\s*[-*] \[x\]'`) so the status-legend line is not a false
positive. Word-count `trajectory.md`. Count entries in
`decision-log.md`, flag any single entry over the per-entry guard, plus
the oldest entry date. Count open items in
`wish-list.md`. For `archive/` files, note only whether a chunk spans
more than one epoch (multiple months, or across a migration boundary)
— size is not a trigger; cold archives are never auto-read (grep +
line-range only).

Output a short table: **File | Metric | Current | Budget | Status**.
This is the **before** snapshot.

### P2. Propose

For each over-budget file, propose one specific action:

- `file-map.md` over budget → strip historical and batch notes (task
  tags, dates, test counts), keep current roles only. Move stripped
  content to
  `pm_skills/project/archive/file-map-YYYY-MM-DD-historical.md`. The
  floor is the irreducible current-role list; on a large codebase that
  may still exceed the budget — strip noise, not signal, and stop there
  rather than gutting real roles to hit the number.
- `architecture.md` or `conventions.md` over budget → propose
  tightening or splitting; usually content belongs in
  `decision-log.md` or in a new permanent contract file.
- `brief.md` over budget → propose tightening (rare).
- `[x]` items in `backlog.md` (shipped work that never left) → for
  each, compress to a one-line outcome under the current phase of
  `trajectory.md` and confirm the WHY is in `decision-log.md`, then
  remove it from the backlog. A legacy `## Completed` section migrates
  the same way, then the heading is removed.
- `backlog.md` Active over budget → this is structural, not just size.
  Recommend **Refactor** (regroup by lifecycle, dedupe stale rounds,
  evict done-work). Prune may still relocate obvious done-work per the
  rule above, but leave the re-sequencing to the refactor.
- `trajectory.md` over budget → move the oldest phases verbatim to
  `archive/trajectory/trajectory-NNNN-YYYY-MM-DD-to-YYYY-MM-DD.md`
  (sequence-numbered), keeping recent phases live. Add an
  `archive/INDEX.md` row.
- `decision-log.md` > entry budget OR any single entry > the per-entry
  guard OR oldest > age
  budget → archive the oldest entries, keeping the latest live (at
  least the read-tier latest 10, ideally a generous margin above it).
  Default split is by whole month into `archive/decision-log-YYYY-MM.md`.
  If a single month is genuinely unwieldy to grep, sub-split it by
  date-range into `archive/decision-log-YYYY-MM-DD-to-YYYY-MM-DD.md`,
  oldest entries first — but size alone isn't a reason to split; an
  epoch stays one file unless browsability demands otherwise. Leave a
  one-line index at the bottom of the live file pointing at each
  archive file. If only the age budget is tripped (not the entry count
  or per-entry guard) and fewer than ~5 entries lie beyond the latest-10
  floor, note the overrun and skip — the archive gain doesn't justify
  the prune (common on low-velocity / sporadic projects).
- `wish-list.md` over budget → do **not** archive. Propose a triage
  pass: for each open item, promote it into `backlog.md` (Current,
  Next, or Icebox) or cut it. Survivors move to the backlog; cuts are
  deleted. The file shrinks by triage, not by moving content to
  `archive/`.
- `doc-deltas.md` over budget → do **not** archive. Delete any ticked
  (`[x]`) lines (already-reconciled deltas kept only as a short audit
  trail), then, if open (`[ ]`) deltas still exceed the threshold,
  propose a **Doc-sync** pass to reconcile them. The ledger shrinks by
  ticking-then-sweeping and by syncing, never by moving to `archive/`.
- `archive/` chunk spanning multiple epochs → optionally split on the
  epoch boundary (month / migration) for INDEX browsability, oldest
  first. Size is not a trigger — a single epoch stays one file however
  large, since cold archives are grepped, not loaded whole. Never
  rewrite the entries themselves; only divide the file. Update
  `archive/INDEX.md`.
- A **reference doc** over its soft guideline → reference docs are
  **not** prune targets; they don't accrete. Leave it unless genuinely
  bloated, in which case propose tightening it or splitting detail
  into a permanent contract file — never strip it to hit a number.
- Every-task read load feels heavy → there is no aggregate word cap to
  "fix". Propose a structural review: is a reference doc bloated
  (tighten per above), should a hot read move to **conditional** or
  **warm**, or is `file-map.md` carrying accreted history (strip per
  above)? Do not blanket-trim files already within their own budget.

Present the proposal to the user. Wait for approval. Do not skip.

### P3. Backup (conditional)

First run the **Environment preflight** (above). This flow is about to
move files, so treat it as **blocking**: on any conflict artefact or
git-sanity finding, stop and run the E2 repair playbook before backing
up — never archive on top of sync corruption.

Then run `git status --porcelain` on the project root.

- If output is empty (working tree clean), skip explicit backup —
  git history is sufficient.
- If output is non-empty, copy each file to be modified into
  `pm_skills/project/archive/backup-YYYY-MM-DD-HHMM/` first.

### P4. Execute

For each approved prune, work non-destructively first — build the
new files alongside the original, verify, then swap:

- Create `pm_skills/project/archive/` if it does not exist.
- Build the archive file from the original's verbatim slice (e.g.
  `tail -n +N "$SRC" > "$ARCHIVE"`) plus a short archive header.
  Preserve append-only entries verbatim — never rewrite.
- Build the trimmed live file into a temp (e.g. `"$SRC.tmp"`): the
  kept content plus, for `decision-log.md`, a one-line index entry
  at the bottom for each archive file, in the form
  `## Archived: 2026-04 — see archive/decision-log-2026-04.md` (or
  `## Archived: 2026-05-02 → 2026-05-20 — see archive/…` for a
  date-range split).
- Run the P5 `diff` checks against the still-intact original
  BEFORE swapping. Only swap once they prove the split is lossless:
  `mv "$SRC.tmp" "$SRC"`.

Keep each shell command simple and single-purpose — large compound
`{ … }` blocks with inline comments get mangled in the terminal.
Batch the prunes, but do not iterate file-by-file with confirmation
prompts.

### P5. Verify

- Re-run word and entry counts. Confirm all files are now under
  budget (or at the agreed generous target).
- Prove append-only entries are unchanged byte-for-byte with
  `diff`, run against the still-intact original before the P4
  swap: `diff <(tail -n +N "$SRC") <(tail -n +M "$ARCHIVE")` for the
  archived slice and `diff <(head -n K "$SRC") "$SRC.tmp"` for the
  kept slice — both must report no differences.
- Reconcile counts: archived + kept must equal the original total.
  Nothing is lost.
- Confirm archive files exist with the moved content, and the live
  file's index pointer(s) resolve to them.
- After a `decision-log.md` or `trajectory.md` split, re-run the
  archive referential-integrity check (Diagnose check 7) over the
  touched files — cheap confirmation the split orphaned no trajectory
  pointer.
- Confirm the backlog Active open items are unchanged — except any
  `[x]` done-work intentionally relocated to `trajectory.md` this pass.
- If counts don't reconcile, or a file you did not prune shows as
  modified, suspect a concurrent edit from a parallel task — stop,
  report it, and do not "fix" it. It is not part of the prune.
- Output a before / after table.

### P6. Record

- Append a one-line entry to `decision-log.md` (top, append-only):
  the date, "Pruned project memory", and a one-line summary of
  what was archived (e.g. "decision-log April 2026 → archive,
  12 shipped items → trajectory").
- Maintain `pm_skills/project/archive/INDEX.md` (create it if missing):
  add a row per new or split archive file — filename, type
  (decision-log / trajectory / file-map / backup), date range or
  sequence number, entry/word count, and a one-line description. Put an
  entry/word count only on **frozen archive rows**, never on a live-file
  row — the count goes stale the moment this prune appends its own
  record entry. The INDEX is the browsable map of cold storage; keep it
  current so a reader never has to open a chunk to know what it holds.
- If new archive files were created, add them to
  `pm_skills/project/file-map.md` under a new "Archive" section
  if one does not already exist.
- Stage any new archive files with `git add <archive-file>` so the
  moved history isn't left untracked and lost. Leave committing to
  the user.

### Prune rules

- Append-only files (`decision-log.md`): move entries verbatim.
  Never rewrite. Never collapse. Never summarise on archive.
- Live files keep the latest content; archives keep history.
- Archives are append-only too — never rewrite an existing archive's
  entries. Splitting a chunk on an epoch boundary into smaller
  sequential chunks is allowed (it divides the file, it does not
  rewrite entries) and must update `archive/INDEX.md`.
- If multiple files exceed budget, prune them all in one pass to
  avoid multiple sessions of meta-cost.
- If unsure whether to archive a piece of content, leave it in the
  live file. False positives are worse than false negatives —
  content can always be archived next session.

---

## Refactor (repair the roadmap)

Run when the roadmap has drifted: the backlog has grown into many
dated rounds, completed work is mixed in with open work, items
duplicate or contradict each other, or the next-batch pick
(`session-start.md` → Start B) can no longer answer "what's next" at a
glance. Also run it when **Diagnose** or the end-of-task size check
flags the backlog Active section over budget.

This **repairs the map**. It does not pick the next task (Start B) and
it does not archive history by size (**Prune**). It reorganises open
work by lifecycle and dependency, and evicts anything that is no
longer open work.

### R1. Load

- `pm_skills/project/backlog.md` — the whole file (not just Active; you
  are repairing the structure, including any drift below Active).
- `pm_skills/project/wish-list.md` — the capture inbox.
- `pm_skills/project/trajectory.md` — latest phase only, to see what
  already shipped (so you can spot done-work still in the backlog).
- `pm_skills/project/decision-log.md` — latest entries, for context on
  recent calls and blockers.

### R2. Diagnose the queue

Produce a short findings list. Look for:

- **Done-work in the backlog** — any `[x]` item, or any item whose
  outcome is already in `trajectory.md`. These must leave the backlog.
- **Stale history sections** — dated "round" / "follow-up" / "triage"
  headings kept only as an audit trail. The audit trail belongs in the
  decision-log and trajectory, not in the live backlog.
- **Duplicates and supersedes** — two items asking for the same thing;
  an item overtaken by a shipped change.
- **Blocked chains** — `[blocked: X]` / `after X` dependencies; surface
  the order they unblock in.
- **Contradictions and stale status** — items that disagree with the
  decision-log or with shipped reality.
- **Intent gaps** — non-trivial open items with no statement of intent
  or acceptance condition (see the canonical ticket grammar in the
  `pm_skills/project/backlog.md` template comments).
- **Orphan ticket files** — any `pm_skills/project/tickets/<ITEM-ID>.md`
  with no matching open backlog item, and any `[detail]` flag whose
  file is missing.

### R3. Propose (diff-style, before write)

Present a single proposal the user can approve in one read:

1. **Cleaned queue** — the open items, regrouped into the backlog
   Active lifecycle (Current / Next / Icebox) and ordered by dependency.
2. **Evictions** — done-work to move to `trajectory.md` (one line each),
   stale history sections to drop (already captured in the log), and
   orphan ticket files to delete (with the item gone, the file goes too).
3. **Merges / cuts** — duplicates folded; dead items cut, with reason.
4. **Promotions** — wish-list items worth pulling in, placed relative to
   existing items with a one-line above/below rationale.
5. **Open decisions** — anything that needs a maintainer call.

Show it as a before → after for the backlog structure. STOP. Wait for
sign-off. Never rewrite the roadmap silently.

### R4. Apply (after sign-off)

- Rewrite the backlog Active section to the cleaned queue. Keep open
  items' wording; only restructure, reorder, and regroup.
- Move done-work to `trajectory.md`, compressed: `ITEM-ID — outcome
  (date) — see decision-log`. Start the line with the ID; never paste
  the implementation prose. When one line covers a group of sub-items,
  spell out each ID (`WL-19a, WL-19b, … WL-19h`) rather than a range,
  so every shipped ID stays individually greppable for a reconcile.
- Drop stale history sections only once their content is confirmed to
  live in the decision-log / trajectory. If unsure, leave it.
- For any item leaving the backlog, delete its
  `pm_skills/project/tickets/<ITEM-ID>.md` once its durable conclusions
  are in the decision-log / trajectory; and clear any `[detail]` flag
  whose file is missing.
- Apply only the promotions and cuts the user confirmed.
- Non-trivial open items use the canonical ticket grammar from the
  `pm_skills/project/backlog.md` template comments — enough to survive
  future compression, never an essay.

### R5. Record

- Append one entry to `decision-log.md` (top): date, "Roadmap refactor",
  and a one-line summary of what moved, merged, and was cut.
- If done-work moved to `trajectory.md`, note it.
- Stage new/changed memory files with `git add`. Leave committing to
  the user.

### Refactor rules

- This is a structural repair, not a re-prioritisation by deadline.
  Order by dependency unless the user says otherwise.
- Never delete an item's intent. Cutting is explicit and reasoned;
  history moves to the trajectory/log, it is not erased.
- Preserve append-only files verbatim when moving entries.
- If the backlog is already lean and lifecycle-clean, say so and stop.

---

## Reconcile (back-fill memory from lite closes)

Run when tasks have closed **lite** (`end-of-task.md` → "Close mode")
and their deferred memory writes need folding back in, or when
session-start / Diagnose / the cap flags a reconcile due. This is the
scripted form of the by-hand batch back-fill: one pass reads the
`Close: lite` commit trailers since the last reconcile and writes the
memory those tasks skipped — losslessly, no task's record dropped.

Reconcile does not pick work (Start B), archive by size (Prune), or
re-sequence the queue (Refactor). It only turns committed trailers into
project-memory entries.

### RE1. Find the window

- The reconcile **marker** is the last-reconciled commit SHA, stored in
  the most recent reconcile entry in `decision-log.md`. Find it:
  `grep -m1 'Reconcile marker:' pm_skills/project/decision-log.md`.
- If a marker exists, the window is `git log <marker>..HEAD`. If none
  exists (first ever reconcile), use the full history the user names, or
  the oldest unrecorded commit — state which.
- List the window's commits oldest-first:
  `git log --reverse --format='%H %s' <marker>..HEAD`.

### RE2. Parse the trailers

For each commit in the window, read its message and extract every
`Close: lite` trailer block (grammar in `end-of-task.md`). Anchor the
greps: `^Item:`, `^Outcome:`, `^Decision:`, `^Close:`. Build a table
with columns: commit (short SHA), item, outcome, decision, date.

- A commit with a `Close: lite` trailer but **no parseable `Item:`** is
  a defect — list it under "manual triage", never guess the ID.
- **Degraded mode:** commits in the window with **no close trailer at
  all** (e.g. a pre-lite era, or an informal bypass) are listed
  separately for the user to map by hand. Reconcile records only what it
  can parse; it never invents an outcome for an unlabelled commit.

### RE3. Propose (before write)

Present, for user approval:

1. **Parsed table** — the `Close: lite` items, oldest first.
2. **Backlog evictions** — the item IDs to remove from `backlog.md`
   Active (each must currently be an open item).
3. **Trajectory lines** — one per item, in the form
   `ITEM-ID — outcome (date) — see commit <short-sha>`.
4. **One consolidated decision-log entry** — a single entry standing in
   for the whole batch, naming **every** folded item ID and its
   one-line `Decision:` (or "none"), so no folded decision is invisible.
5. **Manual-triage list** — commits with a missing `Item:` or no
   trailer, for the user to map or dismiss.

Wait for approval. Never auto-run a reconcile (consistent with Prune).

### RE4. Lossless check

Before writing, prove the mapping is complete — mirror the line-anchored
reconcile discipline:

- The set of parsed trailer `Item:` IDs **must equal** the set of
  backlog IDs to evict **plus** the set of new trajectory IDs. No item
  is written to the trajectory without leaving the backlog, and none
  leaves the backlog without a trajectory line.
- Every parsed ID must resolve to an open backlog item. An ID with no
  matching open item is a mismatch — stop and report; do not evict a
  guess or fabricate a line.
- If the sets do not reconcile, stop and report the difference. Do not
  write partial memory.

### RE5. Apply (after sign-off)

- Remove each reconciled item from `backlog.md` Active.
- Append each trajectory line under the current phase of
  `trajectory.md` — ID first, outcome, date, `see commit <short-sha>`.
  Never paste the decision prose.
- Append the **one** consolidated entry to `decision-log.md` (top,
  append-only): date, a `Reconcile — N lite closes` heading, every
  folded item ID with its one-line decision, and — critically — the
  marker line
  `Reconcile marker: <HEAD-sha>` so the next reconcile knows where to
  start.
- Leave any manual-triage commits for the user; do not write memory for
  them.
- Stage the changed memory files with `git add`. Leave committing to
  the user.

### RE6. Verify

- Re-grep `Close: lite` since the **new** marker — it must be zero
  (everything in the window is now reconciled).
- Confirm the consolidated decision-log entry names every item from the
  parsed table.
- Confirm backlog no longer lists the reconciled IDs and trajectory now
  does. Run the end-of-task size check over the files this pass grew
  (`decision-log.md`, `trajectory.md`, backlog Active) — a reconcile is
  real memory work, so use the full sweep, not the fast path.
- Output a before / after count: lite closes in window → items evicted
  → trajectory lines added.
- The reconciled batch is a ready-made feature area — suggest a
  feature-area review of it (`review.md`, feature-area input) as an
  optional follow-up. Propose, don't run.

### Reconcile rules

- **Never skips memory** — lite defers the write; Reconcile is the write.
  A batch is not truly closed until it is reconciled.
- **Never guesses** — an unparseable `Item:` or a bare commit goes to
  manual triage, never an auto-mapped entry.
- **One consolidated entry per batch**, naming every folded item, so a
  dropped decision is visible by its absence.
- **Marker is mandatory** — every reconcile leaves a `Reconcile marker:`
  SHA; without it the next pass cannot bound its window.
- Append-only files (`decision-log.md`, `trajectory.md`) grow at the
  top/current phase; never rewrite existing entries.

---

## Doc-sync (reconcile protected docs)

Run when the `doc-deltas.md` ledger is over the threshold in
`memory-policy.md`, when session-start / Diagnose flags it, or when the
user asks. Protected docs (SPEC, ADRs, and kin) are correctly
edit-on-request only, so their drift is captured as one-line ledger
entries at task close (`end-of-task.md`) and reconciled here — in one
batched pass, gated on maintainer sign-off **per doc**. This pass *is*
the "request" that authorises the edits; nothing else opens the ledger.

Doc-sync does not pick work (Start B), archive by size (Prune),
re-sequence the queue (Refactor), or fold lite closes (Reconcile). It
turns captured deltas into applied doc edits, losslessly ticked.

### DS1. Load

- `pm_skills/project/doc-deltas.md` — the whole ledger (this is its one
  auto-read flow). If it is absent or has no open `[ ]` lines, say so in
  one line and stop.
- For each open delta, read its `(source: <ID/entry>)` reference — the
  decision-log entry, ticket, or commit that changed the behaviour — so
  the edit is derived **fresh** from the source, never from an
  instruction stored in the ledger (the DOC-1 lesson: ledgers that hold
  the fix balloon).
- Open each protected doc named by a delta, at the cited section.

### DS2. Group by doc

Group the open deltas by target document. One doc may carry several
deltas (e.g. SPEC §6 entity count **and** an ADR-status closure); batch
them so each doc is presented and signed off **once**, not per line.
ADR **status** closures (Proposed → Accepted) are a first-class delta
type — treat a header status change as an ordinary edit in the batch.

### DS3. Propose (diff-style, before write)

For each doc, present a single batched proposal the user can approve in
one read:

1. **The doc** — name and the sections touched.
2. **Per delta** — the ledger line, and the concrete edit derived from
   its source, shown as a before → after diff.
3. **Sign-off ask** — apply this doc's batch, skip it, or defer
   individual deltas.

STOP for sign-off **per doc**. Never auto-edit a protected doc — the
sign-off this pass waits for is the whole point of protected-doc
discipline, not an obstacle to route around.

### DS4. Apply (after per-doc sign-off)

- Apply only the approved edits to each doc. Preserve the doc's own
  structure and voice; edit the drifted content, nothing else.
- Tick each applied delta in `doc-deltas.md` (`[ ]` → `[x]`). A skipped
  or deferred delta stays `[ ]` — it surfaces again next session.
- Do not delete ticked lines here; they are swept at the next prune (a
  ledger full of `[x]` is a size-check signal, not a correctness one).

### DS5. Record

- Append one entry to `decision-log.md` (top, append-only): date,
  "Doc-sync", and a one-line summary naming each doc reconciled and the
  deltas applied / deferred (so a deferred delta is visible by name).
- Stage the changed docs and the ledger with `git add`. Leave
  committing to the user.

### DS6. Verify

- Re-count open (`[ ]`) deltas — it must equal the count that was
  deferred/skipped, and every applied delta must now read `[x]`.
- Confirm each reconciled doc now describes current behaviour at the
  cited section.
- Output a before / after count: open deltas → applied → still open.

### Doc-sync rules

- **Never auto-edits a protected doc** — every doc's batch waits for
  explicit sign-off (consistent with Prune / Refactor / Reconcile).
- **Capture ≠ fix.** The ledger holds one-line captures; the edit is
  derived fresh from the source at sync time, never stored.
- **Tick, don't delete.** Applied deltas become `[x]`; the prune sweeps
  them, so the ledger keeps a short audit trail between syncs.
- A reconciled doc is a ready-made review area — suggest a feature-area
  review (`review.md`) as an optional follow-up. Propose, don't run.

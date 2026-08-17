# Changelog — 2.x epoch (archived)

Archived verbatim from `pm_skills/CHANGELOG.md` (CL-HORIZON,
4.5.0). Append-only history: never rewrite an entry here.
`prompts/upgrade.md` Step 2 walks this file when a project's
version gap starts in this epoch.

---

## 2.8.0 — 2026-06-28

Adds **optional per-item detail files** for backlog items. A non-trivial
item can now carry a cold-tier `pm_skills/project/tickets/<ITEM-ID>.md`
holding its research, options explored, acceptance detail, and links —
read **only** when that item is the active task, so the backlog Active
section stays terse and the every-task read load is unchanged. The item's
backlog line marks the file with a new `[detail]` flag.

Working context only: the decision rationale (the "why") still lives only
in `decision-log.md`. The file is deleted when the item ships or is cut,
so the folder never becomes a graveyard — `end-of-task.md` and
`roadmap-refactor.md` evict, `doctor-memory.md` flags orphans.

Minor: new optional capability and a new (lazily-created) memory folder,
backward compatible. Existing projects are unaffected until they opt in.

### Added

- `pm_skills/project/tickets/*` (`project-memory`) — optional per-item
  detail files, created lazily on first use (like `archive/`). Declared
  in `MANIFEST.md`.
- `AGENTS.md` (`root-template`) — a Cold-tier read rule, a budget row
  (soft ~600 words each), and a document-ownership row for ticket files.
- `[detail]` backlog flag — documented in `pm_skills/project/backlog.md`'s
  ticket-grammar comment.

### Changed

- `pm_skills/prompts/scoping.md`, `next-batch.md`, `quick-task.md`,
  `bug-scoping.md` — read the active item's ticket file when it carries
  `[detail]`; scoping persists overflow context into it.
- `pm_skills/prompts/end-of-task.md` — ticket-file lifecycle (fold into
  the log/trajectory, then delete on ship/cut) and an orphan sweep in the
  size check.
- `pm_skills/prompts/roadmap-refactor.md`, `doctor-memory.md` — detect and
  evict orphan ticket files and dangling `[detail]` flags.
- `pm_skills/GUIDE.md`, `pm_skills/prompts/session-start.md` — wire the
  new path into the Cold tier and the keeping-memory-fresh table.
- `pm_skills/init.md`, `pm_skills/integrations/init-project.md` — note
  that `pm_skills/project/tickets/` is lazily created and cold, parallel
  to the existing `archive/` note.

### Upgrade actions

- `AGENTS.md` (`root-template`): on the 3-way merge, take the new
  Cold-tier ticket bullet, the `tickets/<ITEM-ID>.md` budget row, and the
  `project/tickets/` document-ownership row; preserve every populated
  section verbatim.
- `pm_skills/prompts/*`, `pm_skills/init.md`,
  `pm_skills/integrations/init-project.md`, `pm_skills/GUIDE.md`,
  `pm_skills/MANIFEST.md` (`framework`): overwritten wholesale after the
  Step 4 customisation check. No project action.
- `pm_skills/project/backlog.md` (`project-memory`): additive only — the
  `[detail]` flag and detail-file convention are added to the
  ticket-grammar comment. No migration; existing items are unaffected;
  adopt the flag when an item needs detail.
- No paths removed. `pm_skills/project/tickets/` is created lazily on
  first use; nothing to create at upgrade.

---

## 2.7.3 — 2026-06-16

Arrow-glyph consistency in distributed-template comments. Three shipped
templates carried ASCII `->` arrows inside their HTML author-guidance
comments, where the framework's house style (set by the 2.5.0 arrow
sweep) is the Unicode `→`. These arrows live only inside `<!-- … -->`
comments, so they never appear in rendered output — this is a pure
source-consistency fix with no behavioural or rendered change.

Only prose `->` is normalised; the `-->` comment terminators that share
those characters are deliberately left intact.

Patch-level: comment wording in existing distributed files. No new
files, no migration, no `MANIFEST.md` change, no memory-contract change.

### Changed

- `DEV-INFRASTRUCTURE.md` (`root-template`) — prose `->` arrows in the
  "Maintainer diagnostics" CUSTOMISE comment normalised to `→`.
- `pm_skills/project/trajectory.md` (`project-memory`) — prose `->`
  arrows in the guidance comments and the example-phase block normalised
  to `→`.
- `pm_skills/project/wish-list.md` (`project-memory`) — prose `->` arrows
  in the guidance comments normalised to `→`.

### Upgrade actions

- `DEV-INFRASTRUCTURE.md` (`root-template`): on the standard 3-way merge,
  take the new comment text. A populated project will have replaced the
  CUSTOMISE comment with real content, so there is typically nothing to
  merge — no action needed.
- `trajectory.md` / `wish-list.md` (`project-memory`): never overwritten
  on upgrade, so existing projects are unaffected; only newly-initialised
  projects pick up the normalised comments. No action needed.
- No `MANIFEST.md` change (no paths added, removed, or reclassified).

---

## 2.7.2 — 2026-06-16

Closes the **quick-path impact-awareness gap**. `quick-task.md` — the
lean single-stage scope-and-plan for small tasks — was the only
scope/plan path with no awareness of the build/run/verify triad
surfaces. A small task that touched a runtime component, an
instrumentable surface, or the quality-gate surface could pass through
the quick path without the contract-doc update that `scoping.md`,
`implementation-plan.md`, and `validation.md` enforce for the full
sequence.

`quick-task.md` now carries one escalation-guard rule: if such an impact
surfaces, stop and escalate to the full `scoping.md` sequence, where the
impact flags and their `DEV-INFRASTRUCTURE.md` / `UI-STANDARDS.md`
obligations live. It escalates rather than echoing those flags inline —
preserving single-source-of-truth and not reopening the duplication
drift class that 2.7.1 just closed.

Resolves the `quick-task.md` impact-flags decision (the QT roadmap
item); the decision predated the quality-gate flag, so the guard covers
all three triad surfaces, not just runtime and diagnostics.

Patch-level: one rule added to an existing `framework` file. No new
files, no migration, no `MANIFEST.md` change, no memory-contract change.

### Changed

- `pm_skills/prompts/quick-task.md` — added an escalation-guard rule:
  if a small task turns out to touch a runtime component, an
  instrumentable surface, or the quality-gate surface, stop and escalate
  to the full `scoping.md` sequence. Output list and other rules
  unchanged.

### Upgrade actions

- Replace this `framework` file wholesale:
  `pm_skills/prompts/quick-task.md`.
- No data migration; no `root-template` or `project-memory` changes;
  `MANIFEST.md` unchanged (no paths added, removed, or reclassified).

---

## 2.7.1 — 2026-06-16

Removes the **stage-output echo drift class** at its source. The
orchestration workflows (`feature.md`, `auto-jazz.md`,
`auto-jazz-lite.md`) inline-echoed each stage prompt's output list in
their matching steps, purely for in-flow readability. Those echoes
duplicated the canonical lists in `scoping.md`, `design-options.md`,
`implementation-plan.md`, `validation.md`, and `quick-task.md`, and
drifted silently — the validation echo went stale in 2.4.1 (dropping the
Runtime and Diagnostics checks), and 2.5.0 could only *guard* it with a
manual `release.md` re-sync reminder.

Each echo step already instructs the agent to read the canonical prompt,
so the inline list was redundant for execution and only a skim aid for a
human — and it was already lossy (the `design-options` echo silently
dropped that prompt's "note anything that should stay unchanged"
output). This release deletes the inline lists and replaces each with a
pointer to the prompt, making each stage prompt the single source of
truth for its own outputs. Drift is now impossible: changing a prompt's
output list requires no workflow edit.

`release.md` step 5 is updated to match — it no longer asks to re-sync
echoes (there are none); it now guards only against a stage prompt being
renamed, added, or removed, which would invalidate a workflow's "Read
`pm_skills/prompts/X.md`" reference.

Patch-level: wording and structure of existing `framework` files only.
No new files, no migration, no `MANIFEST.md` change, no memory-contract
change. All control flow (gates, assumptions, search/present/wait lines)
is unchanged.

### Changed

- `pm_skills/integrations/feature.md` — steps 4–8: the inline
  scoping / design-options / implementation-plan / validation /
  quick-task output lists are replaced with a pointer to the named stage
  prompt. Gate and control-flow lines unchanged.
- `pm_skills/integrations/auto-jazz.md` — steps 3–6: same replacement
  for the four design-stage echoes. Assumption/continue lines unchanged.
- `pm_skills/integrations/auto-jazz-lite.md` — step 3: same replacement
  for the quick-task echo.
- `pm_skills/prompts/release.md` — step 5 reframed from "re-sync the
  inline echoes" to "the workflows reference the prompts; update only on
  a prompt rename/add/remove".

### Upgrade actions

- Replace these `framework` files wholesale:
  `pm_skills/integrations/feature.md`,
  `pm_skills/integrations/auto-jazz.md`,
  `pm_skills/integrations/auto-jazz-lite.md`,
  `pm_skills/prompts/release.md`.
- No data migration; no `root-template` or `project-memory` changes;
  `MANIFEST.md` unchanged (no paths added, removed, or reclassified).

---

## 2.7.0 — 2026-06-16

Ships a **lint baseline** to consuming projects, completing the
*One-command quality gate* (2.6.0): the gate is no longer "bring your own
from zero". The framework was opinionated about the gate's policy but
shipped no config. It now ships the one lint baseline every pm-skills
project can use regardless of stack — Markdown — because project memory
itself is Markdown.

Hybrid by design: the universal, stack-agnostic layer ships as scaffold
(a relaxed-but-strict markdownlint config + a dependency-free internal
link checker); the stack-specific layer (code linters, type checkers,
formatters) stays documented as per-stack recommended defaults in
`conventions.md`, not mandated — honouring the stack-agnostic "slots, not
a mandated linter" stance of the quality gate.

Opinionation, stated once: be strict (error, in `check`) on correctness —
broken/unused imports, dead code, type errors, broken links,
accessibility violations; make formatting invisible (auto-fix, never the
gate); keep taste/complexity rules opt-in and off by default; defer
spell-check until a domain dictionary exists.

Backward compatible: two new `scaffold`-class files (covered by the
existing `pm_skills/scaffold/*` manifest glob) plus additive wiring to
`init.md`, `init-project.md`, `GUIDE.md`, and two root-template sections.
No files renamed or removed; no stage-prompt output list changed, so the
`feature.md` / `auto-jazz.md` validation echoes need no re-sync.

### Added

- `pm_skills/scaffold/.markdownlint.json` (`scaffold`) — Markdown lint
  baseline: `default: true` with `MD013` off (line-length noise) and
  `MD024: siblings_only` (repeated changelog headings). Strict on what
  breaks rendering, relaxed on style. A starting point each project owns.
- `pm_skills/scaffold/check-links.mjs` (`scaffold`) — dependency-free
  (Node-only) internal Markdown link-integrity checker; catches broken
  cross-references in docs and project memory. Deletable for non-Node
  stacks.

### Changed

- `pm_skills/init.md` — Step 9 copies the two new scaffold files; the
  Step 8 quality-gate item points at the per-stack defaults and the
  shipped baseline; Step 10 readiness gains a baseline checkbox.
- `pm_skills/integrations/init-project.md` — scaffold-copy step and
  readiness list include the two new files.
- `pm_skills/project/conventions.md` (`project-memory` template) — the
  Tooling guidance gains the per-stack recommended-defaults and the
  opinionation dial. Existing populated files are unaffected.
- `DEV-INFRASTRUCTURE.md` (`root-template`) — the Quality gate section
  names the shipped Markdown baseline as the Tier 0 floor and the
  formatting-is-auto-fix-not-gate rule.
- `pm_skills/GUIDE.md` — the "What's in this folder" tree lists the two
  new scaffold files.

### Upgrade actions

- Replace these `framework` files wholesale: `pm_skills/init.md`,
  `pm_skills/integrations/init-project.md`, `pm_skills/GUIDE.md`.
- `DEV-INFRASTRUCTURE.md` (`root-template`, 3-way merge — preserve your
  populated content): add the shipped-baseline + formatting note to the
  **Quality gate** section guidance.
- `pm_skills/project/conventions.md` is `project-memory`: no action if
  you have populated it; otherwise the template now carries the per-stack
  tooling defaults.
- `scaffold` (copied once, never force-upgraded): optionally copy
  `pm_skills/scaffold/.markdownlint.json` and
  `pm_skills/scaffold/check-links.mjs` into your project root to adopt the
  baseline. Existing scaffold files are never overwritten.
- `pm_skills/MANIFEST.md`: no change — the new files are covered by the
  existing `pm_skills/scaffold/*` glob.

---

## 2.6.0 — 2026-06-16

Adds the **One-command quality gate** — the third runtime guardrail,
completing the build/run/verify triad alongside *One-command runtime
recovery* (2.3.0) and *Self-explaining runtime* (2.4.0). The framework
front-loads design discipline and is opinionated about getting a project
running and making it legible, but it had no invariant for *verifying a
change is sound*. "Run build and tests" lived only as scattered,
inconsistent instructions; there was no single, named, non-mutating
command an agent could always run to answer "did I break anything?".

This release makes that opinion explicit: every project exposes one
`check` command — non-mutating, CI-safe, focused on invariants — and the
framework defines it (`DEV-INFRASTRUCTURE.md`), sets it up (`init.md`),
and enforces it at the end of every task (`end-of-task.md`) and in
`review.md`. It is stack-agnostic and tiered (Tier 0 docs/static → Tier 2
mature app), so it scales from a placeholder + link scan to a full lint,
type, test, and build pipeline. Tool choices stay in `conventions.md`.

Backward compatible: additive sections to two root templates (3-way
merged on upgrade) and additive wiring to framework prompts. No files
renamed or removed, no `MANIFEST.md` change, and no stage-prompt output
list changed — so the `feature.md` / `auto-jazz.md` validation echoes do
not need re-syncing.

### Added

- `AGENTS.md` (`root-template`) — hard rule **One-command quality gate**
  (non-mutating, CI-safe, tiered) plus a matching anti-pattern rejecting
  a missing gate, a mutating `check`, or green-washing.
- `DEV-INFRASTRUCTURE.md` (`root-template`) — new **Quality gate**
  section (after *Maintainer diagnostics*): the `check` command, what it
  runs and omits, CI parity, the "trust not taste" rule selection, and
  the Tier 0–2 shape.
- `pm_skills/init.md` — Step 8 gains a **Quality gate** populate-item;
  Appendix B gains a **Quality gate example**.

### Changed

- `pm_skills/prompts/end-of-task.md` — new step 1 *Run the quality gate*
  (`check`); existing steps renumbered and the report gains a gate line.
- `pm_skills/prompts/review.md` — step 5 confirms `check` was run and is
  green for the change set.
- `pm_skills/prompts/scoping.md`, `implementation-plan.md` — a
  *check-surface* flag in their Rules sections (output lists unchanged).
- `pm_skills/integrations/auto-jazz.md`, `auto-jazz-lite.md` — the verify
  step now names the quality gate (`check`).
- `pm_skills/GUIDE.md` — the end-of-task housekeeping summary lists the
  quality gate.
- `pm_skills/init.md` — Step 10 adds a `check` readiness checkbox and
  folds the placeholder scan into `check`.
- `pm_skills/project/conventions.md` (`project-memory` template) — the
  Tooling section points tool choices at the gate. Existing projects'
  populated files are unaffected.

### Upgrade actions

- `AGENTS.md` (`root-template`, 3-way merge — preserve your populated
  content): add the **One-command quality gate** hard rule after
  *Self-explaining runtime*, and the matching bullet in *Anti-patterns to
  reject*.
- `DEV-INFRASTRUCTURE.md` (`root-template`, 3-way merge): add the new
  **Quality gate** section after *Maintainer diagnostics*. If the project
  has a build step, populate it (define your `check`); otherwise mark it
  Tier 0 / "n/a".
- Replace these `framework` files wholesale:
  `pm_skills/prompts/end-of-task.md`, `pm_skills/prompts/review.md`,
  `pm_skills/prompts/scoping.md`,
  `pm_skills/prompts/implementation-plan.md`,
  `pm_skills/integrations/auto-jazz.md`,
  `pm_skills/integrations/auto-jazz-lite.md`, `pm_skills/GUIDE.md`,
  `pm_skills/init.md`.
- `pm_skills/project/conventions.md` is `project-memory`: no action if you
  have populated it; if you still carry the template comments, you may
  adopt the refreshed Tooling note.
- Adopt the invariant in practice: ensure the project exposes a single
  non-mutating `check` command (or record that the gate is deliberately
  deferred for an early MVP).

## 2.5.0 — 2026-06-14

Adds the **review** capability — the missing mirror of the design
pipeline. The framework front-loads discipline going *in* (scoping →
design → plan → validation, and the gateless `auto-jazz` / `init-mvp` /
`spec-to-prod` runs that compress it), but gave the human nothing
structured for the way *out*. With gateless modes the review burden just
moves to after the run — and "I'll review later" had no tool. This
release closes that loop.

`prompts/review.md` is a read-only pass over a change set (typically an
autonomous run): it maps the diff to intent, checks scope adherence and
every stated assumption, audits against the hard-rule / UI / dev
contracts, names the regression surface and what only a human can
verify, confirms project-memory housekeeping happened, and ends with a
verdict (accept / accept-with-follow-ups / needs-changes) plus a
prioritised punch list. It proposes; it never silently rewrites the
work — approved fixes run as their own task. Durable findings feed back
into memory (an anti-pattern into `AGENTS.md`, a convention into
`conventions.md`, an idea into `wish-list.md`).

It is wired where the review need is created: the closing reports of
`auto-jazz`, `auto-jazz-lite`, `init-mvp`, and `spec-to-prod` now point
at it, and `GUIDE.md` lists it.

This release also hardens `release.md` so the framework self-catches the
two drift classes 2.4.1 had to fix by hand: a GUIDE file-tree check in
the verify snippet, and a step-5 reminder to re-sync the `feature.md` /
`auto-jazz.md` validation echoes when a stage prompt's outputs change.

Backward compatible: one new `framework` prompt (covered by the
`pm_skills/prompts/*` manifest wildcard — no `MANIFEST.md` change) and
additive wiring lines. No files renamed or removed, no migration.

### Added

- `pm_skills/prompts/review.md` (`framework`) — read-only review of a
  run: intent map, scope-and-assumption check, contract audit, risk and
  manual-check list, memory-hygiene check, verdict + punch list, and
  propose-don't-apply feedback into memory.

### Changed

- `pm_skills/integrations/auto-jazz.md`, `auto-jazz-lite.md`,
  `init-mvp.md`, `spec-to-prod.md` — closing reports now suggest running
  `prompts/review.md` to review the gateless run before accepting it.
- `pm_skills/GUIDE.md` — lists `review.md` in the prompts tree and adds
  a per-task-reference note on reviewing any gateless run.
- `pm_skills/prompts/release.md` — verify snippet gains a GUIDE
  file-tree check; step 5 gains a reminder to re-sync the workflow
  validation echoes when a stage prompt's outputs change, and to
  re-sync the `quick-task.md` echo in `feature.md` / `auto-jazz-lite.md`.
- `pm_skills/prompts/doctor-memory.md`,
  `pm_skills/prompts/roadmap-refactor.md` — consistency sweep: normalised
  stray ASCII `->` to the Unicode `→` used in rendered prose
  framework-wide. Cosmetic; no behaviour change.

### Upgrade actions

- Add the new `framework` file `pm_skills/prompts/review.md`.
- Replace the `framework` files: `pm_skills/integrations/auto-jazz.md`,
  `pm_skills/integrations/auto-jazz-lite.md`,
  `pm_skills/integrations/init-mvp.md`,
  `pm_skills/integrations/spec-to-prod.md`, `pm_skills/GUIDE.md`,
  `pm_skills/prompts/release.md`, `pm_skills/prompts/doctor-memory.md`,
  `pm_skills/prompts/roadmap-refactor.md`.
- `MANIFEST.md` unchanged — `review.md` inherits `framework` from the
  `pm_skills/prompts/*` wildcard. No data migration; no `root-template`
  changes.

---

## 2.4.1 — 2026-06-14

Consistency fixes only — no new files, no migration. Re-syncs two
workflow files with the canonical stage prompts after the 2.3.0 and
2.4.0 additions, unifies one diagnostic grep, and completes the GUIDE
folder map.

The load-bearing fix: `feature.md` and `auto-jazz.md` echo
`validation.md`'s output list inline, and that echo had gone stale — it
still listed the pre-2.3.0 six items ("Test coverage assessment", no
runtime, no diagnostics). An agent running validation through either
workflow could therefore skip the **Runtime impact** (2.3.0) and
**Diagnostics & redaction** (2.4.0) checks the canonical prompt now
requires — silently dropping the two newest opinions at their point of
use. The echo is brought back in step with `validation.md`'s current
eight outputs. The scoping, design-options, and implementation-plan
echoes in both files were checked and are already faithful.

### Changed

- `pm_skills/integrations/feature.md` — validation step output echo
  synced to `validation.md`'s current eight items (adds Runtime impact,
  Diagnostics & redaction; "Test coverage assessment" → "Test plan").
- `pm_skills/integrations/auto-jazz.md` — same validation echo sync.
- `pm_skills/prompts/doctor-memory.md` — done-work grep anchored to
  `^\s*[-*] \[x\]`, matching `end-of-task.md` and `prune-memory.md` (now
  catches `*`-bulleted lists, not only `-`).
- `pm_skills/GUIDE.md` — "What's in this folder" tree now lists `GUIDE.md`
  and `init.md`, so it matches the actual `pm_skills/` contents (per
  `release.md` steps 5–6).

### Upgrade actions

- Replace the `framework` files: `pm_skills/integrations/feature.md`,
  `pm_skills/integrations/auto-jazz.md`,
  `pm_skills/prompts/doctor-memory.md`, `pm_skills/GUIDE.md`.
- No data migration; no `root-template` changes; `MANIFEST.md` unchanged
  (no new or moved paths).

---

## 2.4.0 — 2026-06-14

Makes the framework opinionated about **maintainer diagnostics**: the app
should make its own behaviour legible while it is being built, so a
maintainer can hand an AI agent a useful diagnostic snapshot with one
click — instead of reproducing a bug, opening DevTools, preserving logs,
and copying the right lines by hand.

This is the diagnostic sibling of 2.3.0's runtime-recovery opinion (and the
second half of the same dogfooding note that motivated it). Where 2.3.0
made *getting the app running* a one-command, verified-ready capability,
2.4.0 makes *understanding what the app did* a one-click, redacted,
paste-ready one. The two share a shape and a discipline: a documented
contract, init wiring, verification wiring, and scaling by complexity —
never a shipped library.

A page cannot read the browser's native DevTools console, so the opinion is
built on an app-owned path: a small structured logger writes to the console
**and** a bounded in-memory buffer; global `error` / `unhandledrejection`
hooks funnel into it; and a dev-only "copy diagnostics" affordance copies a
**redacted** bundle for pasting to an agent. It is structured diagnostics
with the console as one sink — explicitly **not** scattered `console.log`.
Redaction is a safety invariant following OWASP logging guidance: never
tokens, cookies, raw bodies, full storage, or PII.

The opinion spans two contracts along the framework's own ownership lines:
the instrumentation (logger, buffer, schema, capture, redaction, bundle)
lives in `DEV-INFRASTRUCTURE.md`; the affordance (placement, Carbon
styling, 44px, focus, copy feedback, dev-only) lives in `UI-STANDARDS.md`;
a one-line invariant in `AGENTS.md` points at both. Its highest-leverage
hook is the **bug workflow**: `bug-scoping.md` now asks for the diagnostic
bundle first and treats a missing diagnostics path as the first finding.

It **scales with complexity**: Tier 0 (static / no-UI) makes uncaught
errors legible via a console helper + a global error hook; Tier 1 (typical
dev-server app) adds the ring buffer and the copy affordance; Tier 2
(operator-facing) adds interaction-id correlation, network-failure capture,
User Timing marks, and optional forward-to-server (e.g. Vite
`server.forwardConsole`). The capability and its documentation are required
at every tier; only the implementation heft scales.

Backward compatible: no files renamed or removed, no data migration, no
changed memory contracts. The three `root-template` edits are additive
sections that 3-way merge cleanly.

### Changed

- `AGENTS.md` (`root-template`) — adds the **Self-explaining runtime** hard
  rule (structured logger → console + bounded buffer; dev-only redacted
  copy-diagnostics affordance where there is UI; redact by default; scales
  by tier), a diagnostics anti-pattern (console.log spam / a leaky or
  prod-exposed copy control), and extends the Document-ownership rows so
  `DEV-INFRASTRUCTURE.md` owns "maintainer diagnostics" and
  `UI-STANDARDS.md` owns the "diagnostics affordance".
- `DEV-INFRASTRUCTURE.md` (`root-template`) — adds a **Maintainer
  diagnostics** section (after Runtime lifecycle): the structured logger,
  log-record shape, bounded ring buffer, global error/rejection capture,
  the redacted copy bundle (include/exclude lists), redaction, dev-only
  gating, optional forward-to-server, and the tiered shape. Collapses to
  one line for pure-static projects.
- `UI-STANDARDS.md` (`root-template`) — adds a **Diagnostics affordance**
  section (placement hierarchy, Carbon icon-button styling, 44px, focus,
  copy feedback, dev-only) and a Design-review-gate item.
- `pm_skills/init.md` — Step 8 population prompt gains a Maintainer
  diagnostics item; Step 10 readiness gains a diagnostics check; Appendix B
  gains a tiered Maintainer diagnostics example.
- `pm_skills/integrations/init-project.md` — mirrors the Step 8 and Step 10
  additions.
- `pm_skills/integrations/init-mvp.md` — the runnable-skeleton step wires
  the minimal diagnostics path (logger + global error hook) as the skeleton
  goes up; integration verification checks diagnostics work and the bundle
  redacts.
- `pm_skills/prompts/bug-scoping.md` — adds a diagnostic-bundle input and a
  rule to use it as primary evidence, and to flag a missing diagnostics
  path as the first finding.
- `pm_skills/prompts/scoping.md` — flags the diagnostics impact when a task
  adds instrumentable behaviour or a user-facing surface.
- `pm_skills/prompts/validation.md` — adds a "Diagnostics & redaction"
  pre-code check (output items renumbered 5 → 8).
- `pm_skills/prompts/implementation-plan.md` — folds the structured logger
  and the diagnostics contract docs into the files to modify, with a
  "notable events logged, bundle stays redacted" acceptance criterion.
- `pm_skills/prompts/end-of-task.md` — extends the `UI-STANDARDS.md` and
  `DEV-INFRASTRUCTURE.md` update triggers to the diagnostics affordance and
  maintainer diagnostics.

### Upgrade actions

- Re-merge `AGENTS.md` from the new root template (`prompts/upgrade.md`
  Step 7): add the "Self-explaining runtime" hard rule, the diagnostics
  anti-pattern, and the updated Document-ownership rows. Preserve all
  populated project-specific content.
- Re-merge `DEV-INFRASTRUCTURE.md` from the new root template: add the new
  "Maintainer diagnostics" section (after "Runtime lifecycle"). Populate it
  for your project, or collapse it to one line / mark it n/a for a
  pure-static project. Preserve every already-populated section verbatim.
- Re-merge `UI-STANDARDS.md` from the new root template: add the
  "Diagnostics affordance" section and the Design-review-gate item.
  Preserve every populated section verbatim.
- Replace the `framework` files: `pm_skills/init.md`,
  `pm_skills/integrations/init-project.md`,
  `pm_skills/integrations/init-mvp.md`,
  `pm_skills/prompts/bug-scoping.md`, `pm_skills/prompts/scoping.md`,
  `pm_skills/prompts/validation.md`,
  `pm_skills/prompts/implementation-plan.md`,
  `pm_skills/prompts/end-of-task.md`.
- No data migration; `MANIFEST.md` is unchanged (no new paths).
- Optional follow-up: on the next task that touches the runtime or UI,
  populate the new `DEV-INFRASTRUCTURE.md` → "Maintainer diagnostics" and
  `UI-STANDARDS.md` → "Diagnostics affordance" sections so the diagnostics
  path is documented.

---

## 2.3.0 — 2026-06-13

Makes the framework opinionated about **runtime recoverability**: reaching
a known-good running state — and getting back there after it drifts — is
one documented, safe command, never a remembered ritual.

The framework was already opinionated about product quality (Carbon, WCAG
2.2 AAA, project memory, testing, minimal-change) and about *production*
deploy recoverability (`deploy.md`: pre-flight, live health, rollback). It
had no *local* equivalent: a solo maintainer had to hold ports, stale
processes, env composition, generated outputs, tunnels, and startup order
in their head just to get a local app running again. This release adds the
dev-side sibling of `deploy.md`.

The opinion follows the framework's existing shape — a one-line hard rule
in the contract, a populated section in the dev-infra doc, init wiring to
create it, and verification wiring to check it — and **scales with
complexity**: pure-static projects document one command ("serve this
directory"); single dev-server apps get `dev` + `reboot`; multi-process
and operator-facing apps add `boot` / `stop` / `status` / `logs` /
`reset`. The capability and its documentation are required at every tier;
only the implementation heft scales.

Backward compatible: no files renamed or removed, no data migration, no
changed memory contracts. The two `root-template` edits are additive
sections that 3-way merge cleanly.

### Changed

- `AGENTS.md` (`root-template`) — adds the **One-command runtime
  recovery** hard rule (boot/reboot to a verified-ready state via one
  safe command; kill only owned processes; allowlist cleanup; no
  destructive reset without an explicit flag; scales by tier), an
  ad-hoc-startup anti-pattern, and extends the Document-ownership row so
  `DEV-INFRASTRUCTURE.md` owns "runtime lifecycle".
- `DEV-INFRASTRUCTURE.md` (`root-template`) — adds a **Runtime
  lifecycle** section (after Dev server): command surface, dev URL/port,
  components and startup order, process ownership / PID & log locations,
  env and `.env` workflow, allowlisted generated-output cleanup, health /
  readiness checks, recovery playbook, exposure controls, and protected
  paths. Collapses to one line for pure-static projects.
- `pm_skills/init.md` — Step 8 population prompt gains a Runtime lifecycle
  item; Step 10 readiness gains a "documented and boots to a ready state"
  check; Appendix B gains a tiered Runtime lifecycle example (single dev
  server → operator-facing).
- `pm_skills/integrations/init-project.md` — mirrors the Step 8 and
  Step 10 additions.
- `pm_skills/integrations/init-mvp.md` — the runnable-skeleton step
  records the canonical boot/reboot command and verifies a ready state;
  integration verification boots to a ready state, not just a launched
  process.
- `pm_skills/prompts/end-of-task.md` — adds a conditional runtime-boot
  verification step (boot via the canonical command; verify readiness,
  not launch), extends the `DEV-INFRASTRUCTURE.md` update trigger to the
  runtime lifecycle, and adds a runtime line to the report. Sections
  renumbered (1 → 4).
- `pm_skills/prompts/scoping.md` — flags the runtime-lifecycle impact
  when a task adds or changes a runtime component.
- `pm_skills/prompts/validation.md` — adds a "Runtime impact" pre-code
  check (preserves one-command boot/reboot and a readiness check).
- `pm_skills/prompts/implementation-plan.md` — folds the runtime command
  surface and the `DEV-INFRASTRUCTURE.md` doc into the files to modify,
  with a "boots to a ready state" acceptance criterion.

### Upgrade actions

- Re-merge `AGENTS.md` from the new root template (`prompts/upgrade.md`
  Step 7): add the "One-command runtime recovery" hard rule, the
  ad-hoc-startup anti-pattern, and the updated Document-ownership row for
  `DEV-INFRASTRUCTURE.md`. Preserve all populated project-specific content.
- Re-merge `DEV-INFRASTRUCTURE.md` from the new root template: add the new
  "Runtime lifecycle" section (after "Dev server"). Populate it for your
  project, or collapse it to one line / mark it n/a for a pure-static
  project. Preserve every already-populated section verbatim.
- Replace the `framework` files: `pm_skills/init.md`,
  `pm_skills/integrations/init-project.md`,
  `pm_skills/integrations/init-mvp.md`,
  `pm_skills/prompts/end-of-task.md`, `pm_skills/prompts/scoping.md`,
  `pm_skills/prompts/validation.md`,
  `pm_skills/prompts/implementation-plan.md`.
- No data migration; `MANIFEST.md` is unchanged (no new paths).
- Optional follow-up: on the next task that touches the runtime, populate
  the new `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle" section so the
  boot/reboot command is documented.

---

## 2.2.1 — 2026-06-04

Fixes a smaller sibling of the 2.1.0 bug, surfaced by dogfooding a prune
on the same mature project. Two cold decision-log archive chunks sat ~3×
over the 8,000-word `archive/` chunk cap and had been flagged-and-deferred
across two prune sessions — the same "always-red, always-ignored" dynamic
2.1.0 removed from the hot-set.

Root cause: the chunk cap measured the wrong thing. Its rationale —
"split so each loads in one read" — is obsolete: cold archives are never
auto-read; they're grepped, then a line-range is read, so file size is
irrelevant. The cap's only effect was to force navigationally-useless
splits (the project literally had a `decision-log-2026-06-01.md` and a
`decision-log-2026-06-01-b.md` — the same day split in two purely to
satisfy the cap). The real value of chunking is INDEX browsability, which
is a *boundary* concern (month / migration epoch), not a *size* one.

The fix replaces the word/entry chunk cap with boundary-based chunking:
one epoch per file, split only for browsability, never for size. An epoch
bounds its own growth, so nothing accretes unbounded even without a cap.
Also folds two minor consistency fixes found in the same review.

Backward compatible: no files renamed or removed, no data migration.
Existing oversized cold chunks are harmless and need no action.

### Changed

- `AGENTS.md` (`root-template`) — the `archive/` chunk budget changes
  from `8,000 words or 20 entries per file` (action: "split so each loads
  in one read") to `one epoch per file (whole month / migration
  boundary)` — chunk by sequence boundary for INDEX browsability, not
  size; sub-split an epoch only if genuinely unwieldy to grep. The
  `backlog.md` Active row's `1,500 words and ~40 open items` is clarified
  to `or … (whichever trips first)`, with a note that a low item count at
  high words means items are too verbose.
- `pm_skills/prompts/prune-memory.md` — detect no longer word-counts
  archive chunks against a cap (notes multi-epoch spans only); the
  propose / decision-log / rules steps reframe splitting as
  epoch-boundary, browsability-driven; adds an INDEX caveat to put
  entry/word counts only on frozen archive rows, never the live-file row
  (it goes stale the moment the prune appends its own record — an
  off-by-one seen in the live project's INDEX).
- `pm_skills/prompts/doctor-memory.md` — archive-hygiene check drops the
  per-chunk word-count; a multi-epoch chunk is INFO, not a WARN; a
  missing/stale INDEX stays a WARN.
- `pm_skills/prompts/upgrade.md` — the major-version migration routine
  splits archive destinations on epoch boundaries for browsability, not
  when they "exceed a budget".

### Upgrade actions

- Re-merge the `AGENTS.md` "Memory size budgets" table from the new root
  template (`prompts/upgrade.md` Step 7) — specifically the `archive/`
  chunk and `backlog.md` Active rows.
- Replace `pm_skills/prompts/prune-memory.md`,
  `pm_skills/prompts/doctor-memory.md`, and `pm_skills/prompts/upgrade.md`
  (`framework` files).
- No data migration: existing archive chunks are left as-is.

---

## 2.2.0 — 2026-06-03

Adds an end-to-end path from spec to a deployed product, and the
production-deploy primitive it was missing.

Until now the framework took a spec as far as a locally-running
first-milestone MVP (`init-mvp.md`) and then handed back to the
per-milestone loop. Nothing drove a production deploy of a consuming
project — `release.md` versions the framework itself, not your app —
and no single workflow chained foundation → milestones → deploy.

Two new framework files close that gap by composing existing workflows
rather than duplicating them. Backward compatible: no files renamed or
removed, no data migration, no changed memory contracts.

### Added

- `pm_skills/prompts/deploy.md` — canonical production deploy + live-
  verification primitive for a consuming project. Reads
  `DEV-INFRASTRUCTURE.md` → Deployment, runs pre-flight (clean tree,
  green build, version stamped, secrets external), executes the
  documented pipeline, verifies the live result, and rolls back on
  failure. The app-deploy counterpart to `release.md`.
- `pm_skills/integrations/spec-to-prod.md` — orchestrator that chains
  `init-mvp.md` (foundation + MVP) → the `next-batch.md`/`auto-jazz.md`
  milestone loop → `deploy.md`, bounded by a signed-off **scope band**
  (Deployed MVP / Deployed Current milestone / Full backlog to
  production). Adds two gates (foundation, scope band) and an
  opinionated Git-with-remote expectation; delegates all build rigour
  to the workflows it wraps.

### Changed

- `pm_skills/GUIDE.md` — "Start here" gains a spec-to-prod entry; file
  tree and manual-workflow sections list the two new files.
- `README.md` — quick start notes the build-and-ship path.

### Upgrade actions

- Copy the two new `framework` files into your project:
  `pm_skills/prompts/deploy.md` and
  `pm_skills/integrations/spec-to-prod.md`. Both inherit the
  `framework` class from the existing `pm_skills/prompts/*` and
  `pm_skills/integrations/*` manifest wildcards — no `MANIFEST.md`
  change is needed.
- Replace `pm_skills/GUIDE.md` (`framework` file).
- No data migration: existing project memory and populated root
  templates are untouched. To use the new path, ensure
  `DEV-INFRASTRUCTURE.md` → Deployment is populated; `deploy.md` will
  prompt for it if not.

---

## 2.1.0 — 2026-06-03

Recalibrates the memory size budgets. Dogfooding `prune-memory.md` on a
mature project surfaced two budgets that were *permanently* over — alarms
no legal prune could ever clear, which trains both agent and maintainer
to ignore the size check entirely.

Root cause: the budgets treated two different file classes identically.
**Accreting** files (`file-map.md`, `decision-log.md`, `backlog.md`,
`trajectory.md`) genuinely grow and need tight, prunable budgets.
**Reference** docs (`README`, `brief.md`, `architecture.md`,
`conventions.md`, and any project standards/process/infra docs) are
written once to a natural size, never accrete, and have no prune action —
yet the fixed 8,000-word "total hot whole-file set" cap summed them in,
so it fired on every mature project before any work even started (5
default hot files × the 2,000 single-file budget = 10,000 > 8,000). The
two conditional reads (`UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`) were
also counted into the every-task total despite being read only when a
task touches their domain.

The fix splits the hot whole-file tier into **reference** (soft per-doc
guideline, not a prune target), **accreting** `file-map.md` (hard
prunable budget), and **conditional** (excluded from the every-task
load); replaces the fixed hot-set sum with a structural review; and
aligns the decision-log word budget with its entry budget at a realistic
density.

Backward compatible: no files renamed or removed, no data migration. A
project adopts the recalibrated budgets when it next merges the
`AGENTS.md` root template.

### Changed

- `AGENTS.md` (`root-template`) — "Read tiers" Hot whole-file split into
  *reference* / *accreting* (`file-map.md`) / *conditional*
  (`UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`). "Memory size budgets":
  the fixed `Total hot whole-file set | 8,000` row becomes a structural
  *every-task read load* review (no aggregate word cap); reference docs
  get a soft ~3,500-word per-doc guideline (not a prune target);
  `file-map.md` keeps its 2,000 hard budget with an irreducible-roles
  floor note; the `decision-log.md` word budget moves 4,000 → ~6,000
  (consistent with 20 entries × ~300 words), entry count primary.
- `pm_skills/prompts/prune-memory.md` — detect step drops the aggregate
  hot-set sum and anchors the `[x]` count to list items
  (`^\s*[-*] \[x\]`); propose step adds a reference-docs-are-not-prune-
  targets rule and a structural every-task-load review, and notes the
  file-map irreducible-roles floor.
- `pm_skills/prompts/doctor-memory.md` — budget check distinguishes hard
  (accreting / sectional) overruns (FAIL) from soft reference-doc
  overruns (WARN); no aggregate hot-set cap.
- `pm_skills/prompts/end-of-task.md` — size check matches the two-class
  model; anchors the `[x]` grep; adds a decision-log entry-tightness
  note (~150–300 words/entry).
- `pm_skills/GUIDE.md` — Hot whole-file tier summary notes the
  reference / accreting / conditional split.

### Upgrade actions

- Re-merge the `AGENTS.md` "Read tiers" and "Memory size budgets"
  sections from the new root template (`prompts/upgrade.md` Step 7),
  preserving any project-added hot reads (file them under *reference* or
  *conditional*) and any project-specific budget rows.
- Replace `pm_skills/prompts/prune-memory.md`,
  `pm_skills/prompts/doctor-memory.md`,
  `pm_skills/prompts/end-of-task.md`, and `pm_skills/GUIDE.md`
  (`framework` files).
- No data migration: existing memory files are untouched.

---

## 2.0.0 — 2026-06-01

Gives project memory a metabolism. Earlier versions could *capture*
work (backlog, decision-log, wish-list) and *archive* history (prune),
but nothing bounded the **active, forward-looking** layer — and the
budgets keyed off a section name (`## Completed`) that real projects
stopped feeding, recording shipped work as `[x]` items under Active
milestones instead. The result, observed on a mature project: a
~22,000-word backlog that was ~90% shipped work narrated in full, each
item duplicating its decision-log entry, while the prune found almost
nothing to do.

This release re-points the metabolism at the layer that actually grows.
The hot/active layer now holds **open work only**. The moment a task
ships, its record leaves the backlog: a one-line outcome goes to the new
`trajectory.md`, and the *why* stays in `decision-log.md` — written
once, never twice. New budgets measure the right axis (backlog Active
words and open-item count, zero `[x]`, decision-log words, an archive
chunk cap), two new workflows repair and diagnose drift the size check
can't see, and the archive gets a browsable `INDEX.md`.

Breaking because it changes the memory contract: the backlog
`## Completed` section is removed and a new `project-memory` file
(`trajectory.md`) is introduced. The upgrade is a one-time, approved,
non-destructive migration — no history is lost.

### Added

- `pm_skills/project/trajectory.md` (`project-memory`) — the
  shipped-work narrative. **Warm** read tier: read on demand (roadmap
  refactor, release, reconstructing what shipped), not every task.
  One line per item + a decision-log pointer; archives by size to
  `archive/trajectory/`.
- `pm_skills/prompts/roadmap-refactor.md` (`framework`) — repair a
  drifted backlog: regroup by lifecycle and dependency, dedupe stale
  rounds, evict shipped work to `trajectory.md`. Distinct from
  `next-batch` (which picks) and `prune-memory` (which archives by size).
- `pm_skills/prompts/doctor-memory.md` (`framework`) — a read-only
  memory health check for structural drift the size check misses:
  `[x]` in the backlog, stale `file-map` paths, cross-file duplication,
  oversized/un-indexed archives, and framework version lag. Proposes the
  workflow that fixes each finding; never edits.
- A new **Warm** read tier and an `archive/INDEX.md` convention (the
  browsable map of cold storage).

### Changed

- `AGENTS.md` (`root-template`) — four read tiers (added Warm for
  `trajectory.md`); backlog is open-work-only (no Completed); rebuilt
  the **Memory size budgets** table to bound the active layer (backlog
  Active 1,500 words / ~40 open items, zero `[x]`; `trajectory.md`
  2,000 words; decision-log 20 entries **or** 4,000 words; archive chunk
  cap 8,000 words / 20 entries); added anti-patterns for
  shipped-work-in-backlog and audit-trail drift; document-ownership row
  for `trajectory.md`.
- `pm_skills/prompts/end-of-task.md` — decision-log is the canonical
  *why*; on ship, **remove** the backlog item (no Completed section) and
  add one line to `trajectory.md`; the size check counts backlog Active
  words/open/`[x]`, trajectory words, and decision-log words; structural
  backlog issues route to `roadmap-refactor.md`.
- `pm_skills/prompts/prune-memory.md` — relocate stray `[x]` work to
  `trajectory.md`; archive oldest trajectory phases; split the
  decision-log by **words** as well as entries; enforce the archive
  chunk cap; maintain `archive/INDEX.md`.
- `pm_skills/prompts/session-start.md`, `pm_skills/GUIDE.md` — document
  the four tiers, `trajectory.md`, and the two new prompts.
- `pm_skills/project/backlog.md` (`project-memory` template) — removed
  the `## Completed` section; open-work-only with a tiny optional ticket
  grammar (Intent / Done-when) so intent survives compression.
- `pm_skills/project/decision-log.md` (`project-memory` template) —
  noted the word budget and that it is the single home of the *why*.
- `pm_skills/MANIFEST.md` — added the `trajectory.md` path row.
- `pm_skills/prompts/upgrade.md` — Step 8 gains a concrete, repeatable,
  lossless memory-migration routine: snapshot → propose → execute (align
  with any pre-existing archive) → **binary line-anchored ID reconcile**,
  with `VERSION` stamped only after the reconcile passes. The mechanics
  behind the migration below.
- `pm_skills/init.md` + `pm_skills/integrations/init-project.md` — the
  backlog-generation step now produces open-work-only tickets in the
  2.0.0 grammar (Intent / Done-when + flags) so a project is born lean,
  with a compress-on-ship note added to "Memory hygiene".

### Upgrade actions

- Add `pm_skills/prompts/roadmap-refactor.md` and
  `pm_skills/prompts/doctor-memory.md` (`framework` — new files).
- Replace `pm_skills/prompts/end-of-task.md`, `prune-memory.md`,
  `session-start.md`, `upgrade.md`, and `pm_skills/GUIDE.md` with the new
  versions (`framework` — wholesale, subject to the Step 4 customisation
  check).
- Create `pm_skills/project/trajectory.md` from the source template
  (`project-memory` — new file; skip if it already exists, never
  overwrite).
- `AGENTS.md` (`root-template`, 3-way merge): the **Read tiers**,
  **Memory size budgets**, document-ownership, and anti-pattern blocks
  are framework-authored — if the project left them at the defaults,
  replace with the new versions; if the project customised the numbers or
  tiers, surface a diff and let the user adopt. Preserve every
  project-populated section verbatim.
- `pm_skills/project/backlog.md` and `decision-log.md`
  (`project-memory`): apply the new template comments/structure only
  where still the unedited placeholders; never rewrite a project's real
  content. The Completed-section removal is handled by the memory
  migration below, not by overwriting.
- **Memory migration (one-time, approved, non-destructive).** A
  major-version data move; `pm_skills/prompts/upgrade.md` Step 8 runs the
  snapshot → propose → execute → reconcile mechanics. Lose nothing:
  1. **Snapshot** `backlog.md` verbatim to
     `archive/trajectory/backlog-pre-v2-YYYY-MM-DD.md` (byte-identical
     safety net).
  2. Create `trajectory.md` (above).
  3. Run `pm_skills/prompts/roadmap-refactor.md`: relocate every `[x]`
     item and any `## Completed` section out of `backlog.md` into
     `trajectory.md` (one compressed line each, starting with the ID,
     grouped into phases; split into sequential `archive/trajectory/`
     chunks when the live file would exceed its 2,000-word budget),
     confirming each item's *why* already lives in `decision-log.md`.
     Align with any pre-existing shipped archive (e.g. `backlog-shipped.md`)
     rather than duplicating it. Remove `## Completed` once empty.
  4. Create or refresh `archive/INDEX.md`.
  5. **Reconcile (lossless proof):** compare leading item IDs (snapshot
     `- [x] **ID**` lines vs. trajectory `- ID —` lines, anchored to line
     starts) — the set difference must be **empty**; zero `[x]` remain in
     `backlog.md`; the snapshot is still byte-identical. Then run
     `pm_skills/prompts/doctor-memory.md` to confirm budgets, and
     `pm_skills/prompts/prune-memory.md` if the decision-log or any
     chunk is over budget.
  6. Stamp `pm_skills/VERSION` to 2.0.0 **only after** the reconcile
     passes (held at 1.x through the framework sync).
- A project already past these (no `## Completed`, has `trajectory.md`)
  needs only the file/prompt replacements — the migration is a no-op.

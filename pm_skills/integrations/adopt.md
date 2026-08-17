---
description: Retrofit pm-skills onto an existing codebase — reverse-engineer project memory from the source tree and git history, then interview only for gaps
---

The adoption path for a project that already has code. Where
`pm_skills/init.md` interviews for a new project and
`integrations/init-mvp.md` builds one from an idea, this workflow
**reverse-engineers** project memory from what already exists — the
source tree, the manifests, the git history, the README and any ADRs —
and asks the user **only for what the repo cannot tell you**.

Use this when you arrive with a mature or half-built repository and
want it on pm-skills without hand-writing every memory file. The Hub
itself proved the shape: pm-skills was retrofitted onto an existing
spec and v1 history, every memory file a "pm-skills-shaped digest that
points back to the canonical docs." That worked because the maintainer
already knew the framework; this workflow gives a newcomer the same
path.

When **not** to use it:

- Greenfield (no code yet) — use `pm_skills/init.md` (drive it
  yourself) or `integrations/init-mvp.md` (let the agent build it).
- The repo already has populated pm-skills memory on an older version —
  this is an **upgrade**, not an adoption. Step 0 detects that and
  routes to `pm_skills/prompts/upgrade.md`.
- The project already has current pm-skills memory — use `task.md` or
  Start B in `session-start.md`.

## Scope of this run (v1: adopt-only)

This workflow populates project memory and stops at the readiness
check. It does **not** then build a backlog item — reaching a
ready-to-work project is the ceiling. To start the first task, hand off
to `session-start.md` → Start B in a fresh session. (No scope "band"
like `init-mvp.md`; adoption is setup, not a build run.)

## Conservative defaults (gateless phases)

The inventory phase is read-only and asks nothing; the gap interview
and the writes are gated. Where a judgement is not gated:

- **Proposes, never overwrites.** If the repo already has a README,
  architecture doc, or ADRs, **link and digest** them (the Hub
  pattern — point, don't restate); never duplicate or clobber an
  existing doc.
- Prefer the smallest faithful digest over an invented narrative. Read
  what the repo states; do not fabricate rationale it does not record.
- Prefer sampling over exhaustive reads on large repos (see the
  read-cost cap below).
- Flag every reverse-engineered inference as such, for the user to
  verify.

## Hard prohibitions

The canonical gateless list in `pm_skills/integrations/task.md`
applies in full. This mode adds two adaptations for working inside an
existing repo (stop and ask one concise question before any of these):

- **Overwriting or deleting any pre-existing file.** Adoption only
  **adds** pm-skills memory files and **proposes** edits to existing
  docs; it never rewrites the user's code, README, or specs in place.
- **Fabricating history or rationale.** Seeded content is marked
  reverse-engineered and verifiable; never invent a per-decision "why"
  the git history or docs do not state.

---

## Step 0: Detect prior pm-skills, and confirm this is an adoption

Before reading anything else:

- If `pm_skills/VERSION` (or populated `pm_skills/project/*` memory)
  already exists in the target repo, this is **not** a fresh adoption.
  Stop and route the user to `pm_skills/prompts/upgrade.md` (it reads
  the version gap and applies only the deltas, preserving memory). Do
  not overwrite existing memory.
  - **Exception — the framework source tree itself.** If the repo *is*
    pm-skills (a clone or fork of the framework: `pm_skills/CHANGELOG.md`
    and `MANIFEST.md` present, the templates in `pm_skills/templates/`
    (repo root before 4.0.0) still carrying their placeholders, and no
    populated `pm_skills/project/*`), that
    `VERSION` is the *product*, not a prior deployment — do not route to
    upgrade. Self-hosting a framework fork is an adoption into a
    **parallel** memory home (e.g. `self/`) by maintainer direction; the
    standard `pm_skills/project/` stays a pristine template.
- If there is no code and no history, this is greenfield — recommend
  `pm_skills/init.md` or `integrations/init-mvp.md` instead.
- Otherwise confirm in one line that this is an existing codebase with
  no pm-skills memory, and continue.

Also read the framework context this run must honour: `AGENTS.md`,
`UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md` (the root rulebooks — if
absent, copy them from `pm_skills/templates/` first, per
`pm_skills/init.md` Step 0) and `pm_skills/init.md`.

---

## Phase 1: Inventory (read-only, no questions)

Walk the repo and draft each artifact from evidence. Ask nothing yet.
State what you sampled. Draft — do not write files — until Phase 2.

1. **File map + structure tree.** Run `gen-file-map.mjs` (from
   `pm_skills/scaffold/`) to produce the `file-map.md` skeleton from
   `git ls-files`; its directory-grouped sections become the
   `architecture.md` structure tree. Write role text only for the
   files you sampled; leave the rest `(role needed)`.
2. **Stack + scripts + dependencies.** Read the manifests and config
   (`package.json`, lockfiles, `tsconfig`, CI workflows, Dockerfiles,
   `pyproject.toml`, etc.) into the `architecture.md` stack table, a
   scripts table, and a draft dependency policy.
3. **Trajectory seed (needs git history).** Run
   `git log --format='%ad %s' --date=short` (and `git tag`) and derive
   `trajectory.md` phases from month or tag boundaries; note large gaps
   or rewrites as phase boundaries. If there is no git history, **skip
   this and say so** — adoption degrades gracefully without it.
4. **Brief + canonical docs.** Read the README and any docs into a
   `brief.md` draft. Detect existing ADRs / specs and **link them as
   canonical** (point, don't restate) — record "if the brief and the
   spec disagree, the spec wins."
5. **Conventions (by sampling).** Infer indent, quote style, test
   runner, and layering from a sample of source files → `conventions.md`
   draft. State the sample.

### Read-cost cap

On a large repo, **sample per directory** (a few files per section) —
never exhaustive-read the source. State in one line what was sampled
per area so the user can judge coverage.

---

## Phase 2: Gap interview (gated — ask only what inventory cannot answer)

Batch every remaining question into **one message**; cap at ~8. Ask
only what the tree and history genuinely cannot supply:

- Product intent and what is explicitly out of scope (for `brief.md`).
- Invariants and protected paths (for `AGENTS.md`).
- Deploy target and pipeline, if any (for `DEV-INFRASTRUCTURE.md`).
- The backlog's **Current milestone** — what to work on next.

Present the drafted artifacts alongside the questions so the user
corrects the inventory and answers the gaps in one pass. **Wait** for
answers, then write the memory files — proposing (never overwriting)
edits to any pre-existing doc.

Seed the `decision-log.md` with exactly **one** entry: "Adopted
pm-skills; project memory reverse-engineered from the source tree and
git history." Do not fabricate per-item decision entries the history
does not record. Mark every reverse-engineered inference
`(reverse-engineered — verify)` so the user knows what to check.

---

## Phase 3: Readiness

- Run `pm_skills/init.md` Step 10 (the readiness checklist +
  placeholder lint) and resolve anything it flags.
- Propose the first backlog items from `TODO` / `FIXME` markers in the
  source and any open issues, if present, ordered into the Current
  milestone.
- Report what was inventoried, what was sampled, what was asked, and
  which inferences the user should verify.
- Hand off: the project is ready for work — start the first task with
  `session-start.md` → Start B in a fresh session.

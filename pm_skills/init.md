---
description: Initialize a new project using PM Skills (manual or agent-driven)
---

# Initialize Your Project

Follow these steps to go from a blank project to "ready for first task."
Total time: ~30 minutes.

## Agent mode

This file doubles as the agent workflow (it replaces the former
init-project integration). If you are an AI agent running this:
execute Steps 0–10 in order yourself — gather the Step 1 answers
conversationally instead of having the user paste prompts, generate
each artifact, and **present it for review before writing it**. Write
files only after approval, step by step. Everything else in this file
(the population prompts, the appendix shape examples, the readiness
check) applies unchanged. To gate only the foundation and then
autonomously build the first-milestone MVP, use
`pm_skills/integrations/init-mvp.md` instead.

**Arriving with an existing codebase?** This file assumes a new
project. For a repo that already has code, use
`pm_skills/integrations/adopt.md` — it reverse-engineers project memory
from the source tree and git history and interviews only for gaps,
ending at this file's Step 10 readiness check.

This process populates two kinds of project memory:

- **`project/`** — living project memory (brief, backlog, file map,
  decisions). Read at the start of every task session.
- **`AGENTS.md` + `UI-STANDARDS.md` + `DEV-INFRASTRUCTURE.md`** —
  permanent behavioral contracts at the project root. They start as
  copies of the templates in `pm_skills/templates/` (Step 0). Loaded
  automatically by AI tools that support global rules, or read
  manually at session start for other tools.

Both are kept in sync. The kickoff process gathers information once and
writes it to the right places.

## Prefer to let the agent build it?

This guide is the fully manual path — you drive every step. If instead you
have wants or specs and want the agent to do the work, use
`integrations/init-mvp.md`. You review and **sign off the foundation** (the
product read, the stack, and the MVP backlog), and then it builds the
first-milestone MVP to completion without further gates — de-risked by
staged rollback checkpoints. It applies the same rigour (design-before-code,
Carbon, WCAG 2.2 AAA, minimal dependencies, live project memory). Come back
to this guide whenever you want to drive the setup yourself.

## Minimum viable setup

If you want to start fast, complete only these now:

- Step 0 (copy the rulebook templates)
- Step 1 (`brief.md`)
- Step 2 (`architecture.md`)
- Step 3 (`backlog.md`)
- Step 5 (`README.md`)
- Step 6 — at minimum, populate the **Product identity** section of
  `AGENTS.md`

Everything else (conventions, UI standards, dev infrastructure,
scaffold, full readiness check) can be deferred to first use. Picking
up deferred items as you encounter them produces no rework: each step
only adds content, it does not rewrite earlier choices.

---

## Step 0: Copy the rulebook templates

The three rulebooks ship inside the framework at
`pm_skills/templates/`. Copy them to your project root once — they
are yours to populate from here on and are never overwritten by an
upgrade (upgrades merge new template sections into your copies):

```sh
cp -n pm_skills/templates/AGENTS.md \
  pm_skills/templates/UI-STANDARDS.md \
  pm_skills/templates/DEV-INFRASTRUCTURE.md .
```

Skip any file that already exists at the root — never overwrite a
populated rulebook (`cp -n` does this for you).

**Optional fourth template:** a complex multi-phase project — one
with macro phases, formal decision records (ADRs), or per-phase
definitions of done — may also copy `pm_skills/templates/PROCESS.md`
and populate it. Simple projects skip it entirely; nothing nags.

---

## Step 1: Fill in the project brief

Open `project/brief.md` and answer each question.

Keep it short — a few sentences per section is fine. You can always
expand later. This is the seed that everything else grows from.

---

## Step 2: Generate the architecture

Start a chat with your AI tool and paste this:

```text
Read pm_skills/project/brief.md.

Based on this brief, propose:
1. A recommended tech stack with a one-line justification per choice.
2. A folder and file structure for the project.
3. Key modules or components, with a one-sentence responsibility for each.
4. Communication patterns — how modules should interact (e.g. pub-sub
   event bus, direct imports, state store). Name the preferred pattern.
5. A dependency policy — what's allowed without approval.
6. A dev workflow — how to install, run in development, build for
   production, and run tests. Include the expected dev URL and port.
7. A configuration strategy — where tuneable values, constants, and
   design tokens should live.

Keep it practical and minimal. This is a starting point, not a final architecture.
Output in markdown format matching the template in pm_skills/project/architecture.md.
```

Review the output. Edit until you agree with it. Save the result to
`project/architecture.md`, replacing the template comments.

---

## Step 3: Generate the initial backlog

In the same chat (or a new one), paste this:

```text
Read:
- pm_skills/project/brief.md
- pm_skills/project/architecture.md
- pm_skills/project/backlog.md (the template — its comments define
  the canonical ticket grammar and flags)

Based on the brief and architecture, propose an initial backlog of
8–12 OPEN tasks that would take this project from zero to a working
first milestone. The backlog holds open work only — there is no
Completed section; shipped work will later move to trajectory.md.

Use the ticket grammar exactly as the backlog.md template comments
define it: quick items one line; non-trivial or sign-off items an
Intent / Done-when pair plus optional flags ([sign-off], [blocked: X],
[spike]).

Group tasks under milestone headings (Current milestone / Next
milestone), with an Icebox for anything deferred. Order by dependency.
Keep tasks small enough to complete in a single focused session.
Output in markdown matching the template in pm_skills/project/backlog.md.
```

Review the output. Reorder, add, or remove tasks. Save to
`project/backlog.md`.

`project/wish-list.md` and `project/trajectory.md` ship empty — the
capture inbox for unscoped ideas, and the shipped-work narrative that
fills as you complete tasks. Leave both as-is; no population is needed
at init.

---

## Step 4: Set initial conventions (optional)

If you already know your preferred code style, naming patterns, commit
format, or testing approach, fill in `project/conventions.md` now.

If you're not sure yet, skip this. Conventions will emerge naturally
once you start writing code. Capture them in `project/conventions.md`
when they do.

---

## Step 5: Create a root README.md

`AGENTS.md` tells AI agents to read `README.md` at the start of every
task. Create a root `README.md` for your project now.

It does not need to be long. Include:

- **What this project is** — one paragraph.
- **How to run it** — build/serve commands, prerequisites.
- **Key infrastructure** — important modules, entry points, gotchas.
- **Invariants** — anything a contributor must not break.

You can generate a first draft from your brief and architecture:

```text
Read:
- pm_skills/project/brief.md
- pm_skills/project/architecture.md

Draft a concise root README.md for this project. Include:
1. One-paragraph description of the project.
2. How to run or build it (commands, prerequisites).
3. Key modules and entry points.
4. Any invariants or gotchas a contributor should know.

Keep it short — this is a working reference, not marketing copy.
```

Review and save to the project root as `README.md`.

---

## Step 6: Populate AGENTS.md

`AGENTS.md` is the permanent behavioral contract for AI agents. It
contains `<!-- CUSTOMISE -->` placeholder sections that should be filled
in using the information gathered in Steps 1–5.

For shape examples (core data model, protected infrastructure,
event naming, persistence checklist, etc.), see **Appendix A** at the
bottom of this file.

In the same chat (or a new one), paste this:

```text
Read:
- pm_skills/project/brief.md
- pm_skills/project/architecture.md
- pm_skills/project/conventions.md (if it exists)
- AGENTS.md

AGENTS.md has <!-- CUSTOMISE --> placeholder sections. Using the brief,
architecture, and conventions, populate every applicable placeholder:

1. **Product identity** — Replace [Project Name] and [short product
   description] with the real product name and a 2–4 sentence
   description. State what the app IS and what mental model is
   canonical. Optionally state what it is NOT.

2. **Hard rules (invariants)** — Add project-specific invariants below
   the existing universal ones. Consider: canonical data formats,
   cross-component communication rules, specific token systems,
   programmatic update patterns to avoid feedback loops.

3. **Core data model** — If there are canonical entities, describe them.
   State which patterns are explicitly forbidden.

4. **Domain subsystems** — If the architecture defines subsystems
   (simulation, rendering, data pipeline, etc.), add a section for each
   describing the design contract.

5. **Relationship to prior work** — If this project was forked from or
   shares history with another codebase, fill in that section.

6. **Protected infrastructure** — If there are modules that must not be
   deleted or restructured without approval, list them.

7. **Event naming convention** — Fill in the event naming section
   with the project's actual namespaces, or remove the section if
   the project doesn't use events.

8. **Files to never edit** — List build output dirs, personal notes, or
   other paths agents must never touch.

9. **Anti-patterns** — Add project-specific anti-patterns below the
   universal ones.

10. **Testing** — Keep the testing doctrine as the default. Add any
    project-specific invariants or anti-patterns; record the runner,
    config, and what-to-test in `project/conventions.md`.

11. **Persistence checklist** — If the project has stateful models
    that persist to localStorage or files, fill in the checklist.
    If not applicable, remove the section.

12. **Code documentation** — Confirm or adjust the documentation
    standard (e.g. JSDoc for JavaScript).

Only fill in sections where the brief and architecture provide enough
information. Leave remaining placeholders for later. Do not invent
information.

Output the updated AGENTS.md in full.
```

Review the output. Save the result to `AGENTS.md`, replacing the
template version.

**Optional — tool-specific workflows:** If your AI tool supports
workflows, copy the files from `integrations/` to your tool's workflow
directory. The prompt files in `prompts/` serve the same purpose for
tools without workflow support.

---

## Step 7: Populate UI-STANDARDS.md (if the project has UI)

If this project has a user interface, paste this:

```text
Read:
- pm_skills/project/brief.md
- pm_skills/project/architecture.md
- UI-STANDARDS.md

UI-STANDARDS.md has a <!-- CUSTOMISE --> placeholder for the token
systems section. Using the brief and architecture:

1. Define the token systems used by this project.
2. If the project uses a brand palette alongside Carbon structural
   tokens, describe both systems and state they must not be collapsed.
3. If the project has a single token system, describe it.

Output only the updated "Token systems" section.
```

Review and save to the Token systems section of `UI-STANDARDS.md`.

If this project has no user interface, the UI-STANDARDS.md file can be
removed from the boilerplate.

---

## Step 8: Populate DEV-INFRASTRUCTURE.md (if the project has a build step)

If this project uses a package manager, bundler, dev server, or build
step, populate `DEV-INFRASTRUCTURE.md` now. If the project is pure
static files with no build tooling, skip this step — the file can be
removed from the boilerplate.

For shape examples per section (package management, scripts table,
dev server, build, version, deploy, configuration, etc.), see
**Appendix B** at the bottom of this file.

In the same chat (or a new one), paste this:

```text
Read:
- pm_skills/project/brief.md
- pm_skills/project/architecture.md
- DEV-INFRASTRUCTURE.md

DEV-INFRASTRUCTURE.md has <!-- CUSTOMISE --> placeholder sections.
Using the brief and architecture, populate every applicable placeholder:

1. **Package management** — package manager, dependency policy.
2. **Canonical scripts** — table of every script in package.json.
3. **Dev server** — canonical URL, port, how to start, what it serves.
4. **Runtime lifecycle** — the boot/reboot/status/recovery command
   surface, process ownership, env workflow, generated-output cleanup,
   health/readiness checks, exposure flags, and protected paths. Scale
   it to the project (see Appendix B); even a static site documents how
   to run it.
5. **Maintainer diagnostics** — the structured logger, log record
   shape, bounded buffer, global error/rejection capture, the redacted
   copy-diagnostics bundle, and dev-only gating. Scale it to the project
   (see Appendix B); even a static page makes uncaught errors legible.
6. **Quality gate** — the one-command `check` (non-mutating, CI-safe),
   what it runs, and what it omits. Scale it to the project (see
   Appendix B); even a docs project runs a placeholder scan + link
   check. For tool choices use the per-stack defaults in
   `project/conventions.md` → Tooling; the Markdown lint + link-check
   baseline ships in `pm_skills/scaffold/` (copied in Step 9).
7. **Security baseline** — where secrets live, the `.env` /
   `.gitignore` placeholder discipline, the report-only key-shape scan
   folded into `check`, the dependency-audit cadence, and the
   leaked-credential response playbook (rotation-first). Scale it to the
   project (see Appendix B); even a static site keeps env files
   gitignored and templates placeholder-only.
8. **Build system** — bundler, entry point, output directory, source
   maps, minification, static file handling.
9. **Version management** — the two-part version identity from
   `AGENTS.md` → "Traceable version identity": the product version
   (release name) and build identity (commit/date trace), their sources,
   how the build identity is injected, and the bump rule. Scale it to the
   project (see Appendix B).
10. **Deployment** — target, pipeline, post-deploy verification.
11. **Utility scripts** — any helper scripts beyond dev/build/test.
12. **Configuration strategy** — where constants, design tokens, and
    user-facing config live.
13. **Editor config** — describe the .editorconfig if one exists.
14. **Files agents must not hand-edit** — concrete paths.

Only fill in sections where the architecture provides enough
information. Leave remaining placeholders for later. Do not invent
information.

Output the updated DEV-INFRASTRUCTURE.md in full.
```

Review the output. Save the result to `DEV-INFRASTRUCTURE.md`,
replacing the template version.

---

## Step 9: Copy scaffold files

Copy the following from `pm_skills/scaffold/` to
your project root, if they don't already exist:

- **`.editorconfig`** — editor style enforcement (indent, encoding,
  line endings). Useful for any project, not just those with a build
  step. Customise to match your preferences.
- **`.gitignore`** — common ignores for JS/npm projects. Adapt for
  your stack if needed.
- **`.markdownlint.json`** — Markdown lint baseline: strict on what
  breaks rendering, relaxed on style noise. The one lint config every
  pm-skills project can use, since project memory is Markdown. Tune to
  taste; runs via the Node markdownlint family.
- **`check-links.mjs`** — dependency-free internal Markdown link checker
  (Node only). Catches broken cross-references in your docs and memory
  files. Delete it if your project link-checks another way.

---

## Step 10: Readiness check

Before starting your first task, confirm:

- [ ] `project/brief.md` is filled in.
- [ ] `project/architecture.md` is filled in.
- [ ] `project/backlog.md` has an initial task list.
- [ ] Root `README.md` exists.
- [ ] `AGENTS.md` has been populated — no remaining `[Project Name]`
  or `[short product description]` placeholder.
- [ ] `UI-STANDARDS.md` token systems section is populated (if the
  project has UI).
- [ ] `DEV-INFRASTRUCTURE.md` is populated (if the project has a build
  step or dev server).
- [ ] Runtime lifecycle is documented and the app boots: the canonical
  command in `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle" runs, and a
  cold boot reaches a verified-ready state (health/output), not just a
  launched process.
- [ ] Maintainer diagnostics are documented: uncaught errors are made
  legible (a global error hook at minimum), and — if the project has UI —
  a dev-only, redacted copy-diagnostics affordance is planned per
  `UI-STANDARDS.md` → "Diagnostics affordance" and
  `DEV-INFRASTRUCTURE.md` → "Maintainer diagnostics".
- [ ] `.editorconfig` is in the project root.
- [ ] `.gitignore` is in the project root.
- [ ] The Markdown lint baseline (`.markdownlint.json` +
  `check-links.mjs`) is in the project root — or deliberately removed
  for a non-Markdown / non-Node project.
- [ ] The quality gate runs: `check` is documented in
  `DEV-INFRASTRUCTURE.md` → "Quality gate" and runs green — or the gate
  is deliberately deferred for an early MVP.
- [ ] Version identity is defined: `DEV-INFRASTRUCTURE.md` → "Version
  management" records the product version and build identity per
  `AGENTS.md` → "Traceable version identity" — or is deliberately
  deferred for a pre-deploy MVP.
- [ ] Security baseline is defined: `DEV-INFRASTRUCTURE.md` → "Security
  baseline" records where secrets live, the `.gitignore` / `.env.example`
  placeholder discipline, and the leaked-credential response playbook per
  `AGENTS.md` → "Security baseline"; the report-only secret scan is
  folded into `check` — or deliberately collapsed to one line for a
  project with no secrets and no third-party dependencies.

Then run a placeholder lint:

```sh
grep -nE '\[Project Name\]|\[short product description\]|<!-- CUSTOMISE' \
  AGENTS.md UI-STANDARDS.md DEV-INFRASTRUCTURE.md 2>/dev/null
```

Review each hit. For each remaining `<!-- CUSTOMISE -->` marker,
either populate the section or leave it as a deliberate "not
applicable" stub. Bracketed `[placeholder]` strings should not
remain in populated sections.

Once the project has a `check` command, fold this placeholder scan into
it (the Tier 0 baseline in `DEV-INFRASTRUCTURE.md` → "Quality gate") so
stray markers are caught on every task, not just at init.

If any of the boxes above are unchecked, finish them before
proceeding — unless you are following the **Minimum viable setup**
path, in which case the deferred items can be completed on first
use.

---

## Step 11: Start your first task

Open `project/backlog.md` and pick the first task.

If your AI tool supports workflows and you copied `integrations/`
in Step 6, run one of the task workflows and state your task:

- `task.md` — the task workflow. Modes: `checkpoint` (default —
  gates only at scope and design pick), `full` (a gate at every
  stage; use for `[sign-off]` items and high-risk work), `auto-jazz`
  (no gates), `auto-jazz-lite` (no gates, compressed 2-stage),
  `spike` (timeboxed exploration — findings are the deliverable), and
  `refactor` (behaviour-preserving restructuring within a declared
  surface). Hard prohibitions (dependency adds, protected files,
  destructive migrations, large refactors, weakening tests) apply in
  every mode.
- `bugfix.md` — diagnosis-before-fix workflow with approval gates.

Otherwise, follow the manual prompt workflow below.

For non-trivial tasks (4-stage):

1. Open a new chat.
2. Paste the **Standard start** section from `prompts/session-start.md`.
3. Use `prompts/scoping.md` — approve the scope.
4. Use `prompts/design-options.md` — pick an option.
5. Use `prompts/implementation-plan.md` — approve the plan.
6. Use `prompts/validation.md` — confirm readiness.
7. Say "go ahead and implement."
8. When done, paste `prompts/end-of-task.md`.

For small or simple tasks (single-stage):

1. Open a new chat.
2. Paste the **Quick start** section from `prompts/session-start.md`.
3. Use `prompts/quick-task.md` — approve the plan.
4. Say "go ahead and implement."
5. When done, paste `prompts/end-of-task.md`.

---

## You're set up

From here, the cycle is: pick a task → scope/plan → implement → update
project memory → pick the next task. To let the agent pick for you,
start a chat with `prompts/session-start.md` → Start B — it selects the
next logical backlog batch and presents it for your go-ahead.

The files in `project/` are your living memory. `README.md`,
`AGENTS.md`, `UI-STANDARDS.md`, and `DEV-INFRASTRUCTURE.md` are your
permanent project references. Keep them all current and every new
chat can pick up where the last one left off.

## Memory hygiene

Project memory uses tiered reads (see AGENTS.md → "Before every task")
and soft word budgets so context stays bounded as the project grows.

The core habit that keeps it lean is **compress-on-ship**: the backlog
holds open work only; the moment a task ships, `end-of-task.md` removes
its backlog item, adds one line to `trajectory.md` (the outcome), and
records the *why* once in `decision-log.md`. Nothing accumulates in the
hot/active layer — that is what stops the backlog becoming an audit
trail of shipped work.

- Every end-of-task update runs a size check (fast path on most
  tasks). If a budget is exceeded, the agent proposes the Prune verb
  of `pm_skills/prompts/memory-maintenance.md` — it does not
  auto-prune.
- Structural drift the size check can't see (stray `[x]` work, dated
  rounds, stale paths) is repaired by the Refactor verb and surfaced
  by the read-only Diagnose verb of the same file.
- `pm_skills/project/archive/` is created lazily on the first prune.
  A fresh project has no archive folder.
- Archives are cold (never auto-read). Search via grep when
  explicitly relevant.
- `pm_skills/project/tickets/` is created lazily the first time an
  item needs a `[detail]` detail file. A fresh project has none, and
  ticket files are cold too — read only for the active `[detail]` item.

You should not need to touch any of this manually until a budget
trips. When that happens, approve the prune proposal and let the
workflow do the rest.

---

## Appendix A — Step 6 reference: AGENTS.md section examples

Use these examples as shape references when populating `AGENTS.md`
in Step 6. The stub markers in `AGENTS.md` point here. None of
these are mandatory — adapt or omit per project.

### Hard rules (project-specific invariants) examples

Add bullets below the universal hard rules. Examples:

- Canonical data formats (e.g. normalised coordinates, UTC timestamps).
- Cross-component communication rules (e.g. EventBus-only, no direct calls).
- Specific token systems and how they coexist.
- Programmatic update patterns to avoid feedback loops.

### Core data model example

```markdown
## Core data model

The canonical model is:

- **`EntityA`** — id, properties…
- **`EntityB`** — id, relationships…

Do **not** introduce [anti-pattern X] or [legacy pattern Y].
```

### Protected infrastructure example

```markdown
## Protected infrastructure

| Module | Role | Notes |
| --- | --- | --- |
| `example.js` | Description | Migration plan or n/a |

Do not delete, rename, or restructure protected modules without
explicit approval.
```

### Event naming convention example

```markdown
## Event naming convention

Use colon-separated namespaces for all events. Group by domain:

- `domain:entity:action` for model events.
- `ui:component:action` for UI events.
- `app:lifecycle:action` for application-level events.
```

If the project uses hooks, direct imports, or another pattern
instead of events, state that here and remove the namespace
guidance.

### Testing policy stages

The permanent doctrine (invariants over coverage, named categories,
fast-and-hermetic, two layers, never silently weaken a test) lives in
`AGENTS.md`. This section records where *this* project sits on the
ramp today:

1. **Pre-invariant (MVP/greenfield).** Manual verification only.
   Correct to defer tests until invariants stabilise — say so.
2. **Safety net.** Vitest (or stack equivalent) for logic, validation,
   and boundary/API tests via in-process injection; a regression test
   per fixed bug; round-trip tests for persisted state.
3. **Journeys.** Playwright (or equivalent) for the few real-environment
   flows that would break trust if they failed.

Record the runner config and this project's specific invariants in
`conventions.md`. Update as the suite matures.

### Persistence checklist examples

JS app with manual serialisation:

```markdown
## Persistence checklist

When adding any property that should survive reload:

1. Default in constructor (relevant model class).
2. Include in serialisation (`toJSON()` or equivalent).
3. Handle in deserialisation (`fromJSON()` or equivalent) with
   fallback default.
4. Serialise in auto-save.
5. Restore in load/auto-load.
```

ORM-based app:

```markdown
## Persistence checklist

When adding any field that should survive reload:

1. Add the field to the model definition.
2. Create and run a migration.
3. Handle the field in any import/export functions with a fallback
   default.
4. Verify it persists correctly via the ORM layer.
```

If the project has no persistence layer, remove this section.

### Files to never edit examples

```markdown
- docs/ or dist/ — build output, overwritten on every build.
- version.json — generated build identity; managed by the build script.
- node_modules/ — managed by npm.
- package-lock.json — managed by npm (commit but do not edit).
```

### Anti-pattern examples (project-specific)

```markdown
- Iterating data as if it has an implicit order when it doesn't.
- Using a legacy abstraction as a design reference.
- Collapsing parallel token systems into one.
```

---

## Appendix B — Step 8 reference: DEV-INFRASTRUCTURE.md section examples

Use these examples as shape references when populating
`DEV-INFRASTRUCTURE.md` in Step 8. Adapt to your stack.

### Package management example

```markdown
Package manager: **npm**

- `package.json` lives in the project root.
- **Runtime dependencies** require explicit approval. The default is
  zero runtime dependencies.
- **Dev dependencies** (bundler, test runner, linter) can be added
  when justified by the architecture.
- Run `npm install` after cloning. Do not commit `node_modules/`.
```

### Canonical scripts example

```markdown
| Script | Command | Purpose | When to use |
| --- | --- | --- | --- |
| `dev` | `node build.js --watch --serve` | Dev server with hot reload | Day-to-day development |
| `build` | `NODE_ENV=production node build.js` | Production build | Before deploy |
| `test` | `vitest run` | Run tests once | After every change |
| `test:watch` | `vitest watch` | Tests in watch mode | During development |
| `push` | `node push.js` | Build + commit + push | When ready to ship |

Do not add scripts without updating this table.
```

### Dev server example

```markdown
- **URL:** `http://localhost:3000`
- **Start:** `npm run dev`
- **Serves:** Build output from `docs/` (esbuild rebuilds on change)
- **Hot reload:** JS changes trigger esbuild rebuild automatically.
  CSS and HTML changes are watched and copied to the output directory.

All development and testing should use this URL. Do not hard-code
alternative ports or URLs.
```

### Runtime lifecycle example

The capability is required at every tier; the implementation scales.
Document only the verbs this project actually implements.

Single dev server (most common) — `dev` + `reboot`:

```markdown
| Verb | Command | Does |
| --- | --- | --- |
| `dev` | `npm run dev` | Foreground dev server at http://localhost:3000 |
| `reboot` | `npm run dev:restart` | Clears owned port 3000, removes `dist/`, restarts dev |

- **Owns:** port 3000 only. `reboot` kills just the PID on that port.
- **Cleans:** `dist/` only (generated). Never source, never `.env`.
- **Ready when:** the dev URL serves HTTP 200 — not merely that the
  process started.
```

Multi-process / operator-facing — add `boot`, `stop`, `status`,
`logs`, and `reset` / `reset:hard`:

```markdown
| Verb | Command | Does |
| --- | --- | --- |
| `boot` | `./scripts/boot.sh` | Starts all components; prints URLs; writes PIDs/logs |
| `stop` | `./scripts/stop.sh` | Graceful stop of owned PIDs (SIGTERM, then SIGKILL) |
| `status` | `./scripts/status.sh` | Components, ports, PIDs, health |
| `logs` | `tail -f sessions/hub.log` | Tail the runtime log |
| `reset` | `./scripts/reset.sh` | Safe reset of generated state only |
| `reset:hard` | `./scripts/reset.sh --hard` | Destructive; may wipe local data. Explicit flag required |

- **Ownership:** PIDs in `sessions/.pids`; logs in `sessions/*.log`.
- **Env:** `.env` composed from `.env.example` + gitignored
  `.env.secrets`; regenerated when missing or stale.
- **Health:** boot polls `/api/health` and fails loudly (non-zero exit,
  log tail) if readiness never returns.
- **Exposure:** public tunnel / LAN / operator modes are OFF by default
  and require an explicit flag plus a printed warning.
```

For a pure-static project this whole section collapses to one line —
e.g. "Open `index.html`" or "`npx serve .` → `http://localhost:3000`".

### Maintainer diagnostics example

The capability is required at every tier; the implementation scales.
Document only the tier this project is at. The console is one output
sink — the copy affordance reads an app-owned buffer, never the native
DevTools console.

Tier 1 (typical dev-server app):

```markdown
- **Logger:** `src/diagnostics/log.js` — one structured entry point
  (`log.debug/info/warn/error`). Writes to the console AND a bounded
  ring buffer (last 200 entries). No ad-hoc console.log elsewhere.
- **Record shape:** `{ time, level, scope, event, message, data, error }`.
- **Global capture:** `window` `error` + `unhandledrejection` funnel
  into the logger, so nothing fails silently.
- **Copy affordance:** dev-only icon button (see UI-STANDARDS.md →
  "Diagnostics affordance"). Copies product version + build id, route,
  UA + viewport, the last N redacted log entries, uncaught errors, and a
  redaction notice.
- **Redaction:** default-on; never tokens, cookies, raw bodies, full
  storage, or PII. Fail closed when unsure.
- **Gating:** affordance + debug level are dev-only; production needs an
  explicit opt-in flag (`DIAG=1`) and a redaction review.
```

Tier 0 collapses to one line — e.g. "errors logged via a console helper
with levels + a global error hook; no buffer, no copy affordance."
Tier 2 adds an `interactionId` per user action, recent network-failure
capture, User Timing marks/measures, and optional forward-to-server
(e.g. Vite `server.forwardConsole`).

### Quality gate example

The capability is required at every tier; the implementation scales.
`check` is non-mutating and CI-safe — auto-fix is a separate verb.

Tier 1 (typical dev-server app):

```markdown
| Script | Command | Purpose |
| --- | --- | --- |
| `check` | `npm run lint && npm run typecheck && npm test && npm run build` | The quality gate — run before calling a task done |
| `lint:fix` | `eslint . --fix` | Auto-fix (separate from the gate; never the CI pass/fail) |

- **Runs:** ESLint, `tsc --noEmit`, Vitest, and a production build.
- **Non-mutating:** `check` only reports; fixes live in `lint:fix` /
  `format`.
- **CI parity:** the CI workflow runs `npm run check`, so local green
  means CI green.
- **Omits:** Playwright e2e (slow) — runs pre-release, not in `check`.
```

Tier 0 collapses to a docs/static gate — e.g. "`check` = a CUSTOMISE /
placeholder scan + Markdown lint + a relative-link check." Tier 2 adds a
coverage threshold, automated accessibility checks (e.g. axe), and a
dependency/security audit, keeping slow suites out of `check`.

### Security baseline example

The capability is required at every tier; the implementation scales.
The secret scan is report-only and non-mutating, like the rest of
`check`. Do not restate the diagnostics-redaction rule — cross-reference
"Maintainer diagnostics".

Tier 1 (typical dev-server app):

```markdown
- **Secret storage:** runtime secrets in a gitignored `.env.secrets`
  sidecar; `.env` is composed from `.env.example` (placeholders,
  committed) + the sidecar. Never in source, URLs, logs, or diagnostics.
- **.gitignore:** `.env`, `.env.secrets`, `.env.*.local`.
- **Secret scan:** `check` greps tracked files for `sk-`, `AKIA`,
  `ghp_`, and PEM headers — report-only, dependency-free.
- **Dependency audit:** `npm audit` on every upgrade; approved pins held
  via `overrides`, never a blanket `--force`.
- **Leak response:** rotate at the provider first, replace in the
  sidecar, verify, then decide on history rewrite (usually skip once the
  key is dead). Record the decision in decision-log.md.
```

Tier 0 collapses to the `.gitignore` + `.env.example` placeholder
discipline plus the report-only key-shape grep in `check`. Tier 2 adds a
pre-commit secret scanner (named options — e.g. gitleaks, trufflehog —
not bundled), the dependency audit wired into CI, and a periodic
key-rotation note.

### Build system example

```markdown
- **Bundler:** esbuild (via custom `build.js`)
- **Entry point:** `src/main.js`
- **Output directory:** `docs/` (also serves as GitHub Pages root)
- **Format:** ESM, target ES2020
- **Source maps:** Enabled in both dev and production
- **Minification:** Production builds only
- **Static files:** `index.html`, `styles/*.css`, and `images/` are
  copied to the output directory by the build script.

The output directory is **read-only** — never hand-edit files in it.
They are overwritten on every build.
```

### Version management example

```markdown
Two parts: a product version (release name) and a build identity
(exact-code trace).

| Part | Format | Source | Updated | Example |
| --- | --- | --- | --- | --- |
| Product version | `vMAJOR.MINOR.PATCH` | `package.json` version field, tagged in git | Manually — MAJOR era/breaking, MINOR milestone, PATCH fix | `v0.3.0` |
| Build identity | `product+YYYYMMDD.shortsha` | Commit + date, injected at build | Automatically, every build | `v0.3.0+20260704.a1b2c3d` |

The product version answers "what release is this?"; the build identity
answers "exactly what code is live?". Git tags use the product version
(`v0.3.0`); the build identity tells apart multiple deploys of one
product version. Both are exposed in the diagnostics bundle
(`appVersion` / `buildId`). Start at `v0.1.0`; reserve `v1.0.0` for
"users can trust it". Do not hand-edit the generated build identity.
```

### Deployment example

```markdown
- **Target:** GitHub Pages (served from `docs/` on `main` branch)
- **Pipeline:** `npm run build:deploy` → builds to `dist/`, copies to
  `docs/`, ready to commit and push.
- **Post-deploy:** Verify the live URL serves the build identity just
  built (compare `buildId`).
```

### Utility scripts example

```markdown
- **`push.js`** — Runs a production build, stages all changes, commits
  with a version-stamped message, and pushes to the remote. Safe to
  run without review for routine commits. Does not force-push.
```

### Configuration strategy example

```markdown
- **Constants:** `src/config/constants.js` — all tuneable values
  grouped by domain.
- **Design tokens:** `styles/tokens.css` — CSS custom properties for
  colours, spacing, and theming.
- **Keybindings:** `src/config/keybindings.js` — all mouse and
  keyboard shortcuts.

Do not scatter configuration across service files.
```

### Editor config example

```markdown
The project root contains `.editorconfig` for mechanical style
enforcement: UTF-8, LF, 2-space indentation, trailing whitespace
trimmed (except in markdown), single quotes in JavaScript.
```

### Files agents must not hand-edit example

```markdown
- `docs/` — build output, overwritten on every build.
- `dist/` — intermediate build output.
- `version.json` — generated build identity; managed by the build
  script.
- `node_modules/` — managed by npm.
- `package-lock.json` — managed by npm. Do not edit manually, but
  do commit it.
```

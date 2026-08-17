# Changelog — 1.x epoch (archived)

Archived verbatim from `pm_skills/CHANGELOG.md` (CL-HORIZON,
4.5.0). Append-only history: never rewrite an entry here.
`prompts/upgrade.md` Step 2 walks this file when a project's
version gap starts in this epoch.

---

## 1.3.0 — 2026-05-31

Bakes in a lean, opinionated testing doctrine — invariant-led, with
named test categories — so testing is a first-class default alongside
Carbon, WCAG 2.2 AAA, Nielsen, and JSDoc. No new standard file, no
coverage threshold, no default security or performance tooling. Tool
names (Vitest, Playwright) live in the project layer, not the
always-read contract.

### Changed

- `AGENTS.md` (`root-template`) — rewrote the **Testing** section:
  tests protect invariants (not coverage); named categories with
  "not applicable" as a valid outcome; fast and hermetic; two layers;
  a softened anti-gaming rule (obsolete tests are updated through the
  approval gate, not silently weakened); no hollow tests; rigour ramps
  with maturity.
- `pm_skills/prompts/validation.md` — Stage 4 "test coverage" became a
  concrete test-plan gate over the named categories, with "not
  applicable" allowed per category.
- `pm_skills/init.md` — replaced the generic testing-policy ladder with
  the opinionated ramp (pre-invariant → safety net → journeys); names
  Vitest and Playwright as the JS/Node default. Step 6's testing item
  now keeps the doctrine and points project specifics to
  `conventions.md`.
- `pm_skills/project/conventions.md` — sharpened the Testing and Tooling
  template guidance (runner config and its reasons, e.g. sequential
  execution when tests mutate env or reset singletons; project
  invariants; default tools).
- `README.md`, `pm_skills/GUIDE.md` — added the testing doctrine to the
  stated defaults.

### Upgrade actions

- Replace `pm_skills/prompts/validation.md` and `pm_skills/init.md` with
  the new versions (`framework` — wholesale).
- In `AGENTS.md` (`root-template`, 3-way merge): if the project still
  has the default Testing section, replace it with the new doctrine; if
  the project customised its Testing section, leave it and offer the new
  doctrine for the user to adopt.
- `pm_skills/project/conventions.md` (`project-memory`): apply the
  improved template guidance only where the Testing/Tooling sections are
  still the unedited placeholders; never overwrite a project's filled-in
  policy.
- No memory migration required.

## 1.2.1 — 2026-05-31

Strengthen the wish-list promote step in `next-batch` so promoted items
are ranked relative to existing backlog items instead of appended
blindly, keeping the next-batch pick reading off a current order.

### Changed

- `pm_skills/prompts/next-batch.md` — promote step now requires placing a
  promoted item relative to existing Current/Next/Icebox items with a
  one-line above/below rationale. Makes `next-batch` the explicit (lazy,
  just-in-time) re-ranking point.

### Upgrade actions

- Replace `pm_skills/prompts/next-batch.md` with the new version. No
  memory migration; behavioural clarification only.

## 1.2.0 — 2026-05-31

Adds `init-mvp`: a guided-then-autonomous workflow that turns wants or
specs into a runnable first-milestone MVP. It marries the gated initializer
(`init-project.md`) with gateless execution (`auto-jazz.md`) — you sign off
the foundation, then it builds to completion — across the whole initial
development phase, with staged rollback checkpoints and a stop-and-narrow
rule for safety.

### Added

- `pm_skills/integrations/init-mvp.md` (`framework`) — gated foundation,
  then gateless build. Phase A is gated like `init-project.md`: it reads
  the interpretation back, then builds the foundation (brief, architecture,
  backlog, contracts, scaffold) and fixes the stack + dependency policy,
  ending at a foundation sign-off gate. Phase B then runs without gates:
  stands up a runnable skeleton and burns down the first milestone via the
  `auto-jazz` loop. Runs the standard four-stage approach at two altitudes
  (project-altitude gated, item-altitude gateless) — no extra design
  stages. Inherits the auto-jazz hard prohibitions plus two of its own: no
  building past the first milestone in one run, and a greenfield dependency
  rule (only deps the recorded architecture names are authorised).

### Changed

- `pm_skills/GUIDE.md` — adds a "New project, and you want the agent to
  build it?" pointer under Start here, the `init-mvp.md` entry in the
  integrations file tree, and the previously-missing `prune-memory.md`
  integration row alongside it.
- `pm_skills/init.md` — adds a "Prefer to let the agent build it?" callout
  pointing at the guided-then-autonomous path.
- `pm_skills/integrations/init-project.md` — cross-references the
  guided-then-autonomous variant.
- `README.md` — notes the guided-then-autonomous path in Quick start.

### Upgrade actions

- Create `pm_skills/integrations/init-mvp.md` from the source. It is a new
  `framework` file — nothing to preserve; copy it in.
- Overwrite these `framework` files with the source versions, after the
  Step 4 customisation check: `pm_skills/GUIDE.md`, `pm_skills/init.md`,
  `pm_skills/integrations/init-project.md`.
- `README.md`: most consuming projects keep their own root README — skip
  unless the project intentionally tracks the framework README.
- No `pm_skills/MANIFEST.md` change — `pm_skills/integrations/*` already
  classifies the new file as `framework`.
- No `project/` memory migrations.
- Bump `pm_skills/VERSION` to `1.2.0` (stamped by overwriting the framework
  `VERSION` file).
- Result: project is at **1.2.0**.

## 1.1.0 — 2026-05-30

Adds the wish-list: a cold-tier capture inbox for parking unscoped
ideas mid-task, with capture and triage rules plus the upgrade
handling needed to ship a brand-new project-memory file.

### Added

- `pm_skills/project/wish-list.md` (`project-memory`) — capture inbox
  for unscoped ideas. Cold tier (never auto-read); drained by triage
  into `backlog.md`. One line per idea; promote or cut at triage;
  soft cap ~25 open items.

### Changed

- `AGENTS.md` (`root-template`) — adds a "Capturing deferred ideas
  (wish-list)" section, a Cold read-tier entry, a memory-budget row,
  a Document-ownership update, and an anti-pattern.
- `pm_skills/prompts/next-batch.md` — adds a quick wish-list triage
  step (promote or cut) before picking the batch.
- `pm_skills/prompts/corrections.md` — adds a "Park it" capture
  trigger.
- `pm_skills/prompts/scoping.md` — routes worth-keeping out-of-scope
  items into the wish-list.
- `pm_skills/prompts/end-of-task.md` — counts open wish-list items in
  the size check and proposes triage (not archiving) when over budget.
- `pm_skills/prompts/prune-memory.md` — adds a wish-list action: drain
  by triage, never archive.
- `pm_skills/prompts/session-start.md` — lists the wish-list under
  Cold (do not auto-load).
- `pm_skills/prompts/upgrade.md` — Step 8 now creates a brand-new
  `project-memory` file from the template (never overwrites).
- `pm_skills/MANIFEST.md` — adds the `wish-list.md` → `project-memory`
  row.
- `pm_skills/GUIDE.md`, `pm_skills/init.md`,
  `pm_skills/integrations/init-project.md` — document the wish-list in
  the file tree, read tiers, memory-fresh table, and init notes.

### Upgrade actions

- Create `pm_skills/project/wish-list.md` from the source template. It
  is a new `project-memory` file — nothing to preserve. **Skip if it
  already exists; never overwrite.**
- Overwrite these `framework` files with the source versions, after
  the Step 4 customisation check: `pm_skills/prompts/next-batch.md`,
  `corrections.md`, `scoping.md`, `end-of-task.md`, `prune-memory.md`,
  `session-start.md`, `upgrade.md`, `pm_skills/GUIDE.md`,
  `pm_skills/init.md`, `pm_skills/integrations/init-project.md`,
  `pm_skills/MANIFEST.md`.
- 3-way merge `AGENTS.md` (`root-template`): add the "Capturing
  deferred ideas (wish-list)" section, the Cold read-tier bullet, the
  `wish-list.md` budget row, the Document-ownership update, and the
  anti-pattern. Preserve every populated section verbatim.
- Bump `pm_skills/VERSION` to `1.1.0` (stamped by overwriting the
  framework `VERSION` file).
- Result: project is at **1.1.0**.

## 1.0.0 — 2026-05-28

First versioned release. Establishes self-describing metadata so
upgrades become a short declarative read instead of a full-tree
forensic diff. Prior copies of pm-skills were unversioned; treat any
project without a `pm_skills/VERSION` file as pre-1.0.0.

### Added

- `pm_skills/VERSION` — single-line semver. The upgrade fast-path
  check reads this first.
- `pm_skills/CHANGELOG.md` — this file.
- `pm_skills/MANIFEST.md` — classifies every framework path as
  `framework`, `root-template`, `project-memory`, or `scaffold`, so
  an upgrade never has to infer whether a file is safe to overwrite.
- `pm_skills/prompts/release.md` — maintainer-side release checklist
  that keeps `VERSION`, this changelog, and the manifest in sync.

### Changed

- `pm_skills/prompts/upgrade.md` — rewritten to read `VERSION`,
  `CHANGELOG.md`, and `MANIFEST.md` first: check versions and stop if
  equal, apply only the documented deltas when behind, and fall back
  to a full diff only for pre-1.0.0 (unversioned) projects. Adds a
  defensive check that surfaces locally-customised framework files
  before overwriting them, and records source + version provenance.
- `pm_skills/GUIDE.md`, `README.md` — document versioning and the new
  upgrade flow.

### Upgrade actions

For a project on a pre-1.0.0 (unversioned) copy:

- Copy the four new framework files into the project's `pm_skills/`:
  `VERSION`, `CHANGELOG.md`, `MANIFEST.md`, `prompts/release.md`.
- Overwrite `pm_skills/prompts/upgrade.md` and `pm_skills/GUIDE.md`
  (both `framework` class — but first run the Step 4 customisation
  check; some projects added local sections such as "Shell safety").
- `README.md`: most consuming projects keep their own root README —
  skip unless the project intentionally tracks the framework README.
- No `project/` memory migrations.
- Result: project is at **1.0.0**.

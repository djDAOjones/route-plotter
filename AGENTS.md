# AI Agent Rules — Route Plotter

## Product identity

**Route Plotter** is a single-purpose animated route editor for maps and
images. Its canonical mental model is background image → waypoints →
animated path → export. It is not a GIS tool, drawing app, or general video
editor.

## Who you are working with

The maintainer is a novice coder who owns macro structure, UX direction, and
conceptual design, while relying on AI for implementation and project
management. Do the work; explain concepts only when asked. Comments should
make non-obvious data flow and fragile behaviour understandable.

## Durable context architecture

- This file is the shared agent contract. Codex loads it directly; Claude Code
  loads it through the root `CLAUDE.md`. Keep shared rules here and do not copy
  them into tool-specific files.
- `README.md` and the permanent project references describe the current
  product and engineering contracts.
- `pm_skills/project/` is the version-controlled, evolving project memory:
  current intent, architecture, conventions, queue, decisions, and file roles.
- Local Codex memories and Claude auto memory are recall aids only. They are
  generated, machine-local, and not authoritative. Move any fact that must
  survive across tools, machines, or contributors into its owned repository
  document through the normal end-of-task workflow.
- Do not create a second repository memory tree or duplicate existing project
  facts in `CLAUDE.md`, `.claude/`, `.codex/`, or ad hoc handover files.

## Before every task

Load only the tier the task needs so startup context stays useful.

### Hot whole-file

- `README.md`
- `pm_skills/project/brief.md`
- `pm_skills/project/architecture.md`
- `pm_skills/project/conventions.md`

### Hot sectional

- `pm_skills/project/file-map.md`: read the index and only the sections for
  directories the task touches; use the whole file only for cross-cutting work.
- `pm_skills/project/backlog.md`: read the Active section only.
- `pm_skills/project/decision-log.md`: scan the latest 10 headings and read only
  relevant entries. Search older entries only when the task needs them.

### Conditional

- Read `_Joe/dev notes/needs consolidating and deleting/dev guide.md` for code
  changes, debugging, persistence work, or fragile implementation areas.
- Read `UI-STANDARDS.md` for UI, controls, layout, text, states,
  accessibility, or user-facing behaviour.
- Read `DEV-INFRASTRUCTURE.md` for build, dev-server, versioning, scripts,
  configuration, or deployment work. At task close, read its quality-gate
  section even when the rest was not needed.

### Warm and cold

- `pm_skills/project/trajectory.md` is warm: read on demand when
  reconstructing shipped work, releasing, or maintaining memory.
- `pm_skills/project/wish-list.md`, `pm_skills/project/doc-deltas.md`,
  `pm_skills/project/archive/`, and `pm_skills/project/tickets/` are cold. Read
  them only in their named workflow; a ticket is read only when the active
  backlog item carries `[detail]`.
- Memory budgets live only in `pm_skills/memory-policy.md`. Read that file for
  task close or memory maintenance; never restate its numbers here.

## Workflow

1. For non-trivial work, follow `pm_skills/integrations/task.md`; its default
   mode is `checkpoint`. Use `full` for `[sign-off]` items or when requested.
   For bugs, follow `pm_skills/integrations/bugfix.md`. For small work, use the
   quick path in `pm_skills/prompts/quick-task.md`.
2. Search the full source tree before proposing changes. Check
   `src/config/constants.js` for tuneable values and `index.html` for existing
   controls before adding anything.
3. Close completed work through `pm_skills/prompts/end-of-task.md`. Update only
   the documents whose owned facts changed. Do not create narrative duplicates.
4. If another session may be writing, follow the claim and single-memory-writer
   procedure in `pm_skills/prompts/session-start.md` and
   `pm_skills/memory-policy.md`.

## Hard rules and invariants

- Waypoints store normalised `imgX` and `imgY` values (0–1). Convert through
  `CoordinateTransform`; never persist canvas pixels on a waypoint.
- EventBus is the only cross-component communication channel. Components emit
  events; the `RoutePlotter` orchestrator handles mutation.
- `InteractionHandler` owns one Pointer Events transaction for mouse, touch,
  and pen authoring. Do not add a competing canvas click/mouse/touch mutation
  path.
- Put all imports at the top of a file.
- Treat `docs/` as generated build output. Never hand-edit it.
- The only runtime dependencies are `jszip` and `mediabunny`. Do not add a
  package without explicit approval.
- Keep the Okabe-Ito map palette separate from UoN UI tokens. UI follows the
  project's Carbon-first, WCAG 2.2 AAA contract in `UI-STANDARDS.md`.
- Programmatic speed-slider updates use `ui:slider:update-speed`, never direct
  `.value` assignment.
- Stable paused editor and player views queue no animation frame. Active
  playback and visible camera settling may keep preview awake; export keeps its
  single explicit synchronous frame loop.
- Runtime recovery must remain one documented, ownership-safe command that
  verifies readiness, not merely process launch.
- Do not invent synonyms for existing EventBus events. Use the event catalogue
  in `README.md` and the relevant source definitions.

## Minimal change and documentation discipline

- Do not reorganise code or edit comments outside the requested surface.
- Match existing style: 2-space indentation, single quotes, and semicolons.
- Add an abstraction only when it reduces real duplication, isolates fragile
  logic, or has a clear reuse case.
- Explain why in comments; do not restate what the code says. Follow
  `pm_skills/project/conventions.md` for JSDoc and fragile-area guidance.
- When an out-of-scope idea arises, add one unjudged line to
  `pm_skills/project/wish-list.md` and continue. Triage, do not scope, it later.

## Testing and persistence

- Run the non-mutating canonical gate, `npm run check`, after changes. Never
  delete, skip, or weaken an existing test to obtain a pass.
- Add a focused test for new model methods, utilities, and regressions. Name
  any browser/device verification that remains manual.
- A persisted property needs a default, `toJSON()` and `fromJSON()` handling,
  inclusion in the canonical project snapshot, restore handling, and a
  save/reload round-trip test.

## Files agents must not hand-edit

- `docs/*` — generated build output
- `_Joe/*` — maintainer-owned notes and evidence
- `version.json` — build-managed version state
- `node_modules/*` — package-manager state

## Document ownership

- `AGENTS.md`: shared standing instructions and hard invariants.
- `CLAUDE.md`: minimal Claude-specific adapter only.
- `README.md`: product overview, current architecture, glossary, and gotchas.
- `UI-STANDARDS.md`: UI, accessibility, and usability rules.
- `DEV-INFRASTRUCTURE.md`: build, runtime, scripts, versioning, and deployment.
- `pm_skills/project/`: evolving shared brief, architecture, queue, decisions,
  and file roles.
- Local/auto memory: temporary tool-specific recall, never the shared source
  of truth.

When a fact changes, update its owner and link to it elsewhere rather than
restating it.

---
standard: Route Plotter house conventions — code style, naming, documentation, testing, patterns
source: project/digests/house-conventions.md and the engineering sections of AGENTS.md, frozen at 75ba7ae
version: 2026-10-01 (commit 75ba7ae)
retrieved: 2026-10-01
next-check: 2027-04-01
licence: the owner's; a house digest with a repository source
---
# House conventions — digest

The owner's own standards, carried verbatim from the canon record at the
v3 migration: the conventions file and the engineering rules the canon
contract stated for every change. Adopted in the profile and routed by
the rules file for every code change; a task that touches them names
the rule it applied at close (rule 8). Where the carried text named a
canon record path, it now names the v3 one (the wish-list, this digest);
section names it cites refer to the canon AGENTS.md at 75ba7ae, whose
engineering sections are carried below.

## Rules that bite here

### Code style

- 2-space indentation
- Single quotes
- Semicolons
- LF line endings
- 120 char max line length (JS/HTML/CSS), 80 for markdown
- Declared in `.editorconfig`: editors apply indentation and line endings,
  but no tool enforces the line lengths (there is no linter)

### Naming

- Files: PascalCase for classes/components (`Waypoint.js`,
  `RenderingService.js`), camelCase for utils (`focusTrap.js`)
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE (grouped objects in `constants.js`)
- CSS custom properties: kebab-case (`--map-series-1`,
  `--surface-primary`)
- Events: colon-separated namespaces (`waypoint:style-changed`)

### Patterns to follow

- The communication rule in `architecture.md` → Communication patterns
- `queueRender()` for deferred rendering (never call `render()`
  directly)
- `autoSave()` at end of state-mutating event handlers
- Waypoint factory methods (`createMajor()`, `createMinor()`) for
  creation
- `waypointsById` Map for O(1) lookups
- Batch mode (`beginBatch`/`endBatch`) for multi-waypoint operations

### Patterns to avoid

- Anything that rule forbids (see its list of current exceptions)
- Storing pixel coordinates on Waypoint (use normalised image coordinates)
- Setting slider `.value` directly (use `ui:slider:update-speed` event)
- Mid-file imports (esbuild requires all imports at top)
- Per-frame object allocations in render loop
- Installing Carbon packages (implement to Carbon spec instead)
- Collapsing Okabe-Ito and UoN token systems

### Minimal change and documentation discipline

- Do not reorganise code or edit comments outside the requested surface.
- Match existing style: 2-space indentation, single quotes, and semicolons.
- Add an abstraction only when it reduces real duplication, isolates fragile
  logic, or has a clear reuse case.
- Explain why in comments; do not restate what the code says. Follow
  `project/digests/house-conventions.md` for JSDoc and fragile-area guidance.
- When an out-of-scope idea arises, add one unjudged line to
  `project/wish-list.md` and continue. Triage, do not scope, it later.

### Testing and persistence

- Run the non-mutating canonical gate, `npm run check`, after changes. Never
  delete, skip, or weaken an existing test to obtain a pass. Re-pointing a
  test's import when code moves, with its assertions unchanged, is not
  weakening it.
- Add a focused test for new model methods, utilities, and regressions. Name
  any browser/device verification that remains manual.
- A persisted property needs a default, `toJSON()` and `fromJSON()` handling,
  inclusion in the canonical project snapshot, restore handling, and a
  save/reload round-trip test.

### Refactor contract (carried from the canon workflow rule)

- A refactor preserves `window.*` globals, DOM ids, EventBus event names and persisted formats; module exports may move, with test imports re-pointed.

## Checklist by task type

### Documentation

Permanent rules are in `AGENTS.md` § Minimal change and documentation
discipline. This section captures how they apply to this project:

- **Always document:** event chains across files, coordinate transform
  logic, animation timing calculations, serialisation format
  assumptions, H.264/WebCodecs constraints, WCAG requirement
  connections.
- **Skip JSDoc for:** trivial getters, obvious one-liners, simple
  event emissions.
- **Fragile areas requiring comments:** slider feedback loops,
  animation duration after reset, coordinate space conversions,
  WebCodecs backpressure, mediabunny codec naming.

### Testing

- Test runner: Vitest with jsdom; test roles are in `file-map.md` → tests
- Browser and device checks that automation cannot cover are named per task
  (`AGENTS.md` § Testing and persistence)
- After every change: `npm run check` (tests, shell contract and
  `build:check`). It is non-mutating; `npm run build` and `npm run dev`
  rewrite tracked `docs/` and `version.json`, so don't run them as a check

### Commit messages

Format: `<ITEM-ID>: summary`, naming the backlog item the commit closes or
advances (the shape `pm_skills/integrations/task.md` step 11 expects).

- Memory-only commits: `PM: summary`
- Deploy commits (written by `npm run push`): `chore: deploy vX.Y.Z`
- Body: one what/why line, then this repository's verify line:
  `Verify: <F> test files · <T> tests · shell 0 · build:check 0`. The gate
  has no lint or typecheck step, so never report one.

Examples:

- `REL-02: protect main against force-push and deletion`
- `PM: record four owner calls on the remaining queue`
- `chore: deploy v3.2.690`

### Tooling

- Bundler: esbuild (via custom `build.js`)
- Test runner: Vitest
- Formatter: `.editorconfig` (mechanical)
- Linter: none

## Exceptions recorded

- none yet; an exception is a decision in project/decisions.md

## Deeper references

- [The canon conventions file](../../project/digests/house-conventions.md), frozen at 75ba7ae
- The canon AGENTS.md's engineering sections are above; the whole file's obligations are traced row by row in [the census](../migration/census.md)
- [The project's rulebooks](../rules.md) — UI-STANDARDS.md and DEV-INFRASTRUCTURE.md are routed there

# Conventions

## Code style

- 2-space indentation
- Single quotes
- Semicolons
- LF line endings
- 120 char max line length (JS/HTML/CSS), 80 for markdown
- Declared in `.editorconfig`: editors apply indentation and line endings,
  but no tool enforces the line lengths (there is no linter)

## Naming

- Files: PascalCase for classes/components (`Waypoint.js`,
  `RenderingService.js`), camelCase for utils (`focusTrap.js`)
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE (grouped objects in `constants.js`)
- CSS custom properties: kebab-case (`--map-series-1`,
  `--surface-primary`)
- Events: colon-separated namespaces (`waypoint:style-changed`)

## Commit messages

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

## Documentation

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

## Testing

- Test runner: Vitest with jsdom; test roles are in `file-map.md` → tests
- Browser and device checks that automation cannot cover are named per task
  (`AGENTS.md` § Testing and persistence)
- After every change: `npm run check` (tests, shell contract and
  `build:check`). It is non-mutating; `npm run build` and `npm run dev`
  rewrite tracked `docs/` and `version.json`, so don't run them as a check

## Patterns to follow

- The communication rule in `architecture.md` → Communication patterns
- `queueRender()` for deferred rendering (never call `render()`
  directly)
- `autoSave()` at end of state-mutating event handlers
- Waypoint factory methods (`createMajor()`, `createMinor()`) for
  creation
- `waypointsById` Map for O(1) lookups
- Batch mode (`beginBatch`/`endBatch`) for multi-waypoint operations

## Patterns to avoid

- Anything that rule forbids (see its list of current exceptions)
- Storing pixel coordinates on Waypoint (use normalised image coordinates)
- Setting slider `.value` directly (use `ui:slider:update-speed` event)
- Mid-file imports (esbuild requires all imports at top)
- Per-frame object allocations in render loop
- Installing Carbon packages (implement to Carbon spec instead)
- Collapsing Okabe-Ito and UoN token systems

## Tooling

- Bundler: esbuild (via custom `build.js`)
- Test runner: Vitest
- Formatter: `.editorconfig` (mechanical)
- Linter: none

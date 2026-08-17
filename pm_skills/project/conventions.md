# Conventions

## Code style

- 2-space indentation
- Single quotes
- Semicolons
- LF line endings
- 120 char max line length (JS/HTML/CSS), 80 for markdown
- Enforced by `.editorconfig`

## Naming

- Files: PascalCase for classes/components (`Waypoint.js`,
  `RenderingService.js`), camelCase for utils (`focusTrap.js`)
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE (grouped objects in `constants.js`)
- CSS custom properties: kebab-case (`--map-series-1`,
  `--surface-primary`)
- Events: colon-separated namespaces (`waypoint:style-changed`)

## Commit messages

Format: `type(scope): description`

Types: `feat`, `fix`, `refactor`, `style`, `chore`, `test`, `docs`

Examples:

- `feat(area): add polygon area highlights`
- `fix(animation): correct duration after reset`
- `chore: deploy v3.1.530`

## Documentation

Permanent rules are in `AGENTS.md` § Code documentation. This section
captures how they apply to this project:

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

- Test runner: Vitest with jsdom
- Unit tests cover: Waypoint, AnimationState, PathCalculator,
  CoordinateTransform, EventBus, Easing, CatmullRom
- Integration testing: manual browser verification
- After every change: `npm run build` + `npm test`

## Patterns to follow

- EventBus for all cross-component communication
- `queueRender()` for deferred rendering (never call `render()`
  directly)
- `autoSave()` at end of state-mutating event handlers
- Waypoint factory methods (`createMajor()`, `createMinor()`) for
  creation
- `waypointsById` Map for O(1) lookups
- Batch mode (`beginBatch`/`endBatch`) for multi-waypoint operations

## Patterns to avoid

- Direct method calls between components (use EventBus)
- Storing pixel coordinates on Waypoint (use normalised 0–1)
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

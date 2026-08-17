# Conventions

## Code style

- **2-space indentation** everywhere (JS, HTML, CSS, JSON). See `.editorconfig`.
- **Single quotes** in JS. No semicolons omission — semicolons required.
- **LF line endings**, UTF-8 charset, final newline.
- **120-char max line length** for JS, HTML, CSS. **80-char** for markdown.
- **JSDoc comments** on exported classes and public methods (see EventBus.js as reference).
- **ES module syntax** — `import`/`export`, no CommonJS.
- No linter or formatter tool configured — style enforced by `.editorconfig` and convention.

## Naming

- **Files:** PascalCase for classes (`GraphNode.js`, `EventBus.js`), camelCase for utilities and configs (`constants.js`, `focusTrap.js`).
- **Classes:** PascalCase (`GraphNode`, `SwarmEngine`).
- **Methods and variables:** camelCase (`addNode`, `edgeWeight`).
- **Constants objects:** UPPER_SNAKE_CASE (`ANIMATION`, `RENDERING`, `VIDEO_EXPORT`).
- **Events:** colon-separated namespaces, lowercase (`graph:node:added`, `ui:controls:change`).
- **CSS custom properties:** Carbon-aligned structural tokens use `--space-`, `--text-`, `--control-`, `--ui-`, `--border-`, `--radius-`, `--motion-`, `--elev-` prefixes. UoN brand uses `--uon-`. Okabe-Ito map palette uses `--map-series-`. See `UI-STANDARDS.md` for full rules.

## Commit messages

No formal convention established yet. Keep messages short and descriptive.

## Testing

- **Framework:** Vitest (with jsdom for DOM tests).
- **Test location:** `tests/` directory at project root.
- **What gets tested:** All model classes (`toJSON`/`fromJSON` round-trips, CRUD operations), utility functions, EventBus integration.
- **Bar:** Every new model method or utility function must have a corresponding test.
- **Run:** `npm test` (single run), `npm run test:watch` (watch mode).

## Patterns to follow

- **EventBus for all cross-module communication.** No direct method calls between modules.
- **Normalised coordinates** for all stored positions. Canvas coordinates only at render time via CoordinateTransform.
- **`toJSON`/`fromJSON`** on every model class. Fallback defaults in `fromJSON` for forward compatibility.
- **Constructor defaults** for every persistent property.
- **Autosave integration** for any new persistent state — hook into StorageService.
- **Undo integration** for any user-facing mutation — hook into UndoService.
- **Constants in `src/config/constants.js`** — all tuneable values centralised, never hard-coded inline.

## Patterns to avoid

- Direct method calls between UI, renderer, and model layers.
- Importing Carbon npm packages — implement to Carbon spec instead.
- Hard-coded pixel values for positions (use normalised coords).
- Mid-file imports.
- New runtime dependencies without approval.
- Inventing new abstractions for a single use case.

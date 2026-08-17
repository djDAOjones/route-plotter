> **Provenance:** archived verbatim from djDAOjones/dot-crowd-navigator (AGENTS.md, HEAD f99f0ab,
> last push 2026-04-13) when the fork was folded into Route Plotter v3 on 2026-08-17.
> This is the swarm/graph feature vocabulary and subsystem spec — NOT the live agent
> rulebook of this repo (see root AGENTS.md). Its "no linear routes" invariant is
> superseded by the layered-scene decision (decision-log 2026-08-17).

# AI Agent Rules

## Product identity

**Dot Crowd Navigator** — a graph-based crowd-flow simulation tool.
Users draw a network of nodes and weighted edges over a background
image (map or venue plan), then run a swarm of animated dots through
that network to visualise pedestrian or crowd flow patterns.

The canonical mental model is **graph + swarm**: nodes are junctions,
edges are routes with weights and direction, and the simulation sends
dots through the network proportional to edge weights.

This is **not** Route Plotter. Route Plotter was "one route, one
timeline, one animated head." Dot Crowd Navigator is "a route network
with many moving agents." Do not reference waypoints, beacons, camera
keyframes, or motion visibility — those concepts do not exist here.

---

## Who you are working with

The maintainer is a vibe coder who owns macro structure, UX direction,
and conceptual design — but not deep implementation. Do the work; don't
explain concepts back unless asked.

---

## Before every task

1. Read `README.md` (architecture, key infrastructure, invariants,
   gotchas).
2. Read `UI-STANDARDS.md` for any task that touches UI, controls,
   layout, text, states, accessibility, or user-facing behaviour.
3. Run the `/feature-scoping` workflow before implementing anything
   non-trivial. Get user sign-off on scope before writing code.
4. Search the full source tree before proposing changes. Check for
   existing tuneable values and UI controls before adding new ones.

---

## Hard rules (invariants)

These apply unconditionally to every change.

- **All imports at the top of the file.** Mid-file imports break
  bundlers.
- **Build output directories are read-only.** Never hand-edit files
  that are overwritten by the build step.
- **Minimal runtime dependencies.** Do not add packages without
  explicit approval.
- **Carbon-first UI.** All UI work must follow IBM Carbon's productive
  design language: components, patterns, tokens, spacing, and
  interaction conventions. Carbon is the reference standard for how
  controls should look, behave, and be structured — but implemented in
  the project's own code, not via Carbon packages. See
  `UI-STANDARDS.md` for full rules.
- **WCAG 2.2 AAA by default.** 7:1 text contrast for normal text,
  ≥ 44 × 44 CSS px pointer targets, visible focus rings, no
  colour-only meaning. Where Carbon defaults meet AA but not AAA,
  adapt them. See `UI-STANDARDS.md` for full accessibility rules.

- **Normalised coordinates for all stored positions.** Node and
  control point positions are stored as fractions of image dimensions
  (0.0–1.0). Canvas pixel coordinates are derived at render time via
  `CoordinateTransform`. Never store pixel positions.
- **EventBus-only cross-module communication.** No direct method calls
  between UI, renderer, and model layers. Modules import only EventBus
  and their own data models.
- **Three token systems, never collapsed.** Carbon-aligned structural
  (`--space-`, `--text-`, `--control-`, `--ui-`, `--border-`, `--radius-`,
  `--motion-`, `--elev-`), UoN brand (`--uon-`), and Okabe-Ito map
  palette (`--map-series-`) serve different purposes. All defined in
  `tokens.css`. Do not merge them. See `UI-STANDARDS.md` for full rules.
- **Graph model is the single source of truth.** All graph state lives
  in `GraphModel`. Renderers and UI read from it via events. Never
  cache graph state in a renderer or controller.

---

## Core data model

The canonical model is:

- **`GraphNode`** — `id`, normalised position (`x`, `y`), type
  (`normal` | `entry` | `exit`), label config, visual state.
- **`GraphEdge`** — `id`, `sourceId`, `targetId`, `weight` (positive
  number), `direction` (`one-way` | `two-way`), control points array,
  cached path geometry.
- **`GraphModel`** — Collection of nodes and edges. CRUD, adjacency
  queries, full serialisation via `toJSON`/`fromJSON`.
- **`SimulationState`** (Phase 2) — Dot count, release period, onset
  variance, speed variance, intensity ramp, lifecycle mode.

Do **not** introduce `Waypoint`, `AnimationState`, or any linear-route
abstraction. The graph model is not ordered — edges define
connectivity, not sequence.

---

## Domain subsystems

### Graph editing subsystem (Phase 1)

- **Owner:** `GraphModel` (state), `GraphInteractionHandler` (input),
  `GraphRenderer` (output), `GraphUIController` (sidebar).
- **Contract:** All mutations go through `GraphModel` methods.
  `GraphModel` emits events. Renderer and UI subscribe to events.
  No renderer writes to model. No UI writes to model directly.

### Swarm simulation subsystem (Phase 2)

- **Owner:** `SimulationState` (config), `SwarmEngine` (logic),
  `DotRenderer` (output).
- **Contract:** `SwarmEngine` reads from `GraphModel` (edges, weights,
  entry/exit nodes) but never mutates it. Simulation parameters live
  in `SimulationState`. Rendering is separated from simulation logic
  for performance — `SwarmEngine` produces dot positions,
  `DotRenderer` paints them.

---

## Relationship to Route Plotter

Dot Crowd Navigator was forked from Route Plotter. The relationship is
"same shell, different core."

**Keep:** EventBus, CoordinateTransform, StorageService, UndoService,
PathCalculator (adapted for per-edge use), CatmullRom, Easing,
SwatchPicker, Dropdown, Tooltip, focusTrap, tokens.css, build pipeline,
test setup, background image workflow.

**Reject:** Waypoint model, AnimationState, AnimationEngine,
RenderingService, CameraService, BeaconRenderer,
MotionVisibilityService, HTMLExportService, ImageAssetService, Area
services. These are Route Plotter-specific and have no equivalent in
Dot Crowd Navigator.

**Legacy mental models that are NOT canonical:**
- "One ordered route" — replaced by an unordered graph.
- "One animated path head" — replaced by a swarm of dots.
- "Progress 0.0–1.0 along a single path" — replaced by per-dot
  position on per-edge paths.
- "Waypoint as the fundamental entity" — replaced by GraphNode.

---

## Protected infrastructure

| Module | Role | Notes |
| --- | --- | --- |
| `src/core/EventBus.js` | All cross-module communication | Do not modify API |
| `src/services/CoordinateTransform.js` | Normalised ↔ canvas coords | Core to all rendering |
| `src/services/StorageService.js` | Autosave + save/load | Serialisation contract |
| `src/services/UndoService.js` | Undo/redo stack | Used by all mutations |
| `src/utils/CatmullRom.js` | Spline math | Shared by path systems |
| `styles/tokens.css` | Design token definitions | Three token systems |
| `build.js` | esbuild build script | Build + dev server |

Do not delete, rename, or restructure protected modules without
explicit approval.

---

## Event naming convention

Use colon-separated namespaces for all events. The established
namespaces are:

- `graph:node:added` / `:moved` / `:deleted` — graph node mutations.
- `graph:edge:added` / `:updated` / `:deleted` — graph edge mutations.
- `graph:selection:changed` — user selected a node or edge.
- `ui:controls:change` — a UI parameter changed.
- `sim:swarm:start` / `:tick` / `:end` — simulation lifecycle.
- `export:video:progress` / `:complete` — video export status.
- `app:project:loaded` — full state refresh after load.
- `app:background:changed` — background image loaded.

Keep namespaces consistent. Do not create synonyms for existing event
names. New events must follow the `domain:entity:action` pattern.

---

## UI, usability, and accessibility (summary)

Full rules are in `UI-STANDARDS.md`. Read that file for any task that
touches UI. The key principles are:

- **Carbon is the reference standard.** Follow Carbon's productive
  design language for all controls, layout, spacing, and interaction.
  Implement to Carbon's spec, not via Carbon packages.
- **WCAG 2.2 AAA by default, exceptions documented.** 7:1 contrast,
  44 px targets, keyboard operability, no colour-only meaning, visible
  focus, semantic HTML first.
- **Nielsen heuristics are hard rules, not aspirations.** Visibility of
  status, user control and freedom, consistency, error prevention,
  recognition over recall, flexibility, minimalist design, error
  recovery, and contextual help all apply to every UI change.
- **Design review gate.** Every UI-affecting change must pass the
  checklist in `UI-STANDARDS.md` before sign-off.

---

## Minimal change discipline

- Don't reorganise code you weren't asked to touch.
- Don't add or remove comments unless instructed.
- Don't introduce new abstractions for a single use case.
- Match existing style (indent size, quote style, semicolons, etc.).
- Avoid speculative abstractions unless there is duplication, unstable
  logic, or a clear reuse case.

---

## Testing

- Run the full build and test suite after every change.
- Never delete or weaken existing tests.
- Add a test for any new model method or utility function.

---

## Files to never edit

- `docs/` — GitHub Pages build output (generated by `npm run build:deploy`).
- `dist/` — esbuild production output (generated by `npm run build`).
- `_Joe/` — Personal developer notes, design docs, and helper scripts.
- `ai_project_manager_kickstart/prompts/` — Reusable prompt templates (read-only reference).
- `ai_project_manager_kickstart/index.html` — Kickstart landing page (not part of the app).

---

## Persistence checklist

When adding any property that should survive reload:

1. Default in constructor (relevant model class).
2. Include in serialisation (`toJSON()` or equivalent).
3. Handle in deserialisation (`fromJSON()` or equivalent) with fallback
   default.
4. Serialise in auto-save.
5. Restore in load/auto-load.

---

## Anti-patterns to reject

If you find yourself doing any of these, stop and reconsider:

- Communicating between components by direct method calls instead of
  the project's established messaging pattern.
- Inventing a custom UI control when Carbon provides a suitable pattern.
- Installing Carbon packages instead of implementing to Carbon's spec.
- Using AA contrast thresholds when AAA (7:1) is required.
- Leaving a panel, state, or error condition without an intentional,
  visible, accessible treatment.
- Hard-coding values that should be tokenised or configurable.
- Adding runtime dependencies without explicit approval.

- Treating graph nodes as if they have an implicit order (they don't —
  the graph is unordered).
- Using Route Plotter's `Waypoint`, `AnimationState`, or
  `AnimationEngine` as a design reference for new code.
- Collapsing the three token systems (Carbon structural, `--uon-`,
  `--map-series-`) into one.
- Storing canvas pixel positions instead of normalised coordinates.
- Caching graph state in renderers or controllers — read from
  `GraphModel` via events.

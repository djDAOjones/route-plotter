# Decision Log

<!-- Append new decisions at the top. Don't edit old entries. -->
<!-- Use this during the design phase of each task to record what you chose and why. -->

## 2026-05-03 — Clean app shell + graph interaction (Phases 0B/1B/1C/1D/1E)

**Decision:** Replace the 6065-line legacy `main.js` and 853-line `index.html`
with clean, minimal versions (~400 and ~180 lines respectively) that only
import retained infrastructure + new graph modules. Legacy files preserved
as `main_legacy.js` / `index_legacy.html` for reference.

**Rationale:** The old main.js was deeply entangled with Route Plotter's
Waypoint/AnimationEngine/RenderingService code. Surgical removal would be
more fragile and slower than writing a clean shell. The new main.js
imports only: EventBus, CoordinateTransform, StorageService, UndoService,
GraphModel, GraphRenderer, GraphInteractionHandler, GraphUIController.

**New files created:**
- `src/handlers/GraphInteractionHandler.js` — Click/drag/shift-click/
  delete/double-click for graph editing.
- `src/controllers/GraphUIController.js` — Sidebar panels for node/edge
  properties with type/weight/direction controls.

**Files modified:**
- `src/services/GraphRenderer.js` — Added selection highlighting (ring
  for nodes, wider stroke for edges), type badges (E/X letters inside
  entry/exit nodes), and direction arrowheads for one-way edges.
- `src/models/GraphModel.js` — Added `clear()` and instance `fromJSON()`
  methods. Fixed destructuring-in-for-of for build target compatibility.
- `build.js` — Updated esbuild target from chrome58/firefox57/safari11
  to chrome90/firefox90/safari15. The old target caused build failures
  with destructuring syntax used throughout the codebase.

**Persistence:** Autosave uses coordVersion 8 (graph-only JSON). Old
Route Plotter autosave data (versions ≤ 7) is detected and cleared.
Save/load uses plain JSON files (not ZIP as before).

**Build result:** 47.92 KB bundle. 25/25 GraphModel tests pass.

## 2026-04-16 — Replace ai_project_manager_kickstart with PM Skills

**Decision:** Migrate from the original `ai_project_manager_kickstart`
framework to its successor, [PM Skills](https://github.com/djDAOjones/PM-Skills).
PM Skills adds `DEV-INFRASTRUCTURE.md` (build/dev/deploy rules),
a `Code documentation` section in AGENTS.md, a `Document ownership`
table, Active/Completed backlog structure, a bug-scoping prompt,
and richer Windsurf workflows (`/feature`, `/bugfix`, `/init-project`).

**Changes:** Deleted `ai_project_manager_kickstart/`. Copied `pm_skills/`
in its place. Migrated all populated project memory files. Rebuilt
`AGENTS.md` on the new template with all DCN content preserved.
Created and populated `DEV-INFRASTRUCTURE.md`. Installed three
Windsurf workflows. Removed old `feature-scoping.md` workflow.
Updated all internal path references.

## 2026-04-14 — GraphRenderer + minimal app integration

**Decision:** Wire graph rendering into the existing render pipeline
with the smallest possible touch. `GraphRenderer` is stateless —
receives `GraphModel`, `imageToCanvas`, and `CoordinateTransform` per
frame via `renderState`. Graph layer draws under all legacy content in
`renderVectorLayerTo()`, guarded so existing behaviour is unchanged
when graph is empty. Dev seed graph (3 nodes, 3 edges) gated behind
`if (true)` flag for easy removal.

**Files added:** `src/services/GraphRenderer.js`
**Files changed:** `src/main.js` (+2 imports, +2 constructor lines,
+6 dev seed, +2 renderState props), `src/services/RenderingService.js`
(+4 lines guarded call).

## 2026-04-13 — Implement GraphModel collection

**Decision:** Create `GraphModel` as a pure data collection owning
nodes and edges via `Map`. Enforces referential integrity:
`addEdge` validates source/target exist (throws otherwise),
`removeNode` cascade-deletes connected edges. `fromJSON` silently
drops edges with dangling references for defensive loading.
All getters return snapshot arrays.

**Files added:** `src/models/GraphModel.js`, `tests/GraphModel.test.js`
(22 tests, all green). Phase 1A data model layer is now complete.

## 2026-04-13 — Implement GraphEdge model

**Decision:** Create `GraphEdge` as a pure data model requiring
`sourceId` and `targetId` (throws on missing). Weight clamped to
≥ 0.01, direction validated to `one-way` | `two-way`, control points
clamped to 0–1. Follows same patterns as GraphNode: prefixed IDs
(`ge_`), `toJSON`/`fromJSON` with fallback defaults, static helpers.

**Files added:** `src/models/GraphEdge.js`, `tests/GraphEdge.test.js`
(23 tests, all green).

## 2026-04-13 — Implement GraphNode model

**Decision:** Create `GraphNode` as a pure data model with no EventBus
dependency. Follows Waypoint's serialisation pattern (`toJSON`/`fromJSON`
with fallback defaults) but uses the graph-first design:
normalised coords clamped to 0–1, validated `type` enum, auto-generated
prefixed IDs (`gn_`).

**Files added:** `src/models/GraphNode.js`, `tests/GraphNode.test.js`
(14 tests, all green).

## 2026-04-13 — Reality-sync project memory with codebase

**Decision:** Audit and correct all kickstart project memory files to
match the actual codebase state.

**Findings:** Phase 0 was overclaimed as done. 10 legacy service files,
3 legacy models, 2 controllers, 1 handler, and 1 worker were marked as
"removed" but still exist. `main.js` still says "Route Plotter".
PathCalculator and TextLabelService were marked as "adapted" but
haven't been touched. Token prefix `--cds-` was referenced but doesn't
exist in `tokens.css`.

**Changes made:**
- Split Phase 0 into 0A (done) and 0B (pending legacy cleanup).
- Fixed architecture.md: "removed" → "still present, to be removed".
- Fixed file-map.md: same correction, added 5 missing files.
- Fixed AGENTS.md + conventions.md: corrected token prefix references,
  changed "Two token systems" to "Three token systems".
- Collapsed redundant 1F cleanup tasks into Phase 0B.

## 2026-04-12 — Adopted ai_project_manager_kickstart framework

**Decision:** Adopt the AI Project Manager Kickstart framework for
structured project management with AI coding assistants.

**Rationale:** The project is transitioning from Route Plotter to a
fundamentally different domain model (graph + swarm). A structured
framework ensures consistent context across AI sessions, prevents
drift, and provides a clear backlog and decision trail.

**Alternatives considered:**
- Ad-hoc prompting: simpler but loses context between sessions.
- Full PM tool (Linear, Jira): overkill for a solo vibe-coded project.

## 2026-04-12 — Fork Route Plotter as Phase 0 foundation

**Decision:** Fork Route Plotter codebase, strip domain-specific
features, retain generic infrastructure as the foundation for Dot
Crowd Navigator.

**Rationale:** Route Plotter's EventBus, CoordinateTransform,
StorageService, UndoService, Canvas 2D render loop, build/test/deploy
pipeline, path math, and accessibility infrastructure are all mature
and directly reusable. Starting from scratch would rewrite ~2 years of
tested code for no benefit.

**What was kept:** EventBus, CoordinateTransform, StorageService,
UndoService, PathCalculator, CatmullRom, Easing, SwatchPicker,
Dropdown, Tooltip, focusTrap, tokens.css, build.js, test setup.

**What was removed:** Beacon rendering, motion visibility modes, camera
keyframes, area highlight editing, custom image asset system, HTML
export scaffolding.

**What will be replaced:** Waypoint → GraphNode, AnimationState →
SimulationState, AnimationEngine → SwarmEngine, RenderingService →
GraphRenderer, InteractionHandler → GraphInteractionHandler,
UIController → GraphUIController.

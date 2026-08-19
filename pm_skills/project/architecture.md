# Architecture

## Tech stack

| Technology | Reason |
| --- | --- |
| Vanilla JavaScript (ES modules) | No framework overhead, full Canvas API control |
| Canvas 2D | Direct pixel manipulation for path rendering and animation |
| esbuild | Fast bundling, simple config, ESM output |
| Vitest + jsdom | Unit testing with DOM simulation |
| mediabunny | MP4/WebM mux layer (only runtime dependency) |
| CSS custom properties | Design tokens for theming (UoN + Okabe-Ito) |

## Project structure

```text
src/
  main.js              — RoutePlotter class: app entry point and orchestrator core
  app/                 — RoutePlotter prototype mixins (wiring, playback, undo/redo, camera,
                         viewport, path timing, persistence, exporting, editor panel, pointer)
  config/              — constants, keybindings, help content, tooltips
  core/                — EventBus (pub-sub), PlayerCore (pure timeline math)
  models/              — Waypoint, AnimationState, ImageAsset + scene model (Scene → FlowLayer → GraphModel/GraphNode/GraphEdge + Emitter)
  services/            — single-responsibility services (18 modules)
  controllers/         — UIController, SectionController
  components/          — SwatchPicker, Dropdown, Tooltip, ParamTooltip
  handlers/            — InteractionHandler (mouse, keyboard, touch, DnD)
  utils/               — CatmullRom, Easing, focusTrap
styles/                — tokens.css, main.css, swatch-picker.css, dropdown.css, tooltip.css
specs/                 — archived dot-crowd-navigator material (spec, memory, salvaged tests/src) for Phases 2–4
tests/                 — Vitest unit tests
```

(The former `workers/` layer was deleted 2026-06-18 — it never initialised
under the old esbuild targets; see the v2 decision-log entry. es2022 targets
re-legalise workers if ever needed again.)

## v3 direction (founded 2026-08-17)

Layered scene over one master timeline: the Waypoint chain remains the
"hero route" layer; **flow layers** (GraphModel guide networks + emitters)
add crowd/particle animation. Everything renders as a pure function of
(timelineMs, projectState, seed) — the deterministic-timeline mandate,
implemented since Phase 1 (2026-08-17) by **`src/core/PlayerCore.js`**: it
builds the timeline (segments, exact pause budgets, beacon schedules) and
evaluates any instant with no wall-clock reads or mutation. AnimationEngine
is transport + events; beacons are closed-form in timeline time; play,
scrub, and export share the one evaluation path (golden harness:
`tests/goldenFrames.test.js`). Since Phase 5 (2026-08-19) the HTML
export runs the same stack: `src/player/PlayerApp.js` (bundled to
`docs/player.js`, inlined into exports) hydrates the coordVersion-9
snapshot, recomputes timing in the snapshot's `timingReference` space
to preserve the authored timeline, and renders at export resolution
with the app's own services (cross-check: `tests/playerApp.test.js`).
The scene data model landed in Phase 2 (2026-08-18): `Scene` →
`FlowLayer` (guide graph or hero route + `Emitter`s with per-emitter
seeds and normalised release windows), persisted additively as the
coordVersion 9 `scene` block. Phases and rationale: backlog +
decision-log 2026-08-17/18.

## Key modules

| Module | Path | Responsibility |
| --- | --- | --- |
| RoutePlotter | `src/main.js` + `src/app/*` | Sole orchestrator: owns all services, handles all events, manages state. Method groups live as prototype mixins in `src/app/*` (Object.assign; names unique across mixins) |
| Waypoint | `src/models/Waypoint.js` | Data model for waypoints (position, style, camera, area, etc.) |
| AnimationEngine | `src/services/AnimationEngine.js` | Playback loop, timing, segment speed, pause markers |
| PathCalculator | `src/services/PathCalculator.js` | Catmull-Rom spline, reparameterisation, curvature |
| RenderingService | `src/services/RenderingService.js` | Canvas drawing: path, markers, labels, overlays |
| UIController | `src/controllers/UIController.js` | Sidebar controls, waypoint list, slider sync |
| InteractionHandler | `src/handlers/InteractionHandler.js` | Mouse, keyboard, touch, drag-and-drop input |
| CoordinateTransform | `src/services/CoordinateTransform.js` | Image ↔ canvas coordinate conversion |
| VideoExporter | `src/services/VideoExporter.js` | MP4/WebM export via WebCodecs |

## Communication patterns

**EventBus (pub-sub)** is the only communication channel between
components. UIController and InteractionHandler emit events; `main.js`
handles them. No direct method calls between components.

Exceptions: none. This is a hard rule.

## Dependency policy

- **Two bundled runtime dependencies: mediabunny and jszip** (jszip
  bundled 2026-08-17, replacing a runtime CDN load). No new runtime
  packages without explicit approval.
- Dev dependencies (esbuild, vitest, jsdom) are established.

## Dev workflow

- Install: `npm install`
- Dev: `npm run dev` → http://localhost:3000
- Build: `npm run build` → output in `docs/`
- Test: `npm test` (Vitest)
- Deploy: `npm run push`

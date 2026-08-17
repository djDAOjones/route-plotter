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
  main.js              — RoutePlotter class: app entry point and orchestrator
  config/              — constants, keybindings, help content, tooltips
  core/                — EventBus (pub-sub)
  models/              — Waypoint, AnimationState, ImageAsset
  services/            — single-responsibility services (18 modules)
  controllers/         — UIController, SectionController
  components/          — SwatchPicker, Dropdown, Tooltip, ParamTooltip
  handlers/            — InteractionHandler (mouse, keyboard, touch, DnD)
  utils/               — CatmullRom, Easing, focusTrap
  workers/             — pathWorker (off-thread path calculation)
styles/                — tokens.css, main.css, swatch-picker.css, dropdown.css, tooltip.css
tests/                 — Vitest unit tests
```

## Key modules

| Module | Path | Responsibility |
| --- | --- | --- |
| RoutePlotter | `src/main.js` | Sole orchestrator: owns all services, handles all events, manages state |
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

- **One runtime dependency: mediabunny.** No new runtime packages
  without explicit approval.
- Dev dependencies (esbuild, vitest, jsdom) are established.

## Dev workflow

- Install: `npm install`
- Dev: `npm run dev` → http://localhost:3000
- Build: `npm run build` → output in `docs/`
- Test: `npm test` (Vitest)
- Deploy: `npm run push`

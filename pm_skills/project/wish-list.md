# Wish-list

<!-- Capture inbox for unscoped ideas. Append one line; no structure required. -->
<!-- Cold tier. Agents NEVER auto-read this file. Read it only during an
     explicit triage pass — session-start.md (Start B), or end-of-task.md /
     memory-maintenance.md when the size check flags it. See AGENTS.md -> "Before every task". -->
<!-- Boundary: this is PRE-triage — raw, unjudged ideas. The backlog Icebox
     is POST-triage — ideas already judged worth keeping. Promote items INTO
     backlog.md (Current, Next, or Icebox); never treat this as a second backlog. -->
<!-- Triage = promote or cut. Promoting MOVES the item into backlog.md. Cutting
     DELETES the line. No history is kept here — survivors live in the backlog. -->
<!-- Format: one plain bullet per idea, optionally a source. Append at the
     bottom; triage from the top. Example:
     - Idea in one line — (from: 2026-05-30 task) -->
<!-- Over the soft cap set in pm_skills/memory-policy.md, end-of-task flags
     it and memory-maintenance.md runs a forced triage pass (not an archive). -->

## Open

- Per-leg spline tension under Leg → More if ever wanted — per-waypoint segmentTension was retired unread; PathCalculator would need to consume it. — (from: 2026-08-18 Phase 3.5)
- Crowd editing extras still outside the roadmap: multi-emitter authoring (cards edit `emitters[0]` only) and strip drag-reorder via `Scene.moveFlowLayer`. Seed re-roll and release/intensity shaping moved to CROWD-02/CROWD-03 on 2026-08-26. — (from: 2026-08-18 Phase 4 layers strip)
- Network extras after REV-03: click-on-edge splits it with a node, node labels/rename, arrow-key nudge and a network context menu. Edge-weight visualisation moved to CROWD-01 on 2026-08-26. — (from: 2026-08-18 Phase 4 network edit)
- Mode banners are near-duplicates (area draw + network edit both inline-style their own) — extract a shared ModeBanner component. — (from: 2026-08-18 Phase 4 network edit)
- `pm_skills/scaffold/gen-file-map.mjs` silently drops wrapped role descriptions — it keeps only the first line of a multi-line entry, so re-running it flattened six `reviews/` roles to "(role needed)". — (from: 2026-08-27 UI-02)
- `npm run dev` leaves `docs/player.js.map` behind: the watch build emits a player sourcemap the production build's 17-file inventory does not, so the generated tree drifts from what is published. — (from: 2026-08-27 ROUTE-01b)
- Marquee / rubber-band selection on canvas — drag over empty space currently does nothing in edit mode; a selection rectangle is the natural next gesture. — (from: 2026-08-18 Phase 4 multi-select)
- jsdom 30 needs Node >= 24.15.0 and this checkout runs 24.5.0; no manifest change is required (engines already allows it, .nvmrc is just `24`) — only the installed Node. Owner's toolchain call. — (from: 2026-08-28 DEPS-01)
- `npm run serve` serves the unbuilt source shell at `/` (only `/docs/` runs the app) and `start` duplicates `dev`: fix or remove both (plan SEG-026). — (from: 2026-09-22 DOC-02)
- `restart.sh` proves only that the server answers, while AGENTS' recovery rule asks it to verify readiness, which DEV-INFRASTRUCTURE defines as no console errors and a rendered version stamp. — (from: 2026-09-22 DOC-02)
- CI could fail a pull request that changes `docs/` or `version.json`, which only `npm run push` may commit; today the release steps rely on checking the diff by eye. — (from: 2026-09-22 GOV-01)
- `bootApp` returns before `app.ready` resolves and its teardown does not await it, so a pending startup from one test can install bus listeners during the next; tests that touch the UI must await `ready` themselves today. — (from: 2026-09-23 TST-06, Codex review)
- `PathCalculator` samples a point per 0.002 of path length with no overall cap, so a crafted project at the 2,000-waypoint and coordinate limits can ask for tens of millions of samples; the DEF-03 range stops one stray coordinate, not a whole route. — (from: 2026-09-23 DEF-03, Codex review)
- Model-only autosave recovery shallow-copies `styles` and clears only the image fields it knows, so an extra field a crafted project file puts on `styles.pathHead` (a data URL, a filename) survives into the recovery point; export filtering (DEF-23) does not reach it. — (from: 2026-09-23 DEF-23, Codex review)
- `bootApp` teardown leaves each app's `document` keydown listener attached, so in a file that boots several apps an earlier one claims a key (`preventDefault`) before the current app sees it; DEF-21's test calls `app.interactionHandler.handleKeyDown` directly to get round it. — (from: 2026-09-23 DEF-21)
- ⌘S delivered for real to a booted app under jsdom opens the save dialog and overflows the stack; unexplained, and not seen in a browser. DEF-21's test records the bus events with a no-op `eventBus.emit` spy instead. — (from: 2026-09-23 DEF-21)
- The exported player's on-screen path is untested: `PlayerApp.resize` returns early on a canvas with no parent, so no test sees its backing size, `pixelScale` or `setTransform`, and forcing `pixelScale: 1` in the player passed every test (Codex). — (from: 2026-09-24 DEF-34)
- `goldenDrawLogs`' first-frame camera exemption still accepts a player-only translation that does not depend on Graphics scale; settling the editor's camera before comparing, or asserting the expected eased transform, would remove it. — (from: 2026-09-24 DEF-34)
- The draw goldens never draw a path-only export: `enterMode('export')` skips the step in `exportVideo` that hides the background, although `authoredExtras` asks for one (Codex). — (from: 2026-09-24 TST-17)
- In a parallel run (`npx vitest run` without the gate's `--no-file-parallelism`) a frame that the setup's `setTimeout`-backed `requestAnimationFrame` booked can fire after its file's environment is torn down, so `AnimationEngine._scheduleFrame` throws `requestAnimationFrame is not defined` as an uncaught exception; vitest then reports `Errors  N errors` and exits 1 with every test passed (7 errors, attributed to `backgroundModeOverlay.test.js`, on `a69ab80`; the serial gate has not shown it). — (from: 2026-09-25 PM prompt)
- `bootApp`'s "bundled example background loads" waits `vi.waitFor`'s default 1 s, and timed out once (1.75 s) on a loaded machine during a mutation run; a longer wait would stop it flaking. — (from: 2026-09-25 DEF-35, part B)
- The `authored-extras` fixture's `motionSettings.pathTrail` is 640, far outside the slider's 0.04–4, because load checks only that it is finite (`persistence.js:370-373`); its preview timeline runs about 14 minutes, so the goldens' later instants miss every beacon window. — (from: 2026-09-26 DEF-08 review)
- A waypoint's hit radius is a fixed 15 px (`INTERACTION.WAYPOINT_HIT_RADIUS`) while a beacon can draw its marker at up to 4×, so a click 22 px from the centre of a 4× marker adds a waypoint instead of selecting it (now while paused too, with DEF-08). — (from: 2026-09-26 DEF-08 review)
- `AreaDrawingService`'s header names an event that does not exist (`canvas:click-intercepted`) and credits `AreaHighlightRenderer` with the preview, which `RenderingService` draws. — (from: 2026-09-26 DEF-17 review)
- Two unused constants: `AREA_HIGHLIGHT.DRAW_VERTEX_HIT_RADIUS` ("snap radius for closing polygon"; closing uses `DRAW_CLOSE_THRESHOLD`, in image units) and `INTERACTION.DOUBLE_CLICK_TIME`, which README's constants table still advertises ("double-click 300 ms"). — (from: 2026-09-26 DEF-17 review)
- The playback `action` names in `keybindings.js` are help text only, not the events the app emits (`InteractionHandler` emits `ui:animation:toggle`, `animation:jkl-*`, `ui:animation:skip-*`); K's is `animation:pause`, the engine's own state event, so a dispatcher built on them would announce a pause without pausing. — (from: 2026-09-26 DEF-33 review)
- Skip to end announces nothing, from the button, `.`, `>` or End: `ui:animation:skip-end` seeks directly, and the "Skipped to end" announcement in `playback.js` is never called. — (from: 2026-09-26 DEF-33 review)
- `backgroundModeOverlay.test.js`'s `bootPlainRoute` never awaits `app.ready`, so startup's console output can race the worker's teardown: once, under load, 11 `EnvironmentTeardownError`s failed `npm run check`, and the rerun passed. Awaiting each app's `ready` in `bootApp`'s teardown would cover every file. — (from: 2026-09-26 DEF-33 review)
- The perf harness silences autosave, but Clear All after a benchmark clears storage directly (`projectReset.js:75`) and so deletes the restored recovery point, and a reload comes back empty; also suppressing `clearAutoSave` for the page's life was verified to fix it. — (from: 2026-09-26 DEF-30 review)
- `EventBus.emitAsync` neither awaits an async `once` callback nor passes on its rejection, because the wrapper returns nothing; it does both for an `on` listener. No caller today. — (from: 2026-09-26 DEF-30 review)
- Load accepts a Graphics scale up to 16 but the renderer clamps it to 0.25–4, so a hand-edited 16 reads "16×" while drawing at 4×, and a value below 0.25 draws at 0.25× but reads "0.0×". — (from: 2026-09-26 DEF-37 review)

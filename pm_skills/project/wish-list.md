# Wish-list

<!-- Capture inbox for unscoped ideas. Append one line; no structure required. -->
<!-- Cold tier. Agents NEVER auto-read this file. Read it only during an
     explicit triage pass — next-batch.md, or end-of-task.md / prune-memory.md
     when the size check flags it. See AGENTS.md -> "Before every task". -->
<!-- Boundary: this is PRE-triage — raw, unjudged ideas. The backlog Icebox
     is POST-triage — ideas already judged worth keeping. Promote items INTO
     backlog.md (Current, Next, or Icebox); never treat this as a second backlog. -->
<!-- Triage = promote or cut. Promoting MOVES the item into backlog.md. Cutting
     DELETES the line. No history is kept here — survivors live in the backlog. -->
<!-- Format: one plain bullet per idea, optionally a source. Append at the
     bottom; triage from the top. Example:
     - Idea in one line — (from: 2026-05-30 task) -->
<!-- Soft cap ~25 open items. Over budget -> end-of-task flags it and
     prune-memory.md runs a forced triage pass (not an archive). See
     AGENTS.md -> "Memory size budgets". -->

## Open

- Label colour / bg colour / bg opacity controls under Label → More — model + rendering already support them; the dead wiring was removed. — (from: 2026-08-18 Phase 3.5)
- Surface camera zoom mode (continuous vs immediate) in the Phase 4 "On arrival" card — model + CameraService support it; hidden select removed. — (from: 2026-08-18 Phase 3.5)
- Pacing card should label comet mode's preview-only trail-fade extension (edit 7.1s vs preview 8.4s is real there, but unexplained). — (from: 2026-08-18 duration investigation)
- Per-leg spline tension under Leg → More if ever wanted — per-waypoint segmentTension was retired unread; PathCalculator would need to consume it. — (from: 2026-08-18 Phase 3.5)
- Dead `history:undo`/`history:redo` emits in InteractionHandler — no bus listener; real Cmd+Z is playback.js's own keydown handler. Either wire the events or drop one of the two parallel handlers. — (from: 2026-08-18 Phase 4 canvas affordances)
- Crowd extras for a later tier: re-roll seed button, onsetVariance/intensityRamp under More…, multi-emitter authoring (cards edit emitters[0] only), strip drag-reorder via Scene.moveFlowLayer. — (from: 2026-08-18 Phase 4 layers strip)
- Network extras: click-on-edge splits it with a node (leg "+" sibling), node labels/rename, arrow-key nudge for the selected node, network context menu (right-click is suppressed in the mode), edge thickness by weight. — (from: 2026-08-18 Phase 4 network edit)
- Add crowd is still gated on a route ≥ 2 waypoints — a network-only scene (no hero route) can't be authored; decide whether Add crowd should default to Custom network when no route exists. — (from: 2026-08-18 Phase 4 network edit)
- Crowd Motion card's lifecycle label says "At route end" — on a custom network the ends are exits; reword per guide ("At an exit"?). — (from: 2026-08-18 Phase 4 network edit)
- Mode banners are near-duplicates (area draw + network edit both inline-style their own) — extract a shared ModeBanner component. — (from: 2026-08-18 Phase 4 network edit)
- Group drag: dragging a waypoint that belongs to a multi-selection moves only that waypoint — moving the whole selection together is the Illustrator convention (nudge already does). — (from: 2026-08-18 Phase 4 multi-select)
- Mixed-value indication on cards in multi-select — controls show the primary's values; a dash/mixed state where the selection disagrees would be honest (Figma pattern). — (from: 2026-08-18 Phase 4 multi-select)
- Marquee / rubber-band selection on canvas — drag over empty space currently does nothing in edit mode; a selection rectangle is the natural next gesture. — (from: 2026-08-18 Phase 4 multi-select)
- Tab's `waypoint:select-adjacent` emit has no listener anywhere — Tab stepping through waypoints is dead (chip prev/next covers it); wire it or drop the emit. — (from: 2026-08-18 Phase 4 multi-select)

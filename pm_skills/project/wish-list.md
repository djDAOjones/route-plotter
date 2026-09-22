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

- Per-leg spline tension under Leg → More if ever wanted — per-waypoint segmentTension was retired unread; PathCalculator would need to consume it. — (from: 2026-08-18 Phase 3.5)
- Crowd editing extras still outside the roadmap: multi-emitter authoring (cards edit `emitters[0]` only) and strip drag-reorder via `Scene.moveFlowLayer`. Seed re-roll and release/intensity shaping moved to CROWD-02/CROWD-03 on 2026-08-26. — (from: 2026-08-18 Phase 4 layers strip)
- Network extras after REV-03: click-on-edge splits it with a node, node labels/rename, arrow-key nudge and a network context menu. Edge-weight visualisation moved to CROWD-01 on 2026-08-26. — (from: 2026-08-18 Phase 4 network edit)
- Mode banners are near-duplicates (area draw + network edit both inline-style their own) — extract a shared ModeBanner component. — (from: 2026-08-18 Phase 4 network edit)
- `pm_skills/scaffold/gen-file-map.mjs` silently drops wrapped role descriptions — it keeps only the first line of a multi-line entry, so re-running it flattened six `reviews/` roles to "(role needed)". — (from: 2026-08-27 UI-02)
- `npm run dev` leaves `docs/player.js.map` behind: the watch build emits a player sourcemap the production build's 17-file inventory does not, so the generated tree drifts from what is published. — (from: 2026-08-27 ROUTE-01b)
- Marquee / rubber-band selection on canvas — drag over empty space currently does nothing in edit mode; a selection rectangle is the natural next gesture. — (from: 2026-08-18 Phase 4 multi-select)
- The Duration slider is not synced to a restored project's speed on load, so the first keyboard nudge jumps the speed instead of nudging it — observed at v3.2.680: console reported 150 px/s while the slider sat at 1446, which measures as 200 px/s. — (from: 2026-08-27 A11Y-01 browser verification)
- jsdom 30 needs Node >= 24.15.0 and this checkout runs 24.5.0; no manifest change is required (engines already allows it, .nvmrc is just `24`) — only the installed Node. Owner's toolchain call. — (from: 2026-08-28 DEPS-01)

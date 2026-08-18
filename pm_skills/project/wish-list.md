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

- `getSegmentLengths()` (main.js) + `PathCalculator.calculateSegmentLengths()` are unused since major-leg timing landed — remove in a cleanup pass. — (from: 2026-06-18 segment-speed refinement)
- Label colour / bg colour / bg opacity controls under Label → More — model + rendering already support them; the dead wiring was removed. — (from: 2026-08-18 Phase 3.5)
- Surface camera zoom mode (continuous vs immediate) in the Phase 4 "On arrival" card — model + CameraService support it; hidden select removed. — (from: 2026-08-18 Phase 3.5)
- Clear All should save an undo snapshot like Apply-to-All now does; its modal's "cannot be undone" copy is currently accurate. — (from: 2026-08-18 Phase 3.5)
- Pacing card should label comet mode's preview-only trail-fade extension (edit 7.1s vs preview 8.4s is real there, but unexplained). — (from: 2026-08-18 duration investigation)
- Per-leg spline tension under Leg → More if ever wanted — per-waypoint segmentTension was retired unread; PathCalculator would need to consume it. — (from: 2026-08-18 Phase 3.5)

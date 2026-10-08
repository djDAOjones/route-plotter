# Digest of "Route Plotter Authoring Review" (against v3.1.593, 18 Aug 2026)

Source: https://claude.ai/code/artifact/9553ea85-5c61-4d69-b98c-19f74437f480 (condensed here for the UI-06 reconciliation; mark each finding fixed / still open / superseded on main a312b55).

## Thesis
Scope is invisible: the left sidebar edits the selected waypoint, the whole route, and (in one card) both, and never says which.

## A — Scope is invisible
- A1 Path card mixes per-waypoint (colour/thickness/shape/style/speed) and route-global (arrow style/head size) without a seam; head controls read per-waypoint fields the renderer ignores.
- A2 "Which waypoint owns this segment?" unanswerable on canvas: no segment hit-testing, hover or selection.
- A3 No-selection state shows disabled ghosts (five sections grey out with values visible) instead of a Route scope.
- A4 The subtitle that should announce scope is empty in single selection.
- A5 Bulk mode ("Select All Waypoints") is a hidden fourth scope: silently skips minors, once-per-session modal claims "cannot be undone"; multi-select exists but only Camera honours it.

## B — Inheritance model good but secret
- Copy-at-creation (new waypoint copies 22 style props) undocumented in-app, no "Reset to route style", no "Apply onward" short of bulk mode.

## C — Discoverability cliffs on canvas
- C1 Shift+click deletes a waypoint instantly (no confirm, no toast) while Shift during add = snap to 15°, and the shift cursor shows not-allowed.
- C2 Right-click wired but dead (context-menu events with no listener).
- C3 No hover feedback: cursor never changes over a waypoint or area handle; handles render 5px, hit 8px.
- C4 Minor waypoints invisible off-canvas: absent from list, unreachable by keyboard, skipped by bulk edits.
- C5 Touch second-class: single finger only, no modifiers, no pinch zoom (deprioritise, state as decision).

## D — Language & units drift
- "Arrow Style" configures a head that can be dot/image/nothing → call the card Head.
- "Icon" (marker) vs "Marker Mode" (Animation) vs "Marker" (section): three neighbourhoods for one noun.
- Timing scattered: Wait Time in Marker, Segment Speed in Path, Duration in the other sidebar, ripple's "Wait during ripple" writes pauseTime as a side effect.
- Units inconsistent: real units (px, s, %, ×, °) next to abstract scales (Text Size "1", Amplitude "10") next to raw slider ints (Thickness "333"). Rule: every readout shows the value the renderer uses, in its natural unit.
- Export is both a header menu and a sidebar section → rename the section Video settings.

## E — Paper-cut bugs (verified in code at v3.1.593)
1. Thickness readout shows raw slider int ("333"): two listeners fight (wiringDom.js:135 vs UIController.js:1009).
2. Reordering majors leaves minors at old array indices (wiringControllers.js:648–673) — data bug.
3. Path-head props per-waypoint in model, UI writes global, renderer reads global (Waypoint.js:94–97, wiringDom.js:448–473, RenderingService.js:1531).
4. Every single-selection edit double-fires: inert bus emit + real write (UIController._emitWaypointChange → wiringBus.js:152,218).
5. Label colour/bg/opacity handlers wired, no DOM controls (wiringDom.js:422–445, editorPanel.js:323–335).
6. Camera zoom-mode hidden select + handler for a toggle not in the DOM (index.html:563, wiringDom.js:687).
7. segmentTension serialised/copied/passed, no control anywhere (Waypoint.js:24 → pathTiming.js:44).
8. Global shortcuts fire while a <select> has focus (guard only checks INPUT/TEXTAREA) (InteractionHandler.js:472+).
9. Rename logic duplicated inside the dbl-click timer branch (UIController.js:1597–1631 vs 1521–1569).
10. List container is listbox but rows aren't options (UIController.js:1303–1305).
11. "Apply to All" modal says "cannot be undone" (index.html:855) — wrong copy or real undo gap.
12. Stale `general` key in section-state defaults (SectionController.js:27–37).
- To verify: total-duration readout 8.6 s at load vs 7.7 s after unrelated navigation with identical data.

## Proposal (4) — one inspector, explicit scopes
1. Scope header always present ("Editing · Waypoint 2 'Library' · major" / "Editing · Route" / "Editing · Crowd 'Commuters'").
2. Regroup by subject: Waypoint scope = Marker · On arrival (beacon+wait+zoom) · Label · Leg → next · Area. Route scope = Head · Pacing · Reveal · Path emphasis · Background · Video settings.
3. Two-tier disclosure: 2–4 primary controls per card, "More…" for the rest.
4. Make inheritance visible: Reset to route style, Apply onward; bulk mode dissolves into multi-select honoured by every card, minors included, one undo entry.
5. Canvas affordances: hover ring + pointer cursor; segment hover glow + click selects owning waypoint; midpoint "+" handle inserts a minor; right-click context menu; Shift-delete undo toast.
6. List gains minors (indented rows) and a Layers strip above it.

## Crowds (5)
- Add crowd → dots in two clicks (Follow route + one emitter, sane defaults); graph UI only on Custom network; same pen.
- Nodes/edges are selections: Node card (type pass-through/entry/exit + Bind to waypoint); Edge card (direction toggle, weight shown as computed traffic share "takes ~62% here", not an abstract number).
- Anchors are drops (drag node onto waypoint); emitter window picker: at start / when head reaches Waypoint N / during Waypoint N's pause / after route completes.
- Interludes: "Fit wait to crowd" bakes last-arrival into pauseTime.
- Branch gesture later.

# REV-03 — Unified pointer transactions

> **Status:** Implementation complete; automated and production-Chromium
> evidence green. Physical mobile evidence remains the closure gate.

## Intent

Make mouse, touch and pen authoring use one explicit gesture transaction so a
single physical action cannot mutate the project twice or leave a drag stuck.

## Contract

- One primary left pointer owns a gesture from down through captured up,
  cancellation or unexpected capture loss. Other pointers are ignored.
- Movement of at most 3 CSS pixels remains a tap. Crossing that threshold
  starts at most one waypoint, area-handle or network drag; a completed drag
  can never fall through into a tap.
- Pointer cancellation, capture loss, project replacement and window blur
  restore the gesture-start geometry and create no undo or autosave commit.
- A tap on one member of a multi-selection collapses to it. Dragging any
  selected member preserves the group, makes that member primary and moves
  every selected waypoint by one shared, bounds-safe delta.
- Group movement is derived from the immutable gesture-start snapshot, keeps
  relative geometry, recalculates once per frame and commits one undo state.
- Native background file drop, list reordering, context menu, wheel zoom and
  player range-input behaviour remain separate native-control paths.
- The canvas has an intentional touch-action policy for reliable authored
  drags; physical-device evidence must distinguish page navigation from canvas
  authoring and must not be inferred from a responsive viewport.

## Done when

- InteractionHandler registers one Pointer Events path with capture and
  removable listeners; no touch-to-mouse synthesis or canvas click mutation
  owner remains.
- Mouse, touch and pen contract tests prove exactly-once taps, threshold
  classification, pointer identity, outside release, cancellation idempotence,
  mode priority and complete teardown.
- Waypoint group drag, area centre/vertex drag and network node/control/edge
  drag share the same commit/cancel boundary; no-op releases commit nothing.
- Focused suites, the canonical gate and production Chromium checks are green.
- A real iOS Safari and Android Chrome pass records tap, drag, cancellation,
  page navigation and rotation behaviour before REV-03 is evicted as shipped.

## Evidence boundary

Chromium touch emulation and synthetic pen PointerEvents are useful automated
browser evidence, but they are not physical phone, tablet or stylus evidence.
The current development server is localhost-only, so real-device verification
needs an approved reachable build such as the already-public review branch or
an explicitly approved temporary LAN route.

## Evidence recorded 2026-08-26

- The Pointer Events contract suite covers mouse, touch and pen exactly-once
  taps, the common 3 px threshold, ownership, outside release, cancellation,
  area/network priority, group snapshots and complete listener teardown.
- Focused interaction and orchestration suites are green. The canonical gate
  passed 47 files / 669 tests, restart-safety and the non-mutating production
  build; the cold runtime then reached ready at v3.2.630.
- Production Chromium v3.2.629 formed a two-waypoint selection through real
  pointer input, released a bounds-safe group drag outside the canvas, created
  one undo entry and restored both points with one Undo. An early outside-drop
  check exposed premature capture release in the browser harness; idempotent
  window `pointerup`/`pointercancel` fallbacks now close that transaction.
- The 320 px and 390 px responsive layouts have no horizontal overflow, the
  canvas computes `touch-action: none`, and the browser console is clean.
- Still required before eviction: real iOS Safari and Android Chrome tap,
  drag, cancellation, page-navigation and rotation evidence.

## Constraints

Preserve configurable modifier semantics, angle snapping, existing network and
area model ownership, linear-project persistence, deterministic rendering and
the one-undo-per-gesture rule. Do not broaden this ticket into list drag/drop,
player controls or route-branch interaction design.

# Testing Checklist - Route Plotter

## How to Use
1. Run tests after each significant change
2. Check boxes with `[x]` when passing
3. Add notes for failures or issues
4. Reset checkboxes for new test runs (find/replace `[x]` → `[ ]`)

---

## Core Features

### Waypoint Management
- [x] Click canvas to add waypoint
- [x] Drag waypoint to reposition
- [x] Delete waypoint (Delete key or button)
- [x] Toggle major/minor waypoint
- [ ] Arrow keys move selected waypoint

### Path Rendering
- [x] Path draws between waypoints
- [x] Catmull-Rom smoothing works
- [ ] Path color changes apply
- [ ] Path thickness changes apply

### Animation Playback
- [x] Play/Pause button works
- [x] Timeline slider scrubs correctly
- [x] Speed slider adjusts duration
- [x] Skip to start/end buttons work
- [ ] J/K/L playback speed controls work

---

## Motion Visibility (v3.0038)

### Preview Mode Toggle
- [x] Button toggles between Edit/Preview mode
- [x] Edit mode: all elements visible
- [x] Preview mode: applies motion settings
- [x] Duration updates when toggling (adds/removes 3s buffer)

### Path Visibility Modes
- [x] **Always Show**: Full path visible at all times
- [x] **Show on Progression**: Path reveals from start to head
- [x] **Hide on Progression**: Full path, fades behind head
- [ ] **Instantaneous**: Only trail segment visible (comet effect)
- [ ] **Always Hide**: No path visible

### Path Trail
- [ ] Trail slider adjusts fade duration
- [ ] Trail = 0 gives instant cutoff
- [ ] Trail continues shrinking during waypoint pauses
- [ ] Trail fades out during 3s end buffer

### Waypoint Visibility Modes
- [ ] **Always Show**: All waypoints visible
- [ ] **Hide Before**: Waypoints appear as path reaches them
- [ ] **Hide After**: Waypoints disappear after path passes
- [ ] **Hide Before & After**: Appear then disappear
- [ ] **Always Hide**: No waypoints visible
- [ ] Scale animation (grow in / shrink out) works
- [ ] Labels render independently of waypoint marker visibility
- [ ] Minor waypoints hidden in preview mode

### Text Labels (v3.1.960)

#### Label Visibility Modes
- [ ] **Off**: Label never shown
- [ ] **On**: Label always visible
- [ ] **Fade Up** (default): Label fades in as animation approaches waypoint
- [ ] **Fade Up & Down**: Label fades in on approach, fades out after passing

#### Label Fade Animation
- [ ] Fade duration is 0.5s (500ms)
- [ ] Fade uses eased animation (cubicOut for fade-in, quadIn for fade-out)
- [ ] First waypoint label shows immediately (no fade-in)
- [ ] Labels fade independently of waypoint marker visibility

#### Label Styling
- [ ] Font size slider works (default 16px)
- [ ] Text color picker works
- [ ] Background color picker works
- [ ] Background opacity slider works (default 0.85)

#### Label Positioning
- [ ] Label width slider works (% of canvas)
- [ ] X offset slider works
- [ ] Y offset slider works
- [ ] Auto-position button finds collision-free position

#### Label Persistence
- [ ] Label text saved/loaded
- [ ] Label mode saved/loaded
- [ ] Label styling saved/loaded
- [ ] Label position offsets saved/loaded

---

### Background Visibility
- [ ] **Always Show**: Full background visible
- [ ] **Reveal**: Circular reveal around path head
- [ ] Reveal size slider works
- [ ] Reveal feather slider works
- [ ] Revealed areas accumulate (stay revealed)
- [ ] Reveal mask resets on animation reset

---

## Video Export

### Export Process
- [ ] Export button opens dialog
- [ ] Resolution options work
- [ ] Frame rate options work
- [ ] Export progress shows correctly
- [ ] Cancel button stops export

### Motion Settings in Export
- [ ] Export uses current motion visibility settings
- [ ] Preview mode enabled during export
- [ ] Reveal mask resets at export start
- [ ] End buffer included in export duration
- [ ] Minor waypoints hidden in export

---

## Persistence (Autosave/Load)

### Settings Saved
- [ ] Waypoints (positions, styles, pauses)
- [ ] Path styles (color, thickness)
- [ ] Animation speed
- [ ] Motion visibility settings:
  - [ ] Path visibility mode
  - [ ] Path trail duration
  - [ ] Waypoint visibility mode
  - [ ] Background visibility mode
  - [ ] Reveal size
  - [ ] Reveal feather

### Load Behavior
- [ ] Settings restore on page reload
- [ ] UI controls update to match loaded values
- [ ] Invalid/missing values use defaults

---

## Performance

### Rendering
- [ ] Smooth 60fps during playback
- [ ] No lag when dragging waypoints
- [ ] No memory leaks during long sessions

### Edge Cases
- [ ] Works with 2 waypoints (minimum)
- [ ] Works with 50+ waypoints
- [ ] Handles rapid setting changes

---

## Test Run Log

| Date | Version | Tester | Result | Notes |
|------|---------|--------|--------|-------|
| YYYY-MM-DD | v3.0038 | | Pass/Fail | |


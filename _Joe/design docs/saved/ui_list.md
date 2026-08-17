# Route Plotter v3 — UI Element Inventory

> **Purpose**: Comprehensive inventory of all UI elements for semantic UI design planning.  
> **Generated**: December 2024  
> **App Version**: v3.0001

---

## Table of Contents

1. [Layout Structure](#1-layout-structure)
2. [Header Region](#2-header-region)
3. [Left Sidebar — Settings Panel](#3-left-sidebar--settings-panel)
4. [Canvas Area](#4-canvas-area)
5. [Right Sidebar — Waypoints Panel](#5-right-sidebar--waypoints-panel)
6. [Transport Controls](#6-transport-controls)
7. [Modals & Overlays](#7-modals--overlays)
8. [Design Tokens & CSS Variables](#8-design-tokens--css-variables)
9. [Interaction Patterns](#9-interaction-patterns)
10. [Accessibility Features](#10-accessibility-features)
11. [Component Inventory Summary](#11-component-inventory-summary)

---

## 1. Layout Structure

### 1.1 Application Shell

| Element | ID/Class | Semantic Role | Description |
|---------|----------|---------------|-------------|
| App Container | `#app` | `<div>` | Root flex container, column direction, 100vh |
| Skip Link | `.skip-link` | `<a>` | Accessibility skip-to-content link |
| Announcer | `#announcer` | `role="status"` | Screen reader live region |

### 1.2 Main Layout Grid

```text
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER                                   │
├──────────────┬─────────────────────────────┬────────────────────┤
│              │                             │                    │
│   LEFT       │         CANVAS              │      RIGHT         │
│   SIDEBAR    │                             │      SIDEBAR       │
│   (320px)    │       (flex: 1)             │      (320px)       │
│              │                             │                    │
│              ├─────────────────────────────┤                    │
│              │    TRANSPORT CONTROLS       │                    │
└──────────────┴─────────────────────────────┴────────────────────┘
```

---

## 2. Header Region

### 2.1 Header Container

| Element | ID/Class | Type | Description |
|---------|----------|------|-------------|
| Header | `.header` | `<header role="banner">` | Top navigation bar |
| Title | `#app-title` / `.header-title` | `<h1>` | "Route Plotter v3" |
| Controls Container | `.header-controls` | `<div>` | Flex container for all header controls |

### 2.2 Mode Switch (Edit/Preview Toggle)

| Element | ID/Class | Type | States | Description |
|---------|----------|------|--------|-------------|
| Container | `#mode-switch` / `.mode-switch` | `<div>` | — | Toggle group container |
| Edit Label | `.mode-label-edit` | `<span>` | `.active` | "Edit" text label |
| Toggle Button | `#mode-toggle-btn` / `.mode-toggle` | `<button role="switch">` | `aria-checked="true/false"` | iOS-style toggle |
| Toggle Thumb | `.mode-toggle-thumb` | `<span>` | — | Sliding indicator |
| Preview Label | `.mode-label-preview` | `<span>` | `.active` | "Preview" text label |

### 2.3 History Controls

| Element | ID | Type | States | Description |
|---------|-----|------|--------|-------------|
| Undo Button | `#undo-btn` | `<button>` | `disabled` | ↶ Undo action |
| Redo Button | `#redo-btn` | `<button>` | `disabled` | ↷ Redo action |

### 2.4 File Controls

| Element | ID | Type | Description |
|---------|-----|------|-------------|
| Save Button | `#save-btn` | `<button>` | 💾 Save project as JSON |
| Load Button | `#load-btn` | `<button>` | 📂 Open project from JSON |
| File Input | `#load-file-input` | `<input type="file">` | Hidden file picker |

### 2.5 Example Backgrounds Dropdown

| Element | ID/Class | Type | States | Description |
|---------|----------|------|--------|-------------|
| Dropdown Container | `#example-backgrounds-dropdown` / `.dropdown` | `<div>` | `.open` | Dropdown wrapper |
| Toggle Button | `#example-backgrounds-btn` / `.dropdown-toggle` | `<button>` | `aria-expanded` | "Example Backgrounds ▾" |
| Menu | `#example-backgrounds-menu` / `.dropdown-menu` | `<div role="menu">` | — | Dropdown options container |
| Menu Items | `.dropdown-item` | `<button role="menuitem">` | — | Individual background options |

**Menu Items:**

- Courts
- Garlic
- Nervous System
- PARM Aerial
- Rocketry
- UoN Map

### 2.6 Primary Actions

| Element | ID | Type | Class | Description |
|---------|-----|------|-------|-------------|
| Export Video | `#export-btn` | `<button>` | `.btn-primary` | Primary CTA |
| Help | `#help-btn` | `<button>` | `.btn-secondary` | Opens help modal |
| Clear | `#clear-btn` | `<button>` | `.btn-secondary.btn-danger` | Destructive action |

---

## 3. Left Sidebar — Settings Panel

### 3.1 Sidebar Structure

| Element | ID/Class | Type | Description |
|---------|----------|------|-------------|
| Sidebar | `.sidebar` | `<aside role="complementary">` | 320px fixed width |
| Header | `.sidebar-header` | `<div>` | "Waypoint Settings" title |
| Sections Container | `#settings-sections` / `.settings-sections` | `<div>` | Scrollable sections area |
| Help Placeholder | `#settings-help-placeholder` | `<div>` | Shown when no waypoints |

### 3.2 Collapsible Section Pattern

Each section follows this structure:

```html
<div class="settings-section" data-section="[name]">
  <div class="section-header" tabindex="0" role="button" aria-expanded="false">
    <h3 class="section-title">[TITLE]</h3>
    <span class="section-chevron">▶</span>
  </div>
  <div id="section-[name]-content" class="section-content">
    <!-- Controls -->
  </div>
</div>
```

**Section States:**

- `.expanded` — Content visible, chevron rotated 90°
- `.settings-disabled` — Grayed out when no waypoint selected

---

### 3.3 MARKER Section

| Control | ID | Type | Range/Options | Default | Description |
|---------|-----|------|---------------|---------|-------------|
| Colour | `#dot-color` | `<input type="color">` | — | `#FF6B6B` | Marker fill color |
| Icon | `#marker-style` | `<select>` | Dot, Square, Flag, None | Dot | Marker shape |
| Size | `#dot-size` | `<input type="range">` | 4–16, step 1 | 8 | Marker diameter (px) |
| Size Value | `#dot-size-value` | `<span>` | — | — | Display value |
| Wait Time | `#waypoint-pause-time` | `<input type="range">` | 0–1000 (log → 0–300s) | 500 | Pause at waypoint |
| Wait Time Value | `#waypoint-pause-time-value` | `<span>` | — | "1.5s" | Display value |
| Beacon | `#editor-beacon-style` | `<select>` | None, Ripple, Glow, Pop, Grow, Pulse | None | Animation effect |

#### Ripple Sub-Controls (conditional)

| Control | ID | Type | Range | Default | Description |
|---------|-----|------|-------|---------|-------------|
| Container | `#ripple-controls` | `<div>` | — | hidden | Shown when beacon=ripple |
| Thickness | `#ripple-thickness` | `<input type="range">` | 1–10, step 0.5 | 2 | Ring thickness (px) |
| Thickness Value | `#ripple-thickness-value` | `<span>` | — | "2px" | Display |
| Size | `#ripple-max-scale` | `<input type="range">` | 500–4000, step 100 | 1000 | Max scale (%) |
| Size Value | `#ripple-max-scale-value` | `<span>` | — | "1000%" | Display |
| Wait During | `#ripple-wait` | `<input type="checkbox">` | — | checked | Pause during ripple |

#### Pulse Sub-Controls (conditional)

| Control | ID | Type | Range | Default | Description |
|---------|-----|------|-------|---------|-------------|
| Container | `#pulse-controls` | `<div>` | — | hidden | Shown when beacon=pulse |
| Amplitude | `#pulse-amplitude` | `<input type="range">` | 0–3, step 0.1 | 1 | Pulse intensity |
| Amplitude Value | `#pulse-amplitude-value` | `<span>` | — | "1.0" | Display |
| Cycle Speed | `#pulse-cycle-speed` | `<input type="range">` | 1–10, step 0.5 | 4 | Cycle duration (s) |
| Cycle Speed Value | `#pulse-cycle-speed-value` | `<span>` | — | "4s" | Display |

---

### 3.4 TEXT Section

| Control | ID | Type | Range/Options | Default | Description |
|---------|-----|------|---------------|---------|-------------|
| Text | `#waypoint-label` | `<input type="text">` | — | — | Label text content |
| Onset | `#label-mode` | `<select>` | Off, Always On, Fade Up, Fade Up & Down | Fade Up | Visibility mode |
| Size | `#label-size` | `<input type="range">` | 1–10, step 1 | 1 | Text size scale |
| Size Value | `#label-size-value` | `<span>` | — | "1" | Display |
| Text Area Width | `#label-width` | `<input type="range">` | 5–50, step 1 | 15 | Width (% of canvas) |
| Width Value | `#label-width-value` | `<span>` | — | "15%" | Display |
| Auto-Position | `#label-auto-position` | `<button>` | — | — | Auto-position to avoid collisions |
| Horizontal Position | `#label-offset-x` | `<input type="range">` | -50–50, step 1 | 0 | X offset (%) |
| X Value | `#label-offset-x-value` | `<span>` | — | "0%" | Display |
| Vertical Position | `#label-offset-y` | `<input type="range">` | -50–50, step 1 | -5 | Y offset (%) |
| Y Value | `#label-offset-y-value` | `<span>` | — | "-5%" | Display |

---

### 3.5 PATH Section

| Control | ID | Type | Range/Options | Default | Description |
|---------|-----|------|---------------|---------|-------------|
| Colour | `#segment-color` | `<input type="color">` | — | `#FF6B6B` | Path stroke color |
| Head Colour | `#path-head-color` | `<input type="color">` | — | `#111111` | Arrow/dot head color |
| Head | `#path-head-style` | `<select>` | Arrow, Dot, Custom, None | Arrow | Path head style |
| Head Size | `#path-head-size` | `<input type="range">` | 4–24, step 1 | 8 | Head size (px) |
| Head Size Value | `#path-head-size-value` | `<span>` | — | "8" | Display |
| Thickness | `#segment-width` | `<input type="range">` | 0–1000 (log scale) | 333 | Path width |
| Thickness Value | `#segment-width-value` | `<span>` | — | "3" | Display |
| Shape | `#path-shape` | `<select>` | Line, Squiggle, Randomised | Line | Path shape |
| Style | `#segment-style` | `<select>` | Solid, Dotted, Dashed | Solid | Stroke style |
| Segment Speed | `#waypoint-segment-speed` | `<input type="range">` | 0–1000 (log → 0.1x–10x) | 500 | Speed multiplier |
| Speed Value | `#waypoint-segment-speed-value` | `<span>` | — | "1.0x" | Display |

#### Custom Head Sub-Controls (conditional)

| Control | ID | Type | Description |
|---------|-----|------|-------------|
| Container | `#custom-head-controls` | `<div>` | Shown when head=custom |
| Upload Button | `#head-upload-btn` | `<button>` | Trigger file picker |
| File Input | `#head-upload` | `<input type="file">` | Hidden, accepts PNG/JPG/SVG |
| Preview Container | `#head-preview` | `<div>` | Preview area |
| Filename | `#head-filename` | `<p>` | Selected filename |
| Preview Image | `#head-preview-img` | `<img>` | Image preview |

---

### 3.6 CAMERA Section

| Status | Description |
|--------|-------------|
| 🚧 Coming Soon | Placeholder section |

---

### 3.7 Global Settings Header

| Element | Class | Description |
|---------|-------|-------------|
| Header | `.sidebar-header.sidebar-header-inner` | "Global Settings" divider |

---

### 3.8 GENERAL Section (Global)

| Control | ID | Type | Range/Options | Default | Description |
|---------|-----|------|---------------|---------|-------------|
| Duration | `#animation-speed` | `<input type="range">` | 1–4000 (log curve) | — | Animation duration |
| Duration Value | `#animation-speed-value` | `<span>` | — | "10s" | Display |
| Path Mode | `#path-visibility` | `<select>` | Always Show, Show on Progression, Hide on Progression, Instantaneous (Comet), Always Hide | Show on Progression | Path visibility mode |
| Trail Size | `#path-trail` | `<input type="range">` | 0–1000 (power curve) | 590 | Comet trail length |
| Trail Value | `#path-trail-value` | `<span>` | — | "15%" | Display |
| Waypoint Mode | `#waypoint-visibility` | `<select>` | Always Show, Hide Before, Hide After, Hide Before & After, Always Hide | Always Show | Waypoint visibility |
| Background Mode | `#background-visibility` | `<select>` | Always Show, Spotlight, Spotlight Reveal, Angle of View, Angle of View Reveal, Hide | Always Show | Background visibility |
| Background Tint | `#bg-overlay` | `<input type="range">` | -1000–1000 (log2 bipolar) | 0 | Black to white tint |
| Tint Value | `#bg-overlay-value` | `<span>` | — | "0" | Display |
| Upload Button | `#bg-upload-btn` | `<button>` | — | — | Upload background image |
| File Input | `#bg-upload` | `<input type="file">` | — | — | Hidden file picker |

#### Spotlight Sub-Controls (conditional)

| Control | ID | Type | Range | Default | Description |
|---------|-----|------|-------|---------|-------------|
| Container | `#spotlight-controls` | `<div>` | — | hidden | Shown for spotlight modes |
| Spotlight Size | `#reveal-size` | `<input type="range">` | 0–1000 (log2) | 500 | Spotlight radius (%) |
| Size Value | `#reveal-size-value` | `<span>` | — | "10%" | Display |
| Spotlight Feather | `#reveal-feather` | `<input type="range">` | 0–1000 (log2) | 500 | Edge softness (%) |
| Feather Value | `#reveal-feather-value` | `<span>` | — | "25%" | Display |

#### Angle of View Sub-Controls (conditional)

| Control | ID | Type | Range | Default | Description |
|---------|-----|------|-------|---------|-------------|
| Container | `#aov-controls` | `<div>` | — | hidden | Shown for AOV modes |
| View Angle | `#aov-angle` | `<input type="range">` | 0–1000 (tan curve) | 500 | Field of view (°) |
| Angle Value | `#aov-angle-value` | `<span>` | — | "60°" | Display |
| View Distance | `#aov-distance` | `<input type="range">` | 0–1000 (log2) | 500 | View distance (%) |
| Distance Value | `#aov-distance-value` | `<span>` | — | "10%" | Display |
| View Dropoff | `#aov-dropoff` | `<input type="range">` | 0–1000 (log2) | 500 | Edge falloff (%) |
| Dropoff Value | `#aov-dropoff-value` | `<span>` | — | "25%" | Display |

---

### 3.9 BACKGROUND Section

| Status | Description |
|--------|-------------|
| 🚧 Coming Soon | Placeholder section |

---

### 3.10 EXPORT Section

| Control | ID | Type | Range/Options | Default | Description |
|---------|-----|------|---------------|---------|-------------|
| Resolution | — | — | — | — | 🚧 Coming soon |
| Frame Rate | `#export-frame-rate` | `<input type="number">` | 1–60 | 25 | Export FPS |
| Included | `#export-layers` | `<select>` | Path with image, Path only (transparent) | Path with image | Export layers |

---

## 4. Canvas Area

### 4.1 Canvas Element

| Element | ID | Type | States | Description |
|---------|-----|------|--------|-------------|
| Canvas | `#canvas` | `<canvas>` | `.dragging`, `.drag-over` | Main drawing surface |

**Cursor States:**

- Default: `crosshair`
- Dragging waypoint: `grabbing`
- Drag-over (file drop): Visual feedback

**Canvas Behaviors:**

- Click: Add major waypoint
- Shift+Click on empty: Add minor waypoint
- Shift+Click on waypoint: Delete waypoint
- Drag waypoint: Reposition
- Right-click: Context menu
- Drag & drop image: Set background

---

## 5. Right Sidebar — Waypoints Panel

### 5.1 Sidebar Structure

| Element | Class | Type | Description |
|---------|-------|------|-------------|
| Sidebar | `.sidebar-right` | `<aside role="complementary">` | 320px fixed width |
| Title | `<h3>` | Heading | "Waypoints" |
| List Container | `#waypoint-list` / `.waypoint-list` | `<div>` | Scrollable waypoint list |

### 5.2 Empty State

| Element | Class | Description |
|---------|-------|-------------|
| Container | `.waypoint-list-empty` | Shown when no waypoints |
| Message | `<p>` | "No waypoints yet" |
| Hint | `.hint` | "Click on the map to add waypoints" |

### 5.3 "Select All Waypoints" Item

| Element | Class | Type | States | Description |
|---------|-------|------|--------|-------------|
| Container | `.waypoint-item-all` | `<div role="button">` | `.selected` | Special top item |
| Label | `.waypoint-item-label` | `<span>` | — | "Select All Waypoints" |

### 5.4 Individual Waypoint Item

| Element | Class | Type | States | Description |
|---------|-------|------|--------|-------------|
| Container | `.waypoint-item` | `<div>` | `.selected`, `.dragging` | Draggable item |
| Handle | `.waypoint-item-handle` | `<span>` | — | ☰ Drag handle |
| Label | `.waypoint-item-label` | `<span>` | `contenteditable` | Waypoint name (editable) |
| Delete Button | `.waypoint-item-delete` | `<button>` | — | × Delete button |

**Interactions:**

- Click: Select waypoint
- Shift+Click: Range select
- Cmd/Ctrl+Click: Toggle in multi-select
- Double-click label: Rename
- F2 / Enter: Start rename
- Escape: Cancel rename
- Drag: Reorder waypoints

---

## 6. Transport Controls

### 6.1 Controls Panel

| Element | Class | Type | Description |
|---------|-------|------|-------------|
| Container | `.controls` | `<div>` | Fixed bottom panel between sidebars |
| Transport Group | `.transport-controls` | `<div>` | Playback buttons |
| Timeline Group | `.timeline` | `<div>` | Scrubber and time display |

### 6.2 Transport Buttons

| Element | ID | Type | Icon | Description |
|---------|-----|------|------|-------------|
| Skip to Start | `#skip-start-btn` | `<button>` | ⏮ | Jump to beginning |
| Play | `#play-btn` | `<button>` | ▶ | Start playback |
| Pause | `#pause-btn` | `<button>` | ⏸ | Pause playback (hidden when stopped) |
| Skip to End | `#skip-end-btn` | `<button>` | ⏭ | Jump to end |

### 6.3 Timeline

| Element | ID/Class | Type | Range | Description |
|---------|----------|------|-------|-------------|
| Current Time | `#current-time` / `.time` | `<span>` | — | "0:00" format |
| Slider | `#timeline-slider` / `.timeline-slider` | `<input type="range">` | 0–1000 | Progress scrubber |
| Total Time | `#total-time` / `.time` | `<span>` | — | "0:00" format |

---

## 7. Modals & Overlays

### 7.1 Splash Screen / Help Modal

| Element | ID/Class | Type | Description |
|---------|----------|------|-------------|
| Overlay | `#splash` / `.splash-screen` | `<div>` | Full-screen backdrop |
| Content | `.splash-content` | `<div>` | Modal card |
| Title | `<h2>` | Heading | "Welcome to Route Plotter v3" |
| Help Content | `#splash-help` | `<div>` | Dynamic help sections |
| Close Button | `#splash-close` | `<button>` | "Get Started" |
| Don't Show Checkbox | `#splash-dont-show` | `<input type="checkbox">` | Suppress on future loads |

### 7.2 Help Content Sections

| Section | Icon | Title | Content |
|---------|------|-------|---------|
| Getting Started | 🗺️ | Getting Started | Click, Shift+Click, Drag, Select |
| Animation | ▶️ | Animation | Play/Pause, Timeline |
| Shortcuts | ⌨️ | Shortcuts | Keyboard shortcuts reference |

### 7.3 All Waypoints Warning Modal

| Element | ID | Type | Description |
|---------|-----|------|-------------|
| Overlay | `#all-waypoints-warning-modal` / `.modal` | `<div>` | Confirmation dialog |
| Content | `.modal-content` | `<div>` | Modal card |
| Title | `<h3>` | Heading | "Apply to All Waypoints?" |
| Message | `<p>` | Text | Warning message |
| Confirm Button | `#all-waypoints-confirm` | `<button>` | "Apply to All" |
| Cancel Button | `#all-waypoints-cancel` | `<button>` | "Cancel" |

### 7.4 Zoom Prompt Toast

| Element | Class | Type | States | Description |
|---------|-------|------|--------|-------------|
| Toast | `.zoom-prompt` | `<div>` | `.visible` | Centered toast notification |

---

## 8. Design Tokens & CSS Variables

### 8.1 Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#E63946` | Brand color, CTAs |
| `--color-primary-dark` | `#C62828` | Hover states |
| `--color-text-primary` | `#1a1a1a` | Main text (16:1 contrast) |
| `--color-text-secondary` | `#333333` | Labels (12:1 contrast) |
| `--color-text-muted` | `#4a4a4a` | Muted text (8:1 contrast) |
| `--color-text-disabled` | `#666666` | Disabled (5.7:1 AA large) |
| `--color-bg-primary` | `#ffffff` | Main background |
| `--color-bg-secondary` | `#fafafa` | Secondary background |
| `--color-bg-tertiary` | `#f5f5f5` | Tertiary background |
| `--color-border` | `#cccccc` | Decorative borders |
| `--color-border-focus` | `#E63946` | Focus ring color |

### 8.2 Focus & Accessibility

| Token | Value | Usage |
|-------|-------|-------|
| `--focus-ring` | `3px solid var(--color-border-focus)` | Focus outline |
| `--focus-ring-offset` | `2px` | Focus outline offset |
| `--touch-target-min` | `44px` | WCAG AAA touch target |

### 8.3 Typography

| Property | Value |
|----------|-------|
| Font Family | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif` |
| Base Size | Browser default (16px) |
| Header Title | `1.5rem` (24px) |
| Section Title | `0.875rem` (14px), uppercase, 600 weight |
| Control Labels | `0.95rem` (15.2px), 500 weight |
| Small Text | `0.875rem` (14px) |

---

## 9. Interaction Patterns

### 9.1 Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `Space` / `K` | Play/Pause | Global |
| `J` | Reverse playback (speed doubles) | Global |
| `L` | Forward playback (speed doubles) | Global |
| `,` / `<` | Skip to start | Global |
| `.` / `>` | Skip to end | Global |
| `↑↓←→` | Nudge waypoint (0.5%) | Waypoint selected |
| `Shift+↑↓←→` | Nudge waypoint (2%) | Waypoint selected |
| `+` / `-` | Zoom in/out | Global |
| `0` | Reset zoom | Global |
| `Del` / `Backspace` | Delete waypoint | Waypoint selected |
| `Tab` | Select next waypoint | Global |
| `Shift+Tab` | Select previous waypoint | Global |
| `T` | Toggle waypoint type | Waypoint selected |
| `Ctrl/Cmd+Z` | Undo | Global |
| `Ctrl/Cmd+Shift+Z` | Redo | Global |
| `Ctrl/Cmd+S` | Save project | Global |
| `?` / `H` | Toggle help | Global |
| `F2` / `Enter` | Rename waypoint | Waypoint label focused |
| `Escape` | Cancel rename | Editing label |

### 9.2 Mouse Interactions

| Action | Target | Result |
|--------|--------|--------|
| Click | Empty canvas | Add major waypoint |
| Shift+Click | Empty canvas | Add minor waypoint |
| Click | Waypoint | Select waypoint |
| Shift+Click | Waypoint | Delete waypoint |
| Drag | Waypoint | Reposition |
| Right-click | Canvas/Waypoint | Context menu |
| Double-click | Waypoint label | Rename |
| Drag & Drop | Canvas | Upload background image |

### 9.3 Touch Interactions

| Action | Result |
|--------|--------|
| Tap | Add waypoint or select |
| Drag | Reposition waypoint |

---

## 10. Accessibility Features

### 10.1 WCAG 2.2 AAA Compliance

| Feature | Implementation |
|---------|----------------|
| Color Contrast | All text meets 7:1 ratio minimum |
| Focus Indicators | 3px solid ring with 2px offset |
| Touch Targets | Minimum 44px for all interactive elements |
| Skip Link | "Skip to main content" link |
| Live Regions | `#announcer` for screen reader updates |
| Keyboard Navigation | Full keyboard support for all features |
| Reduced Motion | `@media (prefers-reduced-motion)` support |
| High Contrast | `@media (prefers-contrast: more)` adjustments |

### 10.2 ARIA Attributes Used

| Attribute | Usage |
|-----------|-------|
| `role="banner"` | Header |
| `role="main"` | Main content area |
| `role="complementary"` | Sidebars |
| `role="switch"` | Edit/Preview toggle |
| `role="button"` | Section headers, waypoint items |
| `role="menu"` / `role="menuitem"` | Dropdown menus |
| `role="status"` | Announcer, empty states |
| `aria-expanded` | Collapsible sections, dropdowns |
| `aria-checked` | Toggle switches |
| `aria-pressed` | Toggle buttons |
| `aria-label` | Icon buttons, inputs |
| `aria-labelledby` | Grouped controls |
| `aria-controls` | Section headers → content |
| `aria-live="polite"` | Announcer |
| `aria-atomic="true"` | Announcer |

---

## 11. Component Inventory Summary

### 11.1 Button Variants

| Class | Style | Usage |
|-------|-------|-------|
| `.btn` | Base button | All buttons |
| `.btn-primary` | Coral background, white text | Primary CTAs |
| `.btn-secondary` | Gray background, dark text | Secondary actions |
| `.btn-icon` | Square, icon-only | Transport controls |
| `.btn-danger` | Red text | Destructive actions |

### 11.2 Input Types

| Type | Count | Examples |
|------|-------|----------|
| `<input type="range">` | 19 | Size, speed, position sliders |
| `<input type="color">` | 4 | Marker, path, head colors |
| `<input type="text">` | 1 | Waypoint label |
| `<input type="number">` | 1 | Frame rate |
| `<input type="file">` | 3 | Background, head, project load |
| `<input type="checkbox">` | 3 | Ripple wait, don't show splash |
| `<select>` | 11 | Style dropdowns |

### 11.3 Slider Curve Types

| Curve | Usage | Rationale |
|-------|-------|-----------|
| Linear | Size, position offsets | Direct mapping |
| Logarithmic | Speed, duration | Perceptual uniformity |
| Power (^5) | Trail size | Fine control at low values |
| Power (^2.5) | Pause time | Precision at low values |
| Log2 | Spotlight, feather, tint | Perceptual uniformity |
| Tan-based | Angle of view | Perceptual smoothness |

### 11.4 Conditional UI Elements

| Element | Condition | Parent Control |
|---------|-----------|----------------|
| `#ripple-controls` | beacon = "ripple" | `#editor-beacon-style` |
| `#pulse-controls` | beacon = "pulse" | `#editor-beacon-style` |
| `#custom-head-controls` | head = "custom" | `#path-head-style` |
| `#path-trail-control` | path = "instantaneous" | `#path-visibility` |
| `#spotlight-controls` | bg = spotlight modes | `#background-visibility` |
| `#aov-controls` | bg = AOV modes | `#background-visibility` |

### 11.5 State-Dependent UI

| State | UI Change |
|-------|-----------|
| No waypoints | Show help placeholder, hide sections |
| First waypoint added | Hide help, show sections, open Marker |
| Waypoint selected | Enable Marker/Text/Path sections |
| No selection | Disable Marker/Text/Path sections |
| "All Waypoints" selected | Hide label text input |
| Animation playing | Show pause button, hide play button |
| Animation paused | Show play button, hide pause button |

---

## Appendix: File References

| File | Purpose |
|------|---------|
| `index.html` | HTML structure, all elements |
| `styles/main.css` | All styling, CSS variables |
| `src/controllers/UIController.js` | UI event handling, slider conversions |
| `src/controllers/SectionController.js` | Collapsible sections logic |
| `src/handlers/InteractionHandler.js` | Canvas/keyboard interactions |
| `src/config/helpContent.js` | Help text content |
| `src/config/constants.js` | Default values, ranges |

---

**End of UI Element Inventory**

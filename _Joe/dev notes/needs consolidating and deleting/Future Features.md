

# To Do List
- Slider and switches can be the UoN dark blue, not black (just text has to be black)
- edit/preview warning message appearance / dissapearence should not cause header to rejig
- ensure undo works properly (is undoing to too fine increments)


# Philosophy

- Each feature should maintain the codebase's standards: computational efficiency, clear documentation, modular architecture
- Features in the same phase can sometimes be combined into a single session if they share infrastructure
- Test each feature thoroughly before moving to the next
- Commit and deploy after each completed feature or logical group

# Future features

- Function to convert images to Okabe–Ito palette / poster (offer three images and choose preference, using different processes (i.e. 1 is straight convert, 2 is distributed, 3 use dithering)
- Comet mode for spotlight reveal modes
- Improve auto position (either place more optimally or place nearest existing position with fewest collisions)
- Change the “example backgrounds” into example projects with waypoints/paths
    - Prism with broad light getting split into spectrum
    - Electric circuit getting walked through and annotated (ChatGPT help identify)
    - Something to do with cells (can Mandy help?)
    English annotated document? Students explaining something? Bibliography explanation?
    Legal process flow chart?
    Medical?
    Treasure hunt
- For UI controls, tweak the background equation ranges, UI displayed ranges, UI control curves, and display unit (if any).
- path shape "randomised" is periodic at low frequencies and never perceptually low frequency. can we feasibly move to a model of introducing points at a set period (the frequency) and randomising the amplitude of each point?
- export looks low res, how can res be preserved? especially in zoom modes
- make a drone icon for garys path head
- waypoint / path / text etc (all use controls) need to be in relative sizes, so there is consistency between different canvas sizes. We need to tweak the background equation ranges, UI displayed ranges, UI control curves, and display unit (if any).


# Route Plotter v3.1.413+ — UX & AAA Iteration Plan

Source: `route_plotter_v3_1_400_ux_wcag_aaa_review.md`

## Guiding Principles

- **Relative units only** (rem, em, %) — no new px values
- **Token-first** — all new colours/sizes via `tokens.css`
- **EventBus integration** — new interactions emit events for decoupling
- **Single responsibility** — each phase produces a testable, committable unit

---

## Phase 1: Border Role Separation (P0)

**Goal:** Meet WCAG 3:1 non-text contrast for interactive elements.

### Token Changes (`tokens.css`)

Add explicit interactive border token:

```css
/* Border hierarchy - AAA non-text contrast */
--border-passive: #D8D8D8;      /* panel separators, dividers */
--border-interactive: #767676;  /* inputs, buttons, list items (4.5:1 on white) */
```

### CSS Changes (`main.css`)

1. **Inputs/selects/textareas**: `border-color: var(--border-interactive)`
2. **Buttons (secondary/ghost)**: `border-color: var(--border-interactive)`
3. **Waypoint rows**: `border-color: var(--border-interactive)` on bottom
4. **Dropdowns**: `border-color: var(--border-interactive)`
5. **Panel separators**: keep `var(--border-passive)` or `var(--border-quiet)`

### Files Touched
- `styles/tokens.css`
- `styles/main.css`

### Test
- Contrast checker on input borders vs white background (target ≥3:1)

---

## Phase 2: Swatch Picker Compaction (P0)

**Goal:** Reduce visual weight; swatches should not compete with controls.

### Changes (`swatch-picker.css`)

1. Reduce swatch height: `max-height: 1.75rem` (28px)
2. Reduce gap: `gap: 0.125rem`
3. Legend font-size: `var(--text-xs)` (0.75rem)

### Files Touched
- `styles/swatch-picker.css`

### Test
- Visual check: swatches feel subordinate to nearby controls
- Touch target still ≥44px via padding if needed

---

## Phase 3: Waypoint List Calmness (P1)

**Goal:** Reduce row chrome; clearer state hierarchy.

### Token Additions

```css
--waypoint-row-bg: transparent;
--waypoint-row-hover: rgba(0,0,0,0.04);
--waypoint-row-selected: #EDEDED;
--waypoint-accent-selected: #161616;  /* left bar */
```

### CSS Changes

1. Default row: `background: var(--waypoint-row-bg)`
2. Hover: `background: var(--waypoint-row-hover)`
3. Selected: `background: var(--waypoint-row-selected)` + 3px left accent
4. Focus: standard focus ring (already exists)
5. Ensure drag handle + delete button are ≥2.75rem (44px) touch targets

### Files Touched
- `styles/tokens.css`
- `styles/main.css`

---

## Phase 4: Keyboard Waypoint Reorder (P0 — AAA requirement)

**Goal:** Provide non-drag method to reorder waypoints.

### Approach
- Add "Move up" / "Move down" icon buttons per waypoint row
- Visible on row focus/hover; always in DOM for screen readers
- Use existing `eventBus.emit('waypoint:reorder', { id, direction })`
- Announce via existing aria-live region

### JS Changes (`main.js` or new `WaypointListController.js`)

```js
// On move button click:
this.eventBus.emit('waypoint:reorder', { waypointId, direction: 'up' | 'down' });
this.announce(`Waypoint moved ${direction}`);
```

### HTML Changes (`index.html`)
- Add move buttons inside `.waypoint-item` template

### CSS Changes
- `.waypoint-move-btn { opacity: 0 }` by default
- `.waypoint-item:hover .waypoint-move-btn, .waypoint-item:focus-within .waypoint-move-btn { opacity: 1 }`

### Files Touched
- `index.html` (template)
- `src/main.js` (reorder handler)
- `styles/main.css`

---

## Phase 5: Reflow Breakpoint (P0 — AAA reflow)

**Goal:** Avoid horizontal scroll at 200–400% zoom.

### CSS Changes (`main.css`)

```css
@media (max-width: 72rem) {  /* ~1152px — triggers at ~200% on 1440px laptop */
  #app {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  .sidebar.left { order: 1; border-right: none; width: 100%; }
  .main-content  { order: 2; }
  .sidebar.right { order: 3; border-left: none; border-top: 1px solid var(--border-passive); width: 100%; }
}
```

### Test
- 400% zoom on 1440px viewport — no horizontal scroll

### Files Touched
- `styles/main.css`

---

## Phase 6: Last-Interacted Section (P1)

**Goal:** Subtle visual cue for most recently used accordion section.

### Existing Infrastructure
Tokens already exist: `--cap-last`, `--cap-last-open`

### JS Changes (`UIController.js` or `main.js`)

```js
function setLastSection(sectionEl) {
  document.querySelectorAll('.settings-section[data-last]').forEach(el => el.removeAttribute('data-last'));
  sectionEl?.setAttribute('data-last', 'true');
}

// Attach to input/change/pointerdown on .settings-section
```

### CSS Changes

```css
.settings-section[data-last="true"] > .section-header {
  background: var(--cap-last);
}
.settings-section[data-last="true"].open > .section-header {
  background: var(--cap-last-open);
}
```

### Files Touched
- `src/controllers/UIController.js` (or `main.js`)
- `styles/main.css`

---

## Phase 7: Canvas Vertical Centering (P1)

**Goal:** Centre canvas in available vertical space; playbar stays attached below.

### CSS Changes

```css
.main-content {
  display: grid;
  grid-template-rows: 1fr auto;
  place-items: center start;
}
.canvas-wrapper {
  place-self: center;
}
.playbar {
  place-self: end center;
}
```

### Files Touched
- `styles/main.css`

---

## Phase 8: Reduced Motion for Beacons (P2 — AAA motion)

**Goal:** Pulse beacon respects `prefers-reduced-motion`.

### JS Changes (`BeaconRenderer.js`)

Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and:
- Skip pulse animation entirely, or
- Reduce amplitude and frequency

### Files Touched
- `src/services/BeaconRenderer.js`

---

## Phase 9: Add Waypoint Button + Arrow Nudge (P2 — AAA extras)

**Goal:** Non-mouse method to add and position waypoints.

### Approach
1. "Add Waypoint" button in header or waypoint panel
2. Adds waypoint at canvas centre (or end of path)
3. Arrow keys nudge selected waypoint (already exists — verify)

### Files Touched
- `index.html`
- `src/main.js`

---

## Questions Before Starting

1. **Phase 4 (reorder buttons):** Prefer icons (↑↓) or text ("Up"/"Down")?
2. **Phase 5 (breakpoint):** 72rem (~1152px) work for your typical viewport, or prefer a different threshold?
3. **Phase 6 (last-interacted):** Use the existing `--cap-last` grey tokens, or a subtle blue tint as the review suggests?

---

## Commit Strategy

Each phase = one commit, e.g.:
- `feat(a11y): Phase 1 — border role separation for AAA non-text contrast`
- `style: Phase 2 — compact swatch picker`
- ...

Build and test after each phase before proceeding.



add import/export of custom key commands
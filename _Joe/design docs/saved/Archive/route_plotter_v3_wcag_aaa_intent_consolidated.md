# Route Plotter v3 — WCAG AAA intent: consolidated approach

This document consolidates the “AAA WCAG thinking” for Route Plotter v3 into a practical, academically defensible standard.

---

## 0) Reality check: what “WCAG AAA” means for a web app

- **AAA is a very high bar** and includes criteria that may be irrelevant or impractical for many interactive apps (e.g., sign language for prerecorded video, strict reading-level criteria, etc.).
- A defensible approach is:
  1) **Meet all A + AA** (baseline).
  2) Meet **as many AAA criteria as are applicable** (“AAA intent”).
  3) For non‑applicable or impractical AAA items: **document scope + rationale**.

---

## 1) The three pillars for AAA intent

### Pillar A — Perceivable
Users can perceive content and state regardless of vision/hearing.

### Pillar B — Operable
Everything works with keyboard, with adequate target size, without timing traps.

### Pillar C — Robust + understandable
Assistive tech can parse it; users can recover from mistakes; interaction is predictable.

For Route Plotter, the biggest risks are: **focus visibility, keyboard parity (drag/reorder), canvas semantics, and target sizes**.

---

## 2) Non‑negotiables (“Definition of Done” candidates)

### 2.1 Contrast and colour
- **Text contrast target:** 7:1 (AAA enhanced contrast) for normal text.
- Keep text **black on light backgrounds** (your direction is correct).
- Don’t rely on colour alone for meaning:
  - Selected swatch needs outline/checkmark, not only fill colour.
  - Selected waypoint needs left bar + background + focus ring.

**DoD**
- All labels/value/help text pass contrast checks at 100% and 200% zoom.
- All states remain distinguishable in greyscale.

### 2.2 Focus visibility and keyboard operation
- Every interactive element must have a **strong, consistent `:focus-visible` ring**.
- No keyboard traps (modals, popovers, swatch picker).
- Logical tab order; no surprise jumps.

**DoD**
- Core workflow is possible without mouse: upload → add waypoint → select → edit marker/icon/colour → preview → export.

### 2.3 Target sizes (AAA intent)
- Aim for ~**44×44 CSS px** hit targets via padding (even on desktop).
- Common offenders: tiny delete “x”, drag handles, chevrons, slider thumbs.

**DoD**
- Drag handle and delete have large hit boxes (icons can remain small).
- Sliders have large thumb + generous track padding.

### 2.4 Motion and flashing
- Respect `prefers-reduced-motion`.
- Avoid interaction-triggered animation unless the user can reduce/disable it.
- No flashing.

**DoD**
- Reduced motion turns beacon/pulse into static or minimal.

### 2.5 Error prevention and reversibility
- Provide undo (you already have undo/redo).
- Confirm destructive actions only when needed; otherwise rely on undo.

**DoD**
- Deleting a waypoint is undoable (preferred) or confirmable.

---

## 3) What AAA intent looks like in Route Plotter specifically

### 3.1 Canvas/map area: provide accessible equivalents
Canvas is inherently difficult for accessibility. Your **waypoint list** becomes the accessible representation of canvas objects.

Ensure canvas actions have equivalents:
- select waypoint (list)
- reorder (buttons / keyboard shortcut; not drag‑only)
- adjust position (numeric fields or keyboard nudge)
- announce selection changes (aria-live)

**DoD**
- Every waypoint can be selected/edited without interacting with the canvas.
- Selection changes are announced (e.g., “Waypoint 7 selected”).

### 3.2 Drag and drop / reorder
AAA intent means **no drag‑only operations**.
- Provide “Move up / Move down” controls (visible on focus/hover), or
- Provide keyboard shortcuts.

**DoD**
- Reorder works with keyboard only.

### 3.3 Sliders
Sliders are frequent a11y failure points.
- Prefer native `<input type="range">`.
- Ensure:
  - visible label
  - keyboard increments (arrow keys)
  - numeric value readout
  - `aria-valuetext` if units (e.g., “1.5 seconds”)

**DoD**
- Every slider is fully keyboard operable and has a visible value.

### 3.4 Modals and popovers (Welcome, Apply-to-all, colour picker)
Must have:
- focus trap
- ESC closes (for non-destructive)
- correct ARIA: `role="dialog" aria-modal="true"`
- return focus to the trigger on close

**DoD**
- Keyboard can open/close without losing place.
- Screen readers announce dialog title.

### 3.5 Toasts / tips (“check Preview mode”)
- Use `role="status"` for non-urgent tips.
- Don’t steal focus.
- Must be dismissible and stay dismissed.

**DoD**
- Toast never breaks keyboard flow.

---

## 4) Visual system for AAA intent (clean and defensible)

- Greyscale surfaces + black text is an excellent path to AAA contrast.
- Use colour only for:
  - focus ring
  - primary CTA
  - map/canvas elements

---

## 5) Testing regimen (how to prove it)

### 5.1 Automated (fast feedback)
- Lighthouse + axe/WAVE for obvious failures.

### 5.2 Manual (required for AAA intent)
1) **Keyboard-only walkthrough**: full workflow.
2) **Zoom 200% + 400%**: no overlap, no horizontal scroll, all controls reachable.
3) **Reduced motion**: animations suppressed.
4) **Screen reader sanity** (NVDA/VoiceOver):
   - headings/landmarks
   - dialog announcement
   - labels for inputs
   - waypoint selection announcement
5) **Contrast spot checks**:
   - header bands
   - disabled states
   - secondary text

**DoD**
- Maintain an “a11y audit log” markdown: what you tested, what passed, what’s out of scope, what’s planned.

---

## 6) Practical priority list for next iterations

1) **Focus ring consistency** everywhere (buttons, swatches, list rows, sliders, canvas container).
2) **Target sizes**: delete/drag/swatch/slider thumb.
3) **Keyboard parity**: reorder + any drag-only behaviours.
4) **Modal/popup focus management**.
5) **Canvas alternatives**: ensure everything is doable via side panels.

---

## Optional: repo policy snippet (copy/paste)

> Route Plotter v3 aims to meet WCAG 2.2 A/AA and pursue WCAG AAA where applicable (“AAA intent”).  
> Each release must pass a keyboard-only workflow test, 200–400% zoom layout checks, reduced-motion behaviour, and a basic screen-reader sanity pass.  
> Any AAA criteria not applicable to this app are documented in the accessibility audit log with rationale.


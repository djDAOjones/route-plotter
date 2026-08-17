# Route Plotter v3 — Swatch Picker Spec (Okabe–Ito canvas colours)

This spec replaces native `<input type="color">` controls for **map/canvas data colours** with an accessible swatch picker that enforces:

- **Okabe–Ito** (`--map-series-1..8`) for **data series** (marker + path stroke)
- **Neutral presets** for **path head** colour (not a data series)

Targets from `ui_list.md`:
- Marker colour: `#dot-color`
- Path colour: `#segment-color`
- Path head colour: `#path-head-color`

---

## 1) Design intent (why)

Native colour pickers allow “pretty but wrong” palettes and break:
- projection legibility
- colour-blind safety
- semantic consistency

Swatches enforce the system:
- UI is IBM-style
- Canvas data is Okabe–Ito
- Non-data canvas ink is neutral

---

## 2) Behavioural requirements (must)

### 2.1 Accessibility
- Keyboard navigable (arrow keys across swatches)
- `Tab` enters/exits the group (roving tabindex or native radio behaviour)
- Screen reader labels for each swatch
- Visible focus ring using `--focus`
- No colour-only meaning: selected state uses **outline + checkmark** (optional)

### 2.2 Values + integration
- The picker must write to the existing hidden input (`#dot-color` / `#segment-color` / `#path-head-color`) so current rendering logic keeps working.
- The picker must be able to read the current input value on load and pre-select the nearest swatch (or “Custom”).

### 2.3 Modes
**Mode A — Data palette (Okabe–Ito)**
- 8 swatches bound to CSS vars `--map-series-1..8`
- Optional radio: `Auto` (app assigns next available series colour)

**Mode B — Neutral palette (heads/ink)**
- 3–4 neutral swatches:
  - Ink: `--map-ink` (default)
  - Paper: `--map-paper`
  - Mid: `--map-mid`
  - Optional: `--map-ink-soft`

### 2.4 Optional advanced custom
- Hidden behind a “Custom…” disclosure button
- If enabled:
  - shows a native `<input type="color">`
  - selecting a custom colour selects “Custom” radio
- If you want maximum governance, disable Custom entirely.

---

## 3) Recommended markup

### 3.1 Replace the old input in UI with:

```html
<!-- Keep the original input, but hide it from sighted users -->
<input id="dot-color" type="color" value="#FF6B6B" class="sr-only" aria-hidden="true">

<div class="swatch-picker"
     data-target-input="#dot-color"
     data-mode="okabe-ito"
     data-label="Marker colour"
     data-allow-custom="false">
</div>
```

Same for `#segment-color`.

For head colour:

```html
<input id="path-head-color" type="color" value="#111111" class="sr-only" aria-hidden="true">

<div class="swatch-picker"
     data-target-input="#path-head-color"
     data-mode="neutral-ink"
     data-label="Path head colour"
     data-allow-custom="true">
</div>
```

---

## 4) Interaction spec

### 4.1 Default rendering
- Display 8 swatches in a grid (4×2 or 8×1 depending on width)
- Each swatch is a radio button with label
- Selected swatch shows:
  - 2px inner border (white) + 2px outer border (focus colour or neutral)
  - optional check glyph

### 4.2 Keyboard
- `Tab` into group → focuses currently selected swatch
- Arrow keys move selection:
  - Left/Right: previous/next
  - Up/Down: row navigation (grid aware)
- `Space` selects focused swatch (radio default)
- `Esc` closes Custom disclosure (if open)

### 4.3 Disabled state
If the setting is disabled due to “no waypoints selected”:
- disable the entire picker (fieldset disabled)
- reduce opacity and prevent pointer events

---

## 5) Colour mapping

### 5.1 Okabe–Ito swatches
Bind these to CSS vars and read their computed value at runtime.

| Swatch | CSS var | Label |
|---|---|---|
| 1 | `--map-series-1` | Blue |
| 2 | `--map-series-2` | Orange |
| 3 | `--map-series-3` | Bluish green |
| 4 | `--map-series-4` | Vermillion |
| 5 | `--map-series-5` | Reddish purple |
| 6 | `--map-series-6` | Sky blue |
| 7 | `--map-series-7` | Yellow (outline always) |
| 8 | `--map-series-8` | Black |

### 5.2 Neutral inks (for path head)
Add these map-specific neutrals (recommended):

```css
--map-ink: #111111;
--map-ink-soft: #525252;
--map-mid: #6f6f6f;
--map-paper: #ffffff;
```

---

## 6) Visual styling rules

- Swatch size: 28–32px square
- Click target: 44px min (wrap swatch in a 44px label)
- Always show focus ring around selected item on keyboard focus
- Yellow swatch must show a permanent outline (use `--map-marker-stroke`)

---

## 7) QA checklist

- [ ] Tab + arrows work correctly
- [ ] Screen reader announces “Marker colour, radio, selected”
- [ ] Picker writes valid hex into target input
- [ ] Existing rendering updates without code changes
- [ ] `prefers-reduced-motion` doesn’t animate unnecessarily
- [ ] Yellow remains visible on bright map backgrounds (outline enforced)

---

## 8) Implementation artefacts

See:
- `route_plotter_v3_swatch_picker.css`
- `route_plotter_v3_swatch_picker.js`
- `swatch_picker_demo.html`

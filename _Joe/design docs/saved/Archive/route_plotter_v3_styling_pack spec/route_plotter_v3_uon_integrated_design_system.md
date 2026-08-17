# Route Plotter v3 — UoN UI + Okabe–Ito Map Design System (AAA-first)

This document is the **single source of truth** for wiring Route Plotter v3’s **CSS + HTML + JavaScript** to a new colour scheme and visual system that prioritises:

- **Consistency**
- **Longevity**
- **Accessibility (WCAG AAA-first for text, strong affordances for controls)**
- **Low maintenance**
- **Academic defensibility**

UI uses **UoN colours** through a **Carbon/IBM role-based token structure**.  
Map/canvas data series use **Okabe–Ito only**.

---

## 1) Non‑negotiables

### 1.1 Default is black text on white
- Most UI text uses `--text-01` on `--ui-background` / `--ui-01` / `--ui-02`.
- If you’re tempted to “tone down” text with pale grey, don’t: **AAA requires contrast**.

### 1.2 Coloured text is rare
Allowed, by default:
- Links (always underlined)
- Small, non-essential accents (e.g., a chip dot) **only if meaning is duplicated by label/icon**

Not allowed as your default “emphasis” technique:
- Error/warning/info body text in red/orange/sky-blue on white (typically fails AAA).

### 1.3 Light-on-dark is for impact moments only
Examples:
- Modal backdrop (overlay)
- A single critical toast/banner (e.g., “Exporting…”)
- A destructive confirmation step

Everything else stays light.

### 1.4 UI meaning is not map meaning
- **UI state colours** (focus, selected, disabled, notices) use **UoN UI tokens**.
- **Data series** (marker colours, segment colours) use **Okabe–Ito tokens only**.
- Selection on the canvas is done by **outline/thickness/halo**, not “burning” a data colour.

### 1.5 Never rely on colour alone
Every state that matters must also use at least one of:
- a label change
- an icon
- shape/outline
- thickness
- pattern (dashed vs solid)
- position/ordering
- motion (subtle, optional)

---

## 2) File set + load order

### Required CSS
1) `route_plotter_v3_tokens_uon_carbon_AAA.css`  
2) `route_plotter_v3_components_uon_carbon_AAA.css`  
3) `route_plotter_v3_canvas.css` *(optional helpers)*  
4) `route_plotter_v3_swatch_picker.css` *(if using swatch picker)*

### Required JS (if using swatch picker)
- `route_plotter_v3_swatch_picker.js`

### Load order
```html
<link rel="stylesheet" href="route_plotter_v3_tokens_uon_carbon_AAA.css">
<link rel="stylesheet" href="route_plotter_v3_components_uon_carbon_AAA.css">

<link rel="stylesheet" href="route_plotter_v3_canvas.css">
<link rel="stylesheet" href="route_plotter_v3_swatch_picker.css">

<script type="module">
  import { attachSwatchPickers } from "./route_plotter_v3_swatch_picker.js";
  window.addEventListener("DOMContentLoaded", () => attachSwatchPickers());
</script>
```

---

## 3) Colour system (UI)

### 3.1 Role-based tokens
You do **not** choose colours per component. You choose a **role** and use the token.

Core surfaces:
- `--ui-background` (page)
- `--ui-01` (panels)
- `--ui-02` (cards/controls)

Borders:
- `--border-subtle` for layout dividers (not relied on for identifying controls)
- `--border-strong` for control boundaries (meets non-text contrast)
- `--border-strongest` for pressed/active emphasis and selected outlines

Interactive:
- `--interactive-01` is your only “brand CTA background” by default.

### 3.2 Contrast governance (how we hit AAA)
- Helper/placeholder text uses `--text-03` which is set to the **lightest grey that still meets AAA on white**.
- Inputs/selects and list items use `--border-strong` so boundaries are always visible.
- Focus uses a **two-layer ring** (`--focus-inner` then `--focus-outer`) so it remains visible on all light surfaces.

### 3.3 Links
- Links are **underlined**. Colour alone is not the indicator.
- `--link-01` = Nottingham Blue (AAA on white)
- `--link-visited` = Civic Purple (AAA on white)

### 3.4 Support states (error/success/warning/info)
Pattern (AAA-safe):
- Background: tinted (`--support-*-bg`)
- Border/icon: strong (`--support-*` or `--support-*-strong`)
- Text: **black/dark** (`--text-01`)

Warning and info use **derived “strong” colours** to ensure visible borders on their tints:
- `--support-warning-strong`
- `--support-info-strong`

---

## 4) Typography roles

Fonts:
- UI: `--font-sans` (IBM Plex Sans)
- Numeric readouts: `--font-mono` (IBM Plex Mono)

Roles:
- H1 (app title): `--type-h1`
- H2 (panel titles): `--type-h2`
- Section labels: `--type-label` (uppercase, letterspacing)
- Body: `--type-body` (default)
- Caption/help: `--type-caption` (still AAA contrast via tokens)
- Mono: `--type-mono` (timeline/value readouts only)

Rules:
- Don’t use colour to “turn down” information density; use **structure** (spacing, headers, grouping) instead.
- Use mono only for numbers/time.

---

## 5) Spacing scale (Carbon-ish)

Use the token rhythm (2/4/8 multiples):
- Default gap: `--space-2` (8px)
- Panel padding: `--space-4` to `--space-5` (16–24px)
- Section spacing: `--space-3` to `--space-4`

Rule:
- If a layout needs a “new” spacing value, it’s usually a sign you should regroup components, not invent pixels.

---

## 6) Motion rules

Durations:
- fast: `--motion-fast` (hover/focus)
- medium: `--motion-med` (expand/collapse)
- slow: `--motion-slow` (modal)

Principles:
- Motion must explain state change.
- Motion is optional: the tokens collapse timing in `prefers-reduced-motion: reduce`.

---

## 7) Icon rules

Recommendation:
- Use Carbon Icons to match Carbon’s visual language.

Rules:
- Use a consistent size system (16/20/24).
- Icon-only controls must have an accessible label (`aria-label`).
- Icons never replace critical text labels.

---

## 8) Map/canvas styling principles (Okabe–Ito only for data)

### 8.1 Data series
- Markers and segments: `--map-series-1..8`
- Never use UoN UI colours for series.

### 8.2 Legibility on real basemaps
- Always outline markers/paths (maps are noisy)
- Yellow series must always have an outline
- Labels use:
  - neutral text + white halo
  - fixed minimum size (16px) and weight (600)

### 8.3 Selection and editing affordances
- Selection uses `--map-selection-outline` (outer focus blue)
- Selection is also indicated by:
  - increased stroke width
  - handles and bounding boxes
  - optional dashed overlay (not a new colour)

---

## 9) HTML/JS wiring rules

### 9.1 Don’t hard-code colours in JS
Read tokens from `:root` when needed:

```js
const root = getComputedStyle(document.documentElement);
const okabe1 = root.getPropertyValue("--map-series-1").trim();
const focusOuter = root.getPropertyValue("--focus-outer").trim();
```

### 9.2 Replace `<input type="color">` for data colours
- Use the swatch picker (Okabe–Ito) for:
  - marker colour
  - segment colour
- Keep a neutral-ink picker for:
  - path head colour

This keeps the system enforceable and low maintenance.

---

## 10) Practical QA checklist (what to test before claiming AAA)

- [ ] All helper/placeholder/caption text passes AAA contrast on light surfaces.
- [ ] Inputs are identifiable without colour vision (borders visible).
- [ ] Focus ring is visible on all backgrounds and components.
- [ ] No state relies on colour alone (errors/warnings/selection).
- [ ] Map labels are readable on light and dark basemap areas (halo works).
- [ ] Keyboard-only usage is possible end-to-end.

---

Let me know if you have any queries :-)

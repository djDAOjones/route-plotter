# Route Plotter v3.1.418 — UX + WCAG AAA Intent Review (Delta Spec)  
*(focus: right panel selection sync + waypoint renaming UX + AAA-friendly interaction patterns)*

## 0) Snapshot of what’s improved (keep doing this)
1. Right panel is calmer than earlier iterations: fewer heavy tiles; clearer hierarchy.
2. “+ Add Waypoint” is a strong affordance for novices (it reduces the “what do I do first?” problem).
3. Selection styling is closer to a proper “stateful list” (selected item reads clearly).

---

## 1) Issue: Right waypoint list highlight can desync from canvas selection
### Symptom
- User selects a waypoint by clicking on the canvas.
- The previously clicked waypoint row in the right list still appears “selected/highlighted”.

### Likely root cause (state model)
You currently have **two selection concepts**:
- `selectedWaypoint` (a single “primary” selection)
- `selectedWaypoints` (a set for multi-select / select-all workflows)

If canvas selection updates **only** `selectedWaypoint` but doesn’t reset `selectedWaypoints`, the list renderer can keep showing the old row as selected (because it’s still in `selectedWaypoints`).

### UX requirement
Selection must be **single source of truth** and **predictable**:
- Clicking the canvas = set the *primary* selection
- Unless multi-select modifier is used (Shift/Ctrl), it should clear any old selection set.

### Fix spec (behaviour)
#### A) When canvas selects a waypoint (no multi-select modifier)
1. Set `selectedWaypoint = waypoint`
2. Set `_allWaypointsSelected = false`
3. Clear `selectedWaypoints`
4. Optionally: add the waypoint into `selectedWaypoints` **only if** it’s a “major” waypoint that appears in the list
5. Re-render the right list

#### B) When canvas selects a “minor/intermediate” waypoint (if applicable)
You have two acceptable options:

**Option B1 (simplest + consistent):**
- Clear `selectedWaypoints`
- Show **no** major waypoint highlighted
- Add a small status line at top of the right panel:  
  “Intermediate point selected (between Waypoint 2 → Waypoint 3)”

**Option B2 (more guided):**
- Clear `selectedWaypoints`
- Highlight the **nearest major waypoint** (or the segment’s start waypoint)
- Status line clarifies what’s actually selected:
  “Intermediate point selected; editing applies to Waypoint 2 style”

Pick one. B1 is more honest and less magical.

### Focus vs selection (AAA / usability)
Right now users can interpret “focus ring / focus styling” as “selected”. Separate them:

- **Selection** = persistent background + left accent bar
- **Focus** = outline ring only (no background change)

Also: clicking the canvas should move focus away from the list row if the canvas is an interactive surface.

#### Canvas focus spec
- Add `tabindex="0"` to the canvas container (or the canvas itself)
- On pointerdown/click on canvas: call `.focus()` on it
- Provide visible focus ring on the canvas when focused

---

## 2) How waypoint renaming should work (recommended pattern)
Renaming needs to be:
- fast (mouse + keyboard),
- non-modal (no annoying dialog),
- accessible (screen readers + keyboard),
- resilient (empty names, duplicates).

### Recommended UX (do both)
#### A) Inline rename in the right list (primary)
**Entry points**
1. Double-click the waypoint name text
2. Keyboard: **F2** when a row is focused
3. Optional small “Rename” icon/button (only visible on hover/focus)

**Editing behaviour**
1. Replace the title text with an `<input type="text">`
2. Autofocus the input and select all text
3. Enter = commit  
4. Esc = cancel (revert)  
5. Blur = commit (but only if the name actually changed)

**Validation rules**
1. Trim whitespace
2. Empty string ⇒ clear custom name (`name = null`) so UI falls back to default `Waypoint N`
3. Max length: **40** characters (hard cap); optionally show a counter at 30+
4. Duplicates allowed (don’t block), but if duplicates exist, consider subtle disambiguation in UI (e.g., tooltip shows waypoint ID)

**Post-commit**
- Row returns to normal view mode
- Focus returns to the row button (not lost)

**AAA notes**
- Input must have an accessible name:
  - `aria-label="Waypoint name"`
  - or a visually-hidden `<label>`
- Add hint via `aria-describedby`: “Press Enter to save, Esc to cancel”
- Announce rename completion in a polite live region:
  - “Renamed to ‘Library Entrance’”

#### B) Rename in the left panel (secondary, always-available)
Add a “Name” field at the top of the **Marker** section (or above it) that edits the selected waypoint’s name.
- This helps users who don’t discover inline editing.
- It’s also easier for screen reader users who navigate forms.

### Data model + events
- Store user-defined name on the waypoint object: `waypoint.name`
- Keep waypoint ID stable (renaming must not change IDs)
- Emit a single event when name changes:
  - `waypoint:name-changed` `{ id, name }`
- Ensure list + canvas labels re-render on that event.

---

## 3) To-do list (Windsurf-ready, no grouping)
### 3.1 Fix selection desync
1. Update the global “waypoint selected (canvas)” handler:
   - Set `_allWaypointsSelected = false`
   - Clear `selectedWaypoints`
   - Set `selectedWaypoint = newlySelected`
   - If `newlySelected.isMajor === true`, add it to `selectedWaypoints`
   - Trigger right list re-render
2. Ensure “select all” mode is cancelled whenever a single waypoint is selected (unless explicitly re-enabled).
3. Add a UI state for “minor waypoint selected” (if minors exist):
   - A small text line above the waypoint list (right panel)
   - It must be readable at 200% zoom and not rely on colour alone

### 3.2 Separate focus styling from selection styling
1. Update list row CSS so `.is-selected` and `:focus-visible` are visually distinct.
2. Remove any styling that makes `:focus` look identical to “selected”.
3. Ensure focus ring has strong contrast and 2px+ apparent thickness at normal zoom.

### 3.3 Make the canvas focusable and move focus on click
1. Add `tabindex="0"` to the canvas element or its wrapper.
2. On click/pointerdown on canvas: call `canvasEl.focus()`.
3. Add visible `:focus-visible` ring around canvas wrapper.

### 3.4 Implement waypoint renaming (inline)
1. Add “rename mode” state per waypoint row:
   - `isRenamingWaypointId`
2. Add event handlers:
   - Double-click title → enter rename mode
   - F2 on focused row → enter rename mode
   - Enter → commit
   - Esc → cancel
   - Blur → commit
3. Commit logic:
   - Trim
   - Empty => `null`
   - Max length => slice or block input beyond 40 chars
4. Emit `waypoint:name-changed` after commit.
5. Update list rendering to display `waypoint.name ?? defaultName`.

### 3.5 Implement waypoint renaming (left panel)
1. Add “Waypoint Name” input in Marker section:
   - Only enabled when exactly one waypoint is selected
2. Keep it in sync with inline renaming:
   - If rename happens in list, left input updates
   - If rename happens in left input, list updates

---

## 4) Tech specs (greyscale-friendly + AAA intent)
### 4.1 Right list row states (hex + relative units)
Use these as defaults (adjust if your existing tokens already cover them):

- Base row background: `#FFFFFF`
- Hover background: `#F3F4F6`
- Selected background: `#E5E7EB`
- Selected accent bar: `#111827`
- Text: `#111827`
- Secondary text: `#374151`
- Borders (light): `#D1D5DB`
- Focus ring (accessible): `#0F62FE` *(Carbon blue; keep it even if greyscale UI)*

Sizing (relative):
- Row height min: `2.75rem` (AAA-ish target size)
- Icon button hit-area min: `2.75rem × 2.75rem`
- Accent bar width: `0.25rem`
- Focus ring: `0.2rem` with `0.15rem` offset

### 4.2 Class-level spec (map to your existing class names)
- `.waypoint-rowBtn`
  - Default: background `#fff`, border `1px solid #D1D5DB`
  - Hover: background `#F3F4F6`
  - Focus-visible: outline `0.2rem solid #0F62FE`, outline-offset `0.15rem`
- `.waypoint-rowBtn.is-selected`
  - background `#E5E7EB`
  - left border accent: `0.25rem solid #111827`
- `.waypoint-rowBtn.is-selected:focus-visible`
  - keep both: selected background + focus outline (don’t remove focus ring)
- `.waypoint-titleInput` (rename mode)
  - min-height `2.75rem`
  - padding `0.4rem 0.6rem`
  - border `1px solid #111827` (stronger while editing)
  - focus-visible: outline `0.2rem solid #0F62FE`

---

## 5) Open questions (answer these and the UX locks in)
1. Are “minor” waypoints selectable on canvas?  
   - If yes: choose B1 or B2 behaviour above.
2. Should renaming be allowed for:
   - majors only?
   - any selectable point?
3. Do you want waypoint names exported (HTML/video metadata), or purely UI labels?

If you reply with: “minors selectable: yes/no” and “export names: yes/no”, the spec can be tightened further.

# Current Development Tasks

Order matters. Work items should be scoped individually before implementation.

## 1. BUG — Text position not saving in ZIP
Check ZIP export/import to ensure text position is preserved.

## 2. BUG / DESIGN — Global scale affects text too strongly
Investigate how global scale interacts with text position and size.

## 3. FEATURE — Straight vs curved path switch
Add a switch in the right sidebar to toggle path style.

## 4. DOCS — Shift key modifier
Document the shift modifier in README/help.

## 5. FEATURE — Mask others slider
Background mask slider to fade areas outside the active shape.
Current waypoint + text visible.
Paths outside shape not visible.

## 6. BUG — HTML export still uses stale labelPosition logic
HTMLExportService still depends on legacy `labelPosition` and does not reflect the current live label model.
Treat as a separate export correctness bug.

--

## Follow-ups discovered during ZIP text persistence fix

### A. Follow-up — HTML export still uses stale `labelPosition`
Need to determine whether this is harmless legacy, a separate bug, or must-fix.

### B. Follow-up — pre-existing test failures
PathCalculator mock issue, jest.fn() / vi.fn() mismatch, Easing export mismatch.

### C. Follow-up — label system consistency audit
Check for other stale or ghost label/text properties across serialization, export, copy, dirty tracking, and render paths.
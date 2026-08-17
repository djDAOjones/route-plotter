# UI/UX Audit — Route Plotter v3.1.473

**Date:** 2026-02-08  
**Framework:** IBM Carbon Design Philosophy (no component library) + WCAG 2.2 AAA  
**Heuristic lens:** Nielsen's 10 Usability Heuristics  
**Target viewports:** 1440×900 → 2560×1440 → 4K  

---

## Executive Summary

The app has a solid foundation: good token system, accessible focus rings, Okabe-Ito palette, and a clear three-column layout. The main issues fall into three themes:

1. **Header congestion** — too many items competing for one horizontal row, causing wrapping and layout instability
2. **Information hierarchy** — left sidebar sections all look identical; users can't scan quickly to find what they need
3. **System status gaps** — several interactions lack feedback, violating Nielsen #1

Below I list every issue I found, grouped by Nielsen heuristic, with a severity rating and proposed fix. Issues marked **[Q]** are questions where I'd like your input before implementing.

---

## N1: Visibility of System Status

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N1-1 | **No selected-waypoint indicator in sidebar heading.** When a waypoint is selected, the left sidebar says "Waypoint Settings" but doesn't say *which* waypoint. User must look at the right sidebar or the canvas to confirm. | Medium | Add the waypoint name/number below "Waypoint Settings" (e.g. "Waypoint 3" or the custom name) as a subtitle, Carbon-style `text-helper` colour. When nothing selected, show "No waypoint selected". |
| N1-2 | **Edit/Preview mode state is subtle.** The toggle pill works, but the only mode feedback is the label weight change. The 960×540 and 768×1024 screenshots show the tip banner wrapping badly, competing with the toggle for attention. | Medium | (a) Add a coloured dot or icon next to the active mode label. (b) Truncate/hide the tip banner below 1200px. (c) Consider replacing the tip banner with a one-time toast. |
| N1-3 | **Tip banner text wraps uncontrollably at narrow widths.** Visible in 768×1024 screenshot — the text "Check your sequence in Preview mode before exporting" wraps to 7 lines, pushing other header items down. | High | Set `max-width` on `.tip-banner`, add `text-overflow: ellipsis` or collapse to icon-only below a breakpoint. Alternatively: move tip to a toast or a dedicated row below the header. |
| N1-4 | **Save status pill (`Saved`) is invisible by default (opacity: 0).** Users don't know when autosave fires. | Low | Show a brief flash animation on save. Keep it subtle but visible — 1s fade-in/out. Already partially implemented; just needs tuning. |
| N1-5 | **No loading/progress indicator during video export.** Export can take seconds; no spinner or progress bar. | Medium | Add an indeterminate progress bar or overlay during export. Carbon uses inline loading pattern. |
| N1-6 | **Animation playing state isn't reflected outside the playbar.** If sidebars are scrolled down, there's no global "playing" indicator. | Low | Consider a small pulsing dot next to the play button, or highlight the playbar border while playing. |

---

## N2: Match Between System and Real World

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N2-1 | **"Onset" label in Text section is jargon.** Most users won't know what "Onset" means for text visibility. | Medium | Rename to "Appear" or "Visibility" — matching the Marker Mode / Path Mode pattern. |
| N2-2 | **"Tint" label is ambiguous.** The slider goes from black overlay (−) to white overlay (+). "Tint" suggests colour hue to many users. | Low | Rename to "Overlay" or "Darken / Lighten" or add helper text: "← darker · lighter →". |
| N2-3 | **"Head Icon" in Path section.** The word "Head" is internal dev language. | Low | Consider "Path Tip" or "Arrow Style" — more visual/descriptive. |
| N2-4 | **Segment Speed uses "x" suffix (1.0x) but Duration uses "s" suffix (10s).** These are inversely related concepts shown on the same page with no explanation of their relationship. | Low | **[Q]** Would a brief helper line like "Slower segment = longer duration" be welcome, or too cluttered? |

---

## N3: User Control and Freedom

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N3-1 | **Undo/Redo buttons are text glyphs (↶↷) not SVG icons.** They render inconsistently across platforms and are hard to recognise at small sizes. | Medium | Replace with inline SVG icons matching Carbon's icon style (16px). |
| N3-2 | **Clear button sits in the main header toolbar with equal weight to Save/Export.** It's destructive but looks like a peer action. | High | Move Clear to a less prominent position (e.g. inside a "..." overflow menu) or at minimum add a confirmation modal. Carbon places destructive actions at the end of a toolbar with visual separation. |
| N3-3 | **No keyboard shortcut shown on Clear button tooltip.** Other buttons show shortcuts in their tooltips. | Low | If Clear has no shortcut, that's fine (destructive = good). Just noting the inconsistency. |

---

## N4: Consistency and Standards

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N4-1 | **Header layout wraps unpredictably.** The title "Route Plotter v3.1.473" + tip banner + mode switch + undo/redo + save/open + examples + export + help + clear all fight for one flex row. At 1440×900, the title wraps to two lines ("Route Plotter / v3.1.473") and the version number pushes controls right. | High | **Proposed restructure (needs your approval):** (a) Move version number out of the title — show it in a tooltip or footer. (b) Group related controls into icon-based clusters. (c) Consider a second header row or use an overflow menu for less-used actions. |
| N4-2 | **Inconsistent dropdown styles.** The Export and Examples dropdowns use custom `.dropdown-menu`, but `select` elements in the sidebar use native browser dropdowns. | Medium | **[Q]** Are you open to using the custom dropdown component for sidebar selects too, or do you prefer native for form controls? Both are valid Carbon patterns. |
| N4-3 | **Section headers use ▶ chevron (Unicode).** Carbon uses SVG chevrons that rotate smoothly. The Unicode character doesn't anti-alias well on all platforms. | Low | Replace with an inline SVG chevron (12px). Low effort, noticeable polish. |
| N4-4 | **Button emoji icons (💾 Save, 📂 Open).** These render differently across OS/browser. At 1440×900, they're visually noisy in the header. | Medium | Replace with SVG icons or simple text labels. Carbon uses 16px/20px icon glyphs from a consistent set. |
| N4-5 | **Version number in the title (`Route Plotter v3.1.473`) is long.** Takes up ~200px of precious header space. The version is useful for debugging but not for daily use. | Medium | Show just "Route Plotter" in the header. Put version in a tooltip on the title, or in the Help/About dialog. |
| N4-6 | **"Global Settings" heading breaks the accordion rhythm.** It's a plain `<h2>` sitting between accordion sections, which visually interrupts the consistent section pattern. | Medium | Either (a) make it a non-collapsible section header with the same cap-band styling, or (b) add a visual divider (thin rule + label) in Carbon's "section break" pattern. |

---

## N5: Error Prevention

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N5-1 | **Clear button has no confirmation dialog.** Clicking Clear destroys all work with no undo. | High | Add a confirmation modal: "This will remove all waypoints and reset the canvas. This cannot be undone." with Cancel (primary) and Clear (danger ghost). |
| N5-2 | **Edit mode toggle doesn't warn about unsaved changes.** Switching to Preview might confuse users who think their work is gone (the sidebar disappears). | Low | The tip banner partially addresses this, but it wraps badly. A brief toast "Switched to Preview mode — your work is safe" on first toggle would help. |
| N5-3 | **No validation on Export width/height fields.** User can type 0 or 99999. | Low | Clamp values on blur. Show inline error message if out of range. |

---

## N6: Recognition Over Recall

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N6-1 | **Right sidebar waypoint list shows no preview of waypoint style.** All 8 waypoints look identical — just "≡ Waypoint N ×". | High | Add a small colour dot (matching the waypoint's marker colour) to each row. This is a strong recognition cue and costs almost no space. |
| N6-2 | **Left sidebar sections all have identical grey headers.** The "last-interacted" blue tint helps, but when collapsed, all 7 sections look the same. | Medium | Add a small icon to each section header: 📍 Marker, 🔤 Text, 〰️ Path, 📷 Camera, 🖼 Background, ▶ Animation, 📤 Export. (Using SVG, not emoji — just illustrating the concept.) |
| N6-3 | **Waypoint names default to "Waypoint 1", "Waypoint 2", etc.** These become meaningless after 5+ waypoints. | Low | **[Q]** Would auto-naming based on label text (if set) be welcome? e.g. if waypoint label is "Library", show "Library" in the list instead of "Waypoint 3". |
| N6-4 | **Keyboard shortcuts are buried in the splash screen accordion.** The "All Keyboard Shortcuts & Controls" disclosure is easy to miss — your own screenshot filename says "not brilliant visual cue they are below or expanded". | Medium | Move shortcuts to a proper modal (triggered by Help button or `?` key). The splash screen should be a quick onboarding, not a reference document. |

---

## N7: Flexibility and Efficiency of Use

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N7-1 | **No way to collapse/hide sidebars on desktop.** At 1440×900, both sidebars consume ~600px, leaving only ~840px for the canvas — which is the primary workspace. | High | Add collapse toggles (Carbon's "panel toggle" pattern): click to slide sidebar off-screen, with a small tab to bring it back. This would dramatically improve canvas space at 1440×900. |
| N7-2 | **All sections start collapsed.** New users must click each section to discover what's inside. Expert users must re-expand their commonly used sections on every page load. | Medium | (a) Remember open/closed state per section in localStorage. (b) Auto-expand the relevant section when a waypoint property changes (e.g. selecting a waypoint auto-expands Marker). |
| N7-3 | **Duration slider in right sidebar has no visible label hierarchy.** It's in a small card at the top but looks orphaned. | Low | Give it the same section-header cap-band treatment as left sidebar sections, or integrate it into the playbar (where the user's attention already is during timing work). |

---

## N8: Aesthetic and Minimalist Design

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N8-1 | **Header is too busy.** 11+ interactive elements in one row. Carbon's shell pattern limits the header to: logo/title, navigation, and 3-5 action icons. | High | **Proposed header restructure:** Row 1 (fixed): `[Route Plotter]` · `[Edit│Preview]` · `[← →]` · `[💾 Save status]` · spacer · `[? Help]` `[⋮ More]`. Row 2 or overflow: Examples, Export, Open, Clear. This halves the header item count. **Needs your approval before implementing.** |
| N8-2 | **Swatch pickers are wide.** 8 swatches × 44px = 352px minimum. On the ~300px sidebar, they nearly touch both edges. | Low | Use a 4×2 grid instead of 8×1 row. Already defined in CSS but may not be activating. Verify and fix. |
| N8-3 | **Left sidebar "full-page capture" screenshot shows ~1100px of controls.** That's a lot of scrolling. Some sections (Camera, Export) are rarely used but take equal space. | Medium | **[Q]** Would you be open to grouping Background + Animation + Export into a collapsible "Advanced" group? Or keeping them flat but moving Export entirely to the Export dropdown? |
| N8-4 | **Canvas blue border is heavy.** The 1px solid blue outline around the canvas with box-shadow adds visual noise. | Low | Remove the border or make it `--border-passive`. The shadow alone provides sufficient separation. |

---

## N9: Help Users Recognise, Diagnose, and Recover from Errors

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N9-1 | **Edit mode warning (when toggled off) causes layout shift.** Your screenshot title says "warning message causes new line on title". | High | This is the header congestion problem. The warning should not be inline with the title. Use a toast, a top-banner below the header, or a small inline indicator next to the toggle — not a text block in the flex row. |
| N9-2 | **No error state for failed image upload.** If a user drops a PDF or unsupported file, there's no visible feedback. | Medium | Show a toast: "Unsupported file type. Please use PNG or JPEG." |

---

## N10: Help and Documentation

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| N10-1 | **Help button opens the same splash screen.** The splash is an onboarding flow ("Get Started"), not a reference. | Medium | Create a dedicated Help modal with: (a) keyboard shortcuts in a scannable grid, (b) link to README/docs, (c) version info. Keep splash as first-visit only. |
| N10-2 | **No contextual help.** Hovering over "Beacon" or "Segment Speed" provides no explanation. | Low | Add `title` tooltips to label `<span>` elements for non-obvious controls. Or use Carbon's "definition tooltip" pattern (? icon that shows a brief explanation). |

---

## Responsive / Multi-Resolution Issues

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| R-1 | **At 1440×900, the title wraps to two lines** ("Route Plotter / v3.1.473") because the header flex row is too crowded. | High | Addressed by N4-1 / N8-1 header restructure. |
| R-2 | **At 2560×1440, sidebars are proportionally narrow** and the canvas has good space, but swatch pickers and sliders feel cramped in the left sidebar. | Low | The `clamp()` sidebar widths already handle this well. Minor: increase `--sidebar-left` max from `27.5rem` to `30rem` for 2560+ widths. |
| R-3 | **Below 1440px (e.g. 960×540, 768×1024), the app is essentially broken.** Sidebar overlaps canvas, header wraps to 6+ lines, playbar is cut off. | High | Add a `min-width: 1440px` on `#app` with a centred warning banner below that: "This app requires a screen width of at least 1440px. Please resize your browser or use a larger display." This prevents the broken experience while being honest about support. |
| R-4 | **At 360×800 (mobile), the app renders but is completely unusable.** Controls overlap, canvas is thumbnail-sized. | Medium | Addressed by R-3. The min-width gate + warning message covers mobile too. |

---

## Carbon-Specific Issues

| # | Issue | Severity | Proposed Fix |
|---|-------|----------|-------------|
| C-1 | **No IBM Plex fonts loaded.** `tokens.css` uses `system-ui` fallback. Carbon's identity relies heavily on Plex Sans/Mono. | Low | **[Q]** Do you want to load IBM Plex via Google Fonts / self-hosted? It's ~40KB for Sans 400/500/600 + Mono 500. Would add brand polish. |
| C-2 | **Accordion sections don't use Carbon's motion pattern.** Sections snap open/closed without height animation. | Low | Add `max-height` transition or use `<details>` with animation. Smooth 180ms ease-out per Carbon. |
| C-3 | **Slider tracks use browser default styling.** Carbon sliders have a filled track (coloured left of thumb, grey right). | Medium | Style `input[type="range"]` with a filled track using a CSS gradient or the `::-webkit-slider-runnable-track` pseudo-element. This is a significant visual upgrade. |
| C-4 | **Select elements use native browser appearance.** Carbon uses custom-styled selects with consistent typography and chevrons. | Medium | Style native selects with `appearance: none` + custom chevron background. This maintains accessibility while improving consistency. |

---

## Proposed Implementation Order

### Phase 1 — Quick Wins (visual polish, no layout changes)
1. Remove version number from title (N4-5)
2. Add waypoint colour dots to right sidebar list (N6-1)
3. Replace emoji button icons with text or SVG (N4-4)
4. Replace Unicode chevrons with SVG (N4-3)
5. Style native selects (C-4)
6. Style slider filled tracks (C-3)
7. Add Clear confirmation modal (N5-1)
8. Rename "Onset" → "Visibility" (N2-1)
9. Rename "Head Icon" → "Arrow Style" (N2-3)
10. Replace undo/redo glyphs with SVG icons (N3-1)

### Phase 2 — Header Restructure (needs approval)
11. Simplify header: fewer items, overflow menu (N8-1, N4-1)
12. Fix tip banner wrapping / replace with toast (N1-3, N9-1)
13. Move Edit mode warning to toast (N9-1)

### Phase 3 — Sidebar Improvements
14. Add collapsible sidebar toggles (N7-1)
15. Remember section open/closed state (N7-2)
16. Add section header icons (N6-2)
17. Add waypoint name to sidebar heading (N1-1)
18. Improve "Global Settings" divider styling (N4-6)

### Phase 4 — Responsive Gating
19. Add min-width gate + warning banner for <1440px (R-3, R-4)

### Phase 5 — Polish
20. Smooth accordion animation (C-2)
21. Contextual tooltips on non-obvious controls (N10-2)
22. Separate Help modal from splash (N10-1, N6-4)
23. IBM Plex fonts (C-1, if desired)

---

## Questions for You

1. **Header restructure (N8-1):** May I propose a specific header layout wireframe, or do you want to keep the current single-row approach and just trim items?
2. **Native vs custom selects (N4-2):** Keep native `<select>` in sidebar, or restyle to match the custom dropdown?
3. **Auto-name waypoints (N6-3):** Use label text as waypoint name in the list?
4. **Segment Speed helper text (N2-4):** Worth adding, or too cluttered?
5. **IBM Plex fonts (C-1):** Worth the 40KB for brand consistency?
6. **Advanced grouping (N8-3):** Group Background/Animation/Export under "Advanced", or keep flat?
7. **Export settings location (N8-3):** Keep Export in left sidebar, or move it entirely to the Export dropdown as a panel/modal?

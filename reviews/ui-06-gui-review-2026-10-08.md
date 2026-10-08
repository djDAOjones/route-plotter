# UI-06 — static code review of the app GUI against UI-STANDARDS.md

Read-only half. Clone: a scratch clone at `main` a312b55 (2026-10-08). Surfaces: `index.html`, `styles/*.css`, `src/components/*`, `src/controllers/*`, `src/app/*`, `src/config/helpContent.js`, `src/player/*`, `src/services/HTMLExportService.js`. Crowd/network cards (Guide, Dots, Release, Motion, Node, Edge, outline crowd fields) appear only in the app-wide sweeps (contrast, targets, sentence case, label/name, focus); their content model is the other agent's.

Excluded as already owned elsewhere: DEF-20, DEF-13, DEF-32, DEF-15, DEF-19, DEF-22 and `project/backlog.md` "Found defects" DEF-50…DEF-80. Where met, the row says "covered by DEF-xx". Dead-code items are tagged "DEL-05" (W4) rather than re-reported.

Method: every colour pair resolved from `styles/tokens.css` → usage; ratios from `ui-06-contrast-2026-10-08.mjs` (beside this file) (WCAG 2.x relative luminance; alpha colours composited first; run `node ui06-contrast.mjs` for the full 60-row table). Target sizes computed from the cascade (the later-in-file rule wins on equal specificity). Nothing was run in a browser; two rows (B-02, C-1) say so and want one look from the browser half.

Rule shorthand: **S/…** = a UI-STANDARDS line (quoted); **G-n** = design-review gate point n.

---

## A. Findings table

Severity: high = blocks AAA or a hard rule on a primary path · med = hard rule on a secondary path · low = polish. Class: **breach** = a hard rule is broken · **judgement** = layout/emphasis/wording/feature.

### Breaches

| # | Surface | Rule | Sev | Evidence (file:line · measured) | Proposed tweak | Class |
|---|---|---|---|---|---|---|
| B-01 | Every card slider + the playbar timeline | S/Operable "Pointer targets: ≥ 44 × 44 CSS px unless a WCAG exception applies" · G-6 | high | `.section-content input[type="range"]{height:4px}` + 1px border = **6 px tall input**, thumb **14 px** (main.css:1299-1326); only `#hold-at-end` gets the 44 px band via `.range-hit-target` (main.css:1355-1375; index.html:729). 49 of the 50 `type="range"` in index.html are 6 px targets; `.timeline-slider` is 6 px with a 16 px thumb (main.css:3271-3291; index.html:1226). `appearance:none` removes the UA-default exception; nothing is inline or essential. | Apply the `.range-hit-target` recipe (44 px input, rail drawn on `::-webkit-slider-runnable-track`, thumb `margin-top:-5px`) to `.section-content input[type="range"]`, `.sidebar-control-row input[type="range"]`, `.control-row-inline input[type="range"]` and `.timeline-slider`. | breach |
| B-02 | All 17 card headers (left sidebar) | S/Operable "Focus indicators must be visible and not obscured" · G-5 | high | `.settings-section{overflow:hidden;border-radius}` (main.css:885-891) clips its children's ink; the header's ring is an **outer** `box-shadow 0 0 0 5px` (935-941) and the header fills the section. Collapsed: section box = header box → ring fully clipped. Expanded: top/left/right clipped. `.settings-sections{overflow-x:hidden}` with no inline padding (1515-1519) also clips the `[data-last]` 2 px ring (1235-1237) at both edges. The forced-colours `outline` (3926-3930) is clipped identically. **Needs one browser look to confirm.** | Inset ring on headers (`box-shadow: inset 0 0 0 2px var(--focus-inner), inset 0 0 0 5px var(--focus-outer)`, or `outline-offset:-5px` in the forced block), or move `overflow:hidden`/radius clipping to `.section-content`; give `.settings-sections` 6 px inline padding so the data-last ring survives. | breach |
| B-03 | Swatch pickers (7 in index.html) in forced colours | S/Forced colours "restores focus as an outline … every focus ring"; G-5 | high | Keyboard focus lands on `.swatch-radio` (opacity:0, absolute; swatch-picker.css:61-65); the visible ring is a sibling box-shadow on the chip (94-99). The forced block restores `outline` on `:focus-visible` (main.css:3927-3930) = on the invisible radio, so no swatch shows focus in forced colours; `.swatch-option:focus-within{outline:none}` (56-59). | Add to the forced block: `.swatch-radio:focus-visible ~ .swatch-chip{outline:var(--focus-width) solid Highlight; outline-offset:var(--focus-offset)}`. | breach |
| B-04 | Upload / draw / Apply-onward / Add-waypoint buttons | S/Understandable "Visible labels and accessible names must match for speech input" (WCAG 2.5.3) · G-7 | high | Visible text not contained in the name: `#marker-upload-btn` "Upload Image" vs `aria-label="Upload custom marker image"` (index.html:165); `#head-upload-btn` (676); `#bg-upload-btn` "Choose Image" vs "Upload background image" (898); `#area-draw-btn` "Draw Area" vs "Enter polygon drawing mode" (520); four **Apply onward** buttons "Apply onward" vs "Apply Marker onward" / "Apply On arrival onward" / "Apply Label style onward" / "Apply Leg onward" (183, 307, 409, 492; rewritten the same way at editorPanel.js:103-105); list "Add Waypoint" vs "Add new waypoint at center of map" (UIController.js:1697-1698). | Keep the visible words first and whole: "Apply onward (Marker)", "Upload image" + `aria-describedby` for the context, "Choose image" + description, "Draw area" with no aria-label, "Add waypoint" + description "at the centre of the map". | breach |
| B-05 | Mode switch | S/Understandable label = name · G-7; S/Content "Use user language" | med | `#mode-toggle-btn` `role="switch" aria-label="Toggle preview mode"` (index.html:28); its visible labels are the sibling spans "Edit"/"Preview" (27, 31), which are not part of the name; the name is a verb phrase that never changes. | `aria-labelledby` the Preview label (reads "Preview, switch, on/off") or `aria-label="Preview mode"`; mark the spans `aria-hidden`. | breach |
| B-06 | Every range readout (49) | S/Help "Keep the description node outside the `<label>` — inside, it joins the control's accessible name"; S/Recognition "connect that readout with aria-describedby" | med | Each readout `<span id="…-value">` sits **inside** its `<label for>` (e.g. index.html:175-179, 213-217, 437-441, 717-721, 734-738), so it joins the name ("Size 8 reference px") *and* is the `aria-describedby` target → read twice, and the name changes with the value. (2.5.3 still passes: the visible word leads.) | Move each readout `<span>`/`<output>` to just after `</label>` (ParamTooltip already inserts its node there, ParamTooltip.js:264-265); keep `aria-describedby`. | breach |
| B-07 | Help that exists only in `title` | S/Help "Help revealed by pointer must also be reachable by keyboard" · G-10 | med | `title` is the sole help on: `#label-auto-position` (index.html:349); presets Native/16:9/1:1/9:16 (932-935); `#network-edit-btn` (995); `#crowd-trace-route-btn` (997); `#network-edge-swap` (1191); `#export-dropdown-btn` "Export animation" (71); example-project items (wiringDom.js:70); `#add-crowd-btn` (crowds.js:558-560); layer title "Double-click to rename" (crowds.js:590); context-menu disabled reasons (ContextMenu.js:71); card Reset/Apply reasons (editorPanel.js:95,102 — AT gets them via aria-label, sighted keyboard users get nothing). Chromium shows `title` on hover only. | Replace with `data-tip` hints on a label/legend (the "?" trigger), or `aria-describedby` to a visible `.section-hint`; show disabled reasons as inline helper text under the row. | breach |
| B-08 | Camera-zoom readouts; waypoint-list empty hint | S/Perceivable "Text contrast: 7:1" · G-4 | med | `--text-03 #595959` on `--ui-02/--tint-* #F4F4F4` = **6.37:1** at 12 px: `#camera-zoom-value` via `.control-row-inline > span:last-child` (main.css:1549-1552; index.html:236), `#camera-prev/next-zoom-value` via `.slider-value-readonly` (1572-1577; index.html:228, 242), `.waypoint-list-empty .hint` on `.waypoint-list{background:--ui-02}` (1819-1823, 1795-1805). The same 6.37 is already recorded at main.css:227-230 for the mode label. | Use `--text-02` (10.34:1) for those three rules; reserve `--text-03` for pure-white surfaces. | breach |
| B-09 | Clear All item, context-menu Delete, Clear confirm button | S/Perceivable 7:1 · G-4 | med | `--support-error #B91C2E` as **text**: `.dropdown-item-danger` on `--ui-00` **6.43:1**, on hover bg `#F1D2D5` **4.56:1** (dropdown.css:189-194; index.html:66); `.context-menu-item.is-danger` 6.43 / 5.29 on `--hover-ui` (context-menu.css:53-55, 32-34); `.btn-danger:hover` 4.56:1 (main.css:152-156; index.html:1312). | Add an error-**text** token (≈ `#7A1020`: 10.9:1 on white, 7.8:1 on `--support-error-bg`) for danger text; keep `#B91C2E` for borders/bars. | breach |
| B-10 | File menu shortcut chip | 7:1 · G-4 | low | `.dropdown-item kbd{opacity:.7;font-size:.6875rem}` (dropdown.css:201-205) over `kbd{color:--text-02;background:--ui-02}` (main.css:418-430) on the white menu → **4.43:1** at 11 px (index.html:46 "⌘S"). | Drop the opacity, 12 px, `--text-02` (10.3:1). | breach |
| B-11 | Hidden crowd row in Layers | 7:1 · G-4; S/Perceivable "Do not rely on colour alone" | med | `.layer-item.layer-hidden .layer-title{opacity:.45}` (main.css:1865-1868) → `#919191` on `--ui-01` **3.05:1**; selected+hidden **2.91:1**. The row is live (selectable, renamable), not disabled; the eye icon is the other cue. | Opacity ≥ .8 (≈9.7:1) or `--text-02` + a visible "hidden" tag like `.waypoint-minor-tag`. | breach |
| B-12 | Video-export progress | 7:1 · G-4; S/System status "Every async action must show status" | med | Progress text "Exporting... 42% · Esc to cancel" is written into `#export-dropdown-btn` **while it is disabled** (exporting.js:43, 172, 254); `.btn:disabled` (main.css:3348-3353) outranks `.btn-primary` (3355-3359) → `#8D8D8D` on `#F4F4F4` **3.02:1**. The only on-screen progress sits at 3:1; it is not a live region (start/finish are announced, 206/260). | Put progress in an enabled status element (toast with an action "Cancel", or a `.diagnostics-status`-style line under the header) and leave the button's colours alone; or style `.btn[aria-busy]` separately. | breach |
| B-13 | Swatch chips; list colour dots | WCAG 1.4.11 non-text 3:1 (AAA target inherits) · G-4 | med | `.swatch-chip{border:1px solid rgba(0,0,0,.18)}` over `#F4F4F4` = `#C8C8C8` **1.52:1** — the only boundary of the white (1.10:1) and yellow `#F0E442` (1.20:1) chips (swatch-picker.css:68-72; the comment at 101-102 claims 3:1). `.waypoint-color-dot{border:--border-subtle}` on `--ui-01` **1.38:1** (main.css:2333-2339) — a white marker's dot vanishes. | Chip and dot border `var(--border-interactive)` (#767676, 4.13:1) or `rgba(0,0,0,.55)`. | breach |
| B-14 | Scene-outline errors; help screen | S/Design system "Use semantic design tokens" · G-1/G-9 | med | Tokens used but **undefined** in tokens.css: `--support-01` (main.css:2097 `.scene-outline-danger`, 2162 `.scene-outline-error` border-left, 2170-2171 `[aria-invalid]` border/shadow) → those declarations are invalid at computed-value time, so a validation error renders with **no accent bar and no red field border** (text only); `--text-helper` (2882, 2929, 3115, 3150), `--type-heading-02` (2796), `--type-heading-03` (3026), `--type-body-compact` (2980, 3017, 3064, 3090, 3174) → help-screen sizes/colours fall back to inherited. | Define `--support-01: var(--support-error)` (or rename the three uses), `--text-helper: var(--text-02)`, `--type-body-compact: var(--text-sm)`, `--type-heading-02/03`. | breach |
| B-15 | ~50 visible strings | S/Content "Sentence case for all UI text" | med | index.html: 45 Save Project · 49 Open Project · 53 Example Projects · 56 Example Backgrounds · 66 Clear All · 157 Custom Image · 165/676 Upload Image · 214 Wait Time · 227 Prev Zoom · 233 This Zoom · 241 Next Zoom · 249 Selected Zooms · 333 Always On · 334 Fade Up · 335 Fade Up & Down · 386 Text Area Width · 393 Horizontal Position · 400 Vertical Position · 520 Draw Area · 569 Fill Opacity · 589 Border Style · 600 Border Width · 611-615 & 757-761 Always Show / Hide Before / Hide After / Hide Before & After / Always Hide · 687 Follow Path · 755 Marker Mode · 767 Path Mode · 770-772 Show on Progression / Hide on Progression / Instantaneous (Comet) · 779 Background Mode · 783-785 Spotlight Reveal / Angle of View / Angle of View Reveal · 804 Spotlight Size · 809 Spotlight Feather · 824 View Angle · 829 View Distance · 834 View Dropoff · 898 Choose Image · 941 Frame Rate · 1272 Get Started. CSS: `content:'PREVIEW'` (main.css:3839). JS: helpContent.js:37 Create Your Route · 46 Edit Points · 57 Preview & Export · 61 Export Video · 111 All Keyboard Shortcuts & Controls · 141 Quick Start; UIController.js:1697 Add Waypoint. (Image names "Nervous System", "PARM Aerial", "UoN Map", "Courts" at 58-63 are titles — leave.) | One sentence-case pass; the outline already has the right forms ("Horizontal position (%)", SceneOutlineController.js:612) — match the cards to it. | breach |
| B-16 | Background image load | S/System status "loading, progress, success, or error"; S/Empty "No blank panels or silent failures" · G-9 | med | Upload failure → `announce()` only, nothing visible (backgroundLoading.js:55-60); **example** background failure → `console.error` only, no announce, no toast (87-92); no busy state while a large file decodes (29-54). (N9-2 of the 473 audit, still open.) | `ui:toast` with the reason ("Background not loaded: unsupported file. Use PNG, JPEG or WebP") + announce; `aria-busy` on `.canvas-area` during decode. | breach |
| B-17 | Save state (header) | S/System status "Auto-save, export, import, and recovery states must be visible" · G-9 | med | No "Saved" state exists any more; dirty = "●" appended to the `<h1>` with the meaning only in `title` (persistence.js:1205-1211) — AT hears "black circle", keyboard users get nothing. (DEF-50 covers the *failure* case only.) | A text status beside the title or in the File menu ("Unsaved changes" / "Saved just now"), `role="status"`, updated by `updateTitleIndicator()`. | breach |
| B-18 | Export validation | S/Carbon-first "Prefer Carbon components"; S/Error prevention "disable impossible actions"; G-1/G-12 | med | Seven native `alert()` calls (exporting.js:162, 217, 268, 320, 325, 331, 379): off-pattern, thread-blocking, not linked to a control; "Please add at least 2 waypoints" fires from a menu item that stays enabled when it cannot work; HTML export's "Please add a background image" likewise. | Disable the three Export items with a reason (`aria-describedby`) while `waypoints.length < 2` / no background; route failures through the existing modal/toast + `announce(…, 'assertive')`. | breach |
| B-19 | Splash "Don't show this again" | 44 px · G-6 | low | `.splash-content>.checkbox-label` has no min-height (main.css:3537-3540); input 18 px (1731-1736); row ≈ 21 px tall (index.html:1274-1277). | `min-height:var(--touch-target-min)` as `.export-include-group .checkbox-label` has (1755-1758). | breach |
| B-20 | Toast dismiss | 44 px · G-6 | low | `.toast-dismiss{width:1.25rem;height:1.25rem}` = **20 × 20** (main.css:367-382; built main.js:808-812). Not inline text; no exception. | 44 × 44 ghost icon button (as `.modal-close-x`, 2631-2650) with the glyph centred. | breach |
| B-21 | Card headers (semantics) | S/Robust "Semantic HTML before ARIA"; G-1 | med | `<div class="section-header" tabindex="0" role="button">` wraps the `<h2>` (index.html:135-138, ×17): `role=button` makes children presentational, so the 17 card headings leave heading navigation; Enter/Space are re-implemented by hand (SectionController.js:246-253). Carbon accordion = `<h2><button aria-expanded aria-controls>`. | `<h2 class="section-title"><button type="button" class="section-header" …>Marker<svg/></button></h2>`; drop the keydown handler. | breach |
| B-22 | Card flash scroll | S/Motion "Respect prefers-reduced-motion" · G-11 | low | `section.scrollIntoView({behavior:'smooth'})` (SectionController.js:411): the JS option wins over the reduced-motion `scroll-behavior:auto!important` (main.css:3589). | `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`. | breach |
| B-23 | Discard of an unrestorable session | S/User control "Destructive actions require confirmation or reliable undo" · G-12 | med | `#unrestored-discard` (index.html:103) discards on one click (unrestoredAutosave.js:431-457); irreversible (the kept record is removed); no confirm, no undo. Download is offered beside it, which mitigates but is not a confirmation. | Two-step ("Discard" → "Discard this session" / Cancel) or reuse the clear-confirm modal pattern (UIController.js:905-941). | breach |

### Judgements

| # | Surface | Rule | Sev | Evidence | Proposed tweak | Class |
|---|---|---|---|---|---|---|
| J-01 | Help | S/Help "task-focused, concrete, brief"; N10-1/N6-4 | med | Help button opens the first-run splash "Welcome to Route Plotter v3" (index.html:1267; main.js:587-590; UIController.js:2400) with shortcuts inside a `<details>` accordion (helpContent.js:109-117). Stale "Alt+Click force-adds a major" (helpContent.js:50; wish-list 62). | A Help dialog titled "Help" (shortcuts grid open, no onboarding CTA); keep the splash first-run only. | judgement |
| J-02 | Synonyms for one concept | S/Consistency "Do not create synonyms" | med | "Icon" (Marker card, index.html:152) vs "Marker Mode" (Reveal, 755) vs card "Marker"; "Skip to start" (1218) vs player "Reset" (HTMLExportService.js:334) vs announcer "Reset to start" (playerAccessibility.js:208); "Segment speed" (455) inside the "Leg" card (421) and "Leg → …" titles (UIController.js:477); "Horizontal Position" (393) vs outline "Horizontal position (%)" (SceneOutlineController.js:612); "Release start/length" (outline, 902-903, 918-922) vs "Window start/length" (card, 1047, 1053; wish-list 70); "Custom Image" (157) vs "Custom" (667) for the same kind of option. | One glossary pass: Marker/Shape, Leg speed, Window start, Skip to start everywhere. | judgement |
| J-03 | Implementation terms | S/Content "Use user language, not implementation terms" | low | "Instantaneous (Comet)" (772), "Show on Progression" (770), "Angle of View Reveal" (785), "Spotlight Feather" (809), "View Dropoff" (834), "H.264 encoding" (1295 — acceptable, an alternative is offered), "img/s" (1111 — crowd agent). | "Comet trail", "Reveal as it goes", "Edge softness", "Fade towards the far end". | judgement |
| J-04 | Orphan helper text | S/Minimalist "No … redundant copy" | low | `#bg-drop-hint` sr-only "Tip: Drag an image onto the canvas…" (index.html:901) is referenced by nothing in index.html (no `aria-describedby`), so no one hears it. | Point `#bg-upload-btn aria-describedby` at it, or delete it. | judgement |
| J-05 | Second live region | S/System status "Announce … through announce(), never into #announcer" | med | `#toast-container` is its own `aria-live="polite"` (index.html:90) beside the queued `#announcer` (main.js:463-466). Shift-delete raises a toast "Deleted X — press ⌘Z to undo" (InteractionHandler.js:662-668) **and** `announce('Waypoint deleted')` (main.js:858); crowd delete likewise (crowds.js:783-785). Two channels, read twice, outside the DEF-45 queue. | `aria-live="off"` on the container; have `showToast` call `announce()` once with the toast text. | judgement |
| J-06 | Empty states | S/Empty "explaining what belongs here and what to do next" · G-9 | med | Waypoints: "No waypoints yet / Click on the map to add waypoints" (UIController.js:1681-1686) — the keyboard route (outline "Add waypoint" form, SceneOutlineController.js:600-618) is not named and the list's own "Add Waypoint" button is **omitted** when empty (early return 1687 before 1691-1706). Canvas with no background: plain white (`#canvas{background:#fff}` main.css:3230), no in-place affordance; the left placeholder is the only guide. Layers never empty (Route row); outline empties present (621, 808, 870, 1051, 1071, 1206) ✓. | Render the add button inside the empty state and say "or use Add waypoint below / in the scene outline"; a canvas-area empty message "No background — drop an image here or File → Example backgrounds". | judgement |
| J-07 | Loading / busy | S/System status "The UI must never appear frozen" | low | Project open and example load are announce-only ("Loading project…", "Opening X…"); HTML export writes "Exporting..." into a menu item that is closed (exporting.js:336-339) — invisible; startup uses `aria-busy`/inert (main.js:483-484) ✓. | One visible busy line (same element as B-12/B-17). | judgement |
| J-08 | Danger text in disabled-looking button | S/Recognition "Show current … state explicitly" | low | `.scope-route-btn:disabled{opacity:.55;border-color:transparent}` (main.css:631-635): the *current* scope "Route" reads as a disabled control (2.7:1, exempt but misleading). | Style the current scope as selected (`aria-current="true"`, full contrast, filled) rather than disabled. | judgement |
| J-09 | Waypoint row reorder glyphs | S/Design system (Carbon icon sizes) | low | `.waypoint-move-btn{font-size:.5rem}` → 8 px ▲▼ inside 44 px buttons (main.css:2527-2541; UIController.js:1824, 1831); 6.77:1 as icons. | 12 px SVG chevrons like `.scope-nav-btn` (index.html:111, 113). | judgement |
| J-10 | Transport & accordion glyphs | N3-1/N4-3 (partly) | low | ⏮ ▶ ⏸ ⏭ text glyphs (index.html:1218-1221); `.controls-accordion summary::before{content:'▶'}` (main.css:3102-3107); "+ Add crowd" and "File ▾"/"Export ▾" put glyphs in accessible names (1239, 41, 72). | 16 px inline SVG (as undo/redo, index.html:35-36); wrap "▾"/"+" in `aria-hidden` spans or use the unused `.dropdown-trigger::after` chevron (dropdown.css:17-29). | judgement |
| J-11 | `prefers-contrast: more` | S/Consistency; S/Perceivable colour-only | low | `.btn-primary{background:var(--uon-jubilee-red)}` (main.css:3594-3599): Export, Play and Get Started turn the Clear-confirm red; `.header{border-bottom-color}` sets a colour on a border the header does not have (118). | Keep UoN blue; thicken borders/outlines instead. | judgement |
| J-12 | PREVIEW badge vs toasts | Layout | low | Both fixed at `top:var(--space-3); left:50%` (main.css:3838-3853 vs 312-323), z 1000 vs 9000 → a toast sits exactly over the badge; badge is CSS `content` (fine for AT: the switch carries state) but ALL CAPS. | Badge top-right of `.canvas-area`, "Preview". | judgement |
| J-13 | Crowd rename parity | S/Flexibility "click, tap, and keyboard alternatives" | low | Layer rows rename on `dblclick` only (crowds.js:599) with a `title` hint (590); waypoint rows also take F2 (UIController.js:1931-1937); the outline's "Crowd name" field (SceneOutlineController.js:839) is the keyboard route. | F2 on `.layer-row`, as the waypoint rows. | judgement |
| J-14 | Hard-coded values bypassing tokens | S/Design system "Do not hard-code ad hoc UI values" · G-1 | low | main.css: 18 regex hits = 2 in comments (738, 955), 4 `var()` fallbacks (330, 331, 334, 3878), **12 live**: `rgba(255,255,255,.12)` 364; `rgba(0,0,0,.06)` 628, 653; `#161616`/`#ffffff`/`rgba(0,0,0,.3)` 824-829 (documented); thumb shadow 1325, 1335; `#DA1E28` 2347-2348; `.canvas-area{background:#FAFAFA}` 3218; `#canvas{background:#fff}` 3230. swatch-picker.css: 19 hits, 7 live (72, 84, 89, 110-111, 189, 196-197; `#DA1E28` is Carbon red, not UoN). Select chevron `#525252` in a data URI (1401, 1710). Inline `style=` ×42 in index.html, of which 10 carry layout values (169, 170, 349, 520, 548, 681, 733, 891, 1235-1236, 1241-1242). | `--surface-canvas-area`, `--surface-canvas`; `--support-error` for the none glyph; utility classes for the 10 inline layout styles. | judgement |
| J-15 | Dead UI code (covered by DEL-05) | — | low | `.btn-small` (main.css:1612-1616) is wholly overridden by the later `.btn` (3327-3346; same specificity) so its 20 px min-height never applies — harmless but misleading; `.tab-btn/.sidebar-tabs/.tab-content` (668-713) + wiringDom.js:77-88 with no markup; `.segmented-control/.segment` (163-210); `.export-warning` (433-470); `.control-placeholder` (1621-1641); `.input-with-suffix`, `.control-row-grid`, `.control-row-stacked`; `.shortcuts-modal` (2780-2825); `.impact-toast`; `.dropdown-trigger` (dropdown.css:11-29); `Tooltip.js` + `tooltip.css` + `tooltips.js` (no `data-tooltip` anywhere; `attachAllTooltips()` at main.js:607 does nothing); keyframes `beacon-pulse`, `beacon-ripple`, `pulse` (3553-3581); keybinding category emoji (keybindings.js:329-332) unused by helpContent. | Note for DEL-05. | judgement |
| J-16 | Uppercase by CSS | Carbon productive type (labels are not all-caps) | low | `.section-title{text-transform:uppercase}` (main.css:961), `.dropdown-submenu-label` (dropdown.css:178), `.controls-category h4` (3151). Source strings are sentence case, so AT is fine; the visual is ALL CAPS. | Taste call: Carbon `label-01` is 12 px sentence case; keep weight 600 for hierarchy. | judgement |
| J-17 | Mac-only shortcut glyphs | S/Consistency | low | File menu `<kbd>⌘S</kbd>` (index.html:46) and `title="Undo (Cmd+Z)"` (35-36) are Mac strings on a Chromium-only (not Mac-only) app, while toasts use `isMac ? 'Cmd' : 'Ctrl'` (InteractionHandler.js:668; crowds.js:784) and help uses `MODIFIER_DISPLAY` (keybindings.js). | Render the chip/titles from `MODIFIER_DISPLAY`. | judgement |
| J-18 | Timeline slider label | S/Content "Every input must have a visible label" | low | `#timeline-slider` has only `aria-label="Timeline position"` (index.html:1226); the two time readouts stand in visually. | A visually-hidden-but-present label is what exists; a visible "Timeline" word (as the player template has, HTMLExportService.js:335) would match. | judgement |
| J-19 | Export menu ellipses | S/Consistency (ellipsis = dialog follows; used on "Download diagnostics…") | low | "Export MP4/WebM/HTML" (index.html:75-77) always pause at the "Share file?" disclosure (index.html:1317-1328; privacy.js:118-128) or the codec dialog, but carry no "…". | "Export MP4…", "Export WebM…", "Export HTML…". | judgement |
| J-20 | Redundant landmark roles | S/Robust "No ARIA is better than bad ARIA" | low | `header role="banner"`, `main role="main"`, `aside role="complementary"` (index.html:22, 93, 95, 1234); `aria-haspopup="true"` then rewritten to "menu" by Dropdown.js:147. | Drop the redundant roles; write `aria-haspopup="menu"` in the markup. | judgement |
| J-21 | Card-action reasons in the name | S/Minimalist "Disable … with a specific accessible reason" | low | Disabled Reset/Apply put the reason into `aria-label` ("Reset Marker: …", editorPanel.js:96-98, 103-105) rather than a description, so the name changes with state; sighted keyboard users get only `title` (B-07). | Keep the name stable; reason via `aria-describedby` to a visible helper line. | judgement |
| J-22 | Section flash | S/Motion "subtle, purposeful" | low | `section-flash` keyframes pulse twice in 1.2 s (main.css:895-903); reduced variant is static ✓ (905-915). | Fine; one pulse would do. | judgement |

Checked and clean (no row): link text self-describing (index.html:1285, 1342, 1356) ✓ G-8; no colons after labels in index.html ✓; modals: focus trap, inert background, Escape, focus return, title focus (focusTrap.js; wiringDom.js:92-110; UIController.js:515-530, 905-941; privacy.js:93-139, 163-256) ✓; context menu returns focus (ContextMenu.js:117-119; DEF-70 owns the item case); dropdown menus inset ring, Home/End/arrows, close on Tab (Dropdown.js) ✓; timeline `aria-valuetext` kept current (playback.js:306 → uiReadouts.js:53-58) ✓; global reduced-motion rule covers all 37 CSS transitions (main.css:3584-3591; tokens.css:379-386) ✓; forced-colours block restores focus, selection bars, minor/branch marks, hint glyph (main.css:811-817, 2432-2436, 2468-2473, 3926-3941) ✓; destructive paths — delete waypoint/crowd/node/edge instant + undo toast/announce ✓, card Reset/Apply/Re-roll announce "Undo is available" ✓, Clear all confirmed and copy "cannot be undone" is true (`undoService.reset`, projectReset.js:89) ✓; player template: 44 px buttons/select, 44 px timeline band, outline focus ring (forced-colours safe), 7.1–18.1:1 text, visible "Timeline"/"Speed" labels, error panel `role=alert`, one polite announcer, reduced-motion media (HTMLExportService.js:251-316, 321-349; playerEntry.js:33-44) ✓.

---

## B. Reconciliation of the two earlier audits

### v3.1.473 audit (`_Joe/design docs/UI Audit - Carbon + Nielsen.md`)

| ID | Status | Evidence today |
|---|---|---|
| N1-1 | fixed | Scope chip "Editing · Waypoint 2 'Chapel'" — index.html:109-114; UIController.js:423-438 |
| N1-2 | fixed | `role="switch" aria-checked` + active label fill (main.css:238-243) + PREVIEW badge (3838); tip banner gone (index.html:89-90) |
| N1-3 | fixed | Banner replaced by `.toast-container` (main.css:312-345) |
| N1-4 | superseded | Pill removed; dirty state is now "●" + `title` (persistence.js:1205-1211) → new B-17 |
| N1-5 | fixed | "Exporting... N%" in the menu toggle (exporting.js:172, 254) + announcements (206, 260) → contrast issue B-12 |
| N1-6 | still open | Only the Play/Pause swap (index.html:1219-1220); no global playing cue |
| N2-1 | fixed | "Visibility" (index.html:330) |
| N2-2 | fixed | "Darken / lighten" (883) |
| N2-3 | fixed | Head card "Style" (653, 662) |
| N2-4 | fixed | Hint "2.0x takes half the time, 0.5x twice as long" (455); Duration hint (718) |
| N3-1 | fixed | Inline SVG undo/redo (35-36); transport still glyphs → J-10 |
| N3-2 | fixed | Clear All last in the File menu, danger style (65-66; dropdown.css:189-194) |
| N3-3 | superseded | Menu item, no tooltip |
| N4-1 | fixed | File/Export menus + ghost buttons (24-86); wrap only ≤ 80 rem (main.css:3629-3643) |
| N4-2 | partly | Header menus custom (Dropdown.js), sidebar selects native but restyled with a chevron (main.css:1386-1406) — both Carbon-valid; decision stands |
| N4-3 | partly | Card chevrons are SVG (137); splash accordion still `content:'▶'` (main.css:3103) |
| N4-4 | fixed | No emoji in index.html; unused emoji remain in keybindings.js:329-332 (J-15) |
| N4-5 | fixed | Title "Route Plotter", version in `title` (main.js:27-28) |
| N4-6 | superseded | "Global Settings" became the Route scope group (index.html:641-646) |
| N5-1 | fixed | `#clear-confirm-modal` (1304-1315) with focus trap (UIController.js:905-941) |
| N5-2 | fixed | Toast "Tip: Switch to Preview mode…" (wiringControllers.js:949) + badge |
| N5-3 | partly | `min/max` on the number inputs (919, 924, 942) but `video:resolution-change` stores whatever arrives (wiringControllers.js:884-895) → C-4 |
| N6-1 | fixed | `.waypoint-color-dot` (UIController.js:1749-1755) → border contrast B-13 |
| N6-2 | superseded | Greyscale cap bands by spec (tokens.css:118-139); no icons |
| N6-3 | fixed | Rename by double-click/F2, name independent of label (UIController.js:1772, 1909-1937) |
| N6-4 | still open | Shortcuts inside the splash accordion (helpContent.js:109-117) → J-01 |
| N7-1 | partly | Preview mode hides the left sidebar (main.css:3828-3835); no collapse toggles |
| N7-2 | fixed | Section state in localStorage (SectionController.js:151-173) |
| N7-3 | fixed | Duration lives in the Pacing card (index.html:711-721) |
| N8-1 | fixed | As N4-1 |
| N8-2 | fixed | 5 × 2 grid (swatch-picker.css:34-38) |
| N8-3 | superseded | Route scope + `details.section-more` tiers (index.html:646-972) |
| N8-4 | fixed | `#canvas{border:1px solid var(--border-subtle)}` (main.css:3233) |
| N9-1 | fixed | Toast, no inline banner |
| N9-2 | partly | Upload failure announced only; example failure silent (backgroundLoading.js:55-60, 87-92) → B-16 |
| N10-1 | still open | Help = splash (main.js:587-590; index.html:1267) → J-01 |
| N10-2 | fixed | 77 `data-tip` hints + "?" triggers (ParamTooltip.js) |
| R-1 | fixed | As N4-1 |
| R-2 | superseded | Widths unchanged (tokens.css:232-233); no evidence of a problem |
| R-3 | superseded | Opposite decision: reflow at 64 rem / 30 rem (main.css:3650-3821) for WCAG 1.4.10 |
| R-4 | superseded | As R-3 |
| C-1 | still open | `--font-sans: system-ui…` (tokens.css:207); owner decision |
| C-2 | still open | `.section-content{display:none/block}` (main.css:977-988); only the chevron animates |
| C-3 | still open | Plain rail, no filled track (main.css:1299-1343) |
| C-4 | fixed | Restyled selects with chevron (main.css:1386-1406) |

### v3.1.593 digest (`ui-review-v3.1.593-digest-2026-10-08.md`, beside this file)

| Item | Status | Evidence today |
|---|---|---|
| A1 | fixed | Leg card per-waypoint (index.html:419-495); Head card route-global (651-705); editor reads global head (editorPanel.js:639-645) |
| A2 | fixed | Segment hit-testing (`src/utils/segmentHitTest.js`, used by pointer.js); "Leg → Waypoint 3" titles (UIController.js:459-478); `section:flash` on leg click (SectionController.js:391-396) |
| A3 | fixed | Route scope replaces ghosts (index.html:641-646; SectionController.js:8-11) |
| A4 | fixed | Scope chip always populated (UIController.js:411-438) |
| A5 | fixed | Multi-select honoured by every card (editorPanel.js:53-69, 488-570); Select all = ⌘/Ctrl+A (keybindings.js:137); bulk modal gone (only Clear's copy remains, index.html:1308, and it is true: projectReset.js:89) |
| B | fixed | Reset / Apply onward rows (index.html:181-184, 305-308, 407-410, 490-493; `src/utils/waypointCardActions.js`) → naming B-04 |
| C1 | fixed | Shift-click delete with undo toast (InteractionHandler.js:662-668) |
| C2 | fixed | `contextmenu` wired (InteractionHandler.js:172) + ContextMenu.js; focus return on item is DEF-70 |
| C3 | fixed | `canvasHover` (main.js:176), cursor states (InteractionHandler.js:815-860) |
| C4 | fixed | Minor rows with tag + sr-only context (UIController.js:1792-1809; main.css:2378-2436) |
| C5 | still open | REV-03 blocked on Android evidence (backlog) |
| D "Arrow Style" | fixed | Head card "Style" (index.html:653-662) |
| D Icon/Marker Mode/Marker | partly | "Icon" (152) and "Marker Mode" (755) remain → J-02 |
| D timing scattered | superseded | Regrouped by subject (On arrival: Wait Time 214; Leg: Segment speed 455; Pacing: Duration 718) per proposal 2 |
| D units | fixed | Readouts in reference px / s / % / x (178, 216, 440, 457); formatter `src/utils/uiReadouts.js` |
| D Export twice | fixed | Card renamed "Video settings" (index.html:911) |
| E1 | fixed | "3.0 reference px" readout (440; editorPanel.js:584-590) |
| E2 | fixed | `reorderWaypointBlocks` carries minors with their major (UIController.js:1708-1710) |
| E3 | fixed | editorPanel.js:639-645 |
| E4 | fixed | `_emitWaypointChange` no longer exists (grep: 0 hits) |
| E5 | fixed | Label colour / background swatches + opacity (index.html:359-382) |
| E6 | fixed | Zoom transition select visible under More (261-269) |
| E7 | fixed | Retired (wish-list 19) |
| E8 | covered by DEF-13 | — |
| E9 | fixed | One `startRenameFor` (UIController.js:1528) used by both paths (1920, 1935) |
| E10 | fixed | List role removed, rows are buttons with `aria-pressed` (UIController.js:1661-1665, 1742-1745) |
| E11 | superseded | The Apply-to-All modal is gone; the Clear modal's "cannot be undone" is accurate (projectReset.js:89) |
| E12 | fixed | No `general` key (SectionController.js:31-54) |
| To verify (8.6 s vs 7.7 s) | still open | Same shape as wish-list 81 (12,262 vs 11,594 ms) |
| Proposal 1 | fixed | Scope chip (index.html:109-114) |
| Proposal 2 | fixed | Cards: Marker · On arrival · Label · Leg · Area / Head · Pacing · Reveal · Path emphasis · Background · Video settings (index.html:134-970) |
| Proposal 3 | fixed | 7 `details.section-more` tiers |
| Proposal 4 | fixed | Reset / Apply onward; multi-select honoured; one undo entry (editorPanel.js:125-151) |
| Proposal 5 | fixed | Hover ring/cursor, leg click → card flash, "+" handle (RenderingService), context menu, shift-delete toast |
| Proposal 6 | fixed | Minors in the list; Layers strip above it (index.html:1238; crowds.js:509-562) |
| Crowds (5) | partly | Two-click Add crowd ✓, Node/Edge cards ✓ (index.html:1142-1204), weight as traffic share ✓ (1194-1196); window picker and interludes not as proposed — the crowd agent's call |

---

## C. Behaviour-defect candidates (not tweaks)

**C-1 — Collapsed card headers show no focus ring.** Mechanism: `.settings-section{overflow:hidden}` (main.css:885-891) clips the header's outer box-shadow ring (935-941) and, in forced colours, its outline (3926-3930); the header is the whole section when collapsed. Reproduce: Tab from the scope chip into a collapsed card header (any of the 17); expected a 2 + 5 px ring, candidate shows none; expand it and only the bottom edge of the ring shows. Needs one browser confirmation (B-02).

**C-2 — Scene-outline validation errors render without their red mark.** Mechanism: `--support-01` is undefined (tokens.css has no such token) so `border-left:… var(--support-01)` (main.css:2162), `[aria-invalid] border-color/box-shadow` (2170-2171) and `.scene-outline-danger` (2097) are invalid at computed-value time and reset to initial. Reproduce: Full scene outline → Route → Add waypoint → Horizontal position (%) = 150 → Add waypoint: the `role=alert` paragraph appears (SceneOutlineController.js:549-566) as plain text with no accent bar; the field gets `aria-invalid` but no red border (B-14).

**C-3 — A failed example background is silent.** Mechanism: `loadExampleBackground` catches, logs to console and returns false (backgroundLoading.js:87-92); the caller (`loadExampleImage`, main.js:1029-1031; wiringDom.js:55) does nothing with false. Reproduce: go offline (or block `images/Garlic.jpg`), File → Example backgrounds → Garlic: no change, no toast, no announcement (B-16).

**C-4 — Typed export sizes are not clamped.** Mechanism: `video:resolution-change` stores width/height as received (wiringControllers.js:884-895) and resizes the canvas aspect; `min="100" max="7680"` on `#export-res-x` (index.html:919) constrains only the spinner and form validation, and there is no form. Reproduce: type 20 into Width, Tab: the canvas re-aspects to 20 × 1080 and an export would be attempted at that size (unverified — the input listener in wiringDom.js was not read in full; grep shows writes only). N5-3 of the 473 audit.

**C-5 — Deletes are announced twice through two live regions.** Mechanism: `#toast-container` is `aria-live="polite"` (index.html:90) and `showToast` appends text to it (main.js:792-814) while `deleteWaypoint` also calls `announce('Waypoint deleted')` (main.js:858); the toast bypasses the DEF-45 queue (announcementQueue.js). Reproduce with a screen reader: Shift-click a waypoint → "Deleted Waypoint 3 — press Cmd+Z to undo" and "Waypoint deleted" compete; order depends on timing (J-05).

**C-6 — The only visible export progress is painted in disabled colours.** Mechanism: progress text goes into `#export-dropdown-btn` after `holdExportControls` disabled it (exporting.js:43, 172, 254); `.btn:disabled` colours apply (main.css:3348-3353) → 3.02:1. Reproduce: Export → Export MP4 → Continue; read the header button during encoding (B-12).

**C-7 — Help still teaches Alt+click as "force-add a major".** Mechanism: helpContent.js:50 vs the branch gesture (`'Branching from …'` announcements in wiringControllers). Already wish-list 62; listed so the wording pass picks it up.

---

## D. Wish-list lines touched (`project/wish-list.md`)

| Line | Text (short) | Call |
|---|---|---|
| 22 | Mode banners near-duplicates (area draw + network edit inline-style their own) | **keep** — not reached by this pass (the banners are JS-built; the crowd agent's surface). |
| 56 | Node hint does not say a network with no Exit ends at one-connection nodes | **keep** — crowd agent. |
| 62 | Help screen says Alt+Click force-adds a major; nothing on crowds/branching | **promote** into UI-06's wording pass (J-01, C-7): helpContent.js:50 is wrong today. |
| 63 | Node hint "Choose Edit network to move nodes" for a traced network | **keep** — crowd agent. |
| 70 | Outline "Release start/length" vs card "Window start/length" | **promote** — one concept, two names (J-02); SceneOutlineController.js:902-903, 918-922 vs index.html:1047, 1053. |
| 71 | Forced-colours hint has no visible border | **promote** with B-03's forced-colours sweep: add `border:1px solid CanvasText` to `.param-tooltip` in the forced block. |
| 72 | "Quick — on arrival" mislabels a leg-start zoom | **promote** — wording (index.html:267). |
| 73 | A click on a hover-opened hint closes it | **keep** — behaviour, advisory. |
| 83 | After a session restore the transport stands at the end | **keep** — browser half / defect. |
| 84 | Two focus traps hand focus back and forth (first-run Help then Save) | **keep** — browser half should try it; the trap code (focusTrap.js:146-161) makes it plausible. |
| 97, 98 | Slider undo timing; Duration slider records no undo | **keep** — not UI chrome. |
| 103 | UI-STANDARDS § Help could name the "?" trigger (budget) | **keep**. |

No line to delete.

---

## E. Counts for the item file

- **Cards** (`h2.section-title`): **17** — waypoint 5 (Marker, On arrival, Label, Leg, Area), route 6 (Head, Pacing, Reveal, Path emphasis, Background, Video settings), crowd 4, node 1, edge 1. `details.section-more` tiers: **7**. Final action rows (`.waypoint-card-actions`): **4**.
- **Controls in index.html**: range **50**, select **18**, checkbox **7**, number **3**, text **1**, textarea **1**, file **4** (hidden), hidden colour inputs **8** (7 swatch pickers + head colour), `<button>` **73**, links **5**. JS-built per item: waypoint row + ▲ + ▼ + × per major, row + × per minor; layer row + eye + × per crowd; outline buttons/forms per entity; **84** "?" hint triggers (77 + 7).
- **Hints** (`data-tip`): **77** in index.html + **7** `data-label-tip` (swatch legends) + **29** `data-tip` references in `src/` (outline `FIELD_HINTS`, busyness rows, path weights, custom colour). Labelled controls **without** a hint: `#splash-dont-show`, `#diagnostics-preview` (both reasonable). Controls whose only help is `title`: **11** in index.html (B-07 list) + 5 JS-built.
- **Transitions**: **37** `transition` declarations (main.css 25, dropdown.css 6, tooltip.css 2, context-menu.css 2, swatch-picker.css 2) and **5** `@keyframes` (section-flash, section-flash-static, beacon-pulse, beacon-ripple, pulse — the last three unused). All CSS motion is neutralised by main.css:3584-3591 and tokens.css:379-386. JS-driven motion: **1** (`scrollIntoView` smooth, SectionController.js:411) not reduced; toast/tooltip enter via CSS transition (covered).
- **Hard-coded colours**: main.css **18** regex hits (12 live values, 4 fallbacks, 2 comments); swatch-picker.css **19** (7 live); dropdown/context-menu/tooltip.css **0**. Inline `style=` attributes in index.html: **42** (10 carry layout values).
- **Contrast pairs computed**: 60 (ui06-contrast.mjs); text failures **12** rows (B-08 ×3, B-09 ×4, B-10, B-11 ×2, B-12, `a:visited` on the warning tint 6.90:1 — low), non-text failures **4** (B-13); exempt-disabled below 7:1: 3.
- **Undefined tokens referenced**: 5 (`--support-01`, `--text-helper`, `--type-heading-02`, `--type-heading-03`, `--type-body-compact`) across **12** declarations.

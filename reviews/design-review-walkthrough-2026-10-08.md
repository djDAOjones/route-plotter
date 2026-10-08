# Browser walkthrough notes — live v3.2.707 (= main a312b55 for src/index.html/styles/docs), Chromium pane, 2026-10-08

Screenshots: `design-review-2026-10-08-shots/NN-*.jpg` (800×500 captures of a 1440×900 viewport unless named otherwise).

## Setup
- Live site opened in the desktop app's browser pane; viewport emulated at 1440×900 (dpr 2). Storage cleared, reloaded at `?v=707` → first-run state (splash, default campus map, no waypoints).
- Earlier restored session (smoke's autosave) showed the Open day route with NO background (bg false) and labels overlapping markers (02-*.jpg); not a finding against a fresh state.
- Pane caveat: when the side panel hides the pane, rAF stops; `window.app.render()` is synchronous and was used to force frames. Pixel probes count exact `#56B4E9` pixels on `canvas#canvas` (1436×1016 at dpr 2) with the crowd layer `visible` true vs false.

## Splash (03)
- Headings "Create Your Route", "Edit Points", "Preview & Export", button "Get Started" are Title Case → sentence-case rule (breach, trivial fix).
- Shortcut list says "⌥+Click to force-add a major waypoint" and "⌥+⌘+Click to force-add a minor waypoint"; Alt+click on a major now forks a branch (seen live: 10-*.jpg) → stale help (breach: consistency / help accuracy). Check `src/config/helpContent.js` too.
- Checkbox "Don't show this again" 18×18 (label is clickable: effective target larger; check CSS).
- Licence link 299×14 inline (WCAG inline exception).
- Behind the splash at first run: tip pill "Tip: Check your sequence in Preview mode before exporting" floats over the header centre (overlaps the header row; it sits above/beside the mode switch) — check at 2560 and when the header wraps.

## Fresh editor, Route scope (04)
- Left: scope header "Route ‹ Editing · Route ›", "Quick Start" card (Click / Drag / ⇧+Click / Space + "? View all controls"), cards HEAD, PACING (open), REVEAL, PATH EMPHASIS, BACKGROUND (open), VIDEO SETTINGS — titles rendered in CAPS (CSS text-transform; DOM text is sentence case) → judgement (Carbon productive uses sentence-case headings, not caps).
- Section header = `<div class="section-header" tabindex="0" role="button" aria-expanded aria-controls>` wrapping an `<h2>` + chevron; keyboard handled in SectionController (click + keydown). Carbon accordion anatomy is `<h2><button>`; a heading inside a button role is the inverse → judgement (semantic HTML before ARIA).
- Duration readout "10s" (default), Hold at end "2s", Scale "1×". Pacing hint under Duration: "Total animation playback time…".
- Background card: "Upload" label + "Choose Image" button (Title Case → breach).
- Playbar: ⏮ ▶ ⏭ with "0:10 … 0:10" readouts.
- Right: Layers (Route row + "+ Add crowd"), Waypoints empty state "No waypoints yet / Click on the map to add waypoints" ✓ (+ "+ Add Waypoint" Title Case → breach), "Full scene outline" details with intro text "Inspect and author route geometry, every crowd and emitter, custom networks, edge bends, and polygon vertices without using the canvas." → implementation language (breach of "Use user language, not implementation terms"). Route group text "Route order includes major timing keyframes and minor geometry points. Positions are percentages of the image." (jargon: keyframes, geometry points). Crowds group text "Each crowd contains persisted dot emitters and either follows the route or its retained custom network." (jargon: persisted, emitters, retained). "Stored custom network — inactive while this crowd follows the route — 0 nodes, 0 edges".
- Scene outline Insert position select option "After Major waypoint 1" (capital M mid-sentence; inconsistent with "Major waypoint 1 — 18.91%, 47.54%" row labels and the Waypoints list's "Waypoint 1").
- Header h1 becomes "Route Plotter ●" once the project is dirty (`persistence.js:1210`, "UI spec §2.1"): a bare glyph with no name, no tooltip, no announcement → status carried by a symbol only (judgement; Nielsen status visibility + "not visual-only").

## Novice task (a) people walking from one place to another (05, 06, 08)
- Two clicks on the map → Waypoint 1, Waypoint 2; scope header "Editing · Waypoint 2 · major"; Pacing shows "Ends at 5.5 s — route 3.5 s, hold at end +2.0 s".
- "+ Add crowd" (right sidebar) → "Crowd 1" row (eye + ×), scope header "Editing · Crowd 1 · crowd"; left cards GUIDE (collapsed), DOTS (open), RELEASE (open, More closed), MOTION (collapsed). Defaults: Sky blue, Size 0.40×, Walking variation 0%, Count 50, Window start 0%, Window length 50%; More: Release timing "20% uneven", Release bias "Even", Busyness over time (2 handles, Even), Pattern seed 1255726489 (read-only) + "Re-roll pattern".
- Task completes with 3 clicks; nothing on screen says that the crowd needs ≥2 waypoints first, nor that Guide/Motion exist (collapsed by default).
- **Dots ARE visible at defaults** (pixel probe, crowd shown − hidden): t=0.5 s 120 px, 1.2 s 1,321, 2.0 s 3,697, 3.0 s 3,482, 4.0 s 2,300, 5.5 s 2,567, 7.0 s 2,449 → ~74 device px² per dot ≈ 2.4 CSS px radius at 0.40× on a 718-CSS-px canvas. Visible but small; in the 800×500 captures they do not show (08). Judgement: default Size could be larger for a first crowd.
- Colour swatch grid: 10 swatches incl. "None" (crossed) in two rows of 5.
- Guide card (09): select "Follow route | Custom network", helper "Dots follow your route. Custom network lets you draw paths of their own."; hidden until Custom: "Edit network", "Trace route into network". Motion card: Speed "0.40 img/s" (hint "Dot travel speed in image-widths per second"), Pace variation 20%, At journey end {Respawn at entry | Repeat journey | Disappear | Collect at exit}. "img/s" is an abbreviation novices must decode (judgement).
- Scene outline for the crowd: Guide select "Route | Custom network" vs the card's "Follow route | Custom network" (one concept, two names); an "Apply crowd" button (form-apply pattern) where the cards apply live (inconsistency).

## Novice task (c) a crowd that splits at a junction (10–19)
- Alt+click Waypoint 1 → banner "Branch from this waypoint — click where it should go (Esc to cancel)" rendered as a dark pill over the header centre, covering the Edit/Preview switch (10).
- Click → "Waypoint 1-B1 [branch]" appears in the list and is highlighted, but the inspector stays on "Editing · Crowd 1 · crowd" (`app.selectedCrowd` still set while `selectedWaypoint` is the branch) → **DEF candidate: placing a branch waypoint while a crowd is selected leaves the crowd inspector** (11). The canvas at t=0 showed no branch waypoint or branch line (the trunk is fully drawn at t=0; the branch appears only when revealed — verify whether trunk and branch should match at t=0).
- Drag the branch waypoint onto Waypoint 2 → announcer "Branch rejoins at that waypoint"; scope "Editing · Waypoint 1-B1 · branch B"; Leg card header "LEG → WAYPOINT 2". At the end of the timeline the triangle route is drawn (13).
- Select Crowd 1, Guide → "Custom network": the app **immediately enters Drawing network mode** (full-width green banner "Drawing network — click places a linked node, click a node to continue from it, drag an edge to bend it. Esc lifts the pen. Click the map to start." with "Done"), replacing the whole header (mode switch, undo/redo, File, Export hidden) (14). WCAG 3.2.2 on-input context change + header obscured → breach/judgement. Guide card: "Editing network…" (disabled) + "Trace route into network"; helper "No network yet — Edit network hands you the pen."
- "Trace route into network" → toast "Traced the route into Crowd 1 — 3 nodes, 3 paths" (over the header), mode exits, but the Guide helper STILL reads "No network yet — Edit network hands you the pen." (15) until Edit network is entered, when it reads "Dots walk this crowd's own network (3 nodes, 3 edges)." → stale status (DEF candidate / breach: system status).
- The traced network is **invisible on the canvas**: `RenderingService.VECTOR_LAYERS` draws the guide network below the path, and a traced network coincides with the route, so the route line and markers cover the nodes, arrows and node glyphs (zoom 2uhx5x: nothing but the route). The explainer promises "You see them while editing a crowd with Preview off." → judgement/defect (draw the selected crowd's network above the path, or offset/outline it).
- Outside Edit network mode a click on a node selects the route waypoint under it (16) — expected, but the Node card is reachable only via Edit network; the explainer's "select the junction node" needs that step.
- Edit network mode banner says "3 nodes · 3 edges"; the Node card says "Path 1 to exit 1 / Path 2 to pass-through 1"; the Edge card is "EDGE" with "Traffic … 50% configured share"; toast says "3 paths" → **edge vs path, two names for one concept** across banner, cards, toast, explainer (18, 19).
- Node card (18): Type {Pass-through|Entry|Exit}; long hint; "Path weights" number inputs with readout "Weight 1 · 50%"; "Delete node". Traced nodes are named by type ("exit 1", "pass-through 1"), not by the waypoint they were traced from (the explainer says they take the waypoint's name).
- Edge card (19): Direction {Two-way|One-way}, "Swap direction", Traffic range input only **48×4 CSS px wide** (other sliders ~175 px) with readout "50% configured share", "Delete edge". A 48-px slider for a 0.1–5 weight is a precision problem (judgement) and the "configured share" wording is implementation language.
- Done exits the mode; the crowd stays selected.

## Novice task (d) arrives and stops / (e) loops
- From the code and cards: (d) = Motion → At journey end = "Collect at exit" or "Disappear"; (e) = default "Respawn at entry" or "Repeat journey" plus Hold at end. Both are one select in the collapsed Motion card; nothing on the Guide/Dots/Release cards points to it.

## Route scope cards (23–25), 1440
- Head: Style {Arrow|Dot|Drone|Custom|None}, Size "8 reference px". Pacing: Duration "7.3s", Hold at end "2s", Scale "1×", breakdown "Ends at 7.3 s — route 5.3 s, hold at end +2.0 s". Reveal: labels "Marker Mode" / "Path Mode" / "Background Mode" and options "Always Show", "Hide Before", "Hide Before & After", "Show on Progression", "Instantaneous (Comet)", "Spotlight Reveal", "Angle of View Reveal" → Title Case (breach, many strings); Reveal › More holds only the comet trail length at defaults (one control, OK). Path emphasis: Path casing ✓, Path glow ☐ + "Glow intensity 50%" live while glow is off (no-op control not disabled → judgement). Background: Darken / lighten "None", Zoom 100%, Upload "Choose Image" (Title Case). Video settings: Width 2914 px, Height 2061 px, Presets Native/16:9/1:1/9:16, "Frame Rate" 25 fps (Title Case); More: "Include in export" Background image / Camera movement / Text labels.
- Scope header's "Route" button is disabled except in waypoint/multi scope (`UIController.js:440`): from Crowd, Node or Edge scope the only way back to Route is the Layers "Route" row (judgement: back-out route hidden).

## Waypoint scope cards (26–29), 1440
- Marker: Colour (10 Okabe-Ito radios + None), Icon {Dot|Square|Flag|Custom Image|None} ("Custom Image" Title Case), Size "8 reference px", Reset / Apply onward (disabled, `title` reasons "Already uses route style" / "Later waypoints already match" — title-only reason, not an accessible description → judgement/breach of "specific accessible reason").
- On arrival: Beacon {None|Ripple|Glow|Pop|Grow|Pulse}, "Wait Time" 1.5s (Title Case), camera "This Zoom" 1.0x (Title Case; label is "This" in a Prev/This/Next trio?), More: Zoom transition {Gradual — over the leg | Quick — on arrival} (wish-list 72: "Quick — on arrival" misdescribes).
- Label: Text (placeholder "Enter label text…"), Visibility {Off|Always On|Fade Up|Fade Up & Down} (Title Case), Size "16 reference px", Auto-position; More: Text colour (Ink/Ink soft/Mid grey/White + Custom colour… + "Current #1A1A1A"), Background colour (same), "Background opacity 85%", "Text Area Width 15%", "Horizontal Position 0%", "Vertical Position 0%" (Title Case ×3).
- Leg → Waypoint 1-B1: Colour, Thickness "3.0 reference px", Shape {Line|Squiggle|Randomised}, "Segment speed 1.0x"; More: Style {Solid|Dashed|Dotted}. Area: Shape {None|Circle|Rectangle|Draw} (+ More).
- Waypoint list rows: ≡ ▲ ▼ × controls sit at opacity 0 until hover or selection (hover-only affordance; check keyboard reveal).

## Header menus, hint, dialogs (30–35), 1440
- File ▾ (role=menu, 44-px items): "Save Project ⌘S", "Open Project", EXAMPLE PROJECTS (Site walk, Open day route, Signal flow), EXAMPLE BACKGROUNDS (Courts, Garlic, "Nervous System", "PARM Aerial", Rocketry, "UoN Map"), "Clear All" (danger) → Title Case ×6 (breach).
- Export ▾: Export MP4 / Export WebM / Export HTML / Download diagnostics… / Copy diagnostics… ✓.
- Hint popover on hover (UI-03): role=tooltip, #161616 on white 12 px text, "Colour of the path line along this leg" ✓ (12 px is below Carbon's 14 px body-compact: judgement).
- Report a bug: role=dialog aria-modal, focus to the title, 44-px buttons, GitHub warning, "private vulnerability reporting (new tab)" link ✓.
- Clear All: "Clear all waypoints? This will remove all waypoints and reset the canvas. This action cannot be undone." Focus lands on Cancel ✓; copy is true (`projectReset.js:89` resets undo) but understates: crowds, networks and settings go too (judgement: say "Clear the whole project?").
- Export HTML: a "Tip: Switch to Preview mode to see exactly how the export will look" toast over the header, then "Export standalone HTML?" disclosure dialog (focus on Cancel) ✓. Export produced `route-animation.html` (2.03 MB) with no success announcement captured (announcer empty).
- Toasts/banners (branch, trace, export tip, network drawing) all sit on top of the header controls (10, 14, 15, 35).

## Exported player (36), context menu (37), Preview (38), scene outline (39–41)
- Exported `route-animation.html` loaded into a srcdoc iframe: the parent page's CSP blocks its inline script, so only the static controls could be measured: Play 72×44, Reset 72×44, Timeline range 955×44 (labelled "Timeline"), Speed select 73×44 {0.25x…2x}; readout "0:00 / 0:00" #525252 on #f4f4f4 = 7.1:1 (just passes); "Loading scene summary." 7.8:1; `prefers-reduced-motion` rule present; one polite live region; landmarks: only an H2 "Scene summary" (no main/header landmarks). Dynamic behaviour not checked here (agent A reads src/player).
- Canvas context menu (right-click a waypoint): role=menu, five 206×44 items (Rename, Convert to minor waypoint, Insert waypoint before, Insert waypoint after, Delete waypoint in danger red), focus moves to the first item, Escape closes ✓.
- Preview mode: `role=switch` "Toggle preview mode" checked; both sidebars stay visible and editable-looking (the splash says "Use Preview mode to hide controls") → copy/behaviour mismatch (judgement).
- Scene outline: Route group with an "Add waypoint" form (Insert position select "After Major waypoint 1" / "After Branch B waypoint 1·B1", Type, Horizontal/Vertical position (%)), then one `<details>` per waypoint: "Select Major waypoint 1", "Delete waypoint", Horizontal position "18.914301880222837" and Vertical "47.53895992054321" as raw floats (the heading rounds to 18.91%) → judgement/breach of recognition (round to 2 dp); "Wait (seconds)" 1.5, "Outgoing leg speed (×)" 1, "Apply waypoint" (form-apply pattern), "Create polygon area". Branch waypoint named "Branch B waypoint 1·B1" here but "Waypoint 1-B1" in the list and "Waypoint 1-B1 · branch B" in the chip (middle dot vs hyphen). Crowd group: "Crowd 1 — custom network, 1 emitter", Crowd name, Visibility, Guide {Route|Custom network}, "Apply crowd", "Emitters — 1", "Stored custom network…".

## Keyboard (42)
- Tab order follows the DOM: header (switch, Undo, Redo, File, Export, Report a bug, Help) → scope header (Route, prev, next) → card headers and controls → canvas/playbar → right sidebar. 206 focusable controls, no positive tabindex, no upward jumps in DOM order.
- Focus rings: Carbon-style double box-shadow (white 2 px + #0f62fe) on buttons/hint triggers; section headers add a 4-px inset left bar; `:focus-visible` true in every sampled stop; nothing obscured at 1440.
- On arrival card shows a "Camera zoom" group: "Prev Zoom 1.0x" (text), "This Zoom" (slider), "Next Zoom 1.0x" (text) — Title Case; the prev/next readouts are plain text, not controls.

## Corrections after the second reviewer (Codex, 2026-10-08)
- "nothing obscured at 1440" under Keyboard is wrong for collapsed card headers: their outer ring is clipped (B-02, confirmed by the Dots-header zoom).
- The dirty "●" does carry a `title` (`persistence.js:1211`); the finding is that the meaning is title-only and the glyph is unnamed, not that there is no tooltip.
- The HTML export does announce success (`exporting.js:375`); the empty announcer read here was a timing artefact of the stubbed download.
- Waypoint-row actions (≡ ▲ ▼ ×) are revealed on focus as well as hover (`main.css:2518`), so they are reachable by keyboard.
- The Node card is also reachable from the scene outline's "Select node" (`NetworkEditService.js:121`), not only through Edit network.
- The 150% outline test was not a validation-error repro: native validation accepts it; use "connect two already-connected nodes".

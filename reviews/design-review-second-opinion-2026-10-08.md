Read-only review at `a312b55`. Recomputed contrast and ran the pure-engine probe; no browser rerun or full test suite. No files changed.

**A. Breach verdicts**

`CONFIRMED` confirms the breach, not necessarily the proposed remedy.

| ID | Verdict | Deciding evidence / correction |
|---|---|---|
| B-01 | **CONFIRMED** | **48 card ranges are 4 px**, Hold is 44 px, timeline 6 px; thumbs 14/16 px. Global `border-box` invalidates “4 + borders = 6”: `styles/main.css:7`, `:1309`, `:1359`, `:3273`. Rule: `UI-STANDARDS.md:196`. |
| B-02 | **CONFIRMED** | Collapsed header’s outer shadow is clipped: `styles/main.css:888`, `:935`. Expanded inset bar denotes **expanded state**, not focus (`:943`); it does not rescue collapsed focus. Forced outline also extends outside (`:3928`). |
| B-03 | **REFUTED** | Audit overlooks **`forced-color-adjust:none` on the chip** (`styles/swatch-picker.css:78`): its sibling-applied shadow (`:94`) survives forced-colour adjustment. Invisible-radio outline does not establish invisible chip focus. Theme contrast still needs testing. |
| B-04 | **CONFIRMED** | Visible phrases are interrupted/replaced: `index.html:165`, `:520`, `:898`; `src/app/editorPanel.js:103`; `src/controllers/UIController.js:1698`. Rule: `UI-STANDARDS.md:208`. |
| B-05 | **DOWNGRADE-TO-JUDGEMENT** | “Toggle **preview** mode” already contains “Preview”; fixed switch names are appropriate. Treating both adjacent state words as a required combined name is unproved: `index.html:27`. |
| B-06 | **CONFIRMED**, narrower | **47**, not 49, readouts are inside labels. Camera single/multi readouts and timeline are outside: `index.html:233`, `:247`, `:1224`. Description separation: `UI-STANDARDS.md:167`. |
| B-07 | **CONFIRMED** | Extra instructions exist only in titles: `index.html:995`, `:997`, `:1191`; keyboard-help rule `UI-STANDARDS.md:170`. Redundant titles such as “Export animation” need not become additional hints. |
| B-08 | **CONFIRMED** | `#595959/#F4F4F4` = **6.369:1**: `styles/main.css:1549`, `:1572`, `:1819`; tokens `styles/tokens.css:58`, `:77`. |
| B-09 | **CONFIRMED** | Red text ratios: white **6.425**, pink hover **4.565**, grey hover **5.292**. `styles/dropdown.css:189`; `styles/context-menu.css:53`; `styles/main.css:152`. |
| B-10 | **CONFIRMED** | Whole-chip opacity composites **both** text and background: **4.306:1**, not 4.43. `styles/dropdown.css:201`; `styles/main.css:418`. |
| B-11 | **CONFIRMED** | Hidden crowd remains interactive; opacity .45 yields approximately **3.05:1** unselected. `styles/main.css:1865`; `src/app/crowds.js:594`. Eye icon means this is not additionally colour-only. |
| B-12 | **DOWNGRADE-TO-JUDGEMENT** | **3.018:1 and cascade are correct**, but disabled-component contrast exemption defeats the claimed WCAG contrast breach: `src/app/exporting.js:43`; `styles/main.css:3348`; `styles/tokens.css:196`. A separate readable progress status is worthwhile. |
| B-13 | **CONFIRMED**, measurements corrected | Border composites over **chip colour**, not surrounding grey: white-chip boundary ≈ **1.39:1**, yellow ≈ **1.81:1** against grey. `styles/swatch-picker.css:72`; its “sufficient for 3:1” comment at `:101` is false. |
| B-14 | **CONFIRMED** | All five named tokens are undefined. Error accent declaration consequently fails: `styles/main.css:2162`; help uses include `:2796`, `:2882`, `:2980`. Token rule: `UI-STANDARDS.md:25`. |
| B-15 | **CONFIRMED** | Sentence-case requirement is explicit: `UI-STANDARDS.md:58`; violations include `index.html:45`, `:214`, `:755`; `src/config/helpContent.js:37`. |
| B-16 | **CONFIRMED** | Upload failure announce-only; example failure console-only: `src/app/backgroundLoading.js:55`, `:87`. Violates visible/error-state rules `UI-STANDARDS.md:69`, `:81`. |
| B-17 | **CONFIRMED** | Dirty glyph/title provides no explicit visible save/recovery status: `src/app/persistence.js:1205`; `UI-STANDARDS.md:74`. Do not equate browser recovery with saving a project file. |
| B-18 | **CONFIRMED**, narrower | Impossible export remains available: `index.html:75`; `src/app/exporting.js:319`; rule `UI-STANDARDS.md:98`. Native `alert()` alone is not sufficient proof: “Prefer Carbon” is not “ban alerts”. |
| B-19 | **CONFIRMED** | Clickable splash label remains below 44 px tall: `styles/main.css:1722`, `:3537`; `index.html:1274`. |
| B-20 | **CONFIRMED**, size corrected | **20 × 44**, not 20 × 20: global button minimum height wins over specified height. `styles/main.css:89`, `:367`. Width still fails. |
| B-21 | **CONFIRMED** | Button-role wrapper makes embedded heading presentational: `index.html:135`; semantic/heading requirements `UI-STANDARDS.md:188`, `:236`. |
| B-22 | **CONFIRMED** | Explicit JS smooth scrolling is unconditional: `src/controllers/SectionController.js:411`; reduced-motion rule `UI-STANDARDS.md:156`. |
| B-23 | **CONFIRMED** | One-click irreversible discard: `src/app/unrestoredAutosave.js:427`; confirmation/undo rule `UI-STANDARDS.md:87`. |

| Crowd ID | Verdict | Evidence |
|---|---|---|
| F1 | **CONFIRMED** | Factor readout violates reference-pixel rule: `src/app/crowds.js:816`; `UI-STANDARDS.md:112`. Default radius is **4 reference px**; proposed **8** chooses diameter: `src/services/DotRenderer.js:42`. |
| F8 | **CONFIRMED**, narrower | Window/Release and Edge/Path genuinely conflict: `index.html:1047`, `:1179`; `src/controllers/SceneOutlineController.js:918`; `src/app/crowds.js:758`. Qualified labels, code comments and **crowd versus emitter** are not automatically synonyms. |
| F9 | **CONFIRMED** | “Done” absent from name: `src/services/NetworkEditService.js:760`; `UI-STANDARDS.md:208`. |
| F15 | **CONFIRMED** | Signed bias field violates directional-readout rule even though help explains it: `src/controllers/SceneOutlineController.js:934`; `UI-STANDARDS.md:149`. |
| F17 | **CONFIRMED**, narrower | Same title-help breach as B-07; Hide/Delete already have keyboard-accessible names: `src/app/crowds.js:605`, `:624`. |
| F27 | **CONFIRMED** | Authored readout versus resolved anchor: `src/app/crowds.js:821`; `src/utils/routeAnchors.js:138`; `UI-STANDARDS.md:108`. |
| F29 | **CONFIRMED** | Authored duration versus clipped span: `src/app/crowds.js:823`; `src/services/SwarmEngine.js:475`; `UI-STANDARDS.md:108`. |
| F30 | **CONFIRMED** | Enabled Play silently returns without two waypoints: `index.html:1219`; `src/app/playback.js:186`; `UI-STANDARDS.md:98`. |

Browser-note claims:

- **CONFIRMED:** title case and stale Alt help, as above. “Persisted dot emitters” is implementation language (`src/controllers/SceneOutlineController.js`, crowd introduction; rule `UI-STANDARDS.md:65`); **DOWNGRADE-TO-JUDGEMENT** for treating all geometry/network vocabulary as forbidden—networks belong in the brief (`project/brief.md:33`).
- **CONFIRMED:** Guide selection unexpectedly enters a mode without advance warning: `src/app/network.js:67`; `index.html:988`; rule `UI-STANDARDS.md:205`. Fixed banner also covers still-focusable header controls: `src/services/NetworkEditService.js:765`; `index.html:28`.
- **CONFIRMED:** stale post-trace hint: exit refreshes before graph replacement, with no subsequent Guide refresh (`src/app/crowds.js:747`, `:749`; `src/app/network.js:106`).
- **REFUTED:** disabled card reasons are “title-only”—also included in accessible names (`src/app/editorPanel.js:96`, `:103`). Visible keyboard help remains B-07.
- **DOWNGRADE-TO-JUDGEMENT:** raw coordinate precision; rounding editable geometry is not required by the slider rule (`UI-STANDARDS.md:108`).
- **REFUTED:** blanket “nothing obscured” (`design-review-walkthrough-2026-10-08.md:80`); B-02 remains. “No tooltip” on dirty title also contradicts `src/app/persistence.js:1211`.
- **REFUTED as code claims:** no HTML success announcement (`src/app/exporting.js:375`); hover-only waypoint actions (`styles/main.css:2518`); Node card available only through Edit network (`src/services/NetworkEditService.js:121`).

**B. Defect candidates**

Unless noted below, no matching open DEF covers the mechanism. Open inventory: `project/backlog.md:26`, `:55`. Reproductions below are code-supported; not fresh browser observations.

| ID | Mechanism and trusted reproduction |
|---|---|
| C-1 | **Real.** Tab onto a collapsed header: external ring clipped (`styles/main.css:888`, `:935`). |
| C-2 | **Real; supplied repro wrong.** Native validation rejects 150% before custom error creation (`src/controllers/SceneOutlineController.js:1227`). Instead reconnect already-connected nodes: custom error lacks accent (`src/app/sceneOutline.js:728`; `styles/main.css:2162`). |
| C-3 | **Real.** Block uncached `images/Garlic.jpg`, select Garlic: console-only failure (`src/app/backgroundLoading.js:87`). |
| C-4 | **REFUTED.** Type Width 20, Tab → **100**; clamps precede the cited event (`src/controllers/UIController.js:1051`, `:1059`). |
| C-5 | **Real duplicate channels**, exact speech order unverified. Shift-delete waypoint: toast live region plus queued announcement (`index.html:90`; `src/main.js:858`). Crowd deletion example is wrong: `src/app/crowds.js:781` emits only toast. |
| C-6 | **Real appearance; judgement**, per B-12. Start video export; inspect disabled toggle (`src/app/exporting.js:172`; `styles/main.css:3348`). |
| C-7 | **Real, incomplete help.** Help then Alt-click a waypoint: branch, not force-add (`src/config/helpContent.js:50`; `src/handlers/InteractionHandler.js:616`). Already `project/wish-list.md:62`. |
| F26 | **Real.** Open day → Visitors → Edit network → drag node: authored coordinates change, resolved position stays (`src/services/NetworkEditService.js:623`; `src/models/GraphNode.js:51`). Related wish-list `:63`; distinct from DEF-79’s timing-space defect (`project/items/DEF-79.md:5`). |
| F27 | **Real.** Open day → Visitors → change Window start: anchor still wins (`src/utils/routeAnchors.js:138`). Probe: authored 80%, effective 10%. Distinct from DEF-79. |
| F28 | **Real.** Outline Count 1000 → card → **ArrowLeft**: jumps into ≤500 range (`src/app/crowds.js:819`, `:248`; `index.html:1042`). ArrowRight at the maximum need not emit input. Not DEF-20’s restore-sync mechanism (`project/items/DEF-20.md:5`). |
| F29 | **Real.** Start 60%, length 100% → effective span 40% (`src/services/SwarmEngine.js:475`). |
| F30 | **Real.** Empty route → Add crowd → draw two nodes → Done → Play: no action (`src/app/playback.js:186`). Not DEF-62’s end-of-playback failure (`project/backlog.md:63`). |
| F31 | **Real rendering, judgement as defect.** Collect crowd at one endpoint, skip to end: overlapping dots (`src/services/SwarmEngine.js:603`, `:956`). No rule requires spreading them. |
| F32 | **Real**, same C-7/wish-list 62. Preserve Alt-click’s still-valid empty-canvas behaviour (`src/handlers/InteractionHandler.js:611`). |
| F33 | **Real**, duplicate F9. Focus Done and inspect accessible name (`src/services/NetworkEditService.js:760`). |
| F34 | **Real.** Drag, pause >400 ms without releasing, continue: multiple snapshots (`src/app/crowds.js:191`; `src/app/undoRedo.js:87`). Already wish-list `:97`; not camera-specific DEF-19. |
| F35 | **Timing difference real; proposed surprise unproved.** Stronger repro: change Traffic, then Direction within 400 ms; immediate snapshot cancels pending timer and merges changes (`src/app/undoRedo.js:70`; `src/app/network.js:112`). Fold into F34. |
| F36 | **Mechanism real; supplied repro REFUTED.** B is a dead end, so `A→B←C(exit)` returns **true** (`src/services/SwarmEngine.js:410`). Use reachable `A→B→A` with unreachable Exit C: false. Advice wording is incomplete, not necessarily false (`src/app/crowds.js:49`). |

Browser branch/crowd selection mismatch is also real: placement sets waypoint selection without emitting the event clearing crowd scope (`src/app/wiringControllers.js:421`; `src/app/crowds.js:179`). DEF-65 covers its undo issue, not this selection mismatch (`project/backlog.md:65`).

**C. Further breaches**

| Finding | Evidence / rule |
|---|---|
| Busyness keyboard edits discard focus | Enter commits, rebuild replaces focused input without restoration: `src/app/crowds.js:1004`, `:424`, `:935`; `UI-STANDARDS.md:194`. Separate from waypoint-list DEF-32. |
| Done discards keyboard focus | Clicking removes its containing banner without focus return: `src/services/NetworkEditService.js:792`, `:811`; `UI-STANDARDS.md:194`. |
| Path-weight errors lack explanation | Invalid input sets custom validity, never reports it, then silently restores value on change: `src/app/network.js:512`, `:526`; `UI-STANDARDS.md:100`. |
| Empty-emitter crowd shows stale controls | Valid `emitters:[]` skips editor refresh without empty state/disable: `src/models/FlowLayer.js:54`; `src/app/crowds.js:811`; `UI-STANDARDS.md:78`. |

Missed **classifications**: J-16 uppercase rendering breaches sentence case (`styles/main.css:961`; `UI-STANDARDS.md:58`); J-18 lacks visible Timeline label (`index.html:1226`; standard `:59`); J-11’s increased-contrast primary buttons use white/red **6.425:1** (`styles/main.css:3595`; standard `:184`).

**Network order is fact; total invisibility is conditional.** Guide precedes route in `src/services/RenderingService.js:1290`; active editing affordances render above it at `:1424`. Coincident geometry explains occlusion, but width, visibility and glyph extent decide how much disappears (`src/services/NetworkEditService.js:839`, `:877`).

**D. PR split**

Accept with adjustments:

| PR | Test churn / sequencing |
|---|---|
| 1 words | TST-04 captures text/ARIA/title changes (`tests/helpers/controlState.js:83`); stale-help assertions at `tests/keyTable.test.js:517`. **After DEF-20/32** for `UIController.js:1697`. No necessary `InteractionHandler.js` edit: documenting Alt behaviour need not collide with DEF-13. |
| 2 targets/focus | CSS-only fixes do not normally change control goldens; stylesheet rendering is excluded (`tests/helpers/controlState.js:71`). However, target changes contradict existing assertions (`tests/holdAtEnd.test.js:142`). B-06 causes DOM churn and must repair `valueEl.closest('label')` lookup (`src/app/network.js:581`). Drop B-03’s unsupported premise. |
| 3 colour/tokens | Normally no TST-04 churn for stylesheet-only edits (`tests/helpers/controlState.js:71`). Remove duplicate B-12 ownership; a new progress element belongs with status. |
| 4 status | Substantial DOM, announcement, focus and lifecycle churn (`tests/goldenControls.test.js:57`). Discard tests explicitly expect one click (`tests/unrestoredAutosave.test.js:297`). **After DEF-20** for `persistence.js:1205`, and any reused `UIController.js:905` modal code. |

Move **B-21 semantic headers into PR 2**: anatomy and clipped focus are coupled. Native button conversion must address the existing Enter/Space handler (`src/controllers/SectionController.js:247`; `tests/keyTable.test.js:1670`).

PR 1’s button hints require implementation work: plain button `data-tip` is currently ignored (`src/components/ParamTooltip.js:191`). J-21 description placement is optional; accessible **visible** reasons can be addressed with B-07.

**E. Owner-intent overreach**

- F31’s seeded spreading changes rendered scenes; overlap alone authorises no new geometry (`src/services/SwarmEngine.js:956`).
- F27/F29 do not authorise clearing anchors or changing stored windows; truthful effective readouts can preserve behaviour (`src/utils/routeAnchors.js:138`; `src/services/SwarmEngine.js:475`).
- F8 must not collapse crowd/emitter or weight/share: these are distinct model quantities (`src/models/FlowLayer.js:54`; `src/app/network.js:558`).
- F14’s proposed “untyped nodes are both” is false: entry/exit fallbacks differ (`src/services/SwarmEngine.js:680`, `:695`).
- F13’s “expert opens it every time, novice never” invents usage; a Variation card is owner judgement (`crowd-07-crowd-review-2026-10-08.md`, F13; `UI-STANDARDS.md:137`).
- B-17’s “Saved just now” needs an explicit save/recovery distinction; dirty state alone cannot supply it (`src/app/persistence.js:1205`).
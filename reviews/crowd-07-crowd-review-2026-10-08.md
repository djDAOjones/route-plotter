# CROWD-07 — static (code) half of the crowd/network design review

Clone read: a scratch clone at `a312b55` (v3.2.707, after CROWD-06, UI-03, UI-04, DEF-77). Paths below are relative to that clone. Nothing in the clone was modified. Probe: `crowd-07-probe-2026-10-08.mjs` (beside this file; run it from the repo root with `node reviews/crowd-07-probe-2026-10-08.mjs`) (imports the real `SwarmEngine`, `FlowLayer`, `Emitter`, `GraphNode`, `graphRouting`, `routeAnchors`; its output is quoted where used as evidence).

Severity: **breach** = a hard rule in `UI-STANDARDS.md` is broken (rule quoted); **judgement** = layout, emphasis, wording or feature. Findings are numbered F1–F38; the register at the end lists them with one-line proposed tweaks.

Criteria read: `UI-STANDARDS.md` whole; items DEF-77, CROWD-05, CROWD-06, UI-03, UI-04; wish-list lines 20, 21, 22, 55, 56, 62, 63, 65, 69, 70, 71, 73, 77, 78, 96, 97, 98, 102, 103.

---

## 1. Parameter matrix

New-crowd defaults the matrix assumes (`src/app/crowds.js:41-42, 692-702`; `src/models/Emitter.js:60-78`): guide = route when ≥ 2 waypoints else custom network; 50 dots; Speed 0.40 img/s; Pace variation 20 %; Size 0.40×; colour `#56B4E9`; At journey end = Respawn; Window start 0 %, Window length 50 %; Release timing 20 %; Release bias Even; Busyness even; Walking variation 0 %; seed random at creation.

Persistence: every row marked "yes" goes through `_buildProjectSnapshot` → `scene.toJSON()` (`src/app/persistence.js:1225-1247`) → `FlowLayer.toJSON` (`src/models/FlowLayer.js:117-126`) → `Emitter.toJSON` (`src/models/Emitter.js:123-143`), `GraphNode.toJSON` (`src/models/GraphNode.js:95-105`), `GraphEdge.toJSON` (`src/models/GraphEdge.js:82-91`). Not persisted: a node's resolved anchor position (`GraphNode.js:39-42`), pen/selection state.

### 1a. Emitter fields (all read by `SwarmEngine`; `dotSize`/`dotColor` by `DotRenderer`)

| Parameter | What it does | UI control (card › label) | Tier | Readout as shown | Hint (`data-tip`) | Persisted |
|---|---|---|---|---|---|---|
| `seed` | Seeds every per-dot draw: entry, path choice, onset jitter, pace, sway (`SwarmEngine.js:21-25, 174-185`) | Release › "Pattern seed" `<output>` + "Re-roll pattern" (`index.html:1088-1095`); outline "Deterministic seed" read-only (`SceneOutlineController.js:970`) | More (card); outline read-only | exact integer, `String(em.seed)` (`crowds.js:840`) | no `data-tip`; group `aria-describedby` → "Re-roll changes individual walking and set-off variation. Custom networks also re-roll which dots take each path." (`index.html:1094`; swapped by guide type `crowds.js:845-847`) | yes |
| `dotCount` | Dots released across the window (1–5000, `Emitter.js:35,62`) | Release › Count, slider 1–500 (`index.html:1040-1044`) · outline "Dots" 1–5000 (`SceneOutlineController.js:915-917`) | primary | `50` (no unit) (`crowds.js:248-251`) | yes: "Total dots released across the window" | yes |
| `speed` | Normalised image units per second along the guide (`SwarmEngine.js:524-525`; 0.001–1000, `Emitter.js:28,37`) | Motion › Speed, slider 0.01–1.00 (`index.html:1108-1112`; `crowds.js:273-276`) · outline "Speed (image units/second)" 0.001–1000 (`SceneOutlineController.js:938-940`) | compact | `0.40 img/s` | yes: "Dot travel speed in image-widths per second" (`index.html:1109`) | yes |
| `speedVariance` | Per-dot pace multiplier 1 ± v, floored at 0.05 (`SwarmEngine.js:88, 574-582`); re-drawn per respawned journey (`:51-58`) | Motion › Pace variation (`index.html:1114-1118`) · outline "Pace variation (%)" | compact | `20%` | yes: "Per-dot pace variation — 0% moves every dot at the same speed" | yes |
| `dotSize` | Radius = `scaleSizeClamped(size × 10 reference px)` (`src/services/DotRenderer.js:12,42`; `RenderingService.js:113-115`) | Dots › Size, slider 0.05–2.00 (`index.html:1018-1022`) · outline "Dot size (×)" 0.01–100 (`SceneOutlineController.js:949-951`) | compact | `0.40×` (`crowds.js:238-241`) | yes: "Dot size factor, scaled with the image like other elements" | yes |
| `dotColor` | Fill colour (`DotRenderer.js:44`) | Dots › Colour swatch, Okabe-Ito only, `data-allow-custom="false"` (`index.html:1009-1016`) · outline "Dot colour (hex or transparent)" free text (`SceneOutlineController.js:956-958`) | compact | swatch; exact text per `SwatchPicker` | yes, on the legend: "Colour of this crowd's dots" (`SwatchPicker.js:107-127`) | yes |
| `lifecycleMode` | What a dot does at an Exit, fallback exit or dead end: `disappear` / `collect` (park) / `respawn` (re-enter, new pace+sway) / `loop` (replay) (`SwarmEngine.js:594-612, 714-794, 825-865`) | Motion › At journey end: "Respawn at entry / Repeat journey / Disappear / Collect at exit" (`index.html:1120-1128`) · outline "At journey end": "Disappear / Respawn / Loop / Collect" (`SceneOutlineController.js:959-964`) | compact | select | yes: "What a dot does when it reaches the end of its journey"; plus conditional `#crowd-lifecycle-hint` "No dot's journey ends on this network. Set a node's Type to Exit to see this setting act." (`crowds.js:49-50, 866-875`) | yes |
| `releaseStart` | Window start as a fraction of the **base** timeline B (`SwarmEngine.js:474-481`; `sceneEnd.js:8-13`) | Release › Window start (`index.html:1046-1050`) · outline "Release start (%)" (`SceneOutlineController.js:918-921`) | primary | `0%` | yes: "When the first dots set off, as a position in the timeline" | yes |
| `releaseDuration` | Window length; `start + length` clipped to 1 at evaluation (`SwarmEngine.js:475-478`) | Release › Window length (`index.html:1052-1056`) · outline "Release length (%)" (`:922-929`) | primary | `100%` (new crowd 50 %) | yes: "How much of the timeline the release is spread across" | yes |
| `releaseAnchor` | Replaces `releaseStart` with a route moment (waypoint arrival / pause end / route end) when it resolves (`src/utils/routeAnchors.js:102-150`) | **none** — the only writer is the Open day example (`src/examples/index.js:119`); grep finds no UI in `src/app`, `src/controllers`, `index.html` | **GAP** | — | — | yes (`Emitter.js:136`) |
| `onsetVariance` | Blend of even slot and uniform draw (`src/utils/crowdArrival.js:35-36`) | Release › More › Release timing (`index.html:1062-1066`) · outline "Release timing (%)" | More | `20% uneven` / `Even` (`crowds.js:73-76`) | yes: "How unevenly individual dots set off within the release window" | yes |
| `intensityRamp` | Power bias of onsets toward the window's start (< 0) or end (> 0) (`crowdArrival.js:37-38`) | Release › More › Release bias, −100…100 (`index.html:1068-1072`) · outline "Release bias (%)" −100…100 (`SceneOutlineController.js:934-936`) | More | `Even` / `Earlier 40%` / `Later 40%` (`crowds.js:78-82`); outline: signed number | yes: "Left (Earlier) sets more dots off near the window's start; right (Later) near its end; Even favours neither" | yes |
| `busynessEnvelope` | Inverse-CDF of an authored density over the window, 2–8 handles (`src/utils/busynessEnvelope.js:97-153`) | Release › More › "Busyness over time": SVG graph drag + per-handle "Time %", "Busy %", "Change: Gradual/Sudden", Remove; "Add handle", "Reset to even" (`index.html:1074-1086`; `crowds.js:883-1014`) · outline read-only (`SceneOutlineController.js:966-969`) | More | summary `Even` / `3 handles` (`crowds.js:928-933`) | per-field hints (`crowds.js:57-63`); group hint `#crowd-busyness-hint` (`index.html:1079`) | yes |
| `wobble` | Sideways sine offset, amplitude ≤ 2 % of the image at 100 %, 4–12 waves per image unit (`SwarmEngine.js:81-85, 556-564`) | Dots › Walking variation (`index.html:1024-1028`) · outline "Walking variation (%)" | compact | `0%` | yes: "Sideways walking variation as dots travel — 0% follows the line exactly" | yes |

### 1b. FlowLayer / graph fields

| Parameter | What it does | UI control | Tier | Readout | Hint | Persisted |
|---|---|---|---|---|---|---|
| `name` | Layers row text, chip, announcements | Layers row double-click rename (`crowds.js:599, 645-685`) · outline "Crowd name" (`SceneOutlineController.js:839-842`) | Layers / outline | text | row `title="Double-click to rename"` only (`crowds.js:590`); outline hint yes (`:68`) | yes |
| `visible` | Hidden crowds are not drawn and do not extend the scene end (`sceneEnd.js:187-190`) | Layers row eye button (`crowds.js:601-619`) · outline "Visibility Shown/Hidden" (`:843-846`) | Layers / outline | icon; row dimmed (`main.css:1865-1868`) | `aria-label="Hide Crowd 1"`, `title="Hide crowd"`; outline hint yes | yes |
| `guideType` | Route polyline vs own graph (`SwarmEngine.js:455-463`) | Guide › Guide "Follow route / Custom network" (`index.html:987-993`) · outline "Guide: Route / Custom network" (`:847-850`) | compact | select | yes: "What the dots travel along" | yes |
| node `x`,`y` | Node position (authored); ignored while anchored (`GraphNode.js:51-55`) | canvas drag in Edit network (`NetworkEditService.js:563-568, 610-634`) · outline "Horizontal/Vertical position (%)" (`SceneOutlineController.js:1092-1099`) | pen / outline | outline `%` | outline only (`:46-47`) | yes |
| node `type` | entry = release point; exit = journey end from step 1 on; normal = pass-through (`SwarmEngine.js:680-683, 696-698`) | Node › Type "Pass-through / Entry / Exit" (`index.html:1148-1155`) + T key (`NetworkEditService.js:470-476`) · outline "Type" | compact | select; canvas glyph triangle/circle/square (`NetworkEditService.js:1082-1100`) | yes (`index.html:1149`, 45 words) | yes |
| node `label` | Shown only in outline names (`sceneSemantics.js:144`); never drawn on canvas (`NetworkEditService.js:1082-1100`) | outline "Label (optional)" (`:1105-1108`); trace writes the waypoint name (`routeTrace.js:101`) | outline only | text | outline hint yes (`:90`) | yes |
| node `anchorWaypointId` | Node follows a waypoint; written by Trace only (`routeTrace.js:102`), resolved on `calculatePath` (`pathTiming.js:284`; `routeAnchors.js:58-90`) | **none** (no bind/unbind UI) | **GAP** | — | — | yes |
| edge `direction` | one-way = source→target only (`graphRouting.js:17-25`) | Edge › Direction + "Swap direction" (one-way only) (`index.html:1183-1191`) · outline "Direction" (`:1134-1137`) | compact | select; mid-edge arrow on canvas (`NetworkEditService.js:870-872`) | yes: "Two-way edges carry dots in both directions; one-way edges only from their start node" | yes |
| edge `weight` | Share among departures, normalised per node, U-turn edge excluded when another exists (`graphRouting.js:17-49`; `SwarmEngine.js:885-893`) | Edge › Traffic slider 1–50 → weight 0.1–5.0 (`index.html:1193-1197`; `network.js:183-190, 448`) · Node › Path weights number inputs min 0.01, no max (`network.js:460-561`) · outline "Path weight" (`:1138-1141`) | compact | Edge: `100% configured share` / `50% · 50% configured shares` (`network.js:570-584`); Node: `Weight 1 · 50%` (`:558`) | Edge: yes (`index.html:1194`); rows: yes (`network.js:41-42, 502`) | yes |
| edge `controlPoints` | Bends; the smoothed curve is the walked curve (`SwarmEngine.js:906-931`) | canvas drag-to-bend (`NetworkEditService.js:593-603`) · outline "Bend points" (`:1148-1217`) | pen / outline | outline `%` | outline only | yes |
| `emitters[1…n]` | Every emitter is evaluated (`SwarmEngine.js:209-212`) | **none** — cards edit `emitters[0]` (`crowds.js:6-9, 218`); outline shows extras read-only and refuses edits (`SceneOutlineController.js:895-912`; `sceneOutline.js:615-617`) | **GAP** (known, wish-list:20) | — | — | yes |
| layer order | Render order (`Scene.js:14-16`); `Scene.moveFlowLayer` exists (`:77`) | **none** — no caller in `src` (grep: tests only) | **GAP** (known, wish-list:20) | — | — | yes |

### 1c. Engine constants and rules that change what a viewer sees but are not fields

| Constant / rule | Where | Effect | UI |
|---|---|---|---|
| `WOBBLE_MAX_AMPLITUDE = 0.02`, `WOBBLE_FREQ_MIN = 4`, `WOBBLE_FREQ_SPAN = 8` | `SwarmEngine.js:81-85` | Walking variation 100 % = ±2 % of the image, 4–12 waves per image unit | none; hint says only "0% follows the line exactly" |
| `MIN_SPEED_MULTIPLIER = 0.05` | `:88` | Pace variation can slow a dot to 5 % but never stop it | none |
| `JOURNEY_PACE_CYCLE = 64` | `:76` | Respawned paces repeat every 64 journeys | none |
| `MAX_HOPS = 2048` | `:78` | A walk that runs out of hops parks the dot (`:792-794`) | none |
| Entry fallback | `:680-683` | With no Entry node, **every** node that can be left is an entry | said only in the Type hint ("with no entry, dots set off from any node they can leave") |
| Exit fallback | `:96-117` | With no Exit node, one-connection nodes end journeys | said only in the Type hint |
| Exit ends from step 1 | `:696-698` | A dot released at an Exit leaves it first | none |
| Uniform entry choice | `:868-871` | Entries are picked by an unweighted hash; weights act only at junctions | none (an expert cannot bias which entry releases more dots) |
| U-turn avoidance | `graphRouting.js:27-29` | The arrival edge is excluded unless it is the only way on | Node fieldset help and Edge hint (`index.html:1159-1162`; `network.js:36`) |
| Corner easing on edge polylines | `SwarmEngine.js:31-35` | Dots slow through sharp bends like the head | none |
| `DOT_BASE_RADIUS_PX = 10` | `DotRenderer.js:12` | Size 1× = 10 reference px radius | none (readout is `×`) |
| Graphics scale (`styles.graphicsScale`) | `RenderingService.js:113-115` | Scales dot radius with everything else | Pacing › Scale (Route scope) |
| Hold at end (`styles.holdAtEndMs`) | `sceneEnd.js:198-203` | Looping crowds keep moving after the last end | Pacing › Hold at end (Route scope), not visible in Crowd scope |
| Base timeline B vs playback F | `sceneEnd.js:8-13`; `RenderingService.js:1312` | Releases are fractions of B; Disappear/Collect finishes extend F | Pacing › Duration breakdown "crowds finish +N s" (`sceneEnd.js:219-226`) |

**F1 (breach)** — Dots › Size reads `0.40×`, but the control is map-bound (radius = `scaleSizeClamped(size × 10)`, `DotRenderer.js:42`). UI-STANDARDS:112-113: "Map-bound size controls use `reference px` readouts and say in contextual help that exports scale them from the project's stable reference short edge." Marker, Head and Thickness already read "reference px" (`index.html:176, 438, 700`). Proposed tweak: readout "8 reference px" (diameter) and the sentence about export scaling in the hint; keep `dotSize` as stored.

**F2 (judgement)** — Speed's unit is anisotropic: lengths are hypot of normalised (0–1) coordinates on both axes (`PathCalculator.js:353-368` called on normalised points, `SwarmEngine.js:655-661`), so "image-widths per second" (`index.html:1109`) and "covers the image's width in about a second" (`SceneOutlineController.js:80`) are wrong for vertical travel on a non-square image. Proposed tweak: "image lengths per second (1 = the image's width across, its height down)".

**F3 (gap, judgement)** — `releaseAnchor` has no authoring UI, yet the built-in Open day crowd is anchored (`src/examples/index.js:119`): its Window start slider shows the authored `0%` while the engine releases at the Entrance arrival. See F27.

**F4 (gap, judgement)** — `anchorWaypointId` has no bind/unbind UI; the only way to unpin a traced node is to delete it. See F26.

**F5 (gap, judgement)** — Card ranges are narrower than the model: Count 1–500 vs 1–5000, Speed 0.01–1.00 vs 0.001–1000, Size 0.05–2.00 vs 0.01–100, Traffic 0.1–5.0 vs ≥ 0.01. The outline reaches the full range. See F28 for the defect this causes.

---

## 2. Controls with no visible effect at a new crowd's defaults

Canvas assumed 1280×800; route crowd unless stated. Probe lines quoted from `crowd-07-probe-2026-10-08.mjs` output.

| Control | Visible at defaults? | Why (code) |
|---|---|---|
| At journey end: Respawn at entry ↔ Repeat journey | **No on a route at Pace variation 0 %; barely at the default 20 %** | On a single-path guide the two differ only by each respawned journey's own pace and sway (`SwarmEngine.js:51-58, 586-612`). Probe (c): max distance between the two modes at t = 7 s is `0.0000` at 0 % and `0.5747` at 20 %. Gated by Pace variation / Walking variation / junctions. |
| At journey end: Disappear / Collect at exit | Yes — since CROWD-05 the end waits for them | Probe (d): default crowd on a 0.6-long route, B = 10 s, last finish 5.70 s; the Duration breakdown names it (`sceneEnd.js:219-226`). |
| Collect at exit — as a *crowd* | **Visually one dot** | Parked dots take the node's exact point with no wobble (`SwarmEngine.js:956-964`, `tangent: null`); on a route they share the end point and, at Walking variation 0 %, coincide (`:603-605`). 50 collected dots render as one disc. See F31. |
| Edge › Traffic on a node with one departure | **No** | Share is normalised among departures; with one, it is always 100 % (`graphRouting.js:40-49`; probe (f) `[100]`). The Node card hides Path weights below two departures (`network.js:474-477`) but the Edge card slider stays live and reads "100% configured share". |
| Edge › Traffic at a junction on a route-traced network | Yes | Fork node has two one-way departures, weights 1:1 (`routeTrace.js:128, 137-138`). |
| Node › Type = Exit on an end node of a pen-drawn chain | **No** | A one-connection node on a network with no Exit already ends journeys (`SwarmEngine.js:106-117`); typing it Exit changes nothing visible. Typing a *middle* node Exit is visible. |
| Node › Type = Entry on the first typed node | Yes | Entries collapse from "every node" (`:680-683`) to that node. |
| Window length past `100 − start` | **No** | Window end is clipped to 1 (`SwarmEngine.js:475-476`): at start 50 %, length 50 → 100 changes nothing, while the readout climbs to 100 %. See F29. |
| Release timing / Release bias / Busyness when Window length = 0 % | **No** | `windowSpan` 0 → every onset = `windowStart` (`crowdArrival.js:40`); probe (e): 1 distinct onset at timing 100 %, bias Later 100 %. Gated by Window length. |
| Busyness › Add handle (alone) | No, by design | New handle sits on the current curve (`crowds.js:359-361, 374-378`). |
| Re-roll pattern with Pace variation 0 %, Release timing 0 %, Walking variation 0 %, bias Even, busyness Even, route guide | **No** | Every seeded draw is multiplied by 0 or unused (`SwarmEngine.js:493-504, 574-582, 556-564`); the hint still promises change. |
| Window start on an anchored emitter (Open day) | **No** | `releaseStartFraction` ignores `releaseStart` while the anchor resolves (`routeAnchors.js:138-150`); probe (g): authored 80 % → effective 0.1. See F27. |
| Drag a traced (anchored) node in Edit network; outline node position | **No** | `moveTo` writes `x`,`y`; drawing and walking read `position()` = resolved anchor (`GraphNode.js:51-55, 86-89`; `NetworkEditService.js:613-624`; `sceneOutline.js:682`). Probe (a): authored 0.9,0.9 drawn 0.6,0.6. See F26. |
| Node › Label | Never on canvas | Only the outline shows it (`sceneSemantics.js:144`). |
| Walking variation moved from 0 % | Yes | ±2 % of image ≈ ±26 px at 1280 wide (`SwarmEngine.js:81`). |
| Any Release/Motion control on a custom-network crowd with **no route** | **No in playback** | `play()` returns when `waypoints.length < 2` (`src/app/playback.js:186`). See F30. |
| Everything on a hidden crowd | No | Not drawn (`sceneEnd.js:187-190`; row dimmed). Expected. |

**F6 (judgement)** — Respawn vs Repeat journey on a route: the labels promise two behaviours; at defaults the difference is a per-journey pace re-draw, which a viewer cannot name. Proposed tweak: hint text "On a route both repeat; Respawn varies each pass by Pace variation, Repeat journey replays it exactly."

**F7 (judgement)** — Edge › Traffic shows a live slider and "100% configured share" where there is no choice. Proposed tweak: disable with the accessible reason "Only one path leaves each end; add a second to weight it", as the Node card already hides its rows.

---

## 3. One concept, two names

| Concept | Card | Scene outline | Hint / help / engine text | Layers row · chip · announcement |
|---|---|---|---|---|
| Release window start | "Window start" (`index.html:1047`) | "Release start (%)" (`SceneOutlineController.js:918`; error label `sceneOutline.js:629`) | hints say "release window" (`index.html:1063`) | — (known: wish-list:70) |
| Release window length | "Window length" (`:1053`) | "Release length (%)" (`:922`; `sceneOutline.js:630`) | "How much of the timeline the release is spread across" | — |
| Dot count | "Count" (`:1041`) | "Dots" (`:915`; `sceneOutline.js:620`); summary "50 dots" (`:885`) | "Total dots released" | — |
| Speed unit | "0.40 img/s" (`crowds.js:275`) | "Speed (image units/second)" (`:938`); read-only "image units/second" (`:904`) | "image-widths per second" (`index.html:1109`); "covers the image's width" (`:80`) | — |
| Dot size | "Size", "0.40×" (`index.html:1019-1021`) | "Dot size (×)" (`:949`); error "Dot size" (`sceneOutline.js:636`) | "Dot size factor" | — |
| Colour | "Colour" (`index.html:1013`) | "Dot colour (hex or transparent)" (`:956`) | — | row swatch |
| Journey-end mode | "At journey end": Respawn at entry / Repeat journey / Disappear / Collect at exit (`index.html:1121-1127`) | "At journey end": Disappear / Respawn / Loop / Collect (`:959-964`); read-only "Lifecycle" (`:910`); error "Choose a valid lifecycle." (`sceneOutline.js:618`) | `sceneEnd.js:16` "Respawn and Repeat journey"; `crowdArrival.js:159` "set its lifecycle to disappear or collect" | — |
| Guide | "Follow route" / "Custom network" (`index.html:990-991`) | "Route" / "Custom network" (`:848-849`); summary "follows route" / "custom network" (`:820`); error "Choose Route or Custom network." (`sceneOutline.js:566`) | Add crowd title "follows the route" (`crowds.js:558-560`); announce "dots follow the route" (`:709`) | — |
| Seed | "Pattern seed" (`index.html:1090`), "Re-roll pattern" (`:1093`) | "Deterministic seed" (`:970`); extras "Seed" (`:911`) | announce "pattern re-rolled" (`crowds.js:354`) | — |
| Edge | "Edge", "Delete edge" (`index.html:1179, 1202`); banner "N edges" (`NetworkEditService.js:807`); Guide hint "(3 nodes, 2 edges)" (`network.js:412-413`) | "Edge N — Node 1 to Node 2" (`:1123`); "Path weight" (`:1138`); "connecting a path" (`:1032`) | Node card "Path weights", "Path 1 to exit 1" (`index.html:1158`; `network.js:501`); Type hint "no path leads out", "one connection" (`index.html:1149`); toast "edge limit" (`networkBudget.js:15`) vs its doc "links" (`:2-3`) | trace announce "N nodes, N paths" (`crowds.js:758`) |
| Edge weight | "Traffic" (`index.html:1194`); readout "configured share(s)" (`network.js:582-583`) | "Path weight" (`:1138`) | Node card "Weight 1 · 50%" (`network.js:558`); pattern hint "Junction shares set route proportions" (`crowds.js:846`) | — |
| Pass-through node | "Pass-through" (`index.html:1151`) | "Pass-through"; "Node type" vs "Type" (`:1000, 1100`) | model `'normal'` | chip "Editing · Node · pass-through" (`UIController.js:411`) |
| Edge direction values | "Two-way" / "One-way" (`index.html:1186-1187`) | same; edge summary ", two-way" raw (`:1123`) | hint "from their start node" (`index.html:1184`) vs outline "Source node"/"Destination node" (`:1017-1021`) vs "first node in the edge's name" (`:94-95`) | chip "Editing · Edge · two-way" raw value (`UIController.js:413`) |
| The drawing mode | button "Edit network" / "Editing network…" (`network.js:388-389`); title "Draw the network…" (`index.html:995`) | — | hint "Edit network hands you the pen" (`network.js:411`) | banner "Drawing network" (`NetworkEditService.js:755`); announce "Network editing —" (`network.js:208`); Done `aria-label="Finish network editing"` (`NetworkEditService.js:760`) |
| Bend | banner "drag an edge to bend it" (`:756`); Edge hint "bend paths" (`index.html:1200`) | "Bend points" (`:1151`) | toast "bend-point limit" (`networkBudget.js:16`); code "control point/handle" | — |
| Crowd / emitter | cards never say "emitter" | "Emitter 1 — primary", "Apply primary emitter" (`:885, 965`); help "every crowd and emitter" (`index.html:1250`) | announce "Primary emitter updated." (`sceneOutline.js:651`) | "Crowd 1"; chip "Editing · Crowd 1 · crowd" (`UIController.js:417`) |

**F8 (breach)** — Same concepts carry two to four names across card, outline, hints, chip and announcements (every row above). UI-STANDARDS:92-93: "Same words, icons, patterns, and spacing for the same concepts throughout. Do not create synonyms for existing concepts." Proposed tweak: one glossary (crowd, dots, release window start/length, path, path weight, pass-through/entry/exit, at journey end with the card's four option names) applied to `SceneOutlineController.js` labels/options, `network.js` hints, `UIController.js` chip text and the announcements.

**F9 (breach)** — Banner button: visible text "Done", accessible name "Finish network editing" (`NetworkEditService.js:760`). UI-STANDARDS:60 "Visible label text must match the accessible name" (and :208). Proposed tweak: drop the `aria-label` or make it "Done — finish network editing".

**F10 (judgement)** — "Collect at exit" and "Respawn at entry" name nodes a route guide does not have (route end / route start, `SwarmEngine.js:603-608`); on a pen network with no Exit, "exit" means a one-connection node. Proposed tweak: "Collect at the end" / "Respawn at the start".

**F11 (judgement)** — Hints use words the panel never shows: "one connection" (`index.html:1149`), "start node" (`:1184`), "departures" (`:1194`), "U-turn" (`:1160`, `network.js:36, 42`), "release window" (`:1063`), "junction" (`:1194`; `SceneOutlineController.js:96`) — nothing on screen is labelled a junction. Proposed tweak: reword to "path", "the node the edge leaves", "paths leaving this node", and name junctions in the Node card ("Paths leaving this node" as the fieldset legend).

**F12 (judgement)** — Accessible names that differ from their pointer tooltips: eye button `aria-label="Hide Crowd 1"` vs `title="Hide crowd"`; "×" `aria-label="Delete Crowd 1"` vs `title="Delete crowd"` (`crowds.js:605-606, 624-625`). Not a 2.5.3 breach (no visible text) but two strings for one control. Proposed tweak: one string.

---

## 4. Card contract check

Rule (UI-STANDARDS:137-140): "Complex inspector cards keep 2–4 conceptual controls for the shortest complete task visible in `.section-primary`. Secondary refinements use one native `details.section-more` disclosure labelled `More`; compact cards do not render an empty tier, and prerequisites never move behind it." Note: no `.section-primary` CSS rule exists (`grep styles/*.css`: none); it is a bare wrapper, so tiering is DOM-only.

| Card | `.section-primary` controls | `details.section-more` controls | Verdict |
|---|---|---|---|
| Guide (`index.html:981-1000`) | compact, no tiers: Guide select; Edit network (graph only); Trace route into network (graph only, disabled without a route) | — | OK. No empty tier. |
| Dots (`:1003-1030`) | compact: Colour, Size, Walking variation (3) | — | OK |
| Release (`:1033-1099`) | Count, Window start, Window length (3) | Release timing, Release bias, Busyness over time (graph + 2–8 rows × Time/Busy/Change + Remove, Add handle, Reset to even), Pattern seed, Re-roll pattern — 5 conceptual, up to ~30 controls | Within rule; no prerequisite behind More. Heavy More tier (judgement F13). |
| Motion (`:1102-1132`) | compact: Speed, Pace variation, At journey end (3) + conditional hint | — | OK |
| Node (`:1142-1167`) | compact: Type, Path weights fieldset (hidden under 2 departures), Delete node | — | OK |
| Edge (`:1177-1204`) | compact: Direction, Swap direction (one-way only), Traffic, Delete edge | — | OK |
| Layers crowd row (`crowds.js:571-636`) | select/rename, Hide/Show, Delete; "+ Add crowd" below | — | OK; no reorder (wish-list:20) |

No card exceeds 4 primary controls; no compact card renders a More tier; no prerequisite sits behind More.

**F13 (judgement)** — Release › More holds the whole variation vocabulary plus the seed; an expert opens it every time, a novice never. Proposed tweak: none within the rule; consider a "Variation" card of its own (seed, Re-roll, Release timing, Release bias, Pace variation, Walking variation) so "variation" is one place.

**F14 (judgement)** — Cross-scope prerequisite: on a pen network "At journey end" (Motion card, Crowd scope) acts only once the network has an end, which is set on the Node card (Node scope, reached by Edit network or the outline). The only tell is the conditional hint under the select (`crowds.js:49-50`), shown only for closed loops; the Guide card's hint never says a network needs entries/exits. Proposed tweak: Guide hint for custom networks: "Dots set off at Entry nodes and end at Exit nodes; untyped nodes are both" (one line).

---

## 5. Seeded variation rule

Rule (UI-STANDARDS:147-151): "Seeded variation controls expose the exact persisted seed and make Re-roll a discrete, undoable authoring action that changes the seed only. They use plain effect names and directional readouts instead of internal signed parameters, and must never introduce wall-clock randomness into playback, scrubbing or export."

- Exact seed exposed: yes — `#crowd-seed-value` = `String(em.seed)` (`crowds.js:840`), monospace tabular (`main.css:1070-1074`); outline "Deterministic seed" (`SceneOutlineController.js:970`). Read-only everywhere: no way to type or paste a seed (expert gap, §10).
- Re-roll discrete and undoable, seed only: yes — `_rerollCrowdPattern` flushes pending undo, `emitter.reseed()` guarantees a different value (`Emitter.js:109-116`), one `saveUndoState`, announces "Undo is available" (`crowds.js:338-356`). It also emits `scene:semantic-changed` so the scene end re-measures (finish times depend on the seed) — correct.
- Plain effect names / directional readouts: card yes — "Release timing: 20% uneven/Even", "Release bias: Earlier 40% / Later 40% / Even" (`crowds.js:73-82`), "Pace variation 20%", "Walking variation 0%". Outline **no** — "Release bias (%)" is a signed number −100…100 (`SceneOutlineController.js:934-936`; `sceneSemantics.js:97`), the internal `intensityRamp`; its hint names the direction (`:78-79`).
- Wall-clock randomness: none in evaluation — `hash` is integer-pure (`SwarmEngine.js:174-185`), `DotRenderer` is stateless (`DotRenderer.js:7-8`). `Math.random` appears only in id generation and `_randomSeed` (`Emitter.js:211, 222`; `GraphNode.js:120`; `GraphEdge.js:106`; `FlowLayer.js:246`); an invalid saved seed is rejected by `assertValidJSON` (`Emitter.js:178-181`) before `_validateSeed` could re-roll it (`:232-236`). A new crowd gets a random seed at creation only (`crowds.js:697-701`). OK.

**F15 (breach, mitigated)** — The outline's Release bias field shows the signed internal parameter. UI-STANDARDS:149-150 "plain effect names and directional readouts instead of internal signed parameters". Proposed tweak: label "Release bias (−100 earlier … 100 later)" or a direction select plus a 0–100 amount.

**F16 (judgement)** — The seed lives behind More and is not editable; recreating a colleague's crowd needs the project file. Proposed tweak: make `#crowd-seed-value` an `<input type="number">` with the same validation as `Emitter._validateSeed`.

---

## 6. Hint coverage

UI-03's "every parameter control" test counts `input, select, textarea, fieldset.swatch-fieldset` only (`tests/paramTooltip.test.js:620-623, 643-700`); buttons, outputs and the banner were never in its scope. Among parameter controls the claim holds: every crowd/network/outline field below has a `data-tip`.

### 6a. Cards and Layers

| Control | Hint? | Says direction / unit? | Notes |
|---|---|---|---|
| Guide › Guide select | yes | n/a | |
| Guide › Edit network | **`title` only** (`index.html:995`) | — | pointer-only help |
| Guide › Trace route into network | **`title` only** (`:997`; `network.js:400-402`) | — | pointer-only; disabled reason also title-only |
| Dots › Colour | yes (legend, `SwatchPicker.js:127`) | n/a | |
| Dots › Size | yes | **no unit** ("factor") | F1 |
| Dots › Walking variation | yes | 0 % end named; 100 % (±2 % of image) not | |
| Release › Count | yes | no unit needed | |
| Release › Window start | yes | "position in the timeline"; readout `%` | |
| Release › Window length | yes | yes | effective window after clipping not said (F29) |
| Release › Release timing | yes | "How unevenly" — 0 % = even only in the outline hint (`:74-75`) | |
| Release › Release bias | yes | yes, both ends (UI-03) | |
| Busyness › Time / Busy / Change | yes (`crowds.js:57-63`) | yes | |
| Busyness › Remove | `aria-label` only | — | button |
| Busyness › Add handle | **`title` only** (`crowds.js:981`) | — | pointer-only |
| Busyness › Reset to even | **none**; disabled with no reason (`:983-986`) | — | |
| Release › Pattern seed (output) | **none**; group described by the Re-roll hint (`index.html:1088`) | — | the hint explains Re-roll, not what a seed is |
| Release › Re-roll pattern | group hint only | — | |
| Motion › Speed | yes | unit named, but wrong for vertical travel (F2) | |
| Motion › Pace variation | yes | yes | |
| Motion › At journey end | yes + conditional `#crowd-lifecycle-hint` | the four options are not explained anywhere | F10 |
| Node › Type | yes (45 words) | yes, incl. both fallbacks | long (UI-STANDARDS:163 "brief") |
| Node › Path weight rows | yes (`network.js:502`) + fieldset help | yes | "U-turn", "departures" (F11) |
| Node › Delete node | none | — | button |
| Edge › Direction | yes | "start node" unnamed on the card (F11) | |
| Edge › Swap direction | **`title` only** (`index.html:1191`) | — | pointer-only |
| Edge › Traffic | yes | share, but for two-way "50% · 50%" does not say which end is which (`network.js:583`) | |
| Edge › Delete edge | none | — | button |
| Banner › Done | `aria-label` only | — | F9 |
| Layers › + Add crowd | **`title` only** (`crowds.js:558-560`) | — | pointer-only |
| Layers › row rename | **`title="Double-click to rename"`** (`:590`); gesture is pointer-only; keyboard route = outline Crowd name | — | |
| Layers › Hide / Delete | `aria-label` + `title` | — | F12 |

### 6b. Scene-outline crowd fields (`SceneOutlineController.js:41-98`, forms `:838-1217`)

All 30 fields carry a tip (test `:726-740`). Direction/unit check: Dots (none needed), Release start/length (%), Release timing (0 %/100 % named), Release bias (direction), Speed (unit, F2), Pace variation, Dot size ("scaled with the image", no px — F1), Walking variation, Dot colour (format), At journey end (options unexplained — F10), Crowd name, Visibility, Guide, node x/y (edges named), Type, Label, Source/Destination node, Direction (two wordings, `:93-95`), Path weight ("weight 2 is twice as likely" — the clearest in the app), bend x/y. Vocabulary only the outline uses: "Source node", "Destination node", "Loop", "Dots", "Release start/length", "Deterministic seed".

**F17 (breach)** — Seven controls' only help is a `title` attribute (Edit network, Trace route into network, Swap direction, Add handle, + Add crowd, row rename, Hide/Delete). UI-STANDARDS:170-172: "Help revealed by pointer must also be reachable by keyboard. Reveal it on the described control's `:focus-visible`". A `title` never shows on focus. Proposed tweak: move each to `data-tip` on a label-less pattern (the "?" trigger already supports a `legend`/`label` host; add a `data-tip` host for buttons) or to visible helper text.

**F18 (judgement)** — The Pattern seed output has no hint of its own and "Reset to even" has no hint and no disabled reason. Proposed tweak: `data-tip` "The number every variation is drawn from; the same seed always gives the same crowd" and `title`→`aria-describedby` "Already even".

---

## 7. Novice-path pre-analysis (expected path from the code, blank project)

"At journey end" options and what each needs (`SwarmEngine.js:594-612, 714-794, 825-865`):

| Option | On a route | On a network | Needs |
|---|---|---|---|
| Respawn at entry | re-enters at the route start with a new pace/sway | re-enters at a hash-picked Entry (or any node when none is typed) | nothing; loops for ever; Hold at end keeps it moving after the route (`sceneEnd.js:26-29`) |
| Repeat journey | replays the first pass exactly | replays the dot's own first walk | nothing; loops for ever |
| Disappear | gone at the route end | gone at an Exit, a one-connection node (no Exit), or a dead end | an end reachable from an entry — else the hint shows (`crowds.js:49-50, 866-875`) |
| Collect at exit | parks at the route end | parks on the end node | as Disappear; renders as one dot (F31) |

How a network gets an Exit: select a node (click it in Edit network, or the outline's "Select node N") → Node › Type = Exit, or press T twice (`NetworkEditService.js:470-476`); or trace a route (its last majors become exits, `routeTrace.js:188-194`). Without one, one-connection nodes end journeys (`SwarmEngine.js:106-117`). How a junction is made: with the pen, click an existing node ("click a node to continue from it", banner `NetworkEditService.js:755-756`; `clickNode` `:367-385`) then click empty canvas; or the outline's "Connect nodes" form (`SceneOutlineController.js:1016-1030`). No tool inserts a node into an existing edge (`:249-264` selects it; wish-list:65 confirmed). How a one-way edge is set: Edge › Direction = One-way; the direction is pen order, source = the node the pen was on (`NetworkEditService.js:351-352`), shown only by the mid-edge arrow (`:870-872`); Swap direction reverses it (`:498-514`); traced edges are one-way already (`routeTrace.js:138`).

**(a) People walking from one place to another (no route yet).** + Add crowd (`crowds.js:692-715`: no route → custom network, pen mode, announce "draw the network its dots will follow") → click A, click B (two untyped nodes, one two-way edge) → Done. Then: Play does nothing (`playback.js:186`); dots would set off from **both** nodes and walk **both** ways (entry fallback `SwarmEngine.js:680-683`; two-way default `GraphEdge.js:33-34`); and Respawn makes them cycle. Minimum to get "A to B, once": select A → Type Entry; select B → Type Exit; select the edge → One-way; At journey end → Disappear or Collect; then draw two route waypoints somewhere (clicking the canvas with a crowd selected first needs Route scope: `crowd:deselected` on `waypoint:selected`, `crowds.js:172-182`) — about 12 actions. What the screen does not say: that Play needs a route (only the Guide hint "Add at least two route waypoints to set the master timing", `network.js:414-416`, inside a collapsible card); that untyped nodes are all entries; that pen order sets one-way direction; that the default mode recycles.

**(b) A crowd that follows the route.** Two waypoints → + Add crowd. One click; route guide, Respawn, new defaults finish on a 960 px canvas (`crowds.js:33-42`); announce "dots follow the route". Nothing to set. Not said: a route-guided crowd follows `state.pathPoints` (`RenderingService.js:1319`), so it does not take branches — the Trace button's title is the only tell ("can branch where the route branches", `index.html:997`).

**(c) A crowd that splits at a junction.** Route way: Alt+click a major waypoint to arm a branch, click to place (`InteractionHandler.js:609-621`) → + Add crowd → Guide = Custom network (enters the pen on an empty graph, `network.js:67-70`) → Esc/Done → Trace route into network (`crowds.js:728-762`) → the fork node has two one-way departures at 1:1 (`routeTrace.js:128, 137`) → select it → Path weights "Path 1 to … · Weight 1 · 50%". Pen way: A, J, B, Esc (lift pen), click J, click C → J has three two-way edges; a dot from A at J avoids the U-turn and picks B or C by weight (`graphRouting.js:27-29`). Not said: the help screen still says Alt+click force-adds a major (`helpContent.js:50`; `keybindings.js:62-67`); "junction" is never a visible word; Trace is hidden until the guide is Custom network (`network.js:396-399`).

**(d) A crowd that arrives and stops.** Route crowd: At journey end = Collect at exit (or Disappear); the Duration readout grows "crowds finish +N s" (`sceneEnd.js:219-226`). Network crowd: the same, plus an end as above; a closed loop shows the hint. Not said: Collect stacks the crowd into one dot (F31); "exit" does not exist on a route (F10).

**(e) A crowd that loops.** Default Respawn already loops; Repeat journey loops exactly; or draw a closed loop (no end) and any mode loops — then the hint under At journey end says no journey ends (`crowds.js:49-50`), which here is a warning the author does not need. Hold at end (Pacing, Route scope, `index.html:726-728`) is what keeps the loop moving after the route; nothing in Crowd scope points to it.

**F19 (judgement)** — Novice path (a) silently fails at Play. Proposed tweak: disable Play with the reason "Add two route waypoints to set the timeline" (`playback.js:186` → announce + `aria-describedby`).

**F20 (judgement)** — The lifecycle hint fires on an intentional loop (task e) with advice to add an Exit. Proposed tweak: word it neutrally — "No journey ends on this network, so dots never Disappear or Collect; add an Exit if you want them to."

---

## 8. Behaviour-defect candidates (DEF rows, not tweaks)

**F26 — Dragging a traced (anchored) node has no visible effect but records an undo entry.** Mechanism: `moveDrag` → `node.moveTo` writes authored `x`,`y` (`NetworkEditService.js:613-624`; `GraphNode.js:86-89`); rendering, hit-testing and the walk read `position()`, which returns the resolved anchor while `_resolvedX !== null` (`GraphNode.js:51-55`); nothing clears an anchor on drag (grep `clearAnchorResolution|anchorWaypointId` in `NetworkEditService.js`, `network.js`, `crowds.js`: none). `endDrag` commits (`:640-648`) → `saveUndoState` (`network.js:112-118`). Probe (a): authored 0.9,0.9 drawn 0.6,0.6. Same for the outline's node position fields (`sceneOutline.js:674-693`). Repro: Open day → Visitors → Edit network → drag any node: it stays; Undo now has an entry; the outline shows the new numbers. (wish-list:63 is this defect.)

**F27 — Window start on an anchored emitter is a dead slider that reads the wrong value.** Mechanism: `syncCrowdEditor` shows `releaseStart` (`crowds.js:821-822`); the engine uses the anchor while it resolves (`routeAnchors.js:138-150`; probe (g): 80 % → 0.1); no UI shows or clears `releaseAnchor` (grep: only `src/examples/index.js:119`). Repro: Open day → Visitors → Release › Window start shows 0 %; drag it to 80 %: releases unchanged; delete the Entrance waypoint: releases jump to 80 %. Breach of UI-STANDARDS:108-109 ("Slider readouts show the value the renderer or timeline consumes").

**F28 — Card sliders clamp stored values outside their range and rewrite them on the first nudge.** Mechanism: `syncCrowdEditor` sets `el.value` to the stored value; the browser clamps the thumb to `max`/`min` while `setText` writes the true number beside it (`crowds.js:815-838` vs `index.html:1020, 1042, 1110`); the next `input` event writes the clamped value (`crowds.js:238-281`). Edge › Traffic: `weightEl.value = Math.round(weight × 10)` clamped to 1–50 (`network.js:448`), `input` writes `raw / 10` (`:186`); probe (h): 24 → thumb 50 → next nudge writes 5.0; 0.01 → 0.1. Repro: outline › Dots 1000 (or Path weight 24) → select the crowd (edge) → thumb at the end, readout "1000" → press → on the slider: value becomes 500 (5.0). Also hits projects authored in the outline or by console.

**F29 — Window length readout exceeds the window the engine uses.** Mechanism: `windowEnd = min(start + length, 1)` (`SwarmEngine.js:475-476`); the readout shows the authored length (`crowds.js:258-261`). Repro: Window start 60 %, Window length 100 %: readout "100%", effective 40 %. Breach of UI-STANDARDS:108-109 as F27. Fix either way: clamp the slider's max to `100 − start`, or read "40% (clipped)".

**F30 — Play silently refuses while a custom-network crowd exists and no route does.** Mechanism: `play()` returns on `waypoints.length < 2` (`playback.js:186`) with no announcement, disabled state or reason; the transport button looks live. The crowd renders on scrub (base duration still set, `RenderingService.js:1312`). Repro: blank project → + Add crowd → two clicks → Done → Play. Breach of UI-STANDARDS:69-70 ("The UI must never appear frozen") and :98 ("disable impossible actions").

**F31 — Collect at exit renders a crowd as a single dot.** Mechanism: `_sampleNode` returns the node's exact point with `tangent: null`, so no wobble spreads parked dots (`SwarmEngine.js:956-964`); on a route every collected dot samples progress 1 and, at Walking variation 0 %, the same point (`:603-605`). Repro: new route crowd → At journey end = Collect at exit → skip to end: one disc where 50 arrived. (At Walking variation > 0 route dots fan sideways by frozen phase; network dots never do.)

**F32 — Alt+click help is stale, and the help screen has no crowd/network content.** Mechanism: `HELP_SECTIONS` says "Alt+Click to force-add a major waypoint" (`helpContent.js:50`) and the accordion reads `keybindings.js:62-67` "Force add major (bypass selection)"; `InteractionHandler.js:609-621` arms a branch on a waypoint and force-adds only on empty canvas. No section mentions crowds, networks, the pen keys (T, Esc, Shift-click, Delete) or Trace. Repro: open Help → Edit Points. (wish-list:62 confirmed.)

**F33 — Done button name mismatch** (F9): `NetworkEditService.js:760`. Repro: VoiceOver reads "Finish network editing, button" for the visible "Done".

**F34 — Crowd sliders record undo on a 400 ms idle timer, not per gesture.** Mechanism: every `_wireCrowdSlider` and the Edge Traffic / path-weight inputs route through `crowd:param-changed` → `saveUndoStateDebounced` (`crowds.js:190-196, 324-330`; `network.js:189, 524`; `undoRedo.js:87-93`). Repro: drag Speed, pause 0.5 s mid-drag, continue: two undo entries. (wish-list:97 confirmed for the crowd set.)

**F35 — Edge › Traffic edits are undo-debounced while Direction/Type commit at once.** Mechanism: `setSelectedEdgeDirection`/`setSelectedNodeType` emit `network:changed {commit: true}` → immediate `saveUndoState` (`NetworkEditService.js:461-468, 485-496`; `network.js:112-118`), the weight slider goes through the crowd pipeline (`network.js:183-190`). Repro: change Direction then nudge Traffic within 400 ms: one undo reverts both? No — the direction entry is separate but the weight entry lands later, so Undo order surprises. Low severity; fold into F34.

**F36 — The lifecycle hint's advice can be wrong.** Mechanism: `hasJourneyEnd` is false when no end is reachable from any entry (`SwarmEngine.js:286-293, 426-447`), including a network that *has* an Exit on a part the dots cannot reach (one-way edges pointing away); the hint still says "Set a node's Type to Exit" (`crowds.js:49-50`). Repro: A(Entry) → B one-way, C(Exit) ← B one-way from C: hint shows; adding another Exit elsewhere does nothing; the fix is the edge direction.

---

## 9. Wish-list triage (in-scope lines)

| Line | Quote (trimmed) | Recommend | Evidence |
|---|---|---|---|
| 20 | "multi-emitter authoring (cards edit `emitters[0]` only) and strip drag-reorder via `Scene.moveFlowLayer`" | keep | Confirmed: `crowds.js:218`; `sceneOutline.js:615-617` refuses; `moveFlowLayer` has no caller in `src`. |
| 21 | "click-on-edge splits it with a node, node labels/rename, arrow-key nudge and a network context menu" | promote the split (with 65); keep the rest | Edge click only selects (`NetworkEditService.js:249-264`); labels exist in the outline but are never drawn (`:1082-1100`); the pen has no keyboard move (`:713-741`). |
| 22 | "Mode banners are near-duplicates … extract a shared ModeBanner" | keep | Inline-styled banner (`NetworkEditService.js:746-796`); fix F9's name mismatch regardless. |
| 55 | "`scheduleDots` still counts Disappear and Collect dots as finishing … an Exit no dot can reach still counts as an end" | delete | `ends` now says whether a walk reaches an end (`SwarmEngine.js:258-265`) and `crowdFinishMs` reads it (`:328-329`); unreachable ends are excluded by `_nodesReachingEnd` (`:426-447`); `finishes` has no live application consumer (its two readers, `waitForCrowdMs` and `lastArrivalMs` in `crowdArrival.js`, are unused utilities) (`crowdArrival.js:107`). |
| 56 | "The network node hint … and the Type hint do not say that a network with no Exit ends journeys at its one-connection nodes" | keep (half done) | The Type hint now says it (`index.html:1149`); `#network-node-hint` still says only "finish at exits" (`network.js:31, 35`). |
| 62 | "help screen still says Alt+Click force-adds a major waypoint … says nothing of crowds, networks or branching" | promote → F32 | `helpContent.js:48-53`; `keybindings.js:62-67`; `InteractionHandler.js:609-621`. |
| 63 | "A traced network's nodes are pinned to their waypoints, but the node hint says 'Choose Edit network to move nodes'" | promote → F26 | Drag is a silent no-op with an undo entry. |
| 65 | "No tool inserts a junction node into an existing path" | promote | `NetworkEditService.js:337-385` links only from the pen node; outline "Connect nodes" joins existing nodes (`sceneOutline.js:719-744`). |
| 69 | "The hint under 'At journey end' refreshes after a route edit only when the timeline's length changes" | delete | The hint no longer depends on the timeline (`crowds.js:198-211, 866-875`; CROWD-05 plan step 6). |
| 70 | "outline's crowd labels say 'Release start' and 'Release length' where the crowd card says 'Window start' and 'Window length'" | promote → F8 (naming sweep) | `SceneOutlineController.js:918, 922`; `index.html:1047, 1053`. |
| 71 | "In forced-colours mode a parameter hint has no visible border" | keep | Not re-verified here. |
| 73 | "A click on a hover-opened hint closes it, so the first click of a double-click meant to select its text dismisses it" | keep | `ParamTooltip.js:669-674` confirms the behaviour. |
| 77 | "A 'Hold at start', so Preview shows the 2 s start buffer" | keep | Not crowd-specific. |
| 78 | "The scene end's first walk of a large network crowd can block editing" | keep | Cache is per emitter and key (`SwarmEngine.js:347-363`); the cold walk is unchanged. |
| 96 | "`waitForCrowdMs` is unused by the app" | keep | `crowdArrival.js:107` marks it. |
| 97 | "Several sliders record undo after 400 ms without input … the crowd sliders" | promote → F34 | `crowds.js:324-330`; `undoRedo.js:87-93`; plus Traffic and path weights. |
| 98 | "The Duration slider records no undo entry at all" | keep | Not crowd scope. |
| 102 | "On Open day the traced crowd walks during the reveal intro" | keep (likely by design) | Releases are fractions of B, which includes the intro (`pathTiming.js:764-772`); CROWD-05 criterion 3 pins releases to B. |
| 103 | "UI-STANDARDS § Help could name the '?' hint trigger" | keep | — |

---

## 10. Expert-depth summary

- Cannot author at all: a second emitter on a crowd, layer order, a release anchor (route-moment release), a node's waypoint binding, a seed value, a node label on the canvas, per-edge speed or per-node dwell (speed is per emitter only), which Entry releases more dots (entry choice is an unweighted hash, `SwarmEngine.js:868-871`).
- Cannot reach from the cards: Count 501–5000, Speed below 0.01 or above 1.00, Size below 0.05 or above 2.00, weight below 0.1 or above 5.0 (the outline can; the card then clamps and rewrites, F28); a custom hex dot colour (outline only, `index.html:1015`).
- Cannot read exactly: the dot's radius in pixels (readout is `×`, F1); the effective release window after clipping (F29) or when anchored (F27); which end a two-way "50% · 50%" belongs to (`network.js:583`); actual U-turn-adjusted shares versus "configured" (`graphRouting.js:27-29`); a crowd's own finish time (only the scene-wide "crowds finish +N s" in Pacing, `sceneEnd.js:219-226`); how many dots reach an end; a dot's journey length.
- Cannot tune: wobble amplitude ceiling (2 % of image) and frequency band, the 5 % pace floor, the 64-journey pace cycle, corner easing on edges (`SwarmEngine.js:31-35, 76-88`).
- Cannot see where the Hold at end that governs looping crowds lives while in Crowd scope (Pacing, Route scope).
- Keyboard-only authoring of a network is outline-only (position fields, Connect nodes, bend fields); the pen has no keyboard placement or nudge.
- The seed is readable but the whole "variation" vocabulary is split across three cards (Dots: Walking variation; Release › More: timing, bias, busyness, seed; Motion: Pace variation).

---

## Findings register

| # | Sev | Where | Finding | Proposed tweak |
|---|---|---|---|---|
| F1 | breach | §1 | Dot Size readout `×`, not reference px | "8 reference px" + export sentence in hint |
| F2 | judgement | §1 | Speed unit "image-widths" wrong for vertical travel | "image lengths per second (width across, height down)" |
| F3 | gap | §1 | `releaseAnchor` has no UI; Open day uses it | Release › "Start at: timeline % / waypoint arrival…" select |
| F4 | gap | §1 | Node anchors have no bind/unbind UI | Node card "Follows waypoint N · Unpin" |
| F5 | gap | §1 | Card ranges narrower than the model | widen or add a number field beside each slider |
| F6 | judgement | §2 | Respawn ≈ Repeat journey on a route | hint sentence naming the difference |
| F7 | judgement | §2 | Traffic live on single-departure nodes | disable with reason |
| F8 | breach | §3 | 2–4 names per concept across card/outline/chip/announce | one glossary applied everywhere |
| F9 | breach | §3 | "Done" vs `aria-label="Finish network editing"` | drop the aria-label |
| F10 | judgement | §3 | "Collect at exit"/"Respawn at entry" on routes | "at the end" / "at the start" |
| F11 | judgement | §3 | hints use unseen words (connection, start node, departures, junction) | reword in panel words; legend "Paths leaving this node" |
| F12 | judgement | §3 | row buttons: aria-label ≠ title | one string |
| F13 | judgement | §4 | Release › More is the whole variation vocabulary | consider a Variation card |
| F14 | judgement | §4 | At journey end's prerequisite (an end) lives in another scope, unsaid | one-line Guide hint for custom networks |
| F15 | breach (mitigated) | §5 | outline Release bias is the signed internal parameter | label with direction or select + amount |
| F16 | judgement | §5 | seed read-only, behind More | editable seed input |
| F17 | breach | §6 | seven controls have `title`-only help | `data-tip` hosts for buttons |
| F18 | judgement | §6 | Pattern seed no hint; Reset to even no hint/disabled reason | add both |
| F19 | judgement | §7 | Play silently refuses with no route | disable with reason (see F30) |
| F20 | judgement | §7 | lifecycle hint nags an intentional loop | neutral wording |
| F26 | DEF | §8 | anchored node drag: no-op + undo entry | clear the anchor on drag, or refuse the drag with a toast |
| F27 | DEF (breach) | §8 | Window start dead/misreading on anchored emitter | show "Starts at Entrance arrival" and disable, or expose the anchor (F3) |
| F28 | DEF | §8 | sliders clamp and rewrite out-of-range stored values | widen ranges or guard the first `input` |
| F29 | DEF (breach) | §8 | Window length readout exceeds the effective window | clamp max to `100 − start` or read "(clipped)" |
| F30 | DEF (breach) | §8 | Play does nothing with a network crowd and no route | disable Play with an accessible reason |
| F31 | DEF | §8 | Collect at exit renders as one dot | fan parked dots (seeded offset) or say so in the hint |
| F32 | DEF | §8 | help screen Alt+click stale; no crowd/network help | update `keybindings.js:62-67` text; add a Crowds section |
| F33 | DEF | §8 | = F9 | — |
| F34 | DEF | §8 | crowd sliders undo on idle timer | record on `change`, as CROWD-06's slider does |
| F35 | DEF (low) | §8 | Traffic undo timing differs from Direction/Type | fold into F34 |
| F36 | DEF | §8 | lifecycle hint advice wrong when an Exit is unreachable | "no end is reachable from an entry; check Exit nodes and one-way directions" |

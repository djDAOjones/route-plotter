# CROWD-08 — Football crowd and mob MVP

## Intent

The owner's client has a task due within a week that needs two scenes Route Plotter cannot make today. In the first, football fans arrive from several places (a station, the town centre, a car park, coaches) and fill each of a stadium's four stands. In the second, a mob moves from a market square, down a road, to another open space. Today a crowd starts and ends on single points: its dots set off from Entry nodes picked evenly, and Collect at the end stacks every dot on the Exit's one point. A crowd has no width beyond its sway, and a project with no route can neither play nor export. This item is the MVP that closes those gaps, specialised for these two scenes "at the expense of being generally useful" (the owner, the decisions: PLAN-4). It has seven parts, A to G, each of which may land as its own pull request. It ships as v3.3, and then the bulk of the work moves to v4 (MERGE-01).

## Acceptance criteria

- **A — Crowds without a route.**
  - With fewer than two route waypoints and a crowd whose network can release dots, Play (the button, Space and J/K/L) plays the crowds over the base timeline (`noPathBaseMs`, `src/core/PlayerCore.js` (:60–62), (:420–431)). The end waits for crowds that finish, as it does with a route (CROWD-05).
  - Export video and Export HTML accept such a project (`src/app/exporting.js` (:212), (:421)), and the exported HTML player plays it.
  - With no route and no crowd that can release dots, Play and both exports stay refused, with an accessible reason that names what to add.
  - Adding or removing route waypoints changes this without a reload.
  - DEF-84 closes with this part, by playing rather than by disabling Play, which its criteria left to the run.
- **B — Start areas.**
  - An Entry node can carry an area: a rectangle or an ellipse, with a width, a height and a turn. It is set in the node's card and in the scene outline, and is drawn on the map while editing, as the network is (`src/services/RenderingService.js` (:1342–1349)).
  - Each dot that sets off from that Entry starts at its own point inside the area. The point comes from the crowd's seed, so it is the same on every play, scrub and export. The dot walks straight to the node, then walks the network as today.
  - The scene end (`crowdFinishMs`, `src/services/SwarmEngine.js` (:313)) counts the walk to the node.
- **C — Finish areas.**
  - An Exit node can carry an area of the same kind.
  - With At journey end set to Collect at the end, a dot that reaches that Exit walks on to its own place inside the area and stays there. Places are given in order of arrival and spaced so that dots do not overlap while the area has room. When it is full, later dots share places, and the area's hint says so.
  - The order of arrival is worked out from the timeline alone, as the scene end's cached journeys are, so play, scrub and export agree.
  - The scene end waits for the walk into place.
  - An Exit with no area collects as today (`_sampleNode`, `src/services/SwarmEngine.js` (:956)). This part answers CROWD-07's row X-16 (collected dots render as one disc) for Exits with an area.
- **D — Entry shares.**
  - Each Entry node has a weight, as paths do. Its card and the scene outline show each Entry's share of the crowd's dots as a percentage, as Path weights does for paths (`index.html` (:1303)).
  - Dots choose their Entry in proportion to the shares. Equal shares choose exactly as today (`_pickEntry`, `src/services/SwarmEngine.js` (:868)), so saved projects are unchanged.
- **E — Duplicate a crowd.**
  - A crowd can be duplicated from the Layers strip and the scene outline. The copy keeps the network, areas, shares and settings, with new ids and a new pattern seed. It sits above the original, is selected, and is one undo step.
  - At the scene's limit of 32 crowds (`src/models/Scene.js` (:4)) the duplicate is refused with a reason.
- **F — Groups.**
  - A crowd setting, off by default, moves its dots in groups. It has two values: the group's size, in dots, and its width.
  - When it is on, a group's dots set off together, share one pace and one choice at every junction, and each keeps its own place across and along the path within the width. The crowd then moves as bodies of people. Walking variation still applies to each dot.
- **G — Leaving (Final whistle).**
  - A crowd setting, off by default, for a crowd whose Entries have start areas: dots wait in their start area. When it is on, every dot shows at its start point from the beginning of the animation. Dots set off in order of distance to their Entry node, nearest first, across the release window.
  - With finish areas at the crowd's Exits, or Disappear, a stand empties into the streets: the reverse of B and C.
- **All parts:**
  - With every new setting off or absent, each saved project's dots, timings and scene end are exactly as before, and the existing goldens stay unchanged.
  - Dot positions stay a pure function of the timeline instant, the project and the seed (the brief's mandate). Play, scrub, video export and the HTML player agree, and tests pin it.
  - The new settings are saved additively: a project that uses none saves as before. Load validates them within stated limits, and what can be authored can be loaded (`tests/authorableLoadable.test.js`).
  - The new settings appear in the scene outline under the same names, are undoable and autosaved, and meet the profile's standards (labels, 44 px targets, keyboard).
  - Specialised: no option beyond these parts, no ready-made presets (a wish line) and no general feature pop-up (MERGE-01).
  - No new dependency. Every existing test stays green, and none is deleted, skipped or weakened.

## Context and sources

- [The decisions](../decisions.md): PLAN-4 (the owner's words, picks and the filing session's readings)
- [DEF-84](./DEF-84.md): Play silent without route
- [CROWD-07](./CROWD-07.md): row X-16, collected dots as one disc
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md): F19, F30 and F31, and the "Uniform entry choice" row
- [CROWD-05](./CROWD-05.md): the scene end waits for every journey that ends
- `src/services/SwarmEngine.js`: entry choice (:868), the graph walk (:714), collected dots (:956), the scene end (:313)
- `src/app/playback.js` (:288) and `src/app/exporting.js` (:212), (:421): the guards part A removes
- `src/models/GraphNode.js` (:13): node types
- `DEV-INFRASTRUCTURE.md`: versioning, where `major.minor` is set in `package.json`

## Notes

- 2026-10-13 — Filed from the session that analysed the crowd tools for the owner's two scenes; its findings and probe are in the decisions (PLAN-4). Each part's design is the filing session's proposal within the owner's picks: simple shapes for areas; groups as a size and a width only; leaving as a wait in the start area. The order A to G is a proposal too: A first, since a mob scene may have no route. The intended recipes: for the football scene, one crowd per stand, with the streets drawn once and duplicated (E), each copy's Entries carrying start areas and shares and its Exit a finish area; for the mob, one crowd whose Entry carries a start area, moving in groups, with a finish area on its Exit. The first release from this item sets `package.json` to 3.3.0, so its builds are v3.3.

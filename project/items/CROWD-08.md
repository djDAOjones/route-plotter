# CROWD-08 — Football crowd and mob MVP

## Intent

The owner's client has a task due within a week that needs two scenes Route Plotter cannot make today. In the first, football fans arrive from several places (a station, the town centre, a car park, coaches) and fill each of a stadium's four stands. In the second, a mob moves from a market square, down a road, to another open space. Today a crowd starts and ends on single points: its dots set off from Entry nodes picked evenly, and Collect at the end stacks every dot on the Exit's one point. A crowd has no width beyond its sway, and a project with no route can neither play nor export. This item is the MVP that closes those gaps, built in the next minor versions and specialised for these two scenes "at the expense of being generally useful" (the owner; the decisions, PLAN-4). It has seven parts, A to G, each of which may land as its own pull request. Their design, their order, the supported combinations below and releasing them as v3.3 are the filing session's proposals within the owner's picks. Once the MVP ships, the bulk of the work moves to v4 (MERGE-01).

## Acceptance criteria

- **A — Crowds without a route.**
  - With fewer than two route waypoints and a crowd whose network can release dots, Play (the button, Space and J/K/L) plays the crowds over the base timeline. The end waits for crowds that finish, as it does with a route (CROWD-05).
  - A project with no route keeps a positive base timeline. Clear All sets it to zero (`src/app/projectReset.js` (:76)); when a crowd is added to such a project, or one is opened with a crowd, no route and a zero base timeline, it takes the default of 10 s (`ANIMATION.DEFAULT_DURATION`, `src/config/constants.js` (:10)). A positive base timeline is kept as it is. The Duration control sets it with no route.
  - Export video and Export HTML accept such a project (`src/app/exporting.js` (:213), (:421)), and the exported HTML player plays it.
  - With no route and no crowd that can release dots, Play and both exports stay refused, with an accessible reason that names what to add.
  - Adding or removing route waypoints changes this without a reload.
  - DEF-84 closes with this part, by playing rather than by disabling Play, which its criteria left to the run.
- **B — Start areas.**
  - An Entry node can carry an area: a rectangle or an ellipse, with a width, a height and a turn. It is set in the node's card and in the scene outline, and is drawn on the map while editing, as the network is (`src/services/RenderingService.js` (:1342–1349)).
  - Each dot that sets off from that Entry starts at its own point inside the area. The point comes from the crowd's seed, so it is the same on every play, scrub and export. The dot walks straight to the node at its own pace, then walks the network as today.
  - The scene end (`crowdFinishMs`, `src/services/SwarmEngine.js` (:313)) counts the walk to the node.
- **C — Finish areas.**
  - An Exit node can carry an area of the same kind.
  - With At journey end set to Collect at the end, a dot that reaches that Exit walks on to its own place inside the area and stays there.
  - The places are a grid in the area's own axes, spaced by the crowd's dot diameter plus a quarter of it, converted to the map through the project's render reference so they do not overlap on screen. They are ordered from the node outward, row by row. The area's capacity is the number of places that fit inside its shape. Past capacity, later dots take the places again from the first, and the area's hint says so.
  - Dots take places in order of their arrival at the Exit node, ties broken by dot index. The ranking is worked out from the project alone, as the scene end's cached journeys are: a cold evaluation, a backward seek and an edit that changes arrival times all give the same places as evaluating from scratch.
  - The scene end waits for the walk into place.
  - An Exit with no area collects as today (`_sampleNode`, `src/services/SwarmEngine.js` (:956)). This part answers CROWD-07's row X-16 (collected dots render as one disc) for Exits with an area.
- **D — Entry shares.**
  - Each Entry node has a weight, as paths do. Its card and the scene outline show each Entry's share of the crowd's dots as a percentage, as Path weights does for paths (`index.html` (:1303)).
  - Dots choose their Entry in proportion to the shares. With equal shares, every dot chooses the same Entry as today (`_pickEntry`, `src/services/SwarmEngine.js` (:868)): a test compares each dot's choice before and after for several seeds and Entry counts.
- **E — Duplicate a crowd.**
  - A crowd can be duplicated from the Layers strip and the scene outline. The copy keeps the network, areas, shares and settings, with new ids and a new pattern seed. It sits above the original, is selected, and is one undo step.
  - The copy is admitted only if the whole project would still load: every scene limit is checked, not only the 32 crowds (`Scene.assertValidJSON`, `src/models/Scene.js` (:145), among them the total of 20,000 dots at (:6)). A refusal gives its reason and leaves the scene, the selection, the undo history and the saved project as they were.
- **F — Groups.**
  - A crowd setting, off by default, moves its dots in groups. It has two values: the group's size, in dots, and its width.
  - Group *k* holds the dots from index *k* × size, up to the crowd's count. The group, not each dot, picks the Entry (by its shares), the release time (by the crowd's release settings, applied to groups), the pace (by Pace variation) and the choice at every junction.
  - Each member keeps its own place across and along the path within the width, the same on every play. With a start area, members start around their group's own point in the area, keeping those places, and walk to the node together. Walking variation still applies to each dot.
  - At a finish area the group dissolves: each member takes its own place by its own arrival, as part C says.
- **G — Leaving (Final whistle).**
  - A crowd setting, off by default, for a crowd whose Entries have start areas: dots wait in their start area. When it is on, every dot shows at its start point from the beginning of the animation. Dots set off in order of distance to their Entry node, nearest first, ties broken by dot index, spread across the release window.
  - With finish areas at the crowd's Exits, or Disappear, a stand empties into the streets: the reverse of B and C.
- **Supported combinations (the MVP's bounds):**
  - Areas act with At journey end set to Disappear or Collect at the end. With Respawn or Repeat journey, dots start and end at the nodes as today, and the area's hint says so.
  - Groups (F) and waiting in the start area (G) are not combined: while G is on, F is unavailable, with its reason. Any other pairing of the parts works.
- **All parts:**
  - With every new setting off or absent, each saved project's dots, timings and scene end are exactly as before, and the existing goldens stay unchanged. A project that uses no new setting saves byte for byte as before. The one exception is part A's default for a project that has crowds, no route and a zero base timeline, which could not play before.
  - Dot positions stay a pure function of the timeline instant, the project and the seed (the brief's mandate). The parts add no disagreement between play, scrub, video export and the HTML player. Those that exist today stay open under their own IDs (DEF-78, DEF-79, DEF-80).
  - The new settings are saved additively; load validates them within stated limits. Tests author every new setting through the node or crowd card and through the scene outline, at its minimum, its maximum and a middle value, then save, load and compare. The existing authorable-loadable fixture leaves crowd controls inert (`tests/authorableLoadable.test.js` (:18–22)), so it does not cover them alone.
  - The new settings appear in the scene outline under the same names, are undoable and autosaved, and meet the profile's standards (labels, 44 px targets, keyboard).
  - Specialised: no option beyond these parts, no ready-made presets (a wish line) and no general feature pop-up (MERGE-01).
  - No new dependency. Every existing test stays green, and none is deleted, skipped or weakened.

## Context and sources

- [The decisions](../decisions.md): PLAN-4 (the owner's words, picks and the filing session's readings)
- [DEF-84](./DEF-84.md): Play silent without route
- [CROWD-07](./CROWD-07.md): row X-16, collected dots as one disc
- [The crowd review](../../reviews/crowd-07-crowd-review-2026-10-08.md): F19, F30 and F31, and the "Uniform entry choice" row
- [CROWD-05](./CROWD-05.md): the scene end waits for every journey that ends
- [DEF-78](./DEF-78.md), [DEF-79](./DEF-79.md) and [DEF-80](./DEF-80.md): today's disagreements between outputs
- `src/services/SwarmEngine.js`: entry choice (:868), the graph walk (:714), collected dots (:956), the scene end (:313)
- `src/app/playback.js` (:288) and `src/app/exporting.js` (:213), (:421): the guards part A removes
- `src/app/projectReset.js` (:76) and `src/config/constants.js` (:10): Clear All's zero timeline and the default duration
- `src/models/Scene.js` (:4–6), (:145): the scene's limits
- `src/models/GraphNode.js` (:13): node types
- `DEV-INFRASTRUCTURE.md`: versioning, where `major.minor` is set in `package.json`

## Notes

- 2026-10-13 — Filed from the session that analysed the crowd tools for the owner's two scenes; its findings and probe are in the decisions (PLAN-4). Part A comes first because a mob scene may have no route. The intended recipes: for the football scene, one crowd per stand, with the streets drawn once and duplicated (E), each copy's Entries carrying start areas and shares and its Exit a finish area; for the mob, one crowd whose Entry carries a start area, moving in groups, with a finish area on its Exit. The filing session's view: seven parts under Codex rounds until approval is tight for a week. If the week runs short, A to E (the football scene) come before F and G, unless the owner orders otherwise. The first release from this item sets `package.json` to 3.3.0, so its builds are v3.3 (a proposal).

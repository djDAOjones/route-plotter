# CROWD-08 — Football crowd and mob MVP

## Intent

Asked when his client needs these features working, the owner picked "Within a week": the client's upcoming task needs two scenes Route Plotter cannot make today. In the first, football fans arrive from several places (a station, the town centre, a car park, coaches) and fill each of a stadium's four stands. In the second, a mob moves from a market square, down a road, to another open space. Today a crowd starts and ends on single points: its dots set off from Entry nodes picked evenly, and Collect at the end stacks every dot on the Exit's one point. A crowd has no width beyond its sway, and a project with no route can neither play nor export. This item is the MVP that closes those gaps, built in the next minor versions and specialised for these two scenes "at the expense of being generally useful" (the owner; the decisions, PLAN-4). It has seven parts, A to G, each of which may land as its own pull request. The owner confirmed the placement, the deadline of 2026-10-20 and releasing it as v3.3; the parts' design, their order and the supported combinations below are the filing session's proposals within his picks. Once the MVP ships, the bulk of the work moves to v4 (MERGE-01).

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
  - The places are a grid in the area's own axes, laid out once in normalised image coordinates. Their spacing is the largest dot diameter among the crowd's emitters plus a quarter of it, measured at the project's render reference with Graphics scale 1. A place counts only if its whole dot, at that size, fits inside the shape.
  - Places, their order, the capacity and every finishing time are the same whatever the viewport, the export size or Graphics scale. Dots are promised not to overlap only when drawn at the render reference with Graphics scale 1. Elsewhere dot sizes and the map scale by different rules, so dots may touch or overlap, and the area's hint says so. Tests check that landscape, portrait and Graphics scale 2 give the same places and finishing times. Places are ordered from the node outward, row by row. The area's capacity is the number of places. Past capacity, later dots take the places again from the first. An area too small for one place collects at the node as today. In both cases the area's hint says so.
  - Every dot of the crowd that reaches the Exit, from all its emitters, takes a place in order of its arrival at the Exit node. Ties are broken by emitter order, then dot index. The ranking is worked out from the project alone, as the scene end's cached journeys are: a cold evaluation, a backward seek and an edit that changes arrival times all give the same places as evaluating from scratch.
  - The scene end waits for the walk into place.
  - An Exit with no area collects as today (`_sampleNode`, `src/services/SwarmEngine.js` (:956)). This part answers CROWD-07's row X-16 (collected dots render as one disc) for Exits with an area.
- **D — Entry shares.**
  - Each Entry node has a weight, as paths do. Its card and the scene outline show each Entry's share of the crowd's dots as a percentage, as Path weights does for paths (`index.html` (:1303)).
  - Dots choose their Entry in proportion to the shares. With equal shares and groups off, every dot chooses the same Entry as today (`_pickEntry`, `src/services/SwarmEngine.js` (:868)): a test compares each dot's choice before and after for several seeds and Entry counts. With groups on, each group chooses, as part F says.
- **E — Duplicate a crowd.**
  - A crowd can be duplicated from the Layers strip and the scene outline. The copy keeps the network, areas, shares and settings, with new ids and a new pattern seed. It sits above the original, is selected, and is one undo step.
  - The copy is admitted only if the whole project would still load: every scene limit is checked, not only the 32 crowds (`Scene.assertValidJSON`, `src/models/Scene.js` (:145), among them the total of 20,000 dots at (:6)). A refusal gives its reason and leaves the scene, the selection, the undo history and the saved project as they were.
- **F — Groups.**
  - A crowd setting, off by default, moves its dots in groups. It has two values: the group's size, in dots, and its width.
  - Group *k* holds the dots whose index *i* satisfies *k* × size ≤ *i* < min((*k* + 1) × size, count). The group, not each dot, picks the Entry (by its shares), the release time (by the crowd's release settings, applied to groups), the pace (by Pace variation) and the choice at every junction.
  - Each member keeps its own place across and along the path within the width, the same on every play. Walking variation still applies to each dot.
  - With a start area, each member starts at its own point inside the area, as part B says, and walks to the node at the group's release. Members that arrive first wait at their places beside the node. The group walks on once its last member arrives.
  - At a finish area the group dissolves: each member takes its own place by its own arrival, as part C says.
- **G — Leaving (Final whistle).**
  - A crowd setting, off by default, for a crowd whose Entries have start areas: dots wait in their start area. When it is on, every dot shows at its start point from the beginning of the animation. Dots set off in order of distance to their Entry node, nearest first, ties broken by dot index, spread across the release window.
  - With finish areas at the crowd's Exits, or Disappear, a stand empties into the streets: the reverse of B and C.
  - Waiting acts only with At journey end set to Disappear or Collect at the end. With Respawn or Repeat journey, the setting is kept but has no effect, and its hint says why; switching back restores it.
- **Supported combinations (the MVP's bounds):**
  - Areas (B, C), groups (F) and waiting (G) act only with At journey end set to Disappear or Collect at the end. With Respawn or Repeat journey, dots start and end at the nodes and move singly as today. Each setting is kept but has no effect, and its hint says why.
  - Groups (F) and waiting (G) are not combined: while G is on, F is unavailable, with its reason.
  - Groups and waiting act per emitter, as release settings and lifecycles do: membership, release, nearest-first order and the lifecycle test each use that emitter's own count, dot indices, seed, release window and At journey end. An emitter set to Respawn or Repeat journey is unaffected while the crowd's others act. The crowd card edits the first emitter only (`emitters[0]`), so a crowd with several emitters gets them from a saved project.
  - Crowds without a route (A), entry shares (D) and duplicating (E) work with everything.
  - Groups and waiting act on a crowd's own network. On Follow route, they are unavailable, with their reason.
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

- 2026-10-13 — Filed from the session that analysed the crowd tools for the owner's two scenes; its findings and probe are in the decisions (PLAN-4). Part A comes first because a mob scene may have no route. The intended recipes: for the football scene, one crowd per stand, with the streets drawn once and duplicated (E), each copy's Entries carrying start areas and shares and its Exit a finish area; for the mob, one crowd whose Entry carries a start area, moving in groups, with a finish area on its Exit. The filing session's view: seven parts under Codex rounds until approval is tight for a week. If the week runs short, the run ships the parts that are done as they land, A to E (the football scene) first, and asks the owner whether F and G follow or move; it drops nothing without his word. The first release from this item sets `package.json` to 3.3.0, so its builds are v3.3, as the owner confirmed.
- 2026-10-14 — Part A built on its own branch, its pull request the lead's to open, to the brief's twelve sections and Codex's five folds: crowds without a route play and export, the base timeline defaults to 10 s, Duration sets it from 1 s to 5 min with no route, and Play, the exports and the Guide card share one test of what can play (`SwarmEngine.canRelease`). `package.json` is 3.3.0 with it. DEF-84 closes in the release record; this item stays open for parts B to G.
- 2026-10-14 — PR #139's first code review found an ambiguous crowd/emitter cache key, provisional network edits that left availability and timing stale, and a Duration description that kept saying route after deletion. The fixes use an encoded id tuple, refresh provisional changes and cancellation without committing them, and rewrite the readout at the route boundary. Its portrait-layout advisory reproduced a canvas overlap when the controls wrapped; fitting now measures their final width and height before resizing the canvas. The Play reason keeps the row the owner chose. These apply nielsen 1 and 9 (truthful status and reasons), carbon's existing helper-text pattern and house conventions' event ownership; eleven regression tests cover them. Review and release evidence belong to the PR and release record.

- 2026-10-14 — PR #139 round 2 found that replacing a project could still reuse a same-id model's cached journeys. The cache now uses layer and emitter object identities, with the existing signature validation inside each pair; weak keys release replaced models. Four regressions cover cold/warm interleaving and real sequential file loads in both orders, including Play and export reasons. Required archival has also paid PLAN-4's wish line about 71 live decisions, which is retired.

- 2026-10-14 — Part A shipped in v3.3.719 (PR #139, merge `5e03a4c`, deploy `457ead0`); DEF-84 closes in REL-719. This item remains in progress for B–G. The owner's latest instruction continues with B after the release record; the REL-719 decision records the Codex handover and the centred-area MVP call.

- 2026-10-14 — Part B adds optional centred Entry start areas in the node card and scene outline; seeded straight approaches contribute to finite journey timing, admission and scene end, with intrinsic image-plane rotation shared by renderer/player/exports. Inactive combinations retain the settings. The Part B decision records the lead's explicit square fallback, extreme-bound clipping and post-Entry walking-variation step. Tests cover both authoring surfaces, ZIP/recovery/autosave, image replacement and late-load rollback, exact boundaries, cache identity and legacy absence. Review and release evidence belong to the source PR and REL record; this item remains open for C–G.

- 2026-10-14 — Part B shipped in v3.3.720 (PR #142, merge `04be29e`, deploy `baa3a4c`); see REL-720 for publication evidence. CROWD-08 remains in progress for C–G, with Part C next under the owner's continuation.

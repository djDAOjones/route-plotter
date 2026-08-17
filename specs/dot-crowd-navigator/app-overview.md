> **Provenance:** archived verbatim from djDAOjones/dot-crowd-navigator (_Joe/Dot Crowd
> Navigator App Overview.md, HEAD f99f0ab) on 2026-08-17. Describes intent and phasing;
> NOTE its claims about code state (legacy cleared, controls stubbed) were never true of
> the fork's pushed code.

**Overview**

Dot Crowd Navigator is the Route Plotter repo being turned into a graph-based crowd-flow tool. Instead of one ordered waypoint chain and one animated path head, the target app lets you draw a network of nodes and weighted edges over a background image, then run a swarm of dots through that network. The repo currently describes itself as Phase 0: rebrand complete, legacy linear-route code mostly cleared, retained infrastructure still in place in [README.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/README.md#L1) and [src/main.js](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/src/main.js#L1).

**What exists now**

Right now the app is a working shell, not the finished graph editor. The implemented features are mostly the reused “map app infrastructure” from Route Plotter:
- Background image workflow: drag-drop, upload button, example backgrounds, zoom, tint, aspect-ratio-aware canvas sizing in [src/main.js](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/src/main.js#L182) and [index.html](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/index.html#L121).
- Single-orchestrator app shell, debug log download/copy, splash/help modal, undo/redo hooks, autosave hooks, and a placeholder transport bar in [src/main.js](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/src/main.js#L81).
- Retained infrastructure from Route Plotter: EventBus, CoordinateTransform, StorageService, UndoService, PathCalculator, CatmullRom, Easing, SwatchPicker, UI components, tokens, and deferred VideoExporter in [README.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/README.md#L38).
- Constants already reshaped toward graph/simulation concepts, but mostly still placeholders, in [src/config/constants.js](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/src/config/constants.js#L11).
- Tests now focus on retained shared infrastructure rather than old waypoint models in [tests/example.test.js](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/tests/example.test.js#L1).

What does not exist yet: actual nodes, edges, graph editing, weighted routing, or swarm simulation. The play/save/load controls are visibly stubbed for later phases in [src/main.js](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/src/main.js#L316).

**Target feature set**

The migration spec defines the intended app much more fully in [_Joe/Dot Crowd Navigator Migration.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/_Joe/Dot%20Crowd%20Navigator%20Migration.md#L705):
- Graph model: `GraphNode`, `GraphEdge`, `GraphModel`, with edges carrying direction, weight, curve data, and cached path geometry.
- Graph editing: add/move/delete nodes, draw edges, add/move control points, select nodes or edges, edit edge weights and direction, and mark entry/exit nodes.
- Weighting and routing: weighted branch selection at junctions, with preview thickness and playback expressed as dot flow.
- Multiple entry/exit nodes and per-edge directionality.
- Swarm simulation: total dot count, release period, onset variance, speed variance, intensity ramp from start to end, wobble/warble, lifecycle modes like disappear/respawn/loop/collect in [_Joe/Dot Crowd Navigator Migration.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/_Joe/Dot%20Crowd%20Navigator%20Migration.md#L777).
- Reused Route Plotter path-shape mechanics: Catmull-Rom smoothing, reparameterisation, squiggle/randomised path shaping, but applied per edge instead of across one waypoint chain in [_Joe/Dot Crowd Navigator Migration.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/_Joe/Dot%20Crowd%20Navigator%20Migration.md#L822).
- Labels adapted from the original waypoint-label system, again moved to graph nodes in [_Joe/Dot Crowd Navigator Migration.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/_Joe/Dot%20Crowd%20Navigator%20Migration.md#L833).
- Required background-image workflow intentionally kept identical to Route Plotter in [_Joe/Dot Crowd Navigator Migration.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/_Joe/Dot%20Crowd%20Navigator%20Migration.md#L841).
- Phase 1 is the graph editor MVP; Phase 2 adds the weighted swarm engine in [_Joe/Dot Crowd Navigator Migration.md](/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe%20Bell%20UoN%20Files/2_Projects/2025-10-14%20Gary%20Priestnall%20PARM%20Maps%20Encore/Windsurf%20Dot%20Crowd%20Navigator/dot-crowd-navigator/_Joe/Dot%20Crowd%20Navigator%20Migration.md#L1039).

**How it relates to Route Plotter**

The relationship is “same shell, different core.”

Route Plotter was a linear animation editor: one ordered `Waypoint[]`, one smooth spline, one progress value, one path head, plus waypoint-centric features like beacon effects, camera keyframes, area highlights, and motion-visibility modes. Dot Crowd Navigator keeps the mature infrastructure that was genuinely generic, but swaps out the domain model:
- Kept from Route Plotter: EventBus, normalized coordinate transform, autosave/undo, Canvas 2D render loop pattern, build/test/deploy setup, color/accessibility tokens, path math utilities, and background image handling.
- Adapted from Route Plotter: PathCalculator, TextLabelService, SwatchPicker, and eventually VideoExporter.
- Replaced from Route Plotter: `Waypoint`, `AnimationState`, `AnimationEngine`, `RenderingService`, `UIController`, and `InteractionHandler`.
- Removed as Route Plotter-specific: beacon rendering, motion visibility, camera keyframes, area highlight editing, custom image asset system, and HTML export scaffolding.

So architecturally, Dot Crowd Navigator is not a sibling feature inside Route Plotter. It is a graph-first rewrite that deliberately preserves the parts of Route Plotter that were solid app infrastructure and discards the parts that were tied to “one route, one timeline, one animated head.”

**Short version**

If Route Plotter is “draw one route and animate movement along it,” Dot Crowd Navigator is “draw a route network and simulate many moving agents through it.” The current repo already has the Route Plotter shell pared back into a Dot Crowd Navigator Phase 0 foundation; the next real milestone is Phase 1, where graph nodes, edges, directionality, weights, and path-shape editing get built on top of that retained core.

If you want, I can turn this into a cleaner project brief or a developer-facing architecture note for the repo.
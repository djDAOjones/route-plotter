# MERGE-01 — Plan v4's merge of routes and crowds

## Intent

The owner wants the next major version, v4, to merge routes and crowds. In his words: "having routes and crowds separately does confuse things a little from a user point of view. one thing with options might feel more cognitively coherent"; "crowd paths should be able to act as the camera"; "I want the next major version to be a merge". Today an author meets two ways to draw a line, two vocabularies (waypoints and legs; nodes, paths, Entry and Exit), and bridges between them (Follow route, Trace route into network, anchored nodes). Only the route can carry the camera, labels, beacons, areas and pauses. This item is the plan for v4: one kind of layer whose features are added as needed, kept simple, with a features pop-up that adds options and their controls. It settles the model and the steps and comes back to the owner before any code is written. It starts once CROWD-08 ships, when the bulk of the work moves to v4 (the decisions: PLAN-4).

## Acceptance criteria

- A written plan in `reviews/` settles:
  - the one layer model, and what each v3 route and crowd becomes in it;
  - what sets the scene's length when every layer is equal: today the route's legs, speeds and pauses set it, and crowd releases are fractions of it;
  - camera targets: any layer can carry the camera, including a crowd, by a group's centre, a lead dot or a vehicle;
  - one pen and one line model for drawing, with the route's line styles available to every layer;
  - the features pop-up: which features exist at v4.0, which come later, and how each appears in the scene outline;
  - how v3 projects, exports and the HTML player carry over;
  - which candidate features in the Notes join, and in what order.
- The plan checks itself against the abstraction plan's decision framework (`reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, §16) and its target direction (§11).
- The plan states where it departs from the v3 founding decision of 2026-08-17 (the frozen canon log; `project/history.md`) and from the brief's Direction. It brings the brief's amendment for the owner to sign.
- The owner answers one question round on the plan before any code.
- Codex reviews the plan until it approves.

## Context and sources

- [The decisions](../decisions.md): PLAN-4 (the owner's words, and the filing session's analysis of merging against keeping the two apart)
- [The brief](../brief.md): Direction, "a layered scene over one master timeline: the hero route plus flow layers"
- [The architecture](../architecture.md): the v3 direction and the communication rules
- `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`: §11 and §16
- `pm_skills/project/archive/decision-log-2026-08-17-to-2026-08-26.md`: the founding decision (:1558) and the "one inspector, explicit scopes" review (:1165)
- [CROWD-08](./CROWD-08.md): the MVP that ships first
- `src/services/CameraService.js`: the follow camera centres on the route head
- `src/services/RenderingService.js` (:1342–1349): a crowd's network is drawn only while editing

## Notes

- 2026-10-13 — The filing session's analysis, for the plan to weigh. For a merge: one mental model, one pen and one vocabulary; every feature works on every layer; several routes come free; the bridging features go. Against: something must still set the scene's length; a route's authored leg timing and a crowd's seeded release and pace are different motions; a route branch plays every branch at once while a crowd junction sends each dot one way; and every project, example and HTML export must carry over. The session proposed converging in steps: a camera target for any layer, scenes without a story route, one pen, then the pop-up. The owner chose a merge for v4. The lines share their geometry already: crowd paths use the route's `PathCalculator` (`src/services/SwarmEngine.js` (:905)).
- 2026-10-13 — Candidate features, from the session's catalogue of movement types. They were built as live sketches, each a pure function of time, on a page private to the owner: <https://claude.ai/artifact/Dn8NTvrNok2HMufMtPfsE8>.
  - Where dots start and finish: drawn polygon areas; destinations, where a dot picks where it is going and takes only paths that lead there.
  - Along paths: pulse; back and forth; speed per path; timed gates and first-come queues, which can be worked out in advance from arrival order; start full; change on the way (colour or size); lanes.
  - Inside areas: vibrate in place, spread out, bounce off walls, orbit, radiate out and draw in, wander and wait, and flow fields.
  - Groups and patterns: a wave through still dots, formation and morph, combine and split.
  - How dots look: trails and shaped dots.
  - Uses: ready-made presets; vehicles on transit routes as decoration (the owner's "trains / buses / cars on transit routes, as decoration (so running in parralel to other things going on)"), which also needs a crowd's line drawn in exports.
  - Not proposed: dots that react to each other (collisions, congestion, flocking), since that breaks the pure-function rule. Baking a simulation into stored frames was raised as an option.

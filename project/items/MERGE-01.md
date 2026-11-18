# MERGE-01 — Plan v4's merge of routes and crowds

## Intent

The owner wants the next major version, v4, to merge routes and crowds. In his words: "having routes and crowds separately does confuse things a little from a user point of view. one thing with options might feel more cognitively coherent"; "crowd paths should be able to act as the camera"; "I want the next major version to be a merge". Today an author meets two ways to draw a line, two vocabularies (waypoints and legs; nodes, paths, Entry and Exit), and bridges between them (Follow route, Trace route into network, anchored nodes). Only the route can carry the camera, labels, beacons, areas and pauses. This item is the plan for v4. The owner's question pictured one kind of layer, kept simple, with "a features pop up to add options and corresponding interface controls"; the plan decides the model and the steps and comes back to the owner before any code is written. It starts once CROWD-08 ships, when the bulk of the work moves to v4 (the decisions: PLAN-4). On 2026-11-18 the owner paired the merge with "a modular feature set that users can add as needed, to simplify the UI and back end whilst enabling more advanced functionality, but only on demand".

## Acceptance criteria

- A written plan in `reviews/` weighs options and recommends one for each of these, for the owner to decide:
  - the merged model: what kind of layer or layers v4 has, and what each v3 route and crowd becomes;
  - what sets the scene's two durations once routes and crowds merge. Today the base timeline comes from the route (its legs, speeds, pauses, intro and longest branch), or from the author's Duration with no route clock, and crowd releases, anchors, label fades and camera transitions are fractions of it. The playback duration then adds what finishes after it (crowds that finish, beacons still changing) and Hold at end (`src/utils/sceneEnd.js`);
  - how a crowd's path can carry the camera, as the owner asked;
  - how lines are drawn and styled across what are routes and crowds today;
  - how options and their controls are added, the owner's question having pictured a features pop-up; which exist at v4.0, which come later, and how each appears in the scene outline;
  - how the code holds each option: whether each is a module of its own that a layer takes on only when the author adds it, and what a module owns (its settings, drawing, controls, save fields and tests), so that the back end gets simpler as well as the interface;
  - how advanced functionality stays on demand: what a new layer shows before any option is added, and what adding or removing an option adds or removes in the interface and in a saved project;
  - how v4 is shown to be simpler than v3, in the interface and in the code, by measures the owner can check;
  - how v3 projects, exports and the HTML player carry over;
  - which candidate features in the Notes join, and in what order.
- The filing session's proposals in the Notes (one pen and line model, camera targets by a group's centre, a lead dot or a vehicle, and converging in steps) are inputs to weigh, not requirements.
- The plan checks itself against the abstraction plan's decision framework (`reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, §16) and its target direction (§11). For a module design, it answers §16.1's questions and §16.2's warning signs (a generic registry, flags or mode strings, an abstraction for a hypothetical consumer) with the options v4.0 ships, or records a departure for the owner to decide.
- The plan states where it departs from the v3 founding decision of 2026-08-17 (the frozen canon log; `project/history.md`) and from the brief's Direction. It brings the brief's amendment for the owner to sign.
- The owner answers one question round on the plan before any code.
- Codex reviews the plan before the owner's question round.
- The plan gives every line on the stock take's held list (`reviews/v4-stock-take-2026-11-18.md`) a v4 item that must pass or weigh it, or brings it back to the owner to retire.

## Context and sources

- [The decisions](../decisions.md): PLAN-4 (the owner's words, and the filing session's analysis of merging against keeping the two apart)
- [The brief](../brief.md): Direction, "a layered scene over one master timeline: the hero route plus flow layers"
- [The architecture](../architecture.md): the v3 direction and the communication rules
- `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`: §11 and §16
- `pm_skills/project/archive/decision-log-2026-08-17-to-2026-08-26.md`: the founding decision (:1558) and the "one inspector, explicit scopes" review (:1165)
- [CROWD-08](./CROWD-08.md): the MVP that ships first
- `src/services/CameraService.js`: the follow camera centres on the route head
- `src/utils/sceneEnd.js`: the base timeline and the playback duration
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
  - Not proposed: dots that react to each other (collisions, congestion, flocking) simulated live, frame by frame, since state carried from frame to frame breaks the pure-function rule. Worked out in advance or baked into stored positions, such motion could keep the rule; baking was raised as an option.
- 2026-10-14 — On the owner's word, REFACTOR-01 comes first after CROWD-08: a major refactor in light of PM-Skills 3.1's frameworks, so that v4's merge lands on more modular code (the decisions: REFACTOR-01).
- 2026-10-15 — AI-01, AI-editable saves, is filed as a medium-term feature on the owner's word. It would document the save format that v4 settles; its filing session proposes that the plan weigh a schema-first save (`project/items/AI-01.md`).
- 2026-11-18 — The owner asked, verbatim: "have we got on the roadmap a major phase of development to unify the standard routes and crowd route technology, and pair it with a modular feature set that users can add as needed, to simplify the UI and back end whilst enabling more advanced functionality, but only on demand?" The session found the merge and the features pop-up recorded here, with REFACTOR-01's modularity ahead of it, but no criterion on options built as modules in the code, on advanced functionality staying hidden until added, or on simplifying the back end. Asked "Add the back-end modules and on-demand principle to MERGE-01's criteria?", he answered "Yes, draft it". The session added three criteria to the plan's list and a §16 test for a module design; their wording is the session's. Of the draft he said: "text is good, add to the record but dont start the work".
- 2026-11-18 — The stock take. On the owner's ruling ("as per your recommendation", of the option "One held list (Recommended)") the held list in `reviews/v4-stock-take-2026-11-18.md` is merged into this item: checks v4 must pass, inputs to v4's interface design and candidate features, with five lost defects (DEF-05, DEF-07, DEF-10, DEF-11, DEF-12) to verify first. The last criterion above was added on that ruling. Q14 answers the criterion on v3 projects carrying over: they do not.

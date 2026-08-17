# Dot Crowd Navigator — archived fork material

Everything in this folder is salvaged from `djDAOjones/dot-crowd-navigator`
(archived 2026-08-17; final state preserved in that repo's last two commits —
see its SALVAGE-NOTE.md for the OneDrive data-loss story). It is **reference
material for Phases 2–4**, not live code.

- `AGENTS-spec.md`, `app-overview.md` — the fork's original architecture spec
  and intent docs (provenance headers inside).
- `project-memory/` — the fork's populated pm_skills memory: its brief,
  backlog (what actually got built, incl. Phase 2 core), decision-log
  (GraphModel/renderer/interaction design decisions), architecture,
  conventions, file-map.
- `tests-salvage/` — executable specs for the two lost implementations:
  `SwarmEngine.test.js` (weighted routing, lifecycle modes) and
  `SimulationState.test.js`. NOTE: these test a stateful `tick(deltaMs)` API,
  which v3's deterministic-timeline mandate supersedes — carry the
  *behaviour* (spawning, weighted edge choice, lifecycle semantics), not the
  API shape (decision-log 2026-08-17).
- `recovered-src/` — the fork's working graph-editor code, recovered from
  Windsurf local history (2026-05-03): clean-shell `main.js`, `GraphRenderer.js`,
  `GraphInteractionHandler.js`, and its `index.html`. Mine these for graph
  editing gestures/rendering patterns in Phase 4; they are built for the
  standalone app shell, not v3's layered scene.

Already live in v3 (unwired until Phase 2): `src/models/GraphNode.js`,
`GraphEdge.js`, `GraphModel.js` and their 62 tests.

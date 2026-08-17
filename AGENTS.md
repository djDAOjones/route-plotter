# AI Agent Rules — Route Plotter

## Product identity

**Route Plotter** — an animated route editor for maps and images. Drop
in a background, click to place waypoints, tweak styles and timing,
then export as MP4, WebM, or a self-contained HTML file. The canonical
mental model is: background image → waypoints → animated path → export.

It is not a GIS tool, not a drawing app, and not a video editor — it is
a single-purpose path animation tool.

---

## Who you are working with

The maintainer is a novice coder who owns macro structure, UX direction,
and conceptual design — but relies on AI for implementation and project
management. Do the work; don't explain concepts back unless asked.
Comments and JSDoc should help them understand non-obvious code, data
flow, and fragile behaviour — but never restate obvious code.

---

## Before every task

1. Read `README.md` (architecture, file tree, glossary, gotchas).
2. Read the project memory files in `pm_skills/project/`:
   `brief.md`, `architecture.md`, `conventions.md`,
   `file-map.md`, and the Active section of `backlog.md`.
   Also read `decision-log.md` (latest entries) if the task involves
   design decisions or you need context on prior choices.
   Do **not** auto-read `trajectory.md` (warm — shipped-work
   narrative, read on demand) or `wish-list.md` (cold — idea inbox,
   read only during a triage pass). See "Memory size budgets" and
   "Capturing deferred ideas" below.
3. Read
   `_Joe/dev notes/needs consolidating and deleting/dev guide.md`
   (change mechanics, invariants, fragile areas, AI guidance §10).
4. Read `UI-STANDARDS.md` for any task that touches UI, controls,
   layout, text, states, accessibility, or user-facing behaviour.
5. Read `DEV-INFRASTRUCTURE.md` for build, dev server, versioning,
   and script conventions.
6. For non-trivial work, follow the `/feature` workflow.
   For bugs, follow the `/bugfix` workflow.
   Get user sign-off on scope before writing code.
   For small tasks, use `pm_skills/prompts/quick-task.md` instead.
7. Search the full source tree before proposing changes. Check
   `src/config/constants.js` for existing tuneable values and
   `index.html` for existing UI controls.

### Memory size budgets

Memory files have word/entry budgets: **hard, prunable** limits on
accreting files (`file-map.md`, the sectional `backlog.md` /
`decision-log.md`, `trajectory.md`) and **soft** size guidelines on
reference docs (see the table). The end-of-task update check flags
overruns and proposes running `pm_skills/prompts/prune-memory.md`. Do
not auto-prune — always propose first.

| Scope | Soft limit | Action when exceeded |
| --- | --- | --- |
| Reference doc (`README`, `brief.md`, `architecture.md`, `conventions.md`, + project standards/process/infra docs) | soft ~3,500 words each | Not a prune target — reference docs don't accrete. If one is genuinely bloated, tighten it or split detail into a permanent contract file; never strip to hit a number. |
| `file-map.md` (accreting) | 2,000 words | Propose `prune-memory.md`: strip accreted history (task tags, dates, test counts) to `archive/file-map-*-historical.md`, keep current roles. Floor = the irreducible current-role list. |
| Every-task read load | structural (no aggregate word cap) | Healthy = each file within its own row above. If the always-read set keeps growing, review whether a hot read should move to _conditional_ or _warm_, or whether a reference doc has bloated. |
| `backlog.md` Active | 1,500 words **or** ~40 open items (whichever trips first) | Propose `roadmap-refactor.md`: restructure by lifecycle, evict done-work, dedupe stale rounds. A low item count with high words means items are too verbose — tighten them. |
| `backlog.md` shipped work | 0 — done `[x]` items do not live here | Move each to `trajectory.md` (one line) + `decision-log.md` (the why). Flagged by `end-of-task.md` and `doctor-memory.md`. |
| `trajectory.md` | 2,000 words | Propose archiving the oldest phases to `archive/trajectory/`, keeping `archive/INDEX.md` current. |
| `decision-log.md` live log | 20 entries (primary) **or** ~6,000 words | Propose an archive split to `archive/decision-log-*.md` (by whole month). Keep at least the latest 10 entries live. |
| `decision-log.md` oldest entry age | 90 days | Propose an archive split, oldest first — but only when ≥ 5 entries lie beyond the latest-10 read-tier floor (live log ≥ 15). Below that, note the overrun and skip. |
| `wish-list.md` open items | 25 items | Propose a triage pass (promote each into `backlog.md`, or cut). Never archive — the wish-list shrinks by triage, not by moving content to `archive/`. |
| `archive/` chunk | one epoch per file (whole month / migration boundary) | Chunk cold archives by sequence boundary for INDEX browsability, not size — they're never auto-read (grep + line-range only). Maintain `archive/INDEX.md`. |

---

## Capturing deferred ideas (wish-list)

When an out-of-scope idea surfaces mid-task, append it to
`pm_skills/project/wish-list.md` as a single line and keep working. Do
not act on it, scope it, estimate it, or discuss it unless the user
asks — capturing the one line is the whole interaction.

- **User trigger.** "Park it" (or similar) means: append the idea to
  the wish-list and move on. See `pm_skills/prompts/corrections.md`.
- **Boundary.** The wish-list is the **pre-triage** inbox — raw,
  unjudged ideas. The backlog **Icebox** is **post-triage** — ideas
  already judged worth keeping. Promote items from the wish-list
  _into_ `backlog.md`; never treat the wish-list as a second backlog.
- **Triage, not hoarding.** Drain the wish-list during
  `pm_skills/prompts/next-batch.md` (and when the `end-of-task.md`
  size check flags it): promote each item into the backlog, or cut
  it. Promoting moves the line out; cutting deletes it. No history is
  kept in the wish-list.

---

## Hard rules (invariants)

- **Normalised coordinates (0–1).** Waypoints store `imgX`, `imgY` in
  normalised image space. Canvas-pixel positions are derived at render
  time via `CoordinateTransform`. Never store pixel coords on a
  Waypoint. See dev guide §5 rule 1.
- **EventBus is the only communication channel.** Components never call
  methods on each other. They emit events; `main.js` handles them. See
  dev guide §5 rule 3.
- **All imports at the top of the file.** Mid-file imports break
  esbuild. See dev guide §5 rule 2.
- **`docs/` is build output.** Never hand-edit. It is overwritten by
  `npm run build`.
- **One runtime dependency: `mediabunny`.** Do not add npm packages
  without explicit approval.
- **Okabe-Ito palette for map data; UoN semantic tokens for UI chrome.**
  These two colour systems must stay separate. See `UI-STANDARDS.md`.
- **Carbon-first UI.** All UI work must follow IBM Carbon's productive
  design language: components, patterns, tokens, spacing, and
  interaction conventions — implemented in the project's own code, not
  via Carbon packages. See `UI-STANDARDS.md`.
- **WCAG 2.2 AAA by default.** 7:1 text contrast, ≥44 px touch
  targets, visible focus rings, no colour-only meaning. See
  `UI-STANDARDS.md` for full accessibility rules.
- **Programmatic slider updates** must use `ui:slider:update-speed`
  event, never direct `.value` assignment (feedback loop).
  See dev guide §9.
- **One-command runtime recovery.** Reaching a known-good running
  state — and getting back after it drifts — is one documented, safe
  command, never a remembered ritual. Verify _readiness_, not just
  that a process launched. Lifecycle scripts kill only what they own,
  delete only documented generated output, and never touch source or
  persistent data without an explicit hard-reset flag. See
  `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle".
- Full invariant list: dev guide §5.

---

## Core data model

The canonical model is:

- **`Waypoint`** — `imgX`/`imgY` (normalised 0–1), type
  (major/minor), visual style (marker, colour, beacon), path
  properties (tension, segmentSpeed), text label, area highlight,
  camera zoom, wait time. Serialised via `toJSON()`/`fromJSON()`.
- **`AnimationState`** — progress (0–1), timing, speed, pause
  tracking. Managed by `AnimationEngine`.
- **`ImageAsset`** — custom image references (marker, path head).

Do **not** store pixel coordinates on Waypoint. Do **not** mutate
waypoints from services — only `main.js` mutates model state in
response to EventBus events.

---

## Event naming convention

Use colon-separated namespaces. Emitting the wrong category causes bugs:

| Prefix | Source | Triggers |
| --- | --- | --- |
| `waypoint:style-changed` | UIController | Visual only, no path recalc |
| `waypoint:path-property-changed` | UIController | Path recalculation |
| `waypoint:position-changed` | InteractionHandler | Path recalculation |
| `waypoint:*` | InteractionHandler, UIController | Add, delete, select, move |
| `animation:*` | AnimationEngine, UIController | Timing update + render |
| `ui:*` | UIController | Slider sync, mode changes |
| `video:*` | VideoExporter | Export lifecycle |
| `area:*` | AreaDrawingService, AreaEditService | Area highlight operations |
| `undo:*` | UndoService | State snapshot / restore |

Do not create synonyms for existing event names.

---

## Minimal change discipline

- Don't reorganise code you weren't asked to touch.
- Don't add or remove comments in code you weren't asked to touch.
  New code should follow the documentation rules below.
- Match existing style: 2-space indent, single quotes, semicolons.
- Small abstractions are allowed when they clearly reduce duplication,
  isolate fragile logic, or improve maintainability — not for single
  use cases with no reuse prospect.
- Nearby cleanups (fixing an adjacent comment, extracting a repeated
  pattern in the same function) are fine when they touch only code
  you are already changing.

---

## Code documentation

- New and modified functions, classes, and modules should have
  meaningful comments explaining **why**, not restating **what**.
- Use **JSDoc** for non-obvious public methods in services and models:
  purpose, `@param`, `@returns`. Skip for self-evident getters/setters
  and obvious one-liner functions.
- Add inline comments on fragile logic flagged in dev guide §9 (slider
  feedback loops, coordinate transforms, animation timing, H.264
  constraints, backpressure).
- Add data flow comments where an event triggers a chain across files
  (e.g. `// emits waypoint:style-changed → main.js → queueRender`).
- Add serialisation notes in `toJSON()`/`fromJSON()` when the shape is
  non-obvious or has migration concerns.
- Rendering/timing comments should explain _why_, not _what_.
- Accessibility comments should note the WCAG requirement being met
  when the connection is non-obvious.
- Do not add boilerplate, `@author`/`@date` tags, or comments that
  merely restate the code.

Project-specific documentation conventions are in
`pm_skills/project/conventions.md`.

---

## Testing

- `npm run build` + `npm test` after every change.
- Never delete or weaken existing tests.
- Add a test for any new model method or utility function.
- Full integration testing is manual: load the app, exercise the
  feature, check console for errors.

---

## Files to never edit

- `docs/*` — build output, overwritten on every build.
- `_Joe/*` — personal notes; not source code.
- `version.json` — managed by the build script.

See `DEV-INFRASTRUCTURE.md` for the full list.

---

## Persistence checklist

When adding any property that should survive reload:

1. Default in constructor (`Waypoint.js` or relevant state object).
2. Include in `toJSON()`.
3. Handle in `fromJSON()` with fallback default.
4. Serialise in `autoSave()`.
5. Restore in `loadAutosave()`.
6. Verify round-trip: save → reload → value preserved.

---

## Document ownership

| Layer | Owns | Update when |
| --- | --- | --- |
| `AGENTS.md` | Hard rules, invariants, data model, anti-patterns | Major architectural or design decisions change |
| `UI-STANDARDS.md` | UI, accessibility, usability rules | New token systems or UI conventions established |
| `DEV-INFRASTRUCTURE.md` | Build, dev server, versioning, scripts, runtime lifecycle | Build, runtime, or deployment decisions change |
| `pm_skills/project/` | Brief, architecture, backlog, wish-list, trajectory, file map, conventions, decision log | End of every task session |
| `pm_skills/project/archive/` | Historical content moved out of hot files, indexed in `archive/INDEX.md` | Only via `pm_skills/prompts/prune-memory.md` or `roadmap-refactor.md` |

When in doubt: unconditional invariant → `AGENTS.md`. UI convention →
`UI-STANDARDS.md`. Build/dev rule → `DEV-INFRASTRUCTURE.md`. Evolving
context → `pm_skills/project/`. Historical content →
`pm_skills/project/archive/`.

---

## Anti-patterns to reject

- Direct method calls between components — use EventBus.
- Inventing a custom UI control when Carbon provides a suitable pattern.
- Installing Carbon packages instead of implementing to Carbon's spec.
- Leaving a panel, state, or error condition without an intentional,
  visible, accessible treatment.
- Hard-coding values that should be in `constants.js` or `tokens.css`.
- Adding runtime dependencies without explicit approval.
- Storing pixel coordinates on Waypoint models.
- Collapsing the Okabe-Ito map palette and UoN UI token systems.
- Setting slider `.value` directly (use the `ui:slider:update-speed`
  event to avoid feedback loops).
- Ad hoc or undocumented startup — a boot/reboot ritual held only in
  someone's head, a script that kills processes or deletes paths it
  doesn't own, or a "started" report that never checked readiness.
- Letting `wish-list.md` become a write-only graveyard, or scoping or
  estimating its items at capture time. Capture is one line; judgement
  happens at triage.
- Leaving shipped (`[x]`) work in `backlog.md`. Completed work moves to
  `trajectory.md` (one line) plus `decision-log.md` (the why); the
  backlog holds open work only.
- Letting the backlog become an audit trail of dated rounds, or
  narrating a shipped item in full in both the backlog and the
  decision-log. Compress on ship; run `roadmap-refactor.md` to repair
  drift.

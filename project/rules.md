# Rules — Route Plotter

<!-- Owner-signed; rule 1 reads this file. Always holds the invariants,
     the protected paths and the Environment; By task routes the
     documents a task type reads, with budgets. Written by the v3 intake
     from the canon AGENTS.md at 75ba7ae on 2026-10-01; the census in
     project/migration/census.md traces every canon obligation to its
     home. [guess] marks what intake could not source. -->

## Always

- Waypoints store normalised image coordinates; authoring stops at `IMAGE_COORDINATES` and load accepts that range, both through `src/utils/imageCoordinates.js`; convert through `CoordinateTransform`, never persist canvas pixels.
- Components get no app instance and reach the app through the EventBus; the app owns durable model changes and calls components only through public methods; modal tools edit provisionally and commit by event (exceptions: `project/architecture.md`).
- `InteractionHandler` owns one Pointer Events transaction for mouse, touch and pen; no competing canvas mutation path.
- Search the full source tree before proposing a change; check `src/config/constants.js` and `index.html` before adding anything.
- All imports at the top; `docs/` is generated output, never hand-edited.
- Runtime dependencies: jszip and mediabunny only; no package without explicit approval.
- Okabe-Ito map palette apart from UoN UI tokens; Carbon productive, WCAG 2.2 AAA (the digests).
- Speed-slider updates use `ui:slider:update-speed`, never `.value`; no synonyms for EventBus events (search the `emit` and `on` call sites).
- Stable paused views queue no animation frame; export keeps its single synchronous frame loop.
- Runtime recovery: one documented, ownership-safe command verifying readiness.
- `main` is the live site: a branch per concern and a pull request. Never commit to or push `main` except a merge the owner ordered or `npm run push` for a release he called; an advance grant is a decision stating conditions (the big run's, 2026-09-28). Only `npm run push` commits `docs/` and `version.json`.
- Never delete, skip or weaken a test to pass; re-pointing an import with assertions unchanged is not.
- Archive or prune the record only on the owner's word (2026-08-27).
- Protected paths: `docs/`, `_Joe/`, `version.json`, `node_modules/`, `pm_skills/` (frozen canon record, `project/history.md`).
- Push and network follow the profile's Push and Network lines; a blocked push is reported as pending.

### Environment

- Work in the clone `route-plotter/` beside the owner's OneDrive checkout, kept on the device so `.git` is never evicted; update his checkout only by fast-forward, when clean.
- Vitest needs the threads pool and no file parallelism, or it reports no tests and exits 0.
- Every close reads `DEV-INFRASTRUCTURE.md` → Quality gate and its close-out boot check (watcher stopped and generated files restored before a commit; readiness checked or reported as not verified when runtime behaviour changed).
- One record: a fact lives in its owning document and is linked, never restated, in `CLAUDE.md`, `.claude/`, `.codex/` or a handover; a close updates only documents whose owned facts changed; durable cross-tool knowledge moves into its owned document; `/context` lists what Claude Code loaded.
- The owner, a novice coder, owns structure and design: do the work, explain only when asked; Devin and Windsurf are retired (2026-09-28).

## By task

| Task type | Document to read | Budget (words) | Approver |
| --- | --- | --- | --- |
| UI, controls, layout, text, states, accessibility, user-facing behaviour | UI-STANDARDS.md | 1,850 | AAA exceptions documented (design review gate) |
| UI | project/digests/carbon.md | 400 | |
| UI | project/digests/nielsen.md | 350 | |
| UI | project/digests/wcag-2.2-aaa.md | 600 | |
| build, scripts, versioning, deployment, release | DEV-INFRASTRUCTURE.md | 3,300 | the owner calls releases and decides merges |
| code change | project/architecture.md | 1,100 | |
| code change | project/digests/house-conventions.md | 1,000 | |
| code change, debugging, persistence | _Joe/dev notes/needs consolidating and deleting/dev guide.md | 2,800 | until: DOC-08 retires it |

## Signed

- Owner: Joe, 2026-10-02.

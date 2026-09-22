# Comprehensive read-only repository review — Route Plotter v3

Review date: 26 August 2026

## 1. Executive summary

Route Plotter v3 is a substantial, thoughtfully documented static web application with a strong deterministic animation core, broad unit coverage, bundled runtime dependencies, safe HTML-export escaping, and a functioning principal authoring workflow.

It is not ready for an unqualified production or WCAG 2.2 AAA claim. No Critical issue was confirmed, but eight High-severity findings remain:

1. Failed project imports can destroy the currently open project.
2. Autosave can omit essential content, silently fail, or resurrect supposedly cleared work.
3. Global keyboard handling prevents ordinary Tab navigation and double-dispatches playback commands.
4. The right-hand authoring panel becomes unreachable at 1280 CSS pixels and below.
5. Comet-trail frames depend on render history rather than timeline state alone.
6. Timeline mode changes and exports use inconsistent derived timing and transport state.
7. Clean builds and the deployment helper can publish broken or irreproducible artifacts.
8. Core network/polygon authoring and canvas meaning lack keyboard and non-visual equivalents.

The strongest aspects are the centralized `PlayerCore`, deterministic swarm/beacon logic, safe HTML embedding, versioned project structures, comprehensive governing documentation, and the observed 331 passing tests.

The five highest-priority actions are:

1. Make project loading transactional and autosave honest and recoverable.
2. Restore normal keyboard navigation and consolidate shortcut ownership.
3. Repair responsive reflow so every authoring control remains reachable.
4. Make all rendered/exported frames a pure function of canonical timeline state.
5. Replace the deployment helper with a clean-checkout, tested, artifact-verified release gate.

Evidence limitations include macOS-only execution, no screen-reader or real touch-device pass, no actual video/download/deployment operation, no access to GitHub protection/Pages settings, and no production-scale workload.

No repository changes were intentionally made.

## 2. Repository status and review environment

| Item | Result |
|---|---|
| Repository reviewed | `Route Plotter v3` (the repository containing this report) |
| Scope assumption | The workspace root is not itself a Git repository and contains several generations. `Route Plotter v3` was treated as the active product; `Windsurf Map Router`, `Windsurf Dot Crowd Navigator`, and deployment/media snapshots were historical or contextual only. |
| Branch | `main`, tracking `origin/main` |
| Starting commit | `cec0191250ab981b30e7242772ff165ea3e775b7` |
| Ahead/behind | `+0/-0` |
| Starting status | Sole pre-existing entry: untracked `.claude/launch.json` |
| Final status | Identical: sole untracked `.claude/launch.json`; working and cached diffs empty |
| Untracked-file checksum | SHA-256 `d29f63e664f775f931321562d3f700b5f2dae1bafc9d8edf2be86402041e03e6` |
| Worktrees/submodules | One worktree; no submodules |
| Original repository changed | No |
| OS | macOS 26.5.2 build 25F84; Darwin 25.5.0; arm64 |
| Runtimes/tools | Node 24.5.0, npm 11.5.1, Git 2.49.0, ripgrep 15.2.0, Python 3.10.13 |
| Environment warning | Login shells repeatedly reported that the local pyenv shims directory was not writable. This was environmental and did not affect repository integrity. |
| Network | Initially restricted. Read-only npm registry/advisory queries were subsequently allowed; no write or publication operation was performed. |
| Credentials | No production, GitHub-settings, Pages-settings, or deployment credentials were used. |
| Isolated validation | A `git archive` was extracted under `/private/tmp/route-plotter-review.t6FbU2`; existing dependencies were copied into it. A second archive copy was used for an offline frozen install. |
| Browser validation | An isolated build was served on `127.0.0.1:8765`; the in-app browser was used for local UI testing. The server was stopped, the tab closed, and the viewport reset. |
| External state | No external messages, commits, pushes, uploads, exports, or deployments occurred. |

The ending integrity check reported:

```text
# branch.oid cec0191250ab981b30e7242772ff165ea3e775b7
# branch.head main
# branch.upstream origin/main
# branch.ab +0 -0
? .claude/launch.json
```

## 3. System purpose and architecture

Route Plotter is a client-side authoring tool for educators and presentation creators. A user selects a map/background, creates a waypoint route, configures animated route visibility and timing, overlays deterministic crowd-flow layers, previews a single master timeline, and exports projects, standalone HTML, or video.

Principal technologies:

- Vanilla JavaScript using ES modules.
- Canvas 2D rendering.
- esbuild for application and exported-player bundles.
- Vitest with jsdom.
- JSZip for project archives.
- Mediabunny plus browser media APIs for video export.
- GitHub Pages serving committed `docs/`.
- Browser `localStorage` for autosave and preferences.

Principal flow:

```text
User input / image or ZIP
          |
          v
DOM components + UIController + InteractionHandler
          |
          v
       EventBus
          |
          v
RoutePlotter app mixins and domain services
  |          |             |
  v          v             v
Waypoints  PlayerCore   Scene/graphs/emitters
  |          |             |
  +----------+-------------+
             |
             v
     RenderingService / Canvas
             |
     +-------+-------------------+
     |                           |
     v                           v
localStorage autosave     ZIP / HTML / video export

Source + static assets
          |
       esbuild
          |
      committed docs/
          |
      GitHub Pages
```

Important boundaries:

- Imported ZIPs and images are untrusted local inputs.
- `localStorage` contains potentially meaningful project state.
- Generated ZIP/HTML/video files cross a sharing boundary.
- There is no backend, account system, authentication, authorization, database, telemetry, analytics, or tenant boundary.
- Local maintainer scripts can kill processes or invoke Git commit/push and therefore operate with developer privileges.
- Runtime application fetches are predominantly same-origin; no remote CDN is required.

## 4. Review coverage matrix

| Component | Purpose | Depth | Important material | Validation | Relevant findings | Limitations/exclusions |
|---|---|---:|---|---|---|---|
| Governing docs and project history | Product intent, invariants, workflow | Full | `AGENTS.md`, README, brief, architecture, conventions, backlog, decision log, UI and infrastructure standards | Cross-checked against implementation | 0H/1M/1L | Archived entries sampled where linked |
| Application wiring/controllers | UI-to-domain orchestration | Full | `src/main.js`, `src/app/*`, `UIController.js` | Static tracing plus local browser | 5H/5M | Not every cosmetic branch exercised |
| Timeline/animation/rendering | Deterministic playback and Canvas output | Full | `PlayerCore`, `AnimationEngine`, `MotionVisibilityService`, `RenderingService`, path timing | Tests, static traces, live playback | 2H/2M/0L | No long-running visual-diff farm |
| Scene, graph, crowd flow | Layered deterministic movement | Full | Scene, FlowLayer, Emitter, SwarmEngine, network/area services | Unit results and adversarial model tracing | 1H/2M/0L | No production-scale profiling |
| Persistence/assets/undo | Autosave, ZIP load/save, hydration | Full | persistence mixin, StorageService, ImageAssetService, UndoService | Happy-path tests plus failure-path tracing | 2H/1M/1L | Malicious ZIP was not opened in a browser |
| HTML/video export/player | Portable output | Targeted/full around boundaries | exporting mixin, HTMLExportService, VideoExporter, PlayerApp | Safe HTML probe, codec modal flow, build | 1H/2M/1L | No actual encode/download or browser matrix |
| HTML/CSS/components | Layout, semantics, accessibility | Full for structure; targeted visual | `index.html`, styles, tooltips, dropdowns, focus trap | 1440/1280/360 browser inspection | 3H/3M/0L | No axe, NVDA, VoiceOver, forced-colors pass |
| Tests | Regression protection | Full inventory and targeted inspection | 19 suites, setup/config, golden frames | 331 observed passing | 0H/1M/0L | Coverage instrumentation unavailable |
| Build/deploy/scripts | Build, release, dev lifecycle | Full | `build.js`, `push.js`, shell scripts, deployment docs | Isolated build, syntax checks, dry-run probe | 1H/2M/0L | No real Git push or GitHub configuration access |
| Dependencies/licensing | Supply chain and reproducibility | Full direct; tool-assisted transitive | manifests, lockfile, generated legal comments | `npm ci`, `npm ls`, audit, outdated | 0H/1M/1L | Technical licence review only; not legal advice |
| Generated `docs/` | Deployment artifact | Sampled and compared with inputs | app/player bundles, maps, examples, source map | Bundle sizes, asset inventory, local serving | 1H/0M/1L | Generated/minified code not manually re-reviewed line-by-line |
| Media/project binaries | Maps, images, sample ZIPs | Metadata/content inventory | `images/`, `examples/`, generated copies | Size/archive inventory | 0H/0M/1L | Image pixels and EXIF not comprehensively audited |
| Historical sibling repositories | Earlier product generations | Excluded from active findings | Workspace siblings | Scope identification only | — | Not the active documented product |

## 5. Validation results

### Completed successfully

| Check | Location | Tool/version | Result and relevant output | Interpretation | Source/environment | Original unchanged |
|---|---|---|---|---|---|---|
| Initial/final Git integrity | Original | Git 2.49.0 | Same HEAD/status; both diffs empty | Read-only invariant preserved | Repository | Yes |
| Frozen install | Isolated `installcheck` | npm 11.5.1 | `npm ci --ignore-scripts --offline`; 155 packages; exit 0 | Lock can reproduce from available package cache | Repository/environment | Yes |
| Unit/integration tests | Isolated archive | Vitest 4.1.10 | 19 files, 331 tests passed; 9.80s | Strong happy-path/unit baseline | Repository | Yes |
| Production build | Isolated archive | esbuild 0.27.7 | Exit 0; app 597.60 KB, player 138.34 KB | JavaScript compilation succeeds | Repository | Yes |
| Dependency tree | Isolated archive | npm 11.5.1 | Exit 0; optional platform/peer omissions only | Installed graph coherent | Repository/environment | Yes |
| JavaScript syntax | Isolated archive | Node 24.5.0 | `node --check` across source/tests/scripts; exit 0 | No parse failures | Repository | Yes |
| Shell syntax | Isolated archive | Bash | Both maintainer scripts passed `bash -n` | Shell parses | Repository | Yes |
| Secret signatures | Tracked files/history | ripgrep/Git | No credential-pattern hits | No evidence of committed secrets | Repository | Yes |
| Live app happy path | Isolated local server | In-app Chromium | Welcome, two waypoints, crowd layer, playback, reload/autosave and codec modal worked without console errors | Principal simple workflow functions | Repository/browser | Yes |
| Codec modal focus | Local browser | In-app Chromium | Modal received focus; Escape closed it and restored Export focus | Existing dedicated focus-trap utility can work | Repository/browser | Yes |
| HTML escaping probe | Isolated runtime | Node/jsdom | Closing-script/title payloads remained escaped | Standalone export embedding is appropriately defensive | Repository | Yes |

The test run emitted non-fatal `multiSelect` warnings about absent ripple/pulse controls. They did not fail the suite but should be removed or asserted deliberately.

### Completed with failures or findings

| Check | Location | Result | Interpretation | Source/environment | Original unchanged |
|---|---|---|---|---|---|
| `npm audit --json` | Isolated archive | Exit 1; one Low advisory for esbuild 0.27.7; no Moderate/High/Critical | Direct dev dependency needs a patch update | Repository/current registry | Yes |
| `npm outdated --json` | Isolated archive | Exit 1 because updates exist | Four direct packages have newer releases | Repository/current registry | Yes |
| Initial registry lookup | Sandbox | `ENOTFOUND` | Initial failure was network-policy related; later read-only query succeeded | Environment | Yes |
| Documented `npm run push --dry-run` | Isolated non-Git archive | Performed a real build and reached `git add`; failed only because `.git` was absent | npm consumed the flag instead of forwarding it; documented “dry run” is unsafe | Repository | Yes |
| Clean-output asset check | Isolated clean output | Build succeeded while source `UoN_map.png`, `UoN_map 24-bit.png`, and `images/Courts.jpg` were absent | Current committed `docs/` masks missing source inputs | Repository | Yes |
| Tab navigation | Local browser | Focus remained on `BODY`; Tab was prevented | Confirmed global keyboard defect | Repository | Yes |
| Space playback shortcut | Local browser | Double toggle produced no lasting state change | Confirmed duplicate dispatcher | Repository | Yes |
| 1280px layout | Local browser | Right panel translated completely offscreen; no toggle/backdrop existed | Confirmed authoring controls become unreachable | Repository | Yes |
| 360px layout | Local browser | Narrow warning displayed, but keyboard could not reach Continue | Warning does not provide accessible recovery | Repository | Yes |
| Target-size sample | Local browser | Several action buttons measured 24–40px or 32×32 | Declared 44×44 policy is not consistently implemented | Repository | Yes |

### Not run

| Check | Reason |
|---|---|
| Formatter/linter | No configured formatter or linter exists. |
| Coverage report | Coverage is configured but there is no script, threshold, or installed `@vitest/coverage-v8` provider. |
| Real video encode/download | Would create user artifacts and requires a browser/codec matrix beyond this review. |
| Actual deploy/push | Explicitly unsafe and prohibited by the read-only brief. |
| Malicious ZIP browser execution | Static and bounded model probes established the defect without risking a hung browser. |
| Screen readers/assistive technology | NVDA/VoiceOver were not available in the review environment. |
| Real iOS/Android touch | No physical device or device farm was available. |
| Production load/failure recovery | No production credentials or representative load corpus was provided. |
| Penetration test | Outside the safe local review boundary. |

## 6. Prioritised findings

### [RP-01] Project loading is destructive before validation completes

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Reliability, persistence, data integrity
- **Location:** `src/app/persistence.js:94`, `src/services/ImageAssetService.js:293`, `src/services/UndoService.js:124`
- **Affected component or flow:** Open Project → archive import → current editor/assets → undo/autosave.
- **Evidence:** Asset import clears current assets before every manifest entry/background is decoded. `loadProject()` then clears current route state before background, scene, styles, and settings finish hydrating. The catch only announces failure. `UndoService.clear()` exists for project replacement but is not invoked, and ZIP/undo restoration does not rehydrate custom waypoint images.
- **Current behaviour:** A late parse/decode/model error leaves the editor empty or partially replaced; a successful load can retain history from the previous project and render custom markers as dots.
- **Why it matters:** Opening a file is expected to be non-destructive until success. The failure can erase unsaved work and overwrite recovery state.
- **Realistic scenario:** A shared ZIP contains valid JSON but a corrupt background or missing asset. The user’s open route and assets are cleared before the error appears.
- **Existing mitigation:** Happy-path compatibility handling and a visible failure announcement; neither provides rollback.
- **Recommended change:** Parse, budget-check, decode, validate, and hydrate into detached candidate services/models, then atomically swap once. Seed a fresh undo baseline and autosave once after commit.
- **Illustrative patch or implementation outline:** Not applied. `candidate = await ProjectLoader.stage(file, limits); validate(candidate); app.commitProject(candidate); undo.reset(candidate);`
- **Tests to add or amend:** Failure injection at JSON, manifest, asset, image decode, waypoint, graph, styles, and settings stages; custom-marker ZIP/undo round trips.
- **Validation approach:** Snapshot current route/assets/background/history/autosave before each injected failure and assert byte-for-byte equality afterward.
- **Estimated effort:** Medium–Large
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Define project validation/size limits before implementing atomic commit.

### [RP-02] Autosave and local-data lifecycle can lose or resurrect user work

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Recovery, privacy, persistence
- **Location:** `src/app/persistence.js:252`, `src/services/StorageService.js:19`, `src/main.js:867`
- **Affected component or flow:** Background/custom assets → autosave → reload; Clear All → reload.
- **Evidence:** Snapshots preserve background fit/overlay but not the uploaded background. Assets above 5 MiB are omitted with a console-only warning. Failed storage writes return `false`, but the debounce callback records the state as saved and suppresses retry. No `pagehide` flush exists. Clear All neither persists an empty state nor clears/cancels the pending autosave.
- **Current behaviour:** Reload can restore geometry over the default map, drop custom artwork, claim a failed save succeeded, lose changes inside the debounce window, or bring a cleared route back.
- **Why it matters:** Autosave is presented as a recovery feature, and Clear All says removal cannot be undone.
- **Realistic scenario:** A user authors against a custom campus plan, clears it on a shared computer, and reloads. The old route can reappear, possibly over the wrong background.
- **Existing mitigation:** Manual Save Project retains more data; failures are logged to the console.
- **Recommended change:** Use a size-aware durable asset store; expose persistent autosave status; cache serialization only after confirmed writes; flush/cancel on lifecycle transitions; define a separate Delete Local Data action covering all application keys.
- **Illustrative patch or implementation outline:** Not applied. Make `save()` return/throw an explicit result, update `_lastSerialized` only on success, and persist a versioned empty snapshot on Clear All.
- **Tests to add or amend:** Background/asset reload, quota failure, disabled storage, retry after failure, page close during debounce, clear/reload, pending-write cancellation.
- **Validation approach:** Run in fresh and quota-constrained browser profiles and inspect both UI state and stored bytes.
- **Estimated effort:** Medium–Large
- **Implementation risk:** High
- **Dependencies or sequencing:** Requires an agreed asset quota/migration policy and precise Clear All semantics.

### [RP-03] Global keyboard handling blocks Tab and double-dispatches transport shortcuts

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Accessibility, input handling, correctness
- **Location:** `src/handlers/InteractionHandler.js:690`, `src/handlers/InteractionHandler.js:771`, `src/app/playback.js:39`, `src/app/wiringControllers.js:1185`
- **Affected component or flow:** Entire application keyboard journey and Space/J/K/L playback.
- **Evidence:** Unmodified Tab is always prevented and emits `waypoint:select-adjacent`, for which no listener exists. Two document-level dispatchers handle Space/J/K/L through different state machines. Live testing confirmed Tab remained on `BODY` and Space net-toggled back to its initial state.
- **Current behaviour:** Keyboard users cannot traverse normal controls or first-load dialogs, while transport shortcuts fire twice.
- **Why it matters:** This blocks basic operation without a pointer and invalidates otherwise sound focus/modal work.
- **Realistic scenario:** A keyboard-only first-time user cannot reach “Continue,” Help, file controls, or the editor.
- **Existing mitigation:** Input/select targets are excluded; individual dropdown/context-menu components have good internal keyboard handling.
- **Recommended change:** Establish one keyboard dispatcher generated from the keybinding configuration. Never intercept plain Tab globally; use roving tabindex only inside a properly designed composite.
- **Illustrative patch or implementation outline:** Not applied. Remove the second document listener and route each command once through a canonical command map.
- **Tests to add or amend:** Cancelable key events on body, links, buttons, menus, inputs, and dialogs; exact-once state assertions from stopped/playing/paused.
- **Validation approach:** Browser E2E plus real keyboard, VoiceOver, and NVDA journeys.
- **Estimated effort:** Medium
- **Implementation risk:** Medium–High
- **Dependencies or sequencing:** Fix before evaluating modal/listbox behavior.
- **Relevant standard or classification:** WCAG 2.2 success criteria 2.1.1 and 2.4.3.

### [RP-04] Responsive CSS makes the right authoring panel unreachable at 1280px and below

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Responsive UI, accessibility
- **Location:** `styles/main.css:2687`, `styles/main.css:2755`, `index.html:98`
- **Affected component or flow:** Layers, crowds, waypoint controls, and zoomed/narrow desktop use.
- **Evidence:** The 80rem rule translates `.sidebar-right` 100% offscreen. CSS exists for a toggle and backdrop, but neither exists in HTML or controller code. The 64rem reflow targets selectors such as `.sidebar.left` and `.main-content` that do not match the actual DOM. Live inspection at 1280px found the 320px panel fully outside the viewport.
- **Current behaviour:** Dismissing the narrow-screen warning does not restore core authoring controls.
- **Why it matters:** Common displays and browser zoom make material product functionality unreachable.
- **Realistic scenario:** A user on a 1280px laptop continues past the warning but cannot add a crowd or edit layers.
- **Existing mitigation:** A dismissible warning below 1440px; the backlog acknowledges reflow as blocked.
- **Recommended change:** Correct selectors and implement genuine stacked reflow, or add a fully accessible panel toggle/backdrop with focus restoration and Escape behavior.
- **Illustrative patch or implementation outline:** Not applied. Prefer reflow of the real `.main`, `.sidebar`, `.canvas-area`, and `.sidebar-right` elements over an off-canvas panel.
- **Tests to add or amend:** E2E at 1440, 1439, 1280, 1024, and 320 CSS px plus 200%/400% zoom.
- **Validation approach:** Assert every major control is visible/reachable, focus order is logical, and two-dimensional page scrolling is unnecessary.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Requires a product decision about minimum supported authoring width.
- **Relevant standard or classification:** WCAG 2.2 success criterion 1.4.10.

### [RP-05] Comet-trail rendering violates the deterministic-timeline invariant

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Correctness, architecture, export parity
- **Location:** `src/services/MotionVisibilityService.js:78`, `src/services/RenderingService.js:1238`, `tests/goldenFrames.test.js:45`
- **Affected component or flow:** Play, scrub, reverse, video stepping, and exported-player frames.
- **Evidence:** Rendering retains `_tailProgress`, prior wait state, and pause-entry state. It resets only on backward jumps greater than 10%, so the frame at a given timeline instant can differ depending on how that instant was reached. Golden-frame tests do not include `MotionVisibilityService`.
- **Current behaviour:** Sequential play, direct seek, reverse travel, and fixed-step export can draw different trail extents at the same canonical time.
- **Why it matters:** This contradicts the project’s governing pure-scene contract and can produce editor/export disagreement.
- **Realistic scenario:** Directly scrubbing into a waypoint pause produces a shorter trail than naturally playing into the same pause.
- **Existing mitigation:** Reset-on-animation-reset and large backward-jump detection.
- **Recommended change:** Derive trail/fade state from absolute timeline and pause metadata, preferably inside `PlayerCore`; remove render-history dependence.
- **Illustrative patch or implementation outline:** Not applied. Add a pure `trailEnvelopeAt(timelineTime, project, mode)` result to the canonical frame model.
- **Tests to add or amend:** Fresh direct seek, sequential play, reverse, fixed-step export, pause entry/exit, tail completion, and sub-10% backward scrubs.
- **Validation approach:** Compare canonical frame fingerprints and rendered extents for all evaluation orders.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Preserve the intended pause-shrink appearance while changing its derivation.

### [RP-06] Timeline and transport state are inconsistent across mode changes and export

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Correctness, state management, export
- **Location:** `src/app/pathTiming.js:371`, `src/app/wiringControllers.js:773`, `src/app/exporting.js:107`, `src/services/AnimationEngine.js:749`
- **Affected component or flow:** Visibility-mode transitions, Edit-mode video export, export cleanup, paused/variable-speed projects.
- **Evidence:** Duration depends on preview/visibility/trail settings, but not every mode handler rebuilds it. Video export reads duration before forcing preview mode. Export saves path progress but restores it through the different timeline-progress API. Multiple consumers also interpret the latched `state.isPlaying` as active playback.
- **Current behaviour:** Reveal/comet mode changes can leave missing or dead timeline seconds; HTML and video endpoints can differ; export can return the playhead to another physical position or resume a user-paused project.
- **Why it matters:** The master-timeline promise is the product’s architectural foundation.
- **Realistic scenario:** Exporting during a variable-speed segment or waypoint pause returns the user to a different location and emits a video without the full comet tail.
- **Existing mitigation:** `PlayerCore` has correct path/time mapping, and export uses `finally` cleanup.
- **Recommended change:** Centralize all timeline invalidation; use an explicit transport-state snapshot; enter export mode canonically, then obtain duration and restore in the same time domain.
- **Illustrative patch or implementation outline:** Not applied. `snapshot = engine.captureTransport(); setPreviewMode(true); rebuildTimeline(); … finally engine.restoreTransport(snapshot);`
- **Tests to add or amend:** Both mode-transition directions; edit/preview video; variable speed; mid-pause; success/failure/cancel; editor/HTML/video endpoint parity.
- **Validation approach:** Compare timeline fingerprints, frame endpoints, playhead position, pause state, and playback speed.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Align with RP-05’s canonical frame model.

### [RP-07] Build and release tooling can publish broken or irreproducible artifacts

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Build, deployment, release integrity
- **Location:** `build.js:138`, `push.js:53`, `DEV-INFRASTRUCTURE.md:162`, `index.html:64`
- **Affected component or flow:** Clean checkout → build → `docs/` → commit/push → GitHub Pages.
- **Evidence:** The build never cleans or atomically replaces `docs/` and silently skips missing static inputs. Tracked source lacks `UoN_map.png`, `UoN_map 24-bit.png`, and `images/Courts.jpg`, while stale committed outputs contain them and generated HTML/code still reference them. `push.js` builds from current source but stages only `docs/` and `version.json`, has no test/clean-tree/branch/upstream gate, and the documented `npm run push --dry-run` does not forward `--dry-run`.
- **Current behaviour:** A clean output can compile successfully but start with no default map and a broken Courts example. Dirty source can be bundled without its source being committed. A maintainer following the documented dry-run command can reach staging/commit/push operations.
- **Why it matters:** Production may not be reproducible from its deployment commit, and the advertised safety check is unsafe.
- **Realistic scenario:** A maintainer hard-resets generated output as documented, runs the green build and “dry run,” and publishes artifacts containing uncommitted code while required images are missing.
- **Existing mitigation:** Committed stale assets currently mask the missing inputs; manual process documentation says deploys should be clean and green.
- **Recommended change:** Build into a fresh temporary output from an explicit asset manifest, fail on absent references, atomically replace `docs/`, and deploy only from a clean tested commit in CI. Add an unambiguous `push:dry-run` script or require `npm run push -- --dry-run`.
- **Illustrative patch or implementation outline:** Not applied. CI should run `npm ci`, tests, clean build, artifact/link comparison, then deploy the immutable artifact with least privilege.
- **Tests to add or amend:** Clean-checkout build, missing asset, stale output removal, dirty source, wrong branch, failed tests, artifact/source mismatch, and dry-run no-side-effects tests.
- **Validation approach:** Rebuild from an empty output directory and HTTP-check every referenced asset before permitting deployment.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Recover/rename the authoritative missing assets before enforcing clean output.

### [RP-08] Core canvas authoring and output lack keyboard and non-visual equivalents

- **Severity:** High
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Accessibility, product interaction design
- **Location:** `index.html:1021`, `src/app/network.js:145`, `src/services/AreaDrawingService.js:61`, `src/services/HTMLExportService.js:236`
- **Affected component or flow:** Custom networks, polygons, minor waypoints, scene inspection, exported player.
- **Evidence:** The canvas has only a generic `role="img"` label and is not focusable. Network and polygon creation rely on click/drag. Network keyboard commands operate only after pointer selection. Minor points and scene graph/crowd structure have no synchronized semantic representation.
- **Current behaviour:** Keyboard-only users cannot author core structures, and non-visual users cannot inspect the route/crowd animation’s meaningful content.
- **Why it matters:** This excludes users from central, not peripheral, product capabilities.
- **Realistic scenario:** A blind educator opens an exported route but can discover only that a “Route animation canvas” exists.
- **Existing mitigation:** Major waypoints have a DOM list and several regular settings use native controls.
- **Recommended change:** Add a synchronized scene outline/text summary and design coordinate-entry or explicit keyboard editing for waypoints, polygons, nodes, and edges.
- **Illustrative patch or implementation outline:** Not applied. Treat the semantic scene model as another renderer driven by the same canonical frame/project state.
- **Tests to add or amend:** Keyboard-only authoring E2E, scene-summary parity, screen-reader navigation, and exported-player semantic output.
- **Validation approach:** Complete representative creation/edit/export tasks with pointer disabled and then with NVDA/VoiceOver.
- **Estimated effort:** Large
- **Implementation risk:** High
- **Dependencies or sequencing:** Requires stakeholder interaction-design approval.
- **Relevant standard or classification:** WCAG 2.2 success criteria 1.1.1, 1.3.1, and 2.1.1.

### [RP-09] Untrusted project and image complexity is unbounded

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Availability, input validation, performance
- **Location:** `src/services/ImageAssetService.js:188`, `src/models/Emitter.js:148`, `src/services/SwarmEngine.js:101`
- **Affected component or flow:** Open Project, image upload, scene hydration, rendering.
- **Evidence:** ZIP entry count and expanded bytes, model arrays, graph/polygon size, image pixels, and aggregate dots are uncapped. A declared ZIP limit has no caller. `1e999` becomes `Infinity`, survives emitter hydration, and is used as the upper bound of a rendering loop.
- **Current behaviour:** A compact crafted project can consume large memory or deterministically hang the tab.
- **Why it matters:** Project ZIPs are intended to be shared and therefore cross a trust boundary.
- **Realistic scenario:** A malicious or corrupt archive includes `dotCount:1e999` or a highly compressed oversized asset and freezes the recipient’s tab.
- **Existing mitigation:** The UI caps one emitter at 500, graph traversal has a hop limit, and project selection requires user action.
- **Recommended change:** Enforce finite values and compressed, expanded, entry, image-pixel, layer, graph, emitter, and aggregate-dot budgets before state mutation; make extraction cancellable.
- **Illustrative patch or implementation outline:** Not applied. Introduce a single `ProjectLimits` validator used by ZIP, autosave, HTML, and model hydration paths.
- **Tests to add or amend:** Infinity, maximum finite values, ZIP bombs, huge entries/counts, malformed manifest sizes, aggregate budget, image dimensions, and cancellation.
- **Validation approach:** Assert bounded rejection time/memory before current state changes.
- **Estimated effort:** Medium–Large
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Establish supported project-size limits with product owners.
- **Relevant standard or classification:** CWE-400, uncontrolled resource consumption. JSZip also documents its full-result memory behavior and expansion limitations in its [official limitations documentation](https://github.com/Stuk/jszip/blob/main/documentation/limitations.md).

### [RP-10] Background controls have duplicate owners

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** UI correctness, maintainability
- **Location:** `src/app/wiringDom.js:627`, `src/controllers/UIController.js:666`, `src/main.js:597`
- **Affected component or flow:** Fit/Fill, image upload, tint updates.
- **Evidence:** Legacy listeners are attached before `UIController`. Fit/Fill is toggled by both paths, producing a double toggle; upload can decode the same file twice.
- **Current behaviour:** Fit/Fill can appear to do nothing, while uploads and tint changes perform redundant work.
- **Why it matters:** It creates visible incorrectness and obscures state ownership.
- **Realistic scenario:** One Fit→Fill click is immediately reversed by the second listener.
- **Existing mitigation:** Both paths eventually emit/render valid-looking state in some cases.
- **Recommended change:** Remove the legacy block and make `UIController` the sole DOM owner.
- **Illustrative patch or implementation outline:** Not applied. DOM listener → one semantic EventBus command → one state mutation → render/autosave.
- **Tests to add or amend:** Exactly-one transition, decode, event, render, and autosave assertion.
- **Validation approach:** Instrument relevant calls and exercise every background control once.
- **Estimated effort:** Small
- **Implementation risk:** Low
- **Dependencies or sequencing:** Can be addressed independently.

### [RP-11] Touch input uses a separate, incomplete state machine

- **Severity:** Medium
- **Confidence:** High for incomplete routing; Medium for compatibility-click duplication
- **Classification:** Confirmed defect / strongly supported browser risk
- **Category:** Input handling, mobile support
- **Location:** `src/handlers/InteractionHandler.js:858`
- **Affected component or flow:** Tap, waypoint drag, network editing, polygon editing, scroll/pinch.
- **Evidence:** Touch handlers manually invoke mouse handlers and a click. Mouse-up resets `hasDragged` before touch-end examines it. Touch move forwards only for the waypoint `isDragging` flag, not network or area drag state.
- **Current behaviour:** Network/area gestures receive no touch moves; waypoint drags can be misclassified as taps; a browser compatibility click may duplicate activation.
- **Why it matters:** The product exposes touch listeners but does not provide one coherent interaction contract.
- **Realistic scenario:** Dragging a waypoint on a tablet ends by adding or selecting another point, while network edges cannot be dragged.
- **Existing mitigation:** `preventDefault()` is used during some waypoint moves.
- **Recommended change:** Unify on Pointer Events, pointer capture, one drag/tap state machine, and an intentional `touch-action` policy.
- **Illustrative patch or implementation outline:** Not applied. Replace synthetic mouse calls with `pointerdown/move/up/cancel` handlers shared by all edit modes.
- **Tests to add or amend:** Exactly-once tap; waypoint/node/edge/area drag; cancellation; pinch/scroll; pointer capture loss.
- **Validation approach:** Automated pointer tests plus physical iOS Safari and Android Chrome.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Coordinate with keyboard-accessible canvas design.

### [RP-12] Modal, composite-widget, help, target-size, and naming semantics do not meet the declared standard

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Accessibility, design-system enforcement
- **Location:** `src/main.js:909`, `src/components/ParamTooltip.js:120`, `src/controllers/UIController.js:1359`, `index.html:1026`
- **Affected component or flow:** Splash, clear dialog, lists, parameter help, transport, layer actions.
- **Evidence:** Splash/clear dialogs lack complete initial focus, trap, inert background, Escape, and restoration. Listboxes do not implement listbox ownership/key behavior. About 70 tooltip triggers add tab stops and intercept native label activation. Transport accessible names are glyphs rather than action names. Several controls measure below 44×44; sampled color tokens meet AA but not the project’s 7:1 AAA policy.
- **Current behaviour:** Focus can escape or be lost, AT receives misleading widget semantics, label clicks open help instead of activating controls, and targets/names are inconsistent.
- **Why it matters:** These issues compound RP-03 and make a stated AAA default unsupportable.
- **Realistic scenario:** A screen-reader user enters the splash but focus remains on the background body; a user hears the Play control announced only as “▶”.
- **Existing mitigation:** The codec modal has a reusable focus trap; native controls, skip link, unique IDs, resolved labels, visible focus, and reduced-motion CSS are broadly present.
- **Recommended change:** Create one corrected modal primitive; use native list semantics unless full composite behavior is needed; replace tooltip-over-label interception with named adjacent info buttons; enforce accessible names and a single hit-area token.
- **Illustrative patch or implementation outline:** Not applied. Apply `inert` to application siblings, restore opener focus, and centralize `aria-label`/target sizing in components.
- **Tests to add or amend:** Focus enter/cycle/Escape/restore, accessibility-tree assertions, label activation, accessible names, computed hit boxes, and rendered contrast.
- **Validation approach:** Browser E2E with axe plus NVDA/VoiceOver, zoom, touch, forced-colors, and reduced-motion passes.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Repair global Tab handling first.
- **Relevant standard or classification:** WCAG 2.2 criteria 1.4.3, 2.4.3, 2.5.8, and 4.1.2; project policy additionally targets AAA contrast and 44×44 controls.

### [RP-13] Export portability and completion behavior are insufficiently verified

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Export, offline behavior, browser compatibility
- **Location:** `src/services/HTMLExportService.js:45`, `src/services/VideoExporter.js:70`, `src/services/VideoExporter.js:314`
- **Affected component or flow:** First offline HTML export; MediaRecorder fallback; output duration.
- **Evidence:** HTML export fetches `player.js` on demand, so an already-open app cannot perform its first HTML export after losing network. Capability checks do not probe every API later used by the recorder fallback. Both video loops emit one more frame than the announced total.
- **Current behaviour:** “Fully offline” has an exception, nominally supported browsers may fail after export starts, and output can be one frame/interval too long.
- **Why it matters:** Export is a primary deliverable and failures occur after potentially expensive setup.
- **Realistic scenario:** A user loads the app online, enters a lecture room without connectivity, and the first standalone HTML export fails.
- **Existing mitigation:** Same-origin fetch, visible progress/cancellation, explicit timestamps, bounded encoder queue, recorder fallback, and `finally` cleanup.
- **Recommended change:** Bundle or preload/cache player code; probe the complete selected strategy; define exact sample-count math and a tested browser matrix.
- **Illustrative patch or implementation outline:** Not applied. Select an export strategy only after all required APIs pass capability probes; generate exactly `totalFrames` samples.
- **Tests to add or amend:** Offline-first export, Chromium/Firefox/Safari strategy matrix, absent `captureStream`/`requestFrame`, success/failure/cancel, frame counts and timestamps.
- **Validation approach:** Inspect generated files’ duration/frame count and replay them in supported browsers.
- **Estimated effort:** Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Resolve RP-05/RP-06 first so the exported content is canonical.

### [RP-14] Maintainer scripts do not safely constrain arguments or process targets

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Local operational security, developer tooling
- **Location:** `push.js:18`, `push.js:79`, `scripts/restart.sh:60`
- **Affected component or flow:** Custom deployment messages and local server restart.
- **Evidence:** A custom commit message is interpolated into an `execSync()` shell string, enabling command substitution/metacharacter interpretation. Restart collects every listener on port 3000 and every user process matching generic `build.js --watch`, then sends TERM and potentially KILL.
- **Current behaviour:** Copied/untrusted commit-message text can execute shell syntax; another project’s watcher or port-3000 service can be terminated.
- **Why it matters:** Both scripts operate with the maintainer’s local privileges.
- **Realistic scenario:** A generated release message contains `$(...)`, or another workspace runs its own `build.js --watch`; the helper executes/kills outside this project.
- **Existing mitigation:** Scripts are manually invoked; restart avoids a fully broad `pkill node`.
- **Recommended change:** Use `execFileSync`/`spawnSync` with argument arrays and `shell:false`; track the project dev server in a PID file and verify cwd/parentage.
- **Illustrative patch or implementation outline:** Not applied. `execFileSync('git', ['commit', '-m', message], {shell:false})`.
- **Tests to add or amend:** Quotes, substitutions, semicolons, newlines, leading dashes, Unicode, foreign process tables, stale PID files, and occupied foreign port.
- **Validation approach:** Isolated Git/process fixtures must show literal message handling and zero signals to foreign PIDs.
- **Estimated effort:** Small–Medium
- **Implementation risk:** Low
- **Dependencies or sequencing:** Coordinate deployment changes with RP-07.
- **Relevant standard or classification:** Commit-message path maps to CWE-78.

### [RP-15] CI, runtime, dependency, coverage, and licence governance is incomplete

- **Severity:** Medium
- **Confidence:** High for repository facts; Medium for legal implications
- **Classification:** Confirmed operational risk
- **Category:** Supply chain, QA, reproducibility, licensing
- **Location:** `package.json:1`, `vitest.config.js:18`, `package-lock.json:1`
- **Affected component or flow:** Clone/install/test/update/release/compliance.
- **Evidence:** No tracked CI, automated updater, CODEOWNERS, SECURITY policy, Node version file, `engines`, `packageManager`, coverage script/provider/threshold, top-level LICENSE, or notice/SBOM exists. Package metadata says 3.2.0 while the lock root says 3.1.0. `npm audit` found one Low esbuild advisory.
- **Current behaviour:** Green tests are not automatically enforced; supported runtime is inferred from transitive engines; licence/source-notice obligations are not presented coherently.
- **Why it matters:** Reproducibility and release confidence depend on individual maintainer practice.
- **Realistic scenario:** A contributor uses an unsupported Node line, bypasses tests, or ships an artifact without required project/third-party notices.
- **Existing mitigation:** Lockfile v3 includes integrity and registry provenance; offline `npm ci` succeeded; all runtime dependencies are bundled.
- **Recommended change:** Pin an active LTS Node/npm, use `npm ci`, add CI and update automation, enable coverage thresholds, synchronize lock metadata, add LICENSE/third-party notices/SBOM, and document support/security reporting.
- **Illustrative patch or implementation outline:** Not applied. Start with one read-only CI workflow: frozen install → test → coverage → clean build → asset/link audit → artifact upload.
- **Tests to add or amend:** Matrix on supported Node versions, frozen-install drift, coverage floor, notice/source-link presence, clean artifact inventory.
- **Validation approach:** Reproduce from a new clone and compare artifact hashes/inventory.
- **Estimated effort:** Medium
- **Implementation risk:** Low–Medium
- **Dependencies or sequencing:** Release pipeline ownership and licence-owner review are required.

The host’s Node 24 line is currently LTS; Node recommends production use of Active or Maintenance LTS releases in its [official release policy](https://nodejs.org/en/about/previous-releases). esbuild 0.27.7 is affected by a Windows-only development-server traversal in `>=0.27.3 <0.28.1`; 0.28.1 patched it. The advisory is Low and current macOS/localhost exposure is limited, but upgrading is straightforward. [GitHub advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), [esbuild 0.28.1 release](https://github.com/evanw/esbuild/releases/tag/v0.28.1).

### [RP-16] Paused or completed playback continues full-canvas rendering

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed defect; impact magnitude not yet measured
- **Category:** Performance, transport state
- **Location:** `src/services/AnimationEngine.js:120`, `src/models/AnimationState.js:43`, `src/app/playback.js:281`
- **Affected component or flow:** Editor and exported player after first pause/completion.
- **Evidence:** The animation engine continually schedules `requestAnimationFrame`; pause leaves `isPlaying=true`; render gates check the raw flag without `!isPaused`.
- **Current behaviour:** Full canvas rendering continues near display refresh rate while visually idle, contradicting the adjacent CPU-reduction comment. Resize handling and player-button logic also use the ambiguous flag.
- **Why it matters:** Large imagery/crowds can waste CPU, battery, and thermal budget.
- **Realistic scenario:** A paused presentation tab containing 500 dots continues redrawing indefinitely.
- **Existing mitigation:** Some callers check the canonical `AnimationEngine.isPlaying()` method correctly.
- **Recommended change:** Adopt an explicit transport state and sleep the loop while no playback, transition, export, or dirty render is pending.
- **Illustrative patch or implementation outline:** Not applied. Render on active playback or invalidation; schedule one frame for state edits and stop afterward.
- **Tests to add or amend:** Fake-rAF render count after pause/complete/reset; resize-after-pause; HTML replay; paused export restoration.
- **Validation approach:** Browser CPU/energy profiles for idle, paused, 500-dot, and 4K-background cases.
- **Estimated effort:** Small–Medium
- **Implementation risk:** Medium
- **Dependencies or sequencing:** Best implemented alongside RP-06’s transport-state consolidation.

### [RP-17] Privacy boundaries for imported styles, published samples, assets, and support logs are incomplete

- **Severity:** Low
- **Confidence:** High for mechanisms; Medium for content sensitivity
- **Classification:** Confirmed weakness / owner-intent uncertainty
- **Category:** Privacy, content governance
- **Location:** `src/app/crowds.js:180`, `build.js:222`, `src/main.js:22`, `src/models/ImageAsset.js:57`
- **Affected component or flow:** Imported color values, public build inventory, shared projects/HTML, support-log export.
- **Evidence:** Imported “colors” reach CSS `background`, allowing `url(...)` network fetches; no CSP blocks them. Two meaningful project ZIPs are tracked, one under the recursively published `images/` tree, without source references establishing intent. Custom assets retain original bytes/filenames/metadata. Debug-log export includes filenames, arbitrary objects, user agent, display information, and route details.
- **Current behaviour:** A crafted project can cause a low-impact external request; potentially incidental project data can be published; shared files/logs can preserve identifiers or image metadata.
- **Why it matters:** Users may treat routes, filenames, and imagery as local/private until deliberately shared.
- **Realistic scenario:** A malicious ZIP embeds a unique remote URL to learn that it was opened, or a JPEG marker carries EXIF location into a shared project.
- **Existing mitigation:** No automatic telemetry or log transmission exists; export/log sharing is manual; HTML script/title embedding is safely escaped.
- **Recommended change:** Strictly validate colors and use `backgroundColor`; add a compatible CSP; owner-review sample ZIP provenance; use an explicit static allowlist; add privacy preview/redaction and optional metadata stripping.
- **Illustrative patch or implementation outline:** Not applied. Allow only parsed CSS color tokens and explicitly enumerate publishable asset extensions/files.
- **Tests to add or amend:** Hostile CSS values, outbound-request observation, artifact allowlist, EXIF fixture, sensitive-filename/log redaction.
- **Validation approach:** Network-isolated browser test and owner review of every published non-code artifact.
- **Estimated effort:** Medium
- **Implementation risk:** Medium for re-encoding animated/vector assets
- **Dependencies or sequencing:** Requires a decision about intended sample-data publication and fidelity.
- **Relevant standard or classification:** No compliance claim is made.

### [RP-18] Canonical documentation contains material implementation drift

- **Severity:** Low
- **Confidence:** High
- **Classification:** Confirmed defect
- **Category:** Documentation, developer experience
- **Location:** `README.md:24`, `AGENTS.md:108`, `DEV-INFRASTRUCTURE.md:23`, `pm_skills/project/architecture.md:5`
- **Affected component or flow:** Contributor setup, feature expectations, operations, accessibility and recovery claims.
- **Evidence:** Some authoritative sections still claim one runtime dependency while another section and the manifest correctly show two. Graph models are described as unwired although network editing is active. Test documentation says 57/57 or lists only two suites versus 331 observed tests. Canonical script documentation omits scripts present in `package.json`. Autosave/background and fully-offline claims are inaccurate. The dry-run command is unsafe.
- **Current behaviour:** A contributor can follow instructions that misstate support, testing, persistence, or deployment behavior.
- **Why it matters:** The repository explicitly treats these documents as governing sources.
- **Realistic scenario:** A maintainer uses the documented dry run and initiates real deployment actions.
- **Existing mitigation:** The backlog candidly records reflow limitations, and newer architecture sections correctly list both runtime dependencies.
- **Recommended change:** Reconcile protected/canonical documentation as a dedicated sign-off batch after behavior is fixed.
- **Illustrative patch or implementation outline:** Not applied. Update claims from measured tests/build/browser evidence and link each limitation to its remediation ticket.
- **Tests to add or amend:** Documentation command smoke tests, dependency-count check, script-table check, link/asset validation.
- **Validation approach:** Run every published setup/build/dry-run command in an isolated clean checkout.
- **Estimated effort:** Small
- **Implementation risk:** Low
- **Dependencies or sequencing:** Behavior-changing findings should be resolved or explicitly documented first.

## 7. Root-cause themes

| Theme | Findings | Structural response |
|---|---|---|
| Mutation before validation | RP-01, RP-02, RP-09 | One staged, bounded, transactional project-loading/persistence layer |
| Fragmented state ownership | RP-03, RP-05, RP-06, RP-10, RP-11, RP-16 | Canonical command dispatcher, transport state, frame model, and pointer state machine |
| Declared invariants not enforced at boundaries | RP-04, RP-05, RP-07, RP-08, RP-12 | Turn reflow, determinism, clean build, and accessibility claims into executable gates |
| Happy-path-heavy validation | RP-01, RP-02, RP-07, RP-09, RP-13, RP-15 | Add failure, resilience, adversarial, E2E, and clean-checkout tests |
| Artifact/source drift | RP-07, RP-15, RP-18 | Fresh immutable build output plus CI provenance and documentation checks |
| Local operational effects are overly broad | RP-07, RP-14 | Argument-safe subprocess APIs, verified targets, and least-privilege CI |
| Privacy behavior is implicit | RP-02, RP-17 | Explicit retention/deletion, publication inventory, metadata, and support-log policy |

## 8. Positive findings

- `PlayerCore` centralizes segment, handle, pause, intro, tail, and inverse timeline mapping and has strong unit coverage.
- Beacon evaluation is closed-form. The golden-frame harness compares sequential, direct, reverse, and fixed-step paths well.
- `SwarmEngine` is seed-based, deterministic, call-order independent, signature-cached, and protected by a graph-hop cap.
- Scene and graph serialization is versioned and additive; invalid graph references are dropped rather than blindly retained.
- HTML export reuses the real player/rendering stack. JSON escapes `<`, U+2028, and U+2029; titles are HTML-escaped; player error text uses `textContent`.
- No `eval`, `new Function`, `document.write`, remote runtime script, analytics, beacon, WebSocket, or automatic project transmission was found.
- Runtime dependencies are bundled rather than loaded from a CDN.
- The development server binds to localhost.
- The lockfile is version 3 and contains integrity/provenance metadata for the installed package graph.
- All 331 observed tests passed, and deterministic timeline/player parity coverage is unusually strong.
- HTML has a language declaration, skip link, main landmark, native controls, 258 unique IDs, and all inspected label targets resolved.
- SwatchPicker, Dropdown, ContextMenu, codec focus management, visible focus styling, and reduced-motion CSS contain thoughtful accessible behavior.
- Export status provides progress, pause/resume, completion, cancellation, and live announcements.
- Documentation captures architectural decisions, backlog limitations, development workflows, and invariants more thoroughly than most repositories of similar size.

## 9. Test-gap analysis

| Behavior | Risk | Existing tests | Proposed level/scenarios | Fixtures/infrastructure | CI-capable | Priority |
|---|---|---|---|---|---|---|
| Transactional project load | Current work destroyed | Happy v7/v9 loads | Integration/resilience; fail every import stage | Corrupt JSON/images/assets/graphs | Yes | Immediate |
| Autosave durability/deletion | Lost or resurrected work | Top-level snapshot shape only | Integration/resilience; quota, retry, debounce, clear/reload | Mock storage and real browser profiles | Yes/Browser | Immediate |
| Trail determinism | Editor/export mismatch | Golden frames omit motion visibility | Unit/contract; direct/sequential/reverse/fixed-step | Canonical timeline fixtures | Yes | Immediate |
| Mode/export timeline parity | Wrong duration/playhead | Player tests rebuild manually | Contract; all mode transitions and export outcomes | Variable-speed/pause project | Yes | Immediate |
| Global keyboard wiring | App unusable by keyboard | No direct full-app dispatcher suite | E2E/accessibility; Tab and exact-once commands | Chromium plus AT manual pass | Yes/manual | Immediate |
| Responsive reflow | Controls unreachable | None | E2E/accessibility at widths and zoom levels | Browser matrix/screenshots | Yes | Immediate |
| Canvas semantic alternative | Users excluded | None | E2E/manual AT; scene-summary parity | Representative route/network/crowd | Yes/manual | Immediate |
| Adversarial project limits | Tab hang/memory exhaustion | Low/NaN emitter cases only | Security/performance; Infinity, bombs, huge arrays/images | Generated bounded fixtures | Yes | High |
| Clean release artifact | Broken/irreproducible deploy | No CI | Contract/E2E; clean output, links, dirty tree, dry run | Temporary Git repository | Yes | Immediate |
| Export capability/frames | Late failure/wrong duration | Limited unit coverage | Contract/E2E across browser strategies | Browser/codec matrix and media inspection | Yes/manual | High |
| Pointer/touch | Broken/duplicate gestures | Network service tests, not full pipeline | E2E/manual; tap, drag, cancel, pinch | iOS/Android or device farm | Partial | High |
| Modal/widgets/labels | Misleading AT/focus loss | No focus-trap/tooltip full-app suite | axe/E2E/manual AT | Browser plus NVDA/VoiceOver | Yes/manual | High |
| Idle rendering | Battery/CPU waste | None | Unit/performance; rAF counts and profiling | Fake rAF and large scene | Yes/manual | Medium |
| Privacy redaction/publication | Metadata/data leakage | None | Security/artifact inventory | EXIF, hostile CSS, sensitive strings | Yes | Medium |
| Coverage floor | Silent untested regressions | Coverage config only | Coverage with risk-based thresholds | `@vitest/coverage-v8` | Yes | Medium |

## 10. Dependency and supply-chain assessment

Direct installed versions observed:

| Package | Role | Installed | Current registry observation | Assessment |
|---|---|---:|---:|---|
| `jszip` | Runtime ZIP handling | 3.10.1 | Current | No current advisory found; project must still bound decompression |
| `mediabunny` | Runtime media export | 1.55.1 | 1.55.2 | Patch available |
| `esbuild` | Build/dev server | 0.27.7 | 0.28.2 | One Low Windows-only advisory; upgrade to at least 0.28.1 |
| `jsdom` | Tests | 27.4.0 | 29.1.1 | Major upgrade; evaluate separately |
| `vitest` | Tests | 4.1.10 | 4.1.11 | Patch available |

Assessment:

- `npm ci --ignore-scripts --offline` reproduced 155 packages successfully.
- The lockfile uses npm lockfile v3, registry URLs, and integrity hashes.
- No direct dependency appeared unnecessary from usage inspection.
- `npm audit` found one Low issue and zero Moderate, High, or Critical issues.
- The esbuild issue affects its Windows development server, not the produced browser bundle. Current macOS/localhost exposure is limited, but the fix is available.
- No root runtime policy exists even though current jsdom/Vitest engines exclude several Node lines.
- No automated dependency updater or CI gate is tracked.
- Root package and lock root versions differ.
- The repository claims MIT but lacks a top-level licence text.
- Mediabunny is MPL-2.0. Legal comments are preserved, but third-party notices and an explicit source/licence link are absent. Mozilla’s [MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) is the appropriate starting point; this report is not legal advice.
- Recommended sequence: esbuild/Vitest/Mediabunny patches first; add runtime pins and CI; then evaluate jsdom 29 separately with test-environment compatibility review.

## 11. Security and privacy assessment

- **Authentication/authorization/tenancy:** Not applicable; the application is a public static client with no accounts or backend.
- **Primary trust boundaries:** Imported project ZIPs, uploaded images, `localStorage`, generated/shared files, imported style values, and local maintainer scripts.
- **Input handling:** HTML-export script/title injection is handled correctly. Project complexity, numeric finiteness, expanded archive size, image dimensions, and CSS color grammar are not adequately bounded.
- **Output handling:** Standalone HTML embedding is sound. Raw asset metadata/filenames and support logs need a clearer privacy boundary.
- **Secrets:** No credential pattern, sensitive-looking configuration, credentialed remote, or application secret was found.
- **Logging:** A local 500-entry debug ring captures arbitrary objects, filenames, user agent, and screen properties. Transmission is manual.
- **Storage/retention:** Autosave persists without an explicit retention period. Clear All does not reliably remove or replace stored route data.
- **Third-party processing:** None was found at runtime; dependencies are bundled.
- **Network egress:** Imported CSS-like values can cause image fetches because they are assigned to `background`; there is no CSP.
- **Supply chain:** Lock integrity is good; automated checks, runtime pinning, and immutable CI deployment are absent.
- **Highest-risk misuse path:** A recipient opens a crafted ZIP that expands excessively or hydrates an infinite/huge work model and loses availability.
- **Manual security work still required:** Browser-level hostile archive testing under memory/CPU observation, CSP compatibility, published-artifact provenance review, Pages/repository protection review, and source-map policy confirmation.
- **Compliance:** No GDPR, FERPA, security-standard, or accessibility compliance conclusion is claimed.

## 12. Accessibility and user-facing assessment

Confirmed material issues:

- Plain Tab is globally prevented.
- Playback shortcuts dispatch twice.
- The right panel is inaccessible at ordinary narrow widths/zoom.
- Core canvas authoring lacks keyboard and semantic alternatives.
- Splash and Clear dialogs do not use complete modal behavior.
- ARIA listboxes do not implement the matching interaction pattern.
- Help triggers create excessive tab stops and suppress label activation.
- Several transport buttons expose glyph names.
- Multiple action targets are below the project’s 44×44 requirement.
- Sampled text colors generally meet AA but not the project’s stated 7:1 AAA policy.
- Touch routing is incomplete.
- Corrupt image and storage failures are inadequately visible/actionable.
- First-time HTML export is not fully offline.

Positive evidence includes native form elements, complete label targets, a skip link, landmarks, visible focus, reduced-motion CSS, well-designed dropdown/context-menu components, live announcements, and a functioning codec-modal focus trap.

No automated axe run or screen-reader test was performed. Before making a WCAG 2.2 conformance claim, complete keyboard, NVDA, VoiceOver, zoom/reflow, forced-colors, reduced-motion, iOS, and Android testing.

## 13. Architecture and maintainability assessment

Strengths:

- Clear service/model/controller separation.
- EventBus convention for cross-module communication.
- Normalized coordinate model.
- Canonical `PlayerCore`.
- Deterministic crowd engine and versioned scene data.
- Standalone exported player reuses production rendering code.
- Strong governing documentation.

Weaknesses:

- DOM and command ownership is duplicated across old and new wiring.
- Transport state is represented by overlapping booleans and duplicated JKL state machines.
- Rendering still contains history-dependent state outside the canonical frame model.
- Persistence mutates live state instead of operating transactionally.
- Validation is enforced mainly in the UI, not the models/import boundary.
- Build output is both source-controlled and incrementally mutated, allowing stale artifacts to mask missing source.
- Largest complexity hotspots include `styles/main.css` (~2,946 lines), `RenderingService` (~2,360), `UIController` (~2,107), `MotionVisibilityService` (~1,786), and `wiringControllers` (~1,191).
- Browser-console logging is useful diagnostically but no structured production error/recovery boundary exists.

Recommended structural improvements:

1. A detached `ProjectLoader` with shared limits and atomic commit.
2. A single explicit transport state and canonical frame snapshot.
3. One application command/key dispatcher.
4. One pointer-event state machine.
5. Reusable modal/list/action primitives.
6. Fresh immutable release artifacts produced in CI.
7. Small adapter modules around large wiring/rendering surfaces rather than further mixin expansion.

## 14. Performance and scalability assessment

Measured:

- Test suite: 331 tests in 9.80 seconds.
- Production bundles: approximately 597.60 KB app and 138.34 KB player.
- A simple two-waypoint/one-crowd scene rendered and played without console errors.
- No production-scale frame-time, memory, battery, or export benchmark was run.

Confirmed risks:

- An infinite emitter count can make a rendering loop non-terminating.
- Archive and image expansion is unbounded.
- Paused/completed playback continues full-canvas rendering.
- Duplicate background handlers perform redundant decoding/mutations.
- Clean builds retain stale files unless output is removed externally.

Likely but unmeasured risks:

- Many legal 500-dot emitters and complex networks can exceed frame budgets.
- 4K imagery and full-resolution export can pressure browser memory.
- ZIP extraction and base64 conversion can temporarily duplicate large payloads.
- Large canvases and MediaRecorder/WebCodecs behavior will vary by browser/GPU.

Safe optimization priorities:

1. Enforce resource limits.
2. Stop idle rendering.
3. Remove duplicate work.
4. Profile representative large scenes before algorithmic tuning.
5. Move bounded archive/model staging to a cancellable worker if measurements justify it.

Recommended performance gates should cover frame time, heap peak during import/export, pause-idle CPU, 500-dot scenes, aggregate emitter limits, 4K backgrounds, and cancellation latency.

## 15. Documentation assessment

| Document/section | Problem | Proposed change |
|---|---|---|
| `README.md` setup | Uses `npm install`; no supported runtime | Document pinned LTS Node/npm and frozen `npm ci` |
| `README.md` autosave | Says a background reference is retained | Describe actual limitation until RP-02 is fixed, then document durable asset behavior |
| `README.md` offline | “Fully offline” excludes first HTML export | Narrow the claim or implement caching/bundling |
| `README.md` structure/tests | Network described as unwired; suite list stale | Reflect current editor and observed test structure without hard-coded pass counts |
| `AGENTS.md` dependencies | Says only Mediabunny | Reconcile with JSZip and package policy |
| `DEV-INFRASTRUCTURE.md` canonical scripts | Omits existing scripts and says 57/57 | List all supported commands; avoid stale fixed test totals |
| `DEV-INFRASTRUCTURE.md` deployment | Unsafe dry-run syntax and incomplete preflight | Document `npm run push -- --dry-run` temporarily; require clean, tested, artifact-verified deployment |
| `DEV-INFRASTRUCTURE.md` restart | Claims project scoping that is not implemented | Explain limitation until PID/cwd checks exist |
| Architecture opening | Says one runtime dependency | Reconcile with its later correct two-dependency section |
| `UI-STANDARDS.md` | AAA/reflow/autosave guarantees exceed implementation | Mark current exceptions and link to release-blocking remediation |
| Build documentation | Does not state that `docs/` can mask missing sources | Require empty-output builds and asset/link validation |
| Licence/security docs | Missing | Add LICENSE, notices/source information, SECURITY/support guidance |
| Published samples | Provenance/intent absent | Inventory every public project/archive and record approved purpose |
| Backlog | Reflow known, other root causes not consolidated | Add separate items for transactional persistence, keyboard ownership, deterministic trail, release integrity, and resource budgets |

Because several documents are protected/governing, these corrections should be handled as a dedicated sign-off batch rather than folded silently into implementation.

## 16. Suggested change set

### Change group A — Transactional project persistence

- **Objective:** Make open/save/autosave/delete failure-safe.
- **Findings:** RP-01, RP-02, RP-09.
- **Affected files:** Persistence, StorageService, ImageAssetService, models, UndoService.
- **Proposed edits:** Detached candidate hydration; shared limits; atomic commit; explicit storage results; lifecycle flush/cancel; local-data deletion.
- **Tests:** Failure injection, quota, corrupt archives/images, migration, undo/custom assets.
- **Documentation:** Persistence format, limits, recovery, deletion.
- **Compatibility:** Provide schema migration and warnings for projects above new limits.
- **Rollout:** Introduce validator in warning mode, then enforce after fixture analysis.
- **Rollback:** Retain old reader behind a version gate for known legacy fixtures.
- **Effort/risk:** Large / Medium–High.
- **Acceptance:** No failed load or storage write changes live/recovery state; successful load commits once.

### Change group B — Canonical timeline and transport

- **Objective:** Make every frame and export derive from one state.
- **Findings:** RP-05, RP-06, RP-16.
- **Affected files:** PlayerCore, MotionVisibilityService, AnimationEngine/State, timing, playback/export/player.
- **Proposed edits:** Pure trail envelope; explicit transport enum/snapshot; centralized invalidation; same-domain export restore; sleeping render loop.
- **Tests:** Golden order independence, mode parity, paused/export states, idle frame counts.
- **Documentation:** Timeline/frame invariant and transport contract.
- **Compatibility:** Visual trail tuning may need a signed-off golden update.
- **Rollout:** Land pure frame API first, migrate consumers, then remove old state.
- **Rollback:** Keep golden fixtures and old appearance reference for comparison.
- **Effort/risk:** Medium–Large / Medium.
- **Acceptance:** Equal time/project/seed always produces equal scene/frame; pause is idle.

### Change group C — Accessible input and reflow

- **Objective:** Restore keyboard access and meaningful non-visual operation.
- **Findings:** RP-03, RP-04, RP-08, RP-12.
- **Affected files:** InteractionHandler, keybindings, HTML/CSS, UIController, modal/list/help components, exported player.
- **Proposed edits:** Single dispatcher; native Tab; real reflow; semantic scene outline; keyboard editing design; corrected modal/list/help primitives.
- **Tests:** Browser E2E, axe, zoom, keyboard, AT, computed targets/contrast.
- **Documentation:** Supported widths, keyboard model, accessibility statement.
- **Compatibility:** Shortcut changes require release notes.
- **Rollout:** Tab/duplicate shortcuts and reflow first; semantic authoring behind iterative user testing.
- **Rollback:** Feature-flag new canvas keyboard mode during evaluation.
- **Effort/risk:** Large / High.
- **Acceptance:** Representative project can be created, inspected, saved, and played without a pointer.

### Change group D — Unified pointer and DOM ownership

- **Objective:** Eliminate duplicate UI mutations and touch divergence.
- **Findings:** RP-10, RP-11.
- **Affected files:** wiringDom, UIController, InteractionHandler, network/area services.
- **Proposed edits:** Remove legacy background listeners; adopt Pointer Events and capture.
- **Tests:** Exact event counts and desktop/touch gesture matrix.
- **Documentation:** Component ownership and supported gestures.
- **Compatibility:** Validate stylus and trackpad behavior.
- **Rollout:** Remove duplicate background path independently; migrate pointer modes incrementally.
- **Rollback:** Keep mouse-path tests until pointer parity is established.
- **Effort/risk:** Medium / Medium.
- **Acceptance:** One input action produces one mutation on every supported pointer type.

### Change group E — Reproducible release pipeline

- **Objective:** Ensure deployed output maps to a clean, tested commit.
- **Findings:** RP-07, RP-14, RP-15.
- **Affected files:** build.js, push.js, scripts, package metadata, new CI/config/licence files.
- **Proposed edits:** Fresh temporary output; explicit assets; missing-reference failure; argv-safe subprocesses; clean-tree gates; CI Pages artifact.
- **Tests:** Clean clone, missing/stale assets, dirty source, hostile messages, foreign processes.
- **Documentation:** Exact preflight, dry run, deployment, rollback, live verification.
- **Compatibility:** Preserve GitHub Pages `docs/` temporarily if CI migration must be staged.
- **Rollout:** First make local build deterministic, then introduce non-deploying CI, then switch deployment.
- **Rollback:** Retain last known-good Pages artifact and documented commit.
- **Effort/risk:** Medium / Medium.
- **Acceptance:** Empty-output build is complete, all references resolve, and artifact provenance identifies one clean green commit.

### Change group F — Export portability

- **Objective:** Make supported export paths predictable offline and across browsers.
- **Findings:** RP-13.
- **Affected files:** HTMLExportService, VideoExporter, build, README.
- **Proposed edits:** Prebundle/cache player; complete capability probes; exact frame-count logic; support matrix.
- **Tests:** Offline-first HTML, MP4/WebM across supported engines, timing inspection.
- **Compatibility:** Allow graceful resolution/format fallback.
- **Rollout:** Ship detection/error improvements before widening support claims.
- **Rollback:** Keep HTML export as the reliable fallback.
- **Effort/risk:** Medium / Medium.
- **Acceptance:** Every advertised browser either completes the advertised output or blocks before work with an actionable alternative.

### Change group G — Privacy and publication controls

- **Objective:** Make local/share/public boundaries explicit.
- **Findings:** RP-02, RP-17.
- **Affected files:** Import validation, CSS assignment, logs, asset serialization, build asset list, documentation.
- **Proposed edits:** Color grammar, CSP, public artifact allowlist, log preview/redaction, optional metadata stripping.
- **Tests:** Hostile CSS, outbound network, EXIF/log redaction, artifact inventory.
- **Documentation:** Retention, deletion, sharing, metadata, support logs.
- **Compatibility:** Preserve original assets only when explicitly requested.
- **Rollout:** Owner-review current public ZIPs before deletion/history decisions.
- **Rollback:** Restore approved sample artifacts from a reviewed source.
- **Effort/risk:** Medium / Medium.
- **Acceptance:** No unapproved archive is published and shared diagnostics/assets disclose only documented fields.

### Change group H — Documentation and QA reconciliation

- **Objective:** Make governing claims executable and current.
- **Findings:** RP-15, RP-18.
- **Affected files:** README, AGENTS, architecture, infrastructure/UI standards, backlog, test config.
- **Proposed edits:** Runtime/dependency/script facts, current limitations, coverage and browser gates.
- **Tests:** Command smoke tests and documentation consistency checks.
- **Documentation:** This group is itself a protected-document sign-off batch.
- **Compatibility:** Avoid removing decision context merely to shorten docs.
- **Rollout:** Update alongside or immediately after each behavior change.
- **Rollback:** Governing decision history remains append-only.
- **Effort/risk:** Small–Medium / Low.
- **Acceptance:** Every published command and product guarantee matches observed behavior.

## 17. Prioritised remediation roadmap

### Immediate

| Work | Benefit | Risk if deferred | Prerequisite | Effort/risk | Owner | Verification |
|---|---|---|---|---|---|---|
| Transactional import and honest autosave | Prevents user-data loss | Open/reload can erase or corrupt work | Limits and Clear All policy | L / Med–High | Data/application | Failure-injection suite |
| Keyboard dispatcher repair | Restores basic operation | Keyboard users remain blocked | None | M / Med | Front-end/accessibility | Full keyboard E2E |
| Responsive panel repair | Restores controls at laptop/zoom widths | Core functionality unreachable | Width/reflow decision | M / Med | Front-end/design | Width/zoom matrix |
| Deterministic trail/timeline parity | Makes preview/export trustworthy | Same time can render differently | Golden appearance decision | M / Med | Animation | Order-independent golden frames |
| Reproducible clean release gate | Prevents broken/unsafe deploys | Missing assets or uncommitted code can ship | Recover authoritative assets | M / Med | Build/release | Empty-output artifact audit |

### Near term

| Work | Benefit | Risk if deferred | Prerequisite | Effort/risk | Owner | Verification |
|---|---|---|---|---|---|---|
| Bound project/image complexity | Prevents hangs/crashes | Malicious/corrupt files remain dangerous | Supported limits | M–L / Med | Security/application | Adversarial fixtures |
| Semantic canvas and keyboard authoring | Removes functional exclusion | AAA/AA claims remain unsupported | Interaction design | L / High | Accessibility/design | Pointer-free + AT tasks |
| Pointer Events migration | Reliable touch/stylus use | Mobile gestures remain broken | Gesture inventory | M / Med | Front-end | Device matrix |
| Modal/list/help remediation | Coherent focus and semantics | AT friction and misleading roles persist | RP-03 | M / Med | Design system | axe + AT |
| Export strategy/capability fixes | Predictable offline/browser export | Late export failures | Timeline fixes | M / Med | Media/front-end | Browser/codec matrix |

### Medium term

| Work | Benefit | Risk if deferred | Prerequisite | Effort/risk | Owner | Verification |
|---|---|---|---|---|---|---|
| CI, coverage, runtime pins, dependency automation | Consistent quality gate | Regressions depend on local discipline | Release pipeline | M / Low–Med | Dev infrastructure | Clean-clone CI |
| Idle-render optimization | Lower CPU/battery use | Heavy paused scenes waste resources | Transport consolidation | S–M / Med | Performance | CPU/energy profile |
| Privacy/publication controls | Clearer sharing boundary | Metadata/incidental files may leak | Owner provenance review | M / Med | Security/product | Artifact/network audit |
| Licence/security documentation | Clear redistribution/support posture | Ambiguous obligations/support path | Owner/legal review | S–M / Low | Maintainer/legal | Release inventory |

### Optional

| Work | Benefit | Risk if deferred | Prerequisite | Effort/risk | Owner | Verification |
|---|---|---|---|---|---|---|
| Production source-map policy | Smaller/less revealing public artifact if disabled | Public first-party source remains easily inspectable | Debugging decision | S / Low | Release | Header/artifact check |
| Structured client diagnostics | Better actionable error reports | Console remains primary diagnostic channel | Privacy redaction | M / Low | Application/support | Failure-state tests |
| Visual/performance benchmark corpus | Detects subtle visual regressions | Optimization decisions remain anecdotal | Canonical frame model | M / Low | QA/performance | Repeatable benchmark |

## 18. Unresolved uncertainties

| Unknown | Evidence inspected | Safest assumption | Why it matters / verification | Dependent findings |
|---|---|---|---|---|
| Intended sensitivity of routes/images | Persistence, samples, logs, docs | Treat project content as potentially meaningful | Ask owner and review sample provenance | RP-02, RP-17 |
| Whether public project ZIPs are intentional | References, archive contents, build copy behavior, live availability | Do not remove or rewrite history without owner decision | Record provenance and publication approval | RP-17 |
| Supported browsers/devices | README, build target, capability checks | Current desktop Chromium is evidenced; broader claims unproven | Run Firefox/Safari/iOS/Android matrix | RP-11, RP-13 |
| Intended project-size ceiling | UI limits and models | Current UI maximum is not a complete safety budget | Benchmark representative legitimate projects | RP-09 |
| Meaning of Clear All | Dialog text and implementation | It should at least persist the empty current project | Product decision between reset and delete-local-data | RP-02 |
| AAA versus minimum-width product policy | UI standards, backlog, live reflow | Current implementation does not satisfy AAA/reflow claims | Stakeholder sign-off and formal audit | RP-04, RP-08, RP-12 |
| GitHub branch protection/Pages permissions | Repository files only | No enforcement can be assumed | Inspect repository settings and workflow tokens | RP-07, RP-15 |
| Production workload/performance | Simple local scene only | Resource risks remain unquantified beyond confirmed unbounded loops | Profile agreed maximum project | RP-09, RP-16 |
| Historical sibling inclusion | Workspace structure and active docs | `Route Plotter v3` is the authoritative active repository | Owner confirmation if a portfolio-wide review was intended | Review scope only |
| MPL/source-notice obligations | Lock metadata, bundle comments, Mozilla guidance | Obtain owner/legal confirmation | Technical review cannot give legal advice | RP-15 |

## 19. Manual verification checklist

- [ ] Open corrupt and oversized project ZIPs while unsaved work is present; verify complete rollback.
- [ ] Test autosave under normal, quota-exceeded, disabled/private storage, immediate close, Clear All, and Delete Local Data.
- [ ] Complete the entire product journey using only a keyboard.
- [ ] Test NVDA with Firefox/Chrome and VoiceOver with Safari.
- [ ] Validate 1440, 1439, 1280, 1024, and 320 CSS-pixel widths at 100%, 200%, and 400% zoom.
- [ ] Test forced-colors/high-contrast and reduced-motion, including Canvas motion.
- [ ] Test tap/drag/pinch/cancel on physical iOS and Android devices.
- [ ] Export HTML after disconnecting before the first export.
- [ ] Exercise MP4/WebM at every offered resolution on current Chromium, Firefox, and Safari.
- [ ] Measure frame count, duration, cancellation, heap peak, and background-tab behavior.
- [ ] Profile idle/paused CPU and large-scene frame time.
- [ ] Inspect GitHub Pages, branch protection, permissions, secret scanning, and rollback settings.
- [ ] Review every publicly deployed ZIP/image for provenance and permission.
- [ ] Review generated source maps, CSP, privacy headers, and public artifact inventory.
- [ ] Confirm licence, third-party notice, and source-availability obligations.
- [ ] Conduct a recovery drill from a known previous deployment artifact.

## 20. Handover summary

The five most important findings are:

1. Project import can destroy current work before validation finishes.
2. Autosave is incomplete and can silently fail or resurrect cleared data.
3. Global keyboard handling blocks Tab and double-dispatches playback.
4. Timeline/rendering state can produce different frames for the same time.
5. The build/deployment path can publish broken or irreproducible output.

The five most valuable proposed changes are:

1. Introduce a bounded transactional project loader and durable asset-aware autosave.
2. Consolidate keyboard, pointer, timeline, and transport ownership.
3. Repair reflow and provide semantic/keyboard canvas authoring.
4. Build fresh immutable artifacts and deploy only clean, tested commits.
5. Add CI with failure, accessibility, clean-build, security, and browser/export gates.

Release blockers are RP-01 through RP-08. RP-09 should also be resolved before encouraging users to open untrusted shared projects.

After changes, another developer should run from a clean checkout:

```bash
npm ci
npm test
npm run build
npm audit
npm outdated
```

They should additionally run the new clean-output asset/link check, browser E2E suite, accessibility suite, adversarial project fixtures, and cross-browser export matrix. Until RP-07 is fixed, do not rely on the documented `npm run push --dry-run`; if inspecting current behavior in an isolated disposable checkout, script arguments require the `--` separator.

All patches and implementation outlines in this report are suggestions only. None was applied. The reviewed `Route Plotter v3` repository remained unchanged at `main` / `cec0191250ab981b30e7242772ff165ea3e775b7`, with the same pre-existing untracked `.claude/launch.json`.

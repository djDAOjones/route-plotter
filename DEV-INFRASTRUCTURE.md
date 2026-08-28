# Dev Infrastructure

This file defines the permanent rules for how Route Plotter is built,
run, tested, versioned, and shipped. `AGENTS.md` references this file.
Read it before any task that involves the build system, dev server,
scripts, configuration, or deployment.

---

## Package management

Package manager: **npm**

- `package.json` lives in the project root.
- **Runtime dependencies:** `jszip` (project archives) and `mediabunny`
  (MP4/WebM mux layer). Do not add runtime packages without explicit
  approval.
- **Dev dependencies** (esbuild, vitest, jsdom) are established.
  New dev dependencies can be added when justified.
- Supported Node versions are declared in `package.json`; `.nvmrc` pins
  Node 24 for maintainers and `packageManager` records the expected npm
  release (npm does not enforce that field by itself).
- Run `npm ci` after cloning. Do not commit `node_modules/`.

---

## Canonical scripts

| Script | Command | Purpose | When to use |
| --- | --- | --- | --- |
| `dev` | `node build.js --watch --serve` | Dev server with watch | Day-to-day development |
| `build` | `NODE_ENV=production node build.js` | Production build (minified, sourcemap) | Before deploy |
| `build:deploy` | `npm run build` | Alias of `build` — outputs straight to `docs/` (the GitHub Pages dir) | When deploying |
| `build:check` | `NODE_ENV=production node build.js --check` | Validate a temporary production build without changing `docs/` or `version.json` | CI / close-out |
| `check` | `npm test && npm run test:shell && npm run build:check` | Canonical JS, maintainer-script and build gate | Before commit |
| `test` | `vitest run --pool=threads --no-file-parallelism` | Run tests once | After every change |
| `test:shell` | `bash tests/restartSafety.test.sh` | Project-scoped dev-server PID/cleanup contract | After restart-script changes / in CI |
| `test:watch` | `vitest watch --pool=threads --no-file-parallelism` | Tests in watch mode | During development |
| `push:dry-run` | `node push.js --dry-run` | Show deployment commands without changing files or Git | Before deploy |
| `push` | `node push.js` | From a clean source commit: test, build, stage generated files, commit, push current branch | When ready to ship |

Do not add scripts without updating this table.

> **Why the threads pool?** Vitest's default `forks` pool times out
> starting its worker in this OneDrive-synced workspace path and
> silently reports "no tests" with exit 0 — a false green. The
> `threads` pool with `--no-file-parallelism` runs reliably.
> See decision-log 2026-06-16.

---

## Dev server

- **URL:** `http://localhost:3000`
- **Start:** `npm run dev`
- **Serves:** Build output from `docs/` (esbuild rebuilds JS on
  change; CSS and HTML are watched and copied)
- **No hot-module replacement.** After any change, hard-refresh
  (`Cmd+Shift+R`).

If port 3000 is already in use, `restart.sh` stops it only when the process
belongs to this checkout. It reports and preserves a foreign listener. Inspect
that process before deciding whether to stop it:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
ps -p <PID> -o pid=,command=
```

---

## Runtime lifecycle

Route Plotter is a **client-only static app** — no backend, database,
or persistent server state. "Running it" means building the bundle and
serving `docs/` over HTTP. Reaching a known-good state is one command
(`npm run dev`); recovery is stopping the dev server and restarting.

**Command surface** (full table in Canonical scripts above):

| Verb | Command | Does |
| --- | --- | --- |
| Boot | `npm run dev` | Build, watch `src/`, serve `docs/` at the dev URL. The canonical run command. |
| Reboot | `./scripts/restart.sh` (or `Ctrl-C`, then `npm run dev`) | Stop this checkout's recorded watcher tree and start fresh (also bumps the build number); refuse to kill an unrelated port holder; verify readiness. |
| Build | `npm run build` (or `./scripts/build.sh`) | One-off production build into `docs/` (no server). |
| Test | `npm test` | Run the vitest suite once. |

- **Dev URL / port:** `http://localhost:3000` (see Dev server above).
- **Components & startup order:** a single foreground process —
  esbuild (watch + rebuild) and the static file server are started
  together by `build.js`. No ordering concerns.
- **Process ownership:** runs in the foreground; `restart.sh` records its
  wrapper PID in ignored `.route-plotter-dev.pid` and removes it at shutdown;
  no log files are written. The tree is `npm run dev` → `node build.js --watch` → an
  esbuild service child that binds port 3000. A clean stop must kill the
  `node build.js --watch` parent, not just the port listener, or the
  watcher is orphaned (see decision-log 2026-06-17).
- **Env / secrets:** none. No `.env`, no API keys — the app runs
  entirely in the browser.
- **Generated output (safe to delete and rebuild):** `docs/` and the
  `version.json` build field, both produced by `build.js`. Never
  hand-edit them (see Files agents must not hand-edit below).
- **Health / readiness:** the app is *ready* — not merely launched —
  when `http://localhost:3000` loads with no console errors and the
  version stamp renders. A blank page or console error means not-ready.
- **Recovery playbook** — server wedged or port stuck. One command stops any
  running dev server, reboots, and waits for HTTP 200:

```bash
./scripts/restart.sh             # stop dev server, reboot, verify readiness
```

  Manual equivalent for a server you launched in the current terminal:

```bash
Ctrl-C                           # stop that foreground server tree
npm run dev                      # reboot to a ready state
# then hard-refresh the browser (Cmd+Shift+R) — no HMR
```

  If the wrapper reports a foreign port holder, inspect the PID with the
  commands in Dev server above and stop it explicitly only when you own it.

- **Exposure:** local only by default (`localhost`). There is no public
  tunnel or LAN mode; publishing is a separate, explicit `npm run push`
  (see Deployment below).

---

## Build system

- **Bundler:** esbuild (via custom `build.js`)
- **Entry points:** `src/main.js` → `docs/app.js` (the app) and
  `src/player/playerEntry.js` → `docs/player.js` (the exported-HTML
  player bundle, IIFE; HTMLExportService fetches and inlines it into
  every export, so it must ship alongside the app). Both build in
  watch and production modes.
- **Output directory:** `docs/` (also serves as GitHub Pages root)
- **Format:** ESM
- **Source maps:** Enabled in both dev and production
- **Minification:** Production builds only
- **Static files:** an explicit allowlist in `build.js` copies `index.html`,
  the six shipped stylesheets, and the six built-in example images. Production
  output is assembled in a same-filesystem staging directory, checked for
  missing local references, then swapped into `docs/`; stale or accidental
  files cannot survive from an older build.

The output directory is **read-only** — never hand-edit files in it.
They are overwritten on every build.

---

## Version management

Format: `major.minor.build` (e.g. `3.1.530`)

| Component | Source | Updated |
| --- | --- | --- |
| `major.minor` | `package.json` version field | Manually, for features or breaking changes |
| `build` | `version.json` build field | Automatically, once per dev session start or `npm run build` |

The combined version is injected at build time via esbuild `define`
as `APP_VERSION`. It is a compile-time constant.

| Change type | Build number increments? |
| --- | --- |
| Edit JS in `src/` | No — only on next dev restart or build |
| Edit CSS/HTML | No (static copy, not a JS rebuild) |
| Restart dev server | Yes (once per session) |
| `npm run build` | Yes |
| `npm run build:check` | No |

Do not edit `version.json` manually — the build script manages it.
Bump `major.minor` in `package.json` when shipping a new feature or
breaking change.

---

## Deployment

- **Target:** GitHub Pages served from `/docs` on the selected branch. The live
  site currently selects `main`; a review branch can be selected for a Pages
  preview without changing the helper.
- **Pipeline:** first commit all source changes, then run `npm run push`. The
  helper requires a clean tree, runs tests, creates and validates a fresh
  production output, permits only `docs/` and `version.json` to change, commits
  those generated files, and pushes the current branch to the same remote ref.
- **Custom message:** `npm run push -- "custom msg"`
- **Dry run:** `npm run push:dry-run`
- **Live URL:** <https://djdaojones.github.io/route-plotter/> (Pages enabled 2026-08-19, Phase 5; the frozen v2 line stays at <https://djdaojones.github.io/router-plotter-02/>)

---

## Utility scripts

- **`push.js`** — argv-safe, current-branch GitHub Pages helper with a clean-tree
  gate and generated-file allowlist.
- **`build.js`** — esbuild bundler with version management, explicit static
  allowlist, checked staging/publish, non-mutating check mode, and dev server.

### Maintainer shell scripts (`scripts/`)

Thin, run-from-anywhere wrappers around the npm scripts above. Run them as
`./scripts/<name>.sh` (or `bash scripts/<name>.sh` if the executable bit is
lost to OneDrive sync). See `scripts/README.md`.

- **`scripts/restart.sh`** — clean restart/boot: stops only the process tree
  recorded for this checkout (graceful TERM→KILL), refuses an unrelated
  listener on port 3000, then boots `npm run dev` and polls
  until `http://localhost:3000` returns HTTP 200 before reporting ready.
  Foreground; Ctrl-C stops it cleanly. `--hard-reset` also deletes `docs/`
  (regenerated on boot); `--help` for usage. This is the scripted form of the
  Recovery playbook above.
- **`scripts/build.sh`** — one-shot `npm run build` into `docs/`; `--test`
  also runs the suite; `--help` for usage.

### Performance harness (`scripts/perf-harness.js`)

Re-runs the PERF-01 cost curve on demand. **It has no pass/fail threshold and
is not part of the quality gate**: frame timings depend on the machine, the
browser and the render surface, so a committed threshold would fail on one
laptop and pass on another with identical code. Run it before and after an
optimisation and compare the two tables yourself.

1. `npm run dev`, open <http://localhost:3000>, and open a project.
2. Paste the whole file into the browser console.
3. `await routePlotterBenchmark()`.

It backs up the project, measures on synthetic ones, restores the backup and
**disables autosave until you reload** — reload before authoring again. That
suppression is load-bearing: without it the still-running app saves the
synthetic benchmark project straight over the real one.

`medianMs` is the typical cost of one `render()`; `p95Ms` is the slow tail,
which is what actually breaks the feel of dragging a waypoint. 16.7 ms is a
60fps frame budget.

**Baseline (2026-08-28, production Chromium, 1280x720):** waypoint count is
the only dimension that costs frame time — 200 waypoints 1.9/3.7 ms, 500
7.2/15.6 ms, 1,000 18.1/56.6 ms, 2,000 (`MAX_WAYPOINTS`) 65.2/195.8 ms.
5,000 dots (the per-emitter maximum) cost ~1 ms. Image resolution costs no
frame time at all — 1 MP and 48 MP both render in ~0.2 ms — only memory
(48 MP is 183 MiB decoded) and import time. Full tables in the decision log,
2026-08-28.

---

## Configuration strategy

- **Constants:** `src/config/constants.js` — all tuneable values
  (animation, rendering, interaction, path, motion, text labels,
  video export, area highlight, storage). Grouped by domain. Check
  this file before adding any new hard-coded value.
- **Design tokens:** `styles/tokens.css` — CSS custom properties for
  colours, spacing, and theming (UoN palette + Okabe-Ito map palette).
- **Keybindings:** `src/config/keybindings.js` — all mouse and
  keyboard shortcuts. Customisable at runtime via localStorage.
- **Help content:** `src/config/helpContent.js` — welcome modal and
  inline help HTML generators.
- **Tooltips:** `src/config/tooltips.js` — tooltip definitions.

Do not scatter configuration across service files. If a value might
need tuning, it belongs in the constants file.

### Imported-project safety budgets

Untrusted project and image ceilings live beside the boundary they protect:
`PROJECT_MODEL_LIMITS` in `src/app/persistence.js`, archive budgets in
`ImageAssetService.js`, image budgets in `ImageAsset.js`, and aggregate
scene/flow/emitter budgets in their model files. Import stages and decodes a
detached candidate before commit. Keep those limits finite, cover increases
with adversarial tests, and document user-visible changes in `README.md`.

Autosave is capped at a 4 MiB serialized snapshot. It includes background and
custom assets only while they fit, reports real storage failures, and flushes
pending state on `pagehide`; a manual project ZIP remains the durable format.

---

## Editor config

The project root contains `.editorconfig`:

- UTF-8 encoding, LF line endings
- 2-space indentation for all files
- Trailing whitespace trimmed (except in markdown)
- Single quotes in JavaScript
- 120 char max line length for JS/HTML/CSS, 80 for markdown

---

## Files agents must not hand-edit

- `docs/` — build output, overwritten on every build.
- `_Joe/` — personal dev notes, design docs, helper scripts.
- `version.json` — managed by the build script.
- `node_modules/` — managed by npm.

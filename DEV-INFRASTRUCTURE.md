# Dev Infrastructure

This file defines the permanent rules for how Route Plotter is built,
run, tested, versioned, and shipped. `AGENTS.md` references this file.
Read it before any task that involves the build system, dev server,
scripts, configuration, or deployment.

---

## Package management

Package manager: **npm**

- `package.json` lives in the project root.
- **One runtime dependency: `mediabunny`** (MP4/WebM mux layer).
  Do not add runtime packages without explicit approval.
- **Dev dependencies** (esbuild, vitest, jsdom) are established.
  New dev dependencies can be added when justified.
- Run `npm install` after cloning. Do not commit `node_modules/`.

---

## Canonical scripts

| Script | Command | Purpose | When to use |
| --- | --- | --- | --- |
| `dev` | `node build.js --watch --serve` | Dev server with watch | Day-to-day development |
| `build` | `NODE_ENV=production node build.js` | Production build (minified, sourcemap) | Before deploy |
| `build:deploy` | `npm run build` | Alias of `build` — outputs straight to `docs/` (the GitHub Pages dir) | When deploying |
| `test` | `vitest run --pool=threads --no-file-parallelism` | Run tests once | After every change |
| `test:watch` | `vitest watch --pool=threads --no-file-parallelism` | Tests in watch mode | During development |
| `push` | `node push.js` | Build, stage, commit, push | When ready to ship |

Do not add scripts without updating this table.

> **Why the threads pool?** Vitest's default `forks` pool times out
> starting its worker in this OneDrive-synced workspace path and
> silently reports "no tests" with exit 0 — a false green. The
> `threads` pool with `--no-file-parallelism` runs reliably (57/57).
> See decision-log 2026-06-16.

---

## Dev server

- **URL:** `http://localhost:3000`
- **Start:** `npm run dev`
- **Serves:** Build output from `docs/` (esbuild rebuilds JS on
  change; CSS and HTML are watched and copied)
- **No hot-module replacement.** After any change, hard-refresh
  (`Cmd+Shift+R`).

Port 3000 already in use:

```bash
lsof -i :3000          # find the PID
kill -9 <PID>          # terminate it
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
| Reboot | `./scripts/restart.sh` (or `Ctrl-C`, then `npm run dev`) | Stop the watcher and start fresh (also bumps the build number); the script stops any prior dev server (the port-3000 listener **and** its `node build.js --watch` parent) and verifies readiness. |
| Build | `npm run build` (or `./scripts/build.sh`) | One-off production build into `docs/` (no server). |
| Test | `npm test` | Run the vitest suite once. |

- **Dev URL / port:** `http://localhost:3000` (see Dev server above).
- **Components & startup order:** a single foreground process —
  esbuild (watch + rebuild) and the static file server are started
  together by `build.js`. No ordering concerns.
- **Process ownership:** runs in the foreground; no background PIDs or
  log files. The tree is `npm run dev` → `node build.js --watch` → an
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

  Manual equivalent, if you prefer the individual steps:

```bash
pkill -f 'build.js --watch'      # stop the dev server (node watcher + esbuild child)
lsof -ti :3000 | xargs kill -9   # free the port if anything still holds it
npm run dev                      # reboot to a ready state
# then hard-refresh the browser (Cmd+Shift+R) — no HMR
```

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
- **Static files:** `index.html`, `styles/*.css`, and `images/` are
  copied to the output directory by the build script.

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

Do not edit `version.json` manually — the build script manages it.
Bump `major.minor` in `package.json` when shipping a new feature or
breaking change.

---

## Deployment

- **Target:** GitHub Pages (served from `docs/` on `main` branch)
- **Pipeline:** `npm run push` — runs build, stages `docs/` and
  `version.json`, commits with version-stamped message, pushes to
  `origin/main`.
- **Custom message:** `npm run push "custom msg"`
- **Dry run:** `npm run push --dry-run`
- **Live URL:** <https://djdaojones.github.io/route-plotter/> (Pages enabled 2026-08-19, Phase 5; the frozen v2 line stays at <https://djdaojones.github.io/router-plotter-02/>)

---

## Utility scripts

- **`push.js`** — GitHub Pages deploy helper. Runs production build,
  stages changes, commits, and pushes. Safe for routine deploys.
- **`build.js`** — esbuild bundler with version management, static
  file copying, and dev server.

### Maintainer shell scripts (`scripts/`)

Thin, run-from-anywhere wrappers around the npm scripts above. Run them as
`./scripts/<name>.sh` (or `bash scripts/<name>.sh` if the executable bit is
lost to OneDrive sync). See `scripts/README.md`.

- **`scripts/restart.sh`** — clean restart/boot: stops any running dev server —
  the port-3000 listener **and** its `node build.js --watch` parent (graceful
  TERM→KILL), so no watcher is orphaned — then boots `npm run dev` and polls
  until `http://localhost:3000` returns HTTP 200 before reporting ready.
  Foreground; Ctrl-C stops it cleanly. `--hard-reset` also deletes `docs/`
  (regenerated on boot); `--help` for usage. This is the scripted form of the
  Recovery playbook above.
- **`scripts/build.sh`** — one-shot `npm run build` into `docs/`; `--test`
  also runs the suite; `--help` for usage.

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

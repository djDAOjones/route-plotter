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
- **Dev dependencies** (`devDependencies` in `package.json`: the build, test
  and accessibility-audit tools) are established.
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
| `start` | `node build.js --watch --serve` | Same as `dev` | — |
| `build` | `NODE_ENV=production node build.js` | Production build (minified, sourcemap) | Before deploy |
| `build:deploy` | `npm run build` | Alias of `build` — outputs straight to `docs/` (the GitHub Pages dir) | When deploying |
| `build:check` | `NODE_ENV=production node build.js --check` | Validate a temporary production build without changing `docs/` or `version.json` | CI / close-out |
| `check` | `npm test && npm run test:shell && npm run build:check` | Canonical JS, maintainer-script and build gate | Before commit |
| `test` | `vitest run --pool=threads --no-file-parallelism` | Run tests once | After every change |
| `test:shell` | `bash tests/restartSafety.test.sh` | Project-scoped dev-server PID/cleanup contract | After restart-script changes / in CI |
| `test:watch` | `vitest watch --pool=threads --no-file-parallelism` | Tests in watch mode | During development |
| `push:dry-run` | `node push.js --dry-run` | Show deployment commands without changing files or Git | Before deploy |
| `push` | `node push.js` | From a clean source commit: check, build, stage generated files, commit, push current branch | When ready to ship |
| `serve` | `python3 -m http.server 3000` | Static server of the whole repository, no build or watch: `/` is the source shell, which lacks the app bundle; `/docs/` is the built app (needs a working `python3`) | Not in use |
| `serve:dist` | `cd docs && python3 -m http.server 3000` | Static server of the built `docs/`, no watch (needs a working `python3`) | Viewing a built copy |

Do not add scripts without updating this table.

> **Why the threads pool?** Vitest's default `forks` pool times out
> starting its worker in this OneDrive-synced workspace path and
> silently reports "no tests" with exit 0 — a false green. The
> `threads` pool with `--no-file-parallelism` runs reliably.
> See decision-log 2026-06-16.

---

## Quality gate

The one-command gate is `npm run check`: the Vitest suite, the restart-script
shell contract, then `build:check` (rows in Canonical scripts above). It is
non-mutating, so run it after every change and at task close.

- `build:check` builds production output into a temporary directory,
  validates it (file inventory, local references, stylesheet version stamps)
  and discards it. It never writes `docs/` or `version.json`.
- CI runs the same command on every push and pull request (the **Verify**
  workflow, `.github/workflows/ci.yml`), then fails if `docs/` or
  `version.json` differ from the commit.
- There is no linter, formatter check, type checker or Markdown link checker,
  so report only what the gate runs. The verify-line format is in
  `pm_skills/project/conventions.md` → Commit messages.
- `npm run dev`, `npm run build` and `./scripts/restart.sh` rewrite `docs/`
  and `version.json`, so none of them is a check.

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
| Reboot | `./scripts/restart.sh` (or `Ctrl-C`, then `npm run dev`) | Stop this checkout's recorded watcher tree and start fresh (also bumps the build number); refuse to kill an unrelated port holder; wait for HTTP 200. |
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
- **Generated output:** `docs/` and the `version.json` build field, both
  produced by `build.js`. Never hand-edit them (see Files agents must not
  hand-edit below). A deleted `docs/` is recovered with
  `git restore docs`; a dev build does not recreate the committed release
  output. Never delete `version.json`: the counter would restart, and the next
  build would write build 1.
- **Health / readiness:** the app is *ready* — not merely launched —
  when `http://localhost:3000` loads with no console errors and the
  version stamp renders. A blank page or console error means not-ready.
  `./scripts/restart.sh` proves only that the server answers (its `curl -f`
  request succeeds) and prints the served title's version when it finds one;
  the console and the rendered stamp need a browser.
- **Close-out boot check** (`pm_skills/prompts/end-of-task.md` step 2): run
  `npm run check`. Its `build:check` proves the production build without
  touching tracked files, but not readiness: when a task changed what the app
  does at runtime, check readiness as above or report it as not verified. An
  interactive boot (`npm run dev` or `./scripts/restart.sh`) rewrites
  `docs/`, bumps `version.json` and leaves an untracked
  `docs/player.js.map`. Before committing, stop that server (the watcher
  would rewrite them again), run `git restore docs version.json` and delete
  the map.
- **Recovery playbook** — server wedged or port stuck. One command stops any
  running dev server, reboots, and waits for HTTP 200:

```bash
./scripts/restart.sh             # stop dev server, reboot, wait for HTTP 200
```

  Manual equivalent for a server you launched in the current terminal:

```bash
Ctrl-C                           # stop that foreground server tree
npm run dev                      # reboot; then check readiness as above
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
- **Source maps:** the app bundle in dev and production; the player bundle in
  dev only (the untracked `docs/player.js.map`)
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
  site selects `main` — restored at the v3.2.690 release on 2026-09-22. From
  2026-08-26 to that release it selected `review-remediation`, so every push to
  that branch deployed publicly while this file said otherwise. **What is live
  is whatever the Pages source says**, never an inference from git refs:
  `gh api repos/djDAOjones/route-plotter/pages --jq .source` and
  `gh api repos/djDAOjones/route-plotter/pages/builds/latest --jq .commit`.
  Selecting a review branch for a preview makes that branch the public site.
- **Pipeline:** first commit all source changes, then run `npm run push`. The
  helper refuses unknown options, requires a clean tree, runs `npm run check`,
  creates and validates a fresh production output, permits only `docs/` and
  `version.json` to change, commits those generated files, and pushes the
  current branch to the same remote ref.
- **Custom message:** `npm run push -- "custom msg"`
- **Dry run:** `npm run push:dry-run`
- **Working setup** (GOV-01; owner's answers to the abstraction plan's §20 Q1
  and Q2, 2026-09-22): work in a fresh full clone outside OneDrive — a plain
  `git clone`, not `--single-branch`, which tracks only one branch — then
  `nvm use` and `npm ci`. Make one short-lived branch from `main` per
  concern, named for its item (e.g. `w0/def-18-push-flags`); run
  `npm run check`; push the branch; open a pull request; and wait for
  **Verify** to pass on it. The owner decides each merge (squash, keeping the
  `<ITEM-ID>: summary` title); the agent rules are `AGENTS.md` → Commit, push
  and release. The OneDrive checkout stays the owner's: update it only by
  fast-forward, and only when it is clean.
- **A merge does not release source changes.** Every push to `main` rebuilds
  Pages, but from the committed `docs/`, which only `npm run push` changes;
  merged source goes live at the next release, which the owner calls. So a
  pull request must never change `docs/` or `version.json`: check its diff
  before merging.
- **Releasing** (when the owner calls it). Where
  `pm_skills/prompts/deploy.md` differs, these steps win: it builds and tags
  before deploying, but here the helper builds, and the tag goes on the deploy
  commit the helper creates.
  1. In a Working-setup clone, on a clean `main` that matches `origin/main`,
     confirm the Pages source is `main` `/docs` and the latest Pages build
     has status `built` at the SHA you expect (commands under Target); stop
     if either differs. That live SHA needs a pushed rollback tag: if it has
     none, add an annotated tag at that exact SHA. Existing tags never move.
  2. `npm run check`, then `npm run push:dry-run`. Do not build, bump the
     version or tag first: the helper builds, and a prior build dirties the
     tree.
  3. `npm run push`, and note the deploy commit's SHA.
  4. Pages starts building on that push, so **Verify** on the deploy commit
     confirms the release rather than gating it. Wait for it.
  5. Confirm the `github-pages` deployment reached that SHA, and compare the
     published files by SHA-256 against `docs/`. Load the live site to a
     ready state (Runtime lifecycle → Health / readiness; the page title shows
     the version), play a built-in example, and export it as MP4 and HTML.
  6. If any check in steps 4–5 fails, roll back (below) and check the
     restored site the same way.
  7. Tag the deploy commit `v<major>.<minor>.<build>`, from `package.json`
     and the `version.json` that the push committed (e.g. `v3.2.691`), as an
     annotated tag at that SHA, and push that one tag.
  8. Record the release in project memory through a `PM:` pull request.
- **Changing the Pages source does not trigger a build.** Switching it through
  the API left the old artefact live; `gh api -X POST
  repos/djDAOjones/route-plotter/pages/builds` requested one. Pushes to the
  selected branch do trigger builds.
- **Rollback:** point Pages at a branch holding the last good tag (`v3.2.689`
  is `587f90a`), request a build, and confirm the deployment SHA. A revert of a
  merge alone does not restore matching generated artefacts.
- **Main is protected** (REL-02): a repository ruleset blocks force-pushes and
  deletion of `main`, with no bypass. Ordinary fast-forward pushes — including
  `npm run push` — are unaffected; a rollback never rewrites main.
- **OneDrive:** the owner's checkout lives in OneDrive, which can evict tracked
  files and `.git` internals to online-only; git then fails with
  `mmap failed: Operation timed out`. That is why work and releases run from a
  fresh clone outside it (Working setup above).
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
- **Keybindings:** `src/config/keybindings.js` — see `README.md` →
  Keybindings for what it does and does not control.
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

Autosave's contents, 4 MiB cap and failure behaviour are in `README.md` →
Auto-save; a manual project ZIP remains the durable format.

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

---

## Framework section aliases

The vendored `pm_skills/` workflows name `DEV-INFRASTRUCTURE.md` sections by
their template titles. These have no section of their own here:

- **Security baseline** → no runtime secrets are required (Runtime lifecycle
  → Env / secrets); untrusted-input limits are in Imported-project safety
  budgets; vulnerability reports follow `.github/SECURITY.md`. If a
  credential is ever exposed, stop the release and tell the owner, who
  revokes or rotates it before any history cleanup.
- **Maintainer diagnostics** → `src/services/DiagnosticsService.js` builds a
  redacted environment snapshot, and `src/app/privacy.js` previews it before
  anything is copied, downloaded or reported (`UI-STANDARDS.md` → Framework
  section aliases). It is not an event log: there is no structured logger or
  console capture, so report a workflow's logger step as not applicable.
- **Traceable version identity** → Version management. The identity is
  `major.minor.build`, which diagnostics report as `appVersion`; there is no
  commit-derived `buildId`, so a release ties the build number to its commit
  with a tag (Deployment).

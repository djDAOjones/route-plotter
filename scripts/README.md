# Maintainer scripts

Convenience wrappers for running and building Route Plotter. They can be run
from any directory and resolve the project root themselves.

If the executable bit is ever lost (e.g. via OneDrive sync), run them with
`bash` instead, e.g. `bash scripts/restart.sh`.

## `restart.sh` — clean restart / boot

Stops this checkout's running dev server, boots it (`npm run dev`), and waits until
`http://localhost:3000` actually answers HTTP 200 before reporting ready.
Stopping targets the recorded process tree, so no watcher is left orphaned.
An unrelated process listening on port 3000 is reported and left untouched.

```bash
./scripts/restart.sh              # stop dev server, boot, verify readiness
./scripts/restart.sh --hard-reset # also delete docs/ (regenerated on boot)
./scripts/restart.sh --help
```

- Stops only this project's recorded dev tree — never a broad `pkill node` and
  never a process merely because it owns port 3000.
- Records ownership in ignored `.route-plotter-dev.pid` and removes the file on
  shutdown.
- `--hard-reset` deletes only `docs/` (build output). Source files,
  `version.json`, and `_Joe/` are never touched.
- Runs in the foreground; Ctrl-C stops the server cleanly.
- No hot reload — hard-refresh the browser (Cmd+Shift+R) after it boots.

## `build.sh` — production rebuild

```bash
./scripts/build.sh         # production build into docs/
./scripts/build.sh --test  # build, then run the test suite
./scripts/build.sh --help
```

## `perf-harness.js` — performance cost curve

Not a shell script and not wired into any npm script: paste it into the
browser console against a running dev server, then call
`await routePlotterBenchmark()`.

It prints how render cost scales with waypoint count, crowd size and image
resolution. **There is no pass/fail threshold and it is not part of the
quality gate** — timings are machine-dependent, so compare your own before and
after rather than trusting an absolute number.

It backs up the open project, measures on synthetic ones, restores the backup
and disables autosave until you reload. Reload before authoring again.

See `DEV-INFRASTRUCTURE.md` → "Performance harness" for the recorded baseline.

See `DEV-INFRASTRUCTURE.md` (project root) for the full build / run / deploy
reference and the canonical npm scripts these wrap.

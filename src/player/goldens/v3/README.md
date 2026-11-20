# v3's frames of v4's golden scenes

These files are v3's own recordings, a fixture nothing regenerates (CORE-04, D159). They were made from `v3/` at `858b0cf`, the last commit to touch `v3/`, in a scratch copy outside the repository: `git archive HEAD v3 | tar -x -C <scratch>/v3copy`, then `npm ci --ignore-scripts` in `<scratch>/v3copy/v3`.
The recorder below goes in the copy's `tests/` and runs as `V3_FRAMES_OUT=<scratch>/v3copy/v3frames V3_COMMIT=858b0cf npx vitest run tests/V3-FRAMES-45-record.test.js` (about 2 s a scene); it records all five scenes.
For each scene it boots v3's app, takes v3's default project (`_buildProjectSnapshot`), sets the waypoints from `Waypoint.createMajor` / `createMinor` with their labels and the line's `pathVisibility` (grows show-on-progression, shrinks hide-on-progression, trail instantaneous, hidden always-hide, branch-whole always-show), exports at 1920 × 1080, loads a 400 × 300 picture and enters export mode, then writes each drawing call at 0, ¼, ½, ¾ and all of v3's own length.
`src/player/goldensV3.test.ts` reads only the `*.txt` files here, so this file is no scene's.

```js
// CORE-04 stage 7 (sub-chat 43's recorder; sub-chat 46 added the forking scene branch-whole): v3's own frames of v4's golden scenes, recorded by v3's unchanged code
// in a scratch copy of `v3/` (git archive of the branch's head), never inside the repository. Each scene is built as a
// v3 project from v3's own defaults (the app's `_buildProjectSnapshot` on a fresh boot, waypoints from
// `Waypoint.createMajor` / `createMinor`), on a picture of 400 × 300 (jsdom's Image stub, 100 × 100 in setup.js, is
// replaced in this file alone), drawn in export mode at 1920 × 1080 as goldenDrawLogs.test.js enters it, at progress 0,
// ¼, ½, ¾ and 1 of v3's own length, with each call's drawn state. Text goes to V3_FRAMES_OUT.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { frameAt, setUpFrame } from './helpers/drawLog.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadExampleBackground } from '../src/app/backgroundLoading.js';
import { Waypoint } from '../src/models/Waypoint.js';

const OUT = process.env.V3_FRAMES_OUT;
const COMMIT = process.env.V3_COMMIT ?? 'unknown';
const INSTANTS = [0, 0.25, 0.5, 0.75, 1];
const NAMES = ['the start', 'a quarter', 'the middle', 'three quarters', 'the end'];

vi.stubGlobal('Image', class {
  constructor() { setTimeout(() => this.onload && this.onload(), 0); }
  set src(value) { this._src = value; }
  get src() { return this._src; }
  width = 400; height = 300; naturalWidth = 400; naturalHeight = 300;
});

const stop = (x, y, label) => ({ ...Waypoint.createMajor(x, y).toJSON(), ...(label ? { label } : {}) });
const bend = (x, y) => Waypoint.createMinor(x, y).toJSON();
const STOPS = () => [stop(0.2, 0.7, 'Start'), bend(0.35, 0.3), stop(0.55, 0.5, 'Middle'), stop(0.8, 0.35, 'End')];

// branch-whole, as v4's golden has it: a stop, a bend, the stop where the route forks, then a stop each way, drawn whole.
// In v3 the first four are the trunk; the fifth is a branch of one waypoint forking from the third
// (v3/src/models/Waypoint.js:23–31: branchId on the branch, branchFrom on its first waypoint, no branchRejoin, so it
// ends by itself). Ids are given so branchFrom can name the third; no labels, as v4's scene has none.
const at = (id, waypoint, extra = {}) => ({ ...waypoint.toJSON(), id, ...extra });
const FORK = () => [
  at('wp-1', Waypoint.createMajor(0.15, 0.5)), at('wp-2', Waypoint.createMinor(0.4, 0.3)),
  at('wp-3', Waypoint.createMajor(0.55, 0.5)), at('wp-4', Waypoint.createMajor(0.85, 0.3)),
  at('wp-5', Waypoint.createMajor(0.8, 0.75), { branchId: 'br-1', branchFrom: 'wp-3' }),
];

const SCENES = {
  grows: { waypoints: STOPS, pathVisibility: 'show-on-progression' },
  shrinks: { waypoints: STOPS, pathVisibility: 'hide-on-progression' },
  trail: { waypoints: STOPS, pathVisibility: 'instantaneous' },
  hidden: { waypoints: STOPS, pathVisibility: 'always-hide' },
  'branch-whole': { waypoints: FORK, pathVisibility: 'always-show' },
};

async function appWith(scene) {
  const app = await bootApp();
  await app.ready;
  const snapshot = app._buildProjectSnapshot({ includeAssets: false });
  snapshot.waypoints = scene.waypoints();
  snapshot.motionSettings.pathVisibility = scene.pathVisibility;
  snapshot.exportSettings.resolutionX = 1920;
  snapshot.exportSettings.resolutionY = 1080;
  expect(await loadCurrentSnapshot(app, snapshot)).toBe(true);
  const background = buildExampleProjects()[0].backgroundSource;
  expect(await loadExampleBackground(app, `./${background}`, { autoSave: false })).toBe(true);
  expect([app.background.image.naturalWidth, app.background.image.naturalHeight]).toEqual([400, 300]);
  app.exportSettings.resolutionX = 1920;
  app.exportSettings.resolutionY = 1080;
  app.invalidateAnimationTiming();
  app._setPreviewMode(true);
  app.invalidateAnimationTiming();
  app._enterExportMode(1920, 1080);
  setUpFrame(app);
  return app;
}

for (const [name, scene] of Object.entries(SCENES)) {
  test(`v3 records ${name}`, async () => {
    const app = await appWith(scene);
    const length = app.animationEngine.state.duration;
    const sections = INSTANTS.flatMap((instant, i) => {
      const frame = frameAt(app, instant, { state: 'drawn' });
      return [`# ${NAMES[i]}: progress ${instant}, ${Math.round(instant * length)} ms of ${Math.round(length)}`, ...frame];
    });
    const head = [
      `# v3's own recording of the scene "${name}", by v3's unchanged code at commit ${COMMIT} of v3/, in export mode at`,
      `# 1920 x 1080, with ${name === 'branch-whole' ? 'V3-FRAMES-45' : 'V3-FRAMES-43'}-record.test.js (kept in the lane folder). A fixture: nothing regenerates it in CI.`,
    ];
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${name}.txt`), `${[...head, ...sections].join('\n')}\n`);
  });
}
```

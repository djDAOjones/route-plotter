/**
 * TST-09 — golden dot positions, characterised as they stand.
 *
 * `swarmEngine.test.js` pins the hash every dot's variation comes from
 * (`SwarmEngine.hash`, exact values) and the engine's own rules on handmade
 * layers. This pins what those draws become in the booted app: every dot the
 * renderer draws at chosen instants, as `evaluate` gives it to `DotRenderer`,
 * on a network crowd and on route-following crowds, one free and one bound
 * to a route moment, on a branched route and a linear one
 * (`tests/goldens/domains-dots.json`, rounded to a millionth of the image).
 *
 * Then the deterministic-timeline contract for dots: playing to an instant
 * draws exactly the dots a seek draws, on the host that played and on a host
 * that never did, and a video export's frame draws what the editor draws at
 * its instant, except where DEF-79 says it does not: on a linear route a
 * crowd bound to a route moment is released by arrivals measured again in
 * the export's pixels, while the waits stay fixed, so its dots move. That
 * case is pinned as it stands; DEF-79's fix makes the export agree.
 *
 * Which fixes move the golden: DEF-12 (the anchored releases, measured in
 * route time against the engine's base timeline), DEF-05 (none here: the
 * route guide is the trunk), CROWD-05 follow-ups (F).
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { Scene } from '../src/models/Scene.js';
import { VideoExporter, createVideoFramePlan } from '../src/services/VideoExporter.js';
import { domainGolden, durationsOf, exampleProject, openProject, rounded } from './helpers/domainGoldens.js';

const pin = domainGolden('dots');

const FRAME_MS = 40;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A route-guided layer: a free respawning crowd that sways, and a small one
 * released when the head leaves `anchorId` that parks at the route's end.
 */
function walkers(anchorId) {
  const scene = new Scene();
  const layer = scene.addFlowLayer({ id: 'walkers', name: 'Walkers', guideType: 'route' });
  layer.addEmitter({
    id: 'walk-free', seed: 11, dotCount: 12, speed: 0.08, speedVariance: 0.3, wobble: 0.4,
    lifecycleMode: 'respawn', releaseStart: 0.05, releaseDuration: 0.5, onsetVariance: 0.5,
  });
  layer.addEmitter({
    id: 'walk-anchored', seed: 12, dotCount: 6, speed: 0.1, speedVariance: 0.2,
    lifecycleMode: 'collect', releaseAnchor: { waypointId: anchorId, at: 'pause-end' },
    releaseDuration: 0.2, onsetVariance: 0.3,
  });
  return scene.toJSON().flowLayers[0];
}

/**
 * `branched`: the Open day example, with its traced network crowd (60 dots
 * released when the head reaches the first waypoint, ending at the Library)
 * and the walkers, bound to waypoint 2's departure. `linear`: the aerial
 * walk with the walkers bound to its waypoint 2.
 */
const FIXTURES = {
  branched: () => {
    const project = exampleProject('uon-open-day');
    project.scene.flowLayers.push(walkers('ex-uon-2'));
    return project;
  },
  linear: () => {
    const project = exampleProject('parm-aerial-walk');
    project.scene.flowLayers.push(walkers('ex-parm-2'));
    return project;
  },
};

/** Fractions of F the golden is taken at, each moved onto the 40 ms frame grid. */
const FRACTIONS = [0.05, 0.15, 0.3, 0.45, 0.6, 0.8, 0.95];

function instantsFor(app) {
  const { F } = durationsOf(app);
  return FRACTIONS.map(fraction => Math.round((F * fraction) / FRAME_MS) * FRAME_MS);
}

/** What the renderer draws of the crowds in one frame, read off the evaluator it calls. */
function drawn(app, move) {
  const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
  try {
    move();
    app.render();
    return {
      ms: app.animationEngine.state.currentTime,
      durations: evaluate.mock.calls.map(call => call[2].durationMs),
      dots: evaluate.mock.results.flatMap(result => result.value),
    };
  } finally {
    evaluate.mockRestore();
  }
}

const seekDrawn = (app, ms) => drawn(app, () => app.animationEngine.seekToTime(ms));

/** Dots grouped by emitter as `[dotIndex, x, y]`, in draw order. */
function byEmitter(dots) {
  const groups = {};
  for (const dot of dots) (groups[dot.emitterId] ??= []).push([dot.dotIndex, dot.x, dot.y]);
  return groups;
}

for (const name of Object.keys(FIXTURES)) {
  describe(`dots — ${name} route`, () => {

    test('golden: every dot drawn at seven instants across the timeline, and at F', async () => {
      const app = await openProject(FIXTURES[name]());
      const { B, F, parts } = durationsOf(app);
      const frames = {};
      for (const ms of [...instantsFor(app), F]) {
        const frame = seekDrawn(app, ms);
        // Releases are fractions of the base timeline (CROWD-05).
        expect(frame.durations.every(duration => duration === B)).toBe(true);
        frames[`t${Math.round(ms)}`] = byEmitter(frame.dots);
      }
      const anchors = app.getRouteArrivalMap();
      pin(`${name}.golden`, rounded({
        B, F, parts,
        routeAnchors: { totalDurationMs: anchors.totalDurationMs, arrivalMsById: anchors.arrivalMsById },
        frames,
      }));
    });

    test('play == seek: playing frame by frame draws the dots a seek draws, on the same host and a fresh one', async () => {
      const app = await openProject(FIXTURES[name]());
      const instants = instantsFor(app);
      const played = new Map();
      app.animationEngine.seekToTime(0);
      app.render();
      app.animationEngine.play();
      while (played.size < instants.length) {
        const frame = drawn(app, () => app.animationEngine.updateAnimation(FRAME_MS, 0));
        if (instants.includes(frame.ms)) played.set(frame.ms, frame.dots);
      }
      app.animationEngine.pause();

      // Seeks in reverse order, so each follows a later instant.
      const fresh = await openProject(FIXTURES[name]());
      for (const ms of [...instants].reverse()) {
        expect(seekDrawn(app, ms).dots, `${ms} ms, same host`).toEqual(played.get(ms));
        expect(seekDrawn(fresh, ms).dots, `${ms} ms, fresh host`).toEqual(played.get(ms));
      }
    });

    test('export: a video export\'s frames draw what the editor draws at their instants, but for DEF-79', async () => {
      const app = await openProject(FIXTURES[name]());
      const editorF = durationsOf(app).F;
      vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
      vi.stubGlobal('alert', vi.fn());
      const exported = [];
      let exportF = null;
      app.videoExporter = {
        cancel() {},
        async export({ frameRate, duration, startBuffer, renderFrame }) {
          exportF = duration;
          const plan = createVideoFramePlan({ frameRate, duration, startBuffer });
          for (const fraction of [0.2, 0.5, 0.8]) {
            const sample = plan.sampleAt(plan.startBufferFrames + Math.round(fraction * (plan.animationFrames - 1)));
            // `renderFrame` seeks and renders, as the export does each frame.
            const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
            await renderFrame(sample.progress);
            exported.push({
              ms: app.animationEngine.state.currentTime,
              dots: evaluate.mock.results.flatMap(result => result.value),
            });
            evaluate.mockRestore();
          }
          return new Blob(['video'], { type: 'video/mp4' });
        },
      };
      await app.exportVideo();
      expect(exported).toHaveLength(3);

      // The editor, opened afresh, at each exported instant.
      const editor = await openProject(FIXTURES[name]());
      const cases = [];
      for (const frame of exported) {
        const there = seekDrawn(editor, frame.ms);
        const exportedBy = byEmitter(frame.dots);
        const editorBy = byEmitter(there.dots);
        const agree = Object.fromEntries([...new Set([...Object.keys(exportedBy), ...Object.keys(editorBy)])]
          .map(emitter => [emitter, JSON.stringify(exportedBy[emitter]) === JSON.stringify(editorBy[emitter])]));
        if (name === 'branched') {
          // Branched arrivals come from the timeline composed in the editor's space.
          expect(frame.dots).toEqual(there.dots);
        } else {
          // DEF-79: the free crowd agrees; the one bound to a route moment does not, once released.
          expect(agree['walk-free']).toBe(true);
        }
        cases.push({ ms: frame.ms, agree, ...(Object.values(agree).every(Boolean) ? {} : { exported: exportedBy }) });
      }
      pin(`${name}.export`, rounded({ editorF, exportF, frames: cases }));
    });
  });
}

describe('dots — DEF-79, stated', () => {
  test('a linear route\'s anchored crowd: the video export releases it where the editor does not', async () => {
    const app = await openProject(FIXTURES.linear());
    const editorArrival = app.getRouteArrivalMap().arrivalMsById['ex-parm-2'];
    app._setPreviewMode(true);
    app._enterExportMode(app.exportSettings.resolutionX, app.exportSettings.resolutionY);
    try {
      // Measured again in export pixels, with the waits unchanged.
      expect(app.getRouteArrivalMap().arrivalMsById['ex-parm-2']).toBeGreaterThan(editorArrival * 2);
    } finally {
      app._exitExportMode();
    }
  });
});

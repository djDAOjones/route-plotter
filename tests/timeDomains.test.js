/**
 * TST-09 — the intro and tail time domains, characterised as they stand.
 *
 * The engine's clock runs through more than the route: a reveal mode's 1 s
 * intro before the head moves, in Preview a comet trail's tail after it
 * arrives, and since CROWD-05 the wait for crowds that finish after the base
 * timeline B, up to the playback duration F. This pins what the scene
 * evaluates to at the edges of those domains, on the branched Open day route
 * (a branch from 2 that rejoins at 3), with its traced network crowd and a
 * route crowd bound to waypoint 2's departure:
 *
 *   t < 0 · t = 0 · the intro's end · the head reaching the fork · the
 *   tail's start · B · between B and F · F · t > F
 *
 * Each instant reads, from one render: the transport (time, progress, the
 * head, its wait, intro and tail flags, completion), each branch's progress,
 * how many dots each emitter draws, the comet's visible range, and each
 * beacon's state. Before 0 and after F, which a seek clamps away, and
 * between B and F, the pure evaluators are read too
 * (`PlayerCore.timelineToPath`, `evaluate`, `branchPathProgressAt`).
 *
 * Then play == seek == export: those states are identical whether reached by
 * playing frame by frame, by seeking on the same host or a fresh one, or by
 * a video export's frame at the same instant.
 *
 * Pinned in `tests/goldens/domains-time.json`. DEF-12 (route time read as
 * engine time: the branch starts and the bound crowds leave an intro early,
 * and late under a tail; `crowdArrival.test.js` states it on a linear route)
 * moves the intro and tail cases; CROWD-05 follow-ups move B and F. Two more
 * things the golden shows as they stand: under a reveal intro the traced
 * crowd, bound to the first waypoint's arrival, is already walking while the
 * head waits out the intro; and under the comet tail the trail has faded
 * during the final waypoint's 4.5 s wait, so the tail's visible range is
 * empty from its first instant.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { PlayerCore } from '../src/core/PlayerCore.js';
import { Scene } from '../src/models/Scene.js';
import { branchPathProgressAt } from '../src/utils/branchTiming.js';
import { VideoExporter, createVideoFramePlan } from '../src/services/VideoExporter.js';
import { domainGolden, durationsOf, exampleProject, openProject, rounded } from './helpers/domainGoldens.js';

const pin = domainGolden('time');

const FRAME_MS = 40;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const VARIANTS = {
  plain: {},
  intro: { backgroundVisibility: 'spotlight-reveal' },
  tail: { pathVisibility: 'instantaneous', pathTrail: 0.2 },
  introAndTail: { backgroundVisibility: 'spotlight-reveal', pathVisibility: 'instantaneous', pathTrail: 0.2 },
};

/** The Open day example in one motion variant, with a route crowd released as the head leaves 2. */
function fixture(variant) {
  const project = exampleProject('uon-open-day');
  project.motionSettings = { ...project.motionSettings, ...VARIANTS[variant] };
  const scene = new Scene();
  scene.addFlowLayer({ id: 'walkers', name: 'Walkers', guideType: 'route' }).addEmitter({
    id: 'walk-anchored', seed: 12, dotCount: 6, speed: 0.1, speedVariance: 0.2, lifecycleMode: 'collect',
    releaseAnchor: { waypointId: 'ex-uon-2', at: 'pause-end' }, releaseDuration: 0.2, onsetVariance: 0.3,
  });
  project.scene.flowLayers.push(scene.toJSON().flowLayers[0]);
  return project;
}

/** The timeline's parts, and the named instants at its domain edges. */
function domainsOf(app) {
  const engine = app.animationEngine;
  const { B, F, parts } = durationsOf(app);
  const intro = engine.introTime;
  const tail = engine.totalTailTime;
  const routeEnd = intro + engine.pathDuration + engine.totalPauseTime;
  const instants = {
    start: 0,
    introEnd: intro,
    reachesFork: intro + app.getRouteArrivalMap().arrivalMsById['ex-uon-2'],
    tailStart: routeEnd,
    B,
    betweenBAndF: (B + F) / 2,
    F,
  };
  return { B, F, parts, intro, tail, pathMs: engine.pathDuration, pausesMs: engine.totalPauseTime, instants };
}

/** A beacon as a frame draws it, the fields `goldenFrames.test.js` compares. */
function beaconState(beacon) {
  if (!beacon) return null;
  return {
    phase: beacon.phase ?? null,
    active: beacon.isActive(),
    completed: beacon.completed ?? null,
    started: beacon.started ?? null,
    scale: beacon.scale ?? null,
    radius: beacon.radius ?? null,
    opacity: beacon.opacity ?? null,
    rings: beacon.rings ? beacon.rings.map(ring => [ring.startTime, ring.opacity]) : null,
    subPhase: beacon.subPhase ?? null,
    loopTime: beacon.loopTime ?? null,
  };
}

/**
 * Watch one frame: what the renderer evaluates and draws while it is
 * watched, read back as the scene. `read` requires exactly one frame drawn
 * in that time, so a frame that was never drawn cannot pass as one.
 */
function watchScene(app) {
  const engine = app.animationEngine;
  const evaluate = vi.spyOn(app.swarmEngine, 'evaluate');
  const branches = vi.spyOn(app.renderingService, 'activeBranches');
  const ranges = vi.spyOn(app.motionVisibilityService, 'getPathVisibleRange');
  const frames = vi.spyOn(app.renderingService, 'render');
  return {
    read() {
      expect(frames, 'one frame drawn').toHaveBeenCalledTimes(1);
      const dots = {};
      for (const dot of evaluate.mock.results.flatMap(result => result.value)) {
        dots[dot.emitterId] = (dots[dot.emitterId] || 0) + 1;
      }
      const beacons = {};
      for (const waypoint of app.waypoints) {
        if (waypoint.isMajor && waypoint.beaconStyle !== 'none') {
          beacons[waypoint.id] = beaconState(app.renderingService.beaconRenderer.beacons.get(waypoint.id));
        }
      }
      return {
        ms: engine.state.currentTime,
        progress: engine.state.progress,
        head: engine.getPathProgress(),
        waiting: engine.state.isWaitingAtWaypoint ? engine.state.pauseWaypointIndex : -1,
        inIntro: engine.isInIntroTime(),
        introProgress: engine.getIntroProgress(),
        inTail: engine.isInTailTime(),
        tailElapsed: engine.getTailTimeElapsed(),
        complete: engine.isComplete(),
        branches: (branches.mock.results.at(-1)?.value || []).map(branch => [branch.id, branch.engine.getPathProgress()]),
        dots,
        visibleRanges: ranges.mock.results.map(({ value }) => [value.startProgress, value.endProgress, value.fadeStartProgress]),
        beacons,
      };
    },
    restore() {
      for (const spy of [evaluate, branches, ranges, frames]) spy.mockRestore();
    },
  };
}

/** The scene at the engine's instant after `move`, read from the one render that follows. */
function sceneAfter(app, move) {
  const watch = watchScene(app);
  try {
    move();
    app.render();
    return watch.read();
  } finally {
    watch.restore();
  }
}

/** The scene `draw` itself renders, read from that drawing with no redraw after it. */
async function sceneDrawnBy(app, draw) {
  const watch = watchScene(app);
  try {
    await draw();
    return watch.read();
  } finally {
    watch.restore();
  }
}

const sceneAt = (app, ms) => sceneAfter(app, () => app.animationEngine.seekToTime(ms));

/** What the pure evaluators give at an instant a seek cannot reach. */
function pureAt(app, ms) {
  const engine = app.animationEngine;
  const { B } = durationsOf(app);
  const path = PlayerCore.timelineToPath(ms, engine.getTimeline(), engine.getLiveTiming());
  const dots = {};
  for (const layer of app.scene.getFlowLayers()) {
    for (const dot of app.swarmEngine.evaluate(ms, layer, {
      durationMs: B, routePathPoints: app.pathPoints, routeAnchors: app.getRouteArrivalMap(),
    })) dots[dot.emitterId] = (dots[dot.emitterId] || 0) + 1;
  }
  const timeline = app.getBranchTimeline();
  const branches = app.branchPaths.map(branch =>
    [branch.id, branchPathProgressAt(ms, timeline.legs[branch.id], timeline.legsById[branch.id])]);
  engine.seekToTime(ms);
  return { ms, path, dots, branches, seekLandsAt: engine.state.currentTime };
}

for (const variant of Object.keys(VARIANTS)) {
  describe(`time domains — ${variant}`, () => {

    test('the scene at each domain edge, and the pure evaluators either side of the timeline', async () => {
      const app = await openProject(fixture(variant));
      const domains = domainsOf(app);
      const { B, F, intro, tail, instants } = domains;
      const states = {};
      for (const [label, ms] of Object.entries(instants)) states[label] = sceneAt(app, ms);
      // Just inside the intro and the tail, where they have them.
      if (intro > 0) states.introEndMinus1 = sceneAt(app, intro - 1);
      if (tail > 0) states.tailStartMinus1 = sceneAt(app, instants.tailStart - 1);
      const before = pureAt(app, -1);
      const between = pureAt(app, instants.betweenBAndF);
      const after = pureAt(app, F + 1);

      // As it stands, whatever the variant:
      expect(states.start).toMatchObject({ head: 0, complete: false, dots: {} });
      expect(states.start.branches).toEqual([['ex-uon-branch', 0]]);
      expect(states.B.head).toBe(1);
      expect(F).toBeGreaterThan(B); // the network crowd finishes after the route
      expect(states.betweenBAndF).toMatchObject({ head: 1, complete: false });
      expect(states.F).toMatchObject({ head: 1, complete: true });
      expect(before).toMatchObject({ seekLandsAt: 0, dots: {} });
      expect(before.path.pathProgress).toBe(0);
      // Between B and F the route is over but the timeline is not.
      expect(between.path).toMatchObject({ pathProgress: 1, complete: false });
      expect(after).toMatchObject({ seekLandsAt: F });
      expect(after.path).toMatchObject({ pathProgress: 1, complete: true });
      if (intro > 0) {
        expect(states.introEndMinus1).toMatchObject({ head: 0, inIntro: true });
        expect(states.introEnd).toMatchObject({ head: 0, inIntro: false, introProgress: 1 });
        // DEF-12: the branch has been running for the intro when the head reaches its fork.
        expect(states.reachesFork.branches[0][1]).toBeGreaterThan(0);
      } else {
        expect(states.reachesFork.branches[0][1]).toBe(0);
      }
      if (tail > 0) {
        expect(states.tailStartMinus1.inTail).toBe(false);
        expect(states.tailStart).toMatchObject({ head: 1, inTail: true, tailElapsed: 0 });
        expect(instants.tailStart + tail).toBe(B);
      } else {
        expect(instants.tailStart).toBe(B);
      }

      const { instants: named, ...parts } = domains;
      pin(`${variant}.edges`, rounded({ ...parts, instants: named, states, before, between, after }));
    });

    test('play == seek: frame by frame, the domain edges draw what a seek draws, on the same host and a fresh one', async () => {
      const app = await openProject(fixture(variant));
      const { F, instants } = domainsOf(app);
      // The frames on the 40 ms grid either side of each edge, and F itself,
      // where playing stops.
      const wanted = new Set([F]);
      for (const ms of Object.values(instants)) {
        if (ms < F) {
          wanted.add(Math.floor(ms / FRAME_MS) * FRAME_MS);
          wanted.add(Math.min(F, Math.ceil(ms / FRAME_MS) * FRAME_MS + FRAME_MS));
        }
      }
      const played = new Map();
      app.animationEngine.seekToTime(0);
      played.set(0, sceneAfter(app, () => {}));
      app.animationEngine.play();
      while (app.animationEngine.state.currentTime < F) {
        const state = sceneAfter(app, () => app.animationEngine.updateAnimation(FRAME_MS, 0));
        if (wanted.has(state.ms)) played.set(state.ms, state);
      }
      expect([...played.keys()].sort((a, b) => a - b)).toEqual([...wanted].sort((a, b) => a - b));

      const fresh = await openProject(fixture(variant));
      for (const [ms, state] of [...played].reverse()) {
        expect(sceneAt(app, ms), `${ms} ms, same host`).toEqual(state);
        expect(sceneAt(fresh, ms), `${ms} ms, fresh host`).toEqual(state);
      }
    });

    test('export: a video export\'s frames at the domain edges draw what the editor draws there', async () => {
      const app = await openProject(fixture(variant));
      const { instants } = domainsOf(app);
      vi.spyOn(VideoExporter, 'downloadBlob').mockImplementation(() => {});
      vi.stubGlobal('alert', vi.fn());
      const exported = [];
      let failure = null;
      app.videoExporter = {
        cancel() {},
        async export({ frameRate, duration, startBuffer, renderFrame }) {
          const plan = createVideoFramePlan({ frameRate, duration, startBuffer });
          const frameAt = ms => plan.startBufferFrames + Math.round((ms / duration) * (plan.animationFrames - 1));
          const frames = new Set([0, plan.startBufferFrames, plan.frameCount - 1,
            ...Object.values(instants).map(frameAt)]);
          for (const index of [...frames].sort((a, b) => a - b)) {
            const sample = plan.sampleAt(index);
            // The export's own frame: what `renderFrame` draws, read from that drawing.
            // A failed read is kept and thrown below: `exportVideo` would swallow it.
            try {
              exported.push(await sceneDrawnBy(app, () => renderFrame(sample.progress)));
            } catch (error) {
              failure ??= error;
            }
          }
          return new Blob(['video'], { type: 'video/mp4' });
        },
      };
      await app.exportVideo();
      if (failure) throw failure;
      expect(exported.length).toBeGreaterThan(5);
      expect(exported.at(-1)).toMatchObject({ head: 1, complete: true });

      const editor = await openProject(fixture(variant));
      for (const state of exported) {
        expect(sceneAt(editor, state.ms), `${state.ms} ms`).toEqual(state);
      }
    });
  });
}

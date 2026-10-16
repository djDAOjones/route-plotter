import { expect, test } from 'vitest';
import { stageProjectModel } from '../src/app/persistence.js';
import { resolveGraphAnchors } from '../src/utils/routeAnchors.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { FinishReleaseClock } from '../src/utils/finishReleaseClock.js';
import { FlowLayer } from '../src/models/FlowLayer.js';

function zero(lifecycleMode, releaseStart = 0, baseDuration = 0) {
  const staged = stageProjectModel(JSON.parse(JSON.stringify({ coordVersion: 9,
    waypoints: [{ id: 'w1', imgX: 11, imgY: 11, isMajor: true, pauseMode: 'none', beaconStyle: 'none' },
      { id: 'w2', imgX: 11, imgY: 11, isMajor: true, pauseMode: 'none', beaconStyle: 'none' }],
    styles: {}, animationState: { duration: baseDuration, baseDuration, speed: 100 },
    scene: { flowLayers: [{ id: 'zero', guideType: 'graph', graph: { nodes: [
      { id: 'a', type: 'entry', x: 0.5, y: 0.5, anchorWaypointId: 'w1',
        area: { shape: 'rectangle', width: 0.01, height: 0.01, turn: 0 } },
      { id: 'z', type: 'exit', x: 0.5, y: 0.5, anchorWaypointId: 'w2' }],
    edges: [{ id: 'az', sourceId: 'a', targetId: 'z', direction: 'one-way' }] },
    emitters: [{ id: 'e', seed: 0, dotCount: 1, waitAtStart: true, lifecycleMode,
      releaseStart, releaseDuration: 0, speed: 1, speedVariance: 0, wobble: 1 }] }] },
  })));
  resolveGraphAnchors(staged.scene, new Map(staged.waypoints.map(w => [w.id, w])));
  const clock = new FinishReleaseClock().resolve({ waypoints: staged.waypoints, baseDuration, speed: 100,
    renderReference: { width: 1920, height: 1080 }, motionSettings: {} });
  return { layer: staged.scene.getFlowLayers()[0], clock };
}

test.each(['disappear', 'collect'])('strict loaded zero %s journey has an initial sample and no invented duration', lifecycle => {
  const { layer, clock } = zero(lifecycle), engine = new SwarmEngine();
  const ctx = { durationMs: 0, finishReleaseContext: clock, imageAspect: 1 };
  expect(clock.durationMs).toBe(0);
  expect(engine.scheduleDots(layer, ctx)).toEqual([
    { onsetFraction: 0, onsetMs: 0, journeyMs: 0, finishes: true, ends: true },
  ]);
  expect(engine.evaluate(0, layer, ctx)).toMatchObject([{ x: 11, y: 11, dotIndex: 0 }]);
  expect(engine.evaluate(-Number.MIN_VALUE, layer, ctx)).toEqual([]);
  expect(engine.evaluate(Number.MIN_VALUE, layer, ctx)).toHaveLength(lifecycle === 'collect' ? 1 : 0);
  expect(engine.canRelease(layer, ctx)).toBe(true);
  expect(engine.crowdFinishMs(layer, ctx)).toBe(0);
});

test.each(['disappear', 'collect'])('subnormal %s onset waits without NaN and uses positive terminal precedence', lifecycle => {
  const { layer } = zero(lifecycle, Number.MIN_VALUE, 1), engine = new SwarmEngine();
  const ctx = { durationMs: 1, finishReleaseContext: { durationMs: 1 } };
  expect(engine.scheduleDots(layer, ctx)[0].onsetMs).toBe(Number.MIN_VALUE);
  expect(engine.evaluate(0, layer, ctx)).toMatchObject([{ x: 11, y: 11 }]);
  const at = engine.evaluate(Number.MIN_VALUE, layer, ctx);
  expect(at).toHaveLength(lifecycle === 'collect' ? 1 : 0);
  expect(at.every(dot => Number.isFinite(dot.x) && Number.isFinite(dot.y))).toBe(true);
});

test('exact tied intrinsic distances use original index and simultaneous slots remain simultaneous', () => {
  const { layer } = zero('collect', 0, 10000), emitter = layer.emitters[0];
  emitter.update({ dotCount: 2, releaseStart: 0.25, releaseDuration: 0.5, onsetVariance: 0 });
  const engine = new SwarmEngine(), ctx = { durationMs: 10000 };
  const initial = engine.evaluate(0, layer, ctx);
  expect(initial.map(dot => [dot.x, dot.y])).toEqual([[11, 11], [11, 11]]);
  // Ordinary releases use each bin's centre: .25 + .5 × [.25, .75].
  expect(engine.scheduleDots(layer, ctx).map(row => row.onsetFraction)).toEqual([0.375, 0.625]);
  const geometry = engine._groupGeometryCache.get(layer).byEmitter.get(emitter);
  expect(geometry.map(row => row.distanceRank)).toEqual([0, 1]);
  emitter.update({ releaseDuration: 0 });
  expect(engine.scheduleDots(layer, ctx).map(row => row.onsetMs)).toEqual([2500, 2500]);
});

test('a stranded explicit Entry is eligible, waits and ends after its own approach', () => {
  const layer = new FlowLayer({ id: 'stranded', guideType: 'graph', graph: {
    nodes: [{ id: 'entry', type: 'entry', x: 0.2, y: 0.5,
      area: { shape: 'ellipse', width: 0.2, height: 0.2, turn: 0 } },
    { id: 'a', x: 0.6, y: 0.4 }, { id: 'b', x: 0.8, y: 0.6 }],
    edges: [{ id: 'other', sourceId: 'a', targetId: 'b' }],
  }, emitters: [{ id: 'e', seed: 7, dotCount: 3, waitAtStart: true, lifecycleMode: 'disappear',
    releaseStart: 0.2, releaseDuration: 0, speed: 1, speedVariance: 0 }] });
  const engine = new SwarmEngine(), ctx = { durationMs: 10000 };
  expect(engine.evaluate(0, layer, ctx)).toHaveLength(3);
  const rows = engine.scheduleDots(layer, ctx);
  expect(rows.every(row => row.ends && row.journeyMs > 0)).toBe(true);
  expect(engine.evaluate(engine.crowdFinishMs(layer, ctx), layer, ctx)).toEqual([]);
});

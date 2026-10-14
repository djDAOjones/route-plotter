import { describe, expect, test } from 'vitest';
import { FinishReleaseClock } from '../src/utils/finishReleaseClock.js';
import { Waypoint } from '../src/models/Waypoint.js';

const waypoint = (id, x, y, extra = {}) => Object.assign(Waypoint.createMajor(x, y), {
  id, pauseMode: 'none', pauseTime: 0, beaconStyle: 'none', ...extra,
});
const input = extra => ({ renderReference: { width: 1000, height: 500 },
  waypoints: [waypoint('a', 0.1, 0.5), waypoint('b', 0.5, 0.5), waypoint('c', 0.9, 0.5)],
  speed: 100, baseDuration: 12000, motionSettings: { pathVisibility: 'full', pathTrail: 0.5 }, ...extra });

describe('canonical finish-area release clock', () => {
  test('reference travel + effective pauses + authored intro and positive Comet tail', () => {
    const data = input(), clock = new FinishReleaseClock();
    data.waypoints[1].pauseMode = 'timed'; data.waypoints[1].pauseTime = 1000;
    const plain = clock.resolve(data);
    expect(plain.durationMs).toBeCloseTo(9000, 8);
    expect(plain.routeAnchors.arrivalMsById.b).toBeCloseTo(4000, 8);
    expect(plain.routeAnchors.pauseMsById.b).toBe(1000);
    data.motionSettings.pathVisibility = 'instantaneous';
    expect(clock.resolve(data).durationMs).toBeCloseTo(13500, 8);
    data.motionSettings.backgroundVisibility = 'spotlight-reveal';
    expect(clock.resolve(data).durationMs).toBeCloseTo(14500, 8);
  });
  test('route speed101 canonicalises to100 in both hosts; legacy duration, Preview and output do not enter it', () => {
    const clock = new FinishReleaseClock(), data = input({ speed: 101 });
    const baseline = clock.resolve(data);
    expect(baseline.durationMs).toBeCloseTo(8000, 8);
    for (const change of [{ baseDuration: 3000 }, { baseDuration: 11000 }, { previewMode: true },
      { canvasWidth: 200, canvasHeight: 400 }, { graphicsScale: 2 }, { speed: 100 }]) {
      expect(clock.resolve({ ...data, ...change })).toBe(baseline);
    }
    expect(clock.resolve({ ...data, renderReference: { width: 200, height: 400 } }).durationMs)
      .toBeCloseTo(1600, 8);
  });
  test('no route uses the authored positive base or A default; zero routed travel has no Comet handle', () => {
    const clock = new FinishReleaseClock();
    expect(clock.resolve(input({ waypoints: [], baseDuration: 12000 })).durationMs).toBe(12000);
    expect(clock.resolve(input({ waypoints: [], baseDuration: 0 })).durationMs).toBe(10000);
    const zero = input({ waypoints: [waypoint('a', 0.5, 0.5), waypoint('b', 0.5, 0.5)],
      motionSettings: { pathVisibility: 'instantaneous', pathTrail: 0.5 } });
    expect(clock.resolve(zero).durationMs).toBe(0);
  });
  test('minor-only and insufficient-major routes retain uniform fallback, even with a custom speed', () => {
    const clock = new FinishReleaseClock(), data = input();
    data.waypoints.forEach(w => { w.isMajor = false; w.segmentSpeed = 2; });
    expect(clock.resolve(data).durationMs).toBeCloseTo(8000, 8);
    data.waypoints[0].isMajor = true;
    expect(clock.resolve(data).durationMs).toBeCloseTo(8000, 8);
    data.waypoints[2].isMajor = true;
    expect(clock.resolve(data).durationMs).toBeCloseTo(4000, 8);
  });
  test('branch arrival ownership, pause aggregation and an outliving branch', () => {
    const data = input();
    data.waypoints.push(waypoint('d', 0.5, 0.9, { branchId: 'B', branchFrom: 'b',
      pauseMode: 'timed', pauseTime: 10000 }));
    const result = new FinishReleaseClock().resolve(data);
    expect(result.routeAnchors.arrivalMsById.b).toBeCloseTo(4000, 8);
    expect(result.routeAnchors.arrivalMsById.d).toBeCloseTo(6000, 8);
    expect(result.routeAnchors.pauseMsById.d).toBe(10000);
    expect(result.durationMs).toBeCloseTo(16000, 8);
  });
  test('seven-point warm edits, restoration, pause/beacon changes and same-id replacement agree with cold', () => {
    const data = input({ waypoints: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.8], [0.5, 0.5],
      [0.65, 0.7], [0.8, 0.2], [0.9, 0.9]].map(([x, y], i) => waypoint(String(i), x, y)) });
    const clock = new FinishReleaseClock(), before = clock.resolve(data);
    data.waypoints[1].imgY = 0.9;
    const changed = clock.resolve(data);
    expect(changed).not.toEqual(before);
    expect(changed).toEqual(new FinishReleaseClock().resolve(data));
    data.waypoints[1].imgY = 0.2;
    expect(clock.resolve(data)).toEqual(before);
    data.waypoints[6].beaconStyle = 'grow';
    expect(clock.resolve(data)).toEqual(new FinishReleaseClock().resolve(data));
    expect(clock.resolve(data).durationMs).toBeGreaterThan(before.durationMs);
    data.waypoints = data.waypoints.map(w => Waypoint.fromJSON(w.toJSON()));
    expect(clock.resolve(data)).toEqual(new FinishReleaseClock().resolve(data));
  });
});

/**
 * PlayerCore unit coverage: pure timeline building and mapping.
 *
 * These pin the deterministic-timeline contract (decision-log 2026-08-17):
 * segment timing, exact pause budgets (grow/ripple/pulse minimums), beacon
 * schedules, and the timeline↔path mappings with handles/intro/tail windows.
 */

import { PlayerCore } from '../src/core/PlayerCore.js';
import { BEACON_TIMING } from '../src/services/BeaconRenderer.js';

const PROGRESS = [0, 0.3, 0.55, 0.8, 1];
const LENGTHS = [300, 250, 250, 200];
const BASE_SPEED = 100; // px/s

function makeWaypoints(overrides = []) {
  const base = [
    { id: 'a', isMajor: true, beaconStyle: 'none' },
    { id: 'b', isMajor: true, beaconStyle: 'none' },
    { id: 'c', isMajor: true, beaconStyle: 'none' },
    { id: 'd', isMajor: true, beaconStyle: 'none' },
    { id: 'e', isMajor: true, beaconStyle: 'none' },
  ];
  overrides.forEach((o, i) => Object.assign(base[i], o));
  return base;
}

describe('PlayerCore.buildSegments', () => {
  test('uniform speeds produce a linear timeline', () => {
    const wps = makeWaypoints();
    const { segments, hasVariableSpeed, pathDuration } =
      PlayerCore.buildSegments(LENGTHS, PROGRESS, wps, BASE_SPEED);
    expect(hasVariableSpeed).toBe(false);
    expect(segments).toHaveLength(4);
    // 1000px at 100px/s = 10s
    expect(pathDuration).toBeCloseTo(10000, 6);
    expect(segments[3].endPathTime).toBeCloseTo(pathDuration, 6);
  });

  test('segment speeds warp leg durations', () => {
    const wps = makeWaypoints([{ segmentSpeed: 0.5 }, { segmentSpeed: 2 }]);
    const { segments, hasVariableSpeed, pathDuration } =
      PlayerCore.buildSegments(LENGTHS, PROGRESS, wps, BASE_SPEED);
    expect(hasVariableSpeed).toBe(true);
    // Leg 0: 300px at 50px/s = 6s; leg 1: 250px at 200px/s = 1.25s
    expect(segments[0].duration).toBeCloseTo(6000, 6);
    expect(segments[1].duration).toBeCloseTo(1250, 6);
    expect(pathDuration).toBeCloseTo(6000 + 1250 + 2500 + 2000, 6);
  });

  test('path time <-> progress round-trips through variable speeds', () => {
    const wps = makeWaypoints([{ segmentSpeed: 0.5 }, { segmentSpeed: 2 }]);
    const { segments, hasVariableSpeed, pathDuration } =
      PlayerCore.buildSegments(LENGTHS, PROGRESS, wps, BASE_SPEED);
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const progress = Math.min(1, p);
      const t = PlayerCore.pathProgressToTime(progress, segments, pathDuration, hasVariableSpeed);
      const back = PlayerCore.pathTimeToProgress(t, segments, pathDuration, hasVariableSpeed);
      expect(back).toBeCloseTo(progress, 9);
    }
  });
});

describe('PlayerCore.buildPauses', () => {
  function build(waypoints) {
    const { segments, hasVariableSpeed, pathDuration } =
      PlayerCore.buildSegments(LENGTHS, PROGRESS, waypoints, BASE_SPEED);
    return {
      segments, hasVariableSpeed, pathDuration,
      ...PlayerCore.buildPauses(waypoints, pathDuration, PROGRESS, 0, segments, hasVariableSpeed),
    };
  }

  test('explicit timed pauses are honoured; pauses at 0% are skipped', () => {
    const wps = makeWaypoints([
      { pauseMode: 'timed', pauseTime: 9999 }, // at 0% — skipped
      { pauseMode: 'timed', pauseTime: 1500 },
    ]);
    const { pauses, totalPauseTime } = build(wps);
    expect(pauses).toHaveLength(1);
    expect(pauses[0].waypointIndex).toBe(1);
    expect(pauses[0].duration).toBe(1500);
    expect(totalPauseTime).toBe(1500);
  });

  test('ripple pause covers every ring plus the fade buffer', () => {
    const wps = makeWaypoints([, { beaconStyle: 'ripple', rippleMaxScale: 1000 }]);
    const { pauses } = build(wps);
    // 4 rings x 1s + 500ms buffer
    expect(pauses[0].duration).toBe(BEACON_TIMING.RIPPLE_COUNT * 1000 + 500);
  });

  test('grow pause budget is exact for its early-onset window', () => {
    // Explicit pause opts the mid-path grow in; the grow budget replaces its duration
    const wps = makeWaypoints([, , { beaconStyle: 'grow', pauseMode: 'timed', pauseTime: 500 }]);
    const { pauses, segments, hasVariableSpeed, pathDuration } = build(wps);
    const arrival = PlayerCore.pathProgressToTime(PROGRESS[2], segments, pathDuration, hasVariableSpeed);
    const prev = PlayerCore.pathProgressToTime(PROGRESS[1], segments, pathDuration, hasVariableSpeed);
    const early = PlayerCore.beaconEarlyOnsetMs('grow', arrival, prev);
    const expected = Math.max(0, 2000 - early) + 1000 +
      BEACON_TIMING.GROW_SCALE_DOWN_DURATION * 1000 + 750;
    expect(pauses[0].duration).toBeCloseTo(expected, 6);
  });

  test('marker timeline positions accumulate earlier pauses', () => {
    const wps = makeWaypoints([
      , { pauseMode: 'timed', pauseTime: 1000 }, , { pauseMode: 'timed', pauseTime: 2000 },
    ]);
    const { pauses, segments, hasVariableSpeed, pathDuration } = build(wps);
    const arrival3 = PlayerCore.pathProgressToTime(PROGRESS[3], segments, pathDuration, hasVariableSpeed);
    expect(pauses[1].timelineStartMs).toBeCloseTo(arrival3 + 1000, 6);
    expect(pauses[1].timelineEndMs).toBeCloseTo(arrival3 + 1000 + 2000, 6);
  });
});

describe('PlayerCore.timelineToPath windows', () => {
  const wps = makeWaypoints([, { pauseMode: 'timed', pauseTime: 2000 }]);
  const { segments, hasVariableSpeed, pathDuration } =
    PlayerCore.buildSegments(LENGTHS, PROGRESS, wps, BASE_SPEED);
  const { pauses, totalPauseTime } =
    PlayerCore.buildPauses(wps, pathDuration, PROGRESS, 0, segments, hasVariableSpeed);
  const tl = { segments, hasVariableSpeed, pathDuration, totalPauseTime, pauses };

  test('waiting window reports elapsed and total', () => {
    const live = { durationMs: pathDuration + totalPauseTime, startHandleMs: 0, introMs: 0, totalTailMs: 0, endHandleMs: 0 };
    const arrival = pauses[0].timelineStartMs;
    const r = PlayerCore.timelineToPath(arrival + 500, tl, live);
    expect(r.waitingIndex).toBe(1);
    expect(r.waitElapsedMs).toBeCloseTo(500, 6);
    expect(r.waitTotalMs).toBe(2000);
    expect(r.pathProgress).toBeCloseTo(PROGRESS[1], 9);
  });

  test('start handle, intro, tail, and end handle clamp the path', () => {
    const live = {
      durationMs: 1000 + 1500 + pathDuration + totalPauseTime + 800 + 700,
      startHandleMs: 1000, introMs: 1500, totalTailMs: 800, endHandleMs: 700,
    };
    expect(PlayerCore.timelineToPath(500, tl, live).inStartHandle).toBe(true);
    expect(PlayerCore.timelineToPath(500, tl, live).pathProgress).toBe(0);
    expect(PlayerCore.timelineToPath(1000 + 700, tl, live).inIntro).toBe(true);
    const tailAt = 1000 + 1500 + pathDuration + totalPauseTime + 100;
    expect(PlayerCore.timelineToPath(tailAt, tl, live).inTail).toBe(true);
    expect(PlayerCore.timelineToPath(tailAt, tl, live).pathProgress).toBe(1);
    const endAt = 1000 + 1500 + pathDuration + totalPauseTime + 800 + 100;
    expect(PlayerCore.timelineToPath(endAt, tl, live).inEndHandle).toBe(true);
  });

  test('pathToTimelineProgress inverts through the pause', () => {
    const live = { durationMs: pathDuration + totalPauseTime, startHandleMs: 0, introMs: 0, totalTailMs: 0, endHandleMs: 0 };
    // A position between waypoints 1 and 2 maps to a timeline instant that
    // maps straight back to the same position.
    const target = (PROGRESS[1] + PROGRESS[2]) / 2;
    const tlProgress = PlayerCore.pathToTimelineProgress(target, tl, live);
    const r = PlayerCore.timelineToPath(tlProgress * live.durationMs, tl, live);
    expect(r.pathProgress).toBeCloseTo(target, 9);
  });
});

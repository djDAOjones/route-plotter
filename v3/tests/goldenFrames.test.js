/**
 * Scrub-vs-play golden-frame harness (Phase 1 deterministic-timeline mandate).
 *
 * The v2 line could disagree between scrubbing and playing: renderers
 * accumulated delta time and grow beacons mutated the timeline mid-flight.
 * This suite pins the v3 contract at the state level: evaluating any timeline
 * instant yields IDENTICAL scene state — path progress, wait state, and every
 * beacon's visual state — whether that instant is reached by sequential
 * playing (jittered frame deltas), direct seeking, reverse traversal, or
 * fixed-step export stepping. It also proves evaluation never mutates the
 * timeline (the deleted grow-extension defect class).
 */

import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { BeaconRenderer } from '../src/services/BeaconRenderer.js';

const PROGRESS = [0, 0.3, 0.55, 0.8, 1];
const LENGTHS = [300, 250, 250, 200];
const BASE_SPEED = 100; // px/s

/** A project exercising variable speeds, explicit waits, and all beacon families. */
function makeWaypoints() {
  return [
    { id: 'a', isMajor: true, beaconStyle: 'none', segmentSpeed: 0.5 },
    { id: 'b', isMajor: true, beaconStyle: 'ripple', rippleMaxScale: 1000, rippleThickness: 2, pauseMode: 'timed', pauseTime: 1000, segmentSpeed: 2 },
    // Grow needs an explicit pause mid-path (v2 semantics: only the last
    // waypoint forces one); its duration is replaced by the exact grow budget.
    { id: 'c', isMajor: true, beaconStyle: 'grow', pauseMode: 'timed', pauseTime: 500 },
    { id: 'd', isMajor: true, beaconStyle: 'pulse', pulseCycleSpeed: 2, pulseAmplitude: 1 },
    { id: 'e', isMajor: true, beaconStyle: 'glow' },
  ];
}

/** Build a fully configured engine for the shared scenario. */
function makeEngine() {
  const engine = new AnimationEngine(null);
  const waypoints = makeWaypoints();
  const pathDuration = engine.setSegmentMarkers(LENGTHS, PROGRESS, waypoints, BASE_SPEED);
  engine.pathDuration = pathDuration;
  engine.setPauseMarkers(waypoints, pathDuration, PROGRESS, 0);
  engine.setDuration(pathDuration + engine.totalPauseTime);
  return { engine, waypoints };
}

/** Snapshot of everything a frame at time t depends on. */
function sceneState(engine, beaconRenderer, waypoints, tMs) {
  const pathProgress = engine.timelineToPathProgress(tMs / engine.state.duration);
  beaconRenderer.update(tMs, waypoints, engine, null, PROGRESS);
  const beacons = waypoints.map(wp => {
    const b = beaconRenderer.beacons.get(wp.id);
    if (!b) return null;
    return {
      phase: b.phase,
      completed: b.completed,
      started: b.started,
      scale: b.scale,
      radius: b.radius,
      opacity: b.opacity,
      rings: b.rings ? b.rings.map(r => ({ startTime: r.startTime, opacity: r.opacity })) : undefined,
      subPhase: b.subPhase,
      loopTime: b.loopTime,
    };
  });
  return { pathProgress, waiting: engine.state.isWaitingAtWaypoint, waitIndex: engine.state.pauseWaypointIndex, beacons };
}

/** Deterministic pseudo-random jitter (no Math.random in tests). */
function jitterSequence(totalMs, seed = 7) {
  const times = [];
  let t = 0;
  let x = seed;
  while (t < totalMs) {
    x = (x * 48271) % 2147483647;
    t += 8 + (x % 120); // 8ms..127ms frame deltas
    times.push(Math.min(t, totalMs));
  }
  return times;
}

describe('golden frames: one evaluation path for play, scrub, export', () => {
  test('sequential jittered playback matches direct seeks exactly', () => {
    const played = makeEngine();
    const seeked = makeEngine();
    const playedBeacons = new BeaconRenderer();
    const seekedBeacons = new BeaconRenderer();

    const duration = played.engine.state.duration;
    for (const t of jitterSequence(duration)) {
      const a = sceneState(played.engine, playedBeacons, played.waypoints, t);
      // Fresh renderer state per seek on the control side: rebuild from scratch
      seekedBeacons.reset();
      const b = sceneState(seeked.engine, seekedBeacons, seeked.waypoints, t);
      expect(a).toEqual(b);
    }
  });

  test('reverse traversal matches forward traversal at the same instants', () => {
    const forward = makeEngine();
    const backward = makeEngine();
    const fwdBeacons = new BeaconRenderer();
    const bwdBeacons = new BeaconRenderer();

    const duration = forward.engine.state.duration;
    const times = jitterSequence(duration, 13);
    const fwd = times.map(t => sceneState(forward.engine, fwdBeacons, forward.waypoints, t));
    const bwd = [...times].reverse().map(t => sceneState(backward.engine, bwdBeacons, backward.waypoints, t)).reverse();
    expect(bwd).toEqual(fwd);
  });

  test('fixed-step export stepping matches direct seeks', () => {
    const stepped = makeEngine();
    const seeked = makeEngine();
    const steppedBeacons = new BeaconRenderer();
    const seekedBeacons = new BeaconRenderer();

    const duration = stepped.engine.state.duration;
    const frameMs = 1000 / 25;
    for (let frame = 0; frame * frameMs <= duration; frame++) {
      const t = Math.min(frame * frameMs, duration);
      const a = sceneState(stepped.engine, steppedBeacons, stepped.waypoints, t);
      seekedBeacons.reset();
      const b = sceneState(seeked.engine, seekedBeacons, seeked.waypoints, t);
      expect(a).toEqual(b);
    }
  });

  test('evaluation never mutates the timeline (grow-extension defect class)', () => {
    const { engine, waypoints } = makeEngine();
    const beacons = new BeaconRenderer();
    const before = JSON.stringify({
      pauses: engine.pauseMarkers.map(({ waypoint, ...m }) => m),
      totalPauseTime: engine.totalPauseTime,
      pathDuration: engine.pathDuration,
      duration: engine.state.duration,
      schedules: engine.beaconSchedules.map(({ ...s }) => s),
    });

    const duration = engine.state.duration;
    for (const t of jitterSequence(duration, 29)) {
      sceneState(engine, beacons, waypoints, t);
    }

    const after = JSON.stringify({
      pauses: engine.pauseMarkers.map(({ waypoint, ...m }) => m),
      totalPauseTime: engine.totalPauseTime,
      pathDuration: engine.pathDuration,
      duration: engine.state.duration,
      schedules: engine.beaconSchedules.map(({ ...s }) => s),
    });
    expect(after).toBe(before);
  });

  test('grow beacon completes its scale-down inside the precomputed pause', () => {
    const { engine, waypoints } = makeEngine();
    const beacons = new BeaconRenderer();
    const growSched = engine.beaconSchedules.find(s => s.style === 'grow');
    expect(growSched).toBeTruthy();
    expect(growSched.pauseDurationMs).toBeGreaterThan(0);

    // At the end of the grow waypoint's pause window the scale-down must be
    // complete — the exact-budget guarantee that replaced runtime extension.
    beacons.update(growSched.holdEndMs, waypoints, engine, null, PROGRESS);
    const grow = beacons.beacons.get(growSched.waypointId);
    expect(grow.scaleDownComplete).toBe(true);
    expect(grow.scale).toBeCloseTo(1.0, 9);
  });

  test('scrubbing backwards revives completed beacons deterministically', () => {
    const { engine, waypoints } = makeEngine();
    const beacons = new BeaconRenderer();
    const rippleSched = engine.beaconSchedules.find(s => s.style === 'ripple');

    // Mid-ripple state on first visit
    const midMs = rippleSched.arrivalMs + 1500;
    sceneState(engine, beacons, waypoints, midMs);
    const firstVisit = JSON.parse(JSON.stringify(
      { rings: beacons.beacons.get(rippleSched.waypointId).rings }
    ));

    // Jump to the end (ripple completed), then scrub back to the same instant
    sceneState(engine, beacons, waypoints, engine.state.duration);
    expect(beacons.beacons.get(rippleSched.waypointId).completed).toBe(true);
    sceneState(engine, beacons, waypoints, midMs);
    const secondVisit = { rings: beacons.beacons.get(rippleSched.waypointId).rings };
    expect(secondVisit).toEqual(firstVisit);
    expect(beacons.beacons.get(rippleSched.waypointId).completed).toBe(false);
  });
});

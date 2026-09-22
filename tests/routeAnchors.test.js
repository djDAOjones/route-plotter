/**
 * COMPOSE-01 — crowds bound to route moments.
 *
 * Three properties carry the ticket's contract and are what these tests
 * defend:
 * 1. **One-way ownership.** A bound node follows its waypoint; nothing here
 *    ever moves a waypoint, and route timing never becomes a function of
 *    crowd arrival.
 * 2. **Authored intent survives.** Binding never rewrites `x`/`y`, and a
 *    broken reference falls back to them with a report rather than a repair.
 * 3. **Unanchored crowds are byte-for-byte unchanged.** The onset arithmetic
 *    is untouched; only a bound emitter's window start moves.
 */

import { describe, test, expect } from 'vitest';
import {
  RELEASE_AT, normaliseReleaseAnchor, resolveGraphAnchors,
  resolveReleaseAnchor, releaseStartFraction,
} from '../src/utils/routeAnchors.js';
import { Scene } from '../src/models/Scene.js';
import { GraphNode } from '../src/models/GraphNode.js';
import { Emitter } from '../src/models/Emitter.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';

/**
 * Drive just the anchor-resolution step of calculatePath against a stub app,
 * which is where the warning is debounced.
 */
function announceBrokenAnchorsFor(app) {
  app.pathPoints = [];
  app.waypoints = [];
  app._waypointProgressCache = null;
  pathTimingMixin.calculatePath.call(app);
}

const waypointAt = (id, x, y) => Object.assign(Waypoint.createMajor(x, y), { id });

function sceneWithNode(nodeOptions) {
  const scene = new Scene();
  const layer = scene.addFlowLayer({ name: 'Crowd 1', guideType: 'graph' });
  const node = layer.graph.addNode(new GraphNode(nodeOptions));
  return { scene, layer, node };
}

describe('GraphNode anchoring', () => {
  test('an unanchored node reports its authored position', () => {
    const node = new GraphNode({ x: 0.2, y: 0.3 });

    expect(node.position()).toEqual({ x: 0.2, y: 0.3 });
    expect(node.isAnchorResolved()).toBe(false);
    expect('anchorWaypointId' in node.toJSON()).toBe(false);
  });

  test('a resolved anchor moves the reported position, never the authored one', () => {
    const node = new GraphNode({ x: 0.2, y: 0.3, anchorWaypointId: 'wp-1' });
    node.applyAnchor(0.8, 0.9);

    expect(node.position()).toEqual({ x: 0.8, y: 0.9 });
    expect(node.x).toBe(0.2);
    expect(node.y).toBe(0.3);
    expect(node.toJSON()).toMatchObject({ x: 0.2, y: 0.3, anchorWaypointId: 'wp-1' });
  });

  test('clearing the resolution falls the node back to where it was authored', () => {
    const node = new GraphNode({ x: 0.2, y: 0.3, anchorWaypointId: 'wp-1' });
    node.applyAnchor(0.8, 0.9);
    node.clearAnchorResolution();

    expect(node.position()).toEqual({ x: 0.2, y: 0.3 });
  });

  test('the anchor round-trips through serialisation', () => {
    const node = new GraphNode({ x: 0.2, y: 0.3, anchorWaypointId: 'wp-1' });
    node.applyAnchor(0.8, 0.9);
    const restored = GraphNode.fromJSON(node.toJSON());

    expect(restored.anchorWaypointId).toBe('wp-1');
    // The resolution is derived, so it is NOT carried: it is recomputed from
    // live route state on the next path rebuild.
    expect(restored.isAnchorResolved()).toBe(false);
    expect(restored.position()).toEqual({ x: 0.2, y: 0.3 });
  });
});

describe('resolveGraphAnchors', () => {
  test('binds a node to its waypoint’s position', () => {
    const { scene, node } = sceneWithNode({ x: 0.1, y: 0.1, anchorWaypointId: 'wp-1' });
    const report = resolveGraphAnchors(scene, new Map([['wp-1', waypointAt('wp-1', 0.7, 0.4)]]));

    expect(report).toEqual({ bound: 1, broken: [] });
    expect(node.position()).toEqual({ x: 0.7, y: 0.4 });
  });

  test('a moved waypoint moves the bound node on the next resolve', () => {
    const { scene, node } = sceneWithNode({ x: 0.1, y: 0.1, anchorWaypointId: 'wp-1' });
    const waypoint = waypointAt('wp-1', 0.7, 0.4);
    resolveGraphAnchors(scene, new Map([['wp-1', waypoint]]));

    waypoint.setPosition(0.2, 0.9);
    resolveGraphAnchors(scene, new Map([['wp-1', waypoint]]));

    expect(node.position()).toEqual({ x: 0.2, y: 0.9 });
  });

  test('a deleted waypoint falls the node back and is reported, not repaired', () => {
    const { scene, node } = sceneWithNode({ x: 0.1, y: 0.15, anchorWaypointId: 'wp-gone' });
    const report = resolveGraphAnchors(scene, new Map());

    expect(report.bound).toBe(0);
    expect(report.broken).toHaveLength(1);
    expect(report.broken[0]).toMatchObject({ nodeId: node.id, waypointId: 'wp-gone' });
    // Fallback, and the binding is still on the node: the author decides
    // whether to rebind or drop it.
    expect(node.position()).toEqual({ x: 0.1, y: 0.15 });
    expect(node.anchorWaypointId).toBe('wp-gone');
  });

  test('an unanchored scene resolves to nothing at all', () => {
    const { scene, node } = sceneWithNode({ x: 0.4, y: 0.4 });

    expect(resolveGraphAnchors(scene, new Map())).toEqual({ bound: 0, broken: [] });
    expect(node.position()).toEqual({ x: 0.4, y: 0.4 });
  });

  test('a missing scene or waypoint map is not an error', () => {
    expect(resolveGraphAnchors(null, null)).toEqual({ bound: 0, broken: [] });
  });

  test('binding never writes to the waypoint', () => {
    const { scene } = sceneWithNode({ x: 0.1, y: 0.1, anchorWaypointId: 'wp-1' });
    const waypoint = waypointAt('wp-1', 0.7, 0.4);
    const before = waypoint.toJSON();

    resolveGraphAnchors(scene, new Map([['wp-1', waypoint]]));

    expect(waypoint.toJSON()).toEqual(before);
  });
});

describe('the broken-anchor warning fires once per change', () => {
  // calculatePath runs on every drag frame, so a warning per rebuild would
  // spam the author out of noticing the real one.
  const makeApp = (scene) => {
    const toasts = [];
    return {
      scene,
      waypointsById: new Map(),
      eventBus: { emit: (name, payload) => { if (name === 'ui:toast') toasts.push(payload.message); } },
      announce() {},
      toasts,
    };
  };

  test('one warning when a binding first breaks, none on the next rebuild', () => {
    const { scene } = sceneWithNode({ x: 0.1, y: 0.1, anchorWaypointId: 'wp-gone' });
    const app = makeApp(scene);

    announceBrokenAnchorsFor(app);
    announceBrokenAnchorsFor(app);
    announceBrokenAnchorsFor(app);

    expect(app.toasts).toHaveLength(1);
    expect(app.toasts[0]).toContain('lost the waypoint it followed');
  });

  test('a healthy scene warns about nothing', () => {
    const { scene } = sceneWithNode({ x: 0.1, y: 0.1 });
    const app = makeApp(scene);

    announceBrokenAnchorsFor(app);

    expect(app.toasts).toEqual([]);
  });

  test('rebinding clears the state, so a later break warns again', () => {
    const { scene, node } = sceneWithNode({ x: 0.1, y: 0.1, anchorWaypointId: 'wp-1' });
    const app = makeApp(scene);

    announceBrokenAnchorsFor(app);                                  // broken
    app.waypointsById = new Map([['wp-1', waypointAt('wp-1', 0.5, 0.5)]]);
    announceBrokenAnchorsFor(app);                                  // healed
    app.waypointsById = new Map();
    announceBrokenAnchorsFor(app);                                  // broken again

    expect(app.toasts).toHaveLength(2);
    expect(node.anchorWaypointId).toBe('wp-1');
  });
});

describe('release anchors', () => {
  const context = {
    arrivalMsById: { 'wp-1': 2000, 'wp-2': 5000 },
    pauseMsById: { 'wp-1': 1500 },
    totalDurationMs: 10000,
  };

  test('normalisation defaults to arrival and rejects a malformed anchor', () => {
    expect(normaliseReleaseAnchor({ waypointId: 'wp-1' }))
      .toEqual({ waypointId: 'wp-1', at: RELEASE_AT.ARRIVAL });
    expect(normaliseReleaseAnchor({ waypointId: 'wp-1', at: 'nonsense' }))
      .toEqual({ waypointId: 'wp-1', at: RELEASE_AT.ARRIVAL });
    expect(normaliseReleaseAnchor({ at: 'arrival' })).toBeNull();
    expect(normaliseReleaseAnchor(null)).toBeNull();
    expect(normaliseReleaseAnchor('wp-1')).toBeNull();
  });

  test('arrival resolves to the head reaching the waypoint', () => {
    expect(resolveReleaseAnchor({ waypointId: 'wp-1', at: RELEASE_AT.ARRIVAL }, context))
      .toEqual({ ms: 2000, resolved: true, reason: null });
  });

  test('pause-end resolves to the head leaving again', () => {
    expect(resolveReleaseAnchor({ waypointId: 'wp-1', at: RELEASE_AT.PAUSE_END }, context).ms)
      .toBe(3500);
  });

  test('pause-end on a waypoint with no wait is its arrival', () => {
    expect(resolveReleaseAnchor({ waypointId: 'wp-2', at: RELEASE_AT.PAUSE_END }, context).ms)
      .toBe(5000);
  });

  test('route-end resolves to completion, branches included', () => {
    expect(resolveReleaseAnchor({ waypointId: 'wp-1', at: RELEASE_AT.ROUTE_END }, context).ms)
      .toBe(10000);
  });

  test('a vanished waypoint is reported unresolved with a usable reason', () => {
    const resolved = resolveReleaseAnchor({ waypointId: 'gone', at: RELEASE_AT.ARRIVAL }, context);

    expect(resolved.resolved).toBe(false);
    expect(resolved.reason).toContain('no longer on the route');
  });
});

describe('releaseStartFraction', () => {
  const context = {
    arrivalMsById: { 'wp-1': 2500 },
    pauseMsById: {},
    totalDurationMs: 10000,
  };

  test('an unanchored emitter keeps its authored window start exactly', () => {
    const emitter = new Emitter({ releaseStart: 0.37 });

    expect(releaseStartFraction(emitter, context)).toBe(0.37);
  });

  test('a bound emitter starts at its route moment', () => {
    const emitter = new Emitter({ releaseStart: 0.37, releaseAnchor: { waypointId: 'wp-1' } });

    expect(releaseStartFraction(emitter, context)).toBeCloseTo(0.25, 9);
  });

  test('a broken anchor falls back to the authored window, not to zero', () => {
    const emitter = new Emitter({ releaseStart: 0.37, releaseAnchor: { waypointId: 'gone' } });

    expect(releaseStartFraction(emitter, context)).toBe(0.37);
  });

  test('a zero-length timeline falls back rather than dividing by it', () => {
    const emitter = new Emitter({ releaseStart: 0.37, releaseAnchor: { waypointId: 'wp-1' } });

    expect(releaseStartFraction(emitter, { ...context, totalDurationMs: 0 })).toBe(0.37);
  });

  test('an anchor past the end of the timeline clamps to it', () => {
    const emitter = new Emitter({ releaseAnchor: { waypointId: 'wp-1' } });

    expect(releaseStartFraction(emitter, { ...context, totalDurationMs: 1000 })).toBe(1);
  });
});

describe('the swarm stays deterministic and unanchored crowds stay identical', () => {
  const buildLayer = (emitterOptions) => {
    const scene = new Scene();
    const layer = scene.addFlowLayer({ name: 'Crowd', guideType: 'route' });
    layer.addEmitter({ seed: 7, dotCount: 12, speed: 0.2, releaseStart: 0.2,
      releaseDuration: 0.6, ...emitterOptions });
    return layer;
  };
  const routePoints = Array.from({ length: 40 }, (_, i) => ({ x: i / 39, y: 0.5 }));
  const evaluate = (layer, context) =>
    new SwarmEngine().evaluate(4000, layer, { durationMs: 10000, routePathPoints: routePoints, ...context });

  test('an unanchored emitter produces identical dots with and without anchor context', () => {
    const layer = buildLayer({});
    const withoutContext = evaluate(layer, {});
    const withContext = evaluate(layer, {
      routeAnchors: { arrivalMsById: { 'wp-1': 2500 }, pauseMsById: {}, totalDurationMs: 10000 },
    });

    expect(withContext).toEqual(withoutContext);
    expect(withoutContext.length).toBeGreaterThan(0);
  });

  test('a bound emitter shifts its release, and only its release', () => {
    const anchored = buildLayer({ releaseAnchor: { waypointId: 'wp-1' } });
    const context = {
      routeAnchors: { arrivalMsById: { 'wp-1': 8000 }, pauseMsById: {}, totalDurationMs: 10000 },
    };

    // The window now starts at 0.8 of the timeline, so at t=4000 nothing has
    // been released yet — while the unanchored twin has dots on the route.
    expect(evaluate(anchored, context)).toEqual([]);
    expect(evaluate(buildLayer({}), context).length).toBeGreaterThan(0);
  });

  test('evaluating the same instant twice gives the same dots', () => {
    const layer = buildLayer({ releaseAnchor: { waypointId: 'wp-1' } });
    const context = {
      routeAnchors: { arrivalMsById: { 'wp-1': 1000 }, pauseMsById: {}, totalDurationMs: 10000 },
    };

    expect(evaluate(layer, context)).toEqual(evaluate(layer, context));
  });

  test('a broken release anchor evaluates as the authored window did', () => {
    const broken = buildLayer({ releaseAnchor: { waypointId: 'gone' } });
    const plain = buildLayer({});
    const context = {
      routeAnchors: { arrivalMsById: {}, pauseMsById: {}, totalDurationMs: 10000 },
    };
    // Compared without emitterId: the two layers mint different ids, and what
    // is under test is that the dots land in the same places.
    const shape = dots => dots.map(({ emitterId, ...rest }) => rest);

    expect(shape(evaluate(broken, context))).toEqual(shape(evaluate(plain, context)));
    expect(evaluate(broken, context).length).toBeGreaterThan(0);
  });
});

/**
 * The bundled example projects (DEMO-01).
 *
 * Built from the real models rather than stored as hand-written JSON, for two
 * reasons. They cannot rot into an invalid shape as the save format evolves —
 * whatever `toJSON()` produces is by definition current. And they are the same
 * objects the app itself uses, so the tests that load them are exercising the
 * real thing, which is what makes them *living* fixtures rather than snapshots
 * of a format nobody reads any more.
 *
 * Every id here is explicit. Auto-generated ids embed `Date.now()`, which would
 * make each build produce different bytes and each test run a different
 * fixture; stable ids make an example reproducible and diffable.
 *
 * Backgrounds are named, not embedded: each example points at one of the
 * already-bundled, owner-approved images (see `public-assets.json`). The build
 * assembles the real downloadable `.zip` project save from the two.
 */

import { Waypoint } from '../models/Waypoint.js';
import { Scene } from '../models/Scene.js';
import { traceRouteIntoGraph, applyTraceToLayer } from '../utils/routeTrace.js';

/** Okabe-Ito, matching the map-data palette the rest of the app uses. */
const ROUTE_ORANGE = '#E69F00';
const CROWD_BLUE = '#56B4E9';
const CROWD_GREEN = '#009E73';

/**
 * A fixed authoring timestamp. `Waypoint.toJSON()` carries `created` and
 * `modified`, both `Date.now()`, so without pinning them every build would
 * produce different bytes and land a fresh multi-megabyte archive in history.
 */
const AUTHORED_AT = Date.parse('2026-01-01T00:00:00Z');

function major(id, x, y, extra = {}) {
  return Object.assign(Waypoint.createMajor(x, y),
    { id, created: AUTHORED_AT, modified: AUTHORED_AT }, extra);
}

function minor(id, x, y, extra = {}) {
  return Object.assign(Waypoint.createMinor(x, y),
    { id, created: AUTHORED_AT, modified: AUTHORED_AT }, extra);
}

/**
 * A short unbranched route with labels — the gentle first-open example, and
 * the fixture for the plain single-chain path everything else builds on.
 */
function parmAerialWalk() {
  const waypoints = [
    major('ex-parm-1', 0.18, 0.72, {
      name: 'Start', label: 'Site entrance', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      pauseMode: 'timed', pauseTime: 1200,
    }),
    minor('ex-parm-1a', 0.34, 0.60),
    major('ex-parm-2', 0.52, 0.48, {
      name: 'Survey point', label: 'Survey point', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      beaconStyle: 'ripple', pauseMode: 'timed', pauseTime: 1800,
    }),
    major('ex-parm-3', 0.79, 0.31, {
      name: 'Finish', label: 'Finish', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      pauseMode: 'timed', pauseTime: 1500,
    }),
  ];
  return { waypoints, scene: new Scene() };
}

/**
 * A branched route with a crowd traced from it — the example that exercises
 * every Phase 5 feature at once: a fork, a rejoin, a traced guide network,
 * bound nodes, and a release pinned to a route moment.
 */
function uonOpenDay() {
  const waypoints = [
    major('ex-uon-1', 0.16, 0.63, {
      name: 'Main entrance', label: 'Main entrance', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      pauseMode: 'timed', pauseTime: 1500,
    }),
    major('ex-uon-2', 0.40, 0.47, {
      name: 'Trent Building', label: 'Trent Building', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      beaconStyle: 'ripple', pauseMode: 'timed', pauseTime: 2000,
    }),
    // The lake curve: minors shape the leg without owning any timing.
    minor('ex-uon-2a', 0.52, 0.58),
    minor('ex-uon-2b', 0.63, 0.55),
    // A branch off Trent Building that rejoins at the library.
    major('ex-uon-b1', 0.44, 0.24, {
      name: 'Sports fields', label: 'Sports fields', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      pauseMode: 'timed', pauseTime: 1200,
      branchId: 'ex-uon-branch', branchFrom: 'ex-uon-2', branchRejoin: 'ex-uon-3',
    }),
    major('ex-uon-3', 0.78, 0.42, {
      name: 'Library', label: 'Library', labelMode: 'on',
      dotColor: ROUTE_ORANGE, segmentColor: ROUTE_ORANGE,
      beaconStyle: 'ripple', pauseMode: 'timed', pauseTime: 2500,
    }),
  ];

  const scene = new Scene();
  const visitors = scene.addFlowLayer({
    id: 'ex-uon-crowd', name: 'Visitors', guideType: 'graph',
  });
  // Traced from the route itself, so the crowd walks the same shape and
  // splits where the route splits (COMPOSE-03).
  applyTraceToLayer(visitors, traceRouteIntoGraph(waypoints));
  visitors.addEmitter({
    id: 'ex-uon-emitter', seed: 20260827, dotCount: 60,
    speed: 0.06, dotSize: 0.45, dotColor: CROWD_BLUE,
    speedVariance: 0.35, onsetVariance: 0.6, lifecycleMode: 'disappear',
    releaseDuration: 0.45,
    // Released when the head reaches the entrance (COMPOSE-01).
    releaseAnchor: { waypointId: 'ex-uon-1', at: 'arrival' },
  });

  return { waypoints, scene };
}

/**
 * A guide network with no branching hero route — the flow side on its own,
 * two emitters at different speeds through one network.
 */
function nervousSystemFlow() {
  const waypoints = [
    major('ex-ns-1', 0.12, 0.50, {
      name: 'Stimulus', dotColor: ROUTE_ORANGE, segmentColor: 'transparent',
      markerStyle: 'none', pauseMode: 'none', pauseTime: 0,
    }),
    major('ex-ns-2', 0.88, 0.50, {
      name: 'Response', dotColor: ROUTE_ORANGE, segmentColor: 'transparent',
      markerStyle: 'none', pauseMode: 'timed', pauseTime: 3000,
    }),
  ];

  const scene = new Scene();
  const signals = scene.addFlowLayer({
    id: 'ex-ns-crowd', name: 'Signals', guideType: 'graph',
  });
  const graph = signals.graph;
  graph.addNode({ id: 'ex-ns-n1', x: 0.12, y: 0.50, type: 'entry', label: 'Stimulus' });
  graph.addNode({ id: 'ex-ns-n2', x: 0.38, y: 0.34, type: 'normal' });
  graph.addNode({ id: 'ex-ns-n3', x: 0.38, y: 0.66, type: 'normal' });
  graph.addNode({ id: 'ex-ns-n4', x: 0.64, y: 0.50, type: 'normal' });
  graph.addNode({ id: 'ex-ns-n5', x: 0.88, y: 0.50, type: 'exit', label: 'Response' });
  graph.addEdge({ id: 'ex-ns-e1', sourceId: 'ex-ns-n1', targetId: 'ex-ns-n2', weight: 1 });
  graph.addEdge({ id: 'ex-ns-e2', sourceId: 'ex-ns-n1', targetId: 'ex-ns-n3', weight: 2 });
  graph.addEdge({ id: 'ex-ns-e3', sourceId: 'ex-ns-n2', targetId: 'ex-ns-n4', weight: 1 });
  graph.addEdge({ id: 'ex-ns-e4', sourceId: 'ex-ns-n3', targetId: 'ex-ns-n4', weight: 1 });
  graph.addEdge({ id: 'ex-ns-e5', sourceId: 'ex-ns-n4', targetId: 'ex-ns-n5', weight: 1 });

  signals.addEmitter({
    id: 'ex-ns-fast', seed: 1, dotCount: 40, speed: 0.22, dotSize: 0.3,
    dotColor: CROWD_BLUE, lifecycleMode: 'disappear',
    releaseStart: 0, releaseDuration: 0.5, onsetVariance: 0.8,
  });
  signals.addEmitter({
    id: 'ex-ns-slow', seed: 2, dotCount: 25, speed: 0.1, dotSize: 0.45,
    dotColor: CROWD_GREEN, lifecycleMode: 'disappear',
    releaseStart: 0.15, releaseDuration: 0.55, onsetVariance: 0.4,
  });

  return { waypoints, scene };
}

/** Everything a project snapshot needs beyond waypoints and scene. */
function snapshotFrom({ waypoints, scene }, { speed = 140 } = {}) {
  return {
    coordVersion: 9,
    waypoints: waypoints.map(waypoint => waypoint.toJSON()),
    scene: scene.toJSON(),
    styles: {
      pathColor: ROUTE_ORANGE, pathWidth: 4, dotSize: 10,
      pathHead: { style: 'arrow', color: ROUTE_ORANGE, size: 12, image: null, imageAssetId: null },
    },
    animationState: { mode: 'constant-speed', speed, duration: 0 },
    background: { overlay: 0, fit: 'fit' },
    exportSettings: {
      frameRate: 30, pathOnly: false, resolutionX: 1920, resolutionY: 1080,
      backgroundZoom: 100, includeCamera: false, includeText: true,
    },
    motionSettings: {
      pathVisibility: 'show-on-progression', pathTrail: 0,
      waypointVisibility: 'show-on-progression', backgroundVisibility: 'always-show',
      revealSize: 30, revealFeather: 40, aovAngle: 60, aovDistance: 40, aovDropoff: 50,
    },
    imageAssets: [],
  };
}

/**
 * Every bundled example, as project snapshots plus the background each one
 * expects.
 *
 * @returns {Array<{id, name, description, backgroundSource, project}>}
 */
export function buildExampleProjects() {
  return [
    {
      id: 'parm-aerial-walk',
      name: 'Site walk',
      description: 'A short route with labels and a beacon — the plain path, no crowd.',
      backgroundSource: 'images/PARM_Aerial.jpg',
      project: snapshotFrom(parmAerialWalk(), { speed: 120 }),
    },
    {
      id: 'uon-open-day',
      name: 'Open day route',
      description: 'A branching campus route with a crowd traced from it, released when the head arrives.',
      backgroundSource: 'images/UoN_map.png',
      project: snapshotFrom(uonOpenDay(), { speed: 150 }),
    },
    {
      id: 'nervous-system-flow',
      name: 'Signal flow',
      description: 'A weighted guide network with two dot streams and no hero route.',
      backgroundSource: 'images/Nervous_System.jpg',
      project: snapshotFrom(nervousSystemFlow(), { speed: 200 }),
    },
  ];
}

/** The example ids, in menu order. */
export function exampleProjectIds() {
  return buildExampleProjects().map(example => example.id);
}

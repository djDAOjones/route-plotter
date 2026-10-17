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

/**
 * Add a one-way chain of nodes to a crowd's network. `points` are the inner
 * nodes in walking order; the chain runs from `fromId` to `toId` through them,
 * so a street drawn once can be reused by every crowd that walks it.
 */
function addChain(graph, prefix, fromId, points, toId) {
  let previous = fromId;
  points.forEach(([x, y], index) => {
    const id = `${prefix}-${index + 1}`;
    graph.addNode({ id, x, y, type: 'normal' });
    graph.addEdge({ id: `${prefix}-e${index + 1}`, sourceId: previous, targetId: id, direction: 'one-way' });
    previous = id;
  });
  graph.addEdge({ id: `${prefix}-e${points.length + 1}`, sourceId: previous, targetId: toId, direction: 'one-way' });
}

/** Okabe-Ito vermillion and blue: the home and away ends of the football example. */
const HOME_RED = '#D55E00';
const AWAY_BLUE = '#0072B2';

/**
 * The City Ground, on the PARM aerial of Nottingham. Every point is a
 * normalised position read off the bundled image; areas are centred on their
 * node and turned to the stand they fill (CROWD-08 parts B and C).
 */
const MATCH_DAY = {
  entries: {
    square: { x: 0.334, y: 0.399, label: 'Market Square', area: { shape: 'rectangle', width: 0.022, height: 0.016, turn: 0 } },
    station: { x: 0.468, y: 0.607, label: 'Station', area: { shape: 'rectangle', width: 0.05, height: 0.016, turn: 0 } },
    trentBridge: { x: 0.652, y: 0.990, label: 'Trent Bridge', area: { shape: 'rectangle', width: 0.016, height: 0.012, turn: 0 } },
    coachPark: { x: 0.718, y: 0.937, label: 'Coach park', area: { shape: 'rectangle', width: 0.018, height: 0.024, turn: 20 } },
  },
  // South from the square, down Carrington Street to Station Street.
  squareToStation: [[0.352, 0.412], [0.385, 0.445], [0.418, 0.480], [0.419, 0.560], [0.421, 0.592]],
  stationStreet: { x: 0.505, y: 0.592 },
  // Down London Road, east past the railway sidings, over Lady Bay Bridge and
  // on to the ground's north-east corner.
  ladyBay: [
    [0.538, 0.594], [0.540, 0.677], [0.600, 0.677], [0.645, 0.680], [0.652, 0.700],
    [0.668, 0.728], [0.679, 0.753], [0.685, 0.778], [0.690, 0.807], [0.7045, 0.830],
    [0.716, 0.860], [0.727, 0.887],
  ],
  // Corners of the walk around the ground.
  corners: {
    northEast: { x: 0.708, y: 0.906 },
    northWest: { x: 0.664, y: 0.903 },
    southWest: { x: 0.646, y: 0.958 },
    southEast: { x: 0.705, y: 0.974 },
  },
  southStreet: [[0.672, 0.977]],
  stands: {
    trentEnd: { x: 0.657, y: 0.931, label: 'Trent End', area: { shape: 'rectangle', width: 0.012, height: 0.030, turn: 22 } },
    north: { x: 0.683, y: 0.920, label: 'North stand', area: { shape: 'rectangle', width: 0.034, height: 0.015, turn: 17 } },
    east: { x: 0.6985, y: 0.938, label: 'East stand', area: { shape: 'rectangle', width: 0.011, height: 0.024, turn: 22 } },
    awayEnd: { x: 0.692, y: 0.959, label: 'Away end', area: { shape: 'rectangle', width: 0.011, height: 0.016, turn: 22 } },
    south: { x: 0.670, y: 0.959, label: 'South stand', area: { shape: 'rectangle', width: 0.032, height: 0.014, turn: 18 } },
  },
};

/**
 * One crowd for one stand: its Entries with Start areas and shares, the
 * streets from each to the ground, and the stand as a Finish area.
 */
function matchDayCrowd(scene, { key, name, stand, entries, color, dotCount, seed }) {
  const prefix = `ex-fb-${key}`;
  const layer = scene.addFlowLayer({ id: `${prefix}-crowd`, name, guideType: 'graph' });
  const graph = layer.graph;
  const node = (id, spec, type) => graph.addNode({
    id: `${prefix}-${id}`, x: spec.x, y: spec.y, type, label: spec.label ?? '',
    ...(spec.area ? { area: spec.area } : {}),
  });
  const edge = (from, to) => graph.addEdge({
    id: `${prefix}-${from}-${to}`, sourceId: `${prefix}-${from}`, targetId: `${prefix}-${to}`, direction: 'one-way',
  });

  for (const [id, weight] of Object.entries(entries)) {
    graph.addNode({
      id: `${prefix}-${id}`, ...MATCH_DAY.entries[id], type: 'entry', entryWeight: weight,
    });
  }
  // The last steps differ by stand: each corner leads round the ground to it.
  const approaches = {
    trentEnd: [['northEast', 'northWest'], ['northWest', 'stand'], ['southWest', 'stand']],
    north: [['northEast', 'stand'], ['southWest', 'northWest'], ['northWest', 'stand']],
    east: [['northEast', 'stand'], ['southEast', 'stand']],
    awayEnd: [['northEast', 'southEast'], ['southEast', 'stand']],
    south: [['southWest', 'stand'], ['northEast', 'southEast'], ['southEast', 'stand']],
  }[stand];
  const fromNorth = entries.square || entries.station;
  const southStreet = entries.trentBridge && stand === 'east';

  // Only the corners this crowd walks through, so its network has no stray node.
  const corners = new Set(approaches.flat().filter(id => id !== 'stand'));
  if (fromNorth) corners.add('northEast');
  if (entries.trentBridge) corners.add('southWest');
  if (entries.coachPark || southStreet) corners.add('southEast');
  for (const [id, spec] of Object.entries(MATCH_DAY.corners)) {
    if (corners.has(id)) node(id, spec, 'normal');
  }
  node('stand', MATCH_DAY.stands[stand], 'exit');

  if (fromNorth) {
    node('stationStreet', MATCH_DAY.stationStreet, 'normal');
    if (entries.square) addChain(graph, `${prefix}-city`, `${prefix}-square`, MATCH_DAY.squareToStation, `${prefix}-stationStreet`);
    if (entries.station) edge('station', 'stationStreet');
    addChain(graph, `${prefix}-ladybay`, `${prefix}-stationStreet`, MATCH_DAY.ladyBay, `${prefix}-northEast`);
  }
  if (entries.trentBridge) edge('trentBridge', 'southWest');
  if (entries.coachPark) edge('coachPark', 'southEast');
  for (const [from, to] of approaches) edge(from, to);
  if (southStreet) {
    addChain(graph, `${prefix}-south`, `${prefix}-southWest`, MATCH_DAY.southStreet, `${prefix}-southEast`);
  }

  layer.addEmitter({
    id: `${prefix}-fans`, seed, dotCount, speed: 0.07, speedVariance: 0.3,
    dotSize: 0.08, dotColor: color, lifecycleMode: 'collect',
    releaseStart: 0, releaseDuration: 0.6, onsetVariance: 0.5,
    groups: true, groupSize: 3, groupWidth: 0.004,
  });
  return layer;
}

/**
 * Match day: fans from the Market Square and the station walk over Lady Bay
 * Bridge, others arrive over Trent Bridge, and each stand fills seat by seat.
 * Away fans come by train and coach to their own end. No route: the crowds
 * play on the base timeline alone (CROWD-08 part A).
 */
function matchDay() {
  const scene = new Scene();
  const home = { square: 1, station: 1, trentBridge: 2 };
  matchDayCrowd(scene, { key: 'trent', name: 'Trent End', stand: 'trentEnd', entries: home, color: HOME_RED, dotCount: 102, seed: 1865 });
  matchDayCrowd(scene, { key: 'north', name: 'North stand', stand: 'north', entries: home, color: HOME_RED, dotCount: 159, seed: 1866 });
  matchDayCrowd(scene, { key: 'south', name: 'South stand', stand: 'south', entries: home, color: HOME_RED, dotCount: 144, seed: 1867 });
  matchDayCrowd(scene, { key: 'east', name: 'East stand', stand: 'east', entries: home, color: HOME_RED, dotCount: 90, seed: 1868 });
  matchDayCrowd(scene, { key: 'away', name: 'Away fans', stand: 'awayEnd', entries: { station: 2, coachPark: 1 }, color: AWAY_BLUE, dotCount: 48, seed: 1869 });
  return { waypoints: [], scene };
}

/** Okabe-Ito colours for the riot: the mob and the crowd it gathers. */
const MOB_RED = '#D55E00';
const MARKET_YELLOW = '#F0E442';

/**
 * Reform riot, October 1831: a mob comes back into town from Colwick along
 * the river road, sweeps through the Market Square — where a crowd has
 * gathered, and follows — and climbs Friar Lane to Nottingham Castle.
 */
const RIOT = {
  colwick: { x: 0.975, y: 0.565, label: 'From Colwick', area: { shape: 'rectangle', width: 0.03, height: 0.03, turn: -30 } },
  // Colwick Road under the Sneinton escarpment, then up into Hockley.
  intoTown: [
    [0.940, 0.590], [0.888, 0.622], [0.850, 0.653], [0.800, 0.673], [0.740, 0.676],
    [0.700, 0.662], [0.676, 0.620], [0.660, 0.570], [0.640, 0.520], [0.625, 0.487],
    [0.590, 0.440], [0.520, 0.396], [0.450, 0.400], [0.420, 0.408], [0.355, 0.404],
  ],
  square: { x: 0.334, y: 0.399, label: 'Market Square', area: { shape: 'rectangle', width: 0.022, height: 0.016, turn: 0 } },
  // Friar Lane to the Castle gatehouse.
  friarLane: [[0.324, 0.408], [0.315, 0.430], [0.301, 0.463], [0.290, 0.495], [0.282, 0.518]],
  castle: { x: 0.256, y: 0.537, label: 'Nottingham Castle', area: { shape: 'ellipse', width: 0.036, height: 0.036, turn: 0 } },
  castleGate: { x: 0.284, y: 0.540, label: 'Castle gate', area: { shape: 'ellipse', width: 0.020, height: 0.026, turn: 0 } },
};

function reformRiot1831() {
  const scene = new Scene();

  const mob = scene.addFlowLayer({ id: 'ex-riot-mob', name: 'Rioters', guideType: 'graph' });
  mob.graph.addNode({ id: 'ex-riot-mob-colwick', ...RIOT.colwick, type: 'entry' });
  mob.graph.addNode({ id: 'ex-riot-mob-square', x: RIOT.square.x, y: RIOT.square.y, type: 'normal', label: RIOT.square.label });
  mob.graph.addNode({ id: 'ex-riot-mob-castle', ...RIOT.castle, type: 'exit' });
  addChain(mob.graph, 'ex-riot-mob-town', 'ex-riot-mob-colwick', RIOT.intoTown, 'ex-riot-mob-square');
  addChain(mob.graph, 'ex-riot-mob-friar', 'ex-riot-mob-square', RIOT.friarLane, 'ex-riot-mob-castle');
  mob.addEmitter({
    id: 'ex-riot-mob-dots', seed: 1831, dotCount: 348, speed: 0.07, speedVariance: 0.08,
    dotSize: 0.08, dotColor: MOB_RED, lifecycleMode: 'collect',
    releaseStart: 0, releaseDuration: 0.1, onsetVariance: 0.3,
    groups: true, groupSize: 12, groupWidth: 0.02,
  });

  // The Market Square crowd waits from the start (Final whistle, part G) and
  // leaves nearest first as the mob arrives.
  const market = scene.addFlowLayer({ id: 'ex-riot-market', name: 'Market Square crowd', guideType: 'graph' });
  market.graph.addNode({ id: 'ex-riot-market-square', ...RIOT.square, type: 'entry' });
  market.graph.addNode({ id: 'ex-riot-market-castle', ...RIOT.castleGate, type: 'exit' });
  addChain(market.graph, 'ex-riot-market-friar', 'ex-riot-market-square', RIOT.friarLane, 'ex-riot-market-castle');
  market.addEmitter({
    id: 'ex-riot-market-dots', seed: 1832, dotCount: 132, speed: 0.05, speedVariance: 0.3,
    dotSize: 0.08, dotColor: MARKET_YELLOW, lifecycleMode: 'collect',
    releaseStart: 0.5, releaseDuration: 0.25, onsetVariance: 0.3,
    waitAtStart: true,
  });

  return { waypoints: [], scene };
}

/** Everything a project snapshot needs beyond waypoints and scene. */
function snapshotFrom({ waypoints, scene }, { speed = 140, duration = 0 } = {}) {
  return {
    coordVersion: 9,
    waypoints: waypoints.map(waypoint => waypoint.toJSON()),
    scene: scene.toJSON(),
    styles: {
      pathColor: ROUTE_ORANGE, pathWidth: 4, dotSize: 10,
      pathHead: { style: 'arrow', color: ROUTE_ORANGE, size: 12, image: null, imageAssetId: null },
    },
    animationState: { mode: 'constant-speed', speed, duration },
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
    {
      id: 'city-ground-match-day',
      name: 'Match day',
      description: 'Fans walk from the Market Square, the station and Trent Bridge to fill the four stands of the City Ground; away fans come by train and coach.',
      backgroundSource: 'images/PARM_Aerial.jpg',
      project: snapshotFrom(matchDay(), { duration: 20000 }),
    },
    {
      id: 'reform-riot-1831',
      name: 'Reform riot, 1831',
      description: 'A mob from Colwick sweeps through the Market Square, gathering the crowd there, and climbs Friar Lane to Nottingham Castle.',
      backgroundSource: 'images/PARM_Aerial.jpg',
      project: snapshotFrom(reformRiot1831(), { duration: 24000 }),
    },
  ];
}

/** The example ids, in menu order. */
export function exampleProjectIds() {
  return buildExampleProjects().map(example => example.id);
}

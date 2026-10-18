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
 * Large enough to read as solid dots on the aerial. The stands' Finish areas
 * seat as many fans as fit at this size (CROWD-08 part C); the rest walk in.
 */
const FAN_DOT = 0.15;

/** Seated fans per stand: each Finish area's capacity at FAN_DOT, so no seat is shared. */
const SEATED = { trentEnd: 21, northStand: 33, eastStand: 21, awayEnd: 9, southStand: 33 };

/** A Start or Finish area, centred on its node (CROWD-08 parts B and C). */
function rect(width, height, turn = 0) {
  return { shape: 'rectangle', width, height, turn };
}

/**
 * The streets to the City Ground, on the PARM aerial of Nottingham. Every
 * point is a normalised position read off the bundled image; Entries carry
 * Start areas and stands carry Finish areas turned to the stand.
 */
const MATCH_DAY_POINTS = {
  // Where fans set off.
  square: { x: 0.334, y: 0.399, label: 'Market Square', area: rect(0.022, 0.016) },
  hockley: { x: 0.49, y: 0.395, label: 'Hockley', area: rect(0.016, 0.01) },
  bus: { x: 0.397, y: 0.565, label: 'Broadmarsh bus station', area: rect(0.03, 0.016) },
  station: { x: 0.468, y: 0.607, label: 'Station (rail and tram)', area: rect(0.05, 0.016) },
  north: { x: 0.428, y: 0.006, label: 'From the north', area: rect(0.012, 0.01) },
  east: { x: 0.975, y: 0.565, label: 'From Sneinton', area: rect(0.03, 0.02, -30) },
  west: { x: 0.006, y: 0.874, label: 'From the west, through the Meadows', area: rect(0.01, 0.014) },
  trentBridge: { x: 0.652, y: 0.990, label: 'Trent Bridge', area: rect(0.016, 0.012) },
  carParkNorth: { x: 0.688, y: 0.708, label: 'Meadow Lane car parks', area: rect(0.02, 0.016, -35) },
  carPark: { x: 0.722, y: 0.922, label: 'Ground car park', area: rect(0.016, 0.012, 20) },
  parkRide: { x: 0.733, y: 0.905, label: 'Park and ride drop-off', area: rect(0.01, 0.016, 25) },
  coachPark: { x: 0.716, y: 0.942, label: 'Coach park', area: rect(0.016, 0.012, 20) },
  pubLondonRoad: { x: 0.548, y: 0.655, label: 'Pubs on London Road', area: rect(0.01, 0.02) },
  pubStation: { x: 0.49, y: 0.585, label: 'Pubs by the station', area: rect(0.016, 0.01) },
  pubTrentBridge: { x: 0.668, y: 0.988, label: 'Pubs by Trent Bridge', area: rect(0.016, 0.01) },
  riverPath: { x: 0.785, y: 0.853, label: 'Riverside cycle path', area: rect(0.012, 0.01, -15) },
  cycleCity: { x: 0.527, y: 0.47, label: 'Cycle route from the city', area: rect(0.01, 0.012) },
  // Streets: the city to London Road, then east past the sidings to Lady Bay Bridge.
  c1: { x: 0.352, y: 0.412 }, c2: { x: 0.385, y: 0.445 }, c3: { x: 0.418, y: 0.480 },
  c4: { x: 0.419, y: 0.560 }, c5: { x: 0.421, y: 0.592 }, stationStreet: { x: 0.505, y: 0.592 },
  lr0: { x: 0.538, y: 0.594 }, lr1: { x: 0.540, y: 0.677 }, s1: { x: 0.600, y: 0.677 },
  s2: { x: 0.645, y: 0.680 }, s3: { x: 0.652, y: 0.700 }, s4: { x: 0.668, y: 0.728 },
  j: { x: 0.679, y: 0.753 }, b0: { x: 0.685, y: 0.778 }, bN: { x: 0.690, y: 0.807 },
  b1: { x: 0.7045, y: 0.830 }, bS: { x: 0.716, y: 0.860 }, b2: { x: 0.727, y: 0.887 },
  // Down from the north edge past the Victoria Centre to the square.
  n1: { x: 0.420, y: 0.030 }, n2: { x: 0.413, y: 0.060 }, n3: { x: 0.397, y: 0.093 },
  n4: { x: 0.402, y: 0.140 }, n5: { x: 0.405, y: 0.190 }, n6: { x: 0.401, y: 0.250 },
  n7: { x: 0.400, y: 0.316 }, n8: { x: 0.400, y: 0.360 }, n9: { x: 0.400, y: 0.405 },
  n10: { x: 0.375, y: 0.410 },
  // Hockley, past the arena, to London Road.
  h1: { x: 0.522, y: 0.400 }, h2: { x: 0.524, y: 0.450 }, h3: { x: 0.529, y: 0.500 },
  h4: { x: 0.531, y: 0.530 }, h5: { x: 0.535, y: 0.565 },
  // In from Sneinton along the Colwick Road.
  e1: { x: 0.940, y: 0.590 }, e2: { x: 0.888, y: 0.622 }, e3: { x: 0.850, y: 0.653 },
  e4: { x: 0.800, y: 0.673 }, e5: { x: 0.740, y: 0.676 }, e6: { x: 0.714, y: 0.692 },
  e7: { x: 0.692, y: 0.728 },
  // The riverside path on the south bank.
  r1: { x: 0.760, y: 0.857 }, r2: { x: 0.738, y: 0.872 },
  // Through the Meadows and down London Road to the Trent Bridge approach.
  w1: { x: 0.153, y: 0.876 }, w2: { x: 0.177, y: 0.820 }, w3: { x: 0.230, y: 0.800 },
  w4: { x: 0.330, y: 0.787 }, w5: { x: 0.370, y: 0.820 }, w6: { x: 0.420, y: 0.860 },
  w7: { x: 0.470, y: 0.880 }, w8: { x: 0.520, y: 0.910 },
  lrS1: { x: 0.540, y: 0.786 }, lrS2: { x: 0.543, y: 0.860 }, tbJ: { x: 0.541, y: 0.924 },
  t1: { x: 0.558, y: 0.940 }, t2: { x: 0.583, y: 0.973 },
  tbExit: { x: 0.609, y: 0.995, label: 'Over Trent Bridge' },
  // The walk round the ground.
  NE: { x: 0.708, y: 0.906 }, NW: { x: 0.664, y: 0.903 }, SW: { x: 0.646, y: 0.958 },
  SE: { x: 0.705, y: 0.974 }, S2: { x: 0.672, y: 0.977 },
  racks: { x: 0.700, y: 0.903, label: 'Bike racks' },
  // The stands.
  trentEnd: { x: 0.657, y: 0.931, label: 'Trent End', area: rect(0.012, 0.030, 22) },
  northStand: { x: 0.683, y: 0.920, label: 'North stand', area: rect(0.034, 0.015, 17) },
  eastStand: { x: 0.6985, y: 0.938, label: 'East stand', area: rect(0.011, 0.024, 22) },
  awayEnd: { x: 0.692, y: 0.959, label: 'Away end', area: rect(0.011, 0.016, 22) },
  southStand: { x: 0.670, y: 0.959, label: 'South stand', area: rect(0.032, 0.014, 18) },
};

/** From the Lady Bay junction on to the ground's north-east corner. */
const LADY_BAY = ['j', 'b0', 'bN', 'b1', 'bS', 'b2', 'NE'];
const LONDON_ROAD_EAST = ['lr0', 'lr1', 's1', 's2', 's3', 's4', ...LADY_BAY];
const CITY = ['c1', 'c2', 'c3', 'c4', 'c5', 'stationStreet', ...LONDON_ROAD_EAST];

/** Each arrival point's walk, in node order, to a corner of the ground. */
const MATCH_DAY_ROUTES = {
  square: ['square', ...CITY],
  north: ['north', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', ...CITY],
  hockley: ['hockley', 'h1', 'h2', 'h3', 'h4', 'h5', ...LONDON_ROAD_EAST],
  bus: ['bus', 'c4', 'c5', 'stationStreet', ...LONDON_ROAD_EAST],
  station: ['station', 'stationStreet', ...LONDON_ROAD_EAST],
  east: ['east', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', ...LADY_BAY],
  carParkNorth: ['carParkNorth', 'e7', ...LADY_BAY],
  carPark: ['carPark', 'NE'],
  parkRide: ['parkRide', 'NE'],
  trentBridge: ['trentBridge', 'SW'],
  coachPark: ['coachPark', 'SE'],
  pubLondonRoad: ['pubLondonRoad', 'lr1', 's1', 's2', 's3', 's4', ...LADY_BAY],
  pubStation: ['pubStation', 'stationStreet', ...LONDON_ROAD_EAST],
  pubTrentBridge: ['pubTrentBridge', 'SW'],
  riverPath: ['riverPath', 'r1', 'r2', 'b2', 'NE', 'racks'],
  cycleCity: ['cycleCity', 'h3', 'h4', 'h5', ...LONDON_ROAD_EAST, 'racks'],
  // Walkers who cross Trent Bridge off the map; their arrival is the Trent Bridge Entry.
  westToBridge: ['west', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'tbJ', 't1', 't2', 'tbExit'],
  stationToBridge: ['station', 'stationStreet', 'lr0', 'lr1', 'lrS1', 'lrS2', 'tbJ', 't1', 't2', 'tbExit'],
};

/** From a corner of the ground round to each stand. */
const STAND_APPROACHES = {
  trentEnd: [['NE', 'NW'], ['NW', 'trentEnd'], ['SW', 'trentEnd']],
  northStand: [['NE', 'northStand'], ['SW', 'NW'], ['NW', 'northStand']],
  eastStand: [['NE', 'eastStand'], ['SE', 'eastStand'], ['SW', 'S2'], ['S2', 'SE']],
  awayEnd: [['NE', 'SE'], ['SE', 'awayEnd']],
  southStand: [['SW', 'southStand'], ['NE', 'SE'], ['SE', 'southStand']],
};

/**
 * Build one crowd's network from the routes it uses: every route's nodes and
 * one-way edges, then the approaches from the corners it reaches to each of
 * its Exits. Nodes and edges are shared between routes, so a street drawn
 * once carries every crowd that walks it. Exits keep their Finish area only
 * when the crowd seats fans there.
 */
function matchDayNetwork(layer, prefix, { routes, entries, exits, seated }) {
  const graph = layer.graph;
  const nodes = new Map();
  const edges = new Set();
  const addNode = name => {
    if (nodes.has(name)) return;
    const point = MATCH_DAY_POINTS[name];
    const type = name in entries ? 'entry' : exits.includes(name) ? 'exit' : 'normal';
    const keepArea = point.area && (type === 'entry' || (type === 'exit' && seated));
    nodes.set(name, {
      id: `${prefix}-${name}`, x: point.x, y: point.y, type, label: point.label ?? '',
      ...(keepArea ? { area: point.area } : {}),
      ...(type === 'entry' ? { entryWeight: entries[name] } : {}),
    });
  };
  const addEdge = (from, to) => { addNode(from); addNode(to); edges.add(`${from}>${to}`); };
  for (const route of routes) {
    const path = MATCH_DAY_ROUTES[route];
    for (let i = 1; i < path.length; i++) addEdge(path[i - 1], path[i]);
  }
  // Approaches only from corners a route reaches, so no stray node is drawn.
  for (let added = true; added;) {
    added = false;
    for (const exit of exits) {
      for (const [from, to] of STAND_APPROACHES[exit] || []) {
        if (nodes.has(from) && !edges.has(`${from}>${to}`)) { addEdge(from, to); added = true; }
      }
    }
  }
  for (const node of nodes.values()) graph.addNode(node);
  for (const key of edges) {
    const [from, to] = key.split('>');
    graph.addEdge({ id: `${prefix}-${from}-${to}`, sourceId: `${prefix}-${from}`, targetId: `${prefix}-${to}`, direction: 'one-way' });
  }
}

/** The arrival points every home stand's fans come from, and their shares. */
const HOME_ARRIVALS = {
  square: 2, hockley: 1, bus: 1, station: 3, north: 2, east: 2,
  trentBridge: 3, carParkNorth: 1, carPark: 1, parkRide: 1,
};

/**
 * One crowd for one stand: seated fans fill its Finish area one to a seat,
 * and many more walk in and vanish into the stand, so the streets stay busy
 * however small the stand is at this map's scale.
 */
function matchDayStand(scene, { key, name, stand, arrivals, color, seated, walkIn, seed }) {
  const prefix = `ex-fb-${key}`;
  const layer = scene.addFlowLayer({ id: `${prefix}-crowd`, name, guideType: 'graph' });
  matchDayNetwork(layer, prefix, { routes: Object.keys(arrivals), entries: arrivals, exits: [stand], seated: true });
  const fans = { speed: 0.08, speedVariance: 0.3, dotSize: FAN_DOT, dotColor: color, onsetVariance: 0.5,
    groups: true, groupSize: 3, groupWidth: 0.004 };
  layer.addEmitter({ id: `${prefix}-seated`, seed, dotCount: seated, lifecycleMode: 'collect',
    releaseStart: 0, releaseDuration: 0.6, ...fans });
  layer.addEmitter({ id: `${prefix}-walk-in`, seed: seed + 100, dotCount: walkIn, lifecycleMode: 'disappear',
    releaseStart: 0, releaseDuration: 0.75, ...fans });
  return layer;
}

/**
 * Match day: fans converge on the City Ground from all over — the Market
 * Square and Hockley, the station and the bus station, the north, east and
 * west edges, Trent Bridge, the car parks and the park and ride — while
 * crowds wait at the pubs and cyclists come along the river. Each stand
 * fills seat by seat; away fans come by train and coach to their own end.
 * No route: the crowds play on the base timeline alone (CROWD-08 part A).
 */
function matchDay() {
  const scene = new Scene();
  matchDayStand(scene, { key: 'trent', name: 'Trent End', stand: 'trentEnd', arrivals: HOME_ARRIVALS, color: HOME_RED, seated: SEATED.trentEnd, walkIn: 240, seed: 1865 });
  matchDayStand(scene, { key: 'north', name: 'North stand', stand: 'northStand', arrivals: HOME_ARRIVALS, color: HOME_RED, seated: SEATED.northStand, walkIn: 300, seed: 1866 });
  matchDayStand(scene, { key: 'south', name: 'South stand', stand: 'southStand', arrivals: HOME_ARRIVALS, color: HOME_RED, seated: SEATED.southStand, walkIn: 300, seed: 1867 });
  matchDayStand(scene, { key: 'east', name: 'East stand', stand: 'eastStand', arrivals: HOME_ARRIVALS, color: HOME_RED, seated: SEATED.eastStand, walkIn: 210, seed: 1868 });
  matchDayStand(scene, { key: 'away', name: 'Away fans', stand: 'awayEnd', arrivals: { station: 2, coachPark: 2 }, color: AWAY_BLUE, seated: SEATED.awayEnd, walkIn: 120, seed: 1869 });

  // Crowds at the pubs from the start, leaving nearest first (Final whistle, part G).
  const pubs = scene.addFlowLayer({ id: 'ex-fb-pubs-crowd', name: 'Pre-match pubs', guideType: 'graph' });
  matchDayNetwork(pubs, 'ex-fb-pubs', {
    routes: ['pubLondonRoad', 'pubStation', 'pubTrentBridge'],
    entries: { pubLondonRoad: 1, pubStation: 1, pubTrentBridge: 1 },
    exits: ['trentEnd', 'northStand', 'eastStand', 'southStand'], seated: false,
  });
  pubs.addEmitter({ id: 'ex-fb-pubs-fans', seed: 1870, dotCount: 180, speed: 0.08, speedVariance: 0.3,
    dotSize: FAN_DOT, dotColor: HOME_RED, lifecycleMode: 'disappear',
    releaseStart: 0.3, releaseDuration: 0.4, onsetVariance: 0.3, waitAtStart: true });

  // Cyclists, faster, along the river and in from the city to the bike racks.
  const cyclists = scene.addFlowLayer({ id: 'ex-fb-cycle-crowd', name: 'Cyclists', guideType: 'graph' });
  matchDayNetwork(cyclists, 'ex-fb-cycle', {
    routes: ['riverPath', 'cycleCity'], entries: { riverPath: 1, cycleCity: 1 }, exits: ['racks'], seated: false,
  });
  cyclists.addEmitter({ id: 'ex-fb-cycle-riders', seed: 1871, dotCount: 60, speed: 0.22, speedVariance: 0.2,
    dotSize: FAN_DOT, dotColor: HOME_RED, lifecycleMode: 'disappear',
    releaseStart: 0.05, releaseDuration: 0.7, onsetVariance: 0.6, groups: true, groupSize: 2, groupWidth: 0.003 });

  // Walkers through the Meadows and down London Road to Trent Bridge.
  const toBridge = scene.addFlowLayer({ id: 'ex-fb-bridge-crowd', name: 'To Trent Bridge', guideType: 'graph' });
  matchDayNetwork(toBridge, 'ex-fb-bridge', {
    routes: ['westToBridge', 'stationToBridge'], entries: { west: 3, station: 2 }, exits: ['tbExit'], seated: false,
  });
  toBridge.addEmitter({ id: 'ex-fb-bridge-fans', seed: 1872, dotCount: 300, speed: 0.08, speedVariance: 0.3,
    dotSize: FAN_DOT, dotColor: HOME_RED, lifecycleMode: 'disappear',
    releaseStart: 0, releaseDuration: 0.7, onsetVariance: 0.5, groups: true, groupSize: 3, groupWidth: 0.004 });

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
      description: 'Fans converge on the City Ground from all over: the Market Square, the station and bus station, car parks, park and ride, pubs, cycle paths and every edge of the map. They fill its four stands; away fans come by train and coach.',
      backgroundSource: 'images/PARM_Aerial.jpg',
      project: snapshotFrom(matchDay(), { duration: 30000 }),
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

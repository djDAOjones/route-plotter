/**
 * DEMO-01 — the bundled examples, exercised as living fixtures.
 *
 * "Living" is the whole point: these are not stored snapshots of a format
 * nobody reads any more, they are built from the current models and loaded
 * through the app's own timing path. If the save shape, the branch model, the
 * crowd binding or the timeline maths drift, an example stops resolving and
 * this file says so — which is cheaper than finding out when someone opens one.
 */

import { describe, test, expect } from 'vitest';
import { buildExampleProjects, exampleProjectIds } from '../src/examples/index.js';
import { resolveRouteBranches } from '../src/utils/routeBranches.js';
import { resolveGraphAnchors, normaliseReleaseAnchor } from '../src/utils/routeAnchors.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { viewportMixin } from '../src/app/viewport.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { Scene } from '../src/models/Scene.js';
import { EventBus } from '../src/core/EventBus.js';
import { AnimationEngine } from '../src/services/AnimationEngine.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { CoordinateTransform } from '../src/services/CoordinateTransform.js';
import { CameraService } from '../src/services/CameraService.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { createFinishPackingContext, packFinishArea } from '../src/utils/finishArea.js';
import { groupsActive } from '../src/utils/groupSettings.js';
import { waitingActive } from '../src/utils/waitingSettings.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CANVAS_W = 1280;
const CANVAS_H = 720;

/** Rehydrate an example the way a load does, then time it the way the app does. */
function hydrate(example) {
  const waypoints = example.project.waypoints.map(data => Waypoint.fromJSON(data));
  const scene = Scene.fromJSON(example.project.scene);

  const app = {
    waypoints,
    scene,
    waypointsById: new Map(waypoints.map(waypoint => [waypoint.id, waypoint])),
    pathPoints: [],
    styles: example.project.styles,
    motionSettings: example.project.motionSettings,
    exportSettings: example.project.exportSettings,
    previewMode: true,
    elements: {},
    displayWidth: CANVAS_W,
    displayHeight: CANVAS_H,
    renderReference: { width: CANVAS_W, height: CANVAS_H },
    _waypointProgressCache: null,
    _majorWaypointsCache: null,
    _durationUpdateTimeout: null,
    queueRender() {},
    updateTimeDisplay() {},
    markDirty() {},
    pathCalculator: new PathCalculator(),
    coordinateTransform: new CoordinateTransform(),
    cameraService: new CameraService(),
    eventBus: new EventBus(),
    announce() {},
  };
  app.animationEngine = new AnimationEngine(app.eventBus);
  app.animationEngine.state.speed = example.project.animationState.speed;
  app.coordinateTransform.setCanvasDimensions(CANVAS_W, CANVAS_H);

  Object.assign(app, {
    calculatePath: pathTimingMixin.calculatePath,
    getWaypointProgressValues: pathTimingMixin.getWaypointProgressValues,
    getMajorWaypointPositions: pathTimingMixin.getMajorWaypointPositions,
    getMajorLegData: pathTimingMixin.getMajorLegData,
    hasSegmentSpeedVariations: pathTimingMixin.hasSegmentSpeedVariations,
    calculatePathDuration: pathTimingMixin.calculatePathDuration,
    getBranchTimeline: pathTimingMixin.getBranchTimeline,
    getRouteArrivalMap: pathTimingMixin.getRouteArrivalMap,
    updateAnimationDuration: pathTimingMixin.updateAnimationDuration,
    imageToCanvas: viewportMixin.imageToCanvas,
  });

  app.calculatePath();
  clearTimeout(app._durationUpdateTimeout);
  app.updateAnimationDuration();
  return app;
}

const examples = buildExampleProjects();
const byId = id => examples.find(example => example.id === id);

describe('the example catalogue', () => {
  test('ships exactly the approved examples, in menu order', () => {
    expect(exampleProjectIds()).toEqual([
      'parm-aerial-walk', 'uon-open-day', 'nervous-system-flow',
      'city-ground-match-day', 'reform-riot-1831',
    ]);
  });

  test('every example names itself and an approved background', () => {
    for (const example of examples) {
      expect(example.name.length).toBeGreaterThan(0);
      expect(example.description.length).toBeGreaterThan(0);
      expect(example.backgroundSource).toMatch(/^images\/.+\.(png|jpg|jpeg)$/);
    }
  });

  test('every example is a current-version snapshot', () => {
    for (const example of examples) {
      expect(example.project.coordVersion).toBe(9);
      expect(Array.isArray(example.project.waypoints)).toBe(true);
      expect(example.project.scene).toBeTruthy();
    }
  });

  test('building twice produces identical projects', () => {
    // Reproducibility is what keeps a rebuild from landing a fresh
    // multi-megabyte archive in history for no change at all.
    expect(JSON.stringify(buildExampleProjects()))
      .toBe(JSON.stringify(buildExampleProjects()));
  });

  test('ids are unique and URL-safe', () => {
    const ids = exampleProjectIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});

// The examples with a hero route. The crowd-only ones (EX-02) have no route
// to time, so they play on their base timeline and are checked further down.
const routeExamples = examples.filter(example => example.project.waypoints.length >= 2);
const crowdOnlyExamples = examples.filter(example => example.project.waypoints.length < 2);

describe('every route example rehydrates and times', () => {
  test('the route examples are the three DEMO-01 ones', () => {
    expect(routeExamples.map(example => example.id))
      .toEqual(['parm-aerial-walk', 'uon-open-day', 'nervous-system-flow']);
  });

  for (const example of routeExamples) {
    describe(example.id, () => {
      test('resolves a valid route structure', () => {
        const app = hydrate(example);
        const structure = resolveRouteBranches(app.waypoints);

        expect(structure.problems).toEqual([]);
      });

      test('builds a path and a positive timeline', () => {
        const app = hydrate(example);

        expect(app.pathPoints.length).toBeGreaterThan(1);
        expect(app.animationEngine.state.duration).toBeGreaterThan(0);
      });

      test('times identically on a second load', () => {
        expect(hydrate(example).animationEngine.state.duration)
          .toBeCloseTo(hydrate(example).animationEngine.state.duration, 9);
      });

      test('gives every waypoint an arrival', () => {
        const app = hydrate(example);
        const arrivals = app.getRouteArrivalMap();

        expect(arrivals).not.toBeNull();
        for (const waypoint of app.waypoints) {
          expect(Number.isFinite(arrivals.arrivalMsById[waypoint.id])).toBe(true);
        }
      });

      test('every crowd binding resolves', () => {
        const app = hydrate(example);
        const report = resolveGraphAnchors(app.scene, app.waypointsById);

        expect(report.broken).toEqual([]);
      });

      test('every crowd evaluates to dots somewhere on its timeline', () => {
        const app = hydrate(example);
        const layers = app.scene.getFlowLayers();
        if (layers.length === 0) return; // the no-crowd example

        const engine = new SwarmEngine();
        const durationMs = app.animationEngine.state.duration;
        const context = {
          durationMs,
          routePathPoints: app.pathPoints,
          routeAnchors: app.getRouteArrivalMap(),
        };
        for (const layer of layers) {
          const seen = [0.25, 0.5, 0.75, 0.95]
            .map(fraction => engine.evaluate(durationMs * fraction, layer, context).length);
          expect(Math.max(...seen)).toBeGreaterThan(0);
        }
      });
    });
  }
});

/** The pixel size of a bundled JPEG, read from its start-of-frame marker. */
function jpegSize(path) {
  const bytes = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', path));
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xFF) throw new Error(`${path}: not a JPEG marker at ${at}`);
    const marker = bytes[at + 1];
    if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) {
      return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    }
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error(`${path}: no JPEG frame`);
}

/** The engine context a crowd-only example plays in: its base timeline and its map. */
function crowdOnlyContext(example) {
  const { width, height } = jpegSize(example.backgroundSource);
  const durationMs = example.project.animationState.duration;
  return {
    durationMs,
    imageAspect: width / height,
    finishPackingContext: createFinishPackingContext({ imageWidth: width, imageHeight: height }),
    finishReleaseContext: { durationMs },
  };
}

describe('every crowd-only example loads and plays on its base timeline', () => {
  test('the crowd-only examples are the two EX-02 ones (Match day upgraded by EX-03)', () => {
    expect(crowdOnlyExamples.map(example => example.id))
      .toEqual(['city-ground-match-day', 'reform-riot-1831']);
  });

  for (const example of crowdOnlyExamples) {
    describe(example.id, () => {
      test('passes the load checks, with no route and a positive base timeline', () => {
        expect(() => Scene.assertValidJSON(example.project.scene)).not.toThrow();
        expect(example.project.waypoints).toEqual([]);
        expect(example.project.animationState.duration).toBeGreaterThan(0);
      });

      test('every crowd can play, shows dots and finishes', () => {
        const scene = Scene.fromJSON(example.project.scene);
        const engine = new SwarmEngine();
        const context = crowdOnlyContext(example);
        for (const layer of scene.getFlowLayers()) {
          expect(engine.canRelease(layer, context), layer.name).toBe(true);
          const seen = [0.25, 0.5, 0.75, 1]
            .map(fraction => engine.evaluate(context.durationMs * fraction, layer, context).length);
          expect(Math.max(...seen), layer.name).toBeGreaterThan(0);
          expect(Number.isFinite(engine.crowdFinishMs(layer, context)), layer.name).toBe(true);
        }
      });

      test('every Finish area seats all the dots that collect there, so no place is reused', () => {
        const scene = Scene.fromJSON(example.project.scene);
        const { finishPackingContext } = crowdOnlyContext(example);
        let seatedCrowds = 0;
        for (const layer of scene.getFlowLayers()) {
          // Only dots that collect take a place; dots that disappear walk in
          // and vanish (CROWD-08 part C), as Match day's walk-in fans do.
          const collecting = layer.emitters.filter(emitter => emitter.lifecycleMode === 'collect');
          if (collecting.length === 0) continue;
          seatedCrowds += 1;
          const dots = collecting.reduce((sum, emitter) => sum + emitter.dotCount, 0);
          // Seats are spaced for the crowd's largest dot, whatever its journey end.
          const dotSize = Math.max(...layer.emitters.map(emitter => emitter.dotSize));
          for (const exit of layer.graph.getNodesByType('exit')) {
            expect(exit.area, `${layer.name} finishes in an area`).toBeTruthy();
            const { capacity } = packFinishArea(exit.area, exit, finishPackingContext, dotSize, dots);
            expect(capacity, `${layer.name} holds its ${dots} dots`).toBeGreaterThanOrEqual(dots);
          }
        }
        expect(seatedCrowds).toBeGreaterThan(0);
      });

      test('every node leads one way to one of its crowd\'s Exits, with no dead end, cycle or stray node', () => {
        const scene = Scene.fromJSON(example.project.scene);
        for (const layer of scene.getFlowLayers()) {
          const graph = layer.graph;
          const onward = new Map(graph.getNodes().map(node => [node.id, []]));
          const reached = new Set();
          for (const edge of graph.getEdges()) {
            expect(edge.direction, `${layer.name} ${edge.id}`).toBe('one-way');
            onward.get(edge.sourceId).push(edge.targetId);
            reached.add(edge.targetId);
          }
          const exits = graph.getNodesByType('exit');
          expect(exits.length, `${layer.name} has an Exit`).toBeGreaterThan(0);
          for (const exit of exits) expect(onward.get(exit.id), `${layer.name}: ${exit.label} ends the walk`).toEqual([]);
          // No cycle: a dot never comes back to a node it has left.
          const state = new Map();
          const visit = id => {
            expect(state.get(id), `${layer.name}: a cycle through ${id}`).not.toBe('open');
            if (state.get(id) === 'done') return;
            state.set(id, 'open');
            for (const next of onward.get(id)) visit(next);
            state.set(id, 'done');
          };
          for (const node of graph.getNodes()) visit(node.id);
          for (const node of graph.getNodes()) {
            if (node.type !== 'entry') expect(reached.has(node.id), `${layer.name} reaches ${node.id}`).toBe(true);
            const seen = new Set([node.id]);
            const queue = [node.id];
            while (queue.length) for (const next of onward.get(queue.shift())) {
              if (!seen.has(next)) { seen.add(next); queue.push(next); }
            }
            expect(exits.some(exit => seen.has(exit.id)), `${layer.name}: ${node.id} reaches an Exit`).toBe(true);
          }
        }
      });

      test('every Entry carries a Start area', () => {
        const scene = Scene.fromJSON(example.project.scene);
        for (const layer of scene.getFlowLayers()) {
          const entries = layer.graph.getNodesByType('entry');
          expect(entries.length, layer.name).toBeGreaterThan(0);
          for (const entry of entries) expect(entry.area, `${layer.name} ${entry.label}`).toBeTruthy();
        }
      });
    });
  }
});

describe('each example demonstrates what it claims to', () => {
  test('the site walk is a plain unbranched route with no crowd', () => {
    const example = byId('parm-aerial-walk');
    const app = hydrate(example);

    expect(resolveRouteBranches(app.waypoints).isLinear).toBe(true);
    expect(app.scene.getFlowLayers()).toHaveLength(0);
    expect(app.waypoints.some(waypoint => waypoint.isMajor === false)).toBe(true);
  });

  test('the open day route branches, rejoins, and carries a bound crowd', () => {
    const app = hydrate(byId('uon-open-day'));
    const structure = resolveRouteBranches(app.waypoints);

    expect(structure.branches).toHaveLength(1);
    expect(structure.branches[0].terminal).toBe(false);
    expect(structure.branches[0].rejoinAtId).toBe('ex-uon-3');

    const [crowd] = app.scene.getFlowLayers();
    expect(crowd.guideType).toBe('graph');
    // Traced from the route, so every node follows a waypoint…
    expect(crowd.graph.getNodes().every(node => node.anchorWaypointId)).toBe(true);
    // …and the release is pinned to a route moment.
    expect(normaliseReleaseAnchor(crowd.getEmitters()[0].releaseAnchor))
      .toEqual({ waypointId: 'ex-uon-1', at: 'arrival' });
  });

  test('the branch shows up in the composed timeline as a join wait', () => {
    const app = hydrate(byId('uon-open-day'));
    const timeline = app.getBranchTimeline();

    expect(timeline).not.toBeNull();
    expect(Object.keys(timeline.joinWaitsById)).toContain('ex-uon-3');
    expect(timeline.unresolved).toEqual([]);
  });

  test('the signal flow is a weighted network with two streams and no branch', () => {
    const app = hydrate(byId('nervous-system-flow'));
    const [crowd] = app.scene.getFlowLayers();

    expect(resolveRouteBranches(app.waypoints).isLinear).toBe(true);
    expect(crowd.getEmitters()).toHaveLength(2);
    expect(crowd.graph.getEdges().some(edge => edge.weight !== 1)).toBe(true);
    expect(crowd.graph.getNodesByType('entry')).toHaveLength(1);
    expect(crowd.graph.getNodesByType('exit')).toHaveLength(1);
  });

  test('match day gathers fans from all over into the City Ground\'s four stands, home and away', () => {
    const scene = Scene.fromJSON(byId('city-ground-match-day').project.scene);
    const crowds = scene.getFlowLayers();

    expect(crowds.map(crowd => crowd.name)).toEqual([
      'Trent End', 'North stand', 'South stand', 'East stand', 'Away fans',
      'Pre-match pubs', 'Cyclists', 'To Trent Bridge',
    ]);
    const labels = crowd => crowd.graph.getNodesByType('entry').map(entry => entry.label);
    const [home, away] = [crowds.slice(0, 4), crowds[4]];
    for (const crowd of home) {
      // From the town centre, the station and buses, every edge, the car parks and the park and ride.
      expect(labels(crowd)).toEqual(expect.arrayContaining([
        'Market Square', 'Hockley', 'Broadmarsh bus station', 'Station (rail and tram)',
        'From the north', 'From Sneinton', 'Trent Bridge',
        'Meadow Lane car parks', 'Ground car park', 'Park and ride drop-off',
      ]));
    }
    expect(labels(away)).toEqual(['Station (rail and tram)', 'Coach park']);
    expect(labels(crowds[5])).toEqual(['Pubs on London Road', 'Pubs by the station', 'Pubs by Trent Bridge']);
    expect(labels(crowds[6])).toEqual(['Riverside cycle path', 'Cycle route from the city']);
    expect(labels(crowds[7])).toEqual(['From the west, through the Meadows', 'Station (rail and tram)']);

    // Each stand's crowd seats some fans and walks the rest in, so the streets stay busy.
    for (const crowd of crowds.slice(0, 5)) {
      expect(crowd.emitters.map(emitter => emitter.lifecycleMode)).toEqual(['collect', 'disappear']);
      expect(crowd.emitters[1].dotCount).toBeGreaterThan(crowd.emitters[0].dotCount);
      for (const fans of crowd.emitters) expect(groupsActive(crowd, fans), crowd.name).toBe(true);
    }
    // The pubs' crowds wait from the start; cyclists ride faster than fans walk.
    expect(waitingActive(crowds[5], crowds[5].emitters[0])).toBe(true);
    expect(crowds[6].emitters[0].speed).toBeGreaterThan(crowds[0].emitters[0].speed);

    // Solid dots, all one size; home red and away blue.
    const emitters = crowds.flatMap(crowd => crowd.emitters);
    expect(new Set(emitters.map(emitter => emitter.dotSize))).toEqual(new Set([0.15]));
    expect(new Set(home.map(crowd => crowd.emitters[0].dotColor)).size).toBe(1);
    expect(away.emitters[0].dotColor).not.toBe(home[0].emitters[0].dotColor);
    for (const crowd of crowds) {
      expect(crowd.graph.getEdges().every(edge => edge.direction === 'one-way')).toBe(true);
    }
  });

  test('the riot passes through the Market Square, gathers its crowd and ends at the Castle', () => {
    const scene = Scene.fromJSON(byId('reform-riot-1831').project.scene);
    const [mob, market] = scene.getFlowLayers();

    expect(mob.graph.getNodesByType('entry').map(entry => entry.label)).toEqual(['From Colwick']);
    // The mob walks through the square on its way, not to it.
    expect(mob.graph.getNodes().find(node => node.label === 'Market Square').type).toBe('normal');
    expect(groupsActive(mob, mob.emitters[0])).toBe(true);

    expect(market.graph.getNodesByType('entry').map(entry => entry.label)).toEqual(['Market Square']);
    expect(waitingActive(market, market.emitters[0])).toBe(true);
    // The square's crowd sets off after the mob's release has ended.
    const mobWindowEnd = mob.emitters[0].releaseStart + mob.emitters[0].releaseDuration;
    expect(market.emitters[0].releaseStart).toBeGreaterThan(mobWindowEnd);

    // …and, played out, waits in the square until the mob gets there.
    const example = byId('reform-riot-1831');
    const context = crowdOnlyContext(example);
    const engine = new SwarmEngine();
    const [square] = market.graph.getNodesByType('entry');
    const inSquare = dot => Math.abs(dot.x - square.x) <= square.area.width / 2
      && Math.abs(dot.y - square.y) <= square.area.height / 2;
    const first = (layer, test) => {
      for (let ms = 0; ms <= context.durationMs; ms += 100) {
        if (engine.evaluate(ms, layer, context).some(test)) return ms;
      }
      return Infinity;
    };
    const mobArrives = first(mob, inSquare);
    const crowdLeaves = first(market, dot => !inSquare(dot));
    const waiting = engine.evaluate(0, market, context);
    expect(waiting).toHaveLength(market.emitters[0].dotCount);
    expect(waiting.every(inSquare)).toBe(true);
    expect(mobArrives).toBeLessThan(context.durationMs);
    expect(crowdLeaves).toBeLessThan(context.durationMs);
    expect(crowdLeaves).toBeGreaterThanOrEqual(mobArrives);

    for (const crowd of [mob, market]) {
      expect(crowd.emitters[0].lifecycleMode).toBe('collect');
      expect(crowd.graph.getNodesByType('exit').map(exit => exit.label)[0]).toMatch(/^(Nottingham Castle|Castle gate)$/);
    }
  });
});

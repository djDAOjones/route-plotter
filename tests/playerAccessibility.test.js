import { afterEach, describe, expect, test, vi } from 'vitest';
import { Waypoint } from '../src/models/Waypoint.js';
import { Scene } from '../src/models/Scene.js';
import {
  createTransportAnnouncer,
  formatPlayerSceneSummary,
  renderPlayerSceneSummary,
  summarizePlayerScene,
} from '../src/player/playerAccessibility.js';

function buildSceneFixture() {
  const majorWithPolygon = Waypoint.createMajor(0.1, 0.2);
  majorWithPolygon.name = '<img src=x onerror=alert(1)>';
  majorWithPolygon.label = 'Private room name';
  majorWithPolygon.areaHighlight.enabled = true;
  majorWithPolygon.areaHighlight.shape = 'polygon';
  majorWithPolygon.areaHighlight.points = [
    { x: 0.1, y: 0.1 },
    { x: 0.3, y: 0.1 },
    { x: 0.2, y: 0.3 },
  ];

  const minor = Waypoint.createMinor(0.5, 0.5);
  const majorWithCircle = Waypoint.createMajor(0.8, 0.9);
  majorWithCircle.areaHighlight.enabled = true;
  majorWithCircle.areaHighlight.shape = 'circle';

  const scene = new Scene();
  const routeLayer = scene.addFlowLayer({
    name: '</p><script>window.summaryInjected=true</script>',
    guideType: 'route',
  });
  routeLayer.addEmitter({ seed: 10, dotCount: 24 });
  // Route-guided layers retain dormant graph data for later editing. It is
  // not rendered and must not inflate the exported scene summary.
  routeLayer.graph.addNode({ x: 0.4, y: 0.4, type: 'normal' });

  const graphLayer = scene.addFlowLayer({ name: 'Visitors', guideType: 'graph' });
  const entry = graphLayer.graph.addNode({ x: 0.2, y: 0.3, type: 'entry' });
  const exit = graphLayer.graph.addNode({ x: 0.8, y: 0.7, type: 'exit' });
  graphLayer.graph.addEdge({ sourceId: entry.id, targetId: exit.id });
  graphLayer.addEmitter({ seed: 11, dotCount: 12 });

  const hiddenLayer = scene.addFlowLayer({ name: 'Hidden authoring layer', guideType: 'graph', visible: false });
  hiddenLayer.addEmitter({ seed: 12, dotCount: 500 });
  hiddenLayer.graph.addNode({ x: 0.5, y: 0.5, type: 'entry' });

  return {
    waypoints: [majorWithPolygon, minor, majorWithCircle],
    scene,
    animationEngine: { state: { duration: 65000 } },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('standalone player scene summary', () => {
  test('reports only visible-scene aggregate counts from canonical models', () => {
    const player = buildSceneFixture();
    const summary = summarizePlayerScene(player);

    expect(summary).toEqual({
      timeline: { durationMs: 65000 },
      route: { waypoints: 3, majorWaypoints: 2, minorWaypoints: 1 },
      crowds: { layers: 2, emitters: 2, configuredDots: 36 },
      networks: { customNetworks: 1, nodes: 2, edges: 1 },
      highlights: { areas: 2, polygons: 1, polygonVertices: 3 },
    });
    expect(formatPlayerSceneSummary(summary)).toBe(
      'Timeline: 1:05. ' +
      'Route: 3 waypoints (2 major, 1 minor). ' +
      'Crowds: 2 layers, 2 emitters, 36 configured dots. ' +
      'Custom networks: 1 network, 2 nodes, 1 edge. ' +
      'Highlights: 2 areas, 1 polygon, 3 polygon vertices.'
    );
  });

  test('renders with textContent and never repeats authored strings or markup', () => {
    const player = buildSceneFixture();
    const element = document.createElement('p');

    renderPlayerSceneSummary(element, player);

    expect(element.childElementCount).toBe(0);
    expect(element.textContent).not.toContain('Private room name');
    expect(element.textContent).not.toContain('summaryInjected');
    expect(element.textContent).not.toContain('0.1');
    expect(element.textContent).not.toContain('fl_');
  });

  test('handles an empty scene with explicit zero counts', () => {
    const text = formatPlayerSceneSummary(summarizePlayerScene({ waypoints: [], scene: new Scene() }));

    expect(text).toBe(
      'Timeline: no playable route timeline. ' +
      'Route: 0 waypoints (0 major, 0 minor). ' +
      'Crowds: 0 layers, 0 emitters, 0 configured dots. ' +
      'Custom networks: 0 networks, 0 nodes, 0 edges. ' +
      'Highlights: 0 areas, 0 polygons, 0 polygon vertices.'
    );
  });

  test('uses route truthiness for accepted legacy major-waypoint values', () => {
    const summary = summarizePlayerScene({
      waypoints: [{ isMajor: 1 }, { isMajor: 0 }, { isMajor: 'legacy-major' }],
      scene: new Scene(),
    });

    expect(summary.route).toEqual({
      waypoints: 3,
      majorWaypoints: 2,
      minorWaypoints: 1,
    });
  });
});

describe('standalone player transport announcer', () => {
  test('announces only explicit milestones and coalesces repeated arrow seeks', () => {
    vi.useFakeTimers();
    const region = document.createElement('div');
    const announcer = createTransportAnnouncer(region);
    const state = { currentTime: 5000, duration: 65000 };

    announcer.ready({
      timeline: { durationMs: 65000 },
      route: { majorWaypoints: 2 },
      crowds: { layers: 1 },
    });
    expect(region.textContent).toBe('Ready. 1:05 timeline, 2 major waypoints, 1 crowd layer.');

    announcer.scheduleKeyboardSeek({ currentTime: 6000, duration: 65000 });
    announcer.scheduleKeyboardSeek({ currentTime: 7000, duration: 65000 });
    vi.advanceTimersByTime(299);
    expect(region.textContent).toBe('Ready. 1:05 timeline, 2 major waypoints, 1 crowd layer.');
    vi.advanceTimersByTime(1);
    expect(region.textContent).toBe('Moved to 0:07 of 1:05.');

    announcer.play(state);
    expect(region.textContent).toBe('Playing from 0:05.');
    announcer.pause(state);
    expect(region.textContent).toBe('Paused at 0:05.');
    announcer.reset();
    expect(region.textContent).toBe('Reset to start, 0:00.');
    announcer.end(state);
    expect(region.textContent).toBe('Moved to end, 1:05.');
    announcer.committedSeek(state);
    expect(region.textContent).toBe('Moved to 0:05 of 1:05.');
    announcer.speed(1.5);
    expect(region.textContent).toBe('Playback speed set to 1.5 times normal.');
    announcer.speed(1);
    expect(region.textContent).toBe('Playback speed set to normal.');
    announcer.complete(state);
    expect(region.textContent).toBe('Playback complete at 1:05.');
  });

  test('a later completion cancels a pending keyboard-seek message', () => {
    vi.useFakeTimers();
    const region = document.createElement('div');
    const announcer = createTransportAnnouncer(region);
    const state = { currentTime: 65000, duration: 65000 };

    announcer.scheduleKeyboardSeek(state);
    announcer.complete(state);
    vi.advanceTimersByTime(1000);

    expect(region.textContent).toBe('Playback complete at 1:05.');
  });
});

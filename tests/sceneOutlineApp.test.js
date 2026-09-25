import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { NetworkEditService } from '../src/services/NetworkEditService.js';
import { sceneOutlineMixin } from '../src/app/sceneOutline.js';
import { sceneOutlineKey } from '../src/utils/sceneSemantics.js';
import { IMAGE_COORDINATES } from '../src/config/constants.js';

function makeApp() {
  const eventBus = new EventBus();
  const app = {
    eventBus,
    scene: new Scene(),
    waypoints: [],
    networkEditService: new NetworkEditService(eventBus),
    selectedWaypoint: null,
    selectedWaypoints: [],
    selectedCrowd: null,
    pathPoints: [],
    undoSaves: 0,
    autoSaves: 0,
    renders: 0,
    pathCalculations: 0,
    announced: [],
    _sceneOutlineSelectionKey: null,
    _sceneOutlineFocusKey: null,
    _sceneOutlineRefreshQueued: false,
    getWaypointById(id) { return this.waypoints.find(waypoint => waypoint.id === id); },
    saveUndoState() { this.undoSaves += 1; },
    autoSave() { this.autoSaves += 1; },
    queueRender() { this.renders += 1; },
    calculatePath() { this.pathCalculations += 1; },
    updateAnimationDuration: vi.fn(),
    updateWaypointList: vi.fn(),
    updateWaypointEditor: vi.fn(),
    updateLayersStrip: vi.fn(),
    syncCrowdEditor: vi.fn(),
    updateGuideCard: vi.fn(),
    announce(message) { this.announced.push(message); },
    deleteCrowd(layer) {
      const wasSelected = this.selectedCrowd === layer;
      if (!this.scene.removeFlowLayer(layer.id)) return;
      if (wasSelected) {
        this.selectedCrowd = null;
        this.eventBus.emit('crowd:deselected');
      }
      this.saveUndoState();
      this.autoSave();
      this.queueRender();
    },
    uiController: { updateWaypointEditor: vi.fn() },
  };
  Object.assign(app, sceneOutlineMixin);

  eventBus.on('network:changed', ({ commit } = {}) => {
    if (commit) {
      app.saveUndoState();
      app.autoSave();
    }
    app.queueRender();
  });
  eventBus.on('crowd:selected', layer => { app.selectedCrowd = layer; });
  eventBus.on('waypoint:selected', waypoint => {
    app.selectedWaypoint = waypoint;
    app.selectedWaypoints = waypoint ? [waypoint] : [];
  });
  eventBus.on('waypoint:delete', waypoint => {
    const index = app.waypoints.indexOf(waypoint);
    if (index < 0) return;
    app.waypoints.splice(index, 1);
    app.selectedWaypoints = app.selectedWaypoints.filter(item => item !== waypoint);
    if (app.selectedWaypoint === waypoint) {
      app.selectedWaypoint = app.selectedWaypoints.at(-1) || null;
    }
  });
  return app;
}

function addGraphLayer(app) {
  const layer = app.scene.addFlowLayer({
    id: 'crowd-a', name: 'Visitors', guideType: 'graph', emitters: [{ id: 'emitter-a' }],
  });
  return layer;
}

describe('scene-outline command adapter', () => {
  let app;

  beforeEach(() => {
    document.body.innerHTML = '';
    app = makeApp();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('adds and connects normalized graph geometry with one commit per command', () => {
    const layer = addGraphLayer(app);
    const error = vi.fn();
    app.eventBus.on('scene-outline:error', error);

    app._handleSceneOutlineCommand({
      action: 'add-node', layerId: layer.id, x: '25', y: '75', type: 'entry', label: 'Door',
    });
    app._handleSceneOutlineCommand({
      action: 'add-node', layerId: layer.id, x: '80', y: '20', type: 'exit', label: 'Hall',
    });

    const [source, target] = layer.graph.getNodes();
    expect(source).toMatchObject({ x: 0.25, y: 0.75, type: 'entry', label: 'Door' });
    expect(target).toMatchObject({ x: 0.8, y: 0.2, type: 'exit', label: 'Hall' });
    expect(app.undoSaves).toBe(2);
    expect(app.autoSaves).toBe(2);
    expect(app.networkEditService.active).toBe(false);
    expect(app.networkEditService.layer).toBe(layer);

    app._handleSceneOutlineCommand({
      action: 'connect-nodes',
      layerId: layer.id,
      sourceId: source.id,
      targetId: target.id,
      direction: 'one-way',
      weight: '2.5',
    });

    expect(layer.graph.getEdges()).toHaveLength(1);
    expect(layer.graph.getEdges()[0]).toMatchObject({
      sourceId: source.id, targetId: target.id, direction: 'one-way', weight: 2.5,
    });
    expect(app.undoSaves).toBe(3);
    expect(app.autoSaves).toBe(3);
    expect(app.networkEditService.active).toBe(false);

    app._handleSceneOutlineCommand({
      action: 'connect-nodes',
      layerId: layer.id,
      sourceId: source.id,
      targetId: target.id,
      direction: 'two-way',
      weight: '1',
      outlineFormKey: 'network:crowd-a:connect',
    });
    expect(layer.graph.getEdges()).toHaveLength(1);
    expect(app.undoSaves).toBe(3);
    expect(error).toHaveBeenLastCalledWith({
      formKey: 'network:crowd-a:connect',
      message: 'Those nodes are already connected.',
    });
  });

  test('rejects invalid numeric drafts without mutation and reports their form', () => {
    const layer = addGraphLayer(app);
    const error = vi.fn();
    app.eventBus.on('scene-outline:error', error);

    app._handleSceneOutlineCommand({
      action: 'add-node',
      layerId: layer.id,
      x: 'Infinity',
      y: '20',
      type: 'normal',
      label: '',
      outlineFormKey: 'network:crowd-a:add-node',
    });

    expect(layer.graph.getNodes()).toHaveLength(0);
    expect(app.undoSaves).toBe(0);
    expect(app.autoSaves).toBe(0);
    expect(error).toHaveBeenCalledWith({
      formKey: 'network:crowd-a:add-node',
      message: 'Horizontal position must be between 0 and 100.',
    });
  });

  test('validates complete edits before mutating node, edge, or polygon state', () => {
    const layer = addGraphLayer(app);
    const source = layer.graph.addNode({ id: 'node-source', x: 0.1, y: 0.2, type: 'normal', label: 'Start' });
    const target = layer.graph.addNode({ id: 'node-target', x: 0.8, y: 0.9 });
    const edge = layer.graph.addEdge({
      id: 'edge-a', sourceId: source.id, targetId: target.id, direction: 'two-way', weight: 2,
    });
    const waypoint = new Waypoint({
      id: 'wp-area',
      areaHighlight: { shape: 'polygon', fadeInMs: 500, fadeOutMs: 750, points: [{}, {}, {}] },
    });
    app.waypoints = [waypoint];
    const error = vi.fn();
    app.eventBus.on('scene-outline:error', error);

    app._handleSceneOutlineCommand({
      action: 'update-node', layerId: layer.id, nodeId: source.id,
      x: '90', y: '95', type: 'exit', label: 'x'.repeat(201), outlineFormKey: 'node-edit',
    });
    expect(source).toMatchObject({ x: 0.1, y: 0.2, type: 'normal', label: 'Start' });

    app._handleSceneOutlineCommand({
      action: 'update-edge', layerId: layer.id, edgeId: edge.id,
      direction: 'one-way', weight: '0', outlineFormKey: 'edge-edit',
    });
    expect(edge).toMatchObject({ direction: 'two-way', weight: 2 });

    app._handleSceneOutlineCommand({
      action: 'update-polygon-timing', waypointId: waypoint.id,
      fadeInSeconds: '9', fadeOutSeconds: 'not-a-number', outlineFormKey: 'polygon-edit',
    });
    expect(waypoint.areaHighlight).toMatchObject({ fadeInMs: 500, fadeOutMs: 750 });
    expect(error).toHaveBeenCalledTimes(3);
    expect(app.undoSaves).toBe(0);
    expect(app.autoSaves).toBe(0);
  });

  test('preserves canonical decimals when another field in the form changes', () => {
    const x = 0.12345678901234566;
    const y = 0.8765432109876543;
    const waypoint = new Waypoint({
      id: 'wp-precise', imgX: x, imgY: y, isMajor: true,
      pauseTime: 1234, segmentSpeed: 1,
    });
    app.waypoints = [waypoint];

    app._handleSceneOutlineCommand({
      action: 'update-waypoint',
      waypointId: waypoint.id,
      x: String(x * 100),
      y: String(y * 100),
      waitSeconds: String(waypoint.pauseTime / 1000),
      segmentSpeed: '2',
      outlineOriginalValues: {
        x: { display: String(x * 100), canonical: String(x) },
        y: { display: String(y * 100), canonical: String(y) },
        waitSeconds: { display: String(waypoint.pauseTime / 1000), canonical: '1234' },
      },
    });

    expect(Object.is(waypoint.imgX, x)).toBe(true);
    expect(Object.is(waypoint.imgY, y)).toBe(true);
    expect(waypoint.pauseTime).toBe(1234);
    expect(waypoint.segmentSpeed).toBe(2);
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);
  });

  test('edits and adds points off the image, as far as a project can store one (DEF-35)', () => {
    // The adapter took positions of 0–100% only, and `Waypoint.setPosition`
    // pulled a waypoint back onto the image, so a point off it could not keep
    // its place, be typed there or be given a polygon around it.
    const waypoint = new Waypoint({
      id: 'wp-off', imgX: -0.4, imgY: 1.35, isMajor: true, pauseTime: 1000, segmentSpeed: 1,
      areaHighlight: { shape: 'none' },
    });
    app.waypoints = [waypoint];
    const error = vi.fn();
    app.eventBus.on('scene-outline:error', error);
    const update = (x, y, outlineOriginalValues) => app._handleSceneOutlineCommand({
      action: 'update-waypoint', waypointId: waypoint.id, x, y, waitSeconds: '2', segmentSpeed: '1',
      outlineFormKey: 'waypoint:wp-off:apply', ...(outlineOriginalValues ? { outlineOriginalValues } : {}),
    });

    // Its wait changes, and its position stays where it was.
    update('-40', '135', {
      x: { display: '-40', canonical: String(-0.4) },
      y: { display: '135', canonical: String(1.35) },
    });
    expect([waypoint.imgX, waypoint.imgY, waypoint.pauseTime]).toEqual([-0.4, 1.35, 2000]);

    // A position typed off the image is stored there, to the edge of the range.
    const { MIN, MAX } = IMAGE_COORDINATES;
    update(String(MIN * 100), String(MAX * 100));
    expect([waypoint.imgX, waypoint.imgY]).toEqual([MIN, MAX]);
    update('-20', '150');
    expect([waypoint.imgX, waypoint.imgY]).toEqual([-0.2, 1.5]);
    update(String(MIN * 100 - 1), '150');
    expect(error).toHaveBeenLastCalledWith({
      formKey: 'waypoint:wp-off:apply',
      message: `Horizontal position must be between ${MIN * 100} and ${MAX * 100}.`,
    });
    expect([waypoint.imgX, waypoint.imgY]).toEqual([-0.2, 1.5]);

    // A new polygon surrounds its waypoint off the image, and its vertices
    // can be added and moved there.
    app._handleSceneOutlineCommand({ action: 'create-polygon', waypointId: waypoint.id });
    const [x, y] = [-0.2, 1.5];
    expect(waypoint.areaHighlight.points).toEqual([
      { x, y: y - 0.04 }, { x: x - 0.04, y: y + 0.04 }, { x: x + 0.04, y: y + 0.04 },
    ]);
    app._handleSceneOutlineCommand({ action: 'add-vertex', waypointId: waypoint.id, x: '-35', y: '160' });
    expect(waypoint.areaHighlight.points.at(-1)).toEqual({ x: -0.35, y: 1.6 });
    app._handleSceneOutlineCommand({
      action: 'update-vertex', waypointId: waypoint.id, index: '0', x: '-30', y: '140',
    });
    expect(waypoint.areaHighlight.points[0]).toEqual({ x: -0.3, y: 1.4 });

    // A waypoint is added off the image, and a polygon around one at the edge
    // of the range stays inside it, so the project still reloads.
    const added = vi.fn(({ imgX, imgY, isMajor }) => {
      app.waypoints.push(new Waypoint({ id: 'wp-edge', imgX, imgY, isMajor, areaHighlight: { shape: 'none' } }));
    });
    app.eventBus.on('waypoint:add', added);
    app._handleSceneOutlineCommand({
      action: 'add-waypoint', kind: 'major', x: String(MIN * 100), y: String(MAX * 100),
    });
    expect(added.mock.lastCall[0]).toMatchObject({ imgX: MIN, imgY: MAX, isMajor: true });
    const edge = app.waypoints.at(-1);
    app._handleSceneOutlineCommand({ action: 'create-polygon', waypointId: edge.id });
    expect(edge.areaHighlight.points).toEqual([
      { x: MIN, y: MAX - 0.04 }, { x: MIN, y: MAX }, { x: MIN + 0.04, y: MAX },
    ]);
  });

  test('keeps a new polygon on the image round a waypoint on it (DEF-35)', () => {
    // Only a waypoint off the image gets a polygon that leaves the image. One
    // on the image beside its edge keeps the squeezed triangle it always had.
    const waypoint = new Waypoint({
      id: 'wp-top', imgX: 0.5, imgY: 0, isMajor: true, areaHighlight: { shape: 'none' },
    });
    app.waypoints = [waypoint];
    app._handleSceneOutlineCommand({ action: 'create-polygon', waypointId: waypoint.id });
    expect(waypoint.areaHighlight.points).toEqual([
      { x: 0.5, y: 0 }, { x: 0.5 - 0.04, y: 0.04 }, { x: 0.5 + 0.04, y: 0.04 },
    ]);
  });

  test('refuses positions past the range on each image-point command, and past 0–100% for networks (DEF-35)', () => {
    const { MIN, MAX } = IMAGE_COORDINATES;
    const waypoint = new Waypoint({
      id: 'wp-bounds', imgX: 0.5, imgY: 0.5, isMajor: true, pauseTime: 1000, segmentSpeed: 1,
      areaHighlight: { shape: 'polygon', points: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.6 }] },
    });
    app.waypoints = [waypoint];
    const layer = addGraphLayer(app);
    const node = layer.graph.addNode({ id: 'node-a', x: 0.1, y: 0.2 });
    layer.graph.addNode({ id: 'node-b', x: 0.8, y: 0.9 });
    const edge = layer.graph.addEdge({ id: 'edge-a', sourceId: 'node-a', targetId: 'node-b' });
    edge.addControlPoint(0.5, 0.5);
    const stored = () => JSON.stringify([waypoint.toJSON(), layer.toJSON()]);
    const before = stored();
    const added = vi.fn();
    app.eventBus.on('waypoint:add', added);
    const error = vi.fn();
    app.eventBus.on('scene-outline:error', error);
    const refuses = (commands, [low, high], range) => {
      for (const [action, fields] of Object.entries(commands)) {
        for (const [axis, label] of [['x', 'Horizontal position'], ['y', 'Vertical position']]) {
          for (const past of [low, high]) {
            app._handleSceneOutlineCommand({
              action, ...fields, x: '50', y: '50', [axis]: String(past), outlineFormKey: action,
            });
            expect(error, `${action} ${axis} ${past}`).toHaveBeenLastCalledWith({
              formKey: action, message: `${label} must be between ${range}.`,
            });
          }
        }
      }
    };

    refuses({
      'add-waypoint': { kind: 'major' },
      'update-waypoint': { waypointId: waypoint.id, waitSeconds: '1', segmentSpeed: '1' },
      'add-vertex': { waypointId: waypoint.id },
      'update-vertex': { waypointId: waypoint.id, index: '0' },
    }, [MIN * 100 - 0.001, MAX * 100 + 0.001], `${MIN * 100} and ${MAX * 100}`);
    refuses({
      'add-node': { layerId: layer.id, type: 'normal', label: '' },
      'update-node': { layerId: layer.id, nodeId: node.id, type: 'normal', label: '' },
      'add-control': { layerId: layer.id, edgeId: edge.id },
      'update-control': { layerId: layer.id, edgeId: edge.id, index: '0' },
    }, [-0.001, 100.001], '0 and 100');
    expect(error).toHaveBeenCalledTimes(32);
    expect(added).not.toHaveBeenCalled();
    expect(stored()).toBe(before);
  });

  test('never stores an unchanged field\'s value from outside the range (DEF-35)', () => {
    // An untouched field submits the value it was drawn from, which load has
    // already checked. Only a tampered command could carry one from outside
    // the range; it gets the typed value instead.
    const waypoint = new Waypoint({
      id: 'wp-canonical', imgX: 0.5, imgY: 0.5, isMajor: true,
      areaHighlight: { shape: 'polygon', points: [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.5, y: 0.6 }] },
    });
    app.waypoints = [waypoint];
    app._handleSceneOutlineCommand({
      action: 'update-vertex', waypointId: waypoint.id, index: '0', x: '20', y: '40',
      outlineOriginalValues: { x: { display: '20', canonical: '50' }, y: { display: '40', canonical: '0.4' } },
    });
    expect(waypoint.areaHighlight.points[0]).toEqual({ x: 0.2, y: 0.4 });
  });

  test('preserves untouched long and whitespace-significant text in combined forms', () => {
    const storedName = `  n\r\n${'n'.repeat(201)}\n  `;
    const storedLabel = `  l\n${'l'.repeat(201)}\r\n  `;
    const displayedName = storedName.replace(/[\r\n]/g, '');
    const displayedLabel = storedLabel.replace(/[\r\n]/g, '');
    const layer = app.scene.addFlowLayer({
      id: 'crowd-text', name: storedName, guideType: 'route', emitters: [{}],
    });
    const node = layer.graph.addNode({ id: 'node-text', label: storedLabel, type: 'normal' });

    app._outlineUpdateCrowd({
      layerId: layer.id,
      name: displayedName,
      visible: 'hidden',
      guideType: 'route',
      outlineOriginalValues: {
        name: { display: displayedName, canonical: storedName },
      },
    });
    app._outlineUpdateNode({
      layerId: layer.id,
      nodeId: node.id,
      x: '0',
      y: '0',
      type: 'entry',
      label: displayedLabel,
      outlineOriginalValues: {
        label: { display: displayedLabel, canonical: storedLabel },
      },
    });

    expect(layer.name).toBe(storedName);
    expect(layer.visible).toBe(false);
    expect(node.label).toBe(storedLabel);
    expect(node.type).toBe('entry');
    expect(app.undoSaves).toBe(2);
    expect(app.autoSaves).toBe(2);
  });

  test('edits other crowd fields without rewriting an accepted empty imported name', () => {
    const layer = app.scene.addFlowLayer({
      id: 'crowd-empty', name: '\r\n', guideType: 'route', visible: true, emitters: [{}],
    });

    app._outlineUpdateCrowd({
      layerId: layer.id,
      name: '',
      visible: 'hidden',
      guideType: 'graph',
      outlineOriginalValues: {
        name: { display: '', canonical: '\r\n' },
      },
    });

    expect(layer.name).toBe('\r\n');
    expect(layer.visible).toBe(false);
    expect(layer.guideType).toBe('graph');
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);
  });

  test('preserves a typed imported node label while changing coordinates or type', () => {
    const legacyLabel = { source: 'legacy', tokens: ['A', 2] };
    const layer = addGraphLayer(app);
    const node = layer.graph.addNode({ id: 'typed-label', label: legacyLabel, type: 'normal' });

    app._outlineUpdateNode({
      layerId: layer.id,
      nodeId: node.id,
      x: '25',
      y: '75',
      type: 'entry',
      label: '[object Object]',
      outlineOriginalValues: {
        label: { display: '[object Object]', canonical: legacyLabel },
      },
    });

    expect(node).toMatchObject({ x: 0.25, y: 0.75, type: 'entry' });
    expect(node.label).toBe(legacyLabel);
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);
  });

  test('preserves an imported large edge weight while changing direction', () => {
    const layer = addGraphLayer(app);
    const source = layer.graph.addNode({ id: 'source' });
    const target = layer.graph.addNode({ id: 'target' });
    const edge = layer.graph.addEdge({
      id: 'large-weight', sourceId: source.id, targetId: target.id, weight: 1e100,
    });

    app._outlineUpdateEdge({
      layerId: layer.id,
      edgeId: edge.id,
      direction: 'one-way',
      weight: '1e+100',
      outlineOriginalValues: {
        weight: { display: '1e+100', canonical: '1e+100' },
      },
    });

    expect(edge.direction).toBe('one-way');
    expect(edge.weight).toBe(1e100);
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);
  });

  test('creates and edits polygons in seconds/percent units while enforcing three vertices', () => {
    const waypoint = new Waypoint({
      id: 'wp-a', imgX: 0.5, imgY: 0.5, isMajor: true, areaHighlight: { shape: 'none' },
    });
    app.waypoints = [waypoint];

    app._handleSceneOutlineCommand({ action: 'create-polygon', waypointId: waypoint.id });
    expect(waypoint.areaHighlight.shape).toBe('polygon');
    expect(waypoint.areaHighlight.points).toHaveLength(3);
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);

    app._handleSceneOutlineCommand({
      action: 'delete-vertex', waypointId: waypoint.id, index: '0',
    });
    expect(waypoint.areaHighlight.points).toHaveLength(3);
    expect(app.undoSaves).toBe(1);
    expect(app.announced.at(-1)).toContain('at least three vertices');

    app._handleSceneOutlineCommand({
      action: 'add-vertex', waypointId: waypoint.id, x: '20', y: '80',
    });
    expect(waypoint.areaHighlight.points.at(-1)).toEqual({ x: 0.2, y: 0.8 });
    expect(app.undoSaves).toBe(2);

    app._handleSceneOutlineCommand({
      action: 'update-polygon-timing',
      waypointId: waypoint.id,
      fadeInSeconds: '1.25',
      fadeOutSeconds: '2.5',
    });
    expect(waypoint.areaHighlight.fadeInMs).toBe(1250);
    expect(waypoint.areaHighlight.fadeOutMs).toBe(2500);
    expect(app.undoSaves).toBe(3);
    expect(app.autoSaves).toBe(3);
  });

  test('keeps extra emitters read-only while committing primary settings once', () => {
    const layer = app.scene.addFlowLayer({ id: 'crowd-a', name: 'Visitors', guideType: 'route' });
    const primary = layer.addEmitter({ id: 'emitter-a', dotCount: 10, seed: 1 });
    const extra = layer.addEmitter({ id: 'emitter-b', dotCount: 20, seed: 2 });
    const primaryCommand = {
      action: 'update-emitter',
      layerId: layer.id,
      emitterId: primary.id,
      dotCount: '15',
      releaseStart: '10',
      releaseDuration: '70',
      onsetVariance: '20',
      intensityRamp: '-25',
      speed: '0.2',
      speedVariance: '30',
      dotSize: '1.5',
      wobble: '40',
      dotColor: '#0072B2',
      lifecycleMode: 'loop',
    };

    app._handleSceneOutlineCommand(primaryCommand);
    expect(primary).toMatchObject({
      dotCount: 15,
      releaseStart: 0.1,
      releaseDuration: 0.7,
      onsetVariance: 0.2,
      intensityRamp: -0.25,
      speedVariance: 0.3,
      wobble: 0.4,
      lifecycleMode: 'loop',
    });
    expect(app.undoSaves).toBe(1);
    expect(app.autoSaves).toBe(1);

    app._handleSceneOutlineCommand({ ...primaryCommand, emitterId: extra.id, dotCount: '99' });
    expect(extra.dotCount).toBe(20);
    expect(app.undoSaves).toBe(1);
    expect(app.announced.at(-1)).toContain('Additional emitters are read-only');
  });

  test.each(['transparent', '#abc', '#abcd', '#11223344'])(
    'preserves the stored %s emitter colour while another field changes',
    (dotColor) => {
      const layer = app.scene.addFlowLayer({ id: 'crowd-a', guideType: 'route' });
      const emitter = layer.addEmitter({ id: 'emitter-a', dotColor, dotCount: 10 });

      app._handleSceneOutlineCommand({
        action: 'update-emitter',
        layerId: layer.id,
        emitterId: emitter.id,
        dotCount: '11',
        releaseStart: String(emitter.releaseStart * 100),
        releaseDuration: String(emitter.releaseDuration * 100),
        onsetVariance: String(emitter.onsetVariance * 100),
        intensityRamp: String(emitter.intensityRamp * 100),
        speed: String(emitter.speed),
        speedVariance: String(emitter.speedVariance * 100),
        dotSize: String(emitter.dotSize),
        wobble: String(emitter.wobble * 100),
        dotColor,
        lifecycleMode: emitter.lifecycleMode,
      });

      expect(emitter.dotColor).toBe(dotColor);
      expect(emitter.dotCount).toBe(11);
      expect(app.undoSaves).toBe(1);
    }
  );

  test('selects nodes passively without entering the pen or changing project history', () => {
    const layer = addGraphLayer(app);
    const node = layer.graph.addNode({ id: 'node-a', x: 0.5, y: 0.5 });

    app._handleSceneOutlineCommand({
      action: 'select', kind: 'node', layerId: layer.id, nodeId: node.id,
    });

    expect(app.networkEditService.active).toBe(false);
    expect(app.networkEditService.selectedNode()).toBe(node);
    expect(app.networkEditService._keyHandler).toBeNull();
    expect(app.undoSaves).toBe(0);
    expect(app.autoSaves).toBe(0);

    app._sceneOutlineSelectionKey = `crowd:${layer.id}`;
    app._handleSceneOutlineCommand({
      action: 'select', kind: 'node', layerId: layer.id, nodeId: node.id,
    });
    expect(app._sceneOutlineSelectionKey).toBe(`node:${layer.id}:${node.id}`);
  });

  test.each(['major', 'minor'])('publishes canonical selection after adding a %s waypoint', (kind) => {
    if (kind === 'minor') app.waypoints.push(new Waypoint({ id: 'existing-major', isMajor: true }));
    const selected = vi.fn();
    app.eventBus.on('waypoint:selected', selected);
    app.eventBus.on('waypoint:add', ({ imgX, imgY, isMajor }) => {
      app.waypoints.push(new Waypoint({ id: `new-${kind}`, imgX, imgY, isMajor }));
    });

    app._outlineAddWaypoint({ kind, x: '25', y: '75' });

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected.mock.calls[0][0]).toBe(app.waypoints.at(-1));
    expect(app._sceneOutlineSelectionKey).toBe(`waypoint:new-${kind}`);
  });

  test('clears passive graph selection on Escape or same-crowd outline selection', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const layer = addGraphLayer(app);
    const node = layer.graph.addNode({ id: 'node-a', x: 0.5, y: 0.5 });
    app.setupSceneOutline();

    app._handleSceneOutlineCommand({
      action: 'select', kind: 'node', layerId: layer.id, nodeId: node.id,
    });
    expect(app._sceneOutlineSelectionKey).toBe('node:crowd-a:node-a');

    app.networkEditService.clearSelection();
    await Promise.resolve();
    expect(app._sceneOutlineSelectionKey).toBeNull();

    app._handleSceneOutlineCommand({
      action: 'select', kind: 'node', layerId: layer.id, nodeId: node.id,
    });
    app._handleSceneOutlineCommand({
      action: 'select', kind: 'crowd', layerId: layer.id,
    });
    await Promise.resolve();
    expect(app.networkEditService.selection).toBeNull();
    expect(app.networkEditService.layer).toBeNull();
    expect(app._sceneOutlineSelectionKey).toBe('crowd:crowd-a');
  });

  test('deleting an unselected waypoint or crowd preserves canonical selection', () => {
    const selectedWaypoint = new Waypoint({ id: 'wp-selected', imgX: 0.2, imgY: 0.2 });
    const otherWaypoint = new Waypoint({ id: 'wp-other', imgX: 0.8, imgY: 0.8 });
    app.waypoints = [selectedWaypoint, otherWaypoint];
    app.selectedWaypoint = selectedWaypoint;
    app.selectedWaypoints = [selectedWaypoint];
    app._sceneOutlineSelectionKey = `waypoint:${selectedWaypoint.id}`;

    app._outlineDeleteWaypoint({ waypointId: otherWaypoint.id });
    expect(app.selectedWaypoint).toBe(selectedWaypoint);
    expect(app._sceneOutlineSelectionKey).toBe(`waypoint:${selectedWaypoint.id}`);

    const selectedCrowd = app.scene.addFlowLayer({ id: 'crowd-selected', emitters: [{}] });
    const otherCrowd = app.scene.addFlowLayer({ id: 'crowd-other', emitters: [{}] });
    app.selectedCrowd = selectedCrowd;
    app._sceneOutlineSelectionKey = `crowd:${selectedCrowd.id}`;

    app._outlineDeleteCrowd({ layerId: otherCrowd.id });
    expect(app.selectedCrowd).toBe(selectedCrowd);
    expect(app._sceneOutlineSelectionKey).toBe(`crowd:${selectedCrowd.id}`);
  });

  test('node cascade clears a selected incident edge before committing deletion', () => {
    const layer = addGraphLayer(app);
    const source = layer.graph.addNode({ id: 'node-source' });
    const target = layer.graph.addNode({ id: 'node-target' });
    const edge = layer.graph.addEdge({ id: 'edge-selected', sourceId: source.id, targetId: target.id });
    const deselected = vi.fn();
    app.eventBus.on('network:edge-deselected', deselected);
    app.networkEditService.bindForInspection(layer);
    app.networkEditService.selectEdge(edge);

    app._outlineDeleteNode({ layerId: layer.id, nodeId: source.id });

    expect(layer.graph.getNode(source.id)).toBeUndefined();
    expect(layer.graph.getEdge(edge.id)).toBeUndefined();
    expect(app.networkEditService.selection).toBeNull();
    expect(deselected).toHaveBeenCalledTimes(1);
    expect(app.undoSaves).toBe(1);
  });

  test('editing or deleting unrelated graph items preserves canonical selection', () => {
    const layer = addGraphLayer(app);
    const selectedNode = layer.graph.addNode({ id: 'node-selected', x: 0.1, y: 0.1 });
    const otherNode = layer.graph.addNode({ id: 'node-other', x: 0.2, y: 0.2 });
    const thirdNode = layer.graph.addNode({ id: 'node-third', x: 0.3, y: 0.3 });
    const unrelatedEdge = layer.graph.addEdge({
      id: 'edge-unrelated', sourceId: otherNode.id, targetId: thirdNode.id,
    });
    app.networkEditService.bindForInspection(layer);
    app.networkEditService.selectNode(selectedNode);
    app._sceneOutlineSelectionKey = `node:${layer.id}:${selectedNode.id}`;

    app._outlineUpdateNode({
      layerId: layer.id, nodeId: otherNode.id, x: '25', y: '20', type: 'normal', label: '',
    });
    expect(app.networkEditService.selectedNode()).toBe(selectedNode);
    expect(app._sceneOutlineSelectionKey).toBe(`node:${layer.id}:${selectedNode.id}`);

    app._outlineDeleteEdge({ layerId: layer.id, edgeId: unrelatedEdge.id });
    expect(app.networkEditService.selectedNode()).toBe(selectedNode);
    expect(app._sceneOutlineSelectionKey).toBe(`node:${layer.id}:${selectedNode.id}`);

    app._outlineDeleteNode({ layerId: layer.id, nodeId: thirdNode.id });
    expect(app.networkEditService.selectedNode()).toBe(selectedNode);
    expect(app._sceneOutlineSelectionKey).toBe(`node:${layer.id}:${selectedNode.id}`);
  });

  test('reindexes selected bend points and polygon vertices after an earlier deletion', () => {
    const layer = addGraphLayer(app);
    const source = layer.graph.addNode({ id: 'source' });
    const target = layer.graph.addNode({ id: 'target' });
    const edge = layer.graph.addEdge({ id: 'edge-a', sourceId: source.id, targetId: target.id });
    const selectedPoint = { x: 0.8, y: 0.8 };
    edge.controlPoints = [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, selectedPoint];
    app.networkEditService.bindForInspection(layer);
    app.networkEditService.selectControlPoint(edge, 2);
    app._sceneOutlineSelectionKey = `control:${layer.id}:${edge.id}:2`;

    app._outlineDeleteControl({ layerId: layer.id, edgeId: edge.id, index: '0' });
    expect(app.networkEditService.selectedControlPoint()).toMatchObject({ index: 1, point: selectedPoint });
    expect(app._sceneOutlineSelectionKey).toBe(`control:${layer.id}:${edge.id}:1`);

    const waypoint = new Waypoint({
      id: 'wp-polygon',
      areaHighlight: {
        shape: 'polygon',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.2, y: 0.2 },
          { x: 0.3, y: 0.3 },
          { x: 0.4, y: 0.4 },
        ],
      },
    });
    app.waypoints = [waypoint];
    const selectedVertex = waypoint.areaHighlight.points[3];
    app._sceneOutlineSelectionKey = `vertex:${waypoint.id}:3`;

    app._outlineDeleteVertex({ waypointId: waypoint.id, index: '0' });
    expect(waypoint.areaHighlight.points[2]).toBe(selectedVertex);
    expect(app._sceneOutlineSelectionKey).toBe(`vertex:${waypoint.id}:2`);
  });

  test('editing an edge preserves its selected bend point across synchronized views', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const layer = addGraphLayer(app);
    const source = layer.graph.addNode({ id: 'source' });
    const target = layer.graph.addNode({ id: 'target' });
    const edge = layer.graph.addEdge({ id: 'edge-a', sourceId: source.id, targetId: target.id });
    edge.controlPoints = [{ x: 0.5, y: 0.5 }];
    app.setupSceneOutline();
    app.networkEditService.bindForInspection(layer);
    app.networkEditService.selectControlPoint(edge, 0);
    app._sceneOutlineSelectionKey = `control:${layer.id}:${edge.id}:0`;

    app._outlineUpdateEdge({
      layerId: layer.id, edgeId: edge.id, direction: 'one-way', weight: '2',
    });
    await Promise.resolve();

    expect(app.networkEditService.selectedControlPoint()).toMatchObject({ edge, index: 0 });
    expect(app._sceneOutlineSelectionKey).toBe(`control:${layer.id}:${edge.id}:0`);
  });

  test('does not confuse same-ID nodes and edges when refreshing inspection', () => {
    const layer = addGraphLayer(app);
    const sharedNode = layer.graph.addNode({ id: 'shared', x: 0.1, y: 0.1 });
    const target = layer.graph.addNode({ id: 'target', x: 0.9, y: 0.9 });
    const sharedEdge = layer.graph.addEdge({
      id: 'shared', sourceId: sharedNode.id, targetId: target.id,
    });
    app.networkEditService.bindForInspection(layer);
    app.networkEditService.selectEdge(sharedEdge);
    const nodeSelected = vi.fn();
    const edgeSelected = vi.fn();
    app.eventBus.on('network:node-selected', nodeSelected);
    app.eventBus.on('network:edge-selected', edgeSelected);

    app._outlineUpdateNode({
      layerId: layer.id, nodeId: sharedNode.id,
      x: '20', y: '30', type: 'entry', label: '',
    });
    expect(app.networkEditService.selection).toEqual({ kind: 'edge', id: 'shared' });
    expect(nodeSelected).not.toHaveBeenCalled();

    app.networkEditService.selectNode(sharedNode);
    nodeSelected.mockClear();
    edgeSelected.mockClear();
    app._outlineUpdateEdge({
      layerId: layer.id, edgeId: sharedEdge.id, direction: 'one-way', weight: '2',
    });
    expect(app.networkEditService.selection).toEqual({ kind: 'node', id: 'shared' });
    expect(edgeSelected).not.toHaveBeenCalled();
  });

  test('rebuilds the semantic selection key from restored canonical selection', () => {
    const waypoint = new Waypoint({ id: 'restored-waypoint', isMajor: true });
    app.waypoints = [waypoint];
    app.selectedWaypoint = waypoint;
    app._sceneOutlineSelectionKey = null;
    app._syncSceneOutlineSelectionAfterRestore();
    expect(app._sceneOutlineSelectionKey).toBe(sceneOutlineKey('waypoint', waypoint.id));

    app.selectedWaypoint = null;
    const layer = addGraphLayer(app);
    const source = layer.graph.addNode({ id: 'source' });
    const target = layer.graph.addNode({ id: 'target' });
    const edge = layer.graph.addEdge({ id: 'edge', sourceId: source.id, targetId: target.id });
    edge.controlPoints = [{ x: 0.5, y: 0.5 }];
    app.selectedCrowd = layer;
    app.networkEditService.bindForInspection(layer);
    app.networkEditService.selectControlPoint(edge, 0);
    app._syncSceneOutlineSelectionAfterRestore();
    expect(app._sceneOutlineSelectionKey)
      .toBe(sceneOutlineKey('control', layer.id, edge.id, 0));
  });

  test('clears transient outline selection and focus only at successful project boundaries', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const waypoint = new Waypoint({ id: 'same-id', isMajor: true });
    app.waypoints = [waypoint];
    app.setupSceneOutline();
    app.eventBus.emit('waypoint:selected', waypoint);
    await Promise.resolve();
    expect(app._sceneOutlineSelectionKey).toBe(sceneOutlineKey('waypoint', waypoint.id));
    app._sceneOutlineFocusKey = `${sceneOutlineKey('waypoint', waypoint.id)}:select`;

    app.eventBus.emit('project:load-failed');
    expect(app._sceneOutlineSelectionKey).toBe(sceneOutlineKey('waypoint', waypoint.id));
    expect(app._sceneOutlineFocusKey).not.toBeNull();

    app.eventBus.emit('project:replaced');
    await Promise.resolve();
    expect(app._sceneOutlineSelectionKey).toBeNull();
    expect(app._sceneOutlineFocusKey).toBeNull();

    app._sceneOutlineSelectionKey = sceneOutlineKey('waypoint', waypoint.id);
    app._sceneOutlineFocusKey = `${sceneOutlineKey('waypoint', waypoint.id)}:select`;
    app.eventBus.emit('app:cleared');
    await Promise.resolve();
    expect(app._sceneOutlineSelectionKey).toBeNull();
    expect(app._sceneOutlineFocusKey).toBeNull();
  });

  test('keeps adversarial persisted IDs synchronized across app and outline keys', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const layer = app.scene.addFlowLayer({
      id: 'crowd:west%3A', guideType: 'graph', emitters: [{ id: 'emitter:primary%' }],
    });
    const source = layer.graph.addNode({ id: 'node:source%' });
    const target = layer.graph.addNode({ id: 'node%3Atarget' });
    const edge = layer.graph.addEdge({
      id: 'edge:source%3Atarget', sourceId: source.id, targetId: target.id,
    });
    edge.controlPoints = [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }];
    const updates = vi.fn();
    app.eventBus.on('scene-outline:update', updates);
    app.setupSceneOutline();

    app._handleSceneOutlineCommand({
      action: 'select', kind: 'control', layerId: layer.id, edgeId: edge.id, index: '1',
    });
    await Promise.resolve();

    const selectedKey = sceneOutlineKey('control', layer.id, edge.id, 1);
    expect(app._sceneOutlineSelectionKey).toBe(selectedKey);
    expect(updates.mock.calls.at(-1)[0].selectionKey).toBe(selectedKey);

    app._outlineDeleteControl({ layerId: layer.id, edgeId: edge.id, index: '0' });
    await Promise.resolve();
    expect(app._sceneOutlineSelectionKey).toBe(sceneOutlineKey('control', layer.id, edge.id, 0));
    expect(updates.mock.calls.at(-1)[0].selectionKey)
      .toBe(sceneOutlineKey('control', layer.id, edge.id, 0));
  });

  test('applies the bend-point total independently to each crowd layer', () => {
    const fullLayer = addGraphLayer(app);
    const fullSource = fullLayer.graph.addNode({ id: 'full-source' });
    const fullTarget = fullLayer.graph.addNode({ id: 'full-target' });
    for (let edgeIndex = 0; edgeIndex < 32; edgeIndex++) {
      const edge = fullLayer.graph.addEdge({
        id: `full-edge-${edgeIndex}`,
        sourceId: fullSource.id,
        targetId: fullTarget.id,
      });
      edge.controlPoints = Array.from({ length: 256 }, (_, pointIndex) => ({
        x: pointIndex / 255,
        y: edgeIndex / 31,
      }));
    }

    const targetLayer = app.scene.addFlowLayer({
      id: 'crowd-b', guideType: 'graph', emitters: [{ id: 'emitter-b' }],
    });
    const source = targetLayer.graph.addNode({ id: 'source' });
    const target = targetLayer.graph.addNode({ id: 'target' });
    const edge = targetLayer.graph.addEdge({ id: 'edge-b', sourceId: source.id, targetId: target.id });

    app._outlineAddControl({ layerId: targetLayer.id, edgeId: edge.id, x: '25', y: '75' });

    expect(edge.controlPoints).toEqual([{ x: 0.25, y: 0.75 }]);
    expect(app.undoSaves).toBe(1);
  });

  test('synchronizes commits and coalesces high-frequency semantic changes', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const updates = vi.fn();
    app.eventBus.on('scene-outline:update', updates);
    app.setupSceneOutline();
    expect(updates).toHaveBeenCalledTimes(1);

    app.eventBus.emit('network:changed', { commit: false });
    await Promise.resolve();
    expect(updates).toHaveBeenCalledTimes(1);

    for (const [event, payload] of [
      ['network:changed', { commit: true }],
      ['waypoint:name-changed', {}],
      ['scene:semantic-changed', { kind: 'crowd-name' }],
    ]) {
      app.eventBus.emit(event, payload);
      await Promise.resolve();
    }
    expect(updates).toHaveBeenCalledTimes(4);

    for (const [event, payload] of [
      ['waypoint:pause-changed', {}],
      ['waypoint:speed-changed', {}],
      ['crowd:param-changed', {}],
      ['area:changed', {}],
      ['scene:semantic-changed', { kind: 'waypoint-label' }],
    ]) {
      app.eventBus.emit(event, payload);
    }
    vi.advanceTimersByTime(74);
    expect(updates).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(updates).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });
});

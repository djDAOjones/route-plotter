import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { EventBus } from '../src/core/EventBus.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { NetworkEditService } from '../src/services/NetworkEditService.js';
import { sceneOutlineMixin } from '../src/app/sceneOutline.js';
import { networkMixin } from '../src/app/network.js';
import { buildSceneOutlineSnapshot, sceneOutlineKey } from '../src/utils/sceneSemantics.js';
import { SceneOutlineController } from '../src/controllers/SceneOutlineController.js';
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
  // The adapter's plain snapshot carries the network owner's transient draft token.
  app._entryWeightContext = networkMixin._entryWeightContext;

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
    // "corners", the panel's word (reason: UI-06 low items, one word per concept [Q4]).
    expect(app.announced.at(-1)).toContain('at least three corners');

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

  test('its messages use the controls’ words: Count, Window start, journey end, Crowd updated, Path updated (UI-06)', () => {
    const layer = app.scene.addFlowLayer({ id: 'crowd-w', name: 'Visitors', guideType: 'graph' });
    const primary = layer.addEmitter({ id: 'emitter-w', dotCount: 10, seed: 1 });
    // Release bias as the outline sends it since CROWD-07 F15 (reason for the
    // changed fields): a direction and an amount, not a signed −25.
    const command = {
      action: 'update-emitter', layerId: layer.id, emitterId: primary.id,
      dotCount: '15', releaseStart: '10', releaseDuration: '70', onsetVariance: '20',
      intensityRampDirection: 'earlier', intensityRampAmount: '25',
      speed: '0.2', speedVariance: '30', dotSize: '1.5', wobble: '40', dotColor: '#0072B2', lifecycleMode: 'loop',
    };
    const said = (patch) => {
      app._handleSceneOutlineCommand({ ...command, ...patch });
      return app.announced.at(-1);
    };

    expect(said({ dotCount: 'x' })).toMatch(/^Count\b/);
    expect(said({ dotCount: 'x' })).not.toMatch(/Dots/);
    expect(said({ releaseStart: 'x' })).toMatch(/^Window start\b/);
    expect(said({ releaseDuration: 'x' })).toMatch(/^Window length\b/);
    expect(said({ lifecycleMode: 'x' })).toBe('Choose a valid journey end.');
    expect(said({})).toBe('Crowd updated.');
    expect(primary.dotCount).toBe(15);

    const a = layer.graph.addNode({ id: 'na', x: 0.2, y: 0.5 });
    const b = layer.graph.addNode({ id: 'nb', x: 0.8, y: 0.5 });
    const edge = layer.graph.addEdge({ id: 'ab', sourceId: a.id, targetId: b.id });
    app._handleSceneOutlineCommand({ action: 'update-edge', layerId: layer.id, edgeId: edge.id, direction: 'one-way', weight: '2' });
    expect(app.announced.at(-1)).toBe('Path updated.');
    app._handleSceneOutlineCommand({ action: 'update-edge', layerId: layer.id, edgeId: edge.id, direction: 'x', weight: '2' });
    expect(app.announced.at(-1)).toBe('Choose a valid path direction.');
    app._handleSceneOutlineCommand({ action: 'delete-edge', layerId: layer.id, edgeId: edge.id });
    expect(app.announced.at(-1)).toBe('Path deleted. Undo available.');
  });

  // CROWD-07 F15: the outline sends Release bias as a direction and an amount.
  test('Release bias: Earlier 40 writes −0.40, Even 0, Later 100 writes 1, and an untouched amount its stored value', () => {
    const layer = app.scene.addFlowLayer({ id: 'crowd-f15', name: 'Visitors', guideType: 'route' });
    const emitter = layer.addEmitter({ id: 'emitter-f15', dotCount: 10, seed: 1, intensityRamp: -0.375 });
    const base = {
      action: 'update-emitter', layerId: layer.id, emitterId: emitter.id,
      dotCount: '10', releaseStart: '0', releaseDuration: '100', onsetVariance: '20',
      speed: '0.15', speedVariance: '20', dotSize: '0.4', wobble: '0', dotColor: '#E69F00', lifecycleMode: 'respawn',
    };
    const apply = patch => app._handleSceneOutlineCommand({ ...base, ...patch });

    // Untouched: the amount's original goes in, so −0.375 is kept exactly.
    apply({
      intensityRampDirection: 'earlier', intensityRampAmount: '37.5',
      outlineOriginalValues: { intensityRampAmount: { display: '37.5', canonical: 0.375 } },
    });
    expect(emitter.intensityRamp).toBe(-0.375);
    // Its direction alone changed: the same amount, the other way.
    apply({
      intensityRampDirection: 'later', intensityRampAmount: '37.5',
      outlineOriginalValues: { intensityRampAmount: { display: '37.5', canonical: 0.375 } },
    });
    expect(emitter.intensityRamp).toBe(0.375);

    apply({ intensityRampDirection: 'earlier', intensityRampAmount: '40' });
    expect(emitter.intensityRamp).toBe(-0.4);
    apply({ intensityRampDirection: 'even' });
    expect(emitter.intensityRamp).toBe(0);
    apply({ intensityRampDirection: 'later', intensityRampAmount: '100' });
    expect(emitter.intensityRamp).toBe(1);
    apply({ intensityRampDirection: 'earlier', intensityRampAmount: '0' });
    expect(Object.is(emitter.intensityRamp, 0)).toBe(true); // no −0 stored

    // Refused, the model kept: an amount past 100 or not a number, a direction that is none.
    apply({ intensityRampDirection: 'later', intensityRampAmount: '150' });
    expect(app.announced.at(-1)).toBe('Release bias amount must be between 0 and 100.');
    apply({ intensityRampDirection: 'later', intensityRampAmount: 'x' });
    expect(app.announced.at(-1)).toBe('Release bias amount must be between 0 and 100.');
    apply({ intensityRampDirection: 'sideways', intensityRampAmount: '10' });
    expect(app.announced.at(-1)).toBe('Choose Earlier, Even or Later for Release bias.');
    expect(emitter.intensityRamp).toBe(0);
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
      // Release bias as a direction and an amount since CROWD-07 F15 (reason for the changed fields).
      intensityRampDirection: 'earlier',
      intensityRampAmount: '25',
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
    expect(app.announced.at(-1)).toBe('A second emitter can be read here, not edited.');
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
        // A new emitter's bias is even (0); sent as the outline sends it since CROWD-07 F15.
        intensityRampDirection: 'even',
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

  test('sends the outline the selection a restore brings back, so it can reveal it (DEF-40)', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const waypoint = new Waypoint({ id: 'restored-waypoint', isMajor: true });
    app.waypoints = [waypoint];
    app.setupSceneOutline();
    await Promise.resolve();
    const sent = [];
    app.eventBus.on('scene-outline:update', snapshot => sent.push(snapshot.selectionKey));

    app.selectedWaypoint = waypoint;
    app._syncSceneOutlineSelectionAfterRestore();
    await Promise.resolve();

    expect(sent).toEqual([sceneOutlineKey('waypoint', waypoint.id)]);
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

  test('meets a focus request once: a click on another entry keeps focus there, and the requested entry closes (DEF-40)', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const first = new Waypoint({ id: 'wp-first', isMajor: true });
    const second = new Waypoint({ id: 'wp-second', isMajor: true });
    app.waypoints = [first, second];
    app.setupSceneOutline();
    const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));
    const container = document.getElementById('scene-outline');
    const entry = waypoint => [...container.querySelectorAll('details[data-outline-disclosure]')]
      .find(details => details.dataset.outlineDisclosure === sceneOutlineKey('waypoint', waypoint.id));
    const summaryOf = waypoint => entry(waypoint).querySelector(':scope > summary');
    // A click as a browser delivers it: the listeners, their microtasks, then
    // the summary's toggle unless a listener cancelled it.
    const browserClick = async (summary) => {
      summary.focus();
      const click = new Event('click', { bubbles: true, cancelable: true });
      summary.dispatchEvent(click);
      await nextTask();
      if (!click.defaultPrevented) summary.parentElement.open = !summary.parentElement.open;
      await nextTask();
    };

    app._queueSceneOutlineRefresh(`${sceneOutlineKey('waypoint', first.id)}:select`);
    await nextTask();
    expect(document.activeElement.dataset.outlineKey).toBe(`${sceneOutlineKey('waypoint', first.id)}:select`);

    await browserClick(summaryOf(second));
    expect(entry(second).open).toBe(true);
    expect(document.activeElement).toBe(summaryOf(second));

    await browserClick(summaryOf(first));
    expect(entry(first).open).toBe(false);
    expect(document.activeElement).toBe(summaryOf(first));
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

describe('the outline in the booted app (DEF-40)', () => {
  const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

  /** A click as a browser delivers it: the listeners, their microtasks, then the toggle unless cancelled. */
  async function browserClick(summary) {
    summary.focus();
    const click = new Event('click', { bubbles: true, cancelable: true });
    summary.dispatchEvent(click);
    await nextTask();
    if (!click.defaultPrevented) summary.parentElement.open = !summary.parentElement.open;
    await nextTask();
  }

  test('undo and redo reveal the selection they bring back', async () => {
    const app = await bootApp();
    await app.ready;
    document.getElementById('splash-close').click();
    const outline = document.getElementById('scene-outline');
    const route = () => outline.querySelector('details[data-outline-disclosure="route"]');
    const add = async (x) => {
      const form = outline.querySelector('form[data-outline-form-key="route:add-submit"]');
      form.elements.x.value = String(x);
      form.querySelector('[type="submit"]').click();
      await nextTask();
    };
    await add(25);
    await add(75);
    const [first, second] = app.waypoints;
    expect(app.selectedWaypoint).toBe(second);

    await browserClick(route().querySelector(':scope > summary'));
    expect(route().open).toBe(false);
    app.undo();
    await nextTask();
    expect(app.selectedWaypoint?.id).toBe(first.id);
    expect(route().open).toBe(true);

    await browserClick(route().querySelector(':scope > summary'));
    expect(route().open).toBe(false);
    app.redo();
    await nextTask();
    expect(app.selectedWaypoint?.id).toBe(second.id);
    expect(route().open).toBe(true);
  });
});

describe('the outline\'s area announcements and errors say area and corner (UI-06 low items, one word per concept)', () => {
  test('creating, editing and deleting an area, and each refusal, in the panel\'s words', () => {
    const app = makeApp();
    const waypoint = new Waypoint({
      id: 'wp-a', imgX: 0.5, imgY: 0.5, isMajor: true, areaHighlight: { shape: 'none' },
    });
    const full = new Waypoint({
      id: 'wp-full', imgX: 0.2, imgY: 0.2, isMajor: true,
      areaHighlight: { shape: 'polygon', enabled: true, points: Array.from({ length: 256 }, (_, i) => ({ x: i / 512, y: 0.1 })) },
    });
    app.waypoints = [waypoint, full];
    const run = command => app._handleSceneOutlineCommand({ waypointId: 'wp-a', ...command });
    run({ action: 'create-polygon' });
    run({ action: 'delete-vertex', index: '0' });
    run({ action: 'add-vertex', x: '20', y: '80' });
    run({ action: 'update-vertex', index: '0', x: '30', y: '40' });
    run({ action: 'update-polygon-timing', fadeInSeconds: '1', fadeOutSeconds: '2' });
    run({ action: 'delete-vertex', index: '3' });
    run({ action: 'delete-vertex', index: '9' });
    run({ action: 'delete-polygon' });
    run({ action: 'update-polygon-timing', fadeInSeconds: '1', fadeOutSeconds: '2' });
    run({ action: 'add-vertex', x: '1', y: '1' });
    run({ action: 'delete-polygon' });
    run({ action: 'add-vertex', waypointId: 'wp-full', x: '1', y: '1' });
    expect(app.announced).toEqual([
      'Triangle area added around the waypoint, with three corners.',
      'A drawn area needs at least three corners. Delete the area instead.',
      'Corner 4 added.',
      'Corner 1 updated.',
      'Area timing updated.',
      'Corner deleted. Undo available.',
      'That corner no longer exists.',
      'Area deleted. Undo available.',
      'That area no longer exists.',
      'That area no longer exists.',
      'That area no longer exists.',
      'The project area-corner limit has been reached.',
    ]);
    for (const message of app.announced) expect(message).not.toMatch(/polygon|vertices|vertex/i);
  });
});

describe('the outline\'s position fields show the heading\'s precision, losslessly (UI-06 W-02)', () => {
  // A position field showed 18.914301880222837 under a heading that says
  // 18.91. It shows 18.91 now; an Apply that leaves it alone keeps the exact
  // stored value, and one typed is written as typed.
  const EXACT = 0.18914301880222837;

  function outlined() {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const app = makeApp();
    const container = document.getElementById('scene-outline');
    new SceneOutlineController(container, app.eventBus);
    app.eventBus.on('scene-outline:command', command => app._handleSceneOutlineCommand(command));
    const waypoint = new Waypoint({ id: 'wp-a', imgX: EXACT, imgY: 0.5, isMajor: true });
    waypoint.areaHighlight.enabled = true;
    waypoint.areaHighlight.shape = 'polygon';
    waypoint.areaHighlight.points = [{ x: EXACT, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.6 }];
    app.waypoints = [waypoint];
    const layer = app.scene.addFlowLayer({ id: 'crowd-a', name: 'Visitors', guideType: 'graph', emitters: [{ id: 'emitter-a' }] });
    const node = layer.graph.addNode({ id: 'node-a', x: EXACT, y: 0.3, type: 'entry' });
    layer.graph.addNode({ id: 'node-b', x: 0.8, y: 0.7, type: 'exit' });
    const edge = layer.graph.addEdge({ id: 'edge-a', sourceId: 'node-a', targetId: 'node-b', direction: 'one-way' });
    edge.addControlPoint(EXACT, 0.6);
    const render = () => app.eventBus.emit('scene-outline:update', buildSceneOutlineSnapshot({ waypoints: app.waypoints, scene: app.scene }));
    return { app, container, waypoint, node, edge, render };
  }

  async function openAll(container) {
    for (let guard = 0; guard < 100; guard += 1) {
      const closed = container.querySelector('details[data-outline-disclosure]:not([open])');
      if (!closed) return;
      closed.querySelector(':scope > summary').click();
      await Promise.resolve();
    }
  }

  const FIELDS = {
    waypoint: ['waypoint:wp-a:x', 'waypoint:wp-a:apply'],
    corner: ['vertex:wp-a:0:x', 'vertex:wp-a:0:apply'],
    node: ['node:crowd-a:node-a:x', 'node:crowd-a:node-a:apply'],
    bend: ['control:crowd-a:edge-a:0:x', 'control:crowd-a:edge-a:0:apply'],
  };

  test('each position field shows two decimals, and the new corner starts on its waypoint at the same', async () => {
    const { container, render } = outlined();
    render();
    await openAll(container);
    const field = key => container.querySelector(`input[data-outline-key="${key}"]`);
    for (const [what, [key]] of Object.entries(FIELDS)) expect(field(key)?.value, what).toBe('18.91');
    expect(field('polygon:wp-a:add-x').value).toBe('18.91');
    expect(field('waypoint:wp-a:y').value).toBe('50');
  });

  test('an Apply that leaves a field alone keeps the exact value; one typed is written as typed', async () => {
    const { app, container, waypoint, node, edge, render } = outlined();
    const stored = {
      waypoint: () => waypoint.imgX, corner: () => waypoint.areaHighlight.points[0].x,
      node: () => node.x, bend: () => edge.controlPoints[0].x,
    };
    for (const [what, [key, formKey]] of Object.entries(FIELDS)) {
      render();
      await openAll(container);
      const form = () => container.querySelector(`form[data-outline-form-key="${formKey}"]`);
      // Untouched: the other field edited, so the Apply writes something.
      const other = form().querySelector('input[name="y"]');
      other.value = String(Number(other.value) + 1);
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(stored[what](), `${what}, left alone`).toBe(EXACT);
      render();
      await openAll(container);
      const field = container.querySelector(`input[data-outline-key="${key}"]`);
      field.value = '18.92';
      form().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(stored[what](), `${what}, typed`).toBe(0.1892);
      // Put back for the next.
      if (what === 'waypoint') waypoint.imgX = EXACT;
      if (what === 'corner') waypoint.areaHighlight.points[0] = { ...waypoint.areaHighlight.points[0], x: EXACT };
      if (what === 'node') node.moveTo(EXACT, node.y);
      if (what === 'bend') edge.controlPoints[0] = { ...edge.controlPoints[0], x: EXACT };
    }
    expect(app.announced.filter(message => /must be|no longer exists/.test(message))).toEqual([]);
  });

  test('an untouched bend off the image keeps its stored value as the other coordinate changes (Codex r1)', async () => {
    // Its field shows -18.92 for -18.916%; bounds from the stored value alone
    // refused the form as shown, so the edit to the other never arrived.
    const { app, container, edge, render } = outlined();
    for (const off of [-0.18916, 1.18916]) {
      for (const [axis, other] of [['x', 'y'], ['y', 'x']]) {
        edge.controlPoints[0] = { x: 0.4, y: 0.6, [axis]: off };
        render();
        await openAll(container);
        const form = container.querySelector('form[data-outline-form-key="control:crowd-a:edge-a:0:apply"]');
        form.elements[other].value = '70';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(edge.controlPoints[0], `${axis} at ${off}`).toEqual({ x: 0.4, y: 0.6, [axis]: off, [other]: 0.7 });
      }
    }
    expect(app.announced.filter(message => /must be|no longer exists/.test(message))).toEqual([]);
  });

  /** Clear a field and type `text` into it, as the author does: each keystroke an input event. */
  function retype(field, text) {
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    for (let end = 1; end <= text.length; end += 1) {
      field.value = text.slice(0, end);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const ENTRY = {
    waypoint: 'waypoint:wp-a', corner: 'vertex:wp-a:0', node: 'node:crowd-a:node-a', bend: 'control:crowd-a:edge-a:0',
  };

  function storedOf({ waypoint, node, edge }) {
    return {
      waypoint: () => waypoint.imgX, corner: () => waypoint.areaHighlight.points[0].x,
      node: () => node.x, bend: () => edge.controlPoints[0].x,
    };
  }

  function putBack({ waypoint, node, edge }, what) {
    if (what === 'waypoint') waypoint.imgX = EXACT;
    if (what === 'corner') waypoint.areaHighlight.points[0] = { ...waypoint.areaHighlight.points[0], x: EXACT };
    if (what === 'node') node.moveTo(EXACT, node.y);
    if (what === 'bend') edge.controlPoints[0] = { ...edge.controlPoints[0], x: EXACT };
  }

  test('retyping the value a field shows writes it, for waypoint, corner, node and bend (Codex r1)', async () => {
    // "18.91" typed is 0.1891, though the field showed 18.91 before: an
    // explicit edit is written as typed, and only a field never edited
    // submits the exact stored value.
    const outline = outlined();
    const { app, container, render } = outline;
    const stored = storedOf(outline);
    for (const [what, [key, formKey]] of Object.entries(FIELDS)) {
      render();
      await openAll(container);
      retype(container.querySelector(`input[data-outline-key="${key}"]`), '18.91');
      container.querySelector(`form[data-outline-form-key="${formKey}"]`)
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(stored[what](), what).toBe(0.1891);
      putBack(outline, what);
    }
    expect(app.announced.filter(message => /must be|no longer exists/.test(message))).toEqual([]);
  });

  test('a retyped field keeps its edit through a redraw: collapsed, reopened, then applied (Codex r1)', async () => {
    const outline = outlined();
    const { app, container, render } = outline;
    const stored = storedOf(outline);
    const summary = key => container.querySelector(`details[data-outline-disclosure="${key}"] > summary`);
    for (const [what, [key, formKey]] of Object.entries(FIELDS)) {
      render();
      await openAll(container);
      retype(container.querySelector(`input[data-outline-key="${key}"]`), '18.91');
      // The entry collapsed and reopened: the form is drawn again from the model.
      summary(ENTRY[what]).click();
      await Promise.resolve();
      expect(container.querySelector(`input[data-outline-key="${key}"]`), what).toBeNull();
      summary(ENTRY[what]).click();
      await Promise.resolve();
      expect(container.querySelector(`input[data-outline-key="${key}"]`).value, what).toBe('18.91');
      container.querySelector(`form[data-outline-form-key="${formKey}"]`)
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(stored[what](), what).toBe(0.1891);
      putBack(outline, what);
    }
    expect(app.announced.filter(message => /must be|no longer exists/.test(message))).toEqual([]);
  });

  test('a field edited to another value keeps it through a redraw, and Apply writes it', async () => {
    const outline = outlined();
    const { container, render } = outline;
    const stored = storedOf(outline);
    for (const [what, [key, formKey]] of Object.entries(FIELDS)) {
      render();
      await openAll(container);
      retype(container.querySelector(`input[data-outline-key="${key}"]`), '18.95');
      render();
      expect(container.querySelector(`input[data-outline-key="${key}"]`).value, what).toBe('18.95');
      container.querySelector(`form[data-outline-form-key="${formKey}"]`)
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      expect(stored[what](), what).toBe(0.1895);
      putBack(outline, what);
    }
  });
});

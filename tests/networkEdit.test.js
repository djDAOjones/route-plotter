/**
 * Network edit mode (Phase 4): the NetworkEditService pen state machine
 * against real GraphModel/FlowLayer/Scene models, and the network mixin's
 * glue (guide-card entry, hit-testing, change pipeline, restore
 * re-binding) on a stub RoutePlotter.
 *
 * jsdom carries the banner and the card controls; canvas rendering and
 * the InteractionHandler pointer pipeline are live-verified instead.
 * Transforms in the harness are a flat 1000px image: screen == canvas,
 * image 0-1 maps to 0-1000 (zoom 1), so hit radii read in px directly.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { NetworkEditService } from '../src/services/NetworkEditService.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { networkMixin } from '../src/app/network.js';
import { Scene } from '../src/models/Scene.js';
import { EventBus } from '../src/core/EventBus.js';
import { SectionController } from '../src/controllers/SectionController.js';
import { UIController } from '../src/controllers/UIController.js';

const SCALE = 1000;

function makeCanvasRecorder() {
  const calls = { saves: 0, strokes: [], strokeRects: [], fillRects: [], dashes: [], arcs: [] };
  const ctx = {
    strokeStyle: '#000000', fillStyle: '#000000', lineWidth: 1, globalAlpha: 1,
    save() { calls.saves++; }, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, rect() {}, fill() {}, translate() {}, rotate() {},
    arc(x, y, radius) { calls.arcs.push({ x, y, radius }); },
    stroke() { calls.strokes.push({ style: this.strokeStyle, width: this.lineWidth }); },
    fillRect(x, y, width, height) { calls.fillRects.push({ x, y, width, height }); },
    strokeRect(x, y, width, height) {
      calls.strokeRects.push({ x, y, width, height, style: this.strokeStyle, lineWidth: this.lineWidth });
    },
    setLineDash(pattern) { calls.dashes.push([...pattern]); },
  };
  return { ctx, calls };
}

function renderNetworkGuide(service, app, layer, ctx) {
  service.renderGuide(
    { scaleSizeClamped: value => value },
    ctx,
    {
      swarmEngine: app.swarmEngine,
      imageToCanvas: (x, y) => ({ x: x * SCALE, y: y * SCALE }),
    },
    layer
  );
}

function makeApp() {
  document.body.innerHTML = `
    <button id="network-edit-btn" type="button" hidden></button>
    <p id="crowd-guide-hint"></p>
    <select id="network-node-type">
      <option value="normal">Pass-through</option>
      <option value="entry">Entry</option>
      <option value="exit">Exit</option>
    </select>
    <p id="network-node-hint"></p>
    <button id="network-node-delete" type="button"></button>
    <fieldset id="network-path-weights" hidden>
      <p id="network-path-weights-help"></p>
      <div id="network-path-weight-rows"></div>
    </fieldset>
    <select id="network-edge-direction">
      <option value="two-way">Two-way</option>
      <option value="one-way">One-way</option>
    </select>
    <button id="network-edge-swap" type="button" hidden></button>
    <input type="range" id="network-edge-weight" min="1" max="50" value="10">
    <span id="network-edge-weight-value"></span>
    <p id="network-edge-hint"></p>
    <button id="network-edge-delete" type="button"></button>
  `;
  const eventBus = new EventBus();
  const app = {
    eventBus,
    scene: new Scene(),
    swarmEngine: new SwarmEngine(),
    networkEditService: new NetworkEditService(eventBus),
    selectedCrowd: null,
    viewport: { zoom: 1 },
    undoSaves: 0,
    autoSaves: 0,
    renders: 0,
    announced: [],
    events: [],
    saveUndoState() { this.undoSaves++; },
    saveUndoStateDebounced() { this.undoSaves++; },
    autoSave() { this.autoSaves++; },
    queueRender() { this.renders++; },
    announce(msg) { this.announced.push(msg); },
    previewMode: false,
    _setPreviewMode(isPreview) { this.previewMode = isPreview; },
    screenToCanvas: (x, y) => ({ x, y }),
    imageToCanvas: (x, y) => ({ x: x * SCALE, y: y * SCALE }),
    screenToImage: (x, y) => ({ x: x / SCALE, y: y / SCALE }),
    isWithinImageBounds: () => true,
  };
  Object.assign(app, networkMixin);
  for (const ev of ['network:edit-mode-changed', 'network:node-selected', 'network:node-deselected',
                    'network:edge-selected', 'network:edge-deselected',
                    'network:control-selected', 'network:control-deselected', 'network:changed',
                    'crowd:param-changed', 'ui:toast']) {
    app.eventBus.on(ev, (payload) => app.events.push([ev, payload]));
  }
  app.setupNetworkControls();
  return app;
}

/** A graph-guided crowd, selected, with the mode entered. */
function enterMode(app) {
  const layer = app.scene.addFlowLayer({ guideType: 'graph', emitters: [{}] });
  app.selectedCrowd = layer;
  app.networkEditService.enter(layer);
  return layer;
}

/** A graph-guided crowd bound for inspector use, with no drawing mode. */
function bindForInspection(app) {
  const layer = app.scene.addFlowLayer({ guideType: 'graph', emitters: [{}] });
  app.selectedCrowd = layer;
  app.networkEditService.bindForInspection(layer);
  return layer;
}

let app;
let svc;
beforeEach(() => {
  app = makeApp();
  svc = app.networkEditService;
});

describe('mode lifecycle', () => {
  test('enter binds the layer, shows the banner, announces the mode', () => {
    const layer = enterMode(app);
    expect(svc.active).toBe(true);
    expect(svc.layer).toBe(layer);
    expect(document.getElementById('network-edit-banner')).toBeTruthy();
    expect(app.events).toContainEqual(['network:edit-mode-changed', { active: true, layer }]);
  });

  test('exit clears tool state, removes the banner, deselects', () => {
    enterMode(app);
    svc.placeNode({ x: 0.5, y: 0.5 });
    svc.exit();
    expect(svc.active).toBe(false);
    expect(svc.layer).toBeNull();
    expect(svc.penNodeId).toBeNull();
    expect(document.getElementById('network-edit-banner')).toBeNull();
    expect(app.events.map(e => e[0])).toContain('network:node-deselected');
  });

  test('successful project boundaries clear active and passive bindings while failed loads preserve them', () => {
    const activeLayer = enterMode(app);
    svc.placeNode({ x: 0.5, y: 0.5 });
    app.eventBus.emit('project:load-failed');
    expect(svc.active).toBe(true);
    expect(svc.layer).toBe(activeLayer);

    app.eventBus.emit('project:replaced');
    expect(svc.active).toBe(false);
    expect(svc.layer).toBeNull();
    expect(svc.selection).toBeNull();
    expect(document.getElementById('network-edit-banner')).toBeNull();

    const passiveLayer = bindForInspection(app);
    const passiveNode = passiveLayer.graph.addNode({ x: 0.4, y: 0.6 });
    svc.selectNode(passiveNode);
    app.eventBus.emit('project:load-failed');
    expect(svc.layer).toBe(passiveLayer);
    expect(svc.selectedNode()).toBe(passiveNode);

    app.eventBus.emit('app:cleared');
    expect(svc.active).toBe(false);
    expect(svc.layer).toBeNull();
    expect(svc.selection).toBeNull();
  });

  test('the model keeps its nodes across exit — only tool state is discarded', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.2, y: 0.2 });
    svc.placeNode({ x: 0.8, y: 0.2 });
    svc.exit();
    expect(layer.graph.getNodes()).toHaveLength(2);
    expect(layer.graph.getEdges()).toHaveLength(1);
  });
});

describe('passive inspection', () => {
  test('binds and resolves a node without entering drawing mode or changing Preview', () => {
    app.previewMode = true;
    const layer = bindForInspection(app);
    const node = layer.graph.addNode({ x: 0.5, y: 0.5 });

    svc.selectNode(node);

    expect(svc.active).toBe(false);
    expect(svc.layer).toBe(layer);
    expect(svc.selectedNode()).toBe(node);
    expect(svc.selectedEdge()).toBeNull();
    expect(svc._keyHandler).toBeNull();
    expect(document.getElementById('network-edit-banner')).toBeNull();
    expect(app.previewMode).toBe(true);
    expect(app.events.some(([event]) => event === 'network:edit-mode-changed')).toBe(false);
  });

  test('node, edge, and individual control selections are visible without pen affordances', () => {
    const layer = bindForInspection(app);
    layer.emitters[0].dotColor = 'transparent';
    const source = layer.graph.addNode({ x: 0.2, y: 0.5 });
    const target = layer.graph.addNode({ x: 0.8, y: 0.5 });
    const edge = layer.graph.addEdge({ sourceId: source.id, targetId: target.id });
    edge.controlPoints = [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }];
    const ink = '#111111';

    svc.selectNode(source);
    let recording = makeCanvasRecorder();
    renderNetworkGuide(svc, app, layer, recording.ctx);
    expect(recording.calls.dashes).toContainEqual([4, 3]);
    expect(recording.calls.arcs.some(({ radius }) => radius === 12)).toBe(true);
    expect(recording.calls.strokes).toContainEqual({ style: '#FFFFFF', width: 5 });
    expect(recording.calls.strokes).toContainEqual({ style: ink, width: 2 });

    svc.selectEdge(edge);
    recording = makeCanvasRecorder();
    renderNetworkGuide(svc, app, layer, recording.ctx);
    expect(recording.calls.strokes).toContainEqual({ style: '#FFFFFF', width: 4.5 });
    expect(recording.calls.strokes).toContainEqual({ style: ink, width: 2.5 });
    expect(recording.calls.strokeRects).toHaveLength(0);

    svc.selectControlPoint(edge, 1);
    expect(svc.selectedControlPoint()).toEqual({ edge, index: 1, point: edge.controlPoints[1] });
    recording = makeCanvasRecorder();
    renderNetworkGuide(svc, app, layer, recording.ctx);
    expect(recording.calls.strokeRects).toContainEqual(expect.objectContaining({
      width: 14, height: 14, style: '#FFFFFF', lineWidth: 4
    }));
    expect(recording.calls.strokeRects).toContainEqual(expect.objectContaining({
      width: 14, height: 14, style: ink, lineWidth: 2
    }));
    expect(recording.calls.strokeRects.filter(({ width }) => width === 10)).toHaveLength(0);

    const controlEventsBefore = app.events.filter(([event]) => event === 'network:control-selected').length;
    svc.setSelectedEdgeDirection('one-way');
    expect(svc.selectedControlPoint()).toEqual({ edge, index: 1, point: edge.controlPoints[1] });
    expect(app.events.filter(([event]) => event === 'network:control-selected'))
      .toHaveLength(controlEventsBefore + 1);

    // Even corrupted/stale transient state cannot leak pen or hover drawing
    // into passive inspection: renderOverlay owns an active-mode guard.
    svc.penNodeId = source.id;
    svc.hover = { kind: 'node', id: target.id };
    svc.cursorImg = { x: 0.9, y: 0.9 };
    recording = makeCanvasRecorder();
    svc.renderOverlay(
      { scaleSizeClamped: value => value },
      recording.ctx,
      {
        swarmEngine: app.swarmEngine,
        imageToCanvas: (x, y) => ({ x: x * SCALE, y: y * SCALE }),
      }
    );
    expect(recording.calls.saves).toBe(0);

    svc.enter(layer);
    svc.selectEdge(edge);
    recording = makeCanvasRecorder();
    svc.renderOverlay(
      { scaleSizeClamped: value => value },
      recording.ctx,
      {
        swarmEngine: app.swarmEngine,
        imageToCanvas: (x, y) => ({ x: x * SCALE, y: y * SCALE }),
      }
    );
    expect(recording.calls.strokeRects.filter(({ width }) => width === 10)).toHaveLength(2);
  });

  test('card guidance names passive controls and retains active-mode shortcuts', () => {
    const layer = bindForInspection(app);
    const source = layer.graph.addNode({ x: 0.2, y: 0.5 });
    const target = layer.graph.addNode({ x: 0.8, y: 0.5 });
    const edge = layer.graph.addEdge({ sourceId: source.id, targetId: target.id });

    svc.selectNode(source);
    expect(document.getElementById('network-node-hint').textContent).toMatch(/Use Type/);
    expect(document.getElementById('network-node-hint').textContent).toMatch(/Delete node/);
    expect(document.getElementById('network-node-hint').textContent).not.toMatch(/T cycles|Shift-click/);

    svc.selectEdge(edge);
    expect(document.getElementById('network-edge-hint').textContent).toMatch(/Direction and Traffic/);
    expect(document.getElementById('network-edge-hint').textContent).toMatch(/Delete edge/);
    expect(document.getElementById('network-edge-hint').textContent).not.toMatch(/Shift-click/);

    svc.enter(layer);
    svc.selectNode(source);
    expect(document.getElementById('network-node-hint').textContent).toMatch(/T cycles.*drag.*Shift-click/);
    svc.selectEdge(edge);
    expect(document.getElementById('network-edge-hint').textContent).toMatch(/Drag the edge.*Shift-click/);
  });

  test('Node card edits and deletes a passive selection with one commit per action', () => {
    const layer = bindForInspection(app);
    const node = layer.graph.addNode({ x: 0.5, y: 0.5 });
    svc.selectNode(node);
    const commitsBefore = app.events.filter(
      ([event, payload]) => event === 'network:changed' && payload.commit).length;
    const undoBefore = app.undoSaves;
    const autoBefore = app.autoSaves;

    const type = document.getElementById('network-node-type');
    type.value = 'entry';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node.type).toBe('entry');
    expect(app.events.filter(
      ([event, payload]) => event === 'network:changed' && payload.commit))
      .toHaveLength(commitsBefore + 1);
    expect(app.undoSaves).toBe(undoBefore + 1);
    expect(app.autoSaves).toBe(autoBefore + 1);

    document.getElementById('network-node-delete').click();
    expect(layer.graph.getNodes()).toHaveLength(0);
    expect(app.events.filter(
      ([event, payload]) => event === 'network:changed' && payload.commit))
      .toHaveLength(commitsBefore + 2);
    expect(app.undoSaves).toBe(undoBefore + 2);
    expect(app.autoSaves).toBe(autoBefore + 2);
  });

  test('Edge card edits and deletes a passive selection with one commit per action', () => {
    const layer = bindForInspection(app);
    const source = layer.graph.addNode({ x: 0.2, y: 0.5 });
    const target = layer.graph.addNode({ x: 0.8, y: 0.5 });
    const edge = layer.graph.addEdge({ sourceId: source.id, targetId: target.id });
    svc.selectEdge(edge);
    const commitsBefore = app.events.filter(
      ([event, payload]) => event === 'network:changed' && payload.commit).length;
    const undoBefore = app.undoSaves;
    const autoBefore = app.autoSaves;

    const direction = document.getElementById('network-edge-direction');
    direction.value = 'one-way';
    direction.dispatchEvent(new Event('change', { bubbles: true }));
    expect(edge.direction).toBe('one-way');
    expect(app.events.filter(
      ([event, payload]) => event === 'network:changed' && payload.commit))
      .toHaveLength(commitsBefore + 1);
    expect(app.undoSaves).toBe(undoBefore + 1);
    expect(app.autoSaves).toBe(autoBefore + 1);

    document.getElementById('network-edge-delete').click();
    expect(layer.graph.getEdges()).toHaveLength(0);
    expect(app.events.filter(
      ([event, payload]) => event === 'network:changed' && payload.commit))
      .toHaveLength(commitsBefore + 2);
    expect(app.undoSaves).toBe(undoBefore + 2);
    expect(app.autoSaves).toBe(autoBefore + 2);
  });

  test('inspection APIs preserve an already-active drawing session', () => {
    const layer = enterMode(app);
    const node = svc.placeNode({ x: 0.5, y: 0.5 });
    const keyHandler = svc._keyHandler;

    svc.bindForInspection(layer);
    expect(svc.active).toBe(true);
    expect(svc.layer).toBe(layer);
    expect(svc.selectedNode()).toBe(node);
    expect(svc._keyHandler).toBe(keyHandler);
    expect(document.getElementById('network-edit-banner')).toBeTruthy();

    svc.clearInspection();
    expect(svc.active).toBe(true);
    expect(svc.layer).toBe(layer);
    expect(svc.selection).toBeNull();
    expect(svc.penNodeId).toBe(node.id);
    expect(svc._keyHandler).toBe(keyHandler);
    expect(document.getElementById('network-edit-banner')).toBeTruthy();
  });

  test('crowd context changes clear passive binding and selection safely', () => {
    const layer = bindForInspection(app);
    const node = layer.graph.addNode({ x: 0.5, y: 0.5 });
    svc.selectNode(node);

    app.eventBus.emit('crowd:selected', layer);
    expect(svc.selectedNode()).toBe(node); // same crowd retains inspection

    const other = app.scene.addFlowLayer({ guideType: 'graph', emitters: [{}] });
    app.eventBus.emit('crowd:selected', other);
    expect(svc.active).toBe(false);
    expect(svc.layer).toBeNull();
    expect(svc.selection).toBeNull();

    svc.bindForInspection(layer);
    svc.selectNode(node);
    app.eventBus.emit('crowd:deselected');
    expect(svc.layer).toBeNull();
    expect(svc.selection).toBeNull();
    expect(app.events.map(([event]) => event)).toContain('network:node-deselected');
  });

  test('restore rebinds passive selection to fresh model objects, then clears if absent', () => {
    const layer = bindForInspection(app);
    const node = layer.graph.addNode({ x: 0.5, y: 0.5 });
    svc.selectNode(node);

    app.scene.fromJSON(app.scene.toJSON());
    const fresh = app.scene.getFlowLayer(layer.id);
    app.selectedCrowd = fresh;
    app.resolveNetworkAfterRestore();

    expect(svc.active).toBe(false);
    expect(svc.layer).toBe(fresh);
    expect(svc.selectedNode()).toBe(fresh.graph.getNode(node.id));
    expect(svc.selectedNode()).not.toBe(node);

    app.scene.clear();
    app.selectedCrowd = null;
    app.resolveNetworkAfterRestore();
    expect(svc.layer).toBeNull();
    expect(svc.selection).toBeNull();
  });

  test('restore preserves a passive control-point selection by edge id and index', () => {
    const layer = bindForInspection(app);
    const source = layer.graph.addNode({ x: 0.2, y: 0.5 });
    const target = layer.graph.addNode({ x: 0.8, y: 0.5 });
    const edge = layer.graph.addEdge({ sourceId: source.id, targetId: target.id });
    edge.addControlPoint(0.5, 0.4);
    svc.selectControlPoint(edge, 0);

    app.scene.fromJSON(app.scene.toJSON());
    const fresh = app.scene.getFlowLayer(layer.id);
    app.selectedCrowd = fresh;
    app.resolveNetworkAfterRestore();

    expect(svc.active).toBe(false);
    expect(svc.selectedControlPoint()).toEqual({
      edge: fresh.graph.getEdge(edge.id),
      index: 0,
      point: fresh.graph.getEdge(edge.id).controlPoints[0],
    });
  });
});

describe('pen chaining', () => {
  test('first node: placed, selected, pen anchored, no edge yet', () => {
    const layer = enterMode(app);
    const node = svc.placeNode({ x: 0.3, y: 0.4 });
    expect(layer.graph.getNodes()).toHaveLength(1);
    expect(layer.graph.getEdges()).toHaveLength(0);
    expect(node.x).toBeCloseTo(0.3, 10);
    expect(svc.penNodeId).toBe(node.id);
    expect(svc.selection).toEqual({ kind: 'node', id: node.id });
  });

  test('successive clicks chain nodes with edges, pen moving along', () => {
    const layer = enterMode(app);
    const a = svc.placeNode({ x: 0.1, y: 0.1 });
    const b = svc.placeNode({ x: 0.5, y: 0.1 });
    const c = svc.placeNode({ x: 0.9, y: 0.1 });
    const edges = layer.graph.getEdges();
    expect(edges).toHaveLength(2);
    expect(edges[0].sourceId).toBe(a.id);
    expect(edges[0].targetId).toBe(b.id);
    expect(edges[1].sourceId).toBe(b.id);
    expect(edges[1].targetId).toBe(c.id);
    expect(svc.penNodeId).toBe(c.id);
  });

  test('shift-placing snaps the link to 15° from the pen node', () => {
    enterMode(app);
    svc.placeNode({ x: 0.5, y: 0.5 });
    // ~20° below horizontal from the pen node → snaps back to 15°
    const dist = 0.2;
    const rad20 = 20 * Math.PI / 180;
    const node = svc.placeNode(
      { x: 0.5 + dist * Math.cos(rad20), y: 0.5 + dist * Math.sin(rad20) }, true);
    const rad15 = 15 * Math.PI / 180;
    expect(node.x).toBeCloseTo(0.5 + dist * Math.cos(rad15), 10);
    expect(node.y).toBeCloseTo(0.5 + dist * Math.sin(rad15), 10);
  });

  test('clicking an existing node closes loops but never duplicates a link', () => {
    const layer = enterMode(app);
    const a = svc.placeNode({ x: 0.1, y: 0.1 });
    const b = svc.placeNode({ x: 0.5, y: 0.1 });
    const c = svc.placeNode({ x: 0.3, y: 0.4 });
    svc.clickNode(a); // c → a closes the triangle
    expect(layer.graph.getEdges()).toHaveLength(3);
    expect(svc.penNodeId).toBe(a.id);
    svc.clickNode(b); // a and b are already joined — no duplicate edge
    expect(layer.graph.getEdges()).toHaveLength(3);
    expect(svc.penNodeId).toBe(b.id);
  });

  test('clicking a node with the pen up just picks the pen up there', () => {
    const layer = enterMode(app);
    const a = svc.placeNode({ x: 0.1, y: 0.1 });
    svc.penNodeId = null; // pen lifted (Esc)
    svc.clickNode(a);
    expect(layer.graph.getEdges()).toHaveLength(0);
    expect(svc.penNodeId).toBe(a.id);
  });

  test('selecting an edge lifts the pen (inspecting is not drawing)', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.1 });
    svc.placeNode({ x: 0.5, y: 0.1 });
    const edge = layer.graph.getEdges()[0];
    svc.selectEdge(edge);
    expect(svc.penNodeId).toBeNull();
    expect(svc.selection).toEqual({ kind: 'edge', id: edge.id });
    expect(app.events.map(e => e[0])).toContain('network:node-deselected');
    expect(app.events.map(e => e[0])).toContain('network:edge-selected');
  });
});

describe('node and edge params', () => {
  test('T cycles pass-through → entry → exit → pass-through', () => {
    enterMode(app);
    const node = svc.placeNode({ x: 0.5, y: 0.5 });
    svc.cycleSelectedNodeType();
    expect(node.type).toBe('entry');
    svc.cycleSelectedNodeType();
    expect(node.type).toBe('exit');
    svc.cycleSelectedNodeType();
    expect(node.type).toBe('normal');
  });

  test('swap reverses a one-way edge and its control points', () => {
    const layer = enterMode(app);
    const a = svc.placeNode({ x: 0.1, y: 0.1 });
    const b = svc.placeNode({ x: 0.9, y: 0.1 });
    const edge = layer.graph.getEdges()[0];
    edge.controlPoints = [{ x: 0.3, y: 0.2 }, { x: 0.7, y: 0.2 }];
    const selectedPoint = edge.controlPoints[0];
    svc.selectControlPoint(edge, 0);

    svc.swapSelectedEdgeDirection(); // two-way: no-op
    expect(edge.sourceId).toBe(a.id);

    svc.setSelectedEdgeDirection('one-way');
    svc.swapSelectedEdgeDirection();
    expect(edge.sourceId).toBe(b.id);
    expect(edge.targetId).toBe(a.id);
    expect(edge.controlPoints[0].x).toBeCloseTo(0.7, 10);
    expect(svc.selectedControlPoint()).toEqual({ edge, index: 1, point: selectedPoint });
  });

  test('deleting a node cascades its edges and drops pen + selection', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.1 });
    const b = svc.placeNode({ x: 0.5, y: 0.1 });
    svc.deleteNode(b);
    expect(layer.graph.getNodes()).toHaveLength(1);
    expect(layer.graph.getEdges()).toHaveLength(0);
    expect(svc.penNodeId).toBeNull();
    expect(svc.selection).toBeNull();
  });

  test('deleting a node clears an incident edge or control selection in active and passive scopes', () => {
    const layer = enterMode(app);
    const activeSource = svc.placeNode({ x: 0.1, y: 0.1 });
    svc.placeNode({ x: 0.5, y: 0.1 });
    const activeEdge = layer.graph.getEdges()[0];
    activeEdge.controlPoints = [{ x: 0.3, y: 0.2 }];
    svc.selectControlPoint(activeEdge, 0);
    app.events.length = 0;

    svc.deleteNode(activeSource);
    expect(svc.selection).toBeNull();
    expect(app.events.map(([event]) => event)).toContain('network:control-deselected');
    expect(app.events.map(([event]) => event)).toContain('network:edge-deselected');

    svc.exit();
    const passiveLayer = app.scene.addFlowLayer({ guideType: 'graph', emitters: [{}] });
    const passiveSource = passiveLayer.graph.addNode({ x: 0.1, y: 0.6 });
    const passiveTarget = passiveLayer.graph.addNode({ x: 0.9, y: 0.6 });
    const passiveEdge = passiveLayer.graph.addEdge({
      sourceId: passiveSource.id,
      targetId: passiveTarget.id,
    });
    svc.bindForInspection(passiveLayer);
    svc.selectEdge(passiveEdge);
    app.events.length = 0;

    svc.deleteNode(passiveSource);
    expect(svc.active).toBe(false);
    expect(svc.selection).toBeNull();
    expect(app.events.map(([event]) => event)).toContain('network:edge-deselected');
  });
});

describe('drags', () => {
  test('node drag moves it, snaps against its first neighbour with Shift, one commit', () => {
    enterMode(app);
    const a = svc.placeNode({ x: 0.5, y: 0.5 });
    const b = svc.placeNode({ x: 0.7, y: 0.5 });
    const commitsBefore = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;

    svc.beginNodeDrag(b);
    const rad20 = 20 * Math.PI / 180;
    svc.moveDrag({ x: 0.5 + 0.2 * Math.cos(rad20), y: 0.5 + 0.2 * Math.sin(rad20) }, true);
    const rad15 = 15 * Math.PI / 180;
    expect(b.x).toBeCloseTo(0.5 + 0.2 * Math.cos(rad15), 10); // snapped vs a
    expect(a.x).toBeCloseTo(0.5, 10);
    svc.endDrag();

    const commits = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    expect(commits).toBe(commitsBefore + 1);
  });

  test('edge bend inserts a control point in chain order and drags it', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];
    const selectedControls = [];
    app.eventBus.on('network:control-selected', payload => selectedControls.push(payload));

    svc.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 0);
    svc.moveDrag({ x: 0.5, y: 0.3 });
    svc.endDrag();
    expect(edge.controlPoints).toHaveLength(1);
    expect(edge.controlPoints[0].y).toBeCloseTo(0.3, 10);
    expect(selectedControls[0]).toEqual({ edge, index: 0 });

    // A second bend nearer the target lands after the first control
    svc.beginEdgeBend(edge, { x: 0.7, y: 0.45 }, 1);
    svc.moveDrag({ x: 0.7, y: 0.6 });
    svc.endDrag();
    expect(edge.controlPoints.map(p => p.x)).toEqual([0.5, 0.7]);
    expect(selectedControls[1]).toEqual({ edge, index: 1 });
  });

  test('Esc mid-bend removes the inserted control point', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];
    svc.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 0);
    svc.moveDrag({ x: 0.5, y: 0.2 });
    svc.cancelDrag();
    expect(edge.controlPoints).toHaveLength(0);
  });

  test('Esc restores an existing control point instead of deleting it', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];
    edge.addControlPoint(0.5, 0.5);

    svc.beginControlDrag(edge, 0);
    svc.moveDrag({ x: 0.7, y: 0.2 });
    svc.cancelDrag();

    expect(edge.controlPoints).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  test('a drag that never moves commits nothing', () => {
    enterMode(app);
    const a = svc.placeNode({ x: 0.5, y: 0.5 });
    const commitsBefore = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    svc.beginNodeDrag(a);
    svc.endDrag();
    const commits = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    expect(commits).toBe(commitsBefore);
  });

  test('an existing control drag that never moves commits nothing', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];
    edge.addControlPoint(0.5, 0.5);
    const commitsBefore = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;

    svc.beginControlDrag(edge, 0);
    svc.endDrag();

    const commits = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    expect(commits).toBe(commitsBefore);
    expect(edge.controlPoints).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  test('an inserted bend commits once even when it is released at its insertion point', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];
    const commitsBefore = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;

    svc.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 0);
    svc.endDrag();

    const commits = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    expect(commits).toBe(commitsBefore + 1);
    expect(edge.controlPoints).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  test('network:drag-cancel restores geometry through the pointer-routing event without committing', () => {
    enterMode(app);
    const node = svc.placeNode({ x: 0.5, y: 0.5 });
    const before = JSON.stringify(node.toJSON());
    const commitsBefore = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;

    svc.beginNodeDrag(node);
    svc.moveDrag({ x: 0.8, y: 0.2 });
    expect(JSON.stringify(node.toJSON())).not.toBe(before);
    app.eventBus.emit('network:drag-cancel');

    expect(JSON.stringify(node.toJSON())).toBe(before);
    expect(svc.drag).toBeNull();
    const commits = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    expect(commits).toBe(commitsBefore);
  });

  test('exiting the mode cancels an active bend before unbinding its layer', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];
    const commitsBefore = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;

    svc.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 0);
    svc.moveDrag({ x: 0.5, y: 0.2 });
    expect(edge.controlPoints).toHaveLength(1);
    svc.exit();

    expect(edge.controlPoints).toHaveLength(0);
    expect(svc.active).toBe(false);
    expect(svc.layer).toBeNull();
    expect(svc.drag).toBeNull();
    const commits = app.events.filter(
      ([ev, p]) => ev === 'network:changed' && p.commit).length;
    expect(commits).toBe(commitsBefore);
  });
});

describe('Escape ladder and keys', () => {
  const escape = () => document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  test('Esc lifts the pen, then clears selection, then exits', () => {
    enterMode(app);
    const node = svc.placeNode({ x: 0.5, y: 0.5 });
    expect(svc.penNodeId).toBe(node.id);

    escape();
    expect(svc.penNodeId).toBeNull();
    expect(svc.selection).toEqual({ kind: 'node', id: node.id });
    expect(svc.active).toBe(true);

    escape();
    expect(svc.selection).toBeNull();
    expect(svc.active).toBe(true);

    escape();
    expect(svc.active).toBe(false);
  });

  test('Delete removes the selection; T cycles the selected node', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.5, y: 0.5 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true }));
    expect(layer.graph.getNodes()[0].type).toBe('entry');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(layer.graph.getNodes()).toHaveLength(0);
  });
});

describe('mixin glue', () => {
  test('switching an empty-network crowd to Custom network hands over the pen', () => {
    const layer = app.scene.addFlowLayer({ guideType: 'route', emitters: [{}] });
    app.selectedCrowd = layer;
    app.previewMode = true; // Entering the mode is editing — Preview must yield
    layer.setGuideType('graph');
    app.eventBus.emit('network:guide-changed', layer);
    expect(svc.active).toBe(true);
    expect(svc.layer).toBe(layer);
    expect(app.previewMode).toBe(false);
  });

  test('a crowd whose network exists does not auto-enter; route switch exits', () => {
    const layer = app.scene.addFlowLayer({ guideType: 'graph', emitters: [{}] });
    layer.graph.addNode({ x: 0.5, y: 0.5 });
    app.selectedCrowd = layer;
    app.eventBus.emit('network:guide-changed', layer);
    expect(svc.active).toBe(false);

    svc.enter(layer);
    layer.setGuideType('route');
    app.eventBus.emit('network:guide-changed', layer);
    expect(svc.active).toBe(false);
  });

  test('crowd deselection and preview mode both close the mode', () => {
    enterMode(app);
    app.eventBus.emit('crowd:deselected');
    expect(svc.active).toBe(false);

    enterMode(app);
    app.eventBus.emit('motion:preview-mode-change', true);
    expect(svc.active).toBe(false);
  });

  test('network:changed pipeline: commits snapshot + autosave, drags only render', () => {
    enterMode(app);
    const undoBefore = app.undoSaves;
    const autoBefore = app.autoSaves;
    app.eventBus.emit('network:changed', { commit: true });
    expect(app.undoSaves).toBe(undoBefore + 1);
    expect(app.autoSaves).toBe(autoBefore + 1);

    const renderBefore = app.renders;
    app.eventBus.emit('network:changed', { commit: false });
    expect(app.undoSaves).toBe(undoBefore + 1);
    expect(app.autoSaves).toBe(autoBefore + 1);
    expect(app.renders).toBe(renderBefore + 1);
  });

  test('hit cascade: control handle of the selected edge > node > edge', () => {
    const layer = enterMode(app);
    svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.9, y: 0.5 });
    const edge = layer.graph.getEdges()[0];

    // Mid-edge, nothing selected: the edge itself, with insertIndex 0
    let hit = app.findNetworkTargetAt(500, 500);
    expect(hit.kind).toBe('edge');
    expect(hit.insertIndex).toBe(0);

    // Node wins over edge where they overlap
    hit = app.findNetworkTargetAt(105, 500);
    expect(hit.kind).toBe('node');

    // With the edge selected and a control point present, the handle wins
    edge.addControlPoint(0.5, 0.5);
    svc.selectEdge(edge);
    hit = app.findNetworkTargetAt(503, 503);
    expect(hit.kind).toBe('control');
    expect(hit.controlIndex).toBe(0);

    // Far from everything: nothing
    expect(app.findNetworkTargetAt(500, 100)).toBeNull();
  });

  test('clicks: empty canvas places, shift-click deletes with an undo toast', () => {
    const layer = enterMode(app);
    app._handleNetworkClick(300, 300, false);
    expect(layer.graph.getNodes()).toHaveLength(1);
    expect(app.announced).toContain('Node placed');

    app._handleNetworkClick(300, 300, true); // shift-click the node
    expect(layer.graph.getNodes()).toHaveLength(0);
    expect(app.events.some(([ev, p]) => ev === 'ui:toast' && /Deleted node/.test(p.message))).toBe(true);
  });

  test('weight readout shows junction traffic shares, not the bare weight', () => {
    const layer = enterMode(app);
    const a = svc.placeNode({ x: 0.1, y: 0.5 });
    svc.placeNode({ x: 0.5, y: 0.5 });
    const c = layer.graph.addNode({ x: 0.9, y: 0.5 });
    const ab = layer.graph.getEdges()[0];
    layer.graph.addEdge({ sourceId: svc.penNodeId, targetId: c.id, weight: 3 });

    svc.selectEdge(ab); // weight 1; at b the sibling has weight 3 → 25%
    app.syncNetworkCards();
    const readout = document.getElementById('network-edge-weight-value').textContent;
    expect(readout).toBe('100% · 25% configured shares');

    ab.setDirection('one-way'); // departures from a only
    app.syncNetworkCards();
    expect(document.getElementById('network-edge-weight-value').textContent)
      .toBe('100% configured share');
    expect(a.id).toBe(ab.sourceId);
  });

  test('junction rows edit all competing path weights and keep percentages at 100', () => {
    const layer = enterMode(app);
    const junction = layer.graph.addNode({ id: 'junction', x: 0.5, y: 0.5 });
    const exitA = layer.graph.addNode({ id: 'exit-a', x: 0.9, y: 0.2, type: 'exit' });
    const exitB = layer.graph.addNode({ id: 'exit-b', x: 0.9, y: 0.8, type: 'exit' });
    const heavy = layer.graph.addEdge({
      id: 'heavy', sourceId: junction.id, targetId: exitA.id, direction: 'one-way', weight: 3
    });
    const light = layer.graph.addEdge({
      id: 'light', sourceId: junction.id, targetId: exitB.id, direction: 'one-way', weight: 1
    });

    svc.selectNode(junction);

    const fieldset = document.getElementById('network-path-weights');
    const inputs = [...document.querySelectorAll('.network-path-weight-row input')];
    const names = [...document.querySelectorAll('.network-path-weight-name')].map(el => el.textContent);
    const outputs = () => [...document.querySelectorAll('.network-path-weight-value')]
      .map(el => el.textContent);
    expect(fieldset.hidden).toBe(false);
    expect(names).toEqual(['Path 1 to exit 1', 'Path 2 to exit 2']);
    expect(outputs()).toEqual(['Weight 3 · 75%', 'Weight 1 · 25%']);

    const paramEventsBefore = app.events.filter(([event]) => event === 'crowd:param-changed').length;
    inputs[1].value = '3';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));

    expect(heavy.weight).toBe(3);
    expect(light.weight).toBe(3);
    expect(outputs()).toEqual(['Weight 3 · 50%', 'Weight 3 · 50%']);
    expect(app.events.filter(([event]) => event === 'crowd:param-changed'))
      .toHaveLength(paramEventsBefore + 1);
  });

  test('junction rows hide without a choice and reject non-positive input', () => {
    const layer = enterMode(app);
    const source = layer.graph.addNode({ x: 0.1, y: 0.5 });
    const junction = layer.graph.addNode({ x: 0.5, y: 0.5 });
    const exitA = layer.graph.addNode({ x: 0.9, y: 0.2, type: 'exit' });
    const exitB = layer.graph.addNode({ x: 0.9, y: 0.8, type: 'exit' });
    layer.graph.addEdge({ sourceId: source.id, targetId: junction.id, direction: 'one-way' });
    const first = layer.graph.addEdge({ sourceId: junction.id, targetId: exitA.id, direction: 'one-way' });

    svc.selectNode(junction);
    expect(document.getElementById('network-path-weights').hidden).toBe(true);

    layer.graph.addEdge({ sourceId: junction.id, targetId: exitB.id, direction: 'one-way' });
    app.syncNetworkCards();
    const input = document.querySelector('.network-path-weight-row input');
    expect(document.getElementById('network-path-weights').hidden).toBe(false);
    const paramEventsBefore = app.events.filter(([event]) => event === 'crowd:param-changed').length;
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(first.weight).toBe(1);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(app.events.filter(([event]) => event === 'crowd:param-changed'))
      .toHaveLength(paramEventsBefore);
  });

  test('junction rows rebuild from fresh edge objects after restore', () => {
    const layer = enterMode(app);
    const junction = layer.graph.addNode({ id: 'junction', x: 0.5, y: 0.5 });
    const a = layer.graph.addNode({ id: 'a', x: 0.9, y: 0.2, type: 'exit' });
    const b = layer.graph.addNode({ id: 'b', x: 0.9, y: 0.8, type: 'exit' });
    layer.graph.addEdge({ id: 'a-edge', sourceId: junction.id, targetId: a.id, weight: 3 });
    layer.graph.addEdge({ id: 'b-edge', sourceId: junction.id, targetId: b.id, weight: 1 });
    svc.selectNode(junction);

    app.scene.fromJSON(app.scene.toJSON());
    const fresh = app.scene.getFlowLayer(layer.id);
    app.selectedCrowd = fresh;
    app.resolveNetworkAfterRestore();

    expect(svc.selectedNode()).toBe(fresh.graph.getNode(junction.id));
    expect([...document.querySelectorAll('.network-path-weight-value')].map(el => el.textContent))
      .toEqual(['Weight 3 · 75%', 'Weight 1 · 25%']);
  });

  test('selected-junction guide widths preview shares without changing edge colour', () => {
    const layer = enterMode(app);
    const junction = layer.graph.addNode({ x: 0.5, y: 0.5 });
    const a = layer.graph.addNode({ x: 0.9, y: 0.2, type: 'exit' });
    const b = layer.graph.addNode({ x: 0.9, y: 0.8, type: 'exit' });
    layer.graph.addEdge({ sourceId: junction.id, targetId: a.id, weight: 3 });
    layer.graph.addEdge({ sourceId: junction.id, targetId: b.id, weight: 1 });
    svc.selectNode(junction);

    const strokes = [];
    const ctx = {
      save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
      closePath() {}, arc() {}, rect() {}, fill() {},
      stroke() { strokes.push({ width: this.lineWidth, style: this.strokeStyle }); },
    };
    svc.renderGuide(
      { scaleSizeClamped: value => value },
      ctx,
      {
        swarmEngine: app.swarmEngine,
        imageToCanvas: (x, y) => ({ x: x * SCALE, y: y * SCALE }),
      },
      layer
    );

    expect(strokes[0].width).toBeGreaterThan(strokes[1].width);
    expect(strokes[1].width).toBeGreaterThan(2);
    expect(strokes[0].style).toBe(strokes[1].style);
  });

  test('restore re-binds the fresh layer and re-resolves the selection by id', () => {
    const layer = enterMode(app);
    const node = svc.placeNode({ x: 0.5, y: 0.5 });

    // Simulate an undo restore: scene rebuilt from JSON, same ids
    app.scene.fromJSON(app.scene.toJSON());
    const fresh = app.scene.getFlowLayer(layer.id);
    app.selectedCrowd = fresh;
    app.resolveNetworkAfterRestore();

    expect(svc.active).toBe(true);
    expect(svc.layer).toBe(fresh);
    expect(svc.layer).not.toBe(layer);
    expect(svc.selectedNode()?.id).toBe(node.id);

    // Layer gone entirely → the mode closes
    app.scene.clear();
    app.selectedCrowd = null;
    app.resolveNetworkAfterRestore();
    expect(svc.active).toBe(false);
  });

  test('guide card: button shows for graph guides, hint tracks the network', () => {
    const layer = app.scene.addFlowLayer({ guideType: 'route', emitters: [{}] });
    app.selectedCrowd = layer;
    app.updateGuideCard();
    const btn = document.getElementById('network-edit-btn');
    expect(btn.hidden).toBe(true);

    layer.setGuideType('graph');
    app.updateGuideCard();
    expect(btn.hidden).toBe(false);
    expect(document.getElementById('crowd-guide-hint').textContent).toMatch(/No network yet/);

    layer.graph.addNode({ x: 0.2, y: 0.2 });
    layer.graph.addNode({ x: 0.8, y: 0.2 });
    app.updateGuideCard();
    expect(document.getElementById('crowd-guide-hint').textContent).toMatch(/2 nodes, 0 edges/);
  });

  test('a route-free network explains the timing needed for preview and export', () => {
    const layer = app.scene.addFlowLayer({ guideType: 'graph', emitters: [{}] });
    app.selectedCrowd = layer;
    app.waypoints = [];

    app.updateGuideCard();

    const hint = document.getElementById('crowd-guide-hint').textContent;
    expect(hint).toMatch(/at least two route waypoints/);
    expect(hint).toMatch(/previewing or exporting/);
  });
});

describe('passive inspector UI state', () => {
  function inspectorMarkup() {
    document.body.innerHTML = `
      <div id="scope-chip" data-scope="route">
        <button id="scope-prev-btn" type="button"></button>
        <span id="scope-chip-text">Editing · Route</span>
        <button id="scope-route-btn" type="button"></button>
        <button id="scope-next-btn" type="button"></button>
      </div>
      <div id="settings-help-placeholder"></div>
      <div id="settings-sections">
        <div id="route-scope"><section class="settings-section" data-section="route"></section></div>
        <div id="waypoint-scope" hidden></div>
        <div id="crowd-scope" hidden></div>
        <div id="node-scope" hidden></div>
        <div id="edge-scope" hidden></div>
      </div>
      <ul id="waypoint-list"></ul>
      <button id="outline-control" type="button">Outline item</button>
    `;
  }

  test('node scope and chip do not depend on the drawing-mode flag', () => {
    inspectorMarkup();
    const bus = new EventBus();
    const sectionController = new SectionController(bus);
    sectionController.init();
    const ui = new UIController({ waypointList: document.getElementById('waypoint-list') }, bus);
    const crowd = { name: 'Visitors' };
    const node = { id: 'node-1', type: 'entry' };

    bus.emit('crowd:selected', crowd);
    bus.emit('network:node-selected', { node });
    expect(document.getElementById('node-scope').hidden).toBe(false);
    expect(document.getElementById('scope-chip-text').textContent).toBe('Editing · Node · entry');

    // A passive selection is not owned by edit-mode state.
    bus.emit('network:edit-mode-changed', { active: false, layer: null });
    expect(document.getElementById('node-scope').hidden).toBe(false);
    expect(document.getElementById('scope-chip-text').textContent).toBe('Editing · Node · entry');

    bus.emit('network:node-deselected');
    expect(document.getElementById('node-scope').hidden).toBe(true);
    expect(document.getElementById('crowd-scope').hidden).toBe(false);
    expect(ui._networkSelection).toBeNull();
  });

  test('successful project replacement clears stale inspector and scope-chip objects', () => {
    inspectorMarkup();
    const bus = new EventBus();
    const sections = new SectionController(bus);
    sections.init();
    const ui = new UIController({ waypointList: document.getElementById('waypoint-list') }, bus);
    const oldCrowd = { name: 'Previous project visitors' };
    const oldNode = { id: 'old-node', type: 'entry' };

    bus.emit('crowd:selected', oldCrowd);
    bus.emit('network:node-selected', { node: oldNode });
    expect(document.getElementById('node-scope').hidden).toBe(false);
    expect(document.getElementById('scope-chip-text').textContent).toBe('Editing · Node · entry');

    bus.emit('project:replaced');

    expect(ui._selectedCrowd).toBeNull();
    expect(ui._networkSelection).toBeNull();
    expect(sections.hasSelection).toBe(false);
    expect(sections.hasCrowdSelection).toBe(false);
    expect(sections.networkSelection).toBeNull();
    expect(document.getElementById('scope-chip-text').textContent).toBe('Editing · Route');
    expect(document.getElementById('route-scope').hidden).toBe(false);
    expect(document.getElementById('crowd-scope').hidden).toBe(true);
    expect(document.getElementById('node-scope').hidden).toBe(true);
  });

  test('waypoint rerender never steals focus from the scene outline', async () => {
    inspectorMarkup();
    const bus = new EventBus();
    const list = document.getElementById('waypoint-list');
    const ui = new UIController({ waypointList: list }, bus);
    const waypoint = {
      id: 'waypoint-1', isMajor: true, name: 'Start', dotColor: '#336699', _displayIndex: 1
    };
    ui.setSelection([waypoint], waypoint);
    const outlineControl = document.getElementById('outline-control');
    outlineControl.focus();

    ui.updateWaypointList([waypoint]);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(outlineControl);
  });

  test('waypoint rerender restores focus when it already belonged to the list', async () => {
    inspectorMarkup();
    const bus = new EventBus();
    const list = document.getElementById('waypoint-list');
    const ui = new UIController({ waypointList: list }, bus);
    const waypoint = {
      id: 'waypoint-1', isMajor: true, name: 'Start', dotColor: '#336699', _displayIndex: 1
    };
    ui.updateWaypointList([waypoint]);
    list.querySelector('.waypoint-row:not(.waypoint-add-btn)').focus();
    ui.setSelection([waypoint], waypoint);

    ui.updateWaypointList([waypoint]);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.activeElement)
      .toBe(list.querySelector('.waypoint-row:not(.waypoint-add-btn)'));
  });
});

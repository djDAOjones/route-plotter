import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { SceneOutlineController } from '../src/controllers/SceneOutlineController.js';
import { buildSceneOutlineSnapshot, sceneOutlineKey } from '../src/utils/sceneSemantics.js';
import { ENTITY_ID_LIMITS } from '../src/utils/entityId.js';
import { IMAGE_COORDINATES } from '../src/config/constants.js';
import { borderColourOf, cascade, colourIn, hex, tokensFor } from './helpers/cssTokens.js';

function makeFixture() {
  const major = new Waypoint({
    id: 'wp-major',
    imgX: 0.125,
    imgY: 0.75,
    isMajor: true,
    name: '<img src=x onerror=window.outlineInjected=true>',
    pauseTime: 2500,
    segmentSpeed: 1.5,
  });
  const minor = new Waypoint({
    id: 'wp-minor',
    imgX: 0.5,
    imgY: 0.4,
    isMajor: false,
    name: 'Curve point',
  });
  minor.areaHighlight.enabled = true;
  minor.areaHighlight.shape = 'polygon';
  minor.areaHighlight.fadeInMs = 1200;
  minor.areaHighlight.fadeOutMs = 800;
  minor.areaHighlight.points = [
    { x: 0.1, y: 0.2 },
    { x: 0.3, y: 0.4 },
    { x: 0.5, y: 0.6 },
  ];

  const scene = new Scene();
  const routeCrowd = scene.addFlowLayer({
    id: 'crowd-route',
    name: '</summary><script>window.outlineInjected=true</script>',
    guideType: 'route',
  });
  routeCrowd.addEmitter({ id: 'emitter-primary', dotCount: 20, seed: 11 });
  routeCrowd.addEmitter({ id: 'emitter-extra', dotCount: 7, seed: 12 });
  const entry = routeCrowd.graph.addNode({
    id: 'node-entry', x: 0.2, y: 0.3, type: 'entry', label: '<b>Entry</b>',
  });
  const exit = routeCrowd.graph.addNode({
    id: 'node-exit', x: 0.8, y: 0.7, type: 'exit', label: 'Exit',
  });
  const edge = routeCrowd.graph.addEdge({
    id: 'edge-a', sourceId: entry.id, targetId: exit.id, direction: 'one-way', weight: 2,
  });
  edge.addControlPoint(0.4, 0.6);

  const graphCrowd = scene.addFlowLayer({
    id: 'crowd-graph', name: 'Departures', guideType: 'graph', visible: false,
  });
  graphCrowd.addEmitter({ id: 'emitter-graph', dotCount: 9, seed: 13 });

  return { waypoints: [major, minor], scene, major, minor, routeCrowd, graphCrowd };
}

function makeAdversarialFixture() {
  const targetWaypoint = new Waypoint({
    id: 'target', imgX: 0.1, imgY: 0.2, isMajor: true, name: 'Target',
  });
  const substringWaypoint = new Waypoint({
    id: 'prefix:target%tail', imgX: 0.8, imgY: 0.9, isMajor: true, name: 'Substring',
  });
  const scene = new Scene();
  const colonCrowd = scene.addFlowLayer({
    id: 'a:b', name: 'Colon crowd', guideType: 'graph',
  });
  colonCrowd.addEmitter({ id: 'c' });
  colonCrowd.graph.addNode({
    id: 'c', x: 0.2, y: 0.3, type: 'entry', label: 'Colon node',
  });
  const splitCrowd = scene.addFlowLayer({
    id: 'a', name: 'Split crowd', guideType: 'graph',
  });
  splitCrowd.addEmitter({ id: 'b:c' });
  splitCrowd.graph.addNode({
    id: 'b:c', x: 0.7, y: 0.6, type: 'exit', label: 'Split node',
  });
  return {
    waypoints: [targetWaypoint, substringWaypoint],
    scene,
    targetWaypoint,
    substringWaypoint,
    colonCrowd,
    splitCrowd,
  };
}

function snapshotFor(fixture, options = {}) {
  return buildSceneOutlineSnapshot({
    waypoints: fixture.waypoints,
    scene: fixture.scene,
    ...options,
  });
}

function disclosure(container, key) {
  return [...container.querySelectorAll('details[data-outline-disclosure]')]
    .find(details => details.dataset.outlineDisclosure === key) || null;
}

async function openDisclosure(container, key) {
  let details = disclosure(container, key);
  if (!details) throw new Error(`Missing disclosure: ${key}`);
  if (!details.open) {
    details.querySelector(':scope > summary').click();
    await Promise.resolve();
    details = disclosure(container, key);
  }
  return details;
}

describe('semantic scene projection', () => {
  test('projects every persisted noun in canonical order, including dormant graph data', () => {
    const fixture = makeFixture();
    const selectionKey = 'control:crowd-route:edge-a:0';
    const snapshot = snapshotFor(fixture, { selectionKey });

    expect(snapshot.route.map(item => item.id)).toEqual(['wp-major', 'wp-minor']);
    expect(snapshot.route.map(item => item.isMajor)).toEqual([true, false]);
    expect(snapshot.route[0]).toMatchObject({
      x: 12.5, y: 75, pauseSeconds: 2.5, segmentSpeed: 1.5,
    });
    expect(snapshot.route[1].area.points.map(point => [point.x, point.y]))
      .toEqual([[10, 20], [30, 40], [50, 60]]);

    expect(snapshot.crowds.map(crowd => crowd.id)).toEqual(['crowd-route', 'crowd-graph']);
    expect(snapshot.crowds[0].emitters.map(emitter => emitter.id))
      .toEqual(['emitter-primary', 'emitter-extra']);
    expect(snapshot.crowds[0].graph.active).toBe(false);
    expect(snapshot.crowds[0].graph.nodes.map(node => node.id))
      .toEqual(['node-entry', 'node-exit']);
    expect(snapshot.crowds[0].graph.edges[0]).toMatchObject({
      id: 'edge-a', sourceName: 'Node 1', targetName: 'Node 2', direction: 'one-way', weight: 2,
    });
    expect(snapshot.crowds[0].graph.edges[0].controlPoints)
      .toEqual([{
        key: selectionKey,
        index: 0,
        x: 40,
        y: 60,
        xLabel: 40,
        yLabel: 60,
        xCanonical: 0.4,
        yCanonical: 0.6,
      }]);
    expect(snapshot.selectionKey).toBe(selectionKey);
    expect(snapshot.route[1].area.points[2].key)
      .toBe(sceneOutlineKey('vertex', 'wp-minor', 2));
    expect(snapshot.crowds[0].emitters[1].key)
      .toBe(sceneOutlineKey('emitter', 'crowd-route', 'emitter-extra'));
    expect(snapshot.crowds[0].graph.key)
      .toBe(sceneOutlineKey('network', 'crowd-route'));
    expect(snapshot).not.toHaveProperty('keys');
  });

  test('keeps colon, percent-like, and tuple-boundary IDs injective', () => {
    const fixture = makeAdversarialFixture();
    const colonNodeKey = sceneOutlineKey('node', 'a:b', 'c');
    const splitNodeKey = sceneOutlineKey('node', 'a', 'b:c');
    const percentNodeKey = sceneOutlineKey('node', 'a%3Ab', 'c');
    const colonEmitterKey = sceneOutlineKey('emitter', 'a:b', 'c');
    const splitEmitterKey = sceneOutlineKey('emitter', 'a', 'b:c');
    const colonControlsKey = sceneOutlineKey('controls', 'a:b', 'c');
    const splitControlsKey = sceneOutlineKey('controls', 'a', 'b:c');

    expect(colonNodeKey).toBe('node:a%3Ab:c');
    expect(splitNodeKey).toBe('node:a:b%3Ac');
    expect(percentNodeKey).toBe('node:a%253Ab:c');
    expect(new Set([
      colonNodeKey,
      splitNodeKey,
      percentNodeKey,
      colonEmitterKey,
      splitEmitterKey,
      colonControlsKey,
      splitControlsKey,
    ]).size).toBe(7);

    const snapshot = buildSceneOutlineSnapshot({
      waypoints: fixture.waypoints,
      scene: fixture.scene,
      selectionKey: splitNodeKey,
    });
    expect(snapshot.crowds[0].graph.nodes[0].key).toBe(colonNodeKey);
    expect(snapshot.crowds[1].graph.nodes[0].key).toBe(splitNodeKey);
    expect(snapshot.crowds[0].emitters[0].key).toBe(colonEmitterKey);
    expect(snapshot.crowds[1].emitters[0].key).toBe(splitEmitterKey);
    expect(snapshot.selectionKey).toBe(splitNodeKey);
    expect(snapshot).not.toHaveProperty('keys');

    const rawCollision = buildSceneOutlineSnapshot({
      waypoints: fixture.waypoints,
      scene: fixture.scene,
      selectionKey: 'node:a:b:c',
    });
    expect(rawCollision.selectionKey).toBeNull();
  });

  test('keeps accepted lone-surrogate IDs renderable and distinct', () => {
    const loneHigh = 'bad\uD800id';
    const replacement = 'bad\uFFFDid';
    const literalEscape = 'bad%uD800id';
    const keys = [loneHigh, replacement, literalEscape]
      .map(id => sceneOutlineKey('waypoint', id));
    expect(keys).toEqual([
      'waypoint:bad%uD800id',
      'waypoint:bad%EF%BF%BDid',
      'waypoint:bad%25uD800id',
    ]);
    expect(new Set(keys).size).toBe(3);

    const waypoint = new Waypoint({ id: loneHigh, imgX: 0.5, imgY: 0.5, isMajor: true });
    const layerId = 'layer\uD800';
    const emitterId = 'emitter\uDC00';
    const nodeId = 'node\uD800';
    const edgeId = 'edge\uDC00';
    const scene = new Scene();
    const layer = scene.addFlowLayer({ id: layerId, guideType: 'graph' });
    layer.addEmitter({ id: emitterId });
    const source = layer.graph.addNode({ id: nodeId });
    const target = layer.graph.addNode({ id: 'target' });
    layer.graph.addEdge({ id: edgeId, sourceId: source.id, targetId: target.id });
    const snapshot = buildSceneOutlineSnapshot({
      waypoints: [waypoint],
      scene,
      selectionKey: keys[0],
    });
    expect(snapshot.route[0].key).toBe(keys[0]);
    expect(snapshot.selectionKey).toBe(keys[0]);
    expect(snapshot.crowds[0].key).toBe(sceneOutlineKey('crowd', layerId));
    expect(snapshot.crowds[0].emitters[0].key)
      .toBe(sceneOutlineKey('emitter', layerId, emitterId));
    expect(snapshot.crowds[0].graph.nodes[0].key)
      .toBe(sceneOutlineKey('node', layerId, nodeId));
    expect(snapshot.crowds[0].graph.edges[0].key)
      .toBe(sceneOutlineKey('edge', layerId, edgeId));
  });

  test('bounds semantic-key fan-out at the maximum accepted entity ID length', () => {
    const maxLayerId = 'l'.repeat(ENTITY_ID_LIMITS.MAX_LENGTH);
    const scene = new Scene();
    const layer = scene.addFlowLayer({ id: maxLayerId, guideType: 'graph' });
    for (let index = 0; index < 2000; index += 1) {
      layer.graph.addNode({ id: `node-${index}`, x: index / 1999, y: 0.5 });
    }

    const snapshot = buildSceneOutlineSnapshot({ waypoints: [], scene });
    const keys = snapshot.crowds[0].graph.nodes.map(node => node.key);

    expect(new Set(keys).size).toBe(2000);
    expect(keys.at(-1)).toBe(sceneOutlineKey('node', maxLayerId, 'node-1999'));
    expect(keys.reduce((total, key) => total + key.length, 0)).toBeLessThan(600000);
  });

  test('drops stale selections without mutating canonical models', () => {
    const fixture = makeFixture();
    const before = JSON.stringify({
      waypoints: fixture.waypoints.map(waypoint => waypoint.toJSON()),
      scene: fixture.scene.toJSON(),
    });

    const snapshot = snapshotFor(fixture, { selectionKey: 'node:missing:missing' });

    expect(snapshot.selectionKey).toBeNull();
    expect(JSON.stringify({
      waypoints: fixture.waypoints.map(waypoint => waypoint.toJSON()),
      scene: fixture.scene.toJSON(),
    })).toBe(before);
  });

  test('gives accepted unnamed crowds distinct non-visual display names', () => {
    const scene = new Scene();
    scene.addFlowLayer({ id: 'blank-a', name: '', emitters: [{}] });
    scene.addFlowLayer({ id: 'blank-b', name: '\r\n', emitters: [{}] });

    const snapshot = buildSceneOutlineSnapshot({ waypoints: [], scene });

    expect(snapshot.crowds.map(crowd => crowd.name)).toEqual(['', '\r\n']);
    expect(snapshot.crowds.map(crowd => crowd.displayName)).toEqual(['Crowd 1', 'Crowd 2']);
  });
});

describe('native scene outline DOM', () => {
  let eventBus;
  let container;
  let controller;
  let fixture;

  beforeEach(() => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    eventBus = new EventBus();
    container = document.getElementById('scene-outline');
    controller = new SceneOutlineController(container, eventBus);
    fixture = makeFixture();
  });

  test('makes route insertion position explicit and defaults it from exact selection', () => {
    const addForm = () => container.querySelector(
      'form[data-outline-form-key="route:add-submit"]'
    );

    eventBus.emit('scene-outline:update', snapshotFor(fixture, {
      selectionKey: sceneOutlineKey('waypoint', fixture.major.id),
    }));
    expect(addForm().elements.afterWaypointId.value).toBe(fixture.major.id);
    // "major"/"minor" in lower case, mid-sentence (reason: UI-06 B-15, sentence case).
    expect([...addForm().elements.afterWaypointId.options].map(option => option.textContent))
      .toEqual([
        'Start of route',
        'After major waypoint 1 — <img src=x onerror=window.outlineInjected=true>',
        'After minor waypoint 1.1 — Curve point',
      ]);

    eventBus.emit('scene-outline:update', snapshotFor(fixture, {
      selectionKey: sceneOutlineKey('vertex', fixture.minor.id, 0),
    }));
    expect(addForm().elements.afterWaypointId.value).toBe(fixture.minor.id);

    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    expect(addForm().elements.afterWaypointId.value).toBe(fixture.minor.id);

    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
    addForm().elements.afterWaypointId.value = '';
    addForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      action: 'add-waypoint',
      afterWaypointId: '',
    }));
  });

  test('renders safe native disclosures lazily and mounts only opened branches', async () => {
    const selectionKey = 'control:crowd-route:edge-a:0';
    eventBus.emit('scene-outline:update', snapshotFor(fixture, { selectionKey }));

    expect(container.querySelectorAll('script, img')).toHaveLength(0);
    expect(container.textContent).toContain('<img src=x onerror=window.outlineInjected=true>');
    expect(container.textContent).toContain('</summary><script>window.outlineInjected=true</script>');
    expect(container.textContent).toContain('Minor waypoint 1.1 — Curve point');
    expect(container.textContent).toContain('Custom network — not in use');
    expect(container.textContent).toContain('Bend 1');
    expect(container.textContent).not.toContain('At route end');

    // Closed branches retain their native summaries but omit their expensive
    // forms and descendants until the user opens them.
    expect(disclosure(container, 'waypoint:wp-minor').querySelector('form')).toBeNull();
    expect(disclosure(container, 'emitters:crowd-route').querySelector('ol')).toBeNull();

    await openDisclosure(container, 'emitters:crowd-route');
    expect(container.textContent).toContain('Emitter 2');
    await openDisclosure(container, 'emitter:crowd-route:emitter-primary');
    expect(container.textContent).toContain('At journey end');

    const selected = container.querySelector('[aria-pressed="true"]');
    expect(selected.textContent).toBe('Select bend 1');

    const extraEmitter = await openDisclosure(container, 'emitter:crowd-route:emitter-extra');
    expect(extraEmitter.querySelector('form')).toBeNull();
    expect(extraEmitter.textContent).toContain('editing more than one emitter in a crowd is a later feature');

    await openDisclosure(container, 'waypoint:wp-minor');
    await openDisclosure(container, 'polygon:wp-minor');
    // "Corner", the panel's word (reason: UI-06 low items, one word per concept [Q4]).
    expect(container.textContent).toContain('Corner 3');
    const firstVertex = await openDisclosure(container, 'vertex:wp-minor:0');
    const disabledVertexDelete = firstVertex.querySelector('button[data-outline-action="delete-vertex"]');
    expect(disabledVertexDelete.disabled).toBe(true);
    expect(disabledVertexDelete.closest('.scene-outline-content').textContent)
      // "area" and "corners", the panel's words (reason: UI-06 low items, one word per concept [Q4]).
      .toContain('A drawn area needs at least three corners');
  });

  test('emits stable-ID commands and exposes semantic validation errors inline', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);

    const addForm = container.querySelector('form[data-outline-form-key="route:add-submit"]');
    addForm.elements.kind.value = 'minor';
    addForm.elements.x.value = '25';
    addForm.elements.y.value = '75';
    addForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      action: 'add-waypoint',
      outlineFormKey: 'route:add-submit',
      afterWaypointId: 'wp-minor',
      kind: 'minor',
      x: '25',
      y: '75',
    }));

    await openDisclosure(container, 'crowd:crowd-route');
    await openDisclosure(container, 'network:crowd-route');
    const formKey = 'network:crowd-route:connect';
    eventBus.emit('scene-outline:error', {
      formKey,
      message: 'Choose two different nodes.',
    });
    const connectForm = container.querySelector(`form[data-outline-form-key="${formKey}"]`);
    expect([...connectForm.elements.sourceId.options].map(option => option.textContent))
      .toEqual([
        'Node 1 — entry — <b>Entry</b> — 20%, 30%',
        'Node 2 — exit — Exit — 80%, 70%',
      ]);
    expect(connectForm.querySelector('[role="alert"]').textContent)
      .toBe('Choose two different nodes.');
    expect([...connectForm.elements].filter(element => element.matches('input, select'))
      .every(element => element.getAttribute('aria-invalid') === 'true')).toBe(true);
  });

  test('preserves disclosure and focused controls across synchronized rebuilds', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    const waypointDetails = await openDisclosure(container, 'waypoint:wp-major');
    const xInput = waypointDetails.querySelector('[data-outline-key="waypoint:wp-major:x"]');
    xInput.focus();

    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    await Promise.resolve();

    expect(container.querySelector(
      'details[data-outline-disclosure="waypoint:wp-major"]'
    ).open).toBe(true);
    expect(document.activeElement.dataset.outlineKey).toBe('waypoint:wp-major:x');
  });

  test('preserves unapplied drafts across disclosure and semantic rebuilds', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    let majorDetails = await openDisclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    let xInput = majorDetails.querySelector('[name="x"]');
    xInput.value = '37.25';
    xInput.focus();

    await openDisclosure(container, sceneOutlineKey('waypoint', fixture.minor.id));
    majorDetails = disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    expect(majorDetails.querySelector('[name="x"]').value).toBe('37.25');

    fixture.routeCrowd.visible = false;
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    await Promise.resolve();
    majorDetails = disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    xInput = majorDetails.querySelector('[name="x"]');
    expect(xInput.value).toBe('37.25');

    majorDetails.querySelector(':scope > summary').click();
    await Promise.resolve();
    expect(disclosure(container, sceneOutlineKey('waypoint', fixture.major.id)).open).toBe(false);
    expect(disclosure(container, sceneOutlineKey('waypoint', fixture.major.id)).querySelector('form'))
      .toBeNull();
    majorDetails = await openDisclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    expect(majorDetails.querySelector('[name="x"]').value).toBe('37.25');
  });

  test('acknowledges only accepted submissions and keeps later or rejected drafts', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    let majorDetails = await openDisclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    let formEl = majorDetails.querySelector('form[data-outline-action="update-waypoint"]');
    eventBus.on('scene-outline:command', command => {
      eventBus.emit('scene-outline:accepted', { formKey: command.outlineFormKey });
    });

    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    formEl.elements.x.value = '42.5';
    await openDisclosure(container, sceneOutlineKey('waypoint', fixture.minor.id));
    majorDetails = disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    expect(majorDetails.querySelector('[name="x"]').value).toBe('42.5');

    controller.destroy();
    controller = new SceneOutlineController(container, eventBus = new EventBus());
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    majorDetails = await openDisclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    formEl = majorDetails.querySelector('form[data-outline-action="update-waypoint"]');
    eventBus.on('scene-outline:command', command => {
      eventBus.emit('scene-outline:error', {
        formKey: command.outlineFormKey,
        message: 'The project changed before this edit could be applied.',
      });
    });
    formEl.elements.x.value = '43.75';
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.routeCrowd.visible = !fixture.routeCrowd.visible;
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    majorDetails = disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    expect(majorDetails.querySelector('[name="x"]').value).toBe('43.75');
    expect(majorDetails.querySelector('[role="alert"]').textContent)
      .toBe('The project changed before this edit could be applied.');
  });

  test('force-opens collapsed ancestry before restoring requested focus', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture, {
      selectionKey: 'waypoint:wp-major',
    }));
    const minorDetails = container.querySelector(
      'details[data-outline-disclosure="waypoint:wp-minor"]'
    );
    minorDetails.open = false;

    eventBus.emit('scene-outline:update', snapshotFor(fixture, {
      selectionKey: 'waypoint:wp-major',
      focusKey: 'waypoint:wp-minor:select',
    }));
    await Promise.resolve();

    expect(container.querySelector(
      'details[data-outline-disclosure="waypoint:wp-minor"]'
    ).open).toBe(true);
    expect(document.activeElement.dataset.outlineKey).toBe('waypoint:wp-minor:select');
  });

  test('accepts arbitrary decimal drafts and preserves exact canonical originals on submit', async () => {
    fixture.major.imgX = 0.12345678901234568;
    fixture.major.imgY = 0.8765432109876543;
    fixture.major.pauseTime = 1234.5678901234567;
    const largeEdgeWeight = Number.MAX_SAFE_INTEGER + 1;
    fixture.routeCrowd.graph.getEdge('edge-a').weight = largeEdgeWeight;
    const snapshot = snapshotFor(fixture);
    eventBus.emit('scene-outline:update', snapshot);

    await openDisclosure(container, 'waypoint:wp-major');
    await openDisclosure(container, 'waypoint:wp-minor');
    await openDisclosure(container, 'polygon:wp-minor');
    await openDisclosure(container, 'vertex:wp-minor:0');
    await openDisclosure(container, 'crowd:crowd-route');
    await openDisclosure(container, 'emitters:crowd-route');
    await openDisclosure(container, 'emitter:crowd-route:emitter-primary');
    await openDisclosure(container, 'network:crowd-route');
    await openDisclosure(container, 'nodes:crowd-route');
    await openDisclosure(container, 'node:crowd-route:node-entry');
    await openDisclosure(container, 'edges:crowd-route');
    await openDisclosure(container, 'edge:crowd-route:edge-a');
    await openDisclosure(container, 'controls:crowd-route:edge-a');
    await openDisclosure(container, 'control:crowd-route:edge-a:0');

    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
    const waypointForm = container.querySelector(
      'form[data-outline-form-key="waypoint:wp-major:apply"]'
    );
    waypointForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const command = listener.mock.lastCall[0];
    // The field shows the heading's two decimals; the canonical value is the
    // exact one (reason: UI-06 W-02, numbers at the heading's precision).
    expect(command.outlineOriginalValues).toEqual({
      x: {
        display: String(snapshot.route[0].xLabel),
        canonical: fixture.major.imgX,
      },
      y: {
        display: String(snapshot.route[0].yLabel),
        canonical: fixture.major.imgY,
      },
      waitSeconds: {
        display: String(snapshot.route[0].pauseSeconds),
        canonical: fixture.major.pauseTime,
      },
    });
    expect(Number(command.outlineOriginalValues.x.canonical)).toBe(fixture.major.imgX);
    expect(Number(command.outlineOriginalValues.y.canonical)).toBe(fixture.major.imgY);
    expect(Number(command.outlineOriginalValues.waitSeconds.canonical)).toBe(fixture.major.pauseTime);

    const edgeForm = container.querySelector(
      'form[data-outline-form-key="edge:crowd-route:edge-a:apply"]'
    );
    edgeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener.mock.lastCall[0]).toMatchObject({
      action: 'update-edge',
      weight: String(largeEdgeWeight),
      outlineOriginalValues: {
        weight: {
          display: String(largeEdgeWeight),
          canonical: largeEdgeWeight,
        },
      },
    });

    const decimalInputs = [...container.querySelectorAll('input[type="number"][step="any"]')];
    expect(decimalInputs.length).toBeGreaterThan(20);
    for (const input of decimalInputs) {
      input.value = '0.123456789012345';
      expect(input.validity.stepMismatch, input.dataset.outlineKey).toBe(false);
    }
  });

  test('submits edits to points off the image, as far as a project can store one (DEF-35)', async () => {
    // Since DEF-03 a waypoint or a polygon vertex may sit off the image, but
    // every position field here stopped at 0–100%, so the browser refused to
    // submit any edit to such a point, even to its wait alone.
    fixture.major.imgX = -0.4;
    fixture.major.imgY = 1.35;
    fixture.minor.imgX = 1.25;
    fixture.minor.areaHighlight.points[0] = { x: 1.4, y: -0.3 };
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    for (const key of ['waypoint:wp-major', 'waypoint:wp-minor', 'polygon:wp-minor', 'vertex:wp-minor:0',
      'crowd:crowd-route', 'network:crowd-route', 'nodes:crowd-route', 'node:crowd-route:node-entry',
      'edges:crowd-route', 'edge:crowd-route:edge-a', 'controls:crowd-route:edge-a',
      'control:crowd-route:edge-a:0']) {
      await openDisclosure(container, key);
    }
    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
    const formFor = key => container.querySelector(`form[data-outline-form-key="${key}"]`);

    const waypointForm = formFor('waypoint:wp-major:apply');
    waypointForm.elements.waitSeconds.value = '4';
    waypointForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.lastCall[0]).toMatchObject({
      action: 'update-waypoint', waypointId: 'wp-major', waitSeconds: '4',
    });

    // The minor waypoint and the vertex off the image, and the new vertex
    // form, which starts on its waypoint.
    for (const key of ['waypoint:wp-minor:apply', 'vertex:wp-minor:0:apply', 'polygon:wp-minor:add']) {
      expect(formFor(key).reportValidity(), key).toBe(true);
    }

    // Every such position field takes the whole range a project can store,
    // and no more.
    const { MIN, MAX } = IMAGE_COORDINATES;
    const typed = [[MIN * 100, true], [MAX * 100, true], [MIN * 100 - 1, false], [MAX * 100 + 1, false]];
    const inputFor = key => container.querySelector(`input[data-outline-key="${key}"]`);
    for (const key of ['route:add-x', 'route:add-y', 'waypoint:wp-major:x', 'waypoint:wp-major:y',
      'vertex:wp-minor:0:x', 'vertex:wp-minor:0:y', 'polygon:wp-minor:add-x', 'polygon:wp-minor:add-y']) {
      const input = inputFor(key);
      for (const [value, valid] of typed) {
        input.value = String(value);
        expect(input.validity.valid, `${key} at ${value}`).toBe(valid);
      }
    }

    // Network geometry is authored on the image, and stays there.
    for (const key of ['network:crowd-route:add-node', 'node:crowd-route:node-entry',
      'edge:crowd-route:edge-a:add-control', 'control:crowd-route:edge-a:0']) {
      for (const field of key.includes(':add-') ? [`${key}-x`, `${key}-y`] : [`${key}:x`, `${key}:y`]) {
        expect([inputFor(field).min, inputFor(field).max], field).toEqual(['0', '100']);
      }
    }
  });

  test('preserves unchanged long and whitespace text in command originals', async () => {
    const crowdName = `  Crowd\r\n${'Crowd '.repeat(40)}\n  `;
    const nodeLabel = `  Node\n${'Node '.repeat(45)}\r\n  `;
    fixture.routeCrowd.name = crowdName;
    fixture.routeCrowd.graph.getNode('node-entry').label = nodeLabel;
    eventBus.emit('scene-outline:update', snapshotFor(fixture));

    await openDisclosure(container, sceneOutlineKey('crowd', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('network', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('nodes', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('node', fixture.routeCrowd.id, 'node-entry'));

    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
    const crowdForm = container.querySelector(
      `form[data-outline-form-key="${sceneOutlineKey('crowd', fixture.routeCrowd.id)}:apply"]`
    );
    expect(crowdForm.elements.name.maxLength).toBe(200);
    const crowdDisplay = crowdForm.elements.name.value;
    expect(crowdDisplay).not.toBe(crowdName);
    expect(crowdForm.elements.name.value.length).toBeGreaterThan(200);
    crowdForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener.mock.lastCall[0].outlineOriginalValues.name).toEqual({
      display: crowdDisplay,
      canonical: crowdName,
    });

    const nodeForm = container.querySelector(
      `form[data-outline-form-key="${sceneOutlineKey('node', fixture.routeCrowd.id, 'node-entry')}:apply"]`
    );
    expect(nodeForm.elements.label.maxLength).toBe(200);
    const nodeDisplay = nodeForm.elements.label.value;
    expect(nodeDisplay).not.toBe(nodeLabel);
    expect(nodeForm.elements.label.value.length).toBeGreaterThan(200);
    nodeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener.mock.lastCall[0].outlineOriginalValues.label).toEqual({
      display: nodeDisplay,
      canonical: nodeLabel,
    });
  });

  test('submits legacy empty crowd names and keeps non-string node labels typed', async () => {
    const legacyLabel = { source: 'import', parts: ['North', 2] };
    fixture.routeCrowd.name = '\r\n';
    fixture.routeCrowd.graph.getNode('node-entry').label = legacyLabel;
    eventBus.emit('scene-outline:update', snapshotFor(fixture));

    await openDisclosure(container, sceneOutlineKey('crowd', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('network', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('nodes', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('node', fixture.routeCrowd.id, 'node-entry'));
    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);

    const crowdForm = container.querySelector('form[data-outline-action="update-crowd"]');
    expect(crowdForm.elements.name.value).toBe('');
    expect(crowdForm.elements.name.required).toBe(false);
    expect(crowdForm.reportValidity()).toBe(true);
    crowdForm.elements.visible.value = 'hidden';
    crowdForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener.mock.lastCall[0]).toMatchObject({
      action: 'update-crowd',
      name: '',
      visible: 'hidden',
      outlineOriginalValues: {
        name: { display: '', canonical: '\r\n' },
      },
    });

    const nodeForm = container.querySelector('form[data-outline-action="update-node"]');
    expect(nodeForm.elements.label.value).toBe('[object Object]');
    nodeForm.elements.type.value = 'exit';
    nodeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(listener.mock.lastCall[0].outlineOriginalValues.label).toEqual({
      display: '[object Object]',
      canonical: legacyLabel,
    });
  });

  test('labels multiple unnamed crowd disclosures and selectors distinctly', async () => {
    const unnamed = new Scene();
    unnamed.addFlowLayer({ id: 'blank-a', name: '', emitters: [{}] });
    unnamed.addFlowLayer({ id: 'blank-b', name: '\n', emitters: [{}] });
    eventBus.emit('scene-outline:update', buildSceneOutlineSnapshot({
      waypoints: [],
      scene: unnamed,
    }));

    await openDisclosure(container, sceneOutlineKey('crowd', 'blank-a'));
    await openDisclosure(container, sceneOutlineKey('crowd', 'blank-b'));
    const summaries = [...container.querySelectorAll('.scene-outline-crowd > summary')]
      .map(summary => summary.textContent);
    const selectors = [...container.querySelectorAll('button[data-outline-action="select"]')]
      .map(select => select.textContent);

    expect(summaries).toEqual([
      'Crowd 1 — Custom network, 1 emitter',
      'Crowd 2 — Custom network, 1 emitter',
    ]);
    expect(selectors).toEqual(['Select Crowd 1', 'Select Crowd 2']);
  });

  test('clears route and same-ID entity drafts only at successful project boundaries', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    let major = await openDisclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    container.querySelector('form[data-outline-form-key="route:add-submit"]').elements.x.value = '91';
    major.querySelector('[name="x"]').value = '92';

    eventBus.emit('project:replaced');
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    major = disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    expect(container.querySelector('form[data-outline-form-key="route:add-submit"]').elements.x.value)
      .toBe('50');
    expect(major.querySelector('[name="x"]').value).toBe('12.5');

    container.querySelector('form[data-outline-form-key="route:add-submit"]').elements.x.value = '81';
    major.querySelector('[name="x"]').value = '82';
    eventBus.emit('app:cleared');
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    major = disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
    expect(container.querySelector('form[data-outline-form-key="route:add-submit"]').elements.x.value)
      .toBe('50');
    expect(major.querySelector('[name="x"]').value).toBe('12.5');

    major.querySelector('[name="x"]').value = '72';
    eventBus.emit('project:load-failed');
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    expect(disclosure(container, sceneOutlineKey('waypoint', fixture.major.id))
      .querySelector('[name="x"]').value).toBe('72');
  });

  test('drops indexed drafts when point topology changes underneath them', async () => {
    fixture.minor.areaHighlight.points.push({ x: 0.7, y: 0.8 });
    const edge = fixture.routeCrowd.graph.getEdge('edge-a');
    edge.addControlPoint(0.6, 0.4);
    edge.addControlPoint(0.8, 0.2);
    eventBus.emit('scene-outline:update', snapshotFor(fixture));

    await openDisclosure(container, sceneOutlineKey('waypoint', fixture.minor.id));
    await openDisclosure(container, sceneOutlineKey('polygon', fixture.minor.id));
    let vertex = await openDisclosure(container, sceneOutlineKey('vertex', fixture.minor.id, 1));
    vertex.querySelector('[name="x"]').value = '77';
    fixture.minor.areaHighlight.points.splice(0, 1);
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    vertex = disclosure(container, sceneOutlineKey('vertex', fixture.minor.id, 1));
    expect(vertex.querySelector('[name="x"]').value).toBe('50');

    await openDisclosure(container, sceneOutlineKey('crowd', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('network', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('edges', fixture.routeCrowd.id));
    await openDisclosure(container, sceneOutlineKey('edge', fixture.routeCrowd.id, edge.id));
    await openDisclosure(container, sceneOutlineKey('controls', fixture.routeCrowd.id, edge.id));
    let control = await openDisclosure(
      container,
      sceneOutlineKey('control', fixture.routeCrowd.id, edge.id, 1)
    );
    control.querySelector('[name="x"]').value = '88';
    edge.controlPoints.splice(0, 1);
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    control = disclosure(container, sceneOutlineKey('control', fixture.routeCrowd.id, edge.id, 1));
    expect(control.querySelector('[name="x"]').value).toBe('80');
  });

  test('opens, selects, and focuses only the exact adversarial entity key', async () => {
    const adversarial = makeAdversarialFixture();
    const substringWaypointKey = sceneOutlineKey(
      'waypoint', adversarial.substringWaypoint.id
    );
    eventBus.emit('scene-outline:update', buildSceneOutlineSnapshot({
      waypoints: adversarial.waypoints,
      scene: adversarial.scene,
      selectionKey: substringWaypointKey,
      focusKey: `${substringWaypointKey}:select`,
    }));
    await Promise.resolve();

    expect(disclosure(container, sceneOutlineKey('waypoint', adversarial.targetWaypoint.id)).open)
      .toBe(false);
    expect(disclosure(container, substringWaypointKey).open).toBe(true);
    expect(container.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(document.activeElement.dataset.outlineKey).toBe(`${substringWaypointKey}:select`);

    const colonCrowdKey = sceneOutlineKey('crowd', adversarial.colonCrowd.id);
    const splitCrowdKey = sceneOutlineKey('crowd', adversarial.splitCrowd.id);
    const colonNodeKey = sceneOutlineKey('node', adversarial.colonCrowd.id, 'c');
    const splitNodeKey = sceneOutlineKey('node', adversarial.splitCrowd.id, 'b:c');
    eventBus.emit('scene-outline:update', buildSceneOutlineSnapshot({
      waypoints: adversarial.waypoints,
      scene: adversarial.scene,
      selectionKey: splitNodeKey,
      focusKey: `${splitNodeKey}:select`,
    }));
    await Promise.resolve();

    expect(colonNodeKey).not.toBe(splitNodeKey);
    expect(disclosure(container, colonCrowdKey).open).toBe(false);
    expect(disclosure(container, splitCrowdKey).open).toBe(true);
    expect(disclosure(container, colonNodeKey)).toBeNull();
    expect(disclosure(container, splitNodeKey).open).toBe(true);
    const selected = [...container.querySelectorAll('[aria-pressed="true"]')];
    expect(selected).toHaveLength(1);
    expect(selected[0].dataset).toMatchObject({ layerId: 'a', nodeId: 'b:c' });
    expect(document.activeElement.dataset.outlineKey).toBe(`${splitNodeKey}:select`);
  });

  test('keeps a rejected draft in one inline alert and Escape clears and resets the form', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    await openDisclosure(container, 'crowd:crowd-route');
    await openDisclosure(container, 'network:crowd-route');

    const formKey = 'network:crowd-route:connect';
    const connectForm = container.querySelector(`form[data-outline-form-key="${formKey}"]`);
    connectForm.elements.sourceId.value = 'node-exit';
    connectForm.elements.targetId.value = 'node-exit';
    connectForm.elements.direction.value = 'one-way';
    connectForm.elements.weight.value = '3.141592653589793';

    const error = { formKey, message: 'Choose two different nodes.' };
    eventBus.emit('scene-outline:error', error);
    eventBus.emit('scene-outline:error', error);

    expect(connectForm.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(connectForm.querySelector('[role="alert"]').textContent).toBe(error.message);
    expect(connectForm.elements.sourceId.value).toBe('node-exit');
    expect(connectForm.elements.targetId.value).toBe('node-exit');
    expect(connectForm.elements.direction.value).toBe('one-way');
    expect(connectForm.elements.weight.value).toBe('3.141592653589793');
    expect([...connectForm.elements].filter(element => element.matches('input, select'))
      .every(element => element.getAttribute('aria-invalid') === 'true')).toBe(true);

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    });
    connectForm.elements.weight.dispatchEvent(escape);

    expect(escape.defaultPrevented).toBe(true);
    expect(connectForm.querySelector('[role="alert"]')).toBeNull();
    expect(connectForm.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(connectForm.elements.sourceId.value).toBe('node-entry');
    expect(connectForm.elements.targetId.value).toBe('node-exit');
    expect(connectForm.elements.direction.value).toBe('two-way');
    expect(connectForm.elements.weight.value).toBe('1');
    expect(document.activeElement).toBe(connectForm.querySelector('[type="submit"]'));
  });

  test('the duplicate-edge error carries its accent bar and red field borders (DEF-94)', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    await openDisclosure(container, 'crowd:crowd-route');
    await openDisclosure(container, 'network:crowd-route');

    // Connecting two nodes already joined: the message the app emits for it
    // (src/app/sceneOutline.js, pinned by sceneOutlineApp.test.js).
    const formKey = 'network:crowd-route:connect';
    eventBus.emit('scene-outline:error', { formKey, message: 'Those nodes are already connected.' });

    const connectForm = container.querySelector(`form[data-outline-form-key="${formKey}"]`);
    const alert = connectForm.querySelector('[role="alert"]');
    expect(alert.classList.contains('scene-outline-error')).toBe(true);
    expect([...connectForm.elements].filter(element => element.matches('input, select'))
      .every(element => element.getAttribute('aria-invalid') === 'true')).toBe(true);

    // jsdom applies no stylesheet here and leaves var() unresolved, so the
    // colours are computed on the rendered elements by the test helper's
    // cascade over the real sheets: `--support-01` was undefined, and both
    // marks computed to nothing.
    const map = tokensFor();
    const error = hex(colourIn(map.get('--support-error'), map));
    expect(hex(borderColourOf(alert, 'left'))).toBe(error);
    for (const field of connectForm.querySelectorAll('[aria-invalid="true"]')) {
      expect(hex(borderColourOf(field)), field.name).toBe(error);
    }

    // The Delete action on a node body is `.btn.btn-secondary` too; its
    // danger border must outrank the button border rules that follow it.
    await openDisclosure(container, 'nodes:crowd-route');
    await openDisclosure(container, 'node:crowd-route:node-entry');
    const remove = container.querySelector('.scene-outline-danger');
    expect(remove.classList.contains('btn')).toBe(true);
    expect(hex(borderColourOf(remove))).toBe(error);
    expect(cascade(remove, ['border', 'border-color']).selector).toBe('.btn.scene-outline-danger');
  });

  test('keeps a closed 2,000-node outline bounded and mounts only the focused node body', async () => {
    const largeScene = new Scene();
    const layer = largeScene.addFlowLayer({
      id: 'crowd-large', name: 'Large network', guideType: 'graph',
    });
    for (let index = 0; index < 2000; index += 1) {
      layer.graph.addNode({
        id: `node-${index}`,
        x: index / 1999,
        y: 0.5,
        type: 'normal',
      });
    }
    const baseSnapshot = buildSceneOutlineSnapshot({ waypoints: [], scene: largeScene });
    eventBus.emit('scene-outline:update', baseSnapshot);

    expect(container.querySelectorAll('*').length).toBeLessThan(50);
    expect(container.querySelectorAll('.scene-outline-node')).toHaveLength(0);
    expect(disclosure(container, 'crowd:crowd-large').open).toBe(false);

    eventBus.emit('scene-outline:update', {
      ...baseSnapshot,
      focusKey: 'node:crowd-large:node-1999:select',
    });
    await Promise.resolve();

    const requested = disclosure(container, 'node:crowd-large:node-1999');
    expect(requested).not.toBeNull();
    expect(requested.open).toBe(true);
    expect(container.querySelectorAll('.scene-outline-node')).toHaveLength(2000);
    expect(container.querySelectorAll('form[data-outline-action="update-node"]')).toHaveLength(1);
    expect(document.activeElement.dataset.outlineKey).toBe('node:crowd-large:node-1999:select');
  });

  // CROWD-07 F1: the card's Size reads reference px; the outline edits the
  // model's own unit, so it keeps "Dot size (×)" and its hint gives the
  // reference px the value draws, as the card's readout says it.
  test('Dot size stays in ×, and its hint gives the reference px it draws (CROWD-07 F1)', async () => {
    const sizeField = async () => {
      await openDisclosure(container, 'crowd:crowd-route');
      await openDisclosure(container, 'emitters:crowd-route');
      const emitter = await openDisclosure(container, 'emitter:crowd-route:emitter-primary');
      const input = emitter.querySelector('input[name="dotSize"]');
      const label = input.closest('label').querySelector('[data-tip]');
      return { input, label: label.textContent, hint: label.getAttribute('data-tip') };
    };
    const emitter = fixture.routeCrowd.emitters[0];
    expect(emitter.dotSize).toBe(0.4);
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    let field = await sizeField();
    expect(field.label).toBe('Dot size (×)');
    expect(field.input.value).toBe('0.4');
    expect(field.hint).toBe('Dot diameter as a multiple of 20 reference px: 0.4 draws a dot 8 reference px across; '
      + 'exports scale it from the project’s reference short edge');

    emitter.update({ dotSize: 1.5 });
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    field = await sizeField();
    expect(field.input.value).toBe('1.5');
    expect(field.hint).toMatch(/^Dot diameter as a multiple of 20 reference px: 1\.5 draws a dot 30 reference px across;/);
  });
});

/**
 * CROWD-07 F15 — the outline's Release bias says which way and how much, as
 * the card's readout does ("Earlier 40%"), not as the signed internal number
 * it was (−100…100; UI-STANDARDS: directional readouts instead of internal
 * signed parameters). A direction (Earlier, Even, Later) and an amount, 0–100%,
 * each untouched submitting the value it was drawn from. With Even chosen the
 * amount is 0 and off, its reason said [Q9, the lead's words].
 */
describe('the outline\'s Release bias is a direction and an amount (CROWD-07 F15)', () => {
  let eventBus;
  let container;
  let fixture;

  beforeEach(() => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    eventBus = new EventBus();
    container = document.getElementById('scene-outline');
    new SceneOutlineController(container, eventBus); // eslint-disable-line no-new
    fixture = makeFixture();
  });

  /** The primary emitter's form, drawn from `ramp`, with its two fields and the amount's reason. */
  async function biasForm(ramp) {
    fixture.routeCrowd.emitters[0].update({ intensityRamp: ramp });
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    await openDisclosure(container, 'crowd:crowd-route');
    await openDisclosure(container, 'emitters:crowd-route');
    const emitter = await openDisclosure(container, 'emitter:crowd-route:emitter-primary');
    const form = emitter.querySelector('form[data-outline-action="update-emitter"]');
    const direction = form.elements.intensityRampDirection;
    const amount = form.elements.intensityRampAmount;
    const reasonOf = () => (amount.getAttribute('aria-describedby') || '').split(/\s+/)
      .map(id => document.getElementById(id)).find(node => node?.classList.contains('scene-outline-reason')) ?? null;
    return { form, direction, amount, reasonOf };
  }

  const submitted = (form) => {
    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return listener.mock.lastCall[0];
  };

  test('no signed field: a direction select and a 0–100% amount, drawn from the stored bias', async () => {
    const { form, direction, amount } = await biasForm(-0.375);
    expect(form.elements.intensityRamp).toBeUndefined();
    expect(direction.tagName).toBe('SELECT');
    expect([...direction.options].map(option => [option.value, option.textContent]))
      .toEqual([['earlier', 'Earlier'], ['even', 'Even'], ['later', 'Later']]);
    expect(direction.value).toBe('earlier');
    expect(direction.closest('label').querySelector('span').textContent).toBe('Release bias');
    expect(amount.closest('label').querySelector('span').textContent).toBe('Release bias amount (%)');
    expect([amount.min, amount.max, amount.step, amount.value, amount.disabled]).toEqual(['0', '100', 'any', '37.5', false]);

    const later = await biasForm(0.4);
    expect([later.direction.value, later.amount.value]).toEqual(['later', '40']);
  });

  test('untouched, both submit the value they were drawn from: a stored −0.375 survives', async () => {
    const { form } = await biasForm(-0.375);
    const command = submitted(form);
    expect(command.intensityRampDirection).toBe('earlier');
    expect(command.intensityRampAmount).toBe('37.5');
    expect(command.outlineOriginalValues.intensityRampAmount).toEqual({ display: '37.5', canonical: 0.375 });
    expect('intensityRamp' in command).toBe(false);
  });

  test('Even turns the amount off at 0 and says why; another direction turns it back on [Q9]', async () => {
    const { form, direction, amount, reasonOf } = await biasForm(0);
    expect(direction.value).toBe('even');
    expect([amount.value, amount.disabled]).toEqual(['0', true]);
    expect(reasonOf()?.textContent).toBe('Shares are already even.');
    expect(reasonOf().hidden).toBe(false);
    expect(reasonOf().closest('label')).toBeNull(); // a description, outside the field's label

    direction.value = 'later';
    direction.dispatchEvent(new Event('change', { bubbles: true }));
    expect([amount.value, amount.disabled]).toEqual(['0', false]);
    expect(reasonOf()).toBeNull();
    amount.value = '60';
    amount.dispatchEvent(new Event('input', { bubbles: true }));

    direction.value = 'even';
    direction.dispatchEvent(new Event('change', { bubbles: true }));
    expect([amount.value, amount.disabled]).toEqual(['0', true]);
    expect(reasonOf()?.textContent).toBe('Shares are already even.');
    const command = submitted(form);
    expect(command.intensityRampDirection).toBe('even');
    expect('intensityRampAmount' in command).toBe(false); // off, so not sent: Even is 0

    // Escape puts the drawn values back, and the amount's state with them.
    const stored = await biasForm(-0.2);
    stored.direction.value = 'even';
    stored.direction.dispatchEvent(new Event('change', { bubbles: true }));
    expect(stored.amount.disabled).toBe(true);
    stored.amount.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    stored.direction.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect([stored.direction.value, stored.amount.value, stored.amount.disabled]).toEqual(['earlier', '20', false]);
    expect(stored.reasonOf()).toBeNull();
  });

  test('a second emitter\'s read-only summary says the direction and the amount too', async () => {
    fixture.routeCrowd.emitters[1].update({ intensityRamp: -0.375 });
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    await openDisclosure(container, 'crowd:crowd-route');
    await openDisclosure(container, 'emitters:crowd-route');
    await openDisclosure(container, 'emitter:crowd-route:emitter-extra');
    // Each redraw replaces the entry: it is read afresh.
    const read = term => [...disclosure(container, 'emitter:crowd-route:emitter-extra').querySelectorAll('dt')]
      .find(dt => dt.textContent === term)?.nextElementSibling?.textContent;
    expect(read('Release bias')).toBe('Earlier 37.5%');
    for (const [ramp, text] of [[0, 'Even'], [0.4, 'Later 40%'], [-1, 'Earlier 100%']]) {
      fixture.routeCrowd.emitters[1].update({ intensityRamp: ramp });
      eventBus.emit('scene-outline:update', snapshotFor(fixture));
      expect(read('Release bias'), String(ramp)).toBe(text);
    }
  });
});

describe('the outline calls a drawn area an area, and its corners corners (UI-06 low items, one word per concept)', () => {
  // The Area card says "Draw", "Draw area" and "Delete area"; the outline
  // said "polygon" and "vertices" for the same things [Q4, the owner's words].
  const OLD_WORDS = /polygon|vertices|vertex/i;

  /** Every word the outline shows for `root`: text, names, hints. */
  function wordsIn(root) {
    const found = [root.textContent];
    for (const element of root.querySelectorAll('*')) {
      for (const name of ['data-tip', 'aria-label', 'title', 'placeholder']) {
        if (element.hasAttribute(name)) found.push(element.getAttribute(name));
      }
    }
    return found.join(' ');
  }

  test('a drawn area\'s entry, every corner open, and the button that adds one', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const eventBus = new EventBus();
    const container = document.getElementById('scene-outline');
    new SceneOutlineController(container, eventBus);
    const fixture = makeFixture();
    fixture.major.name = 'Gate';
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    const major = await openDisclosure(container, 'waypoint:wp-major');
    expect([...major.querySelectorAll('button')].map(each => each.textContent)).toContain('Add triangle area');

    await openDisclosure(container, 'waypoint:wp-minor');
    await openDisclosure(container, 'polygon:wp-minor');
    for (const index of [0, 1, 2]) await openDisclosure(container, `vertex:wp-minor:${index}`);
    const minor = disclosure(container, 'waypoint:wp-minor');
    const area = disclosure(container, 'polygon:wp-minor');
    expect(area.querySelector(':scope > summary').textContent).toBe('Drawn area — 3 corners');
    expect(area.querySelectorAll('details[data-outline-disclosure^="vertex:"][open]')).toHaveLength(3);
    const buttons = [...area.querySelectorAll('button')].map(each => each.textContent);
    expect(buttons).toEqual(expect.arrayContaining([
      'Select area', 'Delete area', 'Apply area timing', 'Select corner 1', 'Apply corner', 'Delete corner', 'Add corner',
    ]));
    expect(area.querySelector(`details[data-outline-disclosure="vertex:wp-minor:0"] > summary`).textContent)
      .toBe('Corner 1 — 10%, 20%');
    expect(area.textContent).toContain('A drawn area needs at least three corners. Delete the area instead.');
    const labels = [...area.querySelectorAll('label')].map(label => label.textContent.trim());
    expect(labels).toEqual(expect.arrayContaining(['New corner horizontal position (%)', 'New corner vertical position (%)']));
    expect(wordsIn(disclosure(container, 'waypoint:wp-major'))).not.toMatch(OLD_WORDS);
    expect(wordsIn(minor)).not.toMatch(OLD_WORDS);
  });

  test('the outline\'s own help line says so too', () => {
    const page = new DOMParser().parseFromString(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'), 'text/html');
    const help = page.getElementById('scene-outline-help').textContent.replace(/\s+/g, ' ').trim();
    expect(help).toBe('Inspect and edit the route, every crowd and its emitters, custom networks, path bends and area corners '
      + 'without using the canvas.');
  });
});

describe('waypoint names in running text are in sentence case (UI-06 B-15)', () => {
  // "Select Major waypoint 2" capitalised a word mid-sentence. In running
  // text ("Select …", "After …") the kind is lower case; an authored name,
  // a branch waypoint's "Waypoint 1-B1 (branch B)" and the entry's own
  // heading, which starts it, keep theirs.
  test('Select and After say "major waypoint" and "minor waypoint"; the heading keeps its capital', async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    const eventBus = new EventBus();
    const container = document.getElementById('scene-outline');
    new SceneOutlineController(container, eventBus);
    const first = new Waypoint({ id: 'one', imgX: 0.1, imgY: 0.5, isMajor: true });
    const trent = new Waypoint({ id: 'two', imgX: 0.4, imgY: 0.5, isMajor: true, name: 'Trent Building' });
    const curve = new Waypoint({ id: 'three', imgX: 0.6, imgY: 0.5, isMajor: false });
    const last = new Waypoint({ id: 'four', imgX: 0.9, imgY: 0.5, isMajor: true, name: 'Major Oak' });
    const waypoints = [first, trent, curve, last];
    const snapshot = buildSceneOutlineSnapshot({ waypoints, scene: new Scene() });
    expect(snapshot.route.map(waypoint => waypoint.name)).toEqual([
      'Major waypoint 1', 'Major waypoint 2 — Trent Building', 'Minor waypoint 2.1', 'Major waypoint 3 — Major Oak',
    ]);
    eventBus.emit('scene-outline:update', snapshot);
    const insert = container.querySelector('form[data-outline-form-key="route:add-submit"]').elements.afterWaypointId;
    expect([...insert.options].map(option => option.textContent)).toEqual([
      'Start of route', 'After major waypoint 1', 'After major waypoint 2 — Trent Building', 'After minor waypoint 2.1',
      'After major waypoint 3 — Major Oak',
    ]);
    const selects = [];
    for (const waypoint of snapshot.route) {
      const entry = await openDisclosure(container, waypoint.key);
      expect(entry.querySelector(':scope > summary').textContent).toMatch(new RegExp(`^${waypoint.name} — `));
      selects.push(entry.querySelector('.scene-outline-actions button').textContent);
    }
    expect(selects).toEqual([
      'Select major waypoint 1', 'Select major waypoint 2 — Trent Building', 'Select minor waypoint 2.1',
      'Select major waypoint 3 — Major Oak',
    ]);
  });

  test('a branch waypoint\'s name is a name: running text leaves it as it is', () => {
    const fork = new Waypoint({ id: 'fork', imgX: 0.2, imgY: 0.5, isMajor: true });
    const end = new Waypoint({ id: 'end', imgX: 0.8, imgY: 0.5, isMajor: true });
    const branch = new Waypoint({ id: 'branch', imgX: 0.5, imgY: 0.2, isMajor: true, branchId: 'b', branchFrom: 'fork' });
    const snapshot = buildSceneOutlineSnapshot({ waypoints: [fork, end, branch], scene: new Scene() });
    const named = snapshot.route.find(waypoint => waypoint.id === 'branch');
    expect(named.name).toMatch(/^Waypoint \S+ \(branch [A-Z]\)$/);
    expect(named.runningName).toBe(named.name);
  });
});

describe('an outline entry opens and closes as a browser clicks it (DEF-40)', () => {
  let eventBus;
  let container;
  let fixture;

  beforeEach(() => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    eventBus = new EventBus();
    container = document.getElementById('scene-outline');
    new SceneOutlineController(container, eventBus);
    fixture = makeFixture();
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
  });

  const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

  /**
   * A click as a browser delivers it: the listeners, then every microtask they
   * queued, and only then the summary's own action, which toggles its entry
   * unless a listener cancelled the click. jsdom's `click()` toggles before
   * the microtasks, which is why the defect never showed in tests. Enter and
   * Space on a summary arrive as the same click.
   */
  async function browserClick(summary, { focus = true } = {}) {
    if (focus) summary.focus();
    const click = new Event('click', { bubbles: true, cancelable: true });
    summary.dispatchEvent(click);
    await nextTask();
    if (!click.defaultPrevented) summary.parentElement.open = !summary.parentElement.open;
    await nextTask();
    // The outline toggles the entry itself; the browser's toggle would land
    // on the entry the redraw replaced.
    expect(click.defaultPrevented).toBe(true);
  }

  const entry = () => disclosure(container, sceneOutlineKey('waypoint', fixture.major.id));
  const summaryOf = details => details.querySelector(':scope > summary');
  const form = details => details.querySelector('form[data-outline-action="update-waypoint"]');

  test('one click opens an entry with its content, the next closes it, and another opens it again', async () => {
    expect(entry().open).toBe(false);

    await browserClick(summaryOf(entry()));
    expect(entry().open).toBe(true);
    expect(form(entry())).not.toBeNull();

    await browserClick(summaryOf(entry()));
    expect(entry().open).toBe(false);
    expect(form(entry())).toBeNull();

    await browserClick(summaryOf(entry()));
    expect(entry().open).toBe(true);
    expect(form(entry())).not.toBeNull();
  });

  test('the clicked entry keeps focus on its summary', async () => {
    await browserClick(summaryOf(entry()));

    expect(document.activeElement).toBe(summaryOf(entry()));
  });

  test('an entry has its content as soon as it is opened, for a script that acts on it next', () => {
    summaryOf(entry()).click();

    expect(entry().open).toBe(true);
    expect(form(entry())).not.toBeNull();
  });

  const select = selectionKey => eventBus.emit('scene-outline:update', snapshotFor(fixture, { selectionKey }));
  const control = 'control:crowd-route:edge-a:0';

  // [the entry closed, the selection it holds]: each selected entity, then
  // each entry around a selected bend point.
  test.each([
    ['waypoint:wp-major', 'waypoint:wp-major'],
    ['polygon:wp-minor', 'polygon:wp-minor'],
    ['vertex:wp-minor:0', 'vertex:wp-minor:0'],
    ['crowd:crowd-route', 'crowd:crowd-route'],
    ['emitter:crowd-route:emitter-primary', 'emitter:crowd-route:emitter-primary'],
    ['node:crowd-route:node-entry', 'node:crowd-route:node-entry'],
    ['edge:crowd-route:edge-a', 'edge:crowd-route:edge-a'],
    [control, control],
    ['route', 'waypoint:wp-minor'],
    ['crowds', control],
    ['crowd:crowd-route', control],
    ['network:crowd-route', control],
    ['edges:crowd-route', control],
    ['edge:crowd-route:edge-a', control],
    ['controls:crowd-route:edge-a', control],
  ])('%s closes, and opens again, though it holds the selection (%s)', async (key, selectionKey) => {
    select(selectionKey);
    expect(disclosure(container, key).open).toBe(true);

    await browserClick(summaryOf(disclosure(container, key)));
    expect(disclosure(container, key).open).toBe(false);
    expect(disclosure(container, key).querySelector('.scene-outline-content')).toBeNull();
    expect(document.activeElement).toBe(summaryOf(disclosure(container, key)));

    await browserClick(summaryOf(disclosure(container, key)));
    expect(disclosure(container, key).open).toBe(true);
    expect(disclosure(container, key).querySelector('.scene-outline-content')).not.toBeNull();
  });

  test('an entry the author closed stays closed while its selection stands, and a new selection opens it again', async () => {
    select('waypoint:wp-major');
    await browserClick(summaryOf(disclosure(container, 'route')));
    expect(disclosure(container, 'route').open).toBe(false);

    // The app sends the outline again, the selection unchanged: after an
    // edit, say, or a second click on the same waypoint on the canvas.
    select('waypoint:wp-major');
    expect(disclosure(container, 'route').open).toBe(false);

    select('waypoint:wp-minor');
    expect(disclosure(container, 'route').open).toBe(true);
    expect(disclosure(container, 'waypoint:wp-minor').open).toBe(true);

    // Nothing selected, then the first waypoint again: that is new too.
    await browserClick(summaryOf(disclosure(container, 'route')));
    select(null);
    select('waypoint:wp-minor');
    expect(disclosure(container, 'route').open).toBe(true);
  });

  test('a new selection opens its entries, whatever was selected before', async () => {
    select(control);
    await browserClick(summaryOf(disclosure(container, 'crowds')));
    expect(disclosure(container, 'crowds').open).toBe(false);

    select('waypoint:wp-major');
    expect(disclosure(container, 'crowds').open).toBe(false);

    select(control);
    expect(disclosure(container, 'crowds').open).toBe(true);
    expect(disclosure(container, control).querySelector('form[data-outline-action="update-control"]')).not.toBeNull();
  });

  test('a focus request opens its entry once: the entry then closes, and a click elsewhere keeps focus', async () => {
    eventBus.emit('scene-outline:update', snapshotFor(fixture, { focusKey: 'waypoint:wp-major:select' }));
    await nextTask();
    expect(entry().open).toBe(true);
    expect(document.activeElement.dataset.outlineKey).toBe('waypoint:wp-major:select');

    const minor = () => disclosure(container, 'waypoint:wp-minor');
    await browserClick(summaryOf(minor()));
    expect(minor().open).toBe(true);
    expect(document.activeElement).toBe(summaryOf(minor()));

    await browserClick(summaryOf(entry()));
    expect(entry().open).toBe(false);
    expect(document.activeElement).toBe(summaryOf(entry()));

    // A new request, even for the same control, is met.
    eventBus.emit('scene-outline:update', snapshotFor(fixture, { focusKey: 'waypoint:wp-major:select' }));
    await nextTask();
    expect(entry().open).toBe(true);
    expect(document.activeElement.dataset.outlineKey).toBe('waypoint:wp-major:select');
  });

  test('an entry activated while a field inside it has focus closes, and focus goes to its summary', async () => {
    // Assistive technology may activate a summary without moving focus to it.
    await browserClick(summaryOf(entry()));
    const field = entry().querySelector('[data-outline-key="waypoint:wp-major:x"]');
    field.focus();

    await browserClick(summaryOf(entry()), { focus: false });

    expect(entry().open).toBe(false);
    expect(document.activeElement).toBe(summaryOf(entry()));
  });
});

describe('a bend off the image applies as its field shows it (UI-06 W-02, Codex r1)', () => {
  // A traced bend may sit off the image (DEF-41). Its field shows the
  // heading's two decimals, -18.92 for -18.916%, but took its bounds from the
  // stored value alone (min -18.916), so the browser refused the field as
  // shown, and with it an edit to the bend's other coordinate.
  let eventBus;
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    eventBus = new EventBus();
    container = document.getElementById('scene-outline');
    new SceneOutlineController(container, eventBus);
  });

  const BEND = ['crowd:crowd-route', 'network:crowd-route', 'edges:crowd-route', 'edge:crowd-route:edge-a',
    'controls:crowd-route:edge-a', 'control:crowd-route:edge-a:0'];

  /** Draw the bend at `point`, open it, change its other coordinate to 70 and Apply. */
  async function applyOther(point, other) {
    const fixture = makeFixture();
    fixture.routeCrowd.graph.getEdge('edge-a').controlPoints[0] = { ...point };
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    for (const key of BEND) await openDisclosure(container, key);
    const form = container.querySelector('form[data-outline-form-key="control:crowd-route:edge-a:0:apply"]');
    const untouched = form.reportValidity();
    form.elements[other].value = '70';
    const listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return { form, untouched, listener };
  }

  test.each([
    ['below 0%', -0.18916, '-18.92'],
    ['above 100%', 1.18916, '118.92'],
  ])('an untouched coordinate %s is valid as shown, and a change to the other is sent', async (_, off, shown) => {
    for (const [axis, other] of [['x', 'y'], ['y', 'x']]) {
      const point = { x: 0.4, y: 0.6, [axis]: off };
      const { form, untouched, listener } = await applyOther(point, other);
      expect(form.elements[axis].value, axis).toBe(shown);
      expect(untouched, `${axis} untouched`).toBe(true);
      expect(listener, axis).toHaveBeenCalledTimes(1);
      expect(listener.mock.lastCall[0], axis).toMatchObject({
        action: 'update-control',
        [axis]: shown,
        [other]: '70',
        outlineOriginalValues: { [axis]: { display: shown, canonical: off } },
      });
      // A bend on the image keeps 0–100 (DEF-35); one off it, the value stored and the value shown.
      expect([Number(form.elements[axis].min), Number(form.elements[axis].max)], axis)
        .toEqual(off < 0 ? [Number(shown), 100] : [0, Number(shown)]);
      expect([form.elements[other].min, form.elements[other].max], other).toEqual(['0', '100']);
    }
  });
});

describe('an edited field submits what it holds, not the stored value (UI-06 W-02, Codex r1)', () => {
  // A field that is never edited submits the exact stored value it was drawn
  // from (round 1). One the author typed in, even back to the value it showed,
  // submits what it holds: the controller leaves its canonical value out.
  let eventBus;
  let container;
  let fixture;
  let listener;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="scene-outline"></div>';
    eventBus = new EventBus();
    container = document.getElementById('scene-outline');
    new SceneOutlineController(container, eventBus);
    fixture = makeFixture();
    fixture.major.imgX = 0.18914301880222837;
    fixture.routeCrowd.graph.getEdge('edge-a').controlPoints[0] = { x: 0.18914301880222837, y: 0.6 };
    eventBus.emit('scene-outline:update', snapshotFor(fixture));
    for (const key of ['waypoint:wp-major', 'crowd:crowd-route', 'network:crowd-route', 'edges:crowd-route',
      'edge:crowd-route:edge-a', 'controls:crowd-route:edge-a', 'control:crowd-route:edge-a:0']) {
      await openDisclosure(container, key);
    }
    listener = vi.fn();
    eventBus.on('scene-outline:command', listener);
  });

  const WAYPOINT = 'waypoint:wp-major:apply';
  const BEND = 'control:crowd-route:edge-a:0:apply';
  const formFor = key => container.querySelector(`form[data-outline-form-key="${key}"]`);
  const fieldOf = (key, name) => formFor(key).elements[name];
  /** Type the value the field already shows, as the author does, ending with a change event. */
  const retypeShown = (key, name, type = 'input') => {
    const field = fieldOf(key, name);
    const shown = field.value;
    field.value = '';
    field.dispatchEvent(new Event(type, { bubbles: true }));
    field.value = shown;
    field.dispatchEvent(new Event(type, { bubbles: true }));
  };
  const submit = key => {
    formFor(key).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return listener.mock.lastCall[0];
  };
  const redraw = () => eventBus.emit('scene-outline:update', snapshotFor(fixture));

  test('an input or change event marks a field edited, and the mark survives a redraw and a failed Apply', async () => {
    retypeShown(WAYPOINT, 'x');
    retypeShown(BEND, 'y', 'change');
    let waypoint = submit(WAYPOINT);
    expect(waypoint.x).toBe('18.91');
    expect(Object.keys(waypoint.outlineOriginalValues).sort()).toEqual(['waitSeconds', 'y']);
    expect(Object.keys(submit(BEND).outlineOriginalValues)).toEqual(['x']);

    // Redrawn, and redrawn with the entry collapsed and reopened.
    redraw();
    expect(Object.keys(submit(WAYPOINT).outlineOriginalValues).sort()).toEqual(['waitSeconds', 'y']);
    await openDisclosure(container, 'waypoint:wp-major');
    formFor(WAYPOINT).closest('details').querySelector(':scope > summary').click();
    await Promise.resolve();
    expect(formFor(WAYPOINT)).toBeNull();
    await openDisclosure(container, 'waypoint:wp-major');
    expect(fieldOf(WAYPOINT, 'x').value).toBe('18.91');
    expect(Object.keys(submit(WAYPOINT).outlineOriginalValues).sort()).toEqual(['waitSeconds', 'y']);

    // The app refused the Apply: the edit stands.
    eventBus.emit('scene-outline:error', { formKey: WAYPOINT, message: 'That waypoint no longer exists.' });
    redraw();
    expect(Object.keys(submit(WAYPOINT).outlineOriginalValues).sort()).toEqual(['waitSeconds', 'y']);
    // Focus and blur alone are no edit.
    fieldOf(BEND, 'x').focus();
    fieldOf(BEND, 'x').blur();
    expect(Object.keys(submit(BEND).outlineOriginalValues)).toEqual(['x']);
  });

  test('the mark goes when the Apply is accepted, on Escape, with a new project, and when the bends change', () => {
    const allOriginals = { x: expect.anything(), y: expect.anything(), waitSeconds: expect.anything() };
    const edited = () => Object.keys(submit(WAYPOINT).outlineOriginalValues).sort();

    retypeShown(WAYPOINT, 'x');
    expect(edited()).toEqual(['waitSeconds', 'y']);
    eventBus.emit('scene-outline:accepted', { formKey: WAYPOINT });
    redraw();
    expect(submit(WAYPOINT).outlineOriginalValues).toEqual(allOriginals);

    retypeShown(WAYPOINT, 'x');
    fieldOf(WAYPOINT, 'x').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(submit(WAYPOINT).outlineOriginalValues).toEqual(allOriginals);
    redraw();
    expect(submit(WAYPOINT).outlineOriginalValues).toEqual(allOriginals);

    for (const boundary of ['project:replaced', 'app:cleared']) {
      retypeShown(WAYPOINT, 'x');
      eventBus.emit(boundary);
      redraw();
      expect(submit(WAYPOINT).outlineOriginalValues, boundary).toEqual(allOriginals);
    }

    // A bend is named by its place in the list: a list that changed is another bend.
    retypeShown(BEND, 'x');
    fixture.routeCrowd.graph.getEdge('edge-a').controlPoints[0] = { x: 0.18914301880222837, y: 0.65 };
    redraw();
    expect(Object.keys(submit(BEND).outlineOriginalValues).sort()).toEqual(['x', 'y']);
  });
});

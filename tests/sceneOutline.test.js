import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { Scene } from '../src/models/Scene.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { SceneOutlineController } from '../src/controllers/SceneOutlineController.js';
import { buildSceneOutlineSnapshot, sceneOutlineKey } from '../src/utils/sceneSemantics.js';
import { ENTITY_ID_LIMITS } from '../src/utils/entityId.js';

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
    expect([...addForm().elements.afterWaypointId.options].map(option => option.textContent))
      .toEqual([
        'Start of route',
        `After ${snapshotFor(fixture).route[0].name}`,
        `After ${snapshotFor(fixture).route[1].name}`,
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
    expect(container.textContent).toContain('Minor waypoint 2 — Curve point');
    expect(container.textContent).toContain('Stored custom network — inactive');
    expect(container.textContent).toContain('Bend point 1');
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
    expect(selected.textContent).toBe('Select bend point 1');

    const extraEmitter = await openDisclosure(container, 'emitter:crowd-route:emitter-extra');
    expect(extraEmitter.querySelector('form')).toBeNull();
    expect(extraEmitter.textContent).toContain('Multi-emitter authoring remains a later crowd-control feature');

    await openDisclosure(container, 'waypoint:wp-minor');
    await openDisclosure(container, 'polygon:wp-minor');
    expect(container.textContent).toContain('Vertex 3');
    const firstVertex = await openDisclosure(container, 'vertex:wp-minor:0');
    const disabledVertexDelete = firstVertex.querySelector('button[data-outline-action="delete-vertex"]');
    expect(disabledVertexDelete.disabled).toBe(true);
    expect(disabledVertexDelete.closest('.scene-outline-content').textContent)
      .toContain('A polygon needs at least three vertices');
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
    expect(command.outlineOriginalValues).toEqual({
      x: {
        display: String(snapshot.route[0].x),
        canonical: fixture.major.imgX,
      },
      y: {
        display: String(snapshot.route[0].y),
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
      'Crowd 1 — custom network, 1 emitter',
      'Crowd 2 — custom network, 1 emitter',
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
});

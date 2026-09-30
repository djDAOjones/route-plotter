/**
 * DEF-59 — the network editor makes a network the project cannot store.
 *
 * A saved crowd may hold at most 2,000 nodes, 4,000 links and 8,192 bends,
 * 256 of them on one path, and a scene 10,000 nodes and 20,000 links: the
 * loader refuses more. The outline refused an addition past these; the
 * network editor's pen did not: a path bent a 257th time saved a project
 * that would not reopen (and undoing then redoing it threw). The pen now
 * checks the same budgets as the outline (`networkRoom`), and says so, in
 * the outline's words, adding nothing.
 */

import { expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { networkRoom } from '../src/utils/networkBudget.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { EventBus } from '../src/core/EventBus.js';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Scene } from '../src/models/Scene.js';
import { NetworkEditService } from '../src/services/NetworkEditService.js';

const FULL = {
  node: 'The project node limit has been reached.',
  edge: 'The project edge limit has been reached.',
  bend: 'The project bend-point limit has been reached.',
};

/**
 * A crowd whose network has `nodes` nodes and `links` links (each node to
 * the next, then to the one after, and so on), each link with `bends` bends.
 */
function crowd(id, { nodes = 2, links = 1, bends = 0 } = {}) {
  const ids = Array.from({ length: nodes }, (_, index) => `${id}-n${index}`);
  const edges = [];
  for (let step = 1; edges.length < links; step += 1) {
    for (let index = 0; index + step < nodes && edges.length < links; index += 1) {
      edges.push({
        id: `${id}-e${edges.length}`, sourceId: ids[index], targetId: ids[index + step],
        controlPoints: Array.from({ length: bends }, (_, bend) => ({ x: 0.5, y: (bend + 1) / (bends + 2) })),
      });
    }
  }
  return {
    id, name: id, guideType: 'graph', emitters: [],
    graph: { nodes: ids.map((nodeId, index) => ({ id: nodeId, x: 0.05 + (index % 60) * 0.015, y: 0.05 + Math.floor(index / 60) * 0.015 })), edges },
  };
}

/**
 * A booted app that does not draw. These networks are as large as a project
 * may hold, the harness keeps every canvas call, and the editor draws frame
 * after frame while a test waits: gigabytes, for nothing these tests read.
 */
async function undrawn() {
  const app = await bootApp();
  await app.ready;
  vi.spyOn(app, 'render').mockImplementation(() => {});
  return app;
}

/** An app with `crowds` open, editing the last one's network with the pen, its first node selected; drawing only if asked (small networks). */
async function editing(crowds, { draws = false } = {}) {
  const app = draws ? await bootApp() : await undrawn();
  if (draws) await app.ready;
  expect(await loadSnapshot(app, { coordVersion: 9, waypoints: [], scene: { flowLayers: crowds } })).toBe(true);
  const layer = app.scene.flowLayers.at(-1);
  app.eventBus.emit('crowd:selected', layer);
  app.enterNetworkEditMode();
  const [first] = layer.graph.getNodes();
  if (first) app.networkEditService.selectNode(first);
  const told = vi.fn();
  app.eventBus.on('ui:toast', told);
  return { app, layer, pen: app.networkEditService, told: () => told.mock.calls.map(([{ message }]) => message) };
}

/** A background, so the canvas maps to the image and the pen can be used on it. */
async function withImage(app) {
  const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: 'data:image/png;base64,AA==', getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
}

/** A fresh app opens `snapshot`. */
async function reopens(snapshot) {
  return loadSnapshot(await undrawn(), snapshot);
}

/** What a refusal leaves as it was: the network, the history, the pen (the node it is at, its selection, drag, hover and cursor) and the banner's counts. */
function penState(app, layer) {
  const pen = app.networkEditService;
  return {
    network: JSON.stringify(layer.graph.toJSON()),
    undo: app.undoService.createSnapshot(),
    at: pen.penNodeId,
    selection: JSON.stringify(pen.selection),
    drag: JSON.stringify(pen.drag),
    hover: JSON.stringify(pen.hover),
    cursor: JSON.stringify(pen.cursorImg),
    banner: document.querySelector('.banner-count')?.textContent ?? null,
  };
}

/**
 * The pen was refused: all of that as it was, no change announced to the
 * app and nothing saved, the author told once, and the project still
 * reopens (unless its scene is past the project-wide budgets, DEF-04's,
 * which no project may hold).
 */
async function refused(app, layer, attempt, message, told, { reopen = true } = {}) {
  const before = penState(app, layer);
  const saving = vi.spyOn(app, 'autoSave');
  const changed = vi.fn();
  app.eventBus.on('network:changed', changed);

  attempt();

  expect(penState(app, layer)).toEqual(before);
  expect(saving).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  expect(told()).toEqual([message]);
  if (reopen) expect(await reopens(app._buildProjectSnapshot())).toBe(true);
}

/** Bend a path by dragging it, as the pen does. */
const bend = (pen, edge) => {
  pen.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 1);
  pen.moveDrag({ x: 0.52, y: 0.51 });
  pen.endDrag();
};

test('a path of 255 bends takes a 256th by the pen, and the project reopens with it', async () => {
  const { app, layer, pen } = await editing([crowd('c', { bends: 255 })]);
  const [edge] = layer.graph.getEdges();

  bend(pen, edge);

  expect(edge.controlPoints).toHaveLength(256);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

test('a path of 256 bends is not bent again by the pen, and the author is told why', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { bends: 256 })]);
  const [edge] = layer.graph.getEdges();

  await refused(app, layer, () => bend(pen, edge), FULL.bend, told);
});

test('a crowd whose paths hold 8,191 bends takes an 8,192nd, and the project reopens with it', async () => {
  // Thirty-one paths of 256 bends, one of 255, and one of none.
  const nearlyFull = crowd('c', { nodes: 40, links: 33, bends: 256 });
  nearlyFull.graph.edges.at(-2).controlPoints.pop();
  nearlyFull.graph.edges.at(-1).controlPoints = [];
  const { app, layer, pen, told } = await editing([nearlyFull]);
  const edge = layer.graph.getEdges().at(-1);

  bend(pen, edge);

  expect(layer.graph.getEdges().reduce((sum, each) => sum + each.controlPoints.length, 0)).toBe(8192);
  expect(told()).toEqual([]);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

test('a crowd whose paths hold 8,192 bends is not bent again by the pen, on a path with none', async () => {
  // Thirty-two paths of 256 bends, and one of none.
  const full = crowd('c', { nodes: 40, links: 33, bends: 256 });
  full.graph.edges.at(-1).controlPoints = [];
  const { app, layer, pen, told } = await editing([full]);
  const edge = layer.graph.getEdges().at(-1);

  await refused(app, layer, () => bend(pen, edge), FULL.bend, told);
});

test('a path of 256 bends dragged by the pointer is not bent, and the author is told once, the editor drawing as it goes', async () => {
  const { app, layer, told } = await editing([crowd('c', { bends: 256 })], { draws: true });
  await withImage(app);
  // On the path's run of bends, away from its nodes.
  const { x, y } = app.imageToCanvas(0.5, 0.5);
  expect(app.findNetworkTargetAt(x, y)).toMatchObject({ kind: 'edge' });

  await refused(app, layer, () => {
    app.eventBus.emit('network:drag-start', { x, y });
    app.eventBus.emit('network:drag-move', { x: x + 12, y: y + 8, shiftKey: false });
    app.eventBus.emit('network:drag-end');
  }, FULL.bend, told);
});

test.each([
  ['a crowd of 1,999 nodes takes a 2,000th node', () => [crowd('c', { nodes: 1999, links: 1 })], 'node'],
  ['a scene of 9,999 nodes takes a 10,000th node', () => [...Array.from({ length: 4 }, (_, index) => crowd(`c${index}`, { nodes: 2000, links: 1 })), crowd('last', { nodes: 1999, links: 1 })], 'node'],
  ['a crowd of 3,999 links takes a 4,000th link', () => [crowd('c', { nodes: 100, links: 3999 })], 'link'],
])('%s from the pen, and the project reopens with it', async (_, crowds, kind) => {
  const { app, layer, pen, told } = await editing(crowds());
  const nodes = layer.graph.getNodes().length;
  const links = layer.graph.getEdges().length;

  if (kind === 'node') expect(pen.placeNode({ x: 0.9, y: 0.9 })).not.toBeNull();
  else {
    // The first node and the last are not yet linked.
    pen.clickNode(layer.graph.getNodes()[0]);
    pen.clickNode(layer.graph.getNodes().at(-1));
  }

  expect([layer.graph.getNodes().length, layer.graph.getEdges().length])
    .toEqual(kind === 'node' ? [nodes + 1, links] : [nodes, links + 1]);
  expect(told()).toEqual([]);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

test('a crowd of 2,000 nodes takes no node from the pen', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 2000, links: 1 })]);

  await refused(app, layer, () => pen.placeNode({ x: 0.9, y: 0.9 }), FULL.node, told);
});

test('a click on the map with the pen, in a crowd of 2,000 nodes, places nothing and says only why', async () => {
  const { app, layer, told } = await editing([crowd('c', { nodes: 2000, links: 1 })]);
  // Nodes are placed on the image: the project has one.
  await withImage(app);
  const announce = vi.spyOn(app, 'announce');
  // A corner of the image no node is near.
  const { x, y } = app.imageToCanvas(0.98, 0.98);
  expect(app.isWithinImageBounds(x, y)).toBe(true);

  await refused(app, layer, () => app._handleNetworkClick(x, y, false), FULL.node, told);

  expect(announce).not.toHaveBeenCalledWith('Node placed');
});

test('a scene of 10,000 nodes takes no node from the pen, in any crowd', async () => {
  const full = Array.from({ length: 5 }, (_, index) => crowd(`c${index}`, { nodes: 2000, links: 1 }));
  const { app, layer, pen, told } = await editing([...full, crowd('last', { nodes: 0, links: 0 })]);

  await refused(app, layer, () => pen.placeNode({ x: 0.9, y: 0.9 }), FULL.node, told);
});

test.each([
  ['with a new node', pen => pen.placeNode({ x: 0.9, y: 0.9 })],
  // The first node and the last are not yet linked.
  ['to a node there', (pen, layer) => pen.clickNode(layer.graph.getNodes().at(-1))],
])('a crowd of 4,000 links takes no link from the pen %s', async (_, link) => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 100, links: 4000 })]);
  // The pen down at the first node: a link would come from it.
  pen.clickNode(layer.graph.getNodes()[0]);

  await refused(app, layer, () => link(pen, layer), FULL.edge, told);
});

test('the pen that takes a path’s 256th bend refuses its 257th, in the same session', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { bends: 255 })]);
  const [edge] = layer.graph.getEdges();
  bend(pen, edge);
  expect(edge.controlPoints).toHaveLength(256);

  await refused(app, layer, () => bend(pen, edge), FULL.bend, told);
  expect(edge.controlPoints).toHaveLength(256);
});

test('the pen that places a crowd’s 2,000th node refuses its 2,001st, in the same session', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 1999, links: 1 })]);
  expect(pen.placeNode({ x: 0.9, y: 0.9 })).not.toBeNull();
  expect(layer.graph.getNodes()).toHaveLength(2000);

  await refused(app, layer, () => pen.placeNode({ x: 0.8, y: 0.8 }), FULL.node, told);
  expect(layer.graph.getNodes()).toHaveLength(2000);
});

test('the pen that makes a crowd’s 4,000th link refuses its 4,001st, in the same session', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 100, links: 3999 })]);
  const nodes = layer.graph.getNodes();
  pen.clickNode(nodes[0]);
  pen.clickNode(nodes.at(-1));
  expect(layer.graph.getEdges()).toHaveLength(4000);

  await refused(app, layer, () => pen.placeNode({ x: 0.9, y: 0.9 }), FULL.edge, told);
  expect(layer.graph.getEdges()).toHaveLength(4000);
});

test('a node refused where the crowd has no room for a node or a link says so once, for the node', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 2000, links: 4000 })]);
  pen.clickNode(layer.graph.getNodes()[0]);

  await refused(app, layer, () => pen.placeNode({ x: 0.9, y: 0.9 }), FULL.node, told);
});

test('a refusal leaves the pen’s hover and cursor as they were', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { bends: 256 })]);
  const [edge] = layer.graph.getEdges();
  pen.setHover({ kind: 'edge', edge, insertIndex: 1 }, { x: 0.5, y: 0.5 });
  expect(pen.hover).not.toBeNull();

  await refused(app, layer, () => pen.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 1), FULL.bend, told);
});

test('at a crowd’s 4,000 links, the pen still goes on along a link there, adding nothing', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 100, links: 4000 })]);
  const [first, second] = layer.graph.getNodes();
  pen.clickNode(first);
  const network = JSON.stringify(layer.graph.toJSON());
  const undo = app.undoService.createSnapshot();
  const saving = vi.spyOn(app, 'autoSave');

  pen.clickNode(second);

  expect([pen.penNodeId, pen.selection]).toEqual([second.id, { kind: 'node', id: second.id }]);
  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
  expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(saving).not.toHaveBeenCalled();
  expect(told()).toEqual([]);
});

test('a bend refused while a node is being dragged leaves that drag as it was', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { bends: 256 })]);
  const [edge] = layer.graph.getEdges();
  pen.beginNodeDrag(layer.graph.getNodes()[0]);
  expect(pen.drag).not.toBeNull();

  await refused(app, layer, () => pen.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 1), FULL.bend, told);
});

test.each([
  ['a bend', crowd('c', { bends: 256 }), layer => ({ action: 'add-control', layerId: layer.id, edgeId: layer.graph.getEdges()[0].id, x: 50, y: 50 }), FULL.bend],
  ['a node', crowd('c', { nodes: 2000, links: 1 }), layer => ({ action: 'add-node', layerId: layer.id, x: 50, y: 50, type: 'normal' }), FULL.node],
  // The first node and the last are not yet linked.
  ['a link', crowd('c', { nodes: 100, links: 4000 }), layer => ({ action: 'connect-nodes', layerId: layer.id, sourceId: 'c-n0', targetId: 'c-n99', direction: 'one-way', weight: 1 }), FULL.edge],
])('the outline refuses %s past the budget in the same words, once, and changes nothing else', async (_, full, command, message) => {
  const { app, layer } = await editing([full]);

  outlineRefuses(app, layer, command(layer), message);
});

/**
 * The outline was refused `command`: its form told once, in `message`, and
 * the network, the history, the pen and the banner as they were, with no
 * toast, no change announced and nothing saved.
 */
function outlineRefuses(app, layer, command, message) {
  const before = penState(app, layer);
  const errors = vi.fn();
  app.eventBus.on('scene-outline:error', errors);
  const saving = vi.spyOn(app, 'autoSave');
  const changed = vi.fn();
  app.eventBus.on('network:changed', changed);
  const toasts = vi.fn();
  app.eventBus.on('ui:toast', toasts);

  app.eventBus.emit('scene-outline:command', { ...command, outlineFormKey: 'form' });

  expect(errors.mock.calls).toEqual([[{ formKey: 'form', message }]]);
  expect(penState(app, layer)).toEqual(before);
  expect(saving).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  expect(toasts).not.toHaveBeenCalled();
}

/** Five crowds of 2,000 nodes (guided as `guideType` says) and, last, an empty one: a scene of 10,000 nodes. */
const tenThousandNodes = (guideType = 'graph') => [
  ...Array.from({ length: 5 }, (_, index) => ({ ...crowd(`f${index}`, { nodes: 2000, links: 0 }), guideType })),
  crowd('last', { nodes: 0, links: 0 }),
];

/**
 * An app editing, with the pen at its first node, the last of five crowds
 * of 4,000 links and one of two nodes and none: a scene of 20,000 links. So
 * many links are past the project-wide values budget (DEF-04's), so no
 * project holds them and they cannot be opened: the scene is put in place
 * as it is, to test the count.
 */
async function twentyThousandLinks() {
  const app = await undrawn();
  app.scene = Scene.fromJSON({
    flowLayers: [...Array.from({ length: 5 }, (_, index) => crowd(`f${index}`, { nodes: 100, links: 4000 })), crowd('last', { nodes: 2, links: 0 })],
  });
  const layer = app.scene.getFlowLayers().at(-1);
  app.eventBus.emit('crowd:selected', layer);
  app.enterNetworkEditMode();
  app.networkEditService.clickNode(layer.graph.getNodes()[0]);
  const told = vi.fn();
  app.eventBus.on('ui:toast', told);
  return { app, layer, pen: app.networkEditService, told: () => told.mock.calls.map(([{ message }]) => message) };
}

test('the outline refuses a node when the scene has 10,000, though its own crowd has none', async () => {
  const { app, layer } = await editing(tenThousandNodes());

  outlineRefuses(app, layer, { action: 'add-node', layerId: layer.id, x: 50, y: 50, type: 'normal' }, FULL.node);
});

test('the outline refuses a link when the scene has 20,000, though its own crowd has none', async () => {
  const { app, layer } = await twentyThousandLinks();

  outlineRefuses(app, layer, {
    action: 'connect-nodes', layerId: layer.id, sourceId: 'last-n0', targetId: 'last-n1', direction: 'one-way', weight: 1,
  }, FULL.edge);
});

test('the outline refuses a bend when its crowd\'s paths hold 8,192, on a path with none', async () => {
  const full = crowd('c', { nodes: 40, links: 33, bends: 256 });
  full.graph.edges.at(-1).controlPoints = [];
  const { app, layer } = await editing([full]);
  const edge = layer.graph.getEdges().at(-1);
  expect(edge.controlPoints).toHaveLength(0);

  outlineRefuses(app, layer, { action: 'add-control', layerId: layer.id, edgeId: edge.id, x: 50, y: 50 }, FULL.bend);
});

test.each([
  ['with a new node', pen => pen.placeNode({ x: 0.8, y: 0.8 })],
  ['to a node there', (pen, layer) => pen.clickNode(layer.graph.getNodes().at(-1))],
])('the pen refuses a link %s when the scene has 20,000, though its own crowd has none', async (_, link) => {
  const { app, layer, pen, told } = await twentyThousandLinks();
  const before = penState(app, layer);
  const changed = vi.fn();
  app.eventBus.on('network:changed', changed);

  link(pen, layer);

  expect(penState(app, layer)).toEqual(before);
  expect(changed).not.toHaveBeenCalled();
  expect(told()).toEqual([FULL.edge]);
});

test('the pen counts the saved networks of crowds that follow the route, with the rest of the scene', async () => {
  const { app, layer, pen, told } = await editing(tenThousandNodes('route'));

  await refused(app, layer, () => pen.placeNode({ x: 0.8, y: 0.8 }), FULL.node, told);
});

test('after another project is opened, the pen counts its scene, not the one it counted before', async () => {
  const { app, pen } = await editing([crowd('old')]);
  // The pen asks for the scene's crowds, and places a node
  expect(pen.placeNode({ x: 0.8, y: 0.8 })).not.toBeNull();

  expect(await loadSnapshot(app, { coordVersion: 9, waypoints: [], scene: { flowLayers: tenThousandNodes() } })).toBe(true);
  const layer = app.scene.getFlowLayers().at(-1);
  app.eventBus.emit('crowd:selected', layer);
  app.enterNetworkEditMode();
  const told = vi.fn();
  app.eventBus.on('ui:toast', told);

  expect(pen.placeNode({ x: 0.8, y: 0.8 })).toBeNull();
  expect(layer.graph.getNodes()).toHaveLength(0);
  expect(told.mock.calls).toEqual([[{ message: FULL.node }]]);
});

test.each([
  ['a node, in a crowd of 2,000', { nodes: 2000 }, (pen) => pen.placeNode({ x: 0.8, y: 0.8 }), FULL.node],
  ['a link, in a crowd of 4,000', { nodes: 100, links: 4000 }, (pen, layer) => pen.clickNode(layer.graph.getNodes().at(-1)), FULL.edge],
  ['a bend, on a path of 256', { bends: 256 }, (pen, layer) => pen.beginEdgeBend(layer.graph.getEdges()[0], { x: 0.5, y: 0.5 }, 1), FULL.bend],
])('a pen with no app to ask for the scene still keeps its own crowd within its counts: %s', (_, size, attempt, message) => {
  // No listener answers the pen's question about the scene: it counts its own crowd
  const bus = new EventBus({ onListenerError: (error) => { throw error; } });
  expect(bus.listenerCount('scene:flow-layers')).toBe(0);
  const pen = new NetworkEditService(bus);
  const layer = FlowLayer.fromJSON(crowd('solo', size));
  pen.enter(layer);
  pen.clickNode(layer.graph.getNodes()[0]);
  const network = JSON.stringify(layer.graph.toJSON());
  const toasts = vi.fn();
  const changed = vi.fn();
  bus.on('ui:toast', toasts);
  bus.on('network:changed', changed);
  try {
    attempt(pen, layer);

    expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
    expect(toasts.mock.calls).toEqual([[{ message }]]);
    expect(changed).not.toHaveBeenCalled();
  } finally {
    pen.exit();
  }
});

/** A crowd as the budget reads it: so many nodes and links, each link with so many bends. */
const counted = (nodes, links, bends = 0) => ({
  graph: {
    getNodes: () => ({ length: nodes }),
    getEdges: () => Array.from({ length: links }, () => ({ controlPoints: { length: bends } })),
  },
});

test('the scene’s budgets count every crowd: 10,000 nodes and 20,000 links in all leave no room in any', () => {
  const layer = counted(0, 0);
  expect(networkRoom([counted(9999, 0), layer], layer)).toMatchObject({ node: true });
  expect(networkRoom([counted(10000, 0), layer], layer)).toMatchObject({ node: false });
  expect(networkRoom([counted(0, 19999), layer], layer)).toMatchObject({ edge: true });
  expect(networkRoom([counted(0, 20000), layer], layer)).toMatchObject({ edge: false });
  // A crowd in the scene is counted once, with what it holds.
  const five = counted(5, 0);
  expect(networkRoom([counted(9994, 0), five], five)).toMatchObject({ node: true });
  // A crowd not yet among the scene's is counted too, with what it holds.
  expect(networkRoom([counted(9995, 0)], counted(4, 0))).toMatchObject({ node: true });
  expect(networkRoom([counted(9995, 0)], counted(5, 0))).toMatchObject({ node: false });
  expect(networkRoom([counted(0, 19999)], counted(0, 1))).toMatchObject({ edge: false });
});

/** A crowd whose paths hold 8,191 bends, its last path none: room for one more bend in the crowd. */
function oneBendShort() {
  const data = crowd('c', { nodes: 40, links: 33, bends: 256 });
  data.graph.edges.at(-2).controlPoints.pop();
  data.graph.edges.at(-1).controlPoints = [];
  return data;
}
const totalBends = layer => layer.graph.getEdges().reduce((sum, edge) => sum + edge.controlPoints.length, 0);
const outline = (app, command) => app.eventBus.emit('scene-outline:command', { ...command, outlineFormKey: 'form' });
const addControl = (layer, edge) => ({ action: 'add-control', layerId: layer.id, edgeId: edge.id, x: 50, y: 50 });

test('the pen that takes a crowd’s 8,192nd bend refuses its 8,193rd, in the same session', async () => {
  const { app, layer, pen, told } = await editing([oneBendShort()]);
  const edge = layer.graph.getEdges().at(-1);
  bend(pen, edge);
  expect(totalBends(layer)).toBe(8192);

  await refused(app, layer, () => bend(pen, edge), FULL.bend, told);
  expect(totalBends(layer)).toBe(8192);
});

test('the outline takes a crowd’s 8,192nd bend, and the pen then refuses the next', async () => {
  const { app, layer, pen, told } = await editing([oneBendShort()]);
  const edge = layer.graph.getEdges().at(-1);
  outline(app, addControl(layer, edge));
  expect(totalBends(layer)).toBe(8192);

  await refused(app, layer, () => bend(pen, edge), FULL.bend, told);
  expect(totalBends(layer)).toBe(8192);
});

test('the pen takes a crowd’s 8,192nd bend, and the outline then refuses the next', async () => {
  const { app, layer, pen } = await editing([oneBendShort()]);
  const edge = layer.graph.getEdges().at(-1);
  bend(pen, edge);
  expect(totalBends(layer)).toBe(8192);

  outlineRefuses(app, layer, addControl(layer, edge), FULL.bend);
  expect(totalBends(layer)).toBe(8192);
});

test('a crowd’s bends given back and taken again, and undone and redone, are counted as they stand: the next past 8,192 is refused', async () => {
  const { app, layer, pen, told } = await editing([oneBendShort()]);
  const edge = layer.graph.getEdges().at(-1);
  bend(pen, edge);
  pen.deleteControlPoint(edge, 0);
  expect(totalBends(layer)).toBe(8191);
  pen.beginEdgeBend(edge, { x: 0.5, y: 0.5 }, 0);
  expect(totalBends(layer)).toBe(8192);
  pen.cancelDrag();
  expect(totalBends(layer)).toBe(8191);
  bend(pen, edge);
  expect(totalBends(layer)).toBe(8192);
  app.undo();
  expect(totalBends(pen.layer)).toBe(8191);
  app.redo();
  expect(totalBends(pen.layer)).toBe(8192);

  await refused(app, pen.layer, () => bend(pen, pen.layer.graph.getEdge(edge.id)), FULL.bend, told);
});

/** Five hidden crowds of 2,000 nodes and, last, an empty one shown: a scene of 10,000 nodes. */
const tenThousandHidden = () => [
  ...Array.from({ length: 5 }, (_, index) => ({ ...crowd(`h${index}`, { nodes: 2000, links: 0 }), visible: false })),
  crowd('c', { nodes: 0, links: 0 }),
];

test('hidden crowds count toward the scene’s 10,000 nodes: the pen places none in a crowd shown', async () => {
  const { app, layer, pen, told } = await editing(tenThousandHidden());

  await refused(app, layer, () => pen.placeNode({ x: 0.8, y: 0.8 }), FULL.node, told);
});

test('hidden crowds count toward the scene’s 10,000 nodes: the outline adds none to a crowd shown', async () => {
  const { app, layer } = await editing(tenThousandHidden());

  outlineRefuses(app, layer, { action: 'add-node', layerId: layer.id, type: 'normal', x: 80, y: 80 }, FULL.node);
});

test('at a crowd’s 4,000 links, the pen, at no node, still places a node on its own, with no link', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 100, links: 4000 })]);
  expect(pen.penNodeId).toBeNull();

  expect(pen.placeNode({ x: 0.8, y: 0.8 })).not.toBeNull();

  expect([layer.graph.getNodes().length, layer.graph.getEdges().length]).toEqual([101, 4000]);
  expect(told()).toEqual([]);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

test('the pen takes a scene’s 10,000th node, the outline then refuses the next, and a node deleted makes room again', async () => {
  const crowds = [...Array.from({ length: 4 }, (_, index) => crowd(`f${index}`, { nodes: 2000, links: 0 })),
    crowd('reserve', { nodes: 1998, links: 0 }), crowd('c', { nodes: 1, links: 0 })];
  const { app, layer, pen, told } = await editing(crowds);
  const node = pen.placeNode({ x: 0.8, y: 0.8 });
  expect(node).not.toBeNull();

  outlineRefuses(app, layer, { action: 'add-node', layerId: layer.id, type: 'normal', x: 80, y: 80 }, FULL.node);

  pen.deleteNode(node);
  expect(pen.placeNode({ x: 0.7, y: 0.7 })).not.toBeNull();
  expect(app.scene.getFlowLayers().reduce((sum, each) => sum + each.graph.getNodes().length, 0)).toBe(10000);
  expect(told()).toEqual([]);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

/**
 * An app editing, with the pen at the first node of the last crowd (three
 * nodes, no links), in a scene `short` links short of 20,000: four crowds of
 * 4,000 and one (f4) of the rest. Put in place as `twentyThousandLinks` puts
 * its scene.
 */
async function oneLinkShort({ short = 1 } = {}) {
  const app = await undrawn();
  app.scene = Scene.fromJSON({
    flowLayers: [
      ...Array.from({ length: 4 }, (_, index) => crowd(`f${index}`, { nodes: 100, links: 4000 })),
      crowd('f4', { nodes: 100, links: 4000 - short }),
      crowd('last', { nodes: 3, links: 0 }),
    ],
  });
  const layer = app.scene.getFlowLayers().at(-1);
  app.eventBus.emit('crowd:selected', layer);
  app.enterNetworkEditMode();
  app.networkEditService.clickNode(layer.graph.getNodes()[0]);
  const told = vi.fn();
  app.eventBus.on('ui:toast', told);
  return { app, layer, pen: app.networkEditService, told: () => told.mock.calls.map(([{ message }]) => message) };
}
const sceneLinks = app => app.scene.getFlowLayers().reduce((sum, each) => sum + each.graph.getEdges().length, 0);
const connect = (layer, sourceId, targetId) => ({ action: 'connect-nodes', layerId: layer.id, sourceId, targetId, direction: 'one-way', weight: 1 });

test('the pen that makes a scene’s 20,000th link refuses its 20,001st, in the same session', async () => {
  const { app, layer, pen, told } = await oneLinkShort();
  const [, second, third] = layer.graph.getNodes();
  pen.clickNode(second);
  expect(sceneLinks(app)).toBe(20000);

  await refused(app, layer, () => pen.clickNode(third), FULL.edge, told, { reopen: false });
  expect(sceneLinks(app)).toBe(20000);
});

test('the pen links and bends in one crowd, the outline makes the scene’s 20,000th link in another, and the pen then refuses the next', async () => {
  // Counted as they stand: the pen's own crowd unchanged since it last
  // asked, another crowd's links have moved on
  const { app, layer, pen, told } = await oneLinkShort({ short: 2 });
  const other = app.scene.getFlowLayers().find(each => each.id === 'f4');
  pen.clickNode(layer.graph.getNodes()[1]);
  bend(pen, layer.graph.getEdges()[0]);
  expect([sceneLinks(app), layer.graph.getEdges()[0].controlPoints.length]).toEqual([19999, 1]);
  outline(app, connect(other, 'f4-n0', 'f4-n99'));
  expect(sceneLinks(app)).toBe(20000);
  // Back to the pen in the last crowd, as the author would go
  app.eventBus.emit('crowd:selected', layer);
  app.enterNetworkEditMode();
  pen.clickNode(layer.graph.getNodes()[1]);
  expect([pen.active, pen.layer]).toEqual([true, layer]);

  await refused(app, layer, () => pen.clickNode(layer.graph.getNodes()[2]), FULL.edge, told, { reopen: false });
  expect(sceneLinks(app)).toBe(20000);
});

test('the pen makes a scene’s 20,000th link, the outline then refuses one in another crowd, and a link deleted makes room again', async () => {
  const { app, layer, pen, told } = await oneLinkShort();
  const other = app.scene.getFlowLayers().find(each => each.id === 'f4');
  const [, second, third] = layer.graph.getNodes();
  pen.clickNode(second);
  expect(sceneLinks(app)).toBe(20000);

  outlineRefuses(app, other, connect(other, 'f4-n0', 'f4-n99'), FULL.edge);

  pen.deleteEdge(layer.graph.getEdges()[0]);
  pen.clickNode(third);
  expect(sceneLinks(app)).toBe(20000);
  expect(told()).toEqual([]);
});

test('at a crowd’s 2,000 nodes, the pen and the outline still link two of its nodes', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 2000, links: 1 })]);
  const nodes = layer.graph.getNodes();
  pen.clickNode(nodes[0]);
  pen.clickNode(nodes[5]);
  outline(app, connect(layer, nodes[7].id, nodes[9].id));

  expect([layer.graph.getNodes().length, layer.graph.getEdges().length]).toEqual([2000, 3]);
  expect(told()).toEqual([]);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
});

test('at a scene’s 10,000 nodes, the pen and the outline still link two nodes of a crowd', async () => {
  const { app, layer, pen, told } = await editing(Array.from({ length: 5 }, (_, index) => crowd(`f${index}`, { nodes: 2000, links: 0 })));
  const nodes = layer.graph.getNodes();
  pen.clickNode(nodes[0]);
  pen.clickNode(nodes[1]);
  outline(app, connect(layer, nodes[2].id, nodes[3].id));

  expect(app.scene.getFlowLayers().reduce((sum, each) => sum + each.graph.getNodes().length, 0)).toBe(10000);
  expect(layer.graph.getEdges()).toHaveLength(2);
  expect(told()).toEqual([]);
});

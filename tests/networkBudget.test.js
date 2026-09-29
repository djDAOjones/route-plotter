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

/** What a refusal leaves as it was: the network, the history, the pen (the node it is at, its selection and drag) and the banner's counts. */
function penState(app, layer) {
  const pen = app.networkEditService;
  return {
    network: JSON.stringify(layer.graph.toJSON()),
    undo: app.undoService.createSnapshot(),
    at: pen.penNodeId,
    selection: JSON.stringify(pen.selection),
    drag: JSON.stringify(pen.drag),
    banner: document.querySelector('.banner-count')?.textContent ?? null,
  };
}

/**
 * The pen was refused: all of that as it was, no change announced to the
 * app and nothing saved, the author told once, and the project still
 * reopens.
 */
async function refused(app, layer, attempt, message, told) {
  const before = penState(app, layer);
  const saving = vi.spyOn(app, 'autoSave');
  const changed = vi.fn();
  app.eventBus.on('network:changed', changed);

  attempt();

  expect(penState(app, layer)).toEqual(before);
  expect(saving).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  expect(told()).toEqual([message]);
  expect(await reopens(app._buildProjectSnapshot())).toBe(true);
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
  const { app, layer, told } = await editing([full]);
  const before = penState(app, layer);
  const errors = vi.fn();
  app.eventBus.on('scene-outline:error', errors);
  const saving = vi.spyOn(app, 'autoSave');
  const changed = vi.fn();
  app.eventBus.on('network:changed', changed);

  app.eventBus.emit('scene-outline:command', { ...command(layer), outlineFormKey: 'form' });

  expect(errors.mock.calls).toEqual([[{ formKey: 'form', message }]]);
  expect(penState(app, layer)).toEqual(before);
  expect(saving).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  expect(told()).toEqual([]);
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

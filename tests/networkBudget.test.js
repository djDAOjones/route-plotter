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

/** An app with `crowds` open, editing the last one's network with the pen. */
async function editing(crowds) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, { coordVersion: 9, waypoints: [], scene: { flowLayers: crowds } })).toBe(true);
  const layer = app.scene.flowLayers.at(-1);
  app.eventBus.emit('crowd:selected', layer);
  app.enterNetworkEditMode();
  const told = vi.fn();
  app.eventBus.on('ui:toast', told);
  return { app, layer, pen: app.networkEditService, told: () => told.mock.calls.map(([{ message }]) => message) };
}

/** A fresh app opens `snapshot`. */
async function reopens(snapshot) {
  const fresh = await bootApp();
  await fresh.ready;
  return loadSnapshot(fresh, snapshot);
}

/** The pen was refused: the network as it was, nothing recorded, the author told once, and the project still reopens. */
async function refused(app, layer, attempt, message, told) {
  const network = JSON.stringify(layer.graph.toJSON());
  const undo = app.undoService.createSnapshot();

  attempt();

  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
  expect(app.undoService.createSnapshot()).toEqual(undo);
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

test('a crowd whose paths hold 8,192 bends is not bent again by the pen, on a path with none', async () => {
  // Thirty-two paths of 256 bends, and one of none.
  const full = crowd('c', { nodes: 40, links: 33, bends: 256 });
  full.graph.edges.at(-1).controlPoints = [];
  const { app, layer, pen, told } = await editing([full]);
  const edge = layer.graph.getEdges().at(-1);

  await refused(app, layer, () => bend(pen, edge), FULL.bend, told);
});

test('a crowd of 2,000 nodes takes no node from the pen', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 2000, links: 1 })]);

  await refused(app, layer, () => pen.placeNode({ x: 0.9, y: 0.9 }), FULL.node, told);
});

test('a click on the map with the pen, in a crowd of 2,000 nodes, places nothing and says only why', async () => {
  const { app, layer, told } = await editing([crowd('c', { nodes: 2000, links: 1 })]);
  // Nodes are placed on the image: the project has one.
  const image = Object.assign(new Image(), { naturalWidth: 1600, naturalHeight: 900, width: 1600, height: 900 });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: 'data:image/png;base64,AA==', getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
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

test('a crowd of 4,000 links takes no link from the pen: not with a new node, nor to one there', async () => {
  const { app, layer, pen, told } = await editing([crowd('c', { nodes: 100, links: 4000 })]);
  const [first] = layer.graph.getNodes();
  const last = layer.graph.getNodes().at(-1);
  // The pen down at the first node: a node placed would come linked from it.
  pen.clickNode(first);

  await refused(app, layer, () => pen.placeNode({ x: 0.9, y: 0.9 }), FULL.edge, told);
  const network = JSON.stringify(layer.graph.toJSON());
  pen.clickNode(last);
  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
  expect(told()).toEqual([FULL.edge, FULL.edge]);
});

test.each([
  ['a bend', crowd('c', { bends: 256 }), layer => ({ action: 'add-control', layerId: layer.id, edgeId: layer.graph.getEdges()[0].id, x: 50, y: 50 }), FULL.bend],
  ['a node', crowd('c', { nodes: 2000, links: 1 }), layer => ({ action: 'add-node', layerId: layer.id, x: 50, y: 50, type: 'normal' }), FULL.node],
  // The first node and the last are not yet linked.
  ['a link', crowd('c', { nodes: 100, links: 4000 }), layer => ({ action: 'connect-nodes', layerId: layer.id, sourceId: 'c-n0', targetId: 'c-n99', direction: 'one-way', weight: 1 }), FULL.edge],
])('the outline refuses %s past the budget in the same words', async (_, full, command, message) => {
  const { app, layer } = await editing([full]);
  const network = JSON.stringify(layer.graph.toJSON());
  const errors = vi.fn();
  app.eventBus.on('scene-outline:error', errors);

  app.eventBus.emit('scene-outline:command', { ...command(layer), outlineFormKey: 'form' });

  expect(errors).toHaveBeenCalledWith({ formKey: 'form', message });
  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
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
  // A crowd not yet among the scene's is counted too.
  expect(networkRoom([counted(0, 20000)], counted(0, 0))).toMatchObject({ edge: false });
});

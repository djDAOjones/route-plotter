/**
 * DEF-52 — a traced crowd network the project cannot reopen.
 *
 * Tracing the route into a crowd copies each leg's minor waypoints into its
 * path as bends, and each major into a node, its name the node's label. A
 * saved crowd may hold at most 256 bends on a path, and a project has its
 * own budgets (nodes across its crowds, text, how many values it holds);
 * the trace held none of them: a leg of 257 minors traced and saved, and the
 * project then would not open. The project a trace would make is now
 * checked as the loader checks a saved one, before it replaces anything, and
 * the trace is refused, saying why, when the project could not be stored.
 */

import { expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

const major = (id, name = id, extra = {}) => ({ id, name, imgX: 0.2, imgY: 0.3, isMajor: true, ...extra });

/** A route of two majors with `bends` minors between them, in a zig-zag. */
function routeWithBends(bends) {
  const minors = Array.from({ length: bends }, (_, index) => ({
    id: `bend-${index}`,
    imgX: 0.2 + (0.6 * (index + 1)) / (bends + 1),
    imgY: index % 2 ? 0.45 : 0.55,
    isMajor: false,
  }));
  return [
    { id: 'start', name: 'Main entrance', imgX: 0.2, imgY: 0.5, isMajor: true },
    ...minors,
    { id: 'end', name: 'Library', imgX: 0.8, imgY: 0.5, isMajor: true },
  ];
}

/** An app with `waypoints` open, and a crowd added, as the author adds one, unless `scene` has crowds. */
async function withRoute(waypoints, scene = null) {
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, { coordVersion: 9, waypoints, ...(scene ? { scene } : {}) })).toBe(true);
  if (!scene) app.addCrowd();
  return app;
}

/** A fresh app with `snapshot` open as saved, or null when the loader refuses it. */
async function reopened(snapshot) {
  const fresh = await bootApp();
  await fresh.ready;
  return (await loadSnapshot(fresh, snapshot)) ? fresh : null;
}

/** Trace the route into `layer`, and hear what the author is told. */
function trace(app, layer) {
  const toast = vi.fn();
  app.eventBus.on('ui:toast', toast);
  const traced = app.traceRouteIntoCrowd(layer);
  return { traced, told: toast.mock.calls.map(([{ message }]) => message) };
}

test('a leg of 256 bends traces into the crowd, and the project reopens with them', async () => {
  const app = await withRoute(routeWithBends(256));
  const layer = app.scene.flowLayers[0];

  expect(trace(app, layer).traced).toBe(true);

  const [path] = layer.graph.getEdges();
  expect(path.controlPoints).toHaveLength(256);
  const fresh = await reopened(app._buildProjectSnapshot());
  expect(fresh).not.toBeNull();
  expect(fresh.scene.flowLayers[0].graph.toJSON()).toEqual(layer.graph.toJSON());
});

/**
 * Refused: the crowd keeps its network, nothing is recorded or saved, the
 * author is told `message`, once, and the project still reopens as it was.
 * `unchanged` is checked before the reopening, which boots another app.
 */
async function refused(app, layer, message, unchanged = () => {}) {
  const network = JSON.stringify(layer.graph.toJSON());
  const undo = app.undoService.createSnapshot();
  const saving = vi.spyOn(app, 'autoSave');

  const { traced, told } = trace(app, layer);

  expect(traced).toBe(false);
  expect(told).toEqual([message]);
  expect(JSON.stringify(layer.graph.toJSON())).toBe(network);
  expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(saving).not.toHaveBeenCalled();
  unchanged();
  expect(await reopened(app._buildProjectSnapshot())).not.toBeNull();
}

test('a leg of 257 bends is not traced, and the author is told which leg, and why', async () => {
  const app = await withRoute(routeWithBends(257));

  await refused(app, app.scene.flowLayers[0], 'The leg from Main entrance has 257 bends, more than the 256 a crowd’s path can hold. '
    + 'Remove some of its minor waypoints, then trace again.');
});

test.each([
  ['the leg from the fork to the branch’s first major', true, 'Fork'],
  ['a leg within the branch', false, 'Branch first'],
])('on a branch, %s of 257 bends is named by the major it leaves', async (_, opening, name) => {
  const bends = Array.from({ length: 257 }, (_, index) => ({
    id: `bend-${index}`, imgX: 0.4, imgY: 0.6, isMajor: false, branchId: 'B',
    ...(index === 0 && opening ? { branchFrom: 'fork' } : {}),
  }));
  const waypoints = opening
    ? [major('fork', 'Fork'), ...bends, major('last', 'Last', { branchId: 'B', branchRejoin: 'end' }), major('end', 'End')]
    : [major('fork', 'Fork'), major('first', 'Branch first', { branchId: 'B', branchFrom: 'fork' }), ...bends,
      major('last', 'Last', { branchId: 'B', branchRejoin: 'end' }), major('end', 'End')];
  const app = await withRoute(waypoints);

  await refused(app, app.scene.flowLayers[0], `The leg from ${name} has 257 bends, more than the 256 a crowd’s path can hold. `
    + 'Remove some of its minor waypoints, then trace again.');
});

test('a trace that would take the project’s crowds past the nodes a scene can hold is not traced', async () => {
  const full = Array.from({ length: 5 }, (_, layer) => ({
    id: `full-${layer}`,
    graph: { nodes: Array.from({ length: 2000 }, (_, index) => ({ id: `n${layer}-${index}`, x: 0.5, y: 0.5 })), edges: [] },
    emitters: [],
  }));
  const app = await withRoute([major('start', 'Main entrance'), major('end', 'Library')],
    { flowLayers: [...full, { id: 'target', graph: { nodes: [], edges: [] }, emitters: [] }] });

  await refused(app, app.scene.flowLayers[5], 'This route can’t be traced into a crowd: Scene graph-node limit is 10000.');
});

test('a trace whose node labels would take the project past its text budget is not traced', async () => {
  const app = await withRoute(Array.from({ length: 11 }, (_, index) => major(`w${index}`, 'x'.repeat(100000))));

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project text exceeds the 2 MB limit.');
});

test('a trace that would give the project more values than it can hold is not traced', async () => {
  const app = await withRoute(Array.from({ length: 1400 }, (_, index) => major(`w${index}`)));

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata is too deeply nested or complex.');
});

test('a refused trace leaves the network editor, its selection and drag, the outline, a pending save and the redo history as they were', async () => {
  const app = await withRoute(routeWithBends(257));
  const layer = app.scene.flowLayers[0];
  layer.guideType = 'graph';
  const a = layer.graph.addNode({ id: 'a' });
  const b = layer.graph.addNode({ id: 'b' });
  layer.graph.addEdge({ id: 'e', sourceId: a.id, targetId: b.id });
  app.saveUndoState();
  a.label = 'second';
  app.saveUndoState();
  app.undo();
  app.autoSave();
  app.enterNetworkEditMode();
  const editor = app.networkEditService;
  editor.selectNode(editor.layer.graph.getNode('a'));
  editor.beginNodeDrag(editor.layer.graph.getNode('a'));
  await new Promise(resolve => setTimeout(resolve, 30));
  const state = () => ({
    project: JSON.stringify(app._buildProjectSnapshot()),
    undo: app.undoService.createSnapshot(),
    editing: editor.active,
    pen: editor.penNodeId,
    selection: JSON.stringify(editor.selection),
    drag: JSON.stringify(editor.drag),
    crowd: app.selectedCrowd,
    outline: document.getElementById('scene-outline').innerHTML,
    dirty: app._isDirty,
  });
  const before = state();
  const pending = app.storageService._pendingAutoSave;
  const history = vi.spyOn(app, 'saveUndoState');
  const announce = vi.spyOn(app, 'announce');

  await refused(app, editor.layer, 'The leg from Main entrance has 257 bends, more than the 256 a crowd’s path can hold. '
    + 'Remove some of its minor waypoints, then trace again.', () => {
    expect(state()).toEqual(before);
    expect(app.storageService._pendingAutoSave).toBe(pending);
    expect(history).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });
});

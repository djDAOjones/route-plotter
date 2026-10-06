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
import { LOAD_REFUSED } from './helpers/projectSnapshot.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { LARGE, bytesOf, major, refused, reopened, trace, traced, undrawn, withBackground, withMarkerImage, withRoute } from './helpers/traceProject.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { getRetainedBackgroundDataURL, stageProjectModel } from '../src/app/persistence.js';
import { STORAGE } from '../src/config/constants.js';




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

test('a trace that would make the project too big to save as a file is not traced, and the project still saves', async () => {
  const app = await withRoute(Array.from({ length: 1000 }, (_, index) => major(`w${index}`)));
  const saves = () => app.imageAssetService.exportZip(app._buildProjectSnapshot({ includeAssets: false }));
  await expect(saves()).resolves.toBeInstanceOf(Blob);

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata exceeds the 2 MB limit.');

  await expect(saves()).resolves.toBeInstanceOf(Blob);
}, LARGE);

test('a project already too big to save as a file is not traced either, and the author is told why', async () => {
  const app = await withRoute(Array.from({ length: 1000 }, (_, index) => major(`w${index}`, `w${index} ${'x'.repeat(500)}`)));
  const saves = () => app.imageAssetService.exportZip(app._buildProjectSnapshot({ includeAssets: false }));
  await expect(saves()).rejects.toThrow('Project metadata exceeds the 2 MB limit');

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata exceeds the 2 MB limit.');
}, LARGE);

test('a trace that would take browser recovery past its budget is not traced, and recovery goes on writing the project', async () => {
  // Each name escapes to twice its length in JSON: the file is past its 2 MB
  // already, recovery (compact, 4 MB) is not, and the trace would copy every
  // name into a node's label.
  const app = await withRoute(Array.from({ length: 11 }, (_, index) => major(`w${index}`, '"'.repeat(95000))));
  const recovered = async () => {
    app.autoSave();
    app.storageService.flushAutoSave();
    const [, written] = localStorage.setItem.mock.calls.filter(([key]) => key === STORAGE.AUTOSAVE_KEY).at(-1) ?? [];
    return written ? reopened(JSON.parse(written)) : null;
  };
  expect(await recovered()).not.toBeNull();

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata exceeds the 2 MB limit.');

  app.waypoints[0].name = 'Main entrance';
  expect(await recovered()).not.toBeNull();
});

test('a project already too complex to reopen is not traced, whichever of its checks the trace would fail', async () => {
  // A name as deep as a file may make it, on a route whose waypoints, their
  // defaults filled in, are already past the project's 100,000 values: the
  // trace would add depth as well.
  let deep = 'Main entrance';
  for (let level = 0; level < 61; level += 1) deep = { text: deep };
  const app = await withRoute(Array.from({ length: 1700 }, (_, index) => major(`w${index}`, index === 0 ? deep : `w${index}`)));
  allowConsole(LOAD_REFUSED);
  expect(await reopened(app._buildProjectSnapshot())).toBeNull();

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata is too deeply nested or complex.',
    () => {}, { reopens: false });
}, LARGE);

test('a trace whose file metadata would pass 2 MB in bytes, though not in characters, is not traced, and the project still saves', async () => {
  // Each name is 65 characters but 130 bytes, and the trace copies each into a node's label.
  const app = await withRoute(Array.from({ length: 900 }, (_, index) => major(`w${index}`, 'é'.repeat(65))));
  const saves = () => app.imageAssetService.exportZip(app._buildProjectSnapshot({ includeAssets: false }));
  await expect(saves()).resolves.toBeInstanceOf(Blob);

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata exceeds the 2 MB limit.');

  await expect(saves()).resolves.toBeInstanceOf(Blob);
}, LARGE);

test('a trace into a crowd that has a network already is checked as one into an empty crowd is', async () => {
  const app = await withRoute(Array.from({ length: 1000 }, (_, index) => major(`w${index}`)));
  const layer = app.scene.flowLayers[0];
  layer.guideType = 'graph';
  layer.graph.addNode({ id: 'there-before' });

  await refused(app, layer, 'This route can’t be traced into a crowd: Project metadata exceeds the 2 MB limit.');
}, LARGE);

test('a trace that replaces a network the project could not store makes one it can: it is traced, and the project reopens', async () => {
  const app = await withRoute([major('start', 'Main entrance'), major('end', 'Library')]);
  const layer = app.scene.flowLayers[0];
  layer.guideType = 'graph';
  layer.graph.addNode({ id: 'a' });
  layer.graph.addNode({ id: 'b' });
  layer.graph.addEdge({ id: 'bent', sourceId: 'a', targetId: 'b', controlPoints: Array.from({ length: 257 }, () => ({ x: 0.3, y: 0.5 })) });
  expect(() => stageProjectModel(JSON.parse(JSON.stringify(app._buildProjectSnapshot({ includeAssets: false })))))
    .toThrow('Graph edge control-point limit is 256');

  expect(trace(app, layer).traced).toBe(true);

  expect(await reopened(app._buildProjectSnapshot())).not.toBeNull();
});

test.each([
  ['an animation setting', app => { app.animationEngine.state.speed = 10001; }],
  ['a crowd whose emitter', app => { app.scene.flowLayers[0].emitters[0].dotCount = 20001; }],
  ['an export setting', app => { app.exportSettings.frameRate = 10001; }],
])('a project with %s the loader refuses is not traced, and the recovery it had pending is written as it was', async (_, spoil) => {
  const app = await withRoute([major('start', 'Main entrance'), major('end', 'Library')]);
  app.autoSave();
  const pending = app.storageService._pendingAutoSave;
  const revision = app._editRevision;
  const network = JSON.stringify(app.scene.flowLayers[0].graph.toJSON());
  spoil(app);

  const { traced, told } = trace(app, app.scene.flowLayers[0]);

  expect(traced).toBe(false);
  expect(told).toHaveLength(1);
  expect(told[0]).toMatch(/^This route can’t be traced into a crowd: /);
  expect(JSON.stringify(app.scene.flowLayers[0].graph.toJSON())).toBe(network);
  expect([app.storageService._pendingAutoSave, app._editRevision]).toEqual([pending, revision]);
  app.storageService.flushAutoSave();
  expect(app.storageService._lastSerialized).toBe(pending.serialized);
});

test('a trace checks the file as Save Project would write it, with the background it would carry', async () => {
  const app = await withRoute(routeWithBends(3));
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const image = Object.assign(new Image(), { naturalWidth: 1, naturalHeight: 1, width: 1, height: 1 });
  vi.spyOn(app, 'loadImageFileAsset').mockResolvedValue({ base64: png, getImageElement: async () => image });
  expect(await loadBackgroundFile(app, new File(['x'], 'background.png', { type: 'image/png' }))).toBe(true);
  const saved = getRetainedBackgroundDataURL(app, 'saving the project');
  const prepared = vi.spyOn(app.imageAssetService, 'prepareArchive');

  expect(trace(app, app.scene.flowLayers[0]).traced).toBe(true);

  expect(saved).toBe(png);
  expect(prepared.mock.calls.map(([, background]) => background)).toEqual([saved]);
});

test('a major named with something other than text, as a file may name it, traces, and the project reopens', async () => {
  const app = await withRoute([major('start', { text: 'Main entrance' }), major('end', 'Library')]);

  expect(trace(app, app.scene.flowLayers[0])).toEqual({ traced: true, told: [expect.stringContaining('Traced the route into')] });

  expect(await reopened(app._buildProjectSnapshot())).not.toBeNull();
});

test('a leg of 257 bends from a major with no name is refused, as a leg of the route', async () => {
  const app = await withRoute(routeWithBends(257));
  // Opening a project names its unnamed majors; the name field can empty one.
  app.waypoints[0].name = '';

  await refused(app, app.scene.flowLayers[0], 'A leg of the route has 257 bends, more than the 256 a crowd’s path can hold. '
    + 'Remove some of its minor waypoints, then trace again.');
});

/** How many values a value holds in a file: each object, array and item. */
const valuesIn = value => 1 + (value && typeof value === 'object' ? Object.values(value).reduce((sum, each) => sum + valuesIn(each), 0) : 0);





test.each([
  ['no image', false, false],
  ['a custom image', true, false],
  ['a background', false, true],
])('a trace whose project would hold exactly its 100,000 values is traced, with %s, and its file and recovery reopen', async (_, image, background) => {
  // A name that is an array (a file may name a major so), copied into its
  // node's label, fills the project the trace would make to its budget,
  // which is the loader's and is inclusive.
  const app = await withRoute([major('start', []), major('end', 'Library')]);
  if (image) withMarkerImage(app);
  const backgroundData = background ? await withBackground(app) : null;
  const layer = app.scene.flowLayers[0];
  // Each null is two values, one in the name and one in the label the trace
  // copies it to, so an odd room is first made even by an area point on the
  // end major: three values the trace does not copy. (A project's own count
  // turned odd with CROWD-06's Hold at end, one value in its styles.)
  if ((100000 - valuesIn(traced(app, layer))) % 2) app.waypoints[1].areaHighlight.points = [{ x: 0.5, y: 0.5 }];
  app.waypoints[0].name = Array(Math.floor((100000 - valuesIn(traced(app, layer))) / 2)).fill(null);
  expect(valuesIn(traced(app, layer))).toBe(100000);
  const reopensFrom = async zip => (await undrawn()).loadProject(zip);
  expect(await reopensFrom(await app.imageAssetService.exportZip(app._buildProjectSnapshot({ includeAssets: false }), backgroundData))).toBe(true);

  expect(trace(app, layer).traced).toBe(true);
  const saved = app._buildProjectSnapshot({ includeAssets: false });
  expect(valuesIn(saved)).toBe(100000);
  expect(await reopensFrom(await app.imageAssetService.exportZip(saved, backgroundData))).toBe(true);
  app.storageService.flushAutoSave();
  expect(await reopened(JSON.parse(app.storageService._lastSerialized))).not.toBeNull();
}, LARGE);

test('a trace whose project would hold just over its values, counting what its crowds’ emitters hold, is not traced; the project was one that saves and reopens', async () => {
  // A name that is a long array (a file may name a major so), copied into its node's label: the project then
  // holds a value short of its budget but for the trace, whose emitters' values take it past.
  const app = await withRoute([major('start', []), major('end', 'Library')]);
  const layer = app.scene.flowLayers[0];
  app.waypoints[0].name = Array(Math.ceil((100001 - valuesIn(traced(app, layer))) / 2)).fill(null);
  const before = app._buildProjectSnapshot({ includeAssets: false });
  const after = traced(app, layer);
  expect(() => stageProjectModel(JSON.parse(JSON.stringify(before)))).not.toThrow();
  expect(valuesIn(after)).toBeGreaterThan(100000);
  expect(() => stageProjectModel(JSON.parse(JSON.stringify(after)))).toThrow('Project metadata is too deeply nested or complex');
  expect(bytesOf(app.imageAssetService.prepareArchive(after).projectJSON)).toBeLessThan(2 * 1024 * 1024);
  const reopensFrom = async zip => (await undrawn()).loadProject(zip);
  expect(await reopensFrom(await app.imageAssetService.exportZip(before))).toBe(true);

  await refused(app, layer, 'This route can’t be traced into a crowd: Project metadata is too deeply nested or complex.');
});


test('a trace that would give the project more values than it can hold is not traced', async () => {
  const app = await withRoute(Array.from({ length: 1400 }, (_, index) => major(`w${index}`)));

  await refused(app, app.scene.flowLayers[0], 'This route can’t be traced into a crowd: Project metadata is too deeply nested or complex.');
}, LARGE);

test.each([
  ['a leg of too many bends', routeWithBends(257), 'The leg from Main entrance has 257 bends, more than the 256 a crowd’s path can hold. '
    + 'Remove some of its minor waypoints, then trace again.'],
  ['node labels past the text budget', Array.from({ length: 11 }, (_, index) => major(`w${index}`, 'x'.repeat(100000))),
    'This route can’t be traced into a crowd: Project text exceeds the 2 MB limit.'],
])('a trace refused for %s leaves the network editor, its selection and drag, the outline, a pending save and the redo history as they were', async (_, waypoints, message) => {
  const app = await withRoute(waypoints);
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
  const revision = app._editRevision;
  const pending = app.storageService._pendingAutoSave;
  const history = vi.spyOn(app, 'saveUndoState');
  const announce = vi.spyOn(app, 'announce');

  await refused(app, editor.layer, message, () => {
    expect(state()).toEqual(before);
    expect(app._editRevision).toBe(revision);
    expect(app.storageService._pendingAutoSave).toBe(pending);
    expect(history).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });
  // The recovery the refusal found pending is written when its time comes.
  await new Promise(resolve => setTimeout(resolve, STORAGE.AUTOSAVE_INTERVAL + 100));
  expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE.AUTOSAVE_KEY, pending.serialized);
});

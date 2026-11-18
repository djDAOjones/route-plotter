import { afterEach, expect, test, vi } from 'vitest';
import JSZip from 'jszip';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { freezeClock } from './helpers/projectSnapshot.js';
import { incompressiblePng } from './helpers/incompressiblePng.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { Scene } from '../src/models/Scene.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';

freezeClock();
const cap = 52428800, mib = 1048576, kinds = ['entry-area', 'exit-area', 'entry-weight', 'groups'];
const area = { shape: 'rectangle', width: 0.1, height: 0.1, turn: 0 };
const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const background = app => app._autosaveBackgroundCache.dataURL;
let sharedOriginal = null;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null); });
function candidate(app, kind) {
  const data = snapshot(app), layer = data.scene.flowLayers[0];
  if (kind === 'entry-area') layer.graph.nodes[0].area = area;
  if (kind === 'exit-area') layer.graph.nodes[1].area = area;
  if (kind === 'entry-weight') layer.graph.nodes[0].entryWeight = 2.1234567890123457;
  if (kind === 'groups') layer.emitters[0].groups = true;
  data.scene = Scene.fromJSON(data.scene).toJSON(); return data;
}
async function measure(app, data) {
  const prepared = app.imageAssetService.prepareArchive(data, background(app)), zip = new JSZip();
  const folder = zip.folder('assets');
  for (const image of prepared.images) folder.file(image.filename, image.base64Data, { base64: true });
  zip.file(prepared.background.filename, prepared.background.base64Data, { base64: true });
  zip.file('project.json', prepared.projectJSON);
  return (await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })).size;
}
async function nearLimit() {
  // Explicit Node image-decoder stand-in. Browser verification must decode
  // this unchanged complete PNG/private-chunk fixture independently.
  const Base = globalThis.Image;
  vi.stubGlobal('Image', class extends Base { width = 1; height = 1; naturalWidth = 1; naturalHeight = 1; });
  const app = await blankProject(); vi.spyOn(app, 'render').mockImplementation(() => {});
  if (!sharedOriginal) {
    const { layer } = drawCrowd(app); layer.name = 'Stand 漢字🙂';
    layer.emitters[0].update({ seed: 7, dotCount: 4, lifecycleMode: 'collect' });
    for (let i = 0; i < 3; i++) {
      const id = `asset-${i}`, base64 = incompressiblePng(13 * mib, i + 17);
      app.imageAssetService.addAsset(new ImageAsset({ id, base64, name: `旗${i}🙂.png`, width: 1, height: 1,
        mimeType: 'image/png', size: 13 * mib }));
      app.waypoints.push(Waypoint.fromJSON({ id: `marker-${i}`, imgX: 0.1 + i * 0.2, imgY: 0.3,
        isMajor: true, markerStyle: 'custom', customImageAssetId: id }));
    }
    app.waypointsById.clear(); app.waypoints.forEach(w => app.waypointsById.set(w.id, w));
    const image = new Image(); app.background.image = image;
    let size = 11 * mib;
    const install = () => { app._autosaveBackgroundCache = { image, dataURL: incompressiblePng(size, 83) }; };
    install();
    const first = await measure(app, snapshot(app));
    const deltas = [];
    for (const kind of kinds) deltas.push(await measure(app, candidate(app, kind)) - first);
    const smallest = Math.min(...deltas); expect(smallest).toBeGreaterThan(2);
    const target = cap - Math.floor(smallest / 2);
    for (let pass = 0; pass < 6; pass++) {
      const bytes = await measure(app, snapshot(app));
      const changed = [];
      for (const kind of kinds) changed.push(await measure(app, candidate(app, kind)));
      if (bytes <= cap && changed.every(n => n > cap)) break;
      size += target - bytes; install();
    }
    sharedOriginal = await app.imageAssetService.exportZip(snapshot(app), background(app));
  }
  expect(sharedOriginal.size).toBeLessThanOrEqual(cap);
  expect(await app.loadProject(sharedOriginal)).toBe(true);
  expect((await app.imageAssetService.exportZip(snapshot(app), background(app))).size).toBeLessThanOrEqual(cap);
  return app;
}
async function select(app, kind) {
  const layer = app.scene.getFlowLayers()[0], node = layer.graph.getNodes()[kind === 'exit-area' ? 1 : 0];
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: kind === 'groups' ? 'emitter' : 'node',
    layerId: layer.id, emitterId: layer.emitters[0].id, nodeId: node.id });
  await settled(); return { layer, node };
}
function edit(app, kind, surface, { layer, node }) {
  let form;
  if (surface === 'outline') {
    const action = kind === 'groups' ? 'update-groups' : kind === 'entry-weight' ? 'update-entry-weight' : 'update-node-area';
    form = [...document.querySelectorAll(`form[data-outline-action="${action}"]`)]
      .find(f => f.dataset.layerId === layer.id && (kind === 'groups' || f.dataset.nodeId === node.id));
    expect(form).toBeTruthy();
    if (kind === 'groups') form.elements.groups.checked = true;
    else if (kind === 'entry-weight') form.elements.entryWeight.value = '2.1234567890123457';
    else { form.elements.shape.value = 'rectangle'; form.elements.width.value = '10'; form.elements.height.value = '10'; form.elements.turn.value = '0'; }
    for (const field of [...form.elements].filter(f => f.name && !f.disabled)) {
      field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    form.querySelector('[type="submit"]').click();
  } else if (kind === 'groups') {
    form = document.getElementById('crowd-group-form'); form.elements.groups.checked = true;
    form.elements.groups.dispatchEvent(new Event('input', { bubbles: true })); form.querySelector('[type="submit"]').click();
  } else {
    const field = kind === 'entry-weight'
      ? [...document.querySelectorAll('#network-entry-weight-rows [data-node-id]')].find(row => row.dataset.nodeId === node.id).querySelector('input')
      : document.getElementById('network-node-area-shape');
    field.focus(); field.value = kind === 'entry-weight' ? '2.1234567890123457' : 'rectangle';
    field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function focusEdit(app, kind, surface, { layer, node }) {
  if (surface === 'outline') {
    const action = kind === 'groups' ? 'update-groups' : kind === 'entry-weight' ? 'update-entry-weight' : 'update-node-area';
    const form = [...document.querySelectorAll(`form[data-outline-action="${action}"]`)]
      .find(f => f.dataset.layerId === layer.id && (kind === 'groups' || f.dataset.nodeId === node.id));
    form.querySelector('[type="submit"]').focus();
  } else if (kind === 'groups') document.getElementById('crowd-group-apply').focus();
  else if (kind === 'entry-weight') {
    [...document.querySelectorAll('#network-entry-weight-rows [data-node-id]')]
      .find(row => row.dataset.nodeId === node.id).querySelector('input').focus();
  } else document.getElementById('network-node-area-shape').focus();
}

test.each(kinds.flatMap(kind => ['card', 'outline'].map(surface => [kind, surface])))(
  '%s %s refuses a measured completed-ZIP crossing atomically; a smaller background permits two saved reopens',
  async (kind, surface) => {
    const app = await nearLimit(), proposed = candidate(app, kind);
    expect(() => stageProjectModel(proposed)).not.toThrow();
    expect(() => app.imageAssetService.prepareArchive(proposed, background(app))).not.toThrow();
    await expect(app.imageAssetService.exportZip(proposed, background(app))).rejects.toThrow('50 MB limit');
    const target = await select(app, kind);
    // Focusing a card records routePlotter_lastSection, a navigation preference.
    // The checked-edit transaction begins after that native focus gesture.
    focusEdit(app, kind, surface, target); await settled();
    app._flushPendingUndo(); app.storageService.flushAutoSave();
    const before = JSON.stringify(snapshot(app)), undo = app.undoService.createSnapshot(), saved = localStorage.setItem.mock.calls.slice();
    const flush = vi.spyOn(app, '_flushPendingUndo'), save = vi.spyOn(app, 'autoSave');
    edit(app, kind, surface, target); await settled();
    expect(JSON.stringify(snapshot(app))).toBe(before); expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(localStorage.setItem.mock.calls).toEqual(saved); expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    const reason = surface === 'outline' ? [...document.querySelectorAll('.scene-outline-error')].map(n => n.textContent).join(' ')
      : kind === 'groups' ? document.getElementById('crowd-group-error').textContent
      : kind === 'entry-weight' ? document.querySelector('.network-entry-weight-row .network-path-weight-error').textContent
      : document.getElementById('network-node-area-shape-error').textContent;
    expect(reason).toMatch(/guaranteed room.*smaller background.*fewer custom images/i);
    save.mockRestore(); flush.mockRestore();
    const small = incompressiblePng(mib, 83);
    expect(await loadBackgroundFile(app, new File([Buffer.from(small.split(',')[1], 'base64')], 'smaller.png', { type: 'image/png' }))).toBe(true);
    const retry = await select(app, kind); app._flushPendingUndo(); const beforeRetry = app.undoService.createSnapshot().undoStack.length;
    const savedRetry = vi.spyOn(app, 'autoSave'); edit(app, kind, surface, retry); await settled();
    expect(app.undoService.createSnapshot().undoStack.length).toBe(beforeRetry + 1); expect(savedRetry).toHaveBeenCalledTimes(1);
    const accepted = snapshot(app).scene, assets = app.imageAssetService.getAssets().map(a => a.toJSON());
    for (let round = 0; round < 2; round++) {
      const zip = await app.imageAssetService.exportZip(snapshot(app), background(app));
      expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(accepted);
      expect(app.imageAssetService.getAssets().map(a => a.toJSON())).toEqual(assets);
      expect(background(app)).toBe(small);
    }
  }, 300000);

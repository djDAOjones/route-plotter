import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { withBackground } from './helpers/traceProject.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { Scene } from '../src/models/Scene.js';
import { assertArchiveTextSafe } from '../src/utils/archiveText.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const formFor = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-wait-form')
  : [...document.querySelectorAll('form[data-outline-action="update-waiting"]')].find(f => f.dataset.emitterId === emitter.id);
const select = async (app, layer) => {
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: layer.emitters[0].id });
  await settled();
};
async function setup() {
  const app = await blankProject(), { layer, entry } = drawCrowd(app);
  entry.area = { shape: 'ellipse', width: 0.2, height: 0.2, turn: 17 };
  app.renderReference = { width: 1920, height: 1080 };
  layer.emitters[0].update({ lifecycleMode: 'collect' });
  await select(app, layer); app._flushPendingUndo(); return { app, layer, emitter: layer.emitters[0] };
}
function apply(form) {
  form.elements.waitAtStart.checked = true;
  form.elements.waitAtStart.dispatchEvent(new Event('input', { bubbles: true }));
  form.querySelector('[type="submit"]').click();
}
const errorText = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-wait-error').textContent
  : formFor(surface, emitter).querySelector('.scene-outline-error')?.textContent;
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['card', 'outline'])('%s metadata refusal preserves its draft/model/history and accepts a corrected project', async surface => {
  const { app, layer, emitter } = await setup();
  for (let i = 0; i < 22; i++) layer.graph.addNode({ id: `padding${i}` });
  let left = 2097152 - new TextEncoder().encode(app.imageAssetService.prepareArchive(snapshot(app)).projectJSON).length;
  for (const node of layer.graph.getNodes().filter(n => n.id.startsWith('padding'))) {
    const count = Math.min(100000, left); node.label = 'x'.repeat(count); left -= count;
  }
  expect(left).toBe(0); expect(() => stageProjectModel(snapshot(app))).not.toThrow();
  const original = await app.imageAssetService.exportZip(snapshot(app)); expect(await app.loadProject(original)).toBe(true);
  const current = app.scene.getFlowLayer(layer.id), e = current.emitters[0]; await select(app, current);
  app._flushPendingUndo(); const before = snapshot(app), undo = app.undoService.createSnapshot(), save = vi.spyOn(app, 'autoSave');
  apply(formFor(surface, e)); await settled();
  expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo); expect(save).not.toHaveBeenCalled();
  expect(errorText(surface, e)).toMatch(/metadata exceeds the 2 MB limit.*Shorten labels/);
  expect(formFor(surface, e).elements.waitAtStart.checked).toBe(true);
  current.graph.getNode('padding0').label = current.graph.getNode('padding0').label.slice(0, -100);
  apply(formFor(surface, e)); await settled(); expect(e.waitAtStart).toBe(true); expect(save).toHaveBeenCalledTimes(1);
}, 30000);

test.each(['card', 'outline'])('%s cannot drop a present background with unavailable original bytes', async surface => {
  const { app, layer, emitter } = await setup(); app.background.image = new Image(); app._autosaveBackgroundCache = null;
  const before = snapshot(app), undo = app.undoService.createSnapshot(), save = vi.spyOn(app, 'autoSave');
  apply(formFor(surface, emitter)); await settled();
  expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo); expect(save).not.toHaveBeenCalled();
  expect(errorText(surface, emitter)).toMatch(/Original background bytes are unavailable.*Reload/);
  await withBackground(app); await select(app, layer); save.mockClear();
  apply(formFor(surface, emitter)); await settled(); expect(emitter.waitAtStart).toBe(true); expect(save).toHaveBeenCalledTimes(1);
});

const treeSize = value => 1 + (value && typeof value === 'object'
  ? Object.values(value).reduce((sum, child) => sum + treeSize(child), 0) : 0);
test.each(['card', 'outline'].flatMap(surface => [false, true].map(fits => [surface, fits])))(
  '%s waiting at the real whole-project tree boundary fits=%s, with refusal correction and two saved ZIPs',
  async (surface, fits) => {
    const { app, layer } = await setup();
    app.styles.waitingTreeFixture = [];
    app.styles.waitingTreeFixture = new Array(100000 - (fits ? 1 : 0) - treeSize(snapshot(app))).fill(0);
    expect(treeSize(snapshot(app))).toBe(100000 - (fits ? 1 : 0));
    const original = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(original)).toBe(true);
    const current = app.scene.getFlowLayer(layer.id), emitter = current.emitters[0];
    await select(app, current); app._flushPendingUndo();
    const before = snapshot(app), undo = app.undoService.createSnapshot();
    const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
    apply(formFor(surface, emitter)); await settled();
    if (!fits) {
      expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
      expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
      expect(errorText(surface, emitter)).toMatch(/too many values|tree|complex|budget|limit/i);
      expect(formFor(surface, emitter).elements.waitAtStart.checked).toBe(true);
      app.styles.waitingTreeFixture.pop();
      apply(formFor(surface, emitter)); await settled();
    }
    expect(emitter.waitAtStart).toBe(true); expect(save).toHaveBeenCalledTimes(1);
    expect(treeSize(snapshot(app))).toBe(100000);
    const accepted = snapshot(app).scene;
    for (let i = 0; i < 2; i++) {
      const zip = await app.imageAssetService.exportZip(snapshot(app));
      expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(accepted);
      expect(treeSize(snapshot(app))).toBe(100000);
    }
  }, 60000);


test.each(['card', 'outline'])('%s checks the exact G-shifted UTF16 chunk before mutation, then corrects and reopens twice',
  async surface => {
  const { app, layer, emitter } = await setup();
  app.scene.addFlowLayer({ id: 'after-waiting', name: 'Tail漢字🙂', emitters: [] });
  layer.name = '';
  const proposed = () => {
    const candidate = snapshot(app);
    candidate.scene.flowLayers.find(item => item.id === layer.id).emitters[0].waitAtStart = true;
    candidate.scene = Scene.fromJSON(candidate.scene).toJSON();
    return app.imageAssetService.prepareArchive(candidate).projectJSON;
  };
  const offset = proposed().indexOf('🙂');
  layer.name = 'p'.repeat((16383 - offset % 16384 + 16384) % 16384);
  expect(proposed().indexOf('🙂') % 16384).toBe(16383);
  const originalText = app.imageAssetService.prepareArchive(snapshot(app)).projectJSON;
  expect(() => assertArchiveTextSafe(originalText)).not.toThrow();
  const original = await app.imageAssetService.exportZip(snapshot(app));
  const opened = await app.imageAssetService.importZip(original);
  expect(opened.projectData.scene.flowLayers[1].name).toBe('Tail漢字🙂');
  expect(() => stageProjectModel(opened.projectData)).not.toThrow();
  app._queueSceneOutlineRefresh(); await settled(); app._flushPendingUndo();
  const before = snapshot(app), undo = app.undoService.createSnapshot();
  const flush = vi.spyOn(app, '_flushPendingUndo'), save = vi.spyOn(app, 'autoSave');
  apply(formFor(surface, emitter)); await settled();
  expect(errorText(surface, emitter)).toMatch(/Project text cannot be saved intact/);
  expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  expect(formFor(surface, emitter).elements.waitAtStart.checked).toBe(true);
  layer.name += 'p'; apply(formFor(surface, emitter)); await settled();
  expect(emitter.waitAtStart).toBe(true); expect(save).toHaveBeenCalledTimes(1);
  const wanted = snapshot(app);
  for (let round = 0; round < 2; round++) {
    const zip = await app.imageAssetService.exportZip(snapshot(app));
    expect(await app.loadProject(zip)).toBe(true);
    expect(snapshot(app).scene).toEqual(wanted.scene); expect(snapshot(app).styles).toEqual(wanted.styles);
    expect(app.scene.getFlowLayer('after-waiting').name).toBe('Tail漢字🙂');
  }
}, 30000);

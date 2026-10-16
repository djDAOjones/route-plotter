import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { withBackground } from './helpers/traceProject.js';
import { stageProjectModel } from '../src/app/persistence.js';

const snapshot = app => app._buildProjectSnapshot({ includeAssets: false });
const formFor = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-group-form')
  : [...document.querySelectorAll('form[data-outline-action="update-groups"]')].find(f => f.dataset.emitterId === emitter.id);
const select = async (app, layer) => {
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: layer.emitters[0].id });
  await settled();
};
async function setup() {
  const app = await blankProject(), { layer } = drawCrowd(app); layer.emitters[0].update({ lifecycleMode: 'collect' });
  await select(app, layer); app._flushPendingUndo(); return { app, layer, emitter: layer.emitters[0] };
}
function apply(form) {
  form.elements.groups.checked = true;
  form.elements.groups.dispatchEvent(new Event('input', { bubbles: true }));
  form.querySelector('[type="submit"]').click();
}
const errorText = (surface, emitter) => surface === 'card' ? document.getElementById('crowd-group-error').textContent
  : formFor(surface, emitter).querySelector('.scene-outline-error')?.textContent;
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['card', 'outline'])('%s native number constraints reject invalid drafts; Cancel and corrected no-op do not save', async surface => {
  const { app, emitter } = await setup(), before = snapshot(app), undo = app.undoService.createSnapshot();
  const save = vi.spyOn(app, 'autoSave');
  for (const [key, value] of [['groupSize', '0'], ['groupSize', '5001'], ['groupSize', '1.5'],
    ['groupWidth', '-1'], ['groupWidth', '20.000000000000004'], ['groupWidth', '']]) {
    const form = formFor(surface, emitter); form.elements.groupSize.value = '4'; form.elements.groupWidth.value = '2';
    form.elements[key].value = value; form.elements[key].dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.reportValidity()).toBe(false); apply(form); await settled();
    expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo); expect(save).not.toHaveBeenCalled();
  }
  const form = formFor(surface, emitter);
  [...form.querySelectorAll('button')].find(b => b.textContent === 'Cancel edits').click();
  formFor(surface, emitter).querySelector('[type="submit"]').click(); await settled();
  expect(snapshot(app)).toEqual(before); expect(save).not.toHaveBeenCalled();
});

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
  expect(formFor(surface, e).elements.groups.checked).toBe(true);
  current.graph.getNode('padding0').label = current.graph.getNode('padding0').label.slice(0, -100);
  apply(formFor(surface, e)); await settled(); expect(e.groups).toBe(true); expect(save).toHaveBeenCalledTimes(1);
}, 30000);

test.each(['card', 'outline'])('%s cannot drop a present background with unavailable original bytes', async surface => {
  const { app, layer, emitter } = await setup(); app.background.image = new Image(); app._autosaveBackgroundCache = null;
  const before = snapshot(app), undo = app.undoService.createSnapshot(), save = vi.spyOn(app, 'autoSave');
  apply(formFor(surface, emitter)); await settled();
  expect(snapshot(app)).toEqual(before); expect(app.undoService.createSnapshot()).toEqual(undo); expect(save).not.toHaveBeenCalled();
  expect(errorText(surface, emitter)).toMatch(/Original background bytes are unavailable.*Reload/);
  await withBackground(app); await select(app, layer); save.mockClear();
  apply(formFor(surface, emitter)); await settled(); expect(emitter.groups).toBe(true); expect(save).toHaveBeenCalledTimes(1);
});

const treeSize = value => 1 + (value && typeof value === 'object'
  ? Object.values(value).reduce((sum, child) => sum + treeSize(child), 0) : 0);
test.each(['card', 'outline'].flatMap(surface => [false, true].map(fits => [surface, fits])))(
  '%s groups at the real whole-project tree boundary fits=%s, with refusal correction and two saved ZIPs',
  async (surface, fits) => {
    const { app, layer } = await setup();
    app.styles.groupTreeFixture = [];
    app.styles.groupTreeFixture = new Array(100000 - (fits ? 1 : 0) - treeSize(snapshot(app))).fill(0);
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
      expect(formFor(surface, emitter).elements.groups.checked).toBe(true);
      app.styles.groupTreeFixture.pop();
      apply(formFor(surface, emitter)); await settled();
    }
    expect(emitter.groups).toBe(true); expect(save).toHaveBeenCalledTimes(1);
    expect(treeSize(snapshot(app))).toBe(100000);
    const accepted = snapshot(app).scene;
    for (let i = 0; i < 2; i++) {
      const zip = await app.imageAssetService.exportZip(snapshot(app));
      expect(await app.loadProject(zip)).toBe(true); expect(snapshot(app).scene).toEqual(accepted);
      expect(treeSize(snapshot(app))).toBe(100000);
    }
  }, 60000);

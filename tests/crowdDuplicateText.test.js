import { afterEach, expect, test, vi } from 'vitest';
import { createCrowdCopy } from '../src/utils/crowdCopy.js';
import { freezeClock } from './helpers/projectSnapshot.js';
import { settled } from './helpers/noRouteScene.js';
import { setupCopy, snapshot, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

freezeClock();
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
const text = '🙂';
function proposed(app) {
  const project = snapshot(app), layers = project.scene.flowLayers;
  const ids = [...app.waypoints.map(w => w.id), ...app.imageAssetService.getAssetIds(),
    ...layers.flatMap(layer => [layer.id, ...layer.emitters.map(e => e.id),
      ...layer.graph.nodes.map(n => n.id), ...layer.graph.edges.map(e => e.id)])];
  layers.splice(2, 0, createCrowdCopy(layers[1], ids));
  return project;
}
const capture = app => ({ project: snapshot(app), history: app.undoService.createSnapshot(),
  selected: app.selectedCrowd, scope: app._sceneOutlineSelectionKey, saved: localStorage.setItem.mock.calls.slice() });

test.each(['layers', 'outline'])('%s preserves Unicode at a real ZIP text-chunk crossing and retries after renaming',
  async surface => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const app = await setupCopy(); app.styles.zipPadding = ''; app.styles.zipUnicode = text;
    const encode = data => app.imageAssetService.prepareArchive(data).projectJSON;
    const initial = encode(proposed(app)).indexOf(text);
    expect(initial).toBeGreaterThan(0);
    app.styles.zipPadding = 'a'.repeat((16383 - initial % 16384 + 16384) % 16384);
    expect(encode(proposed(app)).indexOf(text) % 16384).toBe(16383);
    expect(encode(snapshot(app)).indexOf(text) % 16384).not.toBe(16383);
    const original = await app.imageAssetService.exportZip(snapshot(app));
    expect((await app.imageAssetService.importZip(original)).projectData.styles.zipUnicode).toBe(text);
    expect(await app.loadProject(original)).toBe(true);
    expect(app.styles.zipUnicode).toBe(text);
    app.eventBus.emit('crowd:selected', app.scene.getFlowLayer('source'));
    await settled(); app.storageService.flushAutoSave();
    const candidate = proposed(app); expect(encode(candidate).indexOf(text) % 16384).toBe(16383);
    // The action-specific text guard leaves the exporter unchanged: establish the real corruption witness.
    const badZip = await app.imageAssetService.exportZip(candidate);
    let restored = null, failure = null;
    try { restored = (await app.imageAssetService.importZip(badZip)).projectData.styles.zipUnicode; }
    catch (error) { failure = error.message; }
    expect(Boolean(failure) || restored !== text).toBe(true);
    const before = capture(app), source = app.selectedCrowd, sourceJSON = source.toJSON();
    const save = vi.spyOn(app, 'autoSave'), undo = vi.spyOn(app, 'saveUndoState');
    const flush = vi.spyOn(app, '_flushPendingUndo');
    await pressCopy(app, surface, source);
    let afterText = null;
    try {
      const afterZip = await app.imageAssetService.exportZip(snapshot(app));
      afterText = (await app.imageAssetService.importZip(afterZip)).projectData.styles.zipUnicode;
    } catch { /* A loader refusal also fails the exact restored-text assertion below. */ }
    expect(afterText).toBe(text);
    expect(capture(app)).toEqual(before); expect(source.toJSON()).toEqual(sourceJSON);
    expect(save).not.toHaveBeenCalled(); expect(undo).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('Project text cannot be saved intact');
    const button = surface === 'layers' ? layerButton(app, source) : container.querySelector('[type=submit]');
    expect(button.getAttribute('aria-describedby').split(/\s+/).every(id => document.getElementById(id))).toBe(true);
    const rename = document.querySelector('form[data-outline-action="update-crowd"][data-layer-id="source"]');
    expect(rename).toBeTruthy(); rename.elements.name.value = source.name + 'x';
    rename.elements.name.dispatchEvent(new Event('input', { bubbles: true }));
    rename.querySelector('[type=submit]').click(); await settled(); app.storageService.flushAutoSave();
    expect(source.name).toBe('Standx'); save.mockClear(); undo.mockClear(); flush.mockClear();
    expect(encode(proposed(app)).indexOf(text) % 16384).not.toBe(16383);
    await pressCopy(app, surface, source);
    expect(app.scene.getFlowLayers()).toHaveLength(4); expect(save).toHaveBeenCalledOnce();
    expect(undo).toHaveBeenCalledOnce(); expect(flush).toHaveBeenCalledOnce();
    const accepted = snapshot(app).scene;
    for (let i = 0; i < 2; i++) {
      const zip = await app.imageAssetService.exportZip(snapshot(app));
      expect(await app.loadProject(zip)).toBe(true); expect(app.styles.zipUnicode).toBe(text);
      expect(snapshot(app).scene).toEqual(accepted);
    }
  });

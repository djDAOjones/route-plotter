import { afterEach, expect, test, vi } from 'vitest';
import { settled } from './helpers/noRouteScene.js';
import { snapshot, setupCopy, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const cases = ['time', 'value'].flatMap(kind => ['layers', 'outline'].flatMap(surface =>
  ['before', 'during'].flatMap(when => ['30', ''].map(value => [kind, surface, when, value]))));
test.each(cases)('%s busyness draft in %s %s (%s) survives checked copy refusal',
  async (kind, surface, when, value) => {
    const app = await setupCopy(), source = app.selectedCrowd, emitter = source.emitters[0];
    emitter.busynessEnvelope = [{ time: 0, value: 1, transition: 'gradual' },
      { time: 0.5, value: 0.7, transition: 'gradual' }, { time: 1, value: 1, transition: 'gradual' }];
    app._syncCrowdBusynessEditor(emitter); await settled();
    app._flushPendingUndo(); app.storageService.flushAutoSave();
    const field = document.querySelector(`[data-busyness-index="1"][data-busyness-field="${kind}"]`);
    expect(field).toBeTruthy(); expect(field.readOnly).toBe(false);
    const shown = field.value, original = source.toJSON();
    let resolve, pending;
    const exporter = vi.spyOn(app.imageAssetService, 'exportZip');
    if (when === 'during') {
      exporter.mockReturnValue(new Promise(yes => { resolve = yes; }));
      pending = pressCopy(app, surface, source); await Promise.resolve();
      expect(exporter).toHaveBeenCalledOnce();
    }
    field.value = value; field.focus();
    const before = JSON.stringify(snapshot(app)), history = app.undoService.createSnapshot();
    const save = vi.spyOn(app, 'autoSave'), undo = vi.spyOn(app, 'saveUndoState');
    const flush = vi.spyOn(app, '_flushPendingUndo');
    if (resolve) { resolve(new Blob()); await pending; }
    else await pressCopy(app, surface, source);
    expect(JSON.stringify(snapshot(app))).toBe(before); expect(source.toJSON()).toEqual(original);
    expect(app.undoService.createSnapshot()).toEqual(history); expect(app.selectedCrowd).toBe(source);
    expect(field.isConnected).toBe(true); expect(field.value).toBe(value);
    expect(save).not.toHaveBeenCalled(); expect(undo).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
    if (!resolve) expect(exporter).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('Finish editing the current crowd field');
    exporter.mockRestore(); field.value = shown;
    await pressCopy(app, surface, source);
    expect(source.toJSON()).toEqual(original); expect(app.scene.getFlowLayers()).toHaveLength(4);
    expect(app.selectedCrowd.emitters[0].busynessEnvelope).toEqual(emitter.busynessEnvelope);
    expect(save).toHaveBeenCalledOnce(); expect(undo).toHaveBeenCalledOnce(); expect(flush).toHaveBeenCalledOnce();
  });

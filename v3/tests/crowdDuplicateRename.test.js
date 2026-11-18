import { afterEach, expect, test, vi } from 'vitest';
import { settled } from './helpers/noRouteScene.js';
import { snapshot, setupCopy, pressCopy, layerButton, outlineForm } from './helpers/crowdDuplicate.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const capture = app => ({ project: snapshot(app), undo: app.undoService.createSnapshot(), selected: app.selectedCrowd,
  scope: app._sceneOutlineSelectionKey, recovery: localStorage.setItem.mock.calls.slice() });
const copyButton = (app, surface, source) => surface === 'layers'
  ? layerButton(app, source) : outlineForm(source).querySelector('[type=submit]');
const enter = input => input.dispatchEvent(new KeyboardEvent('keydown', {
  key: 'Enter', bubbles: true, cancelable: true,
}));
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test.each(['layers', 'outline'])('%s refuses an open rename without blur, source edits or a lost draft',
  async surface => {
    const app = await setupCopy(), source = app.selectedCrowd;
    app.renameCrowd(source);
    const input = document.querySelector('.layer-rename-input'); expect(input).toBeTruthy();
    input.value = 'Draft name';
    const before = capture(app), save = vi.spyOn(app, 'autoSave'), undo = vi.spyOn(app, 'saveUndoState');
    // Native activation need not move focus first (for example, an accessibility action).
    copyButton(app, surface, source).click();
    await app._crowdDuplicateJob?.promise; await settled();
    expect(capture(app)).toEqual(before); expect(input.isConnected).toBe(true);
    expect(input.value).toBe('Draft name'); expect(document.activeElement).toBe(input);
    expect(save).not.toHaveBeenCalled(); expect(undo).not.toHaveBeenCalled();
    const container = surface === 'layers' ? layerButton(app, source).closest('li') : outlineForm(source);
    expect(container.textContent).toContain('Finish renaming the crowd before duplicating');
    const button = copyButton(app, surface, source);
    expect(button.getAttribute('aria-describedby').split(/\s+/).every(id => document.getElementById(id))).toBe(true);
    enter(input); await settled();
    expect(source.name).toBe('Draft name'); expect(save).toHaveBeenCalledOnce(); expect(undo).toHaveBeenCalledOnce();
    save.mockClear(); undo.mockClear();
    await pressCopy(app, surface, source);
    expect(app.selectedCrowd.name).toBe('Draft name copy'); expect(source.name).toBe('Draft name');
    expect(save).toHaveBeenCalledOnce(); expect(undo).toHaveBeenCalledOnce();
  });

test.each(['layers', 'outline'].flatMap(surface => [false, true].map(reject => [surface, reject])))(
  '%s renaming abandons a held copy; old completion reject=%s preserves its new draft and focus',
  async (surface, reject) => {
    const app = await setupCopy(), source = app.selectedCrowd, hold = deferred();
    const exporter = vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValue(hold.promise);
    const pending = pressCopy(app, surface, source); await Promise.resolve();
    app.renameCrowd(source); await settled();
    const cancelled = app._crowdDuplicateJob === null;
    const input = document.querySelector('.layer-rename-input'); expect(input).toBeTruthy();
    input.value = 'Rename while checking';
    const before = capture(app), save = vi.spyOn(app, 'autoSave'), undo = vi.spyOn(app, 'saveUndoState');
    const announce = vi.spyOn(app, 'announce');
    if (reject) hold.reject(new Error('Old archive failed')); else hold.resolve(new Blob());
    await pending; await settled();
    expect(cancelled).toBe(true); expect(capture(app)).toEqual(before);
    expect(input.isConnected).toBe(true); expect(input.value).toBe('Rename while checking');
    expect(document.activeElement).toBe(input); expect(save).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled(); expect(announce).not.toHaveBeenCalled();
    expect(layerButton(app, source).disabled).toBe(false);
    expect(outlineForm(source).querySelector('[type=submit]').disabled).toBe(false);
    exporter.mockRestore(); enter(input); await settled();
    expect(source.name).toBe('Rename while checking'); expect(save).toHaveBeenCalledOnce();
    expect(undo).toHaveBeenCalledOnce(); save.mockClear(); undo.mockClear();
    await pressCopy(app, surface, source);
    expect(app.selectedCrowd.name).toBe('Rename while checking copy');
    expect(save).toHaveBeenCalledOnce(); expect(undo).toHaveBeenCalledOnce();
  });

test.each(['layers', 'outline'])('%s old rename-cancelled cleanup cannot clear a newer same-project copy',
  async surface => {
    const app = await setupCopy(), source = app.selectedCrowd, first = deferred(), second = deferred();
    vi.spyOn(app.imageAssetService, 'exportZip').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const older = pressCopy(app, surface, source); await Promise.resolve();
    app.renameCrowd(source); const cancelled = app._crowdDuplicateJob === null;
    if (!cancelled) {
      // Settle the deliberately invalid old job before the red assertion; never leave a held promise behind.
      first.resolve(new Blob()); await older; expect(cancelled).toBe(true);
    }
    const input = document.querySelector('.layer-rename-input'); input.value = 'New name'; enter(input);
    await settled();
    const newer = pressCopy(app, surface, source); await Promise.resolve();
    const job = app._crowdDuplicateJob, before = capture(app);
    first.resolve(new Blob()); await older;
    expect(app._crowdDuplicateJob).toBe(job); expect(capture(app)).toEqual(before);
    expect(layerButton(app, source).disabled).toBe(true);
    second.resolve(new Blob()); await newer;
    expect(app.scene.getFlowLayers()).toHaveLength(4); expect(app.selectedCrowd.name).toBe('New name copy');
  });

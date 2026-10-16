import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { CANDIDATE_KEYS } from './helpers/keyDomain.js';

const running = [];
afterEach(() => {
  for (const app of running.splice(0)) app.interactionHandler.destroy();
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
});

// TST-13: trusted browser defaults are separate; this sweeps the new local key handler.
test.each([false, true])('the waiting card takes only Escape, once and held=%s, across all 392 keys', async repeat => {
  const app = await blankProject(), { layer, entry } = drawCrowd(app);
  running.push(app);
  entry.area = { shape: 'rectangle', width: 0.2, height: 0.2, turn: 0 };
  layer.emitters[0].update({ lifecycleMode: 'collect' });
  app.syncCrowdEditor();
  await settled();
  app._flushPendingUndo();
  app.storageService.flushAutoSave();
  // The page dispatcher has its own full-domain sweeps; this isolates the card listener.
  app.interactionHandler.setEnabled(false);
  const form = document.getElementById('crowd-wait-form'), field = form.elements.waitAtStart;
  const read = () => JSON.stringify({ project: app._buildProjectSnapshot({ includeAssets: false }),
    undo: app.undoService.createSnapshot(), selection: app.selectedCrowd.id });
  const before = read(), save = vi.spyOn(app, 'autoSave');
  const reached = [];
  const observe = event => reached.push(event.key);
  document.addEventListener('keydown', observe);
  try {
    expect(CANDIDATE_KEYS).toHaveLength(392);
    expect(field.disabled).toBe(false);
    for (const key of CANDIDATE_KEYS) {
      field.checked = true;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.focus();
      reached.length = 0;
      const event = new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
      field.dispatchEvent(event);
      expect(read(), key).toBe(before);
      expect(save, key).not.toHaveBeenCalled();
      if (key === 'Escape') {
        expect(event.defaultPrevented, key).toBe(true);
        expect(reached, key).toEqual([]);
        expect(field.checked, key).toBe(false);
        expect(document.activeElement, key).toBe(form.querySelector('[type="submit"]'));
      } else {
        expect(event.defaultPrevented, key).toBe(false);
        expect(reached, key).toEqual([key]);
        expect(field.checked, key).toBe(true);
        expect(document.activeElement, key).toBe(field);
      }
    }
  } finally {
    document.removeEventListener('keydown', observe);
  }
});

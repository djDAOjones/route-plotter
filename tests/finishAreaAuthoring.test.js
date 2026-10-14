import { afterEach, describe, expect, test, vi } from 'vitest';
import { blankProject, byId, drawCrowd, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';

afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
const field = key => byId(`network-node-area-${key}`);
const stored = app => app.scene.getFlowLayers()[0].graph.getNodes()[1];
const history = app => app.undoService.createSnapshot().undoStack.length;
function select(app) {
  const layer = app.scene.getFlowLayers()[0];
  app.eventBus.emit('scene-outline:command', {
    action: 'select', kind: 'node', layerId: layer.id, nodeId: stored(app).id,
  });
}
function change(control, value) {
  control.focus(); control.value = String(value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
async function setup() {
  const app = await blankProject(), { layer } = drawCrowd(app);
  layer.emitters[0].update({ lifecycleMode: 'collect', dotCount: 20, dotSize: 1, speed: 0.1 });
  app.renderReference = { width: 1000, height: 1000 };
  select(app); app._flushPendingUndo(); await settled();
  return app;
}
function formFor(app) {
  return [...document.querySelectorAll('form[data-outline-action="update-node-area"]')]
    .find(f => f.dataset.nodeId === stored(app).id);
}

describe('finish areas through real controls', () => {
  test.each(['rectangle', 'ellipse'])('%s: min/mid/max, ZIP, recovery, None and undo in both surfaces', async shape => {
    const app = await setup();
    expect(field('card').hidden).toBe(false);
    expect(field('shape').disabled).toBe(false);
    expect(field('card').querySelector('.section-header').textContent).toContain('Finish area');
    expect(field('card').querySelector('.param-hint-trigger').getAttribute('aria-label')).toBe('Help: Finish area');
    for (const surface of ['card', 'outline']) for (const [width, height, turn] of
      [[1, 1, -180], [23.125, 47.5, 32.25], [80, 80, 180]]) {
      const before = history(app);
      if (surface === 'card') {
        change(field('shape'), shape); change(field('width'), width); change(field('height'), height);
        change(field('turn'), turn);
        expect(document.activeElement).toBe(field('turn'));
      } else {
        const form = formFor(app);
        expect(form.textContent).toContain('Finish area');
        for (const [key, value] of Object.entries({ shape, width, height, turn })) change(form.elements[key], value);
        form.querySelector('[type="submit"]').click(); await settled();
        expect(history(app)).toBe(before + 1);
      }
      const want = { shape, width: width / 100, height: height / 100, turn };
      expect(stored(app).area).toEqual(want);
      const data = app._buildProjectSnapshot(), zip = await app.imageAssetService.exportZip(data);
      expect(await app.loadProject(new File([zip], 'finish.zip', { type: 'application/zip' }))).toBe(true);
      expect(stored(app).area).toEqual(want);
      expect(await loadCurrentSnapshot(app, app._buildProjectSnapshot())).toBe(true);
      expect(stored(app).area).toEqual(want);
      select(app); await settled();
    }
    const before = history(app);
    change(field('shape'), 'none');
    expect(stored(app).toJSON()).not.toHaveProperty('area');
    expect(history(app)).toBe(before + 1);
    app.undo(); expect(stored(app).area).toEqual({ shape, width: 0.8, height: 0.8, turn: 180 });
    app.redo(); expect(stored(app).toJSON()).not.toHaveProperty('area');
  });
  test('matching capacity/overflow/scale/no-image guidance; size/re-roll refresh preserves drafts', async () => {
    const app = await setup();
    change(field('shape'), 'rectangle'); await settled();
    const hint = () => field('hint').textContent;
    expect(hint()).toMatch(/9 places.*20.*repeat/i);
    expect(hint()).toMatch(/Graphics scale 1/);
    expect(hint()).toMatch(/Only Collect/);
    expect(formFor(app).textContent).toContain(hint());
    expect(field('image-hint').textContent).toMatch(/Start area and Finish area use different proportions/);
    expect(field('turn').getAttribute('aria-describedby')).toContain('network-node-area-image-hint');
    field('width').value = '35';
    app.scene.getFlowLayers()[0].emitters[0].dotSize = 4;
    app.eventBus.emit('crowd:param-changed', { journeys: false }); await settled();
    expect(hint()).toMatch(/1 place.*20.*repeat/i);
    expect(field('width').value).toBe('35');
    app._rerollCrowdPattern(); await settled();
    expect(field('width').value).toBe('35');
    expect(formFor(app).textContent).toContain(hint());
    change(field('width'), 1);
    expect(hint()).toMatch(/No whole dot fits.*node/i);
    const old = { ...stored(app).area };
    change(byId('network-node-type'), 'entry');
    expect(stored(app).area).toEqual(old);
    expect(field('card').querySelector('.section-header').textContent).toContain('Start area');
    expect(field('card').querySelector('.param-hint-trigger').getAttribute('aria-label')).toBe('Help: Start area');
    change(byId('network-node-type'), 'normal');
    expect(field('shape').disabled).toBe(true);
    expect(field('reason').textContent).toMatch(/Entry or Exit/);
    expect(field('card').querySelector('.section-header').textContent).toContain('Node area');
    expect(field('card').querySelector('.param-hint-trigger').getAttribute('aria-label')).toBe('Help: Node area');
    change(byId('network-node-type'), 'exit');
    expect(stored(app).area).toEqual(old);
    expect(field('shape').disabled).toBe(false);
  });
});

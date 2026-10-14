import { afterEach, describe, expect, test, vi } from 'vitest';
import { blankProject, byId, drawCrowd, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { allowConsole } from './helpers/consoleGuard.js';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.getItem.mockImplementation(() => null);
});

const history = app => app.undoService.createSnapshot().undoStack.length;
const field = key => byId(`network-node-area-${key}`);
const stored = app => app.scene.getFlowLayers()[0].graph.getNodes()[0];
const select = (app, layer, node) => app.eventBus.emit('scene-outline:command', {
  action: 'select', kind: 'node', layerId: layer.id, nodeId: node.id,
});
function change(control, value) {
  expect(control).not.toBeNull();
  control.focus();
  control.value = String(value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}
async function setup() {
  const app = await blankProject();
  const crowd = drawCrowd(app);
  select(app, crowd.layer, crowd.entry);
  app._flushPendingUndo();
  await settled();
  return { app, ...crowd };
}
const areaForm = () => document.querySelector('form[data-outline-action="update-node-area"]');
async function submitArea(values) {
  const form = areaForm();
  expect(form).not.toBeNull();
  for (const [key, value] of Object.entries(values)) change(form.elements[key], value);
  form.querySelector('[type="submit"]').click();
  await settled();
}

describe('start areas through both real authoring surfaces', () => {
  test.each(['rectangle', 'ellipse'])('%s: card minimum, fractional middle and maximum survive ZIP and recovery', async shape => {
    const { app, entry } = await setup();
    const initial = history(app);
    change(field('shape'), shape);
    expect(entry.area).toEqual({ shape, width: 0.1, height: 0.1, turn: 0 });
    expect(history(app)).toBe(initial + 1);
    for (const [width, height, turn] of [[1, 1, -180], [23.125, 47.5, 32.25], [80, 80, 180]]) {
      change(field('width'), width);
      change(field('height'), height);
      change(field('turn'), turn);
      const want = { shape, width: width / 100, height: height / 100, turn };
      expect(stored(app).area).toEqual(want);
      expect(document.activeElement).toBe(field('turn'));
      const data = app._buildProjectSnapshot();
      const zip = await app.imageAssetService.exportZip(data);
      expect(await app.loadProject(new File([zip], 'start-area.zip', { type: 'application/zip' }))).toBe(true);
      expect(stored(app).area).toEqual(want);
      expect(await loadCurrentSnapshot(app, app._buildProjectSnapshot())).toBe(true);
      expect(stored(app).area).toEqual(want);
      const layer = app.scene.getFlowLayers()[0];
      select(app, layer, stored(app));
    }
    const before = history(app);
    change(field('shape'), 'none');
    expect(stored(app).toJSON()).not.toHaveProperty('area');
    expect(history(app)).toBe(before + 1);
    app.undo();
    expect(stored(app).area).toEqual({ shape, width: 0.8, height: 0.8, turn: 180 });
    app.redo();
    expect(stored(app).toJSON()).not.toHaveProperty('area');
  });

  test.each(['rectangle', 'ellipse'])('%s: outline authors the same values, one undo per Apply, including None', async shape => {
    const { app } = await setup();
    for (const [width, height, turn] of [[1, 1, -180], [23.125, 47.5, 32.25], [80, 80, 180]]) {
      const before = history(app);
      await submitArea({ shape, width, height, turn });
      const want = { shape, width: width / 100, height: height / 100, turn };
      expect(stored(app).area).toEqual(want);
      expect(history(app)).toBe(before + 1);
      expect(field('shape').value).toBe(shape);
      expect(field('width').value).toBe(String(width));
      const saved = app._buildProjectSnapshot();
      expect(await loadCurrentSnapshot(app, saved)).toBe(true);
      expect(stored(app).area).toEqual(want);
      select(app, app.scene.getFlowLayers()[0], stored(app));
      await settled();
    }
    const before = history(app);
    await submitArea({ shape: 'none' });
    expect(stored(app).toJSON()).not.toHaveProperty('area');
    expect(history(app)).toBe(before + 1);
  });

  test('invalid drafts and no-ops leave model/history intact; a draft follows its original node', async () => {
    const { app, layer, entry, exit } = await setup();
    change(field('shape'), 'rectangle');
    const before = history(app);
    const original = entry.toJSON();
    for (const [key, value] of [['width', ''], ['height', 81], ['turn', -181]]) {
      change(field(key), value);
      expect(field(key).getAttribute('aria-invalid')).toBe('true');
      expect(entry.toJSON()).toEqual(original);
      expect(history(app)).toBe(before);
      change(field(key), key === 'turn' ? 0 : 10);
      expect(field(key).hasAttribute('aria-invalid')).toBe(false);
      expect(byId(`network-node-area-${key}-error`).hidden).toBe(true);
    }
    expect(history(app)).toBe(before);
    field('width').value = '42.5'; // a canvas selection need not blur a number field first
    select(app, layer, exit);
    expect(entry.area.width).toBe(0.425);
    expect(exit).not.toHaveProperty('area');
    expect(history(app)).toBe(before + 1);
    expect(byId('network-node-area-card').hidden).toBe(true);
    app.undo();
    expect(stored(app).area.width).toBe(0.1);
    // The detached object must not accept a stale draft after Undo replaces models.
    const current = stored(app);
    select(app, app.scene.getFlowLayers()[0], current);
    change(field('height'), 35);
    expect(current.area.height).toBe(0.35);
    expect(entry.area.height).toBe(0.1);
  });

  test('retained areas have Type/lifecycle explanations; pending slider edits and an area edit undo separately', async () => {
    const { app, layer, entry } = await setup();
    change(field('shape'), 'ellipse');
    change(byId('network-node-type'), 'exit');
    expect(entry.area.shape).toBe('ellipse');
    expect(field('shape').disabled).toBe(true);
    expect(byId('network-node-area-reason').textContent).toMatch(/Choose Entry in Type/);
    change(byId('network-node-type'), 'entry');
    expect(field('shape').disabled).toBe(false);
    expect(byId('network-node-area-hint').textContent).toMatch(/Respawn.*Repeat.*start at the node/);
    expect(byId('network-node-area-image-hint').textContent).toBe(
      'Add a background image to keep the area’s shape when you turn it.');
    const before = history(app);
    const oldSpeed = layer.emitters[0].speed;
    layer.emitters[0].update({ speed: 0.7 });
    app.eventBus.emit('crowd:param-changed'); // the existing debounced slider transaction
    change(field('turn'), 90);
    expect(history(app)).toBe(before + 2);
    app.undo();
    expect(stored(app).area.turn).toBe(0);
    expect(app.scene.getFlowLayers()[0].emitters[0].speed).toBe(0.7);
    app.undo();
    expect(app.scene.getFlowLayers()[0].emitters[0].speed).toBe(oldSpeed);
  });

  test('actual autosave keeps the area; malformed load is atomic', async () => {
    const { app } = await setup();
    change(field('shape'), 'ellipse');
    change(field('width'), 42.5);
    await new Promise(resolve => setTimeout(resolve, 1300));
    const records = localStorage.setItem.mock.calls.filter(([key]) => key === 'routePlotter_autosave');
    expect(records.length).toBeGreaterThan(0);
    const record = JSON.parse(records.at(-1)[1]);
    expect(record.scene.flowLayers[0].graph.nodes[0].area.width).toBe(0.425);
    const before = app._buildProjectSnapshot();
    const invalid = structuredClone(before);
    invalid.scene.flowLayers[0].graph.nodes[0].area.width = '0.3';
    allowConsole(/Autosave was not restored/);
    expect(await loadCurrentSnapshot(app, invalid)).toBe(false);
    expect(app._buildProjectSnapshot().scene).toEqual(before.scene);
  });

  test('outline preserves untouched precision, rejects invalid Apply and replaces an older card draft', async () => {
    const { app } = await setup();
    const data = app._buildProjectSnapshot();
    const exact = { shape: 'rectangle', width: 0.23456789123456789, height: 0.3456789123456789, turn: 37.123456789 };
    data.scene.flowLayers[0].graph.nodes[0].area = exact;
    expect(await loadCurrentSnapshot(app, data)).toBe(true);
    select(app, app.scene.getFlowLayers()[0], stored(app));
    await settled();
    const before = history(app);
    await submitArea({});
    expect(stored(app).area).toEqual(exact);
    expect(history(app)).toBe(before);
    await submitArea({ width: 81 });
    expect(stored(app).area).toEqual(exact);
    expect(history(app)).toBe(before);
    // Escape cancels the invalid outline draft, keeping its canonical values.
    areaForm().elements.width.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    field('width').value = '11';
    app._syncNodeAreaCard();
    expect(field('width').value).toBe('11');
    expect(stored(app).area).toEqual(exact);
    await submitArea({ width: 35 });
    expect(stored(app).area).toEqual({ ...exact, width: 0.35 });
    expect(field('width').value).toBe('35');
    change(field('width'), 35);
    expect(stored(app).area.width).toBe(0.35);
    expect(history(app)).toBe(before + 1);
  });
});

import { afterEach, describe, expect, test, vi } from 'vitest';
import { byId, settled } from './helpers/noRouteScene.js';
import { loadCurrentSnapshot } from './helpers/projectSnapshot.js';
import { withBackground } from './helpers/traceProject.js';
import { PlayerApp } from '../src/player/PlayerApp.js';
import {
  setupWeights, snapshot, history, selectedLayer, entry, selectEntry, cardField, weightForm, change, editWeight,
} from './helpers/entryWeightAuthoring.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null); });

describe('Entry weights through real native authoring surfaces', () => {
  test('accepted unusual node IDs keep distinct labelled card fields through save and reload', async () => {
    const app = await setupWeights();
    const ids = ['bad\uD800id', 'bad\uDC00id', 'bad\uFFFDid', 'bad%uD800id', 'space : % 😀'];
    selectedLayer(app).graph.fromJSON({
      nodes: [...ids.map(id => ({ id, type: 'entry', x: 0.2, y: 0.5 })),
        { id: 'end', type: 'exit', x: 0.8, y: 0.5 }],
      edges: ids.map((id, index) => ({ id: `path-${index}`, sourceId: id, targetId: 'end' })),
    });
    expect(await loadCurrentSnapshot(app, snapshot(app))).toBe(true);
    selectEntry(app); await settled();
    expect(() => app.syncNetworkCards()).not.toThrow();
    const fields = ids.map(id => cardField(selectedLayer(app).graph.getNode(id)));
    expect(new Set(fields.map(field => field.id)).size).toBe(ids.length);
    for (let index = 0; index < ids.length; index++) {
      const node = selectedLayer(app).graph.getNode(ids[index]), field = fields[index];
      expect(field.labels).toHaveLength(1);
      expect(field.labels[0].control).toBe(field);
      await editWeight(app, 'card', index + 2, node);
    }
    const scene = snapshot(app).scene;
    const zip = await app.imageAssetService.exportZip(snapshot(app), app._autosaveBackgroundCache?.dataURL);
    expect(await app.loadProject(zip)).toBe(true);
    expect(snapshot(app).scene).toEqual(scene);
    selectEntry(app); await settled();
    for (let index = 0; index < ids.length; index++) {
      expect(cardField(selectedLayer(app).graph.getNode(ids[index])).value).toBe(String(index + 2));
    }
  });

  test('Entry card element IDs cannot collide through suffixes or with the row container', async () => {
    const app = await setupWeights();
    const ids = ['rows', 'e', 'e-value', 'e-error', 'input-e', 'share-e', 'error-e'];
    selectedLayer(app).graph.fromJSON({
      nodes: [...ids.map(id => ({ id, type: 'entry', x: 0.2, y: 0.5 })),
        { id: 'end', type: 'exit', x: 0.8, y: 0.5 }],
      edges: ids.map((id, index) => ({ id: `path-${index}`, sourceId: id, targetId: 'end' })),
    });
    expect(await loadCurrentSnapshot(app, snapshot(app))).toBe(true);
    selectEntry(app); await settled();
    const assertLinks = () => {
      const elements = [...byId('network-entry-weights').querySelectorAll('[id]')];
      expect(new Set(elements.map(element => element.id)).size).toBe(elements.length);
      for (const id of ids) {
        const field = cardField(selectedLayer(app).graph.getNode(id));
        const row = field.closest('[data-node-id]'), output = row.querySelector('output');
        expect(field.labels).toHaveLength(1);
        expect(field.labels[0].control).toBe(field);
        expect(byId(field.id)).toBe(field);
        expect(byId(output.id)).toBe(output);
        expect(output.getAttribute('for')).toBe(field.id);
        expect(field.getAttribute('aria-describedby').split(/\s+/).every(key => byId(key))).toBe(true);
      }
    };
    assertLinks();
    const node = selectedLayer(app).graph.getNode('e');
    await editWeight(app, 'card', 0, node);
    const field = cardField(node), error = field.closest('[data-node-id]').querySelector('.network-path-weight-error');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(byId(error.id)).toBe(error);
    expect(field.getAttribute('aria-describedby').split(/\s+/)).toContain(error.id);
    await editWeight(app, 'card', 3, node);
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    const scene = snapshot(app).scene;
    expect(await app.loadProject(await app.imageAssetService.exportZip(snapshot(app)))).toBe(true);
    expect(snapshot(app).scene).toEqual(scene);
    selectEntry(app); await settled(); assertLinks();
  });

  test.each(['card', 'outline'])('%s min/mid/MAX/precision: one undo, autosave, ZIP and recovery', async surface => {
    const app = await setupWeights();
    for (const value of [0.01, 2.75, Number.MAX_VALUE, 0.010000000000000002, 1]) {
      const before = history(app), saving = vi.spyOn(app, 'autoSave');
      await editWeight(app, surface, value);
      expect(entry(app).entryWeight ?? 1).toBe(value);
      expect(history(app)).toBe(before + 1);
      expect(saving).toHaveBeenCalledOnce(); saving.mockRestore();
      expect(cardField(entry(app)).value).toBe(String(value));
      expect(weightForm(entry(app)).elements.entryWeight.value).toBe(String(value));
      expect(cardField(entry(app)).min).toBe('0.01');
      expect(cardField(entry(app)).max).toBe(String(Number.MAX_VALUE));
      expect(cardField(entry(app)).step).toBe('any');
      expect(cardField(entry(app)).validity.valid).toBe(true);
      const saved = snapshot(app), zip = await app.imageAssetService.exportZip(saved);
      expect(await app.loadProject(zip)).toBe(true);
      expect(entry(app).entryWeight ?? 1).toBe(value);
      expect(await loadCurrentSnapshot(app, snapshot(app))).toBe(true);
      expect(entry(app).entryWeight ?? 1).toBe(value);
      selectEntry(app); await settled();
    }
    expect(entry(app).toJSON()).not.toHaveProperty('entryWeight');
    await editWeight(app, surface, 3);
    app.undo(); expect(entry(app).entryWeight ?? 1).toBe(1);
    app.redo(); expect(entry(app).entryWeight).toBe(3);
  });

  test('all Entry rows show the same shares as the outline, including a single100% Entry', async () => {
    const app = await setupWeights();
    await editWeight(app, 'card', 3);
    expect([...byId('network-entry-weight-rows').querySelectorAll('output')].map(el => el.textContent))
      .toEqual(['75%', '25%']);
    expect(weightForm(entry(app)).textContent).toContain('75%');
    expect(byId('network-entry-weights-help').textContent).toMatch(/Very small weights may never be chosen/);
    selectedLayer(app).graph.getNode('second-entry').type = 'normal';
    app.eventBus.emit('network:changed', { commit: true }); await settled();
    expect(byId('network-entry-weights').hidden).toBe(false);
    expect(byId('network-entry-weight-rows').querySelector('output').textContent).toBe('100%');
    change(byId('network-node-type'), 'normal'); await settled();
    expect(entry(app)).toBeUndefined();
    const retained = selectedLayer(app).graph.getNodes()[0];
    expect(retained.entryWeight).toBe(3);
    expect(weightForm(retained).textContent).toMatch(/Choose Entry/);
    expect(weightForm(retained).elements.entryWeight.disabled).toBe(true);
    change(byId('network-node-type'), 'entry'); await settled();
    expect(cardField(entry(app)).value).toBe('3');
  });

  test('card invalid drafts persist and correction to unchanged valid value clears without mutation', async () => {
    const app = await setupWeights(), node = entry(app), field = cardField(node);
    const before = JSON.stringify(snapshot(app)), undo = app.undoService.createSnapshot();
    const save = vi.spyOn(app, 'autoSave'), flush = vi.spyOn(app, '_flushPendingUndo');
    for (const value of ['', 0, -2, '1e309']) {
      change(field, value);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      const described = field.getAttribute('aria-describedby').split(/\s+/).map(id => byId(id)?.textContent).join(' ');
      expect(described).toMatch(/finite.*0\.01/i);
      const draft = field.value;
      app.syncNetworkCards(); await settled();
      expect(cardField(node).value).toBe(draft);
      expect(JSON.stringify(snapshot(app))).toBe(before);
      expect(app.undoService.createSnapshot()).toEqual(undo);
      change(field, 1);
      expect(field.hasAttribute('aria-invalid')).toBe(false);
    }
    expect(save).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
  });

  test('unrelated refresh keeps each draft; another surface supersedes it without an extra edit', async () => {
    const app = await setupWeights(), node = entry(app);
    const card = cardField(node);
    card.value = '12.345'; card.dispatchEvent(new Event('input', { bubbles: true }));
    app.syncNetworkCards(); await settled();
    expect(cardField(node).value).toBe('12.345');
    const before = history(app);
    await editWeight(app, 'outline', 7);
    expect(node.entryWeight).toBe(7); expect(history(app)).toBe(before + 1);
    expect(cardField(node).value).toBe('7');
    let form = weightForm(node);
    change(form.elements.entryWeight, 19);
    app._refreshSceneOutline();
    form = weightForm(node); expect(form.elements.entryWeight.value).toBe('19');
    await editWeight(app, 'card', 5);
    expect(weightForm(node).elements.entryWeight.value).toBe('5');
    expect(node.entryWeight).toBe(5);
  });

  test('same-id replacement, Undo and Type changes cannot submit a stale weight', async () => {
    const app = await setupWeights();
    await editWeight(app, 'card', 3);
    const oldNode = entry(app), oldField = cardField(oldNode), oldForm = weightForm(oldNode);
    change(oldForm.elements.entryWeight, 9);
    oldField.value = '12'; oldField.dispatchEvent(new Event('input', { bubbles: true }));
    // Replacement retains exact ids and values, so value-only draft contexts cannot detect it.
    selectedLayer(app).graph.fromJSON(selectedLayer(app).graph.toJSON());
    app.syncNetworkCards(); app._refreshSceneOutline();
    selectEntry(app); await settled();
    expect(entry(app)).not.toBe(oldNode);
    expect(cardField(entry(app)).value).toBe('3');
    expect(weightForm(entry(app)).elements.entryWeight.value).toBe('3');
    oldField.dispatchEvent(new Event('change', { bubbles: true }));
    oldForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(entry(app).entryWeight).toBe(3);
    change(weightForm(entry(app)).elements.entryWeight, 17);
    app.undo(); selectEntry(app); await settled();
    expect(entry(app).entryWeight ?? 1).toBe(1);
    expect(weightForm(entry(app)).elements.entryWeight.value).toBe('1');
    change(weightForm(entry(app)).elements.entryWeight, 13);
    change(byId('network-node-type'), 'normal');
    change(byId('network-node-type'), 'entry'); await settled();
    expect(weightForm(entry(app)).elements.entryWeight.value).toBe('1');
  });

  test('outline invalid numbers keep linked errors; unchanged correction has no undo or save', async () => {
    const app = await setupWeights(), node = entry(app), before = history(app);
    const save = vi.spyOn(app, 'autoSave');
    for (const value of ['', '0', '-1', '1e309']) {
      await editWeight(app, 'outline', value);
      const field = weightForm(node).elements.entryWeight;
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(weightForm(node).textContent).toMatch(/finite number from 0.01/);
      expect(node.entryWeight).toBeUndefined();
      await editWeight(app, 'outline', 1);
      expect(weightForm(node).elements.entryWeight.hasAttribute('aria-invalid')).toBe(false);
    }
    expect(history(app)).toBe(before); expect(save).not.toHaveBeenCalled();
  });

  test('Follow route disables Entry weight with a reason and restores the retained value', async () => {
    const app = await setupWeights();
    await editWeight(app, 'card', 3);
    const stale = { ...weightForm(entry(app)).dataset, action: 'update-entry-weight', entryWeight: '14' };
    change(weightForm(entry(app)).elements.entryWeight, 14);
    change(byId('crowd-guide-type'), 'route'); await settled();
    const form = weightForm(entry(app)), field = form.elements.entryWeight;
    expect(field.disabled).toBe(true);
    expect(form.querySelector('[type="submit"]').disabled).toBe(true);
    expect(field.value).toBe('3');
    expect(form.textContent).toContain('Entry weight inactive');
    expect(field.getAttribute('aria-describedby').split(/\s+/).map(id => byId(id)?.textContent).join(' '))
      .toContain('Choose Custom network in Guide');
    expect(byId('node-scope').hidden).toBe(true);
    expect(entry(app).entryWeight).toBe(3);
    change(byId('crowd-guide-type'), 'graph'); await settled();
    expect(weightForm(entry(app)).elements.entryWeight.disabled).toBe(false);
    expect(weightForm(entry(app)).elements.entryWeight.value).toBe('3');
    expect(weightForm(entry(app)).textContent).toContain('75%');
    const before = history(app);
    app.eventBus.emit('scene-outline:command', stale);
    expect(entry(app).entryWeight).toBe(3);
    expect(history(app)).toBe(before);
  });

  test.each(['card edit', 'Guide change', 'Type change', 'same-id replacement'])(
    '%s clears an obsolete outline error while unrelated refresh preserves the invalid draft', async transition => {
      const app = await setupWeights(), node = entry(app);
      await editWeight(app, 'outline', 0);
      app._refreshSceneOutline(); await settled();
      expect(weightForm(node).elements.entryWeight.value).toBe('0');
      expect(weightForm(node).elements.entryWeight.getAttribute('aria-invalid')).toBe('true');
      expect(weightForm(node).querySelector('.scene-outline-error').textContent).toContain('Invalid Entry weight');
      if (transition === 'card edit') await editWeight(app, 'card', 3);
      else if (transition === 'Guide change') change(byId('crowd-guide-type'), 'route');
      else if (transition === 'Type change') change(byId('network-node-type'), 'normal');
      else {
        selectedLayer(app).graph.fromJSON(selectedLayer(app).graph.toJSON());
        app.syncNetworkCards(); app._refreshSceneOutline();
      }
      await settled();
      const assertCurrent = () => {
        const form = weightForm(node), field = form.elements.entryWeight;
        expect(field.value).toBe(transition === 'card edit' ? '3' : '1');
        expect(field.hasAttribute('aria-invalid')).toBe(false);
        expect(form.querySelector('.scene-outline-error')).toBeNull();
        expect(field.getAttribute('aria-describedby').split(/\s+/).every(id => byId(id))).toBe(true);
      };
      if (transition === 'Type change') {
        expect(weightForm(node)).toBeUndefined();
        change(byId('network-node-type'), 'entry'); await settled();
      }
      assertCurrent();
      if (transition === 'Guide change') change(byId('crowd-guide-type'), 'graph');
      await settled(); assertCurrent();
    }
  );

  test('an outline command from before a same-id replacement or accepted card edit is refused', async () => {
    const app = await setupWeights(), node = entry(app);
    const stale = { ...weightForm(node).dataset, action: 'update-entry-weight', entryWeight: '11' };
    selectedLayer(app).graph.fromJSON(selectedLayer(app).graph.toJSON());
    const errors = vi.fn(); app.eventBus.on('scene-outline:error', errors);
    const before = history(app);
    app.eventBus.emit('scene-outline:command', stale);
    expect(entry(app).entryWeight).toBeUndefined();
    expect(history(app)).toBe(before);
    expect(errors.mock.calls[0][0].message).toMatch(/Entry changed/);
    app.syncNetworkCards(); app._refreshSceneOutline();
    const prior = { ...weightForm(entry(app)).dataset, action: 'update-entry-weight', entryWeight: '13' };
    await editWeight(app, 'card', 3);
    app.eventBus.emit('scene-outline:command', prior);
    expect(entry(app).entryWeight).toBe(3);
    expect(history(app)).toBe(before + 1);
  });

  test('unchanged paused card and outline refreshes request no animation frames', async () => {
    const app = await setupWeights();
    await editWeight(app, 'card', 4); await settled();
    for (let i = 0; i < 30 && (app.animationEngine.animationFrameId != null || app._renderRafId); i++) await settled();
    expect(app.animationEngine.animationFrameId).toBeNull();
    const stacks = [], native = globalThis.requestAnimationFrame;
    const request = vi.fn(callback => {
      stacks.push(new Error().stack); return native(callback);
    });
    vi.stubGlobal('requestAnimationFrame', request);
    for (let i = 0; i < 20; i++) { app.syncNetworkCards(); app._refreshSceneOutline(); }
    await settled();
    expect(request, stacks.join('\n')).not.toHaveBeenCalled();
  });

  test('HTML export retains precise weights and PlayerApp reproduces editor dots', async () => {
    const app = await setupWeights(); await withBackground(app);
    await editWeight(app, 'card', 0.010000000000000002);
    const other = selectedLayer(app).graph.getNode('second-entry');
    await editWeight(app, 'card', 4, other);
    const exportHTML = vi.spyOn(app.htmlExportService, 'exportHTML');
    // jsdom serves no bundle. Exercise the real document generator with an inert
    // bundle slot, then the current imported PlayerApp; actual bundle playback is a browser check.
    vi.spyOn(app.htmlExportService, '_fetchPlayerBundle').mockResolvedValue('/* player fixture */');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await app.exportHTML();
    expect(exportHTML).toHaveBeenCalledOnce();
    const blob = await exportHTML.mock.results[0].value;
    const html = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject;
      reader.readAsText(blob);
    });
    const data = JSON.parse(html.match(/window\.__ROUTE_PLOTTER_PROJECT__ = (.*);/)[1]);
    expect(data.scene.flowLayers[0].graph.nodes.map(node => node.entryWeight)).toEqual([
      0.010000000000000002, undefined, 4,
    ]);
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const player = new PlayerApp(canvas); await player.load(data, app.background.image);
    const dotsAt = (host, ms) => {
      const evaluate = vi.spyOn(host.swarmEngine, 'evaluate');
      try {
        host.animationEngine.seekToTime(ms); host.render();
        return evaluate.mock.results.flatMap(result => result.value)
          .map(({ x, y, emitterId, dotIndex }) => ({ x, y, emitterId, dotIndex }));
      } finally { evaluate.mockRestore(); }
    };
    for (const time of [0, 250, 5000, 2000, 10000]) expect(dotsAt(player, time)).toEqual(dotsAt(app, time));
    player.animationEngine.stop();
  });
});

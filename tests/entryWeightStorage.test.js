/** Full candidate limits, with ZIP-normalized fixtures and a second save after reopening. */
import { afterEach, expect, test, vi } from 'vitest';
import { Waypoint } from '../src/models/Waypoint.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { withBackground, withMarkerImage } from './helpers/traceProject.js';
import { settled } from './helpers/noRouteScene.js';
import { freezeClock } from './helpers/projectSnapshot.js';
import {
  setupWeights, snapshot, history, selectedLayer, entry, selectEntry, cardField, weightForm, editWeight,
} from './helpers/entryWeightAuthoring.js';

freezeClock();

const bytes = text => new TextEncoder().encode(text).length;
const treeSize = value => 1 + (value && typeof value === 'object'
  ? Object.values(value).reduce((sum, child) => sum + treeSize(child), 0) : 0);
const backgroundFor = app => app._autosaveBackgroundCache?.image === app.background?.image
  ? app._autosaveBackgroundCache?.dataURL : null;
const archive = app => app.imageAssetService.prepareArchive(snapshot(app), backgroundFor(app));
async function reopen(app) {
  const zip = await app.imageAssetService.exportZip(snapshot(app), backgroundFor(app));
  expect(await app.loadProject(zip)).toBe(true);
}
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.getItem.mockImplementation(() => null);
});

async function setup(budget, fits, assets) {
  // The actual PNG fixtures decode to1x1, not the general harness's100x100.
  const ImageBase = globalThis.Image;
  vi.stubGlobal('Image', class extends ImageBase {
    width = 1; height = 1; naturalWidth = 1; naturalHeight = 1;
  });
  const app = await setupWeights();
  vi.spyOn(app, 'render').mockImplementation(() => {});
  if (assets) {
    app.waypoints = [Waypoint.fromJSON({ id: 'image', imgX: 0.5, imgY: 0.5, isMajor: true })];
    withMarkerImage(app); await withBackground(app);
  }
  for (let i = 0; i < 23; i++) selectedLayer(app).graph.addNode({ id: `padding${i}` });
  // Establish the real save/load defaults and image metadata before measuring either budget.
  await reopen(app);
  const normalized = archive(app).projectJSON;
  await reopen(app);
  expect(archive(app).projectJSON).toBe(normalized);
  const candidate = JSON.parse(normalized);
  candidate.scene.flowLayers[0].graph.nodes[0].entryWeight = 2;
  const delta = bytes(JSON.stringify(candidate, null, 2)) - bytes(normalized);
  if (budget === 'tree') {
    app.styles.entryWeightFixture = [];
    app.styles.entryWeightFixture = new Array(100000 - (fits ? 1 : 0) - treeSize(snapshot(app))).fill(0);
    expect(treeSize(snapshot(app))).toBe(100000 - (fits ? 1 : 0));
  } else {
    let remaining = 2097152 - (fits ? delta : 0) - bytes(archive(app).projectJSON);
    for (const node of selectedLayer(app).graph.getNodes().filter(node => node.id.startsWith('padding'))) {
      const count = Math.min(100000, remaining);
      node.label = 'x'.repeat(count); remaining -= count;
    }
    expect(remaining).toBe(0);
    expect(bytes(archive(app).projectJSON)).toBe(2097152 - (fits ? delta : 0));
  }
  expect(() => stageProjectModel(JSON.parse(JSON.stringify(snapshot(app))))).not.toThrow();
  expect(() => archive(app)).not.toThrow();
  const padded = archive(app).projectJSON;
  await reopen(app);
  expect(archive(app).projectJSON).toBe(padded);
  selectEntry(app); app._flushPendingUndo(); await settled();
  return app;
}

test.each(['card', 'outline'].flatMap(surface => ['tree', 'archive'].map(budget => [surface, budget])))(
  '%s refuses a weight at the exact %s limit before mutation, history or autosave', async (surface, budget) => {
    const app = await setup(budget, false, budget === 'archive');
    const before = JSON.stringify(snapshot(app)), undo = app.undoService.createSnapshot();
    const selection = { ...app.networkEditService.selection }, saved = localStorage.getItem('routePlotter_autosave');
    const flush = vi.spyOn(app, '_flushPendingUndo'), save = vi.spyOn(app, 'autoSave');
    await editWeight(app, surface, 2);
    expect(JSON.stringify(snapshot(app))).toBe(before);
    expect(app.undoService.createSnapshot()).toEqual(undo);
    expect(app.networkEditService.selection).toEqual(selection);
    expect(localStorage.getItem('routePlotter_autosave')).toBe(saved);
    expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    const field = surface === 'card' ? cardField(entry(app)) : weightForm(entry(app)).elements.entryWeight;
    expect(field.value).toBe('2');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const description = field.getAttribute('aria-describedby').split(/\s+/)
      .map(id => document.getElementById(id)?.textContent).join(' ');
    expect(description).toMatch(budget === 'tree' ? /too deeply nested or complex/ : /metadata exceeds the 2 MB limit/);
    await editWeight(app, surface, 1);
    const corrected = surface === 'card' ? cardField(entry(app)) : weightForm(entry(app)).elements.entryWeight;
    expect(corrected.hasAttribute('aria-invalid')).toBe(false);
    expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    expect(() => archive(app)).not.toThrow();
  }, 30000
);

test.each(['card', 'outline'].flatMap(surface => ['tree', 'archive'].map(budget => [surface, budget])))(
  '%s exact %s acceptance saves, reopens, saves again and omits default1', async (surface, budget) => {
    const app = await setup(budget, true, budget === 'archive'), before = history(app);
    await editWeight(app, surface, 2);
    expect(entry(app).entryWeight).toBe(2); expect(history(app)).toBe(before + 1);
    expect(budget === 'tree' ? treeSize(snapshot(app)) : bytes(archive(app).projectJSON))
      .toBe(budget === 'tree' ? 100000 : 2097152);
    const accepted = archive(app).projectJSON;
    await reopen(app);
    expect(entry(app).entryWeight).toBe(2);
    expect(archive(app).projectJSON).toBe(accepted);
    await reopen(app); // The actual second ZIP save and second load, not only prepareArchive.
    expect(entry(app).entryWeight).toBe(2);
    expect(archive(app).projectJSON).toBe(accepted);
    selectEntry(app); await settled();
    await editWeight(app, surface, 1);
    expect(entry(app).toJSON()).not.toHaveProperty('entryWeight');
    await reopen(app);
    expect(entry(app).toJSON()).not.toHaveProperty('entryWeight');
  }, 30000
);

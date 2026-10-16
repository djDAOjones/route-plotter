import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { withBackground, withMarkerImage } from './helpers/traceProject.js';
import { Waypoint } from '../src/models/Waypoint.js';
import { stageProjectModel } from '../src/app/persistence.js';
import { Scene } from '../src/models/Scene.js';
import { assertArchiveTextSafe } from '../src/utils/archiveText.js';

const area = { shape: 'ellipse', width: 0.12345678901234567, height: 0.2, turn: 17 };
const snap = app => app._buildProjectSnapshot({ includeAssets: false });
const cases = ['entry-area', 'exit-area', 'entry-weight'];
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });
async function setup() {
  const app = await blankProject(), fixture = drawCrowd(app);
  app.networkEditService.bindForInspection(fixture.layer);
  app.networkEditService.selectNode(fixture.entry);
  fixture.exit.label = '漢字🙂';
  app._flushPendingUndo(); await settled();
  return { app, ...fixture };
}
function edit(kind, { app, layer, entry, exit }) {
  return kind === 'entry-weight' ? app._setNodeEntryWeight(layer, entry, 2.1234567890123457)
    : app._setNodeArea(layer, kind === 'entry-area' ? entry : exit, area);
}

test.each(cases)('%s uses exact canonical prepared JSON, including retained original background and asset manifest', async kind => {
  const f = await setup(), { app } = f;
  app.waypoints = [Waypoint.createMajor(0.3, 0.4)]; withMarkerImage(app); const background = await withBackground(app);
  const beforeWaypoints = JSON.stringify(snap(app).waypoints);
  const bound = vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound');
  expect(edit(kind, f)).toBe(true);
  expect(bound).toHaveBeenCalledTimes(1);
  const [candidate, bg] = bound.mock.calls[0], checked = bound.mock.results[0].value;
  expect(bg).toBe(background);
  expect(candidate.scene).toEqual(Scene.fromJSON(candidate.scene).toJSON());
  expect(checked.projectJSON).toBe(app.imageAssetService.prepareArchive(snap(app), background).projectJSON);
  expect(JSON.stringify(snap(app).waypoints)).toBe(beforeWaypoints);
  expect(() => stageProjectModel(candidate)).not.toThrow();
});

test.each(cases)('%s bound refusal preserves model/history/recovery before undo flush and gives the image correction', async kind => {
  const f = await setup(), { app } = f;
  const before = JSON.stringify(snap(app)), undo = app.undoService.createSnapshot(), saved = localStorage.getItem('routePlotter_autosave');
  const flush = vi.spyOn(app, '_flushPendingUndo'), save = vi.spyOn(app, 'autoSave');
  vi.spyOn(app.imageAssetService, 'assertArchiveFitsByBound').mockImplementation(() => {
    throw new Error('Project edits need guaranteed room in the saved ZIP. Use a smaller background or fewer custom images, then try again.');
  });
  expect(() => edit(kind, f)).toThrow(/guaranteed room.*smaller background.*fewer custom images/i);
  try { edit(kind, f); } catch (error) { expect(error.message).not.toContain('Shorten labels'); }
  expect(JSON.stringify(snap(app))).toBe(before); expect(app.undoService.createSnapshot()).toEqual(undo);
  expect(localStorage.getItem('routePlotter_autosave')).toBe(saved); expect(flush).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});

test.each(cases)('%s cannot omit a present background whose retained bytes are missing', async kind => {
  const f = await setup(), { app } = f; app.background.image = new Image(); app._autosaveBackgroundCache = null;
  const before = JSON.stringify(snap(app)), flush = vi.spyOn(app, '_flushPendingUndo');
  expect(() => edit(kind, f)).toThrow(/Original background bytes are unavailable.*Reload/);
  expect(JSON.stringify(snap(app))).toBe(before); expect(flush).not.toHaveBeenCalled();
});

test.each(['entry-area', 'entry-weight'])('%s checks the exact canonical prepared Unicode boundary before accepting', async kind => {
  const f = await setup(), { app, layer, entry } = f;
  // Pad a first node label; an edit on that node shifts the last node's emoji.
  entry.label = '';
  const proposed = () => {
    const candidate = snap(app), target = candidate.scene.flowLayers.find(l => l.id === layer.id).graph.nodes[0];
    if (kind === 'entry-area') target.area = area; else target.entryWeight = 2.1234567890123457;
    candidate.scene = Scene.fromJSON(candidate.scene).toJSON();
    return app.imageAssetService.prepareArchive(candidate).projectJSON;
  };
  const offset = proposed().indexOf('🙂'); entry.label = 'p'.repeat((16383 - offset % 16384 + 16384) % 16384);
  expect(proposed().indexOf('🙂') % 16384).toBe(16383);
  expect(() => assertArchiveTextSafe(app.imageAssetService.prepareArchive(snap(app)).projectJSON)).not.toThrow();
  const before = JSON.stringify(snap(app)), flush = vi.spyOn(app, '_flushPendingUndo');
  expect(() => edit(kind, f)).toThrow('Project text cannot be saved intact');
  expect(JSON.stringify(snap(app))).toBe(before); expect(flush).not.toHaveBeenCalled();
  entry.label += 'p'; expect(edit(kind, f)).toBe(true);
});

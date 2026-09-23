/**
 * DEF-23 — a shared export carries only what the project uses.
 *
 * The image store keeps every image that undo history can still reach, and
 * `assetPruning.test.js` pins that retention as correct: undo must be able to
 * put a replaced image back. But the store is not the project. A project file
 * or an HTML export built from the store shipped a replaced image to whoever
 * received it, and the HTML page also carried the original filenames.
 *
 * The owner's policy (§20 Q4, accepted 2026-09-22): filter both exports to the
 * images the project references, and keep filenames in project files only.
 */

import JSZip from 'jszip';
import { describe, test, expect } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { buildExampleProjects } from '../src/examples/index.js';
import { loadExampleBackground } from '../src/app/backgroundLoading.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function makeAsset(id, name) {
  const { byteLength } = ImageAsset.inspectDataURL(PIXEL_PNG);
  const asset = new ImageAsset({
    id, name, base64: PIXEL_PNG, width: 1, height: 1, mimeType: 'image/png', size: byteLength,
  });
  asset._imageElement = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
  return asset;
}

/**
 * A booted two-waypoint project whose first waypoint's custom image was
 * replaced: `current` and the custom path head `head` are what the project
 * uses, and `replaced` survives in the store only because undo history can
 * still reach it. Two kinds of reference, so a filter that knew only one of
 * them would fail here.
 */
async function projectWithAReplacedImage() {
  const example = buildExampleProjects().find(each => each.id === 'uon-open-day');
  const app = await bootApp();
  await app.ready;
  expect(await loadSnapshot(app, {
    coordVersion: 9,
    waypoints: [
      { id: 'wp-a', imgX: 0.2, imgY: 0.5, isMajor: true },
      { id: 'wp-b', imgX: 0.8, imgY: 0.5, isMajor: true },
    ],
  })).toBe(true);
  expect(await loadExampleBackground(app, `./${example.backgroundSource}`, { autoSave: false })).toBe(true);
  // The duration rebuild after a load is debounced; an HTML export refuses a
  // zero-length timeline, so settle it now.
  app.invalidateAnimationTiming();
  expect(app.animationEngine.state.duration).toBeGreaterThan(0);

  const [first] = app.waypoints;
  app.imageAssetService.addAsset(makeAsset('replaced', 'holiday-photo.png'));
  first.customImageAssetId = 'replaced';
  app.saveUndoState();
  app.imageAssetService.addAsset(makeAsset('current', 'campus-logo.png'));
  first.customImageAssetId = 'current';
  app.imageAssetService.addAsset(makeAsset('head', 'arrow-art.png'));
  app.styles.pathHead = { ...app.styles.pathHead, style: 'custom', imageAssetId: 'head' };
  app.saveUndoState();

  // The retention is real: undo can still reach the replaced image.
  expect(app.imageAssetService.getAssetIds().sort()).toEqual(['current', 'head', 'replaced']);
  return app;
}

describe('a shared export carries only what the project uses (DEF-23)', () => {

  test('a project file carries the images the project uses, with their filenames', async () => {
    const app = await projectWithAReplacedImage();
    let saved = null;
    app.imageAssetService.downloadZip = blob => { saved = blob; };

    await app.saveProject();
    expect(saved).not.toBeNull();
    const zip = await JSZip.loadAsync(await saved.arrayBuffer());
    const project = JSON.parse(await zip.file('project.json').async('string'));

    // Was both images: the store, not the project, decided what shipped.
    expect(Object.keys(zip.files).filter(path => path.startsWith('assets/') && !zip.files[path].dir))
      .toEqual(['assets/current.png', 'assets/head.png']);
    expect(project.assetManifest.map(entry => [entry.id, entry.name]))
      .toEqual([['current', 'campus-logo.png'], ['head', 'arrow-art.png']]);
  });

  test('an HTML export carries the images the project uses, and no filenames', async () => {
    const app = await projectWithAReplacedImage();
    const serveRepo = globalThis.fetch;
    globalThis.fetch = async (input) => /\/player\.js(\?|$)/.test(String(input))
      ? { ok: true, status: 200, text: async () => '/* player bundle */' }
      : serveRepo(input);
    let exported = null;
    URL.createObjectURL = blob => { exported = blob; return 'blob:test'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};

    await app.exportHTML();
    expect(exported).not.toBeNull();
    const html = await exported.text();
    const embedded = /window\.__ROUTE_PLOTTER_PROJECT__ = (.*);\n/.exec(html);
    expect(embedded).not.toBeNull();
    const project = JSON.parse(embedded[1]);

    // Was both images, each with its original filename.
    expect(project.imageAssets.map(asset => asset.id)).toEqual(['current', 'head']);
    expect(project.imageAssets.every(asset => !('name' in asset))).toBe(true);
    for (const filename of ['campus-logo.png', 'arrow-art.png', 'holiday-photo.png']) {
      expect(html).not.toContain(filename);
    }
    // What the page does use is still there, byte for byte.
    expect(project.imageAssets[0].base64).toBe(PIXEL_PNG);
    expect(project.waypoints[0].customImageAssetId).toBe('current');
    expect(project.styles.pathHead.imageAssetId).toBe('head');
  });

  test('the export services hold any caller to the same rule', async () => {
    // The app's own paths never hand the services these, but the rule belongs
    // to the export boundary rather than to its callers (Codex, DEF-23 review):
    // a snapshot built with its assets inline, and a project file's manifest.
    const app = await projectWithAReplacedImage();
    const zip = await JSZip.loadAsync(await (await app.imageAssetService.exportZip(app._buildProjectSnapshot())).arrayBuffer());
    const archived = JSON.parse(await zip.file('project.json').async('string'));
    expect(archived.imageAssets.map(asset => asset.id)).toEqual(['current', 'head']);

    const shared = app.htmlExportService._sharedProjectData({
      ...app._buildProjectSnapshot(),
      assetManifest: [{ id: 'current', filename: 'current.png', name: 'campus-logo.png' }],
    });
    expect('assetManifest' in shared).toBe(false);
    expect(JSON.stringify(shared)).not.toContain('campus-logo.png');
  });

});

/**
 * DEF-98 — a session restored from browser recovery shows every image the
 * live project references: the background (uploaded or bundled) at the same
 * fit, overlay and zoom, each waypoint's custom marker and the custom path
 * head, each with its file name, within limits no larger than a project
 * file's. An image not kept is warned of on screen, by name and why, and a
 * background that cannot come back is offered again in the banner slot.
 *
 * Each test boots the whole app over a browser the test owns
 * (`tests/helpers/recoveryHarness.js`): an in-memory image store and a
 * stateful `localStorage`, both shared across boots, so a second boot is a
 * reload. Before this item recovery kept no image at all, so every test
 * here that restores one fails on the commit before it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootApp, retireApp } from './helpers/bootApp.js';
import { allowConsole } from './helpers/consoleGuard.js';
import {
  bootWithRecovery,
  closeApp,
  decodeByHeader,
  fileOf,
  jpegDataURL,
  pngDataURL,
  recoveryEnvironment,
  recoveryRecord,
  releaseStatefulStorage,
  webpDataURL,
  writeRecovery,
} from './helpers/recoveryHarness.js';
import { loadBackgroundFile } from '../src/app/backgroundLoading.js';
import { getRetainedBackgroundDataURL } from '../src/app/persistence.js';
import { recoveryImagesIdle } from '../src/app/recoveryImages.js';
import { setRecoveryImageStoreFactory } from '../src/services/RecoveryImageStore.js';

afterEach(() => {
  setRecoveryImageStoreFactory(null);
  releaseStatefulStorage();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const UON_MAP = `data:image/png;base64,${readFileSync(join(repoRoot, 'images', 'UoN_map.png')).toString('base64')}`;
const COURT = `data:image/png;base64,${readFileSync(join(repoRoot, 'images', 'Court.png')).toString('base64')}`;

/** The words of every toast on screen. */
function toasts() {
  return [...document.querySelectorAll('#toast-container .toast')].map(toast => toast.firstChild.textContent);
}

/** The banner slot's prompt, if it shows. */
function prompt() {
  return document.getElementById('background-recovery-banner');
}

/** Two waypoints, as the author places them. */
function placeRoute(app) {
  app.eventBus.emit('waypoint:add', { imgX: 0.25, imgY: 0.5, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.75, imgY: 0.4, isMajor: true });
  app.eventBus.emit('waypoint:add', { imgX: 0.6, imgY: 0.7, isMajor: true });
}

/** Choose a file in one of the app's file inputs, as the picker does. */
function choose(input, file) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change'));
}

/** Give a waypoint a custom marker image through the Marker card, and wait for it. */
async function chooseMarker(app, index, file) {
  const waypoint = app.waypoints[index];
  app.eventBus.emit('waypoint:selected', waypoint);
  app.elements.markerStyle.value = 'custom';
  app.elements.markerStyle.dispatchEvent(new Event('change'));
  const before = waypoint.customImageAssetId;
  choose(app.elements.markerUpload, file);
  await vi.waitFor(() => expect(app.waypoints[index].customImageAssetId).not.toBe(before));
  return app.imageAssetService.getAsset(app.waypoints[index].customImageAssetId);
}

/** Give the path head a custom image through the Path head card, and wait for it. */
async function choosePathHead(app, file) {
  app.elements.pathHeadStyle.value = 'custom';
  app.elements.pathHeadStyle.dispatchEvent(new Event('change'));
  const before = app.styles.pathHead.imageAssetId;
  choose(app.elements.headUpload, file);
  await vi.waitFor(() => expect(app.styles.pathHead.imageAssetId).not.toBe(before));
  return app.imageAssetService.getAsset(app.styles.pathHead.imageAssetId);
}

/** Every key the current record names is in the store: a record never names one it does not hold. */
function expectRecordHeld(environment) {
  const manifest = recoveryRecord(environment.storage)?.recoveryImages;
  const named = [manifest?.background?.key, ...(manifest?.assets ?? []).map(asset => asset.key)].filter(Boolean);
  for (const key of named) expect(environment.backend.entries.has(key)).toBe(true);
  return named;
}

describe('browser recovery keeps every image the live project references (DEF-98)', () => {
  test('an uploaded background comes back on reload: its bytes, size and file name, its fit, overlay and zoom, and the route where it was on it', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    const campus = pngDataURL({ width: 640, height: 480, tag: 'campus' });
    expect(await loadBackgroundFile(first, fileOf(campus, 'campus-map.png'))).toBe(true);
    placeRoute(first);
    first.eventBus.emit('background:mode-change', 'fill');
    first.eventBus.emit('background:overlay-change', 30);
    first.exportSettings.backgroundZoom = 150;
    first.autoSave();
    const route = first.waypoints.map(waypoint => [waypoint.id, waypoint.imgX, waypoint.imgY]);
    await writeRecovery(first);
    expect(recoveryRecord(environment.storage).recoveryImages.background)
      .toMatchObject({ name: 'campus-map.png', mimeType: 'image/png' });
    expectRecordHeld(environment);
    expect(toasts()).toEqual([]);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(app.background.image).not.toBeNull();
    expect([app.background.image.naturalWidth, app.background.image.naturalHeight]).toEqual([640, 480]);
    expect(app._backgroundName).toBe('campus-map.png');
    expect(app.background.fit).toBe('fill');
    expect(app.background.overlay).toBe(30);
    expect(app.exportSettings.backgroundZoom).toBe(150);
    expect(app.waypoints.map(waypoint => [waypoint.id, waypoint.imgX, waypoint.imgY])).toEqual(route);
    // Exports carry the background as chosen.
    expect(getRetainedBackgroundDataURL(app)).toBe(campus);
    expect(prompt()).toBeNull();
    expect(toasts()).toEqual([]);
  });

  test('a bundled background comes back by its file name: the default map, then an Example Backgrounds image', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    expect(first._backgroundName).toBe('UoN_map.png');
    placeRoute(first);
    await writeRecovery(first);
    await closeApp(first);

    const second = await bootWithRecovery(environment);
    expect(second._backgroundName).toBe('UoN_map.png');
    expect(getRetainedBackgroundDataURL(second)).toBe(UON_MAP);
    expect(await second.loadExampleImage('images/Court.png')).toBe(true);
    await writeRecovery(second);
    await closeApp(second);

    const app = await bootWithRecovery(environment);
    expect(app._backgroundName).toBe('Court.png');
    expect(getRetainedBackgroundDataURL(app)).toBe(COURT);
    expect(app.waypoints).toHaveLength(3);
  });

  test('an example project\'s background comes back by the bundled image\'s file name, never the archive\'s', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    const serveRepository = globalThis.fetch;
    globalThis.fetch = vi.fn(input => serveRepository(String(input).replace(/^examples\//, 'docs/examples/')));
    expect(await first.loadExampleProject('parm-aerial-walk')).toBe(true);
    const bytes = getRetainedBackgroundDataURL(first);
    const route = first.waypoints.map(waypoint => [waypoint.imgX, waypoint.imgY]);
    await writeRecovery(first);
    expect(recoveryRecord(environment.storage).recoveryImages.background.name).toBe('PARM_Aerial.jpg');
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(app._backgroundName).toBe('PARM_Aerial.jpg');
    expect(getRetainedBackgroundDataURL(app)).toBe(bytes);
    expect(app.waypoints.map(waypoint => [waypoint.imgX, waypoint.imgY])).toEqual(route);
  });

  test('JPEG and WebP backgrounds come back as the bytes chosen', async () => {
    const environment = recoveryEnvironment();
    for (const [dataURL, name] of [[jpegDataURL('photo'), 'photo.jpg'], [webpDataURL('aerial'), 'aerial.webp']]) {
      const first = await bootWithRecovery(environment);
      expect(await loadBackgroundFile(first, fileOf(dataURL, name))).toBe(true);
      placeRoute(first);
      await writeRecovery(first);
      await closeApp(first);

      const app = await bootWithRecovery(environment);
      expect(app._backgroundName).toBe(name);
      expect(getRetainedBackgroundDataURL(app)).toBe(dataURL);
      app.clearAll();
      await recoveryImagesIdle(app);
      await closeApp(app);
    }
  });

  test('a custom marker and a custom path head come back custom, each at its size and with its file name', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    const marker = await chooseMarker(first, 1, fileOf(pngDataURL({ width: 32, height: 24, tag: 'flag' }), 'flag.png'));
    const head = await choosePathHead(first, fileOf(pngDataURL({ width: 20, height: 18, tag: 'drone' }), 'drone.png'));
    await writeRecovery(first);
    const manifest = recoveryRecord(environment.storage).recoveryImages;
    expect(manifest.assets.map(({ id, name }) => [id, name]).sort())
      .toEqual([[head.id, 'drone.png'], [marker.id, 'flag.png']].sort());
    expect(manifest.omitted).toEqual([]);
    expectRecordHeld(environment);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    const waypoint = app.waypoints[1];
    expect(waypoint.markerStyle).toBe('custom');
    expect(waypoint.customImageAssetId).toBe(marker.id);
    expect(waypoint.customImage).not.toBeNull();
    expect(app.styles.pathHead.style).toBe('custom');
    expect(app.styles.pathHead.imageAssetId).toBe(head.id);
    expect(app.styles.pathHead.image).not.toBeNull();
    for (const original of [marker, head]) {
      const restored = app.imageAssetService.getAsset(original.id);
      expect([restored.name, restored.width, restored.height, restored.size, restored.base64])
        .toEqual([original.name, original.width, original.height, original.size, original.base64]);
    }
    expect(toasts()).toEqual([]);
  });

  test('after the restore, Save Project\'s ZIP and the HTML export carry the images as if chosen in this visit', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    const campus = pngDataURL({ width: 300, height: 200, tag: 'export-campus' });
    await loadBackgroundFile(first, fileOf(campus, 'campus.png'));
    placeRoute(first);
    const marker = await chooseMarker(first, 0, fileOf(pngDataURL({ width: 8, height: 8, tag: 'pin' }), 'pin.png'));
    await writeRecovery(first);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    // Save Project: the ZIP it downloads opens with the same background and marker.
    let zip = null;
    vi.spyOn(app.imageAssetService, 'downloadZip').mockImplementation(blob => { zip = blob; });
    await app.saveProject();
    expect(zip).not.toBeNull();
    const reopened = await app.imageAssetService.importZip(zip);
    expect(reopened.backgroundBase64).toBe(campus);
    expect(reopened.imageAssets.map(asset => [asset.id, asset.name, asset.base64]))
      .toEqual([[marker.id, 'pin.png', marker.base64]]);
    expect(reopened.projectData.waypoints[0]).toMatchObject({ markerStyle: 'custom', customImageAssetId: marker.id });

    // The HTML export embeds the same bytes.
    vi.spyOn(app.htmlExportService, '_fetchPlayerBundle').mockResolvedValue('/* player */');
    const exported = vi.spyOn(app.htmlExportService, 'exportHTML');
    await app.exportHTML();
    expect(exported).toHaveBeenCalledTimes(1);
    const html = await (await exported.mock.results[0].value).text();
    expect(exported.mock.calls[0][0].backgroundDataURL).toBe(campus);
    expect(html).toContain(campus.split(',')[1]);
    expect(html).toContain(marker.base64.split(',')[1]);
  });
});

describe('what recovery cannot keep is warned of by name, and why (DEF-98)', () => {
  test('one image over the per-image limit and images over the total are not kept; the background first, then the path head, then the markers in waypoint order', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment({
      limits: { MAX_BYTES: 3000, MAX_BACKGROUND_BYTES: 3000, MAX_ASSET_BYTES_TOTAL: 2600 },
    });
    const first = await bootWithRecovery(environment);
    // The default map is over 3000 bytes: an upload within it replaces it.
    const background = pngDataURL({ width: 50, height: 40, tag: 'small-map', bytes: 2500 });
    await loadBackgroundFile(first, fileOf(background, 'small-map.png'));
    placeRoute(first);
    first.waypoints[0].name = 'Main gate';
    const head = await choosePathHead(first, fileOf(pngDataURL({ tag: 'head', bytes: 1200 }), 'head.png'));
    const markerA = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'a', bytes: 1200 }), 'a.png'));
    const markerB = await chooseMarker(first, 1, fileOf(pngDataURL({ tag: 'b', bytes: 900 }), 'b.png'));
    const markerC = await chooseMarker(first, 2, fileOf(pngDataURL({ tag: 'c', bytes: 3200 }), 'c.png'));
    await writeRecovery(first);

    const manifest = recoveryRecord(environment.storage).recoveryImages;
    expect(manifest.background.name).toBe('small-map.png');
    expect(manifest.assets.map(asset => asset.id).sort()).toEqual([head.id, markerA.id].sort());
    expect(manifest.omitted).toEqual([
      expect.objectContaining({ role: 'marker', name: 'b.png', reason: 'over-total', assetId: markerB.id, fallback: 'dot' }),
      expect.objectContaining({ role: 'marker', name: 'c.png', reason: 'too-large', assetId: markerC.id, fallback: 'dot' }),
    ]);
    const record = recoveryRecord(environment.storage);
    expect(record.waypoints.map(waypoint => [waypoint.markerStyle, waypoint.customImageAssetId]))
      .toEqual([['custom', markerA.id], ['dot', null], ['dot', null]]);
    expect(toasts().at(-1)).toBe(
      'Browser recovery could not keep 2 images. '
      + 'The marker image for waypoint 2, b.png, shown as a dot: the custom images together are over what browser recovery keeps. '
      + 'The marker image for waypoint 3, c.png, shown as a dot: it is over the size browser recovery keeps for one image. '
      + 'Save a project file to keep them.');
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(app.waypoints.map(waypoint => waypoint.markerStyle)).toEqual(['custom', 'dot', 'dot']);
    expect(app.styles.pathHead.style).toBe('custom');
    expect(app._backgroundName).toBe('small-map.png');
    // The restore says them again, by name.
    expect(toasts().at(-1)).toMatch(/^Browser recovery could not bring back 2 images\. .*b\.png.*c\.png.*Choose them again, or open your project file\.$/);
  });

  test('the path head is kept before a smaller marker when only one fits', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment({ limits: { MAX_ASSET_BYTES_TOTAL: 1500 } });
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    const marker = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'small', bytes: 600 }), 'small.png'));
    const head = await choosePathHead(first, fileOf(pngDataURL({ tag: 'large', bytes: 1200 }), 'large.png'));
    await writeRecovery(first);
    const manifest = recoveryRecord(environment.storage).recoveryImages;
    expect(manifest.assets.map(asset => asset.id)).toEqual([head.id]);
    expect(manifest.omitted).toEqual([expect.objectContaining({ assetId: marker.id, reason: 'over-total' })]);
    // The background, on its own budget, is kept first whatever the custom images take.
    expect(manifest.background.name).toBe('UoN_map.png');
  });

  test('a put the browser\'s storage refuses is named, with the fallback, and the restore puts no other background in', async () => {
    allowConsole(/could not store an image/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    const campus = pngDataURL({ width: 64, height: 48, tag: 'quota-campus' });
    const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    environment.backend.failWhen('put', () => quota());
    await loadBackgroundFile(first, fileOf(campus, 'campus-map.png'));
    placeRoute(first);
    await writeRecovery(first);
    const record = recoveryRecord(environment.storage);
    expect(record.recoveryImages.background).toBeNull();
    expect(record.recoveryImages.omitted).toEqual([{ role: 'background', name: 'campus-map.png', reason: 'refused' }]);
    expect(toasts().at(-1)).toBe(
      "Browser recovery could not keep the background, campus-map.png: the browser's storage refused it. "
      + 'Save a project file to keep it.');
    environment.backend.failWhen('put', null);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(app.waypoints).toHaveLength(3);
    // Neither the default map nor any other image stands in for it.
    expect(app.background.image).toBeNull();
    expect(prompt()?.textContent).toContain("campus-map.png — the browser's storage refused it.");
  });

  test('an entry lost from the browser\'s storage since is named at the restore; the rest still comes back', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    const campus = pngDataURL({ width: 64, height: 48, tag: 'lost-campus' });
    await loadBackgroundFile(first, fileOf(campus, 'campus-map.png'));
    placeRoute(first);
    const marker = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'lost-flag' }), 'flag.png'));
    const head = await choosePathHead(first, fileOf(pngDataURL({ tag: 'kept-head' }), 'head.png'));
    await writeRecovery(first);
    await closeApp(first);
    const manifest = recoveryRecord(environment.storage).recoveryImages;
    environment.backend.lose(manifest.background.key);
    environment.backend.lose(manifest.assets.find(asset => asset.id === marker.id).key);

    const announce = vi.spyOn(Object.getPrototypeOf(first), 'announce');
    const app = await bootWithRecovery(environment);
    expect(app.background.image).toBeNull();
    expect(app.waypoints[0]).toMatchObject({ markerStyle: 'dot', customImageAssetId: null });
    expect(app.styles.pathHead).toMatchObject({ style: 'custom', imageAssetId: head.id });
    // The background is offered in the slot, the marker named in a toast.
    expect(prompt().textContent).toContain("campus-map.png — it is no longer in the browser's storage.");
    expect(toasts()).toEqual([
      "Browser recovery could not bring back the marker image for waypoint 1, flag.png, shown as a dot: it is no longer in the browser's storage. "
      + 'Choose it again, or open your project file.',
    ]);
    const said = announce.mock.calls.map(([message]) => message);
    expect(said.filter(message => message.startsWith('Background not restored'))).toHaveLength(1);
    expect(said.filter(message => message.includes('flag.png'))).toHaveLength(1);
    expect(said).toContain('Previous session restored');
    // The record written after the restore still explains the loss.
    await writeRecovery(app);
    expect(recoveryRecord(environment.storage).recoveryImages.omitted.map(entry => [entry.role, entry.name, entry.reason]))
      .toEqual([['background', 'campus-map.png', 'missing'], ['marker', 'flag.png', 'missing']]);
  });

  test('a corrupt entry is isolated: a digest, a byte length or dimensions that do not match, or bytes that do not decode', async () => {
    allowConsole(/could not read an image|A recovery image could not be read/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    const assets = [];
    for (const [index, tag] of [[0, 'digest'], [1, 'length'], [2, 'dimensions']]) {
      assets.push(await chooseMarker(first, index, fileOf(pngDataURL({ width: 6, height: 6, tag }), `${tag}.png`)));
    }
    const head = await choosePathHead(first, fileOf(pngDataURL({ width: 5, height: 5, tag: 'undecodable' }), 'undecodable.png'));
    await writeRecovery(first);
    await closeApp(first);
    const keyOf = id => recoveryRecord(environment.storage).recoveryImages.assets.find(asset => asset.id === id).key;
    const entry = id => environment.backend.entries.get(keyOf(id));
    new Uint8Array(entry(assets[0].id).bytes)[40] ^= 0xFF;
    entry(assets[1].id).byteLength += 3;
    entry(assets[2].id).width = 7;
    // A PNG signature over bytes no decoder reads, its digest made true.
    const garbage = new Uint8Array(entry(head.id).bytes);
    garbage.fill(0x41, 12);
    const { nodeDigest } = await import('./helpers/recoveryHarness.js');
    const rekeyed = `sha256-${await nodeDigest(garbage)}`;
    environment.backend.entries.set(rekeyed, { ...entry(head.id), key: rekeyed });
    const record = recoveryRecord(environment.storage);
    record.recoveryImages.assets.find(asset => asset.id === head.id).key = rekeyed;
    environment.storage.set('routePlotter_autosave', JSON.stringify(record));

    const app = await bootWithRecovery(environment);
    expect(app.waypoints).toHaveLength(3);
    expect(app.waypoints.map(waypoint => waypoint.markerStyle)).toEqual(['dot', 'dot', 'dot']);
    expect(app.styles.pathHead.style).toBe('arrow');
    // The background is not among them, and still comes back.
    expect(app._backgroundName).toBe('UoN_map.png');
    const warning = toasts().at(-1);
    for (const name of ['digest.png', 'length.png', 'dimensions.png', 'undecodable.png']) {
      expect(warning).toContain(name);
    }
    expect(warning.match(/it could not be read/g)).toHaveLength(4);
  });

  test('the warning is not raised again for an unchanged omission, and is when the omission changes', async () => {
    allowConsole(/could not store an image/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    environment.backend.failWhen('put', record => (record.mimeType === 'image/png' && record.width === 9
      ? new DOMException('The quota has been exceeded.', 'QuotaExceededError') : null));
    await chooseMarker(first, 0, fileOf(pngDataURL({ width: 9, height: 9, tag: 'refused-1' }), 'one.png'));
    await writeRecovery(first);
    expect(toasts()).toHaveLength(1);
    first.eventBus.emit('waypoint:add', { imgX: 0.1, imgY: 0.1, isMajor: true });
    await writeRecovery(first);
    first.eventBus.emit('background:overlay-change', 10);
    await writeRecovery(first);
    expect(toasts()).toHaveLength(1);
    await chooseMarker(first, 1, fileOf(pngDataURL({ width: 9, height: 9, tag: 'refused-2' }), 'two.png'));
    await writeRecovery(first);
    // The newer warning says both, and the one it follows goes.
    await vi.waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()[0]).toMatch(/^Browser recovery could not keep 2 images\. .*one\.png.*two\.png/);
  });

  test('an image recovery keeps raises no warning', async () => {
    const environment = recoveryEnvironment();
    const app = await bootWithRecovery(environment);
    const announce = vi.spyOn(app, 'announce');
    placeRoute(app);
    await writeRecovery(app);
    expect(toasts()).toEqual([]);
    expect(announce.mock.calls.map(([message]) => message)
      .filter(message => /^Browser recovery (could not|excludes)/.test(message))).toEqual([]);
  });
});

describe('records from before this release (DEF-98)', () => {
  test('a record that holds image bytes restores them, and names them in the image store, so a second reload keeps them', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const source = await bootWithRecovery(environment);
    placeRoute(source);
    const marker = await chooseMarker(source, 0, fileOf(pngDataURL({ width: 12, height: 12, tag: 'legacy-flag' }), 'flag.png'));
    const legacy = {
      ...source._buildProjectSnapshot({ includeAssets: true }),
      backgroundImage: UON_MAP,
    };
    await closeApp(source);
    environment.storage.set('routePlotter_autosave', JSON.stringify(legacy));
    environment.backend.entries.clear();

    const first = await bootWithRecovery(environment);
    expect(getRetainedBackgroundDataURL(first)).toBe(UON_MAP);
    expect(first.waypoints[0]).toMatchObject({ markerStyle: 'custom', customImageAssetId: marker.id });
    await writeRecovery(first);
    const manifest = recoveryRecord(environment.storage).recoveryImages;
    expect(manifest.background).not.toBeNull();
    expect(manifest.assets.map(asset => [asset.id, asset.name])).toEqual([[marker.id, 'flag.png']]);
    expect(recoveryRecord(environment.storage)).not.toHaveProperty('backgroundImage');
    expect(JSON.stringify(recoveryRecord(environment.storage))).not.toContain(marker.base64.split(',')[1]);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(getRetainedBackgroundDataURL(app)).toBe(UON_MAP);
    expect(app.waypoints[0]).toMatchObject({ markerStyle: 'custom', customImageAssetId: marker.id });
    expect(app.imageAssetService.getAsset(marker.id).name).toBe('flag.png');
    expect(toasts()).toEqual([]);
  });

  test('a model-only record says once that recovery kept no images, offers the background, and names no file', async () => {
    const environment = recoveryEnvironment();
    const source = await bootWithRecovery(environment);
    placeRoute(source);
    const modelOnly = { ...source._buildProjectSnapshot({ includeAssets: false }), imageAssets: [] };
    await closeApp(source);
    environment.storage.set('routePlotter_autosave', JSON.stringify(modelOnly));

    const announce = vi.spyOn(Object.getPrototypeOf(source), 'announce');
    const app = await bootWithRecovery(environment);
    expect(app.waypoints).toHaveLength(3);
    expect(app.background.image).toBeNull();
    const words = 'Background not restored: recovery before this release kept no images. Choose the image this route was made on.';
    expect(prompt().querySelector('.banner-text').textContent).toBe(words);
    const said = announce.mock.calls.map(([message]) => message);
    expect(said.filter(message => message === words)).toHaveLength(1);
    expect(said.filter(message => /kept no images/.test(message))).toHaveLength(1);
    expect(toasts()).toEqual([]);
  });
});

describe('the order of writes (DEF-98)', () => {
  test('the pagehide flush with a put still in flight names only what is stored, and lists the rest as not kept: the page closed first', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const releasePut = environment.backend.pause('put');
    const marker = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'in-flight' }), 'in-flight.png'));
    first.storageService.flushAutoSave();

    const record = recoveryRecord(environment.storage);
    expect(record.recoveryImages.background.name).toBe('UoN_map.png');
    expect(record.recoveryImages.assets).toEqual([]);
    expect(record.recoveryImages.omitted).toEqual([expect.objectContaining({
      role: 'marker', name: 'in-flight.png', reason: 'pending', assetId: marker.id,
    })]);
    expect(record.waypoints[0]).toMatchObject({ markerStyle: 'dot', customImageAssetId: null });
    expectRecordHeld(environment);
    // No warning while the page lives: its put has not failed.
    expect(toasts()).toEqual([]);

    // The page lived on: once stored, the final record names it.
    releasePut();
    await recoveryImagesIdle(first);
    expect(recoveryRecord(environment.storage).recoveryImages.assets.map(asset => asset.id)).toEqual([marker.id]);
    expectRecordHeld(environment);
  });

  test('a reload after the pagehide flush says the page closed before the image was stored', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    environment.backend.pause('put');
    await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'closed' }), 'closed.png'));
    first.storageService.flushAutoSave();
    first.storageService.cancelAutoSave();
    retireApp(first);

    const app = await bootWithRecovery(environment);
    expect(app.waypoints[0].markerStyle).toBe('dot');
    expect(toasts()).toEqual([
      'Browser recovery could not bring back the marker image for waypoint 1, closed.png, shown as a dot: '
      + 'the page closed before it was stored. Choose it again, or open your project file.',
    ]);
  });

  test('an older revision whose put lands late never overwrites a newer record', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const releasePut = environment.backend.pause('put');
    await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'late' }), 'late.png'));
    // A newer revision, the marker set back to a dot, while the put waits.
    first.eventBus.emit('waypoint:selected', first.waypoints[0]);
    first.elements.markerStyle.value = 'dot';
    first.elements.markerStyle.dispatchEvent(new Event('change'));
    first.waypoints[0].customImageAssetId = null;
    first.autoSave();
    first.storageService.flushAutoSave();
    const newer = environment.storage.get('routePlotter_autosave');
    const puts = environment.backend.log.filter(entry => entry.startsWith('put ')).length;
    releasePut();
    await recoveryImagesIdle(first);
    first.storageService.flushAutoSave();
    // The older revision's put landed, after the newer record was written, and changed nothing of it.
    expect(environment.backend.log.filter(entry => entry.startsWith('put ')).length).toBe(puts + 1);
    expect(environment.storage.get('routePlotter_autosave')).toBe(newer);
    expect(recoveryRecord(environment.storage).waypoints[0].markerStyle).toBe('dot');
  });

  test('a record that cannot be written is warned of, and nothing is tidied away after it', async () => {
    allowConsole(/Failed to save to localStorage/);
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const keys = [...environment.backend.entries.keys()];
    expect(keys).toHaveLength(1);
    const write = localStorage.setItem.getMockImplementation();
    localStorage.setItem.mockImplementation((key, value) => {
      if (key === 'routePlotter_autosave') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      write(key, value);
    });
    const announce = vi.spyOn(first, 'announce');
    await first.loadExampleImage('images/Court.png');
    await writeRecovery(first);
    expect(announce.mock.calls.map(([message]) => message)).toContain('Auto-save failed. Save a project file to keep your work.');
    expect(first._status).toBe('Browser recovery failed');
    // The record still names the default map, so it stays; Court.png stays too, unnamed but not tidied.
    for (const key of keys) expect(environment.backend.entries.has(key)).toBe(true);
    expect(environment.backend.log.some(entry => entry.startsWith('delete'))).toBe(false);
  });

  test('a failed Open keeps the previous project\'s pending recovery; a successful one replaces it', async () => {
    allowConsole(/Failed to load project/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    const releasePut = environment.backend.pause('put');
    const marker = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'kept-pending' }), 'pending.png'));
    expect(await first.loadProject(new File(['not a zip'], 'broken.zip', { type: 'application/zip' }))).toBe(false);
    releasePut();
    await writeRecovery(first);
    expect(recoveryRecord(environment.storage).recoveryImages.assets.map(asset => asset.id)).toEqual([marker.id]);
  });
});

describe('Clear All (DEF-98)', () => {
  test('with a put pending, nothing returns on reload, by a late write or by undo; "Project cleared" is said once it is gone', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const releasePut = environment.backend.pause('put');
    const releaseClear = environment.backend.pause('clear');
    await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'cleared' }), 'cleared.png'));
    const announce = vi.spyOn(first, 'announce');
    first.clearAll();
    expect(environment.storage.has('routePlotter_autosave')).toBe(false);
    releasePut();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(announce.mock.calls.map(([message]) => message)).not.toContain('Project cleared');
    releaseClear();
    await recoveryImagesIdle(first);
    expect(announce.mock.calls.map(([message]) => message)).toContain('Project cleared');
    expect(environment.backend.entries.size).toBe(0);
    expect(environment.backend.log.slice(-1)).toEqual(['clear']);
    first.undo();
    expect(first.waypoints).toHaveLength(0);
    first.storageService.flushAutoSave();
    expect(environment.storage.has('routePlotter_autosave')).toBe(false);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(app.waypoints).toHaveLength(0);
    // A first visit: the default map, from the start, not from recovery.
    expect(app._backgroundName).toBe('UoN_map.png');
    expect(toasts()).toEqual([]);
  });

  test('a new project\'s writes after the clear land after it, and come back', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const releaseClear = environment.backend.pause('clear');
    first.clearAll();
    const campus = pngDataURL({ width: 30, height: 20, tag: 'after-clear' });
    const loading = loadBackgroundFile(first, fileOf(campus, 'after.png'));
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseClear();
    expect(await loading).toBe(true);
    placeRoute(first);
    await writeRecovery(first);
    const log = environment.backend.log;
    expect(log.indexOf('clear')).toBeLessThan(log.findLastIndex(entry => entry.startsWith('put ')));
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(getRetainedBackgroundDataURL(app)).toBe(campus);
    expect(app._backgroundName).toBe('after.png');
  });

  test('a clear that fails is said, never "Project cleared"', async () => {
    allowConsole(/could not remove its images/);
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    environment.backend.failWhen('clear', () => new Error('disk gone'));
    const announce = vi.spyOn(first, 'announce');
    first.clearAll();
    await recoveryImagesIdle(first);
    const said = announce.mock.calls.map(([message]) => message);
    expect(said).toContain('Project cleared, but browser recovery could not remove its images. Choose Clear all again to remove them.');
    expect(said).not.toContain('Project cleared');
  });
});

describe('what recovery tidies away, and what it never may (DEF-98)', () => {
  test('an image no record names goes after a write; one a kept record names stays; a record that cannot be read stops it', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const defaultKey = recoveryRecord(environment.storage).recoveryImages.background.key;
    // A record kept because it could not be restored (DEF-28) names it too.
    const keptRecord = JSON.stringify({ coordVersion: 9, recoveryImages: { version: 2, background: { key: defaultKey }, assets: [] } });
    environment.storage.set('routePlotter_keptAutosave:1-000001-test', keptRecord);
    await first.loadExampleImage('images/Court.png');
    await writeRecovery(first);
    expect(environment.backend.entries.has(defaultKey)).toBe(true);

    environment.storage.set('routePlotter_keptAutosave:1-000001-test', 'not a record');
    await first.loadExampleImage('images/Garlic.jpg');
    await writeRecovery(first);
    expect(environment.backend.log.some(entry => entry.startsWith('delete'))).toBe(false);

    environment.storage.delete('routePlotter_keptAutosave:1-000001-test');
    first.eventBus.emit('background:overlay-change', 5);
    await writeRecovery(first);
    const named = expectRecordHeld(environment);
    expect([...environment.backend.entries.keys()]).toEqual(named);
  });

  test('a record held because it could not be restored (DEF-28) keeps the images it names; the rest go', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const record = JSON.parse(environment.storage.get('routePlotter_autosave'));
    const defaultKey = record.recoveryImages.background.key;
    // Court.png stored at once, its record not yet written.
    await first.loadExampleImage('images/Court.png');
    first.storageService.cancelAutoSave();
    await recoveryImagesIdle(first);
    const courtKey = [...environment.backend.entries.keys()].find(key => key !== defaultKey);
    // A record naming Court.png, held in the recovery key: no write reaches it.
    const held = JSON.stringify({ ...record, recoveryImages: { ...record.recoveryImages, background: { key: courtKey } } });
    environment.storage.set('routePlotter_autosave', held);
    first.storageService._heldAutoSave = held;
    expect(first.storageService.holdState().state).toBe('held');
    const { scheduleRecoveryGarbage } = await import('../src/app/recoveryImages.js');
    await scheduleRecoveryGarbage(first);
    expect([...environment.backend.entries.keys()]).toEqual([courtKey]);
    first.storageService._heldAutoSave = null;
  });

  test('a deletion under way is drained before Clear All empties the store, and "Project cleared" waits for both', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    await first.loadExampleImage('images/Court.png');
    const releaseDelete = environment.backend.pause('delete');
    // Told when the tidy's deletion has been issued, and waits.
    const remove = environment.backend.delete;
    const issued = new Promise(resolve => {
      environment.backend.delete = key => {
        resolve();
        return remove.call(environment.backend, key);
      };
    });
    await recoveryImagesIdle(first);
    first.storageService.flushAutoSave();
    await issued;
    const announce = vi.spyOn(first, 'announce');
    first.clearAll();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(announce.mock.calls.map(([message]) => message)).not.toContain('Project cleared');
    releaseDelete();
    await recoveryImagesIdle(first);
    expect(environment.backend.log.slice(-2)).toEqual([expect.stringMatching(/^delete sha256-/), 'clear']);
    expect(announce.mock.calls.map(([message]) => message)).toContain('Project cleared');
    expect(environment.backend.entries.size).toBe(0);
    await closeApp(first);
    const app = await bootWithRecovery(environment);
    expect(app.waypoints).toHaveLength(0);
  });

  test('undo keeps its images in the asset service, and an image undo makes live again is stored again', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    const one = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'undo-one' }), 'one.png'));
    await writeRecovery(first);
    const two = await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'undo-two' }), 'two.png'));
    await writeRecovery(first);
    // The first image went from the store (no record names it), never from the asset service.
    expect(recoveryRecord(environment.storage).recoveryImages.assets.map(asset => asset.id)).toEqual([two.id]);
    expect(environment.backend.entries.size).toBe(2);
    expect(first.imageAssetService.getAsset(one.id)).not.toBeNull();

    first.undo();
    expect(first.waypoints[0].customImageAssetId).toBe(one.id);
    await writeRecovery(first);
    expect(recoveryRecord(environment.storage).recoveryImages.assets.map(asset => [asset.id, asset.name]))
      .toEqual([[one.id, 'one.png']]);
    expectRecordHeld(environment);
    await closeApp(first);

    const app = await bootWithRecovery(environment);
    expect(app.waypoints[0]).toMatchObject({ markerStyle: 'custom', customImageAssetId: one.id });
  });

  test('two writers sharing the store: a deletion never runs while another tab is publishing, and no record names an image the store has lost', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const tabA = await bootWithRecovery(environment);
    placeRoute(tabA);
    await writeRecovery(tabA);
    const keyA = recoveryRecord(environment.storage).recoveryImages.background.key;

    // Tab B opens beside it, and publishes its own background while its put waits.
    const tabB = await bootWithRecovery(environment);
    const campus = pngDataURL({ width: 40, height: 30, tag: 'tab-b' });
    const releasePut = environment.backend.pause('put');
    const loading = loadBackgroundFile(tabB, fileOf(campus, 'tab-b.png'));
    await new Promise(resolve => setTimeout(resolve, 0));
    // Tab A writes last, naming its own image only, and tidies: it must not
    // delete while B's publication holds the store, whatever A's records say.
    tabA.eventBus.emit('background:overlay-change', 20);
    tabA.storageService.flushAutoSave();
    await recoveryImagesIdle(tabA);
    expect(environment.backend.log.some(entry => entry.startsWith('delete'))).toBe(false);
    releasePut();
    expect(await loading).toBe(true);
    placeRoute(tabB);
    await writeRecovery(tabB);
    expectRecordHeld(environment);
    const keyB = recoveryRecord(environment.storage).recoveryImages.background.key;
    expect(environment.backend.entries.has(keyB)).toBe(true);

    // B's record is the one in storage now: A's image is no longer named,
    // and goes at B's tidy; A, writing again, stores it again before naming it.
    expect(environment.backend.entries.has(keyA)).toBe(false);
    tabA.storageService.flushAutoSave();
    tabA.eventBus.emit('background:overlay-change', 25);
    tabA.storageService.flushAutoSave();
    expect(recoveryRecord(environment.storage).recoveryImages.background).toBeNull();
    expectRecordHeld(environment);
    await recoveryImagesIdle(tabA);
    tabA.storageService.flushAutoSave();
    await recoveryImagesIdle(tabA);
    expect(recoveryRecord(environment.storage).recoveryImages.background.key).toBe(keyA);
    expectRecordHeld(environment);
  });
});

describe('the background prompt (DEF-98)', () => {
  /** A restore whose background is no longer in the store, with the prompt showing. */
  async function restoredWithoutBackground() {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    await loadBackgroundFile(first, fileOf(pngDataURL({ width: 20, height: 10, tag: 'gone' }), 'gone.png'));
    placeRoute(first);
    await writeRecovery(first);
    await closeApp(first);
    environment.backend.lose(recoveryRecord(environment.storage).recoveryImages.background.key);
    const announce = vi.spyOn(Object.getPrototypeOf(first), 'announce');
    const app = await bootWithRecovery(environment);
    return { app, environment, announce };
  }

  const WORDS = "Background not restored: gone.png — it is no longer in the browser's storage. Choose the image this route was made on.";

  test('it names the file and why, with two real buttons, and is announced once', async () => {
    const { app, announce } = await restoredWithoutBackground();
    const banner = prompt();
    expect(banner.querySelector('.banner-text').textContent).toBe(WORDS);
    expect([...banner.querySelectorAll('button')].map(button => [button.type, button.textContent]))
      .toEqual([['button', 'Choose image'], ['button', 'Dismiss']]);
    expect(announce.mock.calls.filter(([message]) => message === WORDS)).toHaveLength(1);
    const picker = vi.spyOn(app.elements.bgUpload, 'click').mockImplementation(() => {});
    banner.querySelector('.banner-choose-image').click();
    expect(picker).toHaveBeenCalledTimes(1);
    // It stays until a background is set.
    expect(prompt()).not.toBeNull();
    await loadBackgroundFile(app, fileOf(pngDataURL({ width: 20, height: 10, tag: 'gone' }), 'gone.png'));
    expect(prompt()).toBeNull();
  });

  test('Dismiss and Escape take it away, focus goes back, and the record stops carrying the loss once dismissed', async () => {
    const { app, environment } = await restoredWithoutBackground();
    const before = app.elements.bgUploadBtn;
    before.focus();
    prompt().querySelector('.banner-dismiss').focus();
    prompt().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(prompt()).toBeNull();
    expect(document.activeElement).toBe(before);
    await writeRecovery(app);
    expect(recoveryRecord(environment.storage).recoveryImages.omitted).toEqual([]);
  });

  test('a mode that replaces it leaves it waiting; it comes back when the mode ends, unannounced, and never takes the slot from a mode', async () => {
    const { app, announce } = await restoredWithoutBackground();
    announce.mockClear();
    // Drawing an area: a mode of its own, which claims the slot.
    app.eventBus.emit('waypoint:selected', app.waypoints[0]);
    app.areaDrawingService.startDrawing(app.waypoints[0]);
    expect(prompt()).toBeNull();
    expect(app.modeBanner.isShowing()).toBe(true);
    app.areaDrawingService.cancelDrawing();
    expect(prompt()).not.toBeNull();
    expect(announce.mock.calls.filter(([message]) => message === WORDS)).toHaveLength(0);
  });

  test('a claim the slot refuses neither shows it, nor says it, nor moves focus; it shows once the slot is free', async () => {
    const { app, announce } = await restoredWithoutBackground();
    const { offerBackgroundPrompt } = await import('../src/app/recoveryImages.js');
    const omission = { role: 'background', name: 'gone.png', reason: 'missing' };
    announce.mockClear();
    const focused = app.elements.bgUploadBtn;
    focused.focus();
    const show = vi.spyOn(app.modeBanner, 'show').mockReturnValueOnce(null);
    expect(offerBackgroundPrompt(app, omission)).toBe(false);
    expect(prompt()).toBeNull();
    expect(document.activeElement).toBe(focused);
    expect(announce.mock.calls.filter(([message]) => message === WORDS)).toHaveLength(0);
    // Another owner takes the slot and gives it up: then it shows, and is said once.
    const owner = { onReplaced: () => {} };
    show.mockRestore();
    app.modeBanner.show(owner, { id: 'other-banner', text: 'Other' });
    expect(prompt()).toBeNull();
    app.modeBanner.hide(owner);
    expect(prompt()).not.toBeNull();
    expect(announce.mock.calls.filter(([message]) => message === WORDS)).toHaveLength(1);
    expect(document.activeElement).toBe(focused);
  });
});

describe('the restore (DEF-98)', () => {
  test('a project cleared while its images are read wins: the restore commits nothing', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    await closeApp(first);

    const releaseGet = environment.backend.pause('get');
    const announce = vi.spyOn(Object.getPrototypeOf(first), 'announce');
    setRecoveryImageStoreFactory(() => environment.makeStore());
    const app = await bootApp();
    setRecoveryImageStoreFactory(null);
    await new Promise(resolve => setTimeout(resolve, 0));
    app.clearAll();
    releaseGet();
    await app.ready;
    expect(app.waypoints).toHaveLength(0);
    // Superseded, it said nothing of a restore.
    expect(announce.mock.calls.map(([message]) => message)).not.toContain('Previous session restored');
  });

  test('a commit that rolls back puts back the background\'s name and what recovery carried', async () => {
    allowConsole(/Autosave was not restored|could not restore/);
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const record = environment.storage.get('routePlotter_autosave');
    first._backgroundName = 'before.png';
    first._recoveryCarried = [{ role: 'background', name: 'earlier.png', reason: 'missing' }];
    environment.storage.set('routePlotter_autosave', record);
    let staged = null;
    vi.spyOn(first, 'updateCanvasAspectRatio').mockImplementation(() => {
      staged = [first._backgroundName, first._recoveryCarried];
      throw new Error('commit failed');
    });
    expect(await first.loadAutosave()).toBe(false);
    // The commit had put in the record's own before it failed.
    expect(staged).toEqual(['UoN_map.png', []]);
    expect(first._backgroundName).toBe('before.png');
    expect(first._recoveryCarried).toEqual([{ role: 'background', name: 'earlier.png', reason: 'missing' }]);
  });
});

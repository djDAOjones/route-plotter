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
import { ImageAsset } from '../src/models/ImageAsset.js';
import { getRetainedBackgroundDataURL } from '../src/app/persistence.js';
import { recoveryImagesIdle } from '../src/app/recoveryImages.js';
import { setRecoveryImageStoreFactory } from '../src/services/RecoveryImageStore.js';
import { loadCurrentSnapshot, loadSnapshot } from './helpers/projectSnapshot.js';

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

/**
 * Hold the first deletion the backend is asked for, and only that one; told
 * when it has been asked for.
 */
function holdFirstDeletion(backend) {
  const remove = backend.delete;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let told;
  const issued = new Promise(resolve => { told = resolve; });
  let first = true;
  backend.delete = async key => {
    if (first) {
      first = false;
      told();
      await gate;
    }
    return remove.call(backend, key);
  };
  return { issued, release };
}

/** The app's announcements, and how many images the store held as each was made. */
function sayingWhatIsStored(app, environment) {
  const real = app.announce;
  const calls = [];
  vi.spyOn(app, 'announce').mockImplementation(function announced(message, ...rest) {
    calls.push([message, environment.backend.entries.size]);
    return real.call(this, message, ...rest);
  });
  return {
    said: () => calls.map(([message]) => message),
    storedWhen: message => calls.filter(([each]) => each === message).map(([, size]) => size),
  };
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
    const releaseDelete = environment.backend.pause('delete');
    await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'cleared' }), 'cleared.png'));
    const announce = vi.spyOn(first, 'announce');
    first.clearAll();
    expect(environment.storage.has('routePlotter_autosave')).toBe(false);
    releasePut();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(announce.mock.calls.map(([message]) => message)).not.toContain('Project cleared');
    // The late put landed before the clear's deletions, which remove it too.
    const putAt = environment.backend.log.findLastIndex(entry => entry.startsWith('put '));
    releaseDelete();
    await recoveryImagesIdle(first);
    expect(announce.mock.calls.map(([message]) => message)).toContain('Project cleared');
    expect(environment.backend.entries.size).toBe(0);
    expect(environment.backend.log.slice(putAt + 1).filter(entry => entry.startsWith('delete '))).toHaveLength(2);
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
    const cleared = recoveryRecord(environment.storage).recoveryImages.background.key;
    const releaseDelete = environment.backend.pause('delete');
    first.clearAll();
    const campus = pngDataURL({ width: 30, height: 20, tag: 'after-clear' });
    const loading = loadBackgroundFile(first, fileOf(campus, 'after.png'));
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseDelete();
    expect(await loading).toBe(true);
    placeRoute(first);
    await writeRecovery(first);
    // The cleared image went; the new project's, pinned as it came, stayed.
    const kept = recoveryRecord(environment.storage).recoveryImages.background.key;
    expect(environment.backend.log).toContain(`delete ${cleared}`);
    expect(environment.backend.log).not.toContain(`delete ${kept}`);
    expect([...environment.backend.entries.keys()]).toEqual([kept]);
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
    allowConsole(/could not tidy its images/);
    environment.backend.failWhen('delete', () => new Error('disk gone'));
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
    // The tidy's deletion alone waits (Codex, code review round 2, 2: pausing
    // the clear's own as well hid that the clear did not wait for it).
    const held = holdFirstDeletion(environment.backend);
    await recoveryImagesIdle(first);
    first.storageService.flushAutoSave();
    await held.issued;
    const announce = sayingWhatIsStored(first, environment);
    first.clearAll();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(announce.said()).not.toContain('Project cleared');
    expect(environment.backend.entries.size).toBeGreaterThan(0);
    held.release();
    await recoveryImagesIdle(first);
    expect(environment.backend.entries.size).toBe(0);
    // Said once it was so.
    expect(announce.storedWhen('Project cleared')).toEqual([0]);
    await closeApp(first);
    const app = await bootWithRecovery(environment);
    expect(app.waypoints).toHaveLength(0);
  });

  test('an image-free project opened, its old image\'s deletion held, then Clear All: "Project cleared" only once that image is gone (Codex, code review round 2, 2)', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const oldKey = recoveryRecord(environment.storage).recoveryImages.background.key;
    const held = holdFirstDeletion(environment.backend);
    const archive = await first.imageAssetService.exportZip(
      { ...first._buildProjectSnapshot({ includeAssets: false }), waypoints: [] }, null);
    expect(await first.loadProject(new File([archive], 'plain.zip', { type: 'application/zip' }))).toBe(true);
    await held.issued;
    const announce = sayingWhatIsStored(first, environment);
    first.clearAll();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(announce.said()).not.toContain('Project cleared');
    expect(environment.backend.entries.has(oldKey)).toBe(true);
    held.release();
    await recoveryImagesIdle(first);
    expect(environment.backend.entries.size).toBe(0);
    expect(announce.storedWhen('Project cleared')).toEqual([0]);
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
    // delete B's image while B stores it, whatever A's records say.
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

    // B's record is the one in storage now, and names only B's image; A's,
    // still on A's canvas, is A's to keep: B's tidy leaves it (the lead's
    // pane test 9), and A's next record names it.
    expect(environment.backend.entries.has(keyA)).toBe(true);
    tabA.eventBus.emit('background:overlay-change', 25);
    tabA.storageService.flushAutoSave();
    expect(recoveryRecord(environment.storage).recoveryImages.background.key).toBe(keyA);
    expectRecordHeld(environment);
  });

  test('an image on one tab\'s canvas survives another tab\'s tidy between its saves, and its pagehide record names it (the lead\'s pane test 9)', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const tabB = await bootWithRecovery(environment);
    const campus = pngDataURL({ width: 40, height: 30, tag: 'campus' });
    await loadBackgroundFile(tabB, fileOf(campus, 'campus.png'));
    placeRoute(tabB);
    await writeRecovery(tabB);
    const campusKey = recoveryRecord(environment.storage).recoveryImages.background.key;

    // Tab A uploads nerves.jpg, writes and tidies: campus.png, on B's canvas, stays.
    const tabA = await bootWithRecovery(environment);
    await loadBackgroundFile(tabA, fileOf(jpegDataURL('nerves'), 'nerves.jpg'));
    placeRoute(tabA);
    await writeRecovery(tabA);
    const nervesKey = recoveryRecord(environment.storage).recoveryImages.background.key;
    expect(environment.backend.entries.has(campusKey)).toBe(true);

    // B saves again and tidies: nerves.jpg, on A's canvas, stays.
    tabB.eventBus.emit('background:overlay-change', 10);
    await writeRecovery(tabB);
    expect(environment.backend.entries.has(nervesKey)).toBe(true);

    // A edits and closes at once: its pagehide record names nerves.jpg, stored.
    tabA.eventBus.emit('background:overlay-change', 15);
    tabA.storageService.flushAutoSave();
    expect(recoveryRecord(environment.storage).recoveryImages).toMatchObject({
      background: { key: nervesKey, name: 'nerves.jpg' }, omitted: [],
    });
    expectRecordHeld(environment);
    tabA.storageService.cancelAutoSave();
    retireApp(tabA);
    await closeApp(tabB);

    const app = await bootWithRecovery(environment);
    expect(app._backgroundName).toBe('nerves.jpg');
    expect(getRetainedBackgroundDataURL(app)).toBe(jpegDataURL('nerves'));
  });

  test('Clear All in one tab while another publishes leaves no record naming an image it deleted, the pagehide record included (Codex, code review round 1, 1)', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const tabA = await bootWithRecovery(environment);
    placeRoute(tabA);
    await writeRecovery(tabA);
    const tabB = await bootWithRecovery(environment);
    placeRoute(tabB);
    const releasePut = environment.backend.pause('put');
    // Told when B's put has been issued, and waits: B is publishing.
    const put = environment.backend.put;
    const issued = new Promise(resolve => {
      environment.backend.put = record => {
        resolve();
        return put.call(environment.backend, record);
      };
    });
    const loading = loadBackgroundFile(tabB, fileOf(pngDataURL({ width: 22, height: 11, tag: 'b-mid-clear' }), 'b.png'));
    await issued;
    // A clears while B's put waits; B's pagehide writes what it has meanwhile.
    tabA.clearAll();
    tabB.storageService.flushAutoSave();
    expectRecordHeld(environment);
    releasePut();
    expect(await loading).toBe(true);
    await recoveryImagesIdle(tabA);
    await writeRecovery(tabB);
    await recoveryImagesIdle(tabA);
    const named = expectRecordHeld(environment);
    expect(named).toHaveLength(1);
    expect(recoveryRecord(environment.storage).recoveryImages.background.name).toBe('b.png');
    await closeApp(tabB);
    retireApp(tabA);

    const app = await bootWithRecovery(environment);
    expect(app._backgroundName).toBe('b.png');
    expect(toasts()).toEqual([]);
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
    const prototype = Object.getPrototypeOf(first);
    const real = prototype.announce;
    const calls = [];
    vi.spyOn(prototype, 'announce').mockImplementation(function announced(message, ...rest) {
      calls.push([message, environment.backend.entries.size]);
      return real.call(this, message, ...rest);
    });
    setRecoveryImageStoreFactory(() => environment.makeStore());
    const app = await bootApp();
    setRecoveryImageStoreFactory(null);
    await new Promise(resolve => setTimeout(resolve, 0));
    app.clearAll();
    releaseGet();
    await app.ready;
    expect(app.waypoints).toHaveLength(0);
    // Superseded, it said nothing of a restore, and the cleared project keeps
    // no background: no default map goes in under it (Codex, code review round 1, 5).
    expect(calls.map(([message]) => message)).not.toContain('Previous session restored');
    expect(app.background.image).toBeNull();
    expect(app._backgroundName).toBeNull();
    // The clear waited for the abandoned restore to let go of its image, then
    // removed it, and said so only then (Codex, code review round 2, 3).
    await recoveryImagesIdle(app);
    expect(environment.backend.entries.size).toBe(0);
    expect(calls.filter(([message]) => message === 'Project cleared').map(([, size]) => size)).toEqual([0]);
  });

  test('a newer Open while recovery\'s images are read wins: its project, with no background, and no default map under it', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const opened = { ...first._buildProjectSnapshot({ includeAssets: false }), waypoints: [] };
    const archive = await first.imageAssetService.exportZip(opened, null);
    await closeApp(first);

    const releaseGet = environment.backend.pause('get');
    setRecoveryImageStoreFactory(() => environment.makeStore());
    const app = await bootApp();
    setRecoveryImageStoreFactory(null);
    await new Promise(resolve => setTimeout(resolve, 0));
    const opening = app.loadProject(new File([archive], 'plain.zip', { type: 'application/zip' }));
    releaseGet();
    expect(await opening).toBe(true);
    await app.ready;
    expect(app.waypoints).toHaveLength(0);
    expect(app.background.image).toBeNull();
    expect(app._backgroundName).toBeNull();
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

describe('round 2: the code review and the lead\'s pane check (DEF-98)', () => {
  test('a Clear All whose record removal fails keeps the images that record names, and says it did not finish (Codex, code review round 1, 2)', async () => {
    allowConsole(/Failed to remove from localStorage/);
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const key = recoveryRecord(environment.storage).recoveryImages.background.key;
    const remove = localStorage.removeItem.getMockImplementation();
    localStorage.removeItem.mockImplementation(name => {
      if (name === 'routePlotter_autosave') throw new DOMException('The operation is insecure.', 'SecurityError');
      remove(name);
    });
    const announce = vi.spyOn(first, 'announce');
    first.clearAll();
    await recoveryImagesIdle(first);
    expect(environment.storage.has('routePlotter_autosave')).toBe(true);
    expect(environment.backend.entries.has(key)).toBe(true);
    expectRecordHeld(environment);
    expect(announce.mock.calls.map(([message]) => message))
      .toContain('Browser recovery could not be cleared; reload may restore old work.');
  });

  test('a Clear All keeps what a kept record whose discard fails names, and deletes nothing while a remaining record cannot be read', async () => {
    allowConsole(/Failed to remove from localStorage/);
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const key = recoveryRecord(environment.storage).recoveryImages.background.key;
    const keptKey = 'routePlotter_keptAutosave:1-000001-kept';
    environment.storage.set(keptKey, JSON.stringify({
      coordVersion: 9, recoveryImages: { version: 2, background: { key }, assets: [], omitted: [] },
    }));
    const remove = localStorage.removeItem.getMockImplementation();
    localStorage.removeItem.mockImplementation(name => {
      if (name.startsWith('routePlotter_keptAutosave:')) throw new DOMException('The operation is insecure.', 'SecurityError');
      remove(name);
    });
    const announce = vi.spyOn(first, 'announce');
    first.clearAll();
    await recoveryImagesIdle(first);
    expect(environment.storage.has('routePlotter_autosave')).toBe(false);
    expect(environment.backend.entries.has(key)).toBe(true);
    expect(announce.mock.calls.map(([message]) => message))
      .toContain('Browser recovery could not be cleared; reload may restore old work.');

    // A remaining record that cannot be read: nothing is deleted.
    environment.storage.set(keptKey, 'not a record');
    await first.loadExampleImage('images/Court.png');
    await writeRecovery(first);
    first.clearAll();
    await recoveryImagesIdle(first);
    expect(environment.backend.log.some(entry => entry.startsWith('delete'))).toBe(false);
  });

  test('the revision written is the one captured: live changes nested in the styles and the waypoints, made while its put waits, do not reach it (Codex, code review round 1, 3)', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const releasePut = environment.backend.pause('put');
    await chooseMarker(first, 0, fileOf(pngDataURL({ tag: 'nested' }), 'nested.png'));
    const captured = {
      glow: first.styles.pathGlow.intensity,
      glowOn: first.styles.pathGlow.enabled,
      zoom: first.waypoints[1].camera.zoom,
      fill: first.waypoints[1].areaHighlight.fillOpacity,
    };
    // Changed in place, as a slider drag does before its write is asked for.
    first.styles.pathGlow.intensity = 0.9;
    first.styles.pathGlow.enabled = !captured.glowOn;
    first.waypoints[1].camera.zoom = 3;
    first.waypoints[1].areaHighlight.fillOpacity = 0.9;
    releasePut();
    await recoveryImagesIdle(first);
    first.storageService.flushAutoSave();
    const record = recoveryRecord(environment.storage);
    expect(record.recoveryImages.assets).toHaveLength(1);
    expect(record.styles.pathGlow).toMatchObject({ intensity: captured.glow, enabled: captured.glowOn });
    expect(record.waypoints[1].camera.zoom).toBe(captured.zoom);
    expect(record.waypoints[1].areaHighlight.fillOpacity).toBe(captured.fill);
  });

  test('a kept record of a manifest this release does not know, or of a shape it does not write, stops every deletion (Codex, code review round 1, 4)', async () => {
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    await writeRecovery(first);
    const key = recoveryRecord(environment.storage).recoveryImages.background.key;
    const keptKey = 'routePlotter_keptAutosave:1-000001-v99';
    environment.storage.set(keptKey, JSON.stringify({ coordVersion: 9, recoveryImages: { version: 99, images: [{ key }] } }));
    await first.loadExampleImage('images/Court.png');
    await writeRecovery(first);
    expect(environment.backend.entries.has(key)).toBe(true);
    environment.storage.set(keptKey, JSON.stringify({
      coordVersion: 9, recoveryImages: { version: 2, background: { key: 42 }, assets: [] },
    }));
    first.eventBus.emit('background:overlay-change', 5);
    await writeRecovery(first);
    expect(environment.backend.entries.has(key)).toBe(true);
    expect(environment.backend.log.some(entry => entry.startsWith('delete'))).toBe(false);
    // Once it goes, the image no record names goes at the next tidy.
    environment.storage.delete(keptKey);
    first.eventBus.emit('background:overlay-change', 6);
    await writeRecovery(first);
    expect(environment.backend.entries.has(key)).toBe(false);
  });

  test('a warning whose image is kept after all goes: a refusal that recovers, an image-free project opened, and Clear All (Codex, code review round 1, 6)', async () => {
    allowConsole(/could not store an image/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    environment.backend.failWhen('put', record => (record.width === 13
      ? new DOMException('The quota has been exceeded.', 'QuotaExceededError') : null));
    await chooseMarker(first, 0, fileOf(pngDataURL({ width: 13, height: 13, tag: 'quota' }), 'quota.png'));
    await writeRecovery(first);
    expect(toasts()).toEqual([expect.stringMatching(/^Browser recovery could not keep the marker image .*quota\.png/)]);
    // The storage takes it at the next write: the warning is no longer true, and goes.
    environment.backend.failWhen('put', null);
    first.eventBus.emit('background:overlay-change', 5);
    await writeRecovery(first);
    expect(recoveryRecord(environment.storage).recoveryImages.omitted).toEqual([]);
    await vi.waitFor(() => expect(toasts()).toEqual([]));

    // Refused again; then an image-free project is opened: its warning goes.
    environment.backend.failWhen('put', record => (record.width === 14
      ? new DOMException('The quota has been exceeded.', 'QuotaExceededError') : null));
    await chooseMarker(first, 1, fileOf(pngDataURL({ width: 14, height: 14, tag: 'quota-2' }), 'quota-2.png'));
    await writeRecovery(first);
    expect(toasts()).toHaveLength(1);
    const archive = await first.imageAssetService.exportZip({ ...first._buildProjectSnapshot({ includeAssets: false }),
      waypoints: [], styles: { ...first.styles, pathHead: { ...first.styles.pathHead, imageAssetId: null, image: null } } }, null);
    expect(await first.loadProject(new File([archive], 'plain.zip', { type: 'application/zip' }))).toBe(true);
    await vi.waitFor(() => expect(toasts()).toEqual([]));

    // Refused once more; then Clear All: its warning goes too.
    placeRoute(first);
    await chooseMarker(first, 0, fileOf(pngDataURL({ width: 14, height: 14, tag: 'quota-3' }), 'quota-3.png'));
    await writeRecovery(first);
    expect(toasts()).toHaveLength(1);
    first.clearAll();
    await recoveryImagesIdle(first);
    await vi.waitFor(() => expect(toasts()).toEqual([]));
  });

  test('a prompt that waits for the slot says nothing the toast has said; refused, it moves no focus (Codex, code review round 1, 7)', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    await loadBackgroundFile(first, fileOf(pngDataURL({ width: 20, height: 10, tag: 'waits' }), 'waits.png'));
    placeRoute(first);
    await writeRecovery(first);
    const record = environment.storage.get('routePlotter_autosave');
    const key = JSON.parse(record).recoveryImages.background.key;
    // A mode holds the slot as the record is restored, its background lost.
    const owner = { onReplaced: () => {} };
    first.modeBanner.show(owner, { id: 'other-banner', text: 'Another mode' });
    environment.backend.lose(key);
    const focused = first.elements.bgUploadBtn;
    focused.focus();
    const announce = vi.spyOn(first, 'announce');
    first.storageService.loadAutoSaveText = () => record;
    expect(await first.loadAutosave()).toBe(true);
    expect(prompt()).toBeNull();
    expect(document.activeElement).toBe(focused);
    const aboutIt = () => announce.mock.calls.map(([message]) => message).filter(message => message.includes('waits.png'));
    expect(aboutIt()).toEqual([
      "Browser recovery could not bring back the background, waits.png: it is no longer in the browser's storage. "
      + 'Choose it again, or open your project file.',
    ]);
    // The mode ends: the prompt shows, and is not said again.
    first.modeBanner.hide(owner);
    expect(prompt()).not.toBeNull();
    expect(aboutIt()).toHaveLength(1);
  });

  test('one image both the path head and a marker show is named in both roles, with both fallbacks (Codex, code review round 1, 8)', async () => {
    allowConsole(/could not store an image/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const first = await bootWithRecovery(environment);
    placeRoute(first);
    environment.backend.failWhen('put', record => (record.width === 17
      ? new DOMException('The quota has been exceeded.', 'QuotaExceededError') : null));
    const both = pngDataURL({ width: 17, height: 17, tag: 'both' });
    const marker = await chooseMarker(first, 0, fileOf(both, 'both.png'));
    const head = await choosePathHead(first, fileOf(both, 'both.png'));
    expect(head.id).toBe(marker.id);
    await writeRecovery(first);
    expect(recoveryRecord(environment.storage).recoveryImages.omitted).toEqual([expect.objectContaining({
      role: 'path-head', roles: ['path-head', 'marker'], fallbacks: ['arrow', 'dot'], name: 'both.png', reason: 'refused',
    })]);
    expect(toasts()).toEqual([
      'Browser recovery could not keep the path head image and the marker image for waypoint 1, both.png, '
      + "shown as an arrow and a dot: the browser's storage refused it. Save a project file to keep it.",
    ]);
  });

  test('loadSnapshot opens a snapshot as given, a record from before this release; loadCurrentSnapshot as this release writes one (Codex, code review round 1, advisory)', async () => {
    const environment = recoveryEnvironment();
    const app = await bootWithRecovery(environment);
    placeRoute(app);
    const modelOnly = { ...app._buildProjectSnapshot({ includeAssets: false }), imageAssets: [] };
    await expect(loadSnapshot(app, modelOnly)).resolves.toBe(true);
    expect(prompt()?.textContent).toContain('recovery before this release kept no images');
    await expect(loadCurrentSnapshot(app, modelOnly)).resolves.toBe(true);
    expect(prompt()).toBeNull();
  });
});

describe('round 3: the code review round 2 (DEF-98)', () => {
  test('a restore pins every image its record names before its first read: another tab\'s Clear All takes none meanwhile, and its pagehide record names them all (Codex, code review round 2, 1)', async () => {
    decodeByHeader();
    const environment = recoveryEnvironment();
    const writer = await bootWithRecovery(environment);
    await loadBackgroundFile(writer, fileOf(pngDataURL({ width: 24, height: 12, tag: 'two-tab-campus' }), 'campus.png'));
    placeRoute(writer);
    const marker = await chooseMarker(writer, 0, fileOf(pngDataURL({ width: 8, height: 8, tag: 'two-tab-flag' }), 'flag.png'));
    await writeRecovery(writer);
    await closeApp(writer);

    // Tab A restores the record and shows both images.
    const tabA = await bootWithRecovery(environment);
    expect(tabA.waypoints[0].customImageAssetId).toBe(marker.id);
    // Tab B opens and restores it too; its first read waits.
    const releaseGet = environment.backend.pause('get');
    const get = environment.backend.get;
    const reading = new Promise(resolve => {
      environment.backend.get = key => {
        resolve();
        return get.call(environment.backend, key);
      };
    });
    setRecoveryImageStoreFactory(() => environment.makeStore());
    const tabB = await bootApp();
    setRecoveryImageStoreFactory(null);
    await reading;
    // A clears: it lets go of its images, removes recovery and sweeps.
    tabA.clearAll();
    await recoveryImagesIdle(tabA);
    expect(environment.backend.entries.size).toBe(2);
    releaseGet();
    await tabB.ready;
    expect(tabB.waypoints[0]).toMatchObject({ markerStyle: 'custom', customImageAssetId: marker.id });
    expect(tabB._backgroundName).toBe('campus.png');
    // B edits and closes at once: its pagehide record names both, stored.
    tabB.eventBus.emit('background:overlay-change', 10);
    tabB.storageService.flushAutoSave();
    expect(expectRecordHeld(environment)).toHaveLength(2);
    expect(recoveryRecord(environment.storage).recoveryImages.omitted).toEqual([]);
  });

  test.each([
    ['a Clear All', async app => {
      app.clearAll();
    }],
    ['a newer Open', async (app, archive) => {
      expect(await app.loadProject(new File([archive], 'plain.zip', { type: 'application/zip' }))).toBe(true);
    }],
  ])('a restore that %s superseded, whose staging then fails, keeps no record of the project it would have restored, and says nothing of it (Codex, code review round 2, 4)', async (_, supersede) => {
    allowConsole(/could not be read|Failed to load image/);
    decodeByHeader();
    const environment = recoveryEnvironment();
    const writer = await bootWithRecovery(environment);
    await loadBackgroundFile(writer, fileOf(pngDataURL({ width: 30, height: 15, tag: 'staged' }), 'staged.png'));
    placeRoute(writer);
    await writeRecovery(writer);
    const archive = await writer.imageAssetService.exportZip(
      { ...writer._buildProjectSnapshot({ includeAssets: false }), waypoints: [] }, null);
    await closeApp(writer);

    // The staging's decode of the background is held, to fail later.
    const decode = ImageAsset.decodeDataURL;
    let fail;
    const reached = new Promise(resolve => {
      vi.spyOn(ImageAsset, 'decodeDataURL').mockImplementation((dataURL, name) => {
        if (name !== 'project background') return decode.call(ImageAsset, dataURL, name);
        resolve();
        return new Promise((_resolve, reject) => { fail = () => reject(new Error('Failed to load image: held')); });
      });
    });
    setRecoveryImageStoreFactory(() => environment.makeStore());
    const app = await bootApp();
    setRecoveryImageStoreFactory(null);
    await reached;
    await supersede(app, archive);
    fail();
    await app.ready;
    await recoveryImagesIdle(app);
    expect([...environment.storage.keys()].filter(key => key.startsWith('routePlotter_keptAutosave:'))).toEqual([]);
    expect(document.getElementById('unrestored-notice').hidden).toBe(true);
    expect(app.waypoints).toHaveLength(0);
    expect(environment.backend.entries.size).toBe(0);
  });
});

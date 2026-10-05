import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { ImageAsset } from '../src/models/ImageAsset.js';
import {
  ImageAssetService,
  PROJECT_ARCHIVE_LIMITS,
} from '../src/services/ImageAssetService.js';

const PIXEL_PAYLOAD = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PIXEL_DATA_URL = `data:image/png;base64,${PIXEL_PAYLOAD}`;
// A second 1×1 PNG, mid-grey, of the same length: two images a mix-up could
// swap without changing any size.
const GREY_PAYLOAD = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNo+A8AAgIBgP3y/PQAAAAASUVORK5CYII=';
const GREY_DATA_URL = `data:image/png;base64,${GREY_PAYLOAD}`;

async function projectArchive(id) {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({
    coordVersion: 9,
    assetManifest: [{
      id,
      filename: 'safe.png',
      name: 'safe.png',
      width: 1,
      height: 1,
      mimeType: 'image/png',
      size: 68,
    }],
  }));
  zip.folder('assets').file('safe.png', PIXEL_PAYLOAD, { base64: true });
  return zip.generateAsync({ type: 'uint8array' });
}

async function blobBytes(blob) {
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

function pixelAsset(id, dataUrl = PIXEL_DATA_URL) {
  const { byteLength } = ImageAsset.inspectDataURL(dataUrl);
  return new ImageAsset({
    id,
    base64: dataUrl,
    name: `${id}.png`,
    width: 1,
    height: 1,
    mimeType: 'image/png',
    size: byteLength,
  });
}

describe('image asset archive round trips', () => {
  test('rejects an asset id that cannot become a safe ZIP filename', async () => {
    const archive = await projectArchive('a/b');
    await expect(new ImageAssetService().importZip(archive)).rejects.toThrow(/Invalid image asset id/);
  });

  test('a safely imported asset can be exported and imported again', async () => {
    const source = new ImageAssetService();
    const imported = await source.importZip(await projectArchive('safe-id_1'));
    source.replaceAssets(imported.imageAssets);

    // A shared file carries only the images its project uses (DEF-23), so the
    // project refers to this one, as any real project holding it would.
    const projectData = { ...imported.projectData, waypoints: [{ customImageAssetId: 'safe-id_1' }] };
    const exported = await source.exportZip(projectData, null, 'round-trip');
    const reloaded = await new ImageAssetService().importZip(await blobBytes(exported));

    expect(reloaded.imageAssets.map(asset => asset.id)).toEqual(['safe-id_1']);
    // The bytes too, not only the ID (TST-16): byte for byte what was imported.
    expect(reloaded.imageAssets[0].base64).toBe(PIXEL_DATA_URL);
    expect(reloaded.imageAssets[0].base64).toBe(imported.imageAssets[0].base64);
  });

  test('a saved ZIP includes reachable bytes and excludes assets swept before export', async () => {
    const source = new ImageAssetService();
    const keep = await source.importZip(await projectArchive('keep'));
    const stale = await source.importZip(await projectArchive('stale'));
    source.replaceAssets([...keep.imageAssets, ...stale.imageAssets]);

    expect(source.pruneUnreferenced(['keep'])).toEqual(['stale']);
    const projectData = {
      coordVersion: 9,
      waypoints: [{ customImageAssetId: 'keep' }],
    };
    const exported = await source.exportZip(projectData, null, 'swept-round-trip');
    const reloaded = await new ImageAssetService().importZip(await blobBytes(exported));

    expect(reloaded.imageAssets.map(asset => asset.id)).toEqual(['keep']);
    expect(reloaded.imageAssets[0].base64).toBe(PIXEL_DATA_URL);
    expect(reloaded.projectData.waypoints).toEqual([{ customImageAssetId: 'keep' }]);
  });

  test('the full 128-asset boundary round-trips without dropping reachable bytes', async () => {
    const source = new ImageAssetService();
    const assets = Array.from(
      { length: PROJECT_ARCHIVE_LIMITS.MAX_ASSETS },
      (_, index) => pixelAsset(`asset-${index}`)
    );
    source.replaceAssets(assets);
    const projectData = {
      coordVersion: 9,
      waypoints: assets.map(asset => ({ customImageAssetId: asset.id })),
    };

    const exported = await source.exportZip(projectData, null, 'asset-boundary');
    const reloaded = await new ImageAssetService().importZip(await blobBytes(exported));

    expect(reloaded.imageAssets).toHaveLength(PROJECT_ARCHIVE_LIMITS.MAX_ASSETS);
    expect(reloaded.imageAssets.map(asset => asset.id)).toEqual(assets.map(asset => asset.id));
    expect(reloaded.imageAssets.every(asset => asset.base64 === PIXEL_DATA_URL)).toBe(true);
    expect(reloaded.projectData.waypoints).toEqual(projectData.waypoints);
  });

  test('each asset keeps its own bytes: two images of equal size do not trade places', async () => {
    const assets = [pixelAsset('z-first'), pixelAsset('a-second', GREY_DATA_URL)];
    expect(GREY_DATA_URL).not.toBe(PIXEL_DATA_URL);
    expect(assets[1].size).toBe(assets[0].size);
    const source = new ImageAssetService();
    source.replaceAssets(assets);
    const projectData = {
      coordVersion: 9,
      waypoints: assets.map(asset => ({ customImageAssetId: asset.id })),
    };

    const exported = await source.exportZip(projectData, null, 'distinct-bytes');
    const reloaded = await new ImageAssetService().importZip(await blobBytes(exported));

    const reloadedBytes = new Map(reloaded.imageAssets.map(asset => [asset.id, asset.base64]));
    expect([...reloadedBytes.keys()]).toEqual(['z-first', 'a-second']);
    for (const asset of assets) {
      expect(reloadedBytes.get(asset.id)).toBe(asset.base64);
    }
  });

  test('background image bytes round-trip through ZIP without re-encoding', async () => {
    const exported = await new ImageAssetService().exportZip(
      { coordVersion: 9 },
      PIXEL_DATA_URL,
      'background-round-trip'
    );
    const reloaded = await new ImageAssetService().importZip(await blobBytes(exported));

    expect(reloaded.backgroundBase64).toBe(PIXEL_DATA_URL);
  });
});

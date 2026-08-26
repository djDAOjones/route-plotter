import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { ImageAsset } from '../src/models/ImageAsset.js';
import {
  ImageAssetService,
  PROJECT_ARCHIVE_LIMITS,
} from '../src/services/ImageAssetService.js';

const PIXEL_PAYLOAD = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PIXEL_DATA_URL = `data:image/png;base64,${PIXEL_PAYLOAD}`;

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

function pixelAsset(id) {
  const { byteLength } = ImageAsset.inspectDataURL(PIXEL_DATA_URL);
  return new ImageAsset({
    id,
    base64: PIXEL_DATA_URL,
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

    const exported = await source.exportZip(imported.projectData, null, 'round-trip');
    const reloaded = await new ImageAssetService().importZip(await blobBytes(exported));

    expect(reloaded.imageAssets.map(asset => asset.id)).toEqual(['safe-id_1']);
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
    expect(reloaded.projectData.waypoints).toEqual(projectData.waypoints);
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

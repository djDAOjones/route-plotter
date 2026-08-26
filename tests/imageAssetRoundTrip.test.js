import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { ImageAssetService } from '../src/services/ImageAssetService.js';

const PIXEL_PAYLOAD = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

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
});

import { describe, expect, test, vi } from 'vitest';
import JSZip from 'jszip';
import { Emitter, EMITTER_LIMITS } from '../src/models/Emitter.js';
import { FlowLayer, FLOW_LAYER_LIMITS } from '../src/models/FlowLayer.js';
import { Scene, SCENE_LIMITS } from '../src/models/Scene.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import {
  ImageAssetService,
  PROJECT_ARCHIVE_LIMITS,
  SIZE_LIMITS,
} from '../src/services/ImageAssetService.js';

const PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PIXEL_PAYLOAD = PIXEL_PNG.split(',')[1];

function makeAsset(id) {
  const { byteLength } = ImageAsset.inspectDataURL(PIXEL_PNG);
  const asset = new ImageAsset({
    id,
    base64: PIXEL_PNG,
    name: `${id}.png`,
    width: 1,
    height: 1,
    mimeType: 'image/png',
    size: byteLength,
  });
  asset._imageElement = { width: 1, height: 1, naturalWidth: 1, naturalHeight: 1 };
  return asset;
}

function archiveProject(overrides = {}) {
  return {
    coordVersion: 9,
    waypoints: [],
    scene: { flowLayers: [] },
    assetManifest: [],
    ...overrides,
  };
}

function findClassicEocd(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 &&
        offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      return offset;
    }
  }
  throw new Error('Test fixture has no EOCD');
}

function concatenateBytes(...parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function setUint64LE(view, offset, value) {
  const bigValue = BigInt(value);
  view.setUint32(offset, Number(bigValue & 0xffffffffn), true);
  view.setUint32(offset + 4, Number(bigValue >> 32n), true);
}

async function makeSingleEntryArchive() {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(archiveProject()));
  return zip.generateAsync({ type: 'uint8array' });
}

function duplicateCentralDirectory(bytes, physicalEntries, declaredEntries = physicalEntries) {
  const eocdOffset = findClassicEocd(bytes);
  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const directoryOffset = sourceView.getUint32(eocdOffset + 16, true);
  const directorySize = sourceView.getUint32(eocdOffset + 12, true);
  const directoryRecord = bytes.slice(directoryOffset, directoryOffset + directorySize);
  const directory = new Uint8Array(directoryRecord.length * physicalEntries);
  for (let index = 0; index < physicalEntries; index += 1) {
    directory.set(directoryRecord, index * directoryRecord.length);
  }
  const eocd = bytes.slice(eocdOffset);
  const eocdView = new DataView(eocd.buffer, eocd.byteOffset, eocd.byteLength);
  eocdView.setUint16(8, declaredEntries, true);
  eocdView.setUint16(10, declaredEntries, true);
  eocdView.setUint32(12, directory.length, true);
  return concatenateBytes(bytes.slice(0, directoryOffset), directory, eocd);
}

function hideDuplicateDirectoryInEocdComment(bytes, physicalEntries) {
  const eocdOffset = findClassicEocd(bytes);
  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const directoryOffset = sourceView.getUint32(eocdOffset + 16, true);
  const directorySize = sourceView.getUint32(eocdOffset + 12, true);
  const directoryRecord = bytes.slice(directoryOffset, directoryOffset + directorySize);
  const duplicateDirectory = new Uint8Array(directoryRecord.length * physicalEntries);
  for (let index = 0; index < physicalEntries; index += 1) {
    duplicateDirectory.set(directoryRecord, index * directoryRecord.length);
  }

  const fakeEocd = bytes.slice(eocdOffset, eocdOffset + 22);
  const fakeView = new DataView(fakeEocd.buffer, fakeEocd.byteOffset, fakeEocd.byteLength);
  fakeView.setUint16(8, physicalEntries, true);
  fakeView.setUint16(10, physicalEntries, true);
  fakeView.setUint32(12, duplicateDirectory.length, true);
  fakeView.setUint32(16, bytes.length, true);
  fakeView.setUint16(20, 0, true);

  // The genuine EOCD treats the malicious directory and later fake EOCD as
  // its comment. JSZip nevertheless selects the later raw signature. The last
  // byte makes that later record structurally invalid for strict preflight.
  const archive = bytes.slice();
  const archiveView = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  archiveView.setUint16(
    eocdOffset + 20,
    duplicateDirectory.length + fakeEocd.length + 1,
    true
  );
  return concatenateBytes(archive, duplicateDirectory, fakeEocd, new Uint8Array([0]));
}

function convertToZip64(bytes) {
  const eocdOffset = findClassicEocd(bytes);
  const sourceView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const directoryEntries = sourceView.getUint16(eocdOffset + 10, true);
  const directorySize = sourceView.getUint32(eocdOffset + 12, true);
  const directoryOffset = sourceView.getUint32(eocdOffset + 16, true);

  const zip64Record = new Uint8Array(56);
  const zip64View = new DataView(zip64Record.buffer);
  zip64View.setUint32(0, 0x06064b50, true);
  setUint64LE(zip64View, 4, 44);
  zip64View.setUint16(12, 45, true);
  zip64View.setUint16(14, 45, true);
  setUint64LE(zip64View, 24, directoryEntries);
  setUint64LE(zip64View, 32, directoryEntries);
  setUint64LE(zip64View, 40, directorySize);
  setUint64LE(zip64View, 48, directoryOffset);

  const locator = new Uint8Array(20);
  const locatorView = new DataView(locator.buffer);
  locatorView.setUint32(0, 0x07064b50, true);
  setUint64LE(locatorView, 8, eocdOffset);
  locatorView.setUint32(16, 1, true);

  const classicEocd = bytes.slice(eocdOffset);
  const classicView = new DataView(classicEocd.buffer, classicEocd.byteOffset, classicEocd.byteLength);
  classicView.setUint16(8, 0xffff, true);
  classicView.setUint16(10, 0xffff, true);
  classicView.setUint32(12, 0xffffffff, true);
  classicView.setUint32(16, 0xffffffff, true);
  return concatenateBytes(bytes.slice(0, eocdOffset), zip64Record, locator, classicEocd);
}

describe('finite model and render-work limits', () => {
  test('direct file images reject unsupported or signature-spoofed content', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'active.svg', {
      type: 'image/svg+xml',
    });
    await expect(ImageAsset.fromFile(svg)).rejects.toThrow(/PNG, JPEG, or WebP/);

    const spoofed = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'spoofed.png', {
      type: 'image/png',
    });
    await expect(ImageAsset.fromFile(spoofed)).rejects.toThrow(/bytes do not match/);
  });

  test('authoring clamps Infinity and oversized dot counts to finite bounded values', () => {
    expect(new Emitter({ dotCount: Infinity }).dotCount).toBe(1);
    expect(new Emitter({ dotCount: EMITTER_LIMITS.MAX_DOT_COUNT + 10 }).dotCount)
      .toBe(EMITTER_LIMITS.MAX_DOT_COUNT);
    expect(Number.isFinite(new Emitter({ speed: Infinity }).speed)).toBe(true);
    expect(Number.isFinite(new Emitter({ dotSize: Infinity }).dotSize)).toBe(true);
  });

  test('persisted emitters reject Infinity and per-emitter dot budget violations', () => {
    expect(() => Emitter.fromJSON({ dotCount: Infinity })).toThrow(/finite/);
    expect(() => Emitter.fromJSON({ dotCount: EMITTER_LIMITS.MAX_DOT_COUNT + 1 }))
      .toThrow(/maximum/);
  });

  test('flow-layer hydration rejects non-finite graph data and collection overruns', () => {
    expect(() => FlowLayer.fromJSON({
      graph: { nodes: [{ id: 'n', x: Infinity, y: 0.5 }], edges: [] },
    })).toThrow(/finite coordinates/);

    expect(() => FlowLayer.fromJSON({
      emitters: Array.from({ length: FLOW_LAYER_LIMITS.MAX_EMITTERS + 1 }, () => ({})),
    })).toThrow(/emitter limit/);
  });

  test('scene aggregate dot budget is enforced before any existing scene is cleared', () => {
    const scene = new Scene();
    scene.addFlowLayer({ id: 'existing', name: 'Existing' });
    const before = scene.toJSON();
    const expensive = {
      flowLayers: [{
        id: 'expensive',
        emitters: Array.from({ length: 5 }, (_, index) => ({
          id: `em-${index}`,
          dotCount: EMITTER_LIMITS.MAX_DOT_COUNT,
        })),
      }],
    };

    expect(() => scene.fromJSON(expensive)).toThrow(`Scene dot budget is ${SCENE_LIMITS.MAX_DOTS_TOTAL}`);
    expect(scene.toJSON()).toEqual(before);
  });
});

describe('bounded and detached project ZIP import', () => {
  test('rejects an oversized compressed input before parsing', async () => {
    const service = new ImageAssetService();
    await expect(service.importZip({ size: SIZE_LIMITS.ZIP_MAX + 1 }))
      .rejects.toThrow(/50 MB/);
  });

  test('rejects excess entry count and oversized project metadata', async () => {
    const manyEntries = new JSZip();
    manyEntries.file('project.json', JSON.stringify(archiveProject()));
    for (let i = 0; i < PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES; i += 1) {
      manyEntries.file(`extra-${i}.txt`, 'x');
    }
    const manyBytes = await manyEntries.generateAsync({ type: 'uint8array' });
    await expect(new ImageAssetService().importZip(manyBytes)).rejects.toThrow(/entry limit/);

    const hugeMetadata = new JSZip();
    hugeMetadata.file('project.json', JSON.stringify(archiveProject({
      padding: 'x'.repeat(PROJECT_ARCHIVE_LIMITS.MAX_PROJECT_JSON_BYTES + 1),
    })));
    const hugeBytes = await hugeMetadata.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    await expect(new ImageAssetService().importZip(hugeBytes)).rejects.toThrow(/decompressed size limit/);
  });

  test('rejects duplicate-name central directories before JSZip allocates their entries', async () => {
    const baseArchive = await makeSingleEntryArchive();
    const excessiveDuplicates = duplicateCentralDirectory(
      baseArchive,
      PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES + 1
    );
    const underreportedDuplicates = duplicateCentralDirectory(
      baseArchive,
      PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES + 1,
      1
    );
    const commentHiddenDuplicates = hideDuplicateDirectoryInEocdComment(
      baseArchive,
      PROJECT_ARCHIVE_LIMITS.MAX_ENTRIES + 1
    );
    const loadSpy = vi.spyOn(JSZip, 'loadAsync');
    try {
      await expect(new ImageAssetService().importZip(excessiveDuplicates)).rejects.toThrow(/entry limit/);
      await expect(new ImageAssetService().importZip(underreportedDuplicates)).rejects.toThrow(/entry limit/);
      await expect(new ImageAssetService().importZip(commentHiddenDuplicates))
        .rejects.toThrow(/malformed or truncated/);
      expect(loadSpy).not.toHaveBeenCalled();
    } finally {
      loadSpy.mockRestore();
    }
  });

  test('preflights valid ZIP64 metadata and rejects truncated or malformed end records', async () => {
    const baseArchive = await makeSingleEntryArchive();
    const zip64Archive = convertToZip64(baseArchive);
    const imported = await new ImageAssetService().importZip(zip64Archive);
    expect(imported.projectData.coordVersion).toBe(9);

    const truncated = baseArchive.slice(0, -1);
    const malformedZip64 = zip64Archive.slice();
    const zip64EocdOffset = findClassicEocd(malformedZip64);
    const locatorView = new DataView(
      malformedZip64.buffer,
      malformedZip64.byteOffset + zip64EocdOffset - 20,
      20
    );
    setUint64LE(locatorView, 8, malformedZip64.length + 1);

    const loadSpy = vi.spyOn(JSZip, 'loadAsync');
    try {
      await expect(new ImageAssetService().importZip(truncated)).rejects.toThrow(/malformed or truncated/);
      await expect(new ImageAssetService().importZip(malformedZip64)).rejects.toThrow(/ZIP64 end record/);
      expect(loadSpy).not.toHaveBeenCalled();
    } finally {
      loadSpy.mockRestore();
    }
  });

  test('fully stages a valid archive without replacing the service live collection', async () => {
    const service = new ImageAssetService();
    service.addAsset(makeAsset('old'));
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(archiveProject({
      assetManifest: [{
        id: 'new', filename: 'new.png', name: 'new.png', width: 1, height: 1,
        mimeType: 'image/png', size: 1,
      }],
    })));
    zip.folder('assets').file('new.png', PIXEL_PAYLOAD, { base64: true });
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const imported = await service.importZip(bytes);

    expect(service.getAssetIds()).toEqual(['old']);
    expect(imported.imageAssets.map(asset => asset.id)).toEqual(['new']);
    expect(imported.imageAssets[0]._imageElement).not.toBe(null);
    expect(imported.projectData.assetManifest).toBeUndefined();
  });

  test('a missing manifest entry fails without clearing existing assets', async () => {
    const service = new ImageAssetService();
    service.addAsset(makeAsset('old'));
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(archiveProject({
      assetManifest: [{
        id: 'missing', filename: 'missing.png', name: 'missing.png', width: 1, height: 1,
        mimeType: 'image/png', size: 1,
      }],
    })));
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    await expect(service.importZip(bytes)).rejects.toThrow(/missing image asset/);
    expect(service.getAssetIds()).toEqual(['old']);
  });

  test('unsafe archive paths and active SVG image data are rejected', async () => {
    const traversal = new JSZip();
    traversal.file('../project.json', JSON.stringify(archiveProject()));
    const traversalBytes = await traversal.generateAsync({ type: 'uint8array' });
    await expect(new ImageAssetService().importZip(traversalBytes)).rejects.toThrow(/unsafe entry path/);

    const service = new ImageAssetService();
    await expect(service.addFromBase64(
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
      'active.svg'
    )).rejects.toThrow(/PNG, JPEG, or WebP/);
  });
});

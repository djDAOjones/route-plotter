import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { RenderingService } from '../src/services/RenderingService.js';
import {
  isBuiltInPathHeadStyle,
  pathHeadStyleUsesImageControls,
  resolvePathHeadImage,
} from '../src/utils/pathHeadPresets.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('built-in path-head presets', () => {
  test('advertises the drone as a bundled image head without changing custom ownership', () => {
    expect(isBuiltInPathHeadStyle('drone')).toBe(true);
    expect(isBuiltInPathHeadStyle('custom')).toBe(false);
    expect(pathHeadStyleUsesImageControls('drone')).toBe(true);
    expect(pathHeadStyleUsesImageControls('custom')).toBe(true);
    expect(pathHeadStyleUsesImageControls('arrow')).toBe(false);
  });

  test('ships a square RGBA source asset and exposes the preset in the native select', () => {
    const png = readFileSync(resolve(process.cwd(), 'src/assets/drone-head.png'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(512);
    expect(png.readUInt32BE(20)).toBe(512);
    expect(png[25]).toBe(6); // PNG colour type 6 is RGBA.

    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('<option value="drone">Drone</option>');
    expect(html).toContain('id="custom-head-upload-controls"');
  });

  test('resolves bundled and custom images through separate loaders', async () => {
    class LoadedImage {
      set src(value) {
        this.source = value;
        queueMicrotask(() => this.onload());
      }
    }
    vi.stubGlobal('Image', LoadedImage);
    const loadCustom = vi.fn(() => Promise.resolve({ source: 'custom' }));

    const preset = await resolvePathHeadImage({ style: 'drone', imageAssetId: 'unused' }, loadCustom);
    expect(preset).toBeInstanceOf(LoadedImage);
    expect(preset.source).toBeTruthy();
    expect(loadCustom).not.toHaveBeenCalled();

    await expect(resolvePathHeadImage(
      { style: 'custom', imageAssetId: 'custom-head' },
      loadCustom
    )).resolves.toEqual({ source: 'custom' });
    expect(loadCustom).toHaveBeenCalledWith('custom-head');
  });

  test('draws the drone image with the established custom-head transform', () => {
    const service = new RenderingService();
    service.scaleSizeClamped = vi.fn(() => 10);
    const image = { id: 'drone' };
    const ctx = {
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    };

    service.drawPathHead(ctx, 120, 80, Math.PI / 2, {
      style: 'drone',
      color: '#111111',
      size: 8,
      image,
      rotationMode: 'auto',
      rotationOffset: 0,
    });

    expect(ctx.translate).toHaveBeenCalledWith(120, 80);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.drawImage).toHaveBeenCalledWith(image, -10, -10, 20, 20);
  });
});

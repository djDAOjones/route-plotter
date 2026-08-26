import { describe, expect, test, vi } from 'vitest';

import { exportingMixin } from '../src/app/exporting.js';
import { AreaHighlightRenderer } from '../src/services/AreaHighlightRenderer.js';
import { RenderingService } from '../src/services/RenderingService.js';
import {
  renderReferenceScale,
  resolveRenderReference,
} from '../src/utils/renderReference.js';

describe('project render reference', () => {
  test('resolves the first valid additive migration candidate without retaining its object', () => {
    const timingReference = { width: 1000, height: 800 };
    const resolved = resolveRenderReference(
      { width: 0, height: 800 },
      timingReference,
      { width: 1920, height: 1080 }
    );

    expect(resolved).toEqual(timingReference);
    expect(resolved).not.toBe(timingReference);
    expect(resolveRenderReference(null, { width: NaN, height: 2 })).toBeNull();
  });

  test('uses the short edge so aspect changes do not distort authored sizes', () => {
    const reference = { width: 1000, height: 800 };
    expect(renderReferenceScale(reference, 500, 400)).toBe(0.5);
    expect(renderReferenceScale(reference, 2000, 1600)).toBe(2);
    expect(renderReferenceScale(reference, 2400, 800)).toBe(1);
    expect(renderReferenceScale(reference, 800, 2400)).toBe(1);
  });

  test('low/high export sizes, graphics scale and viewport clamp compose without saved-state mutation', () => {
    const service = new RenderingService();
    const reference = Object.freeze({ width: 1000, height: 800 });

    service.configureRenderReference(reference, 500, 400);
    expect(service.scaleSizeClamped(8)).toBe(4);

    service.configureRenderReference(reference, 2000, 1600);
    expect(service.scaleSizeClamped(8)).toBe(16);

    service.setGraphicsScale(1.5);
    service._zoomClampFactor = 0.5; // viewport >3x dampening, independent of camera transforms
    expect(service.scaleSizeClamped(8)).toBe(12);
    expect(reference).toEqual({ width: 1000, height: 800 });
  });

  test('editor labels clamp for legibility while HTML/video sizes stay exact', () => {
    const service = new RenderingService();
    const reference = { width: 1000, height: 800 };

    service.configureRenderReference(reference, 250, 200, { interactiveLabels: true });
    expect(service.scaleLabelSize(16)).toBe(14);

    service.configureRenderReference(reference, 4000, 3200, { interactiveLabels: true });
    expect(service.scaleLabelSize(48)).toBe(72);

    service.configureRenderReference(reference, 250, 200, { interactiveLabels: false });
    expect(service.scaleLabelSize(16)).toBe(4);
    service.configureRenderReference(reference, 4000, 3200, { interactiveLabels: false });
    expect(service.scaleLabelSize(48)).toBe(192);
  });

  test('camera zoom transforms the whole scene without changing the project size ratio', () => {
    const service = new RenderingService();
    const vectorContext = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), scale: vi.fn(),
    };
    service.getVectorCanvas = vi.fn(() => ({
      width: 1000,
      height: 800,
      getContext: () => vectorContext,
    }));
    let sizeInsideCamera = null;
    service.renderVectorLayerTo = vi.fn(() => {
      sizeInsideCamera = service.scaleSizeClamped(8);
    });
    const ctx = {
      canvas: { width: 1000, height: 800 },
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      scale: vi.fn(), translate: vi.fn(), drawImage: vi.fn(),
    };

    service.render(ctx, 1000, 800, {
      renderReference: { width: 1000, height: 800 },
      interactiveLabels: false,
      previewMode: true,
      motionSettings: { backgroundVisibility: 'always-show' },
      motionVisibilityService: null,
      pathPoints: [],
      background: { image: null, overlay: 0, fit: 'fit' },
      viewport: { zoom: 1 },
      cameraState: { enabled: true, zoom: 2, centerX: 500, centerY: 400 },
      pixelScale: 1,
    });

    expect(vectorContext.scale).toHaveBeenCalledWith(2, 2);
    expect(sizeInsideCamera).toBe(8);
  });

  test('area geometry stays canvas-relative while its authored border scales', () => {
    const ctx = {
      globalAlpha: 1,
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
    };
    const area = {
      shape: 'circle', centerX: 0.5, centerY: 0.5, radius: 0.1,
      fillOpacity: 0, fillColor: 'transparent',
      borderStyle: 'dashed', borderColor: '#0072B2', borderWidth: 2,
    };

    AreaHighlightRenderer._drawShape(ctx, area, (x, y) => ({ x, y }), 600, 800, 2);

    expect(ctx.arc).toHaveBeenCalledWith(0.5, 0.5, 100, 0, Math.PI * 2);
    expect(ctx.lineWidth).toBe(4);
    expect(ctx.setLineDash).toHaveBeenCalledWith([16, 8]);
  });

  test('video export changes render space without changing the visual or timeline references', () => {
    const renderReference = { width: 1000, height: 800 };
    const timingReference = { width: 900, height: 700 };
    const app = {
      renderReference,
      timingReference,
      canvas: { width: 1000, height: 800 },
      ctx: { setTransform: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: '' },
      coordinateTransform: { setCanvasDimensions: vi.fn() },
      background: { image: null },
      calculatePath: vi.fn(),
    };

    exportingMixin._enterExportMode.call(app, 3840, 2160);

    expect(app.renderReference).toBe(renderReference);
    expect(app.timingReference).toBe(timingReference);
    expect(app.displayWidth).toBe(3840);
    expect(app.displayHeight).toBe(2160);
    expect(app.calculatePath).not.toHaveBeenCalled();
  });
});

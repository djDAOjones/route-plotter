/**
 * Guards for the src/app/ prototype-mixin split of main.js (Phase 1).
 *
 * All mixins are merged onto RoutePlotter.prototype with Object.assign,
 * so a method name appearing in two mixins would silently last-write-win.
 * This suite fails loudly instead. It also covers snapToAngle, which moved
 * from main.js to its own util during the split.
 */

import { wiringDomMixin } from '../src/app/wiringDom.js';
import { wiringBusMixin } from '../src/app/wiringBus.js';
import { wiringControllersMixin } from '../src/app/wiringControllers.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import { playbackMixin } from '../src/app/playback.js';
import { cameraMixin } from '../src/app/camera.js';
import { viewportMixin } from '../src/app/viewport.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { persistenceMixin } from '../src/app/persistence.js';
import { exportingMixin } from '../src/app/exporting.js';
import { editorPanelMixin } from '../src/app/editorPanel.js';
import { pointerMixin } from '../src/app/pointer.js';
import { snapToAngle } from '../src/utils/snapToAngle.js';

const MIXINS = {
  wiringDomMixin,
  wiringBusMixin,
  wiringControllersMixin,
  undoRedoMixin,
  playbackMixin,
  cameraMixin,
  viewportMixin,
  pathTimingMixin,
  persistenceMixin,
  exportingMixin,
  editorPanelMixin,
  pointerMixin,
};

describe('RoutePlotter prototype mixins', () => {
  test('every mixin exports a non-empty object of functions', () => {
    for (const [name, mixin] of Object.entries(MIXINS)) {
      const keys = Object.keys(mixin);
      expect(keys.length, `${name} should not be empty`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(typeof mixin[key], `${name}.${key} should be a function`).toBe('function');
      }
    }
  });

  test('no method name is defined by two mixins (Object.assign would silently drop one)', () => {
    const owners = new Map();
    const collisions = [];
    for (const [name, mixin] of Object.entries(MIXINS)) {
      for (const key of Object.keys(mixin)) {
        if (owners.has(key)) collisions.push(`${key} (${owners.get(key)} + ${name})`);
        owners.set(key, name);
      }
    }
    expect(collisions).toEqual([]);
  });

  test('core method groups landed where expected', () => {
    // Spot-check one load-bearing method per cluster so an accidental
    // wholesale move (or an empty extraction) cannot pass unnoticed.
    expect(typeof wiringDomMixin.setupEventListeners).toBe('function');
    expect(typeof undoRedoMixin.undo).toBe('function');
    expect(typeof playbackMixin.play).toBe('function');
    expect(typeof cameraMixin._calculateCameraState).toBe('function');
    expect(typeof viewportMixin.setZoom).toBe('function');
    expect(typeof pathTimingMixin.calculatePath).toBe('function');
    expect(typeof persistenceMixin.autoSave).toBe('function');
    expect(typeof exportingMixin.exportVideo).toBe('function');
    expect(typeof editorPanelMixin.updateWaypointEditor).toBe('function');
    expect(typeof pointerMixin.findWaypointAt).toBe('function');
  });
});

describe('snapToAngle', () => {
  test('snaps the angle to the nearest 15° increment and preserves distance', () => {
    // 20° from the reference should snap back to 15°.
    const rad20 = 20 * Math.PI / 180;
    const target = snapToAngle(0, 0, Math.cos(rad20), Math.sin(rad20));
    const rad15 = 15 * Math.PI / 180;
    expect(target.x).toBeCloseTo(Math.cos(rad15), 10);
    expect(target.y).toBeCloseTo(Math.sin(rad15), 10);
    expect(Math.hypot(target.x, target.y)).toBeCloseTo(1, 10);
  });

  test('an exact multiple of the increment is unchanged', () => {
    const rad45 = 45 * Math.PI / 180;
    const target = snapToAngle(0, 0, Math.cos(rad45) * 2, Math.sin(rad45) * 2);
    expect(target.x).toBeCloseTo(Math.cos(rad45) * 2, 10);
    expect(target.y).toBeCloseTo(Math.sin(rad45) * 2, 10);
  });

  test('coincident points are returned untouched', () => {
    expect(snapToAngle(0.5, 0.5, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  test('custom snap increment is honoured', () => {
    // 40° with a 90° increment snaps to 0°.
    const rad40 = 40 * Math.PI / 180;
    const target = snapToAngle(0, 0, Math.cos(rad40) * 3, Math.sin(rad40) * 3, 90);
    expect(target.x).toBeCloseTo(3, 10);
    expect(target.y).toBeCloseTo(0, 10);
  });
});

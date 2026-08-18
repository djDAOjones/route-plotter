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
import { wiringControllersMixin, reorderWaypointBlocks } from '../src/app/wiringControllers.js';
import { undoRedoMixin } from '../src/app/undoRedo.js';
import { playbackMixin } from '../src/app/playback.js';
import { cameraMixin } from '../src/app/camera.js';
import { viewportMixin } from '../src/app/viewport.js';
import { pathTimingMixin } from '../src/app/pathTiming.js';
import { persistenceMixin } from '../src/app/persistence.js';
import { exportingMixin } from '../src/app/exporting.js';
import { editorPanelMixin } from '../src/app/editorPanel.js';
import { pointerMixin } from '../src/app/pointer.js';
import { crowdsMixin } from '../src/app/crowds.js';
import { snapToAngle } from '../src/utils/snapToAngle.js';
import { sliderToPathWidth, pathWidthToSlider } from '../src/utils/pathWidthScale.js';

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
  crowdsMixin,
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
    expect(typeof crowdsMixin.addCrowd).toBe('function');
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

describe('pathWidthScale', () => {
  test('slider endpoints map to the width range', () => {
    expect(sliderToPathWidth(0)).toBeCloseTo(1, 10);
    expect(sliderToPathWidth(1000)).toBeCloseTo(40, 10);
  });

  test('round-trips width → slider → width', () => {
    for (const width of [1, 3, 7.5, 12, 40]) {
      expect(sliderToPathWidth(pathWidthToSlider(width))).toBeCloseTo(width, 1);
    }
  });

  test('out-of-range values clamp', () => {
    expect(sliderToPathWidth(-100)).toBe(1);
    expect(sliderToPathWidth(5000)).toBe(40);
    expect(pathWidthToSlider(400)).toBe(1000);
    expect(pathWidthToSlider(0)).toBe(0);
  });

  test('a raw slider integer is not a width (bulk-write regression pin)', () => {
    // Review 2026-08-18: bulk "apply to all" stored the raw slider value
    // (e.g. 333) as segmentWidth instead of converting to 1-40 px.
    expect(sliderToPathWidth(333)).toBeCloseTo(3.42, 2);
  });
});

describe('reorderWaypointBlocks', () => {
  // Only isMajor is read; names make failure output readable.
  const major = (name) => ({ name, isMajor: true });
  const minor = (name) => ({ name, isMajor: false });
  const names = (wps) => wps.map(wp => wp.name);

  test('a major carries its trailing minors to its new position', () => {
    const A = major('A'), m1 = minor('m1'), B = major('B'), C = major('C');
    const result = reorderWaypointBlocks([A, m1, B, C], [B, A, C]);
    // Regression pin (review 2026-08-18): the old rebuild kept minors at
    // their original array indices, producing [B, m1, A, C] — m1 silently
    // detached from A's leg and started shaping B's instead.
    expect(names(result)).toEqual(['B', 'A', 'm1', 'C']);
  });

  test('minors before the first major stay at the front', () => {
    const m0 = minor('m0'), A = major('A'), B = major('B');
    const result = reorderWaypointBlocks([m0, A, B], [B, A]);
    expect(names(result)).toEqual(['m0', 'B', 'A']);
  });

  test('a major omitted from the payload is appended, never dropped', () => {
    const A = major('A'), m1 = minor('m1'), B = major('B');
    const result = reorderWaypointBlocks([A, m1, B], [B]);
    expect(names(result)).toEqual(['B', 'A', 'm1']);
  });

  test('preserves object identity and count, and does not mutate the input', () => {
    const A = major('A'), m1 = minor('m1'), m2 = minor('m2'), B = major('B');
    const input = [A, m1, m2, B];
    const result = reorderWaypointBlocks(input, [B, A]);
    expect(result).toHaveLength(4);
    expect(new Set(result)).toEqual(new Set(input));
    expect(result).toEqual([B, A, m1, m2]);
    expect(input).toEqual([A, m1, m2, B]);
  });

  test('unchanged order round-trips to an identical array', () => {
    const A = major('A'), m1 = minor('m1'), B = major('B'), m2 = minor('m2');
    const input = [A, m1, B, m2];
    expect(reorderWaypointBlocks(input, [A, B])).toEqual(input);
  });
});

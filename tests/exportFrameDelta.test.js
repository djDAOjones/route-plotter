/**
 * Fixed-frame-delta beacon timing for frame-stepped video export.
 *
 * Wall-clock beacon deltas made encodes depend on how fast the export loop
 * ran — background-tab throttling stretched loop ticks to ~1s, advancing
 * beacon phases ~25x per encoded frame ("slowed/weird" exports unless the
 * browser stayed active). setFixedFrameDelta(1/fps) pins each rendered
 * frame to encoded-frame time. Interim until the PlayerCore teardown makes
 * beacon phases closed-form (decision-log 2026-08-17).
 */

import { RenderingService } from '../src/services/RenderingService.js';

function makeService(deltas) {
  const svc = new RenderingService();
  svc.beaconRenderer = {
    update: (deltaTime) => deltas.push(deltaTime),
    beacons: new Map(),
    reset: () => {},
  };
  return svc;
}

// Non-major waypoint: update() runs, per-waypoint beacon drawing is skipped,
// so no canvas context is touched.
const WAYPOINTS = [{ isMajor: false, beaconStyle: 'none' }];
const ENGINE = { getPathProgress: () => 0 };

describe('RenderingService.setFixedFrameDelta', () => {
  test('pinned delta feeds beacon updates exactly, every frame', () => {
    const deltas = [];
    const svc = makeService(deltas);

    svc.setFixedFrameDelta(1 / 25);
    svc.renderBeacons({}, WAYPOINTS, ENGINE, null, () => ({ x: 0, y: 0 }), {});
    svc.renderBeacons({}, WAYPOINTS, ENGINE, null, () => ({ x: 0, y: 0 }), {});
    svc.renderBeacons({}, WAYPOINTS, ENGINE, null, () => ({ x: 0, y: 0 }), {});

    expect(deltas).toEqual([1 / 25, 1 / 25, 1 / 25]);
  });

  test('null returns to wall-clock deltas and re-arms tracking', () => {
    const deltas = [];
    const svc = makeService(deltas);

    svc.setFixedFrameDelta(1 / 25);
    svc.renderBeacons({}, WAYPOINTS, ENGINE, null, () => ({ x: 0, y: 0 }), {});

    svc.setFixedFrameDelta(null);
    expect(svc.lastFrameTime).toBe(0);

    // First wall-clock frame after unpinning uses the 0.016 bootstrap value,
    // never a delta spanning the whole export.
    svc.renderBeacons({}, WAYPOINTS, ENGINE, null, () => ({ x: 0, y: 0 }), {});
    expect(deltas).toEqual([1 / 25, 0.016]);
  });

  test('wall-clock mode is the default', () => {
    const svc = makeService([]);
    expect(svc._fixedFrameDelta).toBeNull();
  });
});

/**
 * Additional unit coverage for pure model/service logic.
 *
 * Complements example.test.js. Focuses on behaviour that is deterministic
 * and free of canvas/DOM side effects: state transitions, coordinate
 * round-trips, path maths, and waypoint serialisation/inheritance.
 */

import { Waypoint } from '../src/models/Waypoint.js';
import { AnimationState } from '../src/models/AnimationState.js';
import { PathCalculator } from '../src/services/PathCalculator.js';
import { CoordinateTransform } from '../src/services/CoordinateTransform.js';
import { TextLabelService } from '../src/services/TextLabelService.js';
import { MotionVisibilityService } from '../src/services/MotionVisibilityService.js';
import { ImageAsset } from '../src/models/ImageAsset.js';
import { CameraService } from '../src/services/CameraService.js';
import { RenderingService } from '../src/services/RenderingService.js';
import { RENDERING } from '../src/config/constants.js';

describe('AnimationState (extended)', () => {
  test('setTime clamps to [0, duration] and derives progress', () => {
    const state = new AnimationState();
    state.duration = 8000;

    state.setTime(2000);
    expect(state.currentTime).toBe(2000);
    expect(state.progress).toBeCloseTo(0.25);

    state.setTime(99999);
    expect(state.currentTime).toBe(8000);
    expect(state.progress).toBe(1);

    state.setTime(-100);
    expect(state.currentTime).toBe(0);
    expect(state.progress).toBe(0);
  });

  test('setProgress and setTime are mutually consistent', () => {
    const state = new AnimationState();
    state.duration = 10000;
    state.setProgress(0.4);
    expect(state.currentTime).toBe(4000);
    state.setTime(7000);
    expect(state.progress).toBeCloseTo(0.7);
  });

  test('setMode accepts valid modes and rejects invalid', () => {
    const state = new AnimationState();
    state.setMode('constant-time');
    expect(state.mode).toBe('constant-time');
    expect(() => state.setMode('bogus')).toThrow();
  });

  test('togglePlayPause flips between playing and paused', () => {
    const state = new AnimationState();
    state.togglePlayPause(); // stopped -> play
    expect(state.isPlaying).toBe(true);
    expect(state.isPaused).toBe(false);
    state.togglePlayPause(); // playing -> pause
    expect(state.isPaused).toBe(true);
  });

  test('reset preserves speed (speed=0 is a valid value, not falsy-clobbered)', () => {
    const state = new AnimationState();
    state.speed = 0;
    state.progress = 0.5;
    state.reset();
    expect(state.speed).toBe(0);
    expect(state.progress).toBe(0);
  });

  test('toJSON/fromJSON round-trips core fields', () => {
    const state = new AnimationState();
    state.duration = 4200;
    state.speed = 333;
    state.setProgress(0.3);

    const restored = new AnimationState();
    restored.fromJSON(state.toJSON());

    expect(restored.duration).toBe(4200);
    expect(restored.speed).toBe(333);
    expect(restored.progress).toBeCloseTo(0.3);
  });
});

describe('CoordinateTransform (extended)', () => {
  test('canvasToImage and imageToCanvas are inverse (1:1 mapping)', () => {
    const t = new CoordinateTransform();
    t.setCanvasDimensions(1000, 1000);
    t.setImageDimensions(1000, 1000, 'fit');

    const img = t.canvasToImage(640, 360);
    const back = t.imageToCanvas(img.x, img.y);
    expect(back.x).toBeCloseTo(640);
    expect(back.y).toBeCloseTo(360);
  });

  test('round-trips a point through the fit-mode transform matrix (non-1:1)', () => {
    const t = new CoordinateTransform();
    t.setCanvasDimensions(800, 600);
    t.setImageDimensions(1000, 1000, 'fit');

    const c = t.imageToCanvas(0.25, 0.75);
    const img = t.canvasToImage(c.x, c.y);
    expect(img.x).toBeCloseTo(0.25);
    expect(img.y).toBeCloseTo(0.75);
  });

  test('relativeToPixels and pixelsToRelative are inverse', () => {
    const t = new CoordinateTransform();
    t.setCanvasDimensions(800, 600);
    t.setImageDimensions(1000, 1000, 'fit');

    const px = t.relativeToPixels(10);
    expect(t.pixelsToRelative(px)).toBeCloseTo(10);
  });

  test('reset clears dimensions and bounds', () => {
    const t = new CoordinateTransform();
    t.setCanvasDimensions(800, 600);
    t.setImageDimensions(1000, 1000, 'fit');
    t.reset();
    expect(t.getImageBounds()).toBe(null);
    expect(t.canvasWidth).toBe(0);
  });

  test('clearImage forgets bitmap bounds but preserves normalized canvas mapping', () => {
    const t = new CoordinateTransform();
    t.setCanvasDimensions(800, 600);
    t.setImageDimensions(1600, 900, 'fit');

    t.clearImage();

    expect(t.getImageBounds()).toBe(null);
    expect(t.canvasWidth).toBe(800);
    expect(t.canvasHeight).toBe(600);
    expect(t.imageToCanvas(0.25, 0.75)).toEqual({ x: 200, y: 450 });
  });
});

describe('PathCalculator (extended)', () => {
  test('getPointAtProgress returns endpoints and interpolates linearly', () => {
    const calc = new PathCalculator();
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(calc.getPointAtProgress(pts, 0)).toEqual({ x: 0, y: 0 });
    expect(calc.getPointAtProgress(pts, 1)).toEqual({ x: 10, y: 0 });
    expect(calc.getPointAtProgress(pts, 0.5).x).toBeCloseTo(5);
  });

  test('calculateSegmentLengths sums per-segment distances', () => {
    const calc = new PathCalculator();
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }];
    const lengths = calc.calculateSegmentLengths(pts, [0, 1]);
    expect(lengths.length).toBe(1);
    expect(lengths[0]).toBeCloseTo(4);
  });

  test('legTimingLengths weights legs by progress span and sums to total length', () => {
    const calc = new PathCalculator();
    // Two majors at progress 0 and 1 → a single leg spanning the whole path
    expect(calc.legTimingLengths([0, 1], 1000)).toEqual([1000]);
    // Three majors: spans 0→0.25 and 0.25→1 of an 800px path
    const legs = calc.legTimingLengths([0, 0.25, 1], 800);
    expect(legs.length).toBe(2);
    expect(legs[0]).toBeCloseTo(200); // 0.25 * 800
    expect(legs[1]).toBeCloseTo(600); // 0.75 * 800
    // Summed leg lengths equal the total → no regime split at 1.0x
    expect(legs[0] + legs[1]).toBeCloseTo(800);
  });

  test('legTimingLengths returns [] for fewer than two majors', () => {
    const calc = new PathCalculator();
    expect(calc.legTimingLengths([0.5], 1000)).toEqual([]);
    expect(calc.legTimingLengths([], 1000)).toEqual([]);
    expect(calc.legTimingLengths(null, 1000)).toEqual([]);
  });

  test('major-leg timing ignores minor spacing (no speed-up from minors)', () => {
    const calc = new PathCalculator();
    // Identical majors (progress 0 and 1) with one minor between them, but the
    // minor sits at very different progress in the two layouts. Leg timing must
    // depend only on the major-to-major span, so both layouts give the same leg
    // length — minors are geometry, never timing keyframes.
    const wps = [{ isMajor: true }, { isMajor: false }, { isMajor: true }];
    const nearStart = CameraService.toMajorKeyframes(wps, [0, 0.1, 1]);
    const nearEnd = CameraService.toMajorKeyframes(wps, [0, 0.9, 1]);
    const a = calc.legTimingLengths(nearStart.progressValues, 1000);
    const b = calc.legTimingLengths(nearEnd.progressValues, 1000);
    expect(a).toEqual([1000]);
    expect(b).toEqual(a);
  });

  test('clearCache invalidates the major-waypoint cache', () => {
    const calc = new PathCalculator();
    const wps = [{ imgX: 0, imgY: 0, isMajor: true }, { imgX: 1, imgY: 1, isMajor: true }];
    const a = calc.getMajorWaypointPositions(wps);
    calc.clearCache();
    const b = calc.getMajorWaypointPositions(wps);
    expect(b).not.toBe(a); // fresh object after cache clear
    expect(b).toEqual(a); // identical content
  });
});

describe('Waypoint (extended)', () => {
  test('camera and areaHighlight survive toJSON/fromJSON', () => {
    const wp = Waypoint.createMajor(0.4, 0.6);
    wp.camera.zoom = 4;
    wp.areaHighlight.enabled = true;
    wp.areaHighlight.shape = 'circle';
    wp.areaHighlight.radius = 0.12;
    wp.areaHighlight.points = [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }];

    const restored = Waypoint.fromJSON(wp.toJSON());
    expect(restored.camera.zoom).toBe(4);
    expect(restored.areaHighlight.enabled).toBe(true);
    expect(restored.areaHighlight.shape).toBe('circle');
    expect(restored.areaHighlight.radius).toBeCloseTo(0.12);
    expect(restored.areaHighlight.points).toEqual([{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }]);
  });

  test('copyPropertiesFrom inherits style but demotes label/beacon for a minor', () => {
    const major = Waypoint.createMajor(0.1, 0.1);
    major.dotColor = '#56B4E9';
    major.labelMode = 'fade-up';
    major.beaconStyle = 'ripple';
    major.markerStyle = 'custom';
    major.customImage = { id: 'decoded-marker' };
    major.customImageAssetId = 'marker-asset';
    major.customImageRotation = 'auto';
    major.customImageRotationOffset = 15;

    const minor = Waypoint.createMinor(0.2, 0.2);
    minor.copyPropertiesFrom(major);

    expect(minor.dotColor).toBe('#56B4E9'); // style inherited
    expect(minor.labelMode).toBe('off'); // demoted (minor has no label)
    expect(minor.beaconStyle).toBe('none'); // demoted
    expect(minor.customImage).toBe(major.customImage);

    const restored = Waypoint.fromJSON(minor.toJSON());
    expect(restored.customImage).toBeNull();
    expect(restored.customImageAssetId).toBe('marker-asset');
    expect(restored.customImageRotation).toBe('auto');
    expect(restored.customImageRotationOffset).toBe(15);
  });

  test('toggleType is reversible and applies type defaults', () => {
    const wp = Waypoint.createMajor(0.5, 0.5);

    wp.toggleType(); // -> minor
    expect(wp.isMajor).toBe(false);
    expect(wp.labelMode).toBe('off');
    expect(wp.dotSize).toBeLessThan(8);

    wp.toggleType(); // -> major
    expect(wp.isMajor).toBe(true);
    expect(wp.dotSize).toBeGreaterThanOrEqual(8);
  });

  test('update() applies changes, tracks dirty props, and protects id/created', () => {
    const wp = Waypoint.createMajor(0.5, 0.5);
    wp.clearDirtyProps();
    const originalId = wp.id;

    wp.update({ dotColor: '#000000', id: 'hacked' });

    expect(wp.dotColor).toBe('#000000');
    expect(wp.id).toBe(originalId); // id is not mutable through update()
    expect(wp.getDirtyProps()).toContain('dotColor');
  });

  test('validate rejects out-of-range and missing coordinates', () => {
    expect(Waypoint.validate({ imgX: 0.5, imgY: 0.5 })).toBe(true);
    expect(Waypoint.validate({ imgX: -0.1, imgY: 0.5 })).toBe(false);
    expect(Waypoint.validate({ imgX: 1.5, imgY: 0.5 })).toBe(false);
    expect(Waypoint.validate({ imgX: 0.5 })).toBe(false); // missing imgY
    expect(Waypoint.validate(null)).toBe(false);
  });

  test('hasLabel reflects text presence and visibility mode', () => {
    const wp = Waypoint.createMajor(0.5, 0.5);
    wp.label = 'Town hall';
    wp.labelMode = 'on';
    expect(wp.hasLabel()).toBe(true);

    wp.labelMode = 'off';
    expect(wp.hasLabel()).toBe(false);

    wp.labelMode = 'on';
    wp.label = '   '; // whitespace only
    expect(wp.hasLabel()).toBe(false);
  });

  test('legacy labelMode "none" is normalised to "off" on construction', () => {
    const wp = Waypoint.fromJSON({ imgX: 0.5, imgY: 0.5, labelMode: 'none' });
    expect(wp.labelMode).toBe('off');
  });
});

describe('TextLabelService.getTextVisibility', () => {
  const base = {
    progress: 0.5,
    waypointProgress: 0.5,
    isWaiting: false,
    animationDuration: 10000
  };

  test('off mode is never visible', () => {
    expect(TextLabelService.getTextVisibility({ ...base, labelMode: 'off' }))
      .toEqual({ visible: false, opacity: 0 });
  });

  test('on mode is always visible', () => {
    expect(TextLabelService.getTextVisibility({ ...base, labelMode: 'on' }))
      .toEqual({ visible: true, opacity: 1 });
  });

  test('fade-up shows the first waypoint immediately', () => {
    expect(TextLabelService.getTextVisibility({ ...base, labelMode: 'fade-up', waypointProgress: 0 }))
      .toEqual({ visible: true, opacity: 1 });
  });

  test('fade-up is hidden well before its waypoint is reached', () => {
    const res = TextLabelService.getTextVisibility({
      ...base, labelMode: 'fade-up', waypointProgress: 0.8, progress: 0.1
    });
    expect(res.visible).toBe(false);
    expect(res.opacity).toBe(0);
  });

  test('unknown/legacy mode falls back to visible after its waypoint', () => {
    const res = TextLabelService.getTextVisibility({
      ...base, labelMode: 'none', waypointProgress: 0.3, progress: 0.9
    });
    expect(res.visible).toBe(true);
  });
});

describe('MotionVisibilityService log2 slider mapping', () => {
  test('endpoints map to min/max', () => {
    expect(MotionVisibilityService.sliderToLog2Value(0, 1, 100)).toBe(1);
    expect(MotionVisibilityService.sliderToLog2Value(1000, 1, 100)).toBe(100);
  });

  test('slider <-> value round-trips across the range', () => {
    for (const slider of [100, 250, 500, 750, 900]) {
      const value = MotionVisibilityService.sliderToLog2Value(slider, 1, 100);
      const back = MotionVisibilityService.log2ValueToSlider(value, 1, 100);
      expect(back).toBeCloseTo(slider, 0);
    }
  });
});

describe('ImageAsset', () => {
  test('toJSON/fromJSON round-trips metadata and drops the cached element', () => {
    const asset = new ImageAsset({
      id: 'abc', base64: 'data:image/png;base64,XX', name: 'pin.png',
      width: 32, height: 48, mimeType: 'image/png', size: 2048
    });
    asset._imageElement = { fake: true };

    const restored = ImageAsset.fromJSON(asset.toJSON());
    expect(restored.id).toBe('abc');
    expect(restored.name).toBe('pin.png');
    expect(restored.width).toBe(32);
    expect(restored.height).toBe(48);
    expect(restored.size).toBe(2048);
    expect(restored._imageElement).toBe(null); // cached element is not serialised
  });

  test('getFormattedSize scales across B/KB/MB', () => {
    expect(new ImageAsset({ size: 512 }).getFormattedSize()).toBe('512 B');
    expect(new ImageAsset({ size: 2048 }).getFormattedSize()).toBe('2.0 KB');
    expect(new ImageAsset({ size: 5 * 1024 * 1024 }).getFormattedSize()).toBe('5.00 MB');
  });

  test('exceedsSize compares against a byte limit', () => {
    const asset = new ImageAsset({ size: 1000 });
    expect(asset.exceedsSize(500)).toBe(true);
    expect(asset.exceedsSize(2000)).toBe(false);
  });

  test('generateHash is deterministic and content-sensitive', async () => {
    const a = await ImageAsset.generateHash('data:image/png;base64,AAAA');
    const b = await ImageAsset.generateHash('data:image/png;base64,AAAA');
    const c = await ImageAsset.generateHash('data:image/png;base64,BBBB');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(typeof a).toBe('string');
  });
});

describe('CameraService — major-only zoom keyframes', () => {
  const zoomed = (zoom, isMajor = true) => ({ isMajor, camera: { zoom, zoomMode: 'continuous' } });

  test('toMajorKeyframes drops minors and keeps progress index-aligned', () => {
    const all = [zoomed(4), zoomed(1, false), zoomed(4)];
    const { waypoints, progressValues } = CameraService.toMajorKeyframes(all, [0, 0.5, 1]);
    expect(waypoints).toHaveLength(2);
    expect(waypoints.every(wp => wp.isMajor)).toBe(true);
    expect(progressValues).toEqual([0, 1]); // the minor's 0.5 is dropped
  });

  test('toMajorKeyframes treats a missing isMajor flag as major and tolerates missing progress', () => {
    const all = [{ camera: { zoom: 2 } }, zoomed(1, false)];
    const { waypoints, progressValues } = CameraService.toMajorKeyframes(all, undefined);
    expect(waypoints).toHaveLength(1);
    expect(progressValues).toEqual([0]); // missing progress falls back to 0
  });

  // Regression: two 4x majors with a minor between must hold ~4x across the minor.
  // Proves both the bug (full list dips to 1x) and the fix (major-only holds 4x).
  test('zoom holds across a minor once keyframes are major-only', () => {
    const all = [zoomed(4), zoomed(1, false), zoomed(4)];
    const progress = 0.5; // exactly where the minor sits
    const common = {
      progress,
      headPosition: { x: 500, y: 500 },
      canvasWidth: 1000,
      canvasHeight: 1000,
      animationDuration: 10000
    };

    // Bug reproduction: feeding every waypoint makes the minor's 1x dip the zoom.
    const dipped = new CameraService().calculateCameraState({
      ...common,
      waypoints: all,
      waypointProgressValues: [0, 0.5, 1]
    });
    expect(dipped.zoom).toBeCloseTo(1, 1);

    // Fix: major-only keyframes interpolate 4x→4x across the minor → no dip.
    const { waypoints, progressValues } = CameraService.toMajorKeyframes(all, [0, 0.5, 1]);
    const held = new CameraService().calculateCameraState({
      ...common,
      waypoints,
      waypointProgressValues: progressValues
    });
    expect(held.zoom).toBeCloseTo(4, 5);
  });
});

describe('RenderingService.glowLayers (path glow math)', () => {
  const base = 6; // already-scaled path stroke width (px)

  test('returns no layers when glow intensity is zero or negative', () => {
    expect(RenderingService.glowLayers(base, 0)).toEqual([]);
    expect(RenderingService.glowLayers(base, -0.5)).toEqual([]);
  });

  test('returns one layer per PATH_GLOW_LAYERS when enabled', () => {
    expect(RenderingService.glowLayers(base, 0.5)).toHaveLength(RENDERING.PATH_GLOW_LAYERS);
  });

  test('layers widen inner→outer (widest first), all at least the path width', () => {
    const layers = RenderingService.glowLayers(base, 1);
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].width).toBeLessThan(layers[i - 1].width); // descending width
    }
    layers.forEach(l => expect(l.width).toBeGreaterThanOrEqual(base));
    // outermost layer adds the full max extra width (frac = 1)
    expect(layers[0].width).toBeCloseTo(base + RENDERING.PATH_GLOW_MAX_EXTRA_WIDTH);
  });

  test('intensity scales the halo width and is clamped to <= 1', () => {
    const faint = RenderingService.glowLayers(base, 0.25)[0].width;
    const strong = RenderingService.glowLayers(base, 1)[0].width;
    expect(strong).toBeGreaterThan(faint);
    expect(RenderingService.glowLayers(base, 2)[0].width)
      .toBeCloseTo(RenderingService.glowLayers(base, 1)[0].width);
  });

  test('extraScale multiplies the added width (zoom × graphics scale)', () => {
    const x1 = RenderingService.glowLayers(base, 1, 1)[0].width - base;
    const x2 = RenderingService.glowLayers(base, 1, 2)[0].width - base;
    expect(x2).toBeCloseTo(x1 * 2);
  });

  test('each layer uses the configured per-layer alpha within (0,1)', () => {
    RenderingService.glowLayers(base, 0.5).forEach(l => {
      expect(l.alpha).toBe(RENDERING.PATH_GLOW_LAYER_ALPHA);
      expect(l.alpha).toBeGreaterThan(0);
      expect(l.alpha).toBeLessThan(1);
    });
  });
});

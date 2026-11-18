/**
 * LABEL-01 — auto-position runs at the right moments, and only then.
 *
 * The owner's judgement was that auto-position itself works well; what was
 * wrong was *when* it ran and how findable it was. Three contracts follow from
 * that, and they pull against each other, which is why they are pinned:
 *
 *   1. A label placed by the author is never moved out from under them.
 *   2. Asking for it explicitly still always works — being asked for is not
 *      the same as it happening to you.
 *   3. The offer to re-place appears only when the label actually collides.
 */

import { describe, test, expect, vi } from 'vitest';
import { wiringDomMixin } from '../src/app/wiringDom.js';
import { TextLabelService } from '../src/services/TextLabelService.js';
import { Waypoint } from '../src/models/Waypoint.js';

/** A host carrying only what the two mixin methods actually read. */
function makeHost(waypoints, { pathPoints = [{ x: 0.5, y: 0.5 }] } = {}) {
  return {
    waypoints,
    pathPoints,
    canvas: { width: 800, height: 450 },
    coordinateTransform: { imageToCanvas: (x, y) => ({ x: x * 800, y: y * 450 }) },
    elements: {},
    eventBus: { emit: vi.fn() },
    selectedWaypoint: waypoints[0] ?? null,
    showToast: vi.fn(),
    applyAutoPosition: wiringDomMixin.applyAutoPosition,
    offerAutoPositionIfColliding: wiringDomMixin.offerAutoPositionIfColliding,
  };
}

function labelledWaypoint(overrides = {}) {
  const wp = Waypoint.createMajor(0.5, 0.5);
  wp.label = 'Trent Building';
  return Object.assign(wp, overrides);
}

describe('the hand-placed flag', () => {
  test('a new waypoint has not been placed by hand', () => {
    expect(Waypoint.createMajor(0.1, 0.1).labelPlacedByHand).toBe(false);
  });

  test('it survives a save and reload', () => {
    const wp = labelledWaypoint({ labelPlacedByHand: true });
    const restored = Waypoint.fromJSON(JSON.parse(JSON.stringify(wp.toJSON())));

    expect(restored.labelPlacedByHand).toBe(true);
  });

  test('an older saved waypoint restores as not placed by hand', () => {
    // Projects predating LABEL-01 carry no flag, and must stay eligible for
    // the automatic placement rather than being frozen where they are.
    const json = labelledWaypoint().toJSON();
    delete json.labelPlacedByHand;

    expect(Waypoint.fromJSON(json).labelPlacedByHand).toBe(false);
  });

  test('it is not propagated by Apply onward', () => {
    // Where a label sits is per-waypoint authoring state, not a style. Copying
    // it would silently freeze every downstream label too.
    const source = labelledWaypoint({ labelPlacedByHand: true, labelOffsetX: 12 });
    const target = labelledWaypoint();
    target.copyPropertiesFrom(source);

    expect(target.labelPlacedByHand).toBe(false);
  });
});

describe('applying auto-position', () => {
  test('it moves the label and leaves it still eligible', () => {
    // The algorithm placing a label is not the author placing it — marking it
    // by hand here would silence the very offer this ticket adds.
    const wp = labelledWaypoint({ labelOffsetX: 0, labelOffsetY: 0 });
    const host = makeHost([wp]);

    host.applyAutoPosition([wp]);

    expect(wp.labelPlacedByHand).toBe(false);
    expect(Number.isFinite(wp.labelOffsetX)).toBe(true);
    expect(Number.isFinite(wp.labelOffsetY)).toBe(true);
    expect(host.eventBus.emit).toHaveBeenCalledWith('waypoint:style-changed', wp);
  });

  test('an empty target list is a no-op, not a crash', () => {
    const host = makeHost([]);
    expect(() => host.applyAutoPosition([])).not.toThrow();
    expect(host.eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('offering to re-place a colliding label', () => {
  test('a colliding label gets one offer carrying the action', () => {
    const wp = labelledWaypoint();
    const host = makeHost([wp]);
    vi.spyOn(TextLabelService, 'collidesAtCurrentPosition').mockReturnValue(true);

    const offered = host.offerAutoPositionIfColliding(wp);

    expect(offered).toBe(true);
    expect(host.showToast).toHaveBeenCalledTimes(1);
    const [, , action] = host.showToast.mock.calls[0];
    expect(action.label).toBe('Auto-position');

    // The offer must actually do the thing it offers.
    action.onClick();
    expect(host.eventBus.emit).toHaveBeenCalledWith('waypoint:style-changed', wp);
    TextLabelService.collidesAtCurrentPosition.mockRestore();
  });

  test('a label that fits is left alone and says nothing', () => {
    const wp = labelledWaypoint();
    const host = makeHost([wp]);
    vi.spyOn(TextLabelService, 'collidesAtCurrentPosition').mockReturnValue(false);

    expect(host.offerAutoPositionIfColliding(wp)).toBe(false);
    expect(host.showToast).not.toHaveBeenCalled();
    TextLabelService.collidesAtCurrentPosition.mockRestore();
  });

  test('nothing is offered without a label or a path to collide with', () => {
    const noLabel = Waypoint.createMajor(0.5, 0.5);
    expect(makeHost([noLabel]).offerAutoPositionIfColliding(noLabel)).toBe(false);

    const wp = labelledWaypoint();
    const noPath = makeHost([wp], { pathPoints: [] });
    expect(noPath.offerAutoPositionIfColliding(wp)).toBe(false);
    expect(noPath.showToast).not.toHaveBeenCalled();

    expect(makeHost([]).offerAutoPositionIfColliding(null)).toBe(false);
  });
});

describe('collision detection at the authored position', () => {
  test('a label parked on its own marker collides', () => {
    const wp = labelledWaypoint({ labelOffsetX: 0, labelOffsetY: 0 });
    const collides = TextLabelService.collidesAtCurrentPosition({
      waypoint: wp,
      waypointIndex: 0,
      waypoints: [wp],
      pathPoints: [{ x: 0.5, y: 0.5 }],
      canvasWidth: 800,
      canvasHeight: 450,
      imageToCanvas: (x, y) => ({ x: x * 800, y: y * 450 }),
    });

    expect(collides).toBe(true);
  });

  test('an unlabelled waypoint never collides', () => {
    const wp = Waypoint.createMajor(0.5, 0.5);
    expect(TextLabelService.collidesAtCurrentPosition({
      waypoint: wp, waypointIndex: 0, waypoints: [wp], pathPoints: [],
      canvasWidth: 800, canvasHeight: 450, imageToCanvas: (x, y) => ({ x, y }),
    })).toBe(false);
  });
});

import { describe, expect, test, vi } from 'vitest';

import { wiringBusMixin } from '../src/app/wiringBus.js';
import { EventBus } from '../src/core/EventBus.js';

function makeApp() {
  return {
    eventBus: new EventBus(),
    waypoints: [{ id: 'waypoint-1' }],
    exportSettings: { backgroundZoom: 100 },
    calculatePath: vi.fn(),
    queueRender: vi.fn(),
    saveUndoState: vi.fn(),
    saveUndoStateDebounced: vi.fn(),
    autoSave: vi.fn(),
    updateWaypointList: vi.fn(),
    updateWaypointEditor: vi.fn(),
    updateAnimationDuration: vi.fn(),
    recalculateDurationWithSegmentSpeeds: vi.fn(),
    animationEngine: { dumpSegmentState: vi.fn() },
    _syncWaypointCardActions: vi.fn(),
    uiController: { updateWaypointList: vi.fn() },
  };
}

describe('waypoint style-change event contract', () => {
  test('ordinary edits retain the Waypoint payload and schedule one history save', () => {
    const app = makeApp();
    wiringBusMixin.setupEventBusListeners.call(app);
    const observer = vi.fn();
    app.eventBus.on('waypoint:style-changed', observer);

    app.eventBus.emit('waypoint:style-changed', app.waypoints[0]);

    expect(observer).toHaveBeenCalledWith(app.waypoints[0]);
    expect(app.queueRender).toHaveBeenCalledTimes(1);
    expect(app.uiController.updateWaypointList).toHaveBeenCalledWith(app.waypoints);
    expect(app.saveUndoStateDebounced).toHaveBeenCalledTimes(1);
    expect(app.autoSave).toHaveBeenCalledTimes(1);
    expect(app._syncWaypointCardActions).toHaveBeenCalledTimes(1);
  });

  test('an image commit skips only the duplicate history save', () => {
    const app = makeApp();
    wiringBusMixin.setupEventBusListeners.call(app);
    const options = { historyAlreadySaved: true };
    const observer = vi.fn();
    app.eventBus.on('waypoint:style-changed', observer);

    app.eventBus.emit('waypoint:style-changed', app.waypoints[0], options);

    expect(observer).toHaveBeenCalledWith(app.waypoints[0], options);
    expect(app.queueRender).toHaveBeenCalledTimes(1);
    expect(app.uiController.updateWaypointList).toHaveBeenCalledWith(app.waypoints);
    expect(app.saveUndoStateDebounced).not.toHaveBeenCalled();
    expect(app.autoSave).toHaveBeenCalledTimes(1);
    expect(app._syncWaypointCardActions).toHaveBeenCalledTimes(1);
  });

  test('path, arrival, and speed edits also refresh card action availability', () => {
    const app = makeApp();
    wiringBusMixin.setupEventBusListeners.call(app);

    app.eventBus.emit('waypoint:path-property-changed', app.waypoints[0]);
    app.eventBus.emit('waypoint:pause-changed', {
      waypoint: app.waypoints[0], pauseTime: 500, pauseMode: 'continuous'
    });
    app.eventBus.emit('waypoint:speed-changed', {
      waypoint: app.waypoints[0], segmentSpeed: 1
    });

    expect(app._syncWaypointCardActions).toHaveBeenCalledTimes(3);
  });
});

describe('waypoint pointer-drag transaction', () => {
  test('moves a group by one shared bounds-safe delta and commits once', () => {
    const app = makeApp();
    const a = { id: 'a', imgX: 0.8, imgY: 0.2 };
    const b = { id: 'b', imgX: 0.95, imgY: 0.4 };
    app.waypoints = [a, b];
    wiringBusMixin.setupEventBusListeners.call(app);
    const dragGroup = [
      { waypoint: a, imgX: 0.8, imgY: 0.2 },
      { waypoint: b, imgX: 0.95, imgY: 0.4 },
    ];

    app.eventBus.emit('waypoint:position-changed', {
      waypoint: a,
      imgX: 1.2,
      imgY: 0.5,
      dragGroup,
      isDragging: true,
    });

    // B limits dx to +0.05; both retain the same +0.05/+0.3 delta.
    expect(a.imgX).toBeCloseTo(0.85);
    expect(a.imgY).toBeCloseTo(0.5);
    expect(b.imgX).toBeCloseTo(1);
    expect(b.imgY).toBeCloseTo(0.7);
    expect(app.calculatePath).toHaveBeenCalledTimes(1);
    expect(app.queueRender).toHaveBeenCalledTimes(1);
    expect(app.saveUndoState).not.toHaveBeenCalled();
    expect(app.autoSave).not.toHaveBeenCalled();

    app.eventBus.emit('waypoint:drag-ended', { waypoint: a, dragGroup });
    expect(app.saveUndoState).toHaveBeenCalledTimes(1);
    expect(app.updateWaypointList).toHaveBeenCalledTimes(1);
    expect(app.autoSave).toHaveBeenCalledTimes(1);
  });

  test('cancel restores the immutable group snapshot without a commit', () => {
    const app = makeApp();
    const a = { id: 'a', imgX: 0.2, imgY: 0.3 };
    const b = { id: 'b', imgX: 0.6, imgY: 0.7 };
    app.waypoints = [a, b];
    wiringBusMixin.setupEventBusListeners.call(app);
    const positions = [
      { waypoint: a, imgX: 0.2, imgY: 0.3 },
      { waypoint: b, imgX: 0.6, imgY: 0.7 },
    ];
    a.imgX = 0.4;
    a.imgY = 0.5;
    b.imgX = 0.8;
    b.imgY = 0.9;

    app.eventBus.emit('waypoint:drag-cancelled', { waypoint: a, positions });

    expect(a).toMatchObject({ imgX: 0.2, imgY: 0.3 });
    expect(b).toMatchObject({ imgX: 0.6, imgY: 0.7 });
    expect(app.calculatePath).toHaveBeenCalledTimes(1);
    expect(app.updateWaypointEditor).toHaveBeenCalledTimes(1);
    expect(app.saveUndoState).not.toHaveBeenCalled();
    expect(app.autoSave).not.toHaveBeenCalled();
  });

  test('a drag that returns to its exact start creates no history or autosave', () => {
    const app = makeApp();
    const waypoint = { id: 'a', imgX: 0.25, imgY: 0.5 };
    app.waypoints = [waypoint];
    wiringBusMixin.setupEventBusListeners.call(app);
    const dragGroup = [{ waypoint, imgX: 0.25, imgY: 0.5 }];

    app.eventBus.emit('waypoint:drag-ended', { waypoint, dragGroup });

    expect(app.saveUndoState).not.toHaveBeenCalled();
    expect(app.updateWaypointList).not.toHaveBeenCalled();
    expect(app.autoSave).not.toHaveBeenCalled();
  });
});

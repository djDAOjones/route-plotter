import { describe, expect, test, vi } from 'vitest';

import { wiringBusMixin } from '../src/app/wiringBus.js';
import { EventBus } from '../src/core/EventBus.js';

function makeApp() {
  return {
    eventBus: new EventBus(),
    waypoints: [{ id: 'waypoint-1' }],
    queueRender: vi.fn(),
    saveUndoStateDebounced: vi.fn(),
    autoSave: vi.fn(),
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
  });
});

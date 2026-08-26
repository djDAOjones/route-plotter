import { describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { AreaEditService } from '../src/services/AreaEditService.js';
import { AreaDrawingService } from '../src/services/AreaDrawingService.js';
import { findAreaHandleAtScreen } from '../src/app/wiringControllers.js';

function makeAreaWaypoint(areaHighlight) {
  return {
    areaHighlight,
    hasAreaHighlight() {
      return Boolean(this.areaHighlight);
    },
  };
}

const imageToScreen = (x, y) => ({
  x: x * 2000 - 300,
  y: y * 1600 + 120,
});

describe('area edit handle coordinates', () => {
  test('circle handles keep an eight-screen-pixel target through zoom and pan', () => {
    const bus = new EventBus();
    const service = new AreaEditService(bus);
    const waypoint = makeAreaWaypoint({
      shape: 'circle',
      centerX: 0.4,
      centerY: 0.3,
    });
    const center = imageToScreen(0.4, 0.3);
    const app = {
      selectedWaypoint: waypoint,
      areaEditService: service,
      imageToScreen,
    };

    expect(findAreaHandleAtScreen(app, center.x, center.y)).toMatchObject({
      type: 'center',
      waypoint,
    });
    expect(findAreaHandleAtScreen(app, center.x + 8, center.y)).not.toBeNull();
    expect(findAreaHandleAtScreen(app, center.x + 8.01, center.y)).toBeNull();
  });

  test('polygon press selects the transformed vertex and commits one change', () => {
    const bus = new EventBus();
    const service = new AreaEditService(bus);
    const waypoint = makeAreaWaypoint({
      shape: 'polygon',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.7, y: 0.25 },
        { x: 0.5, y: 0.8 },
      ],
    });
    const changed = vi.fn();
    const rendered = vi.fn();
    const selected = vi.fn();
    bus.on('area:changed', changed);
    bus.on('render:request', rendered);
    bus.on('area:vertex-selected', selected);

    const second = imageToScreen(0.7, 0.25);
    expect(service.hitTest(waypoint, second.x + 7.9, second.y, imageToScreen)).toEqual({
      type: 'vertex',
      vertexIndex: 1,
    });
    expect(service.hitTest(waypoint, second.x + 8.1, second.y, imageToScreen)).toBeNull();

    bus.emit('area:edit-start', {
      waypoint,
      imgX: 0.7,
      imgY: 0.25,
      imageToScreen,
    });
    bus.emit('area:edit-move', { imgX: 0.75, imgY: 0.35 });
    bus.emit('area:edit-end');

    expect(waypoint.areaHighlight.points[0]).toEqual({ x: 0.2, y: 0.2 });
    expect(waypoint.areaHighlight.points[1]).toEqual({ x: 0.75, y: 0.35 });
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ waypoint });
    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith({ waypoint, index: 1 });
  });

  test('successful project boundaries clear modal draw and edit state but failed loads do not', () => {
    document.body.innerHTML = '';
    const bus = new EventBus();
    const drawing = new AreaDrawingService(bus);
    const editing = new AreaEditService(bus);
    const waypoint = makeAreaWaypoint({
      shape: 'polygon',
      points: [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.25 }, { x: 0.5, y: 0.8 }],
    });

    bus.emit('area:draw-start', { waypoint });
    bus.emit('area:edit-start', { waypoint, imgX: 0.2, imgY: 0.2, imageToScreen });
    expect(drawing.isDrawing).toBe(true);
    expect(drawing.targetWaypoint).toBe(waypoint);
    expect(editing.isDragging).toBe(true);
    expect(editing.activeWaypoint).toBe(waypoint);
    expect(document.getElementById('area-draw-banner')).not.toBeNull();

    bus.emit('project:load-failed');
    expect(drawing.isDrawing).toBe(true);
    expect(editing.isDragging).toBe(true);

    bus.emit('project:replaced');
    expect(drawing.isDrawing).toBe(false);
    expect(drawing.targetWaypoint).toBeNull();
    expect(drawing._keyHandler).toBeNull();
    expect(document.getElementById('area-draw-banner')).toBeNull();
    expect(editing).toMatchObject({
      isDragging: false,
      dragTarget: null,
      dragVertexIndex: -1,
      activeWaypoint: null,
    });

    bus.emit('area:draw-start', { waypoint });
    bus.emit('waypoint:selected', waypoint);
    expect(drawing.isDrawing).toBe(true);
    expect(editing.activeWaypoint).toBe(waypoint);
    bus.emit('app:cleared');
    expect(drawing.isDrawing).toBe(false);
    expect(editing.activeWaypoint).toBeNull();
  });
});

import { describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { AreaEditService } from '../src/services/AreaEditService.js';
import { AreaDrawingService } from '../src/services/AreaDrawingService.js';
import { findAreaHandleAtScreen } from '../src/app/wiringControllers.js';
import { sceneOutlineKey } from '../src/utils/sceneSemantics.js';
import { MIXED_OPTION_VALUE } from '../src/utils/mixedControlState.js';
import { bootApp } from './helpers/bootApp.js';

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

  test('area drag release commits only when final geometry differs from drag start', () => {
    const bus = new EventBus();
    new AreaEditService(bus);
    const waypoint = makeAreaWaypoint({
      shape: 'circle',
      centerX: 0.4,
      centerY: 0.3,
    });
    const changed = vi.fn();
    bus.on('area:changed', changed);

    bus.emit('area:edit-start', { waypoint, imgX: 0.4, imgY: 0.3, imageToScreen });
    bus.emit('area:edit-move', { imgX: 0.4, imgY: 0.3 });
    bus.emit('area:edit-end');
    expect(changed).not.toHaveBeenCalled();

    bus.emit('area:edit-start', { waypoint, imgX: 0.4, imgY: 0.3, imageToScreen });
    bus.emit('area:edit-move', { imgX: 0.7, imgY: 0.8 });
    bus.emit('area:edit-move', { imgX: 0.4, imgY: 0.3 });
    bus.emit('area:edit-end');
    expect(changed).not.toHaveBeenCalled();

    bus.emit('area:edit-start', { waypoint, imgX: 0.4, imgY: 0.3, imageToScreen });
    bus.emit('area:edit-move', { imgX: 0.6, imgY: 0.5 });
    bus.emit('area:edit-end');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ waypoint });
  });

  test('area:edit-cancel restores polygon geometry byte-for-byte without a commit', () => {
    const bus = new EventBus();
    const service = new AreaEditService(bus);
    const waypoint = makeAreaWaypoint({
      shape: 'polygon',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.7, y: 0.25, retained: 'metadata' },
        { x: 0.5, y: 0.8 },
      ],
    });
    const before = JSON.stringify(waypoint.areaHighlight);
    const changed = vi.fn();
    const rendered = vi.fn();
    bus.on('area:changed', changed);
    bus.on('render:request', rendered);

    bus.emit('area:edit-start', {
      waypoint,
      imgX: 0.7,
      imgY: 0.25,
      imageToScreen,
    });
    bus.emit('area:edit-move', { imgX: 0.95, imgY: 0.05 });
    expect(JSON.stringify(waypoint.areaHighlight)).not.toBe(before);

    bus.emit('area:edit-cancel');

    expect(JSON.stringify(waypoint.areaHighlight)).toBe(before);
    expect(service).toMatchObject({
      isDragging: false,
      dragTarget: null,
      dragVertexIndex: -1,
      _dragChanged: false,
    });
    expect(changed).not.toHaveBeenCalled();
    expect(rendered).toHaveBeenCalledTimes(2);

    // A stale release after cancellation remains an inert no-op.
    bus.emit('area:edit-end');
    expect(changed).not.toHaveBeenCalled();
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

describe('drawing a polygon (DEF-17)', () => {
  const TRIANGLE = [[0.2, 0.2], [0.4, 0.2], [0.3, 0.4]];

  /** A ready app drawing a polygon for its first waypoint, three vertices placed. */
  async function drawingThreeVertices() {
    const app = await bootApp();
    await app.ready;
    app.eventBus.emit('waypoint:add', { imgX: 0.3, imgY: 0.3, isMajor: true });
    app.eventBus.emit('waypoint:add', { imgX: 0.7, imgY: 0.7, isMajor: true });
    const [waypoint, other] = app.waypoints;
    app.eventBus.emit('waypoint:selected', waypoint);

    // As an author does: choose Draw, then press Draw Area.
    const shape = document.getElementById('area-shape');
    shape.value = 'polygon';
    shape.dispatchEvent(new Event('change'));
    document.getElementById('area-draw-btn').click();
    expect(app.areaDrawingService.isDrawing).toBe(true);
    for (const [imgX, imgY] of TRIANGLE) {
      app.eventBus.emit('area:draw-click', { imgX, imgY });
    }
    return { app, waypoint, other };
  }

  function closePolygon(app) {
    const [imgX, imgY] = TRIANGLE[0];
    app.eventBus.emit('area:draw-click', { imgX, imgY });
    expect(app.areaDrawingService.isDrawing).toBe(false);
  }

  /** The outline's pressed Select buttons, once its queued redraw has run. */
  async function pressedInOutline() {
    await Promise.resolve();
    return [...document.querySelectorAll('#scene-outline [aria-pressed="true"]')]
      .map(select => select.dataset.outlineKey);
  }

  test('finishing one names its waypoint, so the sidebar and the outline follow it', async () => {
    // The drawing tool forgot its waypoint before announcing the polygon, so
    // both announcements named no waypoint: the waypoint editor did not
    // refresh and the scene outline did not select the new polygon.
    const { app, waypoint } = await drawingThreeVertices();
    // The banner promises only what closes a polygon.
    expect(document.getElementById('area-draw-banner').textContent)
      .not.toMatch(/double[\s‐‑-]?(click|tap)|dbl/i);

    const changed = vi.fn();
    const completed = vi.fn();
    app.eventBus.on('area:changed', changed);
    app.eventBus.on('area:draw-completed', completed);
    const editorRefreshes = vi.spyOn(app.uiController, 'updateWaypointEditor');
    closePolygon(app);

    expect(waypoint.areaHighlight.points).toEqual([{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.4 }]);
    expect(changed).toHaveBeenLastCalledWith({ waypoint });
    expect(completed).toHaveBeenCalledWith({ waypoint });
    expect(editorRefreshes).toHaveBeenCalledWith(waypoint);
    const polygon = sceneOutlineKey('polygon', waypoint.id);
    expect(app._sceneOutlineSelectionKey).toBe(polygon);
    expect(await pressedInOutline()).toEqual([`${polygon}:select`]);
  });

  // Drawing locks only the canvas's left click, so the list, the context menu
  // and the keyboard can change the selection before the polygon closes.
  test('a waypoint selected during the draw stays the selection', async () => {
    const { app, waypoint, other } = await drawingThreeVertices();
    app.eventBus.emit('waypoint:selected', other);
    const editorRefreshes = vi.spyOn(app.uiController, 'updateWaypointEditor');
    closePolygon(app);

    expect(editorRefreshes.mock.calls.map(([shown]) => shown)).not.toContain(waypoint);
    const selected = sceneOutlineKey('waypoint', other.id);
    expect(app._sceneOutlineSelectionKey).toBe(selected);
    expect(await pressedInOutline()).toEqual([`${selected}:select`]);
  });

  test('a multi-selection made during the draw keeps its scope and mixed states', async () => {
    const { app, waypoint, other } = await drawingThreeVertices();
    app.eventBus.emit('waypoint:multi-selected', { waypoints: [waypoint, other], primary: waypoint });
    closePolygon(app);

    expect(app.selectedWaypoints).toEqual([waypoint, other]);
    expect(document.getElementById('scope-chip').dataset.scope).toBe('multi');
    expect(document.getElementById('scope-chip-text').textContent).toContain('2 waypoints');
    expect(document.getElementById('area-shape').value).toBe(MIXED_OPTION_VALUE);
    expect(document.getElementById('area-draw-btn').disabled).toBe(true);
    const selected = sceneOutlineKey('waypoint', waypoint.id);
    expect(app._sceneOutlineSelectionKey).toBe(selected);
    expect(await pressedInOutline()).toEqual([`${selected}:select`]);
  });
});

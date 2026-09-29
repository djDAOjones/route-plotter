/**
 * DEF-43 — a polygon draw outlives its target.
 *
 * Draw Area draws a polygon for the selected waypoint, vertex by vertex on
 * the canvas, and closing it writes the polygon to that waypoint. Only a
 * project replacement or Clear All ended a draw, so deleting the waypoint
 * (the list's ×) or undoing past it left the tool drawing, and closing the
 * polygon wrote it to a waypoint the project no longer had: lost, without a
 * word. An undo that kept the waypoint lost it too, since undo restores
 * copies. And focus stays on Draw Area through the canvas clicks, so Space or
 * Enter asked for the draw again, which discarded the vertices placed so far.
 * Now a draw follows its waypoint to the restored copy, or ends and says so
 * when it has gone; and asking again for the draw in progress keeps it.
 */

import { expect, test, vi } from 'vitest';
import { bootApp } from './helpers/bootApp.js';
import { loadSnapshot } from './helpers/projectSnapshot.js';
import { buildExampleProjects } from '../src/examples/index.js';

const GONE = 'Area drawing cancelled: its waypoint was removed.';
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

async function openDay() {
  const app = await bootApp();
  await app.ready;
  const project = structuredClone(buildExampleProjects().find(each => each.id === 'uon-open-day').project);
  expect(await loadSnapshot(app, project)).toBe(true);
  return app;
}

/** Select `waypoint` and press Draw Area, as the author does. */
function drawFor(app, waypoint) {
  app.eventBus.emit('waypoint:selected', waypoint);
  document.getElementById('area-draw-btn').click();
}

/** A canvas click during the draw, at image coordinates. */
const place = (app, x, y) => app.eventBus.emit('area:draw-click', { imgX: x, imgY: y });

const drawing = app => ({
  active: app.areaDrawingService.isDrawing,
  vertices: app.areaDrawingService.vertices.length,
  banner: Boolean(document.getElementById('area-draw-banner')),
});

test('a draw whose waypoint is deleted ends, and says so', async () => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  place(app, 0.2, 0.2);
  place(app, 0.4, 0.2);
  const announce = vi.spyOn(app, 'announce');

  app.eventBus.emit('waypoint:delete', target);
  await nextTask();

  expect(drawing(app)).toEqual({ active: false, vertices: 0, banner: false });
  expect(announce).toHaveBeenCalledWith(GONE, 'assertive');
  // Nothing more is drawn, for it or anything else.
  place(app, 0.4, 0.4);
  expect(drawing(app).vertices).toBe(0);
});

test('a draw whose waypoint an undo takes away ends, and says so', async () => {
  const app = await openDay();
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
  await nextTask();
  const added = app.waypoints.at(-1);
  drawFor(app, added);
  place(app, 0.2, 0.2);
  const announce = vi.spyOn(app, 'announce');

  app.undo();

  expect(app.getWaypointById(added.id)).toBeUndefined();
  expect(drawing(app)).toEqual({ active: false, vertices: 0, banner: false });
  expect(announce).toHaveBeenCalledWith(GONE, 'assertive');
});

test('a draw goes on through an undo that keeps its waypoint, and its polygon lands on the waypoint the project has', async () => {
  const app = await openDay();
  // An edit to undo, made before the draw.
  app.eventBus.emit('waypoint:add', { imgX: 0.9, imgY: 0.9, isMajor: true });
  await nextTask();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  place(app, 0.2, 0.2);
  place(app, 0.4, 0.2);
  place(app, 0.3, 0.4);
  const announce = vi.spyOn(app, 'announce');

  app.undo();
  expect(drawing(app)).toMatchObject({ active: true, vertices: 3, banner: true });
  place(app, 0.2, 0.2);

  const live = app.getWaypointById('ex-uon-2');
  expect(live.areaHighlight).toMatchObject({
    shape: 'polygon',
    enabled: true,
    points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.4 }],
  });
  expect(app._buildProjectSnapshot().waypoints.find(each => each.id === 'ex-uon-2').areaHighlight.points)
    .toEqual([{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.2 }, { x: 0.3, y: 0.4 }]);
  expect(announce).not.toHaveBeenCalledWith(GONE, 'assertive');
});

test('Draw Area asked for again, as Space or Enter on it does, keeps the draw in progress', async () => {
  const app = await openDay();
  const target = app.getWaypointById('ex-uon-2');
  drawFor(app, target);
  place(app, 0.2, 0.2);
  place(app, 0.4, 0.2);

  document.getElementById('area-draw-btn').click();

  expect(drawing(app)).toEqual({ active: true, vertices: 2, banner: true });
  expect(app.areaDrawingService.targetWaypoint).toBe(target);
  expect(document.querySelector('#area-draw-banner .banner-count').textContent).toBe('2 vertices (1 more needed to close)');
});

test('Draw Area for another waypoint starts that waypoint’s draw afresh', async () => {
  const app = await openDay();
  drawFor(app, app.getWaypointById('ex-uon-2'));
  place(app, 0.2, 0.2);

  const other = app.getWaypointById('ex-uon-3');
  drawFor(app, other);

  expect(drawing(app)).toEqual({ active: true, vertices: 0, banner: true });
  expect(app.areaDrawingService.targetWaypoint).toBe(other);
});

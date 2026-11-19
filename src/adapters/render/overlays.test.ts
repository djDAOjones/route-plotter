// CORE-04 stage 6: v3's four overlay shapes, in screen pixels, through the draw recorder. Every figure is v3's, from
// `v3/src/services/RenderingService.js` at the lines named, read at a zoom of 1, where v3's clamp factor is 1.
import { expect, test } from 'vitest';
import type { DrawContext } from './context';
import { hoverRing, plusHandle, selectionRect, selectionRing, unitAt } from './overlays';
import { Recorder } from './recorder';

const AT = '@ 1 0 0 1 0 0';

type Shape = (context: DrawContext) => void;

const SHAPES = {
  'selection ring': (context) => selectionRing(context, { x: 100, y: 50 }, 20),
  'selection rectangle': (context) => selectionRect(context, { x: 10, y: 20, width: 30, height: 40 }),
  'hover ring': (context) => hoverRing(context, { x: 5, y: 6 }, 7),
  '"+" handle': (context) => plusHandle(context, { x: 1, y: 2 }, false),
  'active "+" handle': (context) => plusHandle(context, { x: 1, y: 2 }, true),
} satisfies Record<string, Shape>;

function drawn(shape: Shape, context = new Recorder()): string[] {
  shape(context);
  return context.take();
}

/** A recorder left as a careless drawing would leave it: faint, dashed, offset, round-capped, wide, coloured. */
function dirtied(): Recorder {
  const context = new Recorder();
  context.globalAlpha = 0.3;
  context.globalCompositeOperation = 'multiply';
  context.setLineDash([5, 7]);
  context.lineDashOffset = 3;
  context.lineCap = 'round';
  context.lineJoin = 'bevel';
  context.lineWidth = 9;
  context.strokeStyle = 'red';
  context.fillStyle = 'green';
  return context;
}

test('the selection ring is v3’s: ten dashes, white under black offset by one, butt caps, 3 wide', () => {
  // :190–208: segment = circumference / 10 = 2π × 20 / 10; white at offset 0, then black at −segment.
  expect(drawn(SHAPES['selection ring'])).toEqual([
    'save',
    'beginPath',
    `arc 100 50 20 0 6.283 clockwise ${AT}`,
    `stroke | ${AT} | strokeStyle=white lineWidth=3 lineDash=12.566,12.566`,
    'beginPath',
    `arc 100 50 20 0 6.283 clockwise ${AT}`,
    `stroke | ${AT} | strokeStyle=black lineWidth=3 lineDashOffset=-12.566 lineDash=12.566,12.566`,
    'beginPath',
    'restore',
  ]);
  // A bend's selected ring is 2 wide (:2510–2514): the width is the caller's.
  expect(drawn((context) => selectionRing(context, { x: 0, y: 0 }, 10, 2)).filter((line) => line.startsWith('stroke'))).toEqual([
    `stroke | ${AT} | strokeStyle=white lineWidth=2 lineDash=6.283,6.283`,
    `stroke | ${AT} | strokeStyle=black lineWidth=2 lineDashOffset=-6.283 lineDash=6.283,6.283`,
  ]);
});

test('the selection rectangle is v3’s: six dashes round the box, white under black offset by one, 3 wide', () => {
  // :226–241: segment = perimeter / 6 = 2 × (30 + 40) / 6.
  expect(drawn(SHAPES['selection rectangle'])).toEqual([
    'save',
    'beginPath',
    `strokeRect 10 20 30 40 | ${AT} | strokeStyle=white lineWidth=3 lineDash=23.333,23.333`,
    `strokeRect 10 20 30 40 | ${AT} | strokeStyle=black lineWidth=3 lineDashOffset=-23.333 lineDash=23.333,23.333`,
    'beginPath',
    'restore',
  ]);
});

test('the hover ring is v3’s: white at 0.9, 4 wide, under the accent #0f62fe, 2 wide, solid', () => {
  // :252–264, the accent from constants.js:48.
  expect(drawn(SHAPES['hover ring'])).toEqual([
    'save',
    'beginPath',
    `arc 5 6 7 0 6.283 clockwise ${AT}`,
    `stroke | ${AT} | strokeStyle=rgba(255, 255, 255, 0.9) lineWidth=4`,
    `stroke | ${AT} | strokeStyle=#0f62fe lineWidth=2`,
    'beginPath',
    'restore',
  ]);
});

test('the "+" handle is v3’s: radius 9, or 11 active, edged 1.5 wide, arms half the radius, 2 wide, round caps', () => {
  // :424–450: idle, white at 0.95 edged in the accent; active, the accent edged in white.
  const arms = (x: number, y: number, arm: number) => [
    'beginPath',
    `moveTo ${x - arm} ${y} ${AT}`,
    `lineTo ${x + arm} ${y} ${AT}`,
    `moveTo ${x} ${y - arm} ${AT}`,
    `lineTo ${x} ${y + arm} ${AT}`,
  ];
  expect(drawn(SHAPES['"+" handle'])).toEqual([
    'save',
    'beginPath',
    `arc 1 2 9 0 6.283 clockwise ${AT}`,
    `fill | ${AT} | fillStyle=rgba(255, 255, 255, 0.95)`,
    `stroke | ${AT} | strokeStyle=#0f62fe lineWidth=1.5`,
    ...arms(1, 2, 4.5),
    `stroke | ${AT} | strokeStyle=#0f62fe lineWidth=2 lineCap=round`,
    'beginPath',
    'restore',
  ]);
  expect(drawn(SHAPES['active "+" handle'])).toEqual([
    'save',
    'beginPath',
    `arc 1 2 11 0 6.283 clockwise ${AT}`,
    `fill | ${AT} | fillStyle=#0f62fe`,
    `stroke | ${AT} | strokeStyle=#ffffff lineWidth=1.5`,
    ...arms(1, 2, 5.5),
    `stroke | ${AT} | strokeStyle=#ffffff lineWidth=2 lineCap=round`,
    'beginPath',
    'restore',
  ]);
});

test('each shape sets its own alpha, dash, offset, cap, width and colours, and leaves the earlier state behind it', () => {
  // Straight onto the recorder, with no isolated() round it: what a careless drawing left is in none of its lines
  // (the recorder writes a style only where it is not the canvas's default), and is all there again afterwards.
  for (const [name, shape] of Object.entries(SHAPES)) {
    const context = dirtied();
    const before = context.state();
    expect(drawn(shape, context), name).toEqual(drawn(shape));
    expect(context.state(), name).toEqual(before);
    expect(before.styles).toMatchObject({ globalAlpha: '0.3', lineDash: '5,7', lineDashOffset: '3', lineCap: 'round' });
  }
});

test('sizes grow with the zoom as v3’s did on screen, up to 3×, and are then held', () => {
  // v3 drew under its viewport's zoom z with sizes times 3 / z past 3 (:105–116, :1511): on screen, w × min(z, 3).
  expect([0.5, 1, 2, 3, 6, 12].map(unitAt)).toEqual([0.5, 1, 2, 3, 3, 3]);
  const strokes = (shape: Shape) => drawn(shape).filter((line) => line.startsWith('stroke'));
  expect(strokes((context) => hoverRing(context, { x: 0, y: 0 }, 30, unitAt(6)))).toEqual([
    `stroke | ${AT} | strokeStyle=rgba(255, 255, 255, 0.9) lineWidth=12`,
    `stroke | ${AT} | strokeStyle=#0f62fe lineWidth=6`,
  ]);
  expect(drawn((context) => plusHandle(context, { x: 0, y: 0 }, true, unitAt(2)))).toContain(`arc 0 0 22 0 6.283 clockwise ${AT}`);
  // A radius the caller gives is screen pixels as it stands.
  expect(drawn((context) => plusHandle(context, { x: 0, y: 0 }, false, 2, 5))).toContain(`arc 0 0 5 0 6.283 clockwise ${AT}`);
});

test('a shape whose figures are not finite, or whose size is not above 0, draws nothing and changes nothing', () => {
  const odd: Shape[] = [
    (context) => selectionRing(context, { x: Number.NaN, y: 0 }, 5),
    (context) => selectionRing(context, { x: 0, y: 0 }, -5),
    (context) => selectionRing(context, { x: 0, y: 0 }, 5, 0),
    (context) => selectionRect(context, { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 4 }),
    (context) => selectionRect(context, { x: 0, y: 0, width: 4, height: 0 }),
    (context) => hoverRing(context, { x: 0, y: Number.NEGATIVE_INFINITY }, 5),
    (context) => hoverRing(context, { x: 0, y: 0 }, 5, Number.NaN),
    (context) => plusHandle(context, { x: 0, y: 0 }, false, 0),
    (context) => plusHandle(context, { x: 0, y: 0 }, true, 1, -1),
  ];
  for (const shape of odd) {
    const context = dirtied();
    const before = context.state();
    expect(drawn(shape, context)).toEqual([]);
    expect(context.state()).toEqual(before);
  }
});

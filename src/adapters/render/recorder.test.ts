import { describe, expect, test } from 'vitest';
import type { DrawContext } from './context';
import { Recorder } from './recorder';

describe('the draw recorder', () => {
  test('writes each call, rounded to a thousandth, and a mark with the transform and the styles it draws with', () => {
    const recorder = new Recorder();
    recorder.strokeStyle = '#d55e00';
    recorder.lineWidth = 3.14159;
    recorder.fillStyle = '#ffffff';
    recorder.beginPath();
    recorder.moveTo(1 / 3, 2);
    recorder.lineTo(10, -0);
    recorder.stroke();
    expect(recorder.take()).toEqual([
      'beginPath',
      'moveTo 0.333 2 @ 1 0 0 1 0 0',
      'lineTo 10 0 @ 1 0 0 1 0 0',
      // The fill colour is away from its default too, but a stroke does not draw with it.
      'stroke | @ 1 0 0 1 0 0 | strokeStyle=#d55e00 lineWidth=3.142',
    ]);
  });

  test('take starts a new frame', () => {
    const recorder = new Recorder();
    recorder.fillRect(0, 0, 2, 2);
    expect(recorder.take()).toHaveLength(1);
    expect(recorder.take()).toEqual([]);
  });

  test('tracks the transform through translate, scale, rotate, setTransform and resetTransform', () => {
    const recorder = new Recorder();
    recorder.translate(10, 5);
    recorder.scale(2, 3);
    expect(recorder.state().transform).toEqual([2, 0, 0, 3, 10, 5]);
    recorder.rotate(Math.PI / 2);
    const [a, b, c, d] = recorder.state().transform;
    expect([a, b, c, d].map((value) => Math.round(value * 1000) / 1000 + 0)).toEqual([0, 3, -2, 0]);
    recorder.setTransform(1, 0, 0, 1, 7, 8);
    expect(recorder.state().transform).toEqual([1, 0, 0, 1, 7, 8]);
    recorder.translate(Number.NaN, 1);
    expect(recorder.state().transform).toEqual([1, 0, 0, 1, 7, 8]);
    recorder.resetTransform();
    expect(recorder.state().transform).toEqual([1, 0, 0, 1, 0, 0]);
  });

  test('save and restore bring back the styles, the dash, the transform and the clip; a restore with nothing saved does nothing', () => {
    const recorder = new Recorder();
    recorder.save();
    recorder.globalAlpha = 0.5;
    recorder.setLineDash([2, 2]);
    recorder.translate(3, 4);
    recorder.beginPath();
    recorder.rect(0, 0, 5, 5);
    recorder.clip();
    expect(recorder.state()).toEqual({
      depth: 1,
      transform: [1, 0, 0, 1, 3, 4],
      styles: { globalAlpha: '0.5', lineDash: '2,2' },
      clip: ['rect 0 0 5 5 @ 1 0 0 1 3 4'],
    });
    recorder.restore();
    recorder.restore();
    expect(recorder.state()).toEqual({ depth: 0, transform: [1, 0, 0, 1, 0, 0], styles: {}, clip: [] });
  });

  test('a clip in force is written on every mark made under it, and a second clip meets the first (INTAKE.30)', () => {
    const recorder = new Recorder();
    recorder.beginPath();
    recorder.rect(0, 0, 100, 100);
    recorder.clip();
    recorder.translate(5, 0);
    recorder.beginPath();
    recorder.arc(0, 0, 10, 0, Math.PI, true);
    recorder.clip();
    recorder.take();
    recorder.fillRect(0, 0, 1, 1);
    expect(recorder.take()).toEqual([
      'fillRect 0 0 1 1 | @ 1 0 0 1 5 0 | clip [rect 0 0 100 100 @ 1 0 0 1 0 0] [arc 0 0 10 0 3.142 anticlockwise @ 1 0 0 1 5 0]',
    ]);
  });

  test('a clip left in force after a throw, with no restore, is seen by the next frame (INTAKE.30: v3’s could not)', () => {
    const recorder = new Recorder();
    const draw = (context: DrawContext): void => {
      context.save();
      context.beginPath();
      context.rect(0, 0, 10, 10);
      context.clip();
      throw new Error('before its restore');
    };
    expect(() => {
      draw(recorder);
    }).toThrow('before its restore');
    recorder.take();
    recorder.fillRect(0, 0, 50, 50);
    const [line] = recorder.take();
    expect(line).toContain('clip [rect 0 0 10 10 @ 1 0 0 1 0 0]');
    expect(recorder.state().depth).toBe(1);
  });

  test('ignores what a browser ignores: an opacity outside 0 to 1, a width of 0, a dash with a negative length', () => {
    const recorder = new Recorder();
    recorder.globalAlpha = 1.5;
    recorder.globalAlpha = Number.NaN;
    recorder.lineWidth = 0;
    recorder.lineWidth = -2;
    recorder.setLineDash([3, -1]);
    recorder.lineDashOffset = Number.POSITIVE_INFINITY;
    expect(recorder.state().styles).toEqual({});
    recorder.setLineDash([3]);
    expect(recorder.getLineDash()).toEqual([3, 3]);
  });

  test('a dash handed in and changed later does not rewrite what was recorded', () => {
    const recorder = new Recorder();
    const dash = [4, 2];
    recorder.setLineDash(dash);
    dash[0] = 99;
    recorder.getLineDash().push(7);
    expect(recorder.getLineDash()).toEqual([4, 2]);
  });

  test('a stroke writes its dash; a fill does not draw with one', () => {
    const recorder = new Recorder();
    recorder.setLineDash([1, 2]);
    recorder.stroke();
    recorder.fill();
    expect(recorder.take()).toEqual(['stroke | @ 1 0 0 1 0 0 | lineDash=1,2', 'fill | @ 1 0 0 1 0 0']);
  });

  test('text is written with its lettering and measured the same on every machine', () => {
    const recorder = new Recorder();
    recorder.font = '16px IBM Plex Sans';
    recorder.textAlign = 'center';
    recorder.fillText('Stop "A"', 4, 8);
    expect(recorder.take()).toEqual(['fillText "Stop \\"A\\"" 4 8 | @ 1 0 0 1 0 0 | font=16px IBM Plex Sans textAlign=center']);
    expect(recorder.measureText('abcd').width).toBe(32);
    recorder.font = 'bold sans-serif';
    expect(recorder.measureText('abcd').width).toBe(20);
  });

  test('an image is named by its size', () => {
    const recorder = new Recorder();
    // A stand-in with an image's size: the recorder reads nothing else of it.
    recorder.drawImage({ width: 640, height: 480 }, 0, 0, 64, 48);
    expect(recorder.take()).toEqual(['drawImage image(640x480) 0 0 64 48 | @ 1 0 0 1 0 0']);
  });
});

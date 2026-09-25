import { describe, expect, test } from 'vitest';
import { contextFor, contextIdFor, localStorageMock } from './setup.js';
import { discardFrame, takeFrame } from './helpers/drawLog.js';

/**
 * The harness the characterisation tests are built on (TST-01). Each fact here
 * was wrong before: a missing key returned `undefined`, and every canvas shared
 * one context, so draw calls could not be attributed to a surface.
 */
describe('test harness fidelity', () => {
  test('a missing localStorage key reads as null, as in a browser', () => {
    expect(localStorage.getItem('routePlotter_absent')).toBeNull();
    expect(localStorageMock.getItem).toHaveBeenCalledWith('routePlotter_absent');
  });

  test('each canvas gets its own context, and the same one on every call', () => {
    const first = document.createElement('canvas');
    const second = document.createElement('canvas');

    expect(first.getContext('2d')).toBe(first.getContext('2d'));
    expect(first.getContext('2d')).not.toBe(second.getContext('2d'));
    expect(first.getContext('2d').canvas).toBe(first);
  });

  test('a context records its draw calls and style changes in order', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#D55E00';
    ctx.fillRect(1, 2, 3, 4);
    ctx.beginPath();

    expect(ctx.calls).toEqual([
      ['set:fillStyle', '#D55E00'],
      ['fillRect', 1, 2, 3, 4],
      ['beginPath']
    ]);
    expect(ctx.fillStyle).toBe('#D55E00');
    expect(contextFor(canvas)).toBe(ctx);
  });

  test('context methods that return values still do, deterministically', () => {
    const ctx = document.createElement('canvas').getContext('2d');

    // Text metrics must depend on the text, or a golden cannot tell two
    // labels apart; the old shared stub returned 100 for everything.
    expect(ctx.measureText('abc').width).toBe(18);
    expect(ctx.measureText('abcdef').width).toBe(36);
    expect(ctx.getLineDash()).toEqual([]);
  });

  test('save and restore carry the style state, as a real context does', () => {
    const ctx = document.createElement('canvas').getContext('2d');

    ctx.globalAlpha = 0.2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.setLineDash([4, 2]);
    ctx.restore();

    expect(ctx.globalAlpha).toBe(0.2);
    expect(ctx.getLineDash()).toEqual([]);
  });

  test('resizing a canvas resets its context state', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    ctx.globalAlpha = 0.5;
    canvas.width = 640;

    expect(ctx.globalAlpha).toBe(1);
    expect(canvas.width).toBe(640);
    expect(ctx.calls).toContainEqual(['canvas.width', 640]);
  });

  test('recorded arguments and gradients cannot be rewritten afterwards', () => {
    const ctx = document.createElement('canvas').getContext('2d');
    const dash = [2, 2];

    ctx.setLineDash(dash);
    dash[0] = 99;
    const gradient = ctx.createLinearGradient(0, 0, 1, 1);
    gradient.addColorStop(0, '#000');
    ctx.fillStyle = gradient;

    expect(ctx.calls).toEqual([
      ['setLineDash', [2, 2]],
      ['createLinearGradient', 0, 0, 1, 1],
      ['[gradient 1].addColorStop', 0, '#000'],
      ['set:fillStyle', '[gradient 1]']
    ]);
  });

  test('a transcript can be taken and started again', () => {
    const ctx = document.createElement('canvas').getContext('2d');

    ctx.beginPath();
    expect(ctx.takeCalls()).toEqual([['beginPath']]);
    expect(ctx.calls).toEqual([]);
  });

  test('a mock reset keeps the absent-key default', () => {
    localStorageMock.getItem.mockReset();

    expect(localStorage.getItem('routePlotter_absent')).toBeNull();
  });

  test('a canvas with no context yet has none recorded', () => {
    expect(contextFor(document.createElement('canvas'))).toBeNull();
  });

  test('a transcript names a composited canvas, and draws text as written', () => {
    // A canvas source is recorded by its context id and named by the surface
    // it is (TST-17). Only a source is renamed: a label may read exactly like
    // the recorder's token for this very canvas, and is the author's text.
    const canvas = document.createElement('canvas');
    const layer = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    layer.getContext('2d');
    const lookalike = `[canvas #${contextIdFor(canvas)}]`;

    discardFrame();
    ctx.drawImage(layer, 0, 0, 10, 10);
    ctx.fillText(lookalike, 1, 2);

    expect(takeFrame({ canvas, renderingService: { vectorCanvas: layer } })).toEqual([
      'main drawImage [canvas vector] 0 0 10 10',
      `main fillText ${lookalike} 1 2`,
    ]);
  });

  test('a transcript can show the state each call was made in, kept as a real context keeps it', () => {
    // The goldens leave it off. DEF-36's comparison needs it, because a
    // transform, a saved state or a style left over from an earlier frame
    // changes no call.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    discardFrame();
    ctx.scale(2, 2);
    ctx.save();
    ctx.translate(10, 5);
    ctx.rotate(Math.PI / 2);
    ctx.transform(1, 0, 0, 1, 1, 0);
    ctx.scale(Infinity, 1);
    ctx.lineCap = 'round';
    ctx.setLineDash([4, 2]);
    ctx.fillRect(0, 0, 1, 1);
    ctx.restore();
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(1, 0, 0, 1, 3, 4);
    ctx.resetTransform();
    ctx.setTransform({ e: 3, f: 4 });
    ctx.globalAlpha = 0.5;
    canvas.width = 8;
    ctx.fillRect(0, 0, 1, 1);

    expect(takeFrame({ canvas }, { state: true })).toEqual([
      'main scale 2 2 @ 1 0 0 1 0 0 | saved 0',
      'main save @ 2 0 0 2 0 0 | saved 0',
      'main translate 10 5 @ 2 0 0 2 0 0 | saved 1',
      'main rotate 1.571 @ 2 0 0 2 20 10 | saved 1',
      'main transform 1 0 0 1 1 0 @ 0 2 -2 0 20 10 | saved 1',
      // A browser ignores a transform with a non-finite argument.
      'main scale Infinity 1 @ 0 2 -2 0 20 12 | saved 1',
      'main set:lineCap round @ 0 2 -2 0 20 12 | saved 1',
      'main setLineDash [4,2] @ 0 2 -2 0 20 12 | saved 1 | lineCap=round',
      'main fillRect 0 0 1 1 @ 0 2 -2 0 20 12 | saved 1 | lineCap=round lineDash=4,2',
      'main restore @ 0 2 -2 0 20 12 | saved 1 | lineCap=round lineDash=4,2',
      'main fillRect 0 0 1 1 @ 2 0 0 2 0 0 | saved 0',
      'main setTransform 1 0 0 1 3 4 @ 2 0 0 2 0 0 | saved 0',
      'main resetTransform @ 1 0 0 1 3 4 | saved 0',
      'main setTransform [Object] @ 1 0 0 1 0 0 | saved 0',
      'main set:globalAlpha 0.5 @ 1 0 0 1 3 4 | saved 0',
      // A resize resets the transform, the saved states and the styles.
      'main canvas.width 8 @ 1 0 0 1 3 4 | saved 0 | globalAlpha=0.5',
      'main fillRect 0 0 1 1 @ 1 0 0 1 0 0 | saved 0',
    ]);

    // A malformed transform call throws, as in a browser, and records nothing.
    expect(() => ctx.translate(1)).toThrow(TypeError);
    expect(takeFrame({ canvas })).toEqual([]);
  });
});

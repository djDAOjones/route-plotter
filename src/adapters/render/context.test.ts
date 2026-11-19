import { describe, expect, test } from 'vitest';
import { isolated, type DrawContext } from './context';
import { Recorder } from './recorder';

const broken = new Error('a drawing that fails');

describe('isolated: each drawing in a state of its own', () => {
  test('a drawing that throws leaves no clip, transform, style or saved state behind, and the throw still reaches the caller (INTAKE.30, DEF-36)', () => {
    const recorder = new Recorder();
    expect(() => {
      isolated(recorder, (context) => {
        context.translate(10, 20);
        context.beginPath();
        context.rect(0, 0, 50, 50);
        context.clip();
        context.globalAlpha = 0.25;
        context.setLineDash([4, 2]);
        throw broken;
      });
    }).toThrow(broken);
    expect(recorder.state()).toEqual({ depth: 0, transform: [1, 0, 0, 1, 0, 0], styles: {}, clip: [] });
  });

  test('a drawing starts from full opacity, the ordinary composite and a solid line, whatever drew before it (INTAKE.31)', () => {
    const recorder = new Recorder();
    recorder.globalAlpha = 0.4;
    recorder.globalCompositeOperation = 'multiply';
    recorder.setLineDash([6, 3]);
    recorder.lineDashOffset = 2;
    let seen: Readonly<Record<string, string>> | null = null;
    isolated(recorder, () => {
      seen = recorder.state().styles;
    });
    expect(seen).toEqual({});
    // What the caller had is back once the drawing ends.
    expect(recorder.state().styles).toEqual({
      globalAlpha: '0.4',
      globalCompositeOperation: 'multiply',
      lineDashOffset: '2',
      lineDash: '6,3',
    });
  });

  test('a drawing that starts clean records only its save and restore around what it draws', () => {
    const recorder = new Recorder();
    isolated(recorder, (context) => {
      context.fillRect(0, 0, 1, 1);
    });
    expect(recorder.take()).toEqual(['save', 'fillRect 0 0 1 1 | @ 1 0 0 1 0 0', 'restore']);
  });

  test('a drawing is handed the same surface, so it draws where the caller asked', () => {
    const recorder = new Recorder();
    let handed: DrawContext | null = null;
    isolated(recorder, (context) => {
      handed = context;
    });
    expect(handed).toBe(recorder);
  });
});

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
    expect(recorder.state()).toEqual({ depth: 0, transform: [1, 0, 0, 1, 0, 0], styles: {}, clip: [], path: [] });
  });

  test('a drawing that throws inside a save of its own still leaves nothing behind (Codex, stage 1)', () => {
    const recorder = new Recorder();
    expect(() => {
      isolated(recorder, (context) => {
        context.translate(4, 4);
        context.beginPath();
        context.rect(0, 0, 8, 8);
        context.clip();
        context.globalAlpha = 0.5;
        context.save();
        context.scale(2, 2);
        throw broken;
      });
    }).toThrow(broken);
    expect(recorder.state()).toEqual({ depth: 0, transform: [1, 0, 0, 1, 0, 0], styles: {}, clip: [], path: [] });
  });

  test('a drawing cannot restore past its own boundary, so the caller’s saved state survives extra restores', () => {
    const recorder = new Recorder();
    recorder.save();
    recorder.translate(9, 9);
    isolated(recorder, (context) => {
      context.restore();
      context.restore();
      context.fillRect(0, 0, 1, 1);
    });
    expect(recorder.state()).toMatchObject({ depth: 1, transform: [1, 0, 0, 1, 9, 9] });
  });

  test('a half-built path never reaches the next drawing’s fill, stroke or clip: a canvas does not save the path', () => {
    const recorder = new Recorder();
    expect(() => {
      isolated(recorder, (context) => {
        context.beginPath();
        context.rect(0, 0, 30, 30);
        throw broken;
      });
    }).toThrow(broken);
    expect(recorder.state().path).toEqual([]);
    let pathAtStart: readonly string[] | null = null;
    recorder.beginPath();
    recorder.moveTo(1, 1);
    isolated(recorder, () => {
      pathAtStart = recorder.state().path;
    });
    expect(pathAtStart).toEqual([]);
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

  test('a drawing that starts clean records only its save, its empty paths and its restore around what it draws', () => {
    const recorder = new Recorder();
    isolated(recorder, (context) => {
      context.fillRect(0, 0, 1, 1);
    });
    expect(recorder.take()).toEqual(['save', 'beginPath', 'fillRect 0 0 1 1 | @ 1 0 0 1 0 0', 'beginPath', 'restore']);
  });

  test('a drawing’s surface draws where the caller asked, and reads back the caller’s state', () => {
    const recorder = new Recorder();
    recorder.font = '20px serif';
    let handed: DrawContext | null = null;
    isolated(recorder, (context) => {
      handed = context;
      context.strokeStyle = '#0072b2';
      context.strokeRect(1, 2, 3, 4);
      expect(context.font).toBe('20px serif');
      expect(context.measureText('ab').width).toBe(20);
    });
    expect(handed).not.toBe(recorder);
    expect(recorder.take()).toContain('strokeRect 1 2 3 4 | @ 1 0 0 1 0 0 | strokeStyle=#0072b2');
  });
});

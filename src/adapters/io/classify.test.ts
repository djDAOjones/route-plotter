// CORE-03: the kind of file, then the declaration's judgement. The refusals' words are tested by name through
// openProject in open.test.ts; these hold the sorting.
import { describe, expect, it } from 'vitest';
import { newScene } from '../../core/model/scene';
import type { Scene } from '../../core/model/scene';
import { classify, judge } from './classify';
import { FORMAT_VERSION } from './format';

function scene(): Scene {
  let next = 0;
  return newScene(() => `id${++next}`);
}

function file(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { app: 'route-plotter', format: 'v4', version: FORMAT_VERSION, scene: scene(), images: [], ...extra };
}

describe('the kind of file', () => {
  it('sends a v4 file of this format on to the check', () => {
    expect(classify(file())).toBeNull();
  });

  it('refuses what is not an object as not a project', () => {
    for (const value of [null, 1, 'x', [], [file()]]) expect(classify(value)?.reason).toBe('not-a-project');
  });

  it('knows a v3 project by its own keys and no format mark', () => {
    for (const key of ['coordVersion', 'waypoints', 'styles', 'animationState']) {
      expect(classify({ [key]: 9 })?.reason, key).toBe('v3');
    }
    expect(classify({ scene: {} })?.reason).toBe('not-a-project');
    expect(classify({ coordVersion: 9, format: 'v4' })).toBeNull();
  });

  it('refuses an older and a newer v4 version alike, with the version found', () => {
    for (const version of [0, FORMAT_VERSION + 1, 1.5]) {
      expect(classify(file({ version }))).toMatchObject({ reason: 'other-preview', version: String(version) });
    }
  });

  it('leaves a missing or unreadable version, or a wrong mark, to the check', () => {
    expect(classify(file({ version: '2' }))).toBeNull();
    expect(classify(file({ format: 'v5', version: 2 }))).toBeNull();
    expect(judge(file({ version: '2' })).ok).toBe(false);
  });
});

describe('the declaration judges every field', () => {
  it('gives back the checked copy', () => {
    const judged = judge(file());
    expect(judged.ok && judged.file.version).toBe(FORMAT_VERSION);
  });

  it('lists an unknown field by its place, and an unknown feature by its id', () => {
    const judged = judge(file({ extra: 1, scene: { ...scene(), features: { crowd: {}, camera: {} } } }));
    expect(judged).toMatchObject({ ok: false, refusal: { reason: 'unknown', features: ['crowd', 'camera'], fields: ['extra'] } });
  });

  it('lists an empty features object as a field', () => {
    const judged = judge(file({ scene: { ...scene(), features: {} } }));
    expect(judged).toMatchObject({ ok: false, refusal: { reason: 'unknown', features: [], fields: ['scene.features'] } });
  });

  it('refuses any other problem as invalid, listing it', () => {
    const judged = judge(file({ images: [{ id: 'a', type: 'image/svg+xml' }] }));
    expect(judged).toMatchObject({ ok: false, refusal: { reason: 'invalid', problems: [{ path: 'images[0].type', rule: 'choice' }] } });
  });
});

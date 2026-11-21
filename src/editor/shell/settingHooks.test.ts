// CORE-05, stage 4: what the kit's components hand React, as far as Node can show it without a page. React's own
// `useSyncExternalStore` and `useMemo` are wrapped here (vi.mock), so a test can read the snapshot a slider hands React,
// and draw a field twice with `useMemo` keeping its values from the first draw to the second as React does for a
// mounted component. A mounted control drawing again on a page is still owed to stage 5's accessibility run.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import type { NumberField } from '../kit/controls';
import { SettingField } from '../kit/SettingField';
import { SettingSlider } from '../kit/SettingSlider';
import { log2ValueToSlider, sliderToLog2Value } from '../kit/sliderScales';
import { setRouteSetting } from '../store/command';
import { createStore } from '../store/store';
import { routeSetting } from './settings';

const hooks = vi.hoisted(() => ({
  /** Each `getSnapshot` handed to `useSyncExternalStore`, in order. */
  snapshots: [] as (() => unknown)[],
  /** `useMemo`'s values and dependencies, by call order, kept from one draw to the next. */
  memos: [] as { value: unknown; deps: readonly unknown[] }[],
  call: 0,
}));

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  return {
    ...react,
    useSyncExternalStore: (subscribe: (listener: () => void) => () => void, get: () => unknown, server?: () => unknown) => {
      hooks.snapshots.push(get);
      return react.useSyncExternalStore(subscribe, get, server);
    },
    useMemo: (make: () => unknown, deps: readonly unknown[]) => {
      const slot = hooks.call;
      hooks.call += 1;
      const kept = hooks.memos[slot];
      if (kept !== undefined && kept.deps.length === deps.length && kept.deps.every((dep, i) => Object.is(dep, deps[i]))) {
        // React keeps a memo's value between draws of a mounted component while its dependencies are the same.
        return kept.value;
      }
      const value = make();
      hooks.memos[slot] = { value, deps };
      return value;
    },
  };
});

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

function project(thickness: number): Project {
  const nextId = counter('seed');
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const base = newRoute(nextId);
  const route = {
    ...base,
    points: [a, b],
    lines: [newLine(nextId, a.id, b.id)],
    leadStart: a.id,
    settings: { ...base.settings, line: { ...base.settings.line, thickness } },
  };
  return { scene: { ...newScene(nextId), routes: [route] }, images: [] };
}

/** Whether `value` is a number field's logic, as `createNumberField` makes it. */
function isField(value: unknown): value is NumberField {
  return typeof value === 'object' && value !== null && 'type' in value && 'commit' in value && 'escape' in value;
}

const LOG2 = { toPosition: (value: number) => log2ValueToSlider(value, 1, 40), toValue: (at: number) => sliderToLog2Value(at, 1, 40) };

beforeEach(() => {
  hooks.snapshots = [];
  hooks.memos = [];
  hooks.call = 0;
});

describe('a slider draws again whenever the value held changes', () => {
  it('two values at one position on a scale (1.049 and 1.05, both at 13) give React different snapshots', () => {
    const store = createStore({ project: project(1.049), nextId: counter('new') });
    const route = store.getState().project.scene.routes[0]?.id ?? '';
    const setting = routeSetting(store, route, 'line', 'thickness');
    renderToStaticMarkup(createElement(SettingSlider, { id: 't', labelText: 'Thickness', setting, min: 0, max: 1000, step: 1, scale: LOG2 }));
    const snapshot = hooks.snapshots[0];
    expect(snapshot).toBeDefined();
    const before = snapshot?.();
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 1.05));
    expect([LOG2.toPosition(1.049), LOG2.toPosition(1.05)]).toEqual([13, 13]);
    expect(Object.is(before, snapshot?.())).toBe(false);
  });
});

describe('a field keeps the text being typed when it is drawn again with a new formatter', () => {
  it('drawn a second time with another inline format, "12px" typed is still shown (DEF-97)', () => {
    const store = createStore({ project: project(12), nextId: counter('new') });
    const route = store.getState().project.scene.routes[0]?.id ?? '';
    const setting = routeSetting(store, route, 'line', 'thickness');
    const draw = (format: (value: number) => string) => {
      hooks.call = 0;
      return renderToStaticMarkup(createElement(SettingField, { id: 'f', labelText: 'Thickness', setting, format }));
    };
    expect(draw((value) => `${String(value)}`)).toContain('value="12"');
    const field = hooks.memos.map((memo) => memo.value).find(isField);
    expect(field).toBeDefined();
    field?.type('12px');
    expect(draw((value) => value.toFixed(1))).toContain('value="12px"');
  });
});

// CORE-05, stage 4: the kit's slider and number field as drawn, on the real store through the shell's fitting. These
// are the markup halves of DEF-20.1 and DEF-97: what a page would be given at start-up and after a change made
// elsewhere. Each real event (a drag, the echo, Escape mid-drag, a key, typing, Enter, leaving, Escape in a field) and
// focus are the page half, owed to stage 5's accessibility run; the rules those events follow are proved on the logic,
// in src/editor/kit/controls.test.ts.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { createNumberField } from '../kit/controls';
import { NumberFieldView, SettingField } from '../kit/SettingField';
import { SettingSlider } from '../kit/SettingSlider';
import { log2ValueToSlider, sliderToLog2Value } from '../kit/sliderScales';
import { createStore, type Store } from '../store/store';
import { routeSetting } from './settings';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** A project of one route of two stops, its line `thickness` pixels thick. */
function project(thickness: number): { project: Project; route: string } {
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
  return { project: { scene: { ...newScene(nextId), routes: [route] }, images: [] }, route: route.id };
}

/** A store that has opened a project whose line is 12 pixels thick, not the default 3. */
function opened(): { store: Store; route: string } {
  const start = project(3);
  const store = createStore({ project: start.project, nextId: counter('new') });
  const { project: twelve, route } = project(12);
  expect(store.open(twelve).ok).toBe(true);
  return { store, route };
}

const slider = (store: Store, route: string) =>
  renderToStaticMarkup(
    createElement(SettingSlider, {
      id: 'thickness',
      labelText: 'Thickness',
      setting: routeSetting(store, route, 'line', 'thickness'),
      min: 1,
      max: 40,
      step: 1,
    }),
  );
const field = (store: Store, route: string) =>
  renderToStaticMarkup(
    createElement(SettingField, {
      id: 'thickness-field',
      labelText: 'Thickness',
      setting: routeSetting(store, route, 'line', 'thickness'),
    }),
  );

/** The value of `attribute` on the first element of `markup` that has it. */
function attribute(markup: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(markup)?.[1];
}

/** The opening tag of the one element in `markup` that `pattern` finds; '' when none or more than one. */
function tag(markup: string, pattern: RegExp): string {
  const found = markup.match(new RegExp(pattern.source, 'g')) ?? [];
  return found.length === 1 ? (found[0] ?? '') : '';
}
const sliderTag = (markup: string) => tag(markup, /<[a-z]+\s[^>]*\brole="slider"[^>]*>/);
const inputTag = (markup: string) => tag(markup, /<input\s(?![^>]*type="hidden")[^>]*>/);

/** The attributes on the element with `role="slider"`, and the field input's own value, as a page would be given them. */
const thumb = (markup: string) => ({
  now: attribute(sliderTag(markup), 'aria-valuenow'),
  text: attribute(sliderTag(markup), 'aria-valuetext'),
});
const input = (markup: string) => attribute(inputTag(markup), 'value');

/** The text of the element the input's `aria-errormessage` names, or undefined when it names none. */
function errorFor(markup: string): string | undefined {
  const id = attribute(inputTag(markup), 'aria-errormessage');
  return id === undefined ? undefined : new RegExp(`<[a-z]+\\s[^>]*\\bid="${id}"[^>]*>([^<]*)<`).exec(markup)?.[1];
}

describe('DEF-20.1, as drawn: a control shows the value held, at start-up and after a change made elsewhere', () => {
  it('a slider and a field drawn on an opened project show its value, not a default', () => {
    const { store, route } = opened();
    expect(thumb(slider(store, route))).toEqual({ now: '12', text: '12' });
    expect(input(field(store, route))).toBe('12');
  });

  it('drawn again after another control commits and after Undo, each shows the new value', () => {
    const { store, route } = opened();
    const other = createNumberField(routeSetting(store, route, 'line', 'thickness'));
    other.type('20');
    expect(other.commit().ok).toBe(true);
    expect([thumb(slider(store, route)).now, input(field(store, route))]).toEqual(['20', '20']);
    store.undo();
    expect([thumb(slider(store, route)).now, input(field(store, route))]).toEqual(['12', '12']);
  });

  it('a slider for a route since removed draws nothing', () => {
    const { store } = opened();
    expect(slider(store, 'no-such-route')).toBe('');
  });
});

describe('DEF-97, as drawn: text typed stays as typed, with why it was refused', () => {
  it('after "12px" is typed and refused, the field shows "12px", marked invalid, with the words; after Undo, still', () => {
    const { store, route } = opened();
    const typed = createNumberField(routeSetting(store, route, 'line', 'thickness'));
    const draw = () => renderToStaticMarkup(createElement(NumberFieldView, { id: 'f', labelText: 'Thickness', field: typed }));
    typed.type('12px');
    expect(typed.commit().ok).toBe(false);
    const refused = draw();
    expect(input(refused)).toBe('12px');
    expect(attribute(inputTag(refused), 'aria-invalid')).toBe('true');
    expect(errorFor(refused)).toBe('Enter a number in figures, such as 12 or 0.5.');
    const other = createNumberField(routeSetting(store, route, 'line', 'thickness'));
    other.type('20');
    other.commit();
    store.undo();
    const after = draw();
    expect([input(after), attribute(inputTag(after), 'aria-invalid'), errorFor(after)]).toEqual([
      '12px',
      'true',
      'Enter a number in figures, such as 12 or 0.5.',
    ]);
  });

  it('a field with nothing typed is not marked invalid', () => {
    const { store, route } = opened();
    const markup = field(store, route);
    expect([input(markup), attribute(inputTag(markup), 'aria-invalid'), errorFor(markup)]).toEqual(['12', undefined, undefined]);
  });

  it('the field is typed as text, with a keypad for decimals', () => {
    const { store, route } = opened();
    const markup = inputTag(field(store, route));
    expect([attribute(markup, 'type'), attribute(markup, 'inputMode') ?? attribute(markup, 'inputmode')]).toEqual([
      'text',
      'decimal',
    ]);
  });
});

describe('a slider’s readout', () => {
  it('is formatUIValue’s, with the unit', () => {
    const { store, route } = opened();
    const markup = renderToStaticMarkup(
      createElement(SettingSlider, {
        id: 't',
        labelText: 'Thickness',
        setting: routeSetting(store, route, 'line', 'thickness'),
        min: 1,
        max: 40,
        step: 1,
        unit: ' px',
      }),
    );
    expect(thumb(markup).text).toBe('12 px');
  });

  it('on a scale, the thumb stands at the position and the readout is of the value held, exactly', () => {
    const store = createStore({ project: project(1.05).project, nextId: counter('new') });
    const route = store.getState().project.scene.routes[0]?.id ?? '';
    const markup = renderToStaticMarkup(
      createElement(SettingSlider, {
        id: 't',
        labelText: 'Thickness',
        setting: routeSetting(store, route, 'line', 'thickness'),
        min: 0,
        max: 1000,
        step: 1,
        scale: { toPosition: (value) => log2ValueToSlider(value, 1, 40), toValue: (at) => sliderToLog2Value(at, 1, 40) },
      }),
    );
    // Position 13 stands for 1.049 (read "1.0"); the value held is 1.05 (read "1.1").
    expect(thumb(markup)).toEqual({ now: '13', text: '1.1' });
  });
});

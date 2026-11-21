// CORE-05, stage 4: the kit's slider and number field on the real store, through the shell's fitting. These are the
// logic halves of DEF-97 and DEF-20.1 and the item's check "a slider dragged and paused makes one undo entry"; their
// page halves (a real input, a real thumb) are stage 4's second chat's and stage 5's accessibility run.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { RETIRED_WORDS } from '../../adapters/io/fixtures';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { createNumberField, createSlider } from '../kit/controls';
import { addRoute, removeRoute, setRouteSetting } from '../store/command';
import { createStore, type Store } from '../store/store';
import { routeSetting, sceneSetting, WORDS } from './settings';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** A store on one route of two stops, its line 3 pixels thick (the default). */
function oneRoute(seed = 'seed'): { project: Project; route: string } {
  const nextId = counter(seed);
  const a = newPoint(nextId, { x: 0.2, y: 0.2, kind: 'stop' });
  const b = newPoint(nextId, { x: 0.8, y: 0.8, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [a, b], lines: [newLine(nextId, a.id, b.id)], leadStart: a.id };
  return { project: { scene: { ...newScene(nextId), routes: [route] }, images: [] }, route: route.id };
}

function made(): { store: Store; route: string } {
  const { project, route } = oneRoute();
  return { store: createStore({ project, nextId: counter('new') }), route };
}

const thickness = (store: Store): number | undefined => store.getState().project.scene.routes[0]?.settings.line.thickness;
const steps = (store: Store) => ({ undo: store.getState().undo, redo: store.getState().redo, gesture: store.getState().gesture });

describe('a slider on the store', () => {
  it('a slider dragged and paused makes one undo entry: Undo gives back the value the drag found, Redo the one it left', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    expect(slider.start()).toEqual({ ok: true, changed: false });
    for (const value of [4, 6, 9, 12, 15]) {
      expect(slider.move(value)).toEqual({ ok: true, changed: true });
      expect(slider.shown()).toBe(value);
    }
    // A pause is nothing: no timer exists, so a test cannot wait and need not.
    expect(slider.end()).toEqual({ ok: true, changed: true });
    expect(steps(store)).toEqual({ undo: 'Change the line settings', redo: null, gesture: null });
    expect(store.undo()).toEqual({ ok: true, changed: true });
    expect([thickness(store), slider.shown(), store.getState().undo]).toEqual([3, 3, null]);
    expect(store.redo()).toEqual({ ok: true, changed: true });
    expect([thickness(store), slider.shown()]).toEqual([15, 15]);
  });

  it('a drag that ends where it began makes no step, and Redo is kept', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    slider.nudge(8);
    store.undo();
    slider.start();
    slider.move(20);
    slider.move(3);
    expect(slider.end()).toEqual({ ok: true, changed: false });
    expect(steps(store)).toEqual({ undo: null, redo: 'Change the line settings', gesture: null });
  });

  it('a drag given up puts back the value held and makes no step', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    slider.start();
    slider.move(30);
    expect(store.getState().gesture).toBe('Change the line settings');
    expect(slider.giveUp()).toEqual({ ok: true, changed: true });
    expect([thickness(store), slider.shown()]).toEqual([3, 3]);
    expect(steps(store)).toEqual({ undo: null, redo: null, gesture: null });
  });

  it('a value the model refuses during a drag changes nothing, says why in its words, and the drag goes on', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    slider.start();
    slider.move(10);
    expect(slider.move(41)).toEqual({ ok: false, why: 'Enter a number from 1 to 40 pixels.' });
    expect([thickness(store), slider.dragging()]).toEqual([10, true]);
    slider.end();
    expect(store.getState().undo).toBe('Change the line settings');
  });

  it('a nudge is one step', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    expect(slider.nudge(4)).toEqual({ ok: true, changed: true });
    expect(slider.nudge(5)).toEqual({ ok: true, changed: true });
    store.undo();
    expect(thickness(store)).toBe(4);
  });
});

describe('every control shows the value it holds (DEF-20.1, its logic half)', () => {
  it('after Open, after Undo and after another control commits, with no call to bring it into step', () => {
    const { store, route } = made();
    const setting = routeSetting(store, route, 'line', 'thickness');
    const slider = createSlider(setting);
    const field = createNumberField(setting);
    const clock = createNumberField(sceneSetting(store, 'clock', 'fixedLengthMs'));
    const shown = () => [slider.shown(), field.shown().text];
    expect(shown()).toEqual([3, '3']);

    const other = createNumberField(setting);
    other.type('11');
    expect(other.commit()).toEqual({ ok: true, changed: true });
    expect(shown()).toEqual([11, '11']);

    store.undo();
    expect(shown()).toEqual([3, '3']);

    const { project } = oneRoute();
    const opened = structuredClone(project);
    const first = opened.scene.routes[0];
    if (first === undefined) throw new Error('the project has a route');
    first.settings.line.thickness = 27;
    opened.scene.settings.clock.fixedLengthMs = 4_000;
    expect(store.open(opened)).toEqual({ ok: true, changed: true });
    expect([...shown(), clock.shown().text]).toEqual([27, '27', '4000']);
  });

  it('a control of a route since removed shows nothing and begins nothing, and shows it again on Undo', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    const field = createNumberField(routeSetting(store, route, 'line', 'thickness'));
    store.dispatch(removeRoute(route));
    expect([slider.shown(), field.shown().text]).toEqual([undefined, '']);
    expect(slider.start()).toEqual({ ok: false, why: WORDS.missing });
    field.type('5');
    expect(field.commit()).toEqual({ ok: false, why: WORDS.missing });
    expect(steps(store).gesture).toBeNull();
    store.undo();
    expect(slider.shown()).toBe(3);
  });
});

describe('text typed is never lost (DEF-97, its logic half)', () => {
  it('stays as typed through Undo, another control’s commit and Open', () => {
    const { store, route } = made();
    const setting = routeSetting(store, route, 'line', 'thickness');
    const field = createNumberField(setting);
    createSlider(setting).nudge(9);
    field.type('17');
    store.undo();
    expect(field.shown().text).toBe('17');
    createSlider(setting).nudge(22);
    expect(field.shown().text).toBe('17');
    expect(store.open(oneRoute('other').project)).toEqual({ ok: true, changed: true });
    expect(field.shown()).toEqual({ text: '17', typing: true, problem: null });
  });

  it('a commit that is not a number, one the model refuses and one refused because a drag is open each keep the text and say why', () => {
    const { store, route } = made();
    const setting = routeSetting(store, route, 'line', 'thickness');
    const field = createNumberField(setting);

    field.type('twelve');
    expect(field.commit().ok).toBe(false);
    expect(field.shown()).toMatchObject({ text: 'twelve', typing: true });

    field.type('2.5');
    expect(field.commit()).toEqual({ ok: true, changed: true });
    field.type('0');
    expect(field.commit()).toEqual({ ok: false, why: 'Enter a number from 1 to 40 pixels.' });
    expect(field.shown()).toEqual({ text: '0', typing: true, problem: 'Enter a number from 1 to 40 pixels.' });
    expect(steps(store)).toEqual({ undo: 'Change the line settings', redo: null, gesture: null });

    const drag = createSlider(secondRoute(store));
    drag.start();
    field.type('8');
    expect(field.commit()).toEqual({ ok: false, why: WORDS.gestureOpen });
    expect(field.shown()).toEqual({ text: '8', typing: true, problem: WORDS.gestureOpen });
    drag.end();
    expect(field.commit()).toEqual({ ok: true, changed: true });
    expect(field.shown()).toEqual({ text: '8', typing: false, problem: null });
  });

  it('the model’s check keeps an integer setting whole', () => {
    const { store } = made();
    const field = createNumberField(sceneSetting(store, 'clock', 'fixedLengthMs'));
    field.type('2500.5');
    const result = field.commit();
    expect(result.ok).toBe(false);
    expect(field.shown().text).toBe('2500.5');
  });

  it('Escape gives the text up and shows the value held', () => {
    const { store, route } = made();
    const field = createNumberField(routeSetting(store, route, 'line', 'thickness'));
    field.type('19');
    expect(field.escape()).toEqual({ ok: true, changed: false });
    expect(field.shown()).toEqual({ text: '3', typing: false, problem: null });
    expect(steps(store)).toEqual({ undo: null, redo: null, gesture: null });
  });

  it('committing the value already held makes no step and keeps Redo', () => {
    const { store, route } = made();
    const setting = routeSetting(store, route, 'line', 'thickness');
    createSlider(setting).nudge(6);
    store.undo();
    const field = createNumberField(setting);
    field.type('3.0');
    expect(field.commit()).toEqual({ ok: true, changed: false });
    expect(steps(store)).toEqual({ undo: null, redo: 'Change the line settings', gesture: null });
  });
});

/** A second route's thickness, so a drag on it is open while a field on the first commits. */
function secondRoute(store: Store) {
  store.dispatch(addRoute());
  const added = store.getState().project.scene.routes[1];
  if (added === undefined) throw new Error('a route was added');
  return routeSetting(store, added.id, 'line', 'thickness');
}

describe('the orders of events on the store (the claim’s point 4)', () => {
  it('a start refused while another drag is open changes nothing, and touches nothing of the drag open', () => {
    const { store, route } = made();
    const setting = routeSetting(store, route, 'line', 'thickness');
    const first = createSlider(setting);
    const second = createSlider(setting);
    first.start();
    first.move(10);
    expect(second.start()).toEqual({ ok: false, why: WORDS.gestureOpen });
    expect([second.move(30), second.end(), second.giveUp()].every((result) => result.ok && !result.changed)).toBe(true);
    expect([thickness(store), store.getState().gesture]).toEqual([10, 'Change the line settings']);
    first.end();
    expect([thickness(store), steps(store).undo, steps(store).gesture]).toEqual([10, 'Change the line settings', null]);
  });

  it('a move with no start, two ends and an end after a give-up make no step and leave no gesture open', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    slider.move(9);
    expect(steps(store)).toEqual({ undo: null, redo: null, gesture: null });
    slider.start();
    slider.move(9);
    slider.end();
    expect(slider.end()).toEqual({ ok: true, changed: false });
    slider.start();
    slider.move(12);
    slider.giveUp();
    expect(slider.end()).toEqual({ ok: true, changed: false });
    expect([thickness(store), steps(store)]).toEqual([9, { undo: 'Change the line settings', redo: null, gesture: null }]);
    store.undo();
    expect(store.getState().undo).toBeNull();
  });

  it('a drag that Open closes ends refused, its edit ended once, and the next drag begins', () => {
    const { store, route } = made();
    const slider = createSlider(routeSetting(store, route, 'line', 'thickness'));
    slider.start();
    slider.move(9);
    store.open(oneRoute().project);
    expect(slider.move(10)).toEqual({ ok: false, why: WORDS.gestureClosed });
    expect(slider.end()).toEqual({ ok: false, why: WORDS.gestureClosed });
    expect([slider.dragging(), store.getState().undo]).toEqual([false, null]);
    expect(slider.start()).toEqual({ ok: true, changed: false });
    slider.end();
  });
});

describe('a page learns of a change', () => {
  it('a setting calls its listener after a change made elsewhere, until stopped', () => {
    const { store, route } = made();
    let calls = 0;
    const stop = routeSetting(store, route, 'line', 'thickness').subscribe(() => (calls += 1));
    store.dispatch(setRouteSetting(route, 'line', 'thickness', 9));
    store.undo();
    stop();
    store.redo();
    expect(calls).toBe(2);
  });
});

describe('the words', () => {
  it('each refusal a field can show is plain, none of its words retired', () => {
    for (const [name, words] of Object.entries(WORDS)) expect(words, name).not.toMatch(RETIRED_WORDS);
  });

  it('each refusal says, word for word, what was agreed (D181)', () => {
    expect(WORDS).toEqual({
      gestureOpen: 'Another change is in progress. Finish it, then try again.',
      gestureClosed: 'That change was ended elsewhere, so nothing was kept.',
      missing: 'This setting is no longer there.',
      nothingToUndo: 'There is nothing to undo.',
      nothingToRedo: 'There is nothing to redo.',
      notAPlayback: 'That is not a position or speed the player can take.',
    });
  });

  it('the model’s problem reaches the field in its declaration’s words, and another change in progress in the agreed words', () => {
    const { store, route } = made();
    const field = createNumberField(routeSetting(store, route, 'line', 'thickness'));
    field.type('0');
    expect(field.commit()).toEqual({ ok: false, why: 'Enter a number from 1 to 40 pixels.' });
    const slider = createSlider(sceneSetting(store, 'clock', 'fixedLengthMs'));
    slider.start();
    field.type('8');
    expect(field.commit()).toEqual({ ok: false, why: 'Another change is in progress. Finish it, then try again.' });
    expect(field.shown().problem).toBe('Another change is in progress. Finish it, then try again.');
    slider.giveUp();
  });
});

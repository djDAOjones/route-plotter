// CORE-06 (brief 133, rulings CR and CT; D268; brief 137, D269 for the point's menu): the words the status area says after each edit, and select all's line.
import { describe, expect, it } from 'vitest';
import { newLine, newPoint, newRoute, newScene, type IdSource, type Route } from '../../core/model/scene';
import type { Current } from '../store/command';
import { NOTHING_SELECTED } from '../store/selection';
import type { Stepped } from '../store/store';
import { allSelected, editWords, MOVE_WORDS, moveAsked, stepWords } from './words';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

const nextId = counter('w');

/** A route of points at these places, joined by nothing (the words read only the points). */
function routeOf(places: readonly (readonly [number, number])[]): Route {
  return { ...newRoute(nextId), points: places.map(([x, y]) => newPoint(nextId, { x, y, kind: 'stop' })) };
}

function currentOf(...routes: Route[]): Current {
  return { project: { scene: { ...newScene(nextId), routes }, images: [] }, selection: NOTHING_SELECTED };
}

/** The route with only the points whose index `keep` names, the rest as they were. */
const keeping = (route: Route, keep: readonly number[]): Route => ({ ...route, points: route.points.filter((_, i) => keep.includes(i)) });

/** The route with the points whose index `move` names moved 0.1 across. */
const moving = (route: Route, move: readonly number[]): Route => ({
  ...route,
  points: route.points.map((point, i) => (move.includes(i) ? { ...point, x: point.x + 0.1 } : point)),
});

/** The route with `n` points more at its end. */
const adding = (route: Route, n: number): Route => ({ ...route, points: [...route.points, ...routeOf(Array.from({ length: n }, () => [0.5, 0.5] as const)).points] });

const three = routeOf([[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]]);

describe('the words for each edit (D268)', () => {
  it('the pen and the "+": "Point added", "Points joined", "Point inserted"', () => {
    const before = currentOf(three);
    const after = currentOf(adding(three, 1));
    expect(editWords('Add point', before, after)).toBe('Point added');
    expect(editWords('Join points', before, before)).toBe('Points joined');
    expect(editWords('Insert point', before, after)).toBe('Point inserted');
  });

  it('a delete counts the points fewer, singular for one, whatever the label says', () => {
    const before = currentOf(three);
    expect(editWords('Delete point', before, currentOf(keeping(three, [0, 2])))).toBe('Point deleted');
    expect(editWords('Delete points', before, currentOf(keeping(three, [1])))).toBe('2 points deleted');
    expect(editWords('Delete points', before, currentOf(keeping(three, [])))).toBe('3 points deleted');
    expect(editWords('Delete points', before, currentOf(keeping(three, [0, 1])))).toBe('Point deleted');
  });

  it('a duplicate counts the points more', () => {
    const before = currentOf(three);
    expect(editWords('Duplicate', before, currentOf(adding(three, 1)))).toBe('Point duplicated');
    expect(editWords('Duplicate', before, currentOf(adding(three, 2)))).toBe('2 points duplicated');
    expect(editWords('Duplicate', before, currentOf(adding(three, 3)))).toBe('3 points duplicated');
  });

  it('a move counts the points standing elsewhere, whatever the label says', () => {
    const before = currentOf(three);
    expect(editWords('Move point', before, currentOf(moving(three, [1])))).toBe('Point moved');
    expect(editWords('Move points', before, currentOf(moving(three, [0, 2])))).toBe('2 points moved');
    expect(editWords('Move point', before, currentOf(moving(three, [0, 1, 2])))).toBe('3 points moved');
    expect(editWords('Move points', before, currentOf(moving(three, [2])))).toBe('Point moved');
  });

  it('the counts read every route', () => {
    const other = routeOf([[0.2, 0.8], [0.8, 0.2]]);
    const before = currentOf(three, other);
    expect(editWords('Delete points', before, currentOf(three, keeping(other, [])))).toBe('2 points deleted');
    expect(editWords('Move point', before, currentOf(three, moving(other, [0])))).toBe('Point moved');
  });

  it('the point’s menu items say D269’s words', () => {
    const before = currentOf(three);
    const after = currentOf(three);
    const WORDS = [
      ['Mark as start', 'Start marked'],
      ['Remove start mark', 'Start mark removed'],
      ['Mark as end', 'End marked'],
      ['Remove end mark', 'End mark removed'],
      ['Set lead start', 'Lead start set'],
      ['Make stop', 'Point made a stop'],
      ['Make bend', 'Point made a bend'],
    ] as const;
    for (const [label, words] of WORDS) expect.soft(editWords(label, before, after), label).toBe(words);
  });

  it('the line\'s menu\'s items (brief 140, EC; D271): "Line made one way", "Line made two-way", "Line reversed"', () => {
    const before = currentOf(three);
    expect(editWords('Make line one way', before, before)).toBe('Line made one way');
    expect(editWords('Make line two-way', before, before)).toBe('Line made two-way');
    expect(editWords('Reverse line', before, before)).toBe('Line reversed');
  });

  it('a nudge, the line commands no menu reaches and an unknown label are silent', () => {
    const before = currentOf(three);
    const after = currentOf(moving(three, [0, 1]));
    for (const label of ['Nudge', 'Delete line', 'Change the line settings', '']) {
      expect(editWords(label, before, after), label).toBeNull();
    }
  });

  it('a step that counts none says nothing rather than "0 points"', () => {
    const before = currentOf(three);
    expect(editWords('Delete points', before, before)).toBeNull();
    expect(editWords('Duplicate', before, before)).toBeNull();
    expect(editWords('Move points', before, before)).toBeNull();
  });
});

describe('what a step says (D268)', () => {
  const before = currentOf(three);
  const after = currentOf(keeping(three, [0]));
  const step = (label: string, kind: Stepped['kind']): Stepped => ({ label, before, after, kind });

  it('a commit says its edit’s words; an Undo "Undo" and a Redo "Redo", whatever the step, a silent one too', () => {
    expect(stepWords(step('Delete points', 'commit'))).toBe('2 points deleted');
    expect(stepWords(step('Nudge', 'commit'))).toBeNull();
    for (const label of ['Delete points', 'Nudge', 'Add point']) {
      expect(stepWords(step(label, 'undo'))).toBe('Undo');
      expect(stepWords(step(label, 'redo'))).toBe('Redo');
    }
  });
});

describe('the lines the lead does not walk (D273 part 1, provisional)', () => {
  /** A route of three points A, B, C joined by `lines` ("A>B" one way, "A-B" both ways), its lead start at `lead`. */
  function led(lines: readonly string[], lead: 'A' | 'B' | 'C' | null): Route {
    const route = routeOf([[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]]);
    const id = (name: string) => route.points['ABC'.indexOf(name)]?.id ?? '';
    return {
      ...route,
      leadStart: lead === null ? null : id(lead),
      lines: lines.map((spec, i) => ({ ...newLine(nextId, id(spec[0] ?? ''), id(spec[2] ?? '')), id: `line-${String(i)}`, direction: spec[1] === '-' ? 'both ways' : 'one way' })),
    };
  }
  const step = (label: string, kind: Stepped['kind'], before: Current, after: Current): Stepped => ({ label, before, after, kind });
  const walked = currentOf(led(['A>B'], 'A'));
  const reversed = currentOf(led(['B>A'], 'A'));

  it('a step that leaves a line out says so after its own words; its Undo says the lead walks every line; its Redo says it again', () => {
    expect(stepWords(step('Reverse line', 'commit', walked, reversed))).toBe('Line reversed. 1 line the lead does not walk');
    expect(stepWords(step('Reverse line', 'undo', reversed, walked))).toBe('Undo. The lead walks every line');
    expect(stepWords(step('Reverse line', 'redo', walked, reversed))).toBe('Redo. 1 line the lead does not walk');
  });

  it('counts every line of every route, and says two or more in the plural', () => {
    const chain = currentOf(led(['A>B', 'B>C'], 'A'));
    const fromEnd = currentOf(led(['A>B', 'B>C'], 'C'));
    expect(stepWords(step('Set lead start', 'commit', chain, fromEnd))).toBe('Lead start set. 2 lines the lead does not walk');
    const looped = currentOf(led(['A>B', 'B>C', 'C>A'], 'A'), led(['A>B'], 'A'));
    expect(stepWords(step('Reverse line', 'undo', fromEnd, looped))).toBe('Undo. 1 line the lead does not walk');
    // One route gains a left-out line while another loses one: the count stands, so the words are as before.
    expect(stepWords(step('Reverse line', 'commit', currentOf(led(['A>B'], 'A'), led(['B>A'], 'A')), currentOf(led(['B>A'], 'A'), led(['A>B'], 'A'))))).toBe('Line reversed');
  });

  it('a silent step that changes the count says the sentence alone', () => {
    expect(stepWords(step('Nudge', 'commit', walked, reversed))).toBe('1 line the lead does not walk');
    expect(stepWords(step('Nudge', 'commit', reversed, walked))).toBe('The lead walks every line');
  });

  it('a step that leaves the count as it was says exactly what it said before', () => {
    expect(stepWords(step('Make line two-way', 'commit', walked, currentOf(led(['A-B'], 'A'))))).toBe('Line made two-way');
    expect(stepWords(step('Reverse line', 'commit', reversed, reversed))).toBe('Line reversed');
    expect(stepWords(step('Nudge', 'commit', reversed, reversed))).toBeNull();
    expect(stepWords(step('Nudge', 'undo', walked, walked))).toBe('Undo');
    // No lead start leaves every line out; a step that keeps it so adds nothing.
    expect(stepWords(step('Add point', 'commit', currentOf(led(['A>B'], null)), currentOf(led(['B>A'], null))))).toBe('Point added');
  });
});

describe('select all’s line (ruling CT)', () => {
  it('"All N points selected", one point as a step says it', () => {
    expect(allSelected(5)).toBe('All 5 points selected');
    expect(allSelected(2)).toBe('All 2 points selected');
    expect(allSelected(1)).toBe('Point selected');
  });
});

describe('"Move"\'s words (brief 138, DC; D270)', () => {
  it('the prompt for one point, the prompt for a selection, and the cancel, word for word', () => {
    expect(MOVE_WORDS).toEqual({
      one: 'Move: click where the point should go, or press Escape to cancel',
      group: 'Move: click where the point should go; the other selected points come with it. Escape cancels',
      cancelled: 'Move cancelled',
    });
  });

  it('the prompt by the points that move: one point the first, two or more the second', () => {
    expect(moveAsked(1)).toBe(MOVE_WORDS.one);
    expect(moveAsked(2)).toBe(MOVE_WORDS.group);
    expect(moveAsked(5)).toBe(MOVE_WORDS.group);
  });
});

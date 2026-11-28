// CORE-06: the pointer transaction's machine, with v3's interactionPointer.test.js ported assertion by assertion (the
// plan's rules for porting tests, A18). v3 drove its handler with DOM events through a bus; here each event is already a
// plain `PointerInput` and each assertion reads the machine's effects. What a tap means for a tool (a waypoint added,
// a toggle, a delete), the compatibility click and the listeners are the page's (chat E) and are named in the item's
// hand-over as not ported here; the drag's places through a real store are gesture.test.ts's.
import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD,
  IDLE,
  step,
  type Effect,
  type Modifiers,
  type Picked,
  type PointerInput,
  type PointerState,
  type Under,
} from './pointer';

const NONE: Modifiers = { alt: false, shift: false, meta: false };
const NOTHING: Picked = { route: null, points: [] };
const pointAt = (id: string): Under => ({ kind: 'point', route: 'r', id });

interface Options {
  readonly pointerId?: number;
  readonly primary?: boolean;
  readonly button?: number;
  readonly modifiers?: Partial<Modifiers>;
}

const contact = (x: number, y: number, options: Options = {}) => ({
  pointerId: options.pointerId ?? 7,
  primary: options.primary ?? true,
  button: options.button ?? 0,
  at: { x, y },
  modifiers: { ...NONE, ...options.modifiers },
});

const down = (x: number, y: number, under: Under = null, selection: Picked = NOTHING, options: Options = {}): PointerInput => ({
  kind: 'down',
  ...contact(x, y, options),
  under,
  selection,
});
const move = (x: number, y: number, options: Options = {}): PointerInput => ({ kind: 'move', ...contact(x, y, { ...options, button: -1 }) });
const up = (x: number, y: number, options: Options = {}): PointerInput => ({ kind: 'up', ...contact(x, y, { ...options, button: -1 }) });
const cancel = (options: Options = {}): PointerInput => ({ kind: 'cancel', ...contact(0, 0, { ...options, button: -1 }) });
const lost = (options: Options = {}): PointerInput => ({ kind: 'lost-capture', ...contact(0, 0, { ...options, button: -1 }) });
const BLUR: PointerInput = { kind: 'blur' };

/** Every event in turn from `from`: the last state and all the effects, in order. */
function run(inputs: readonly PointerInput[], from: PointerState = IDLE) {
  let state = from;
  const effects: Effect[] = [];
  for (const input of inputs) {
    const next = step(state, input);
    state = next.state;
    effects.push(...next.effects);
  }
  const of = <K extends Effect['kind']>(kind: K) => effects.filter((each): each is Extract<Effect, { kind: K }> => each.kind === kind);
  return { state, effects, of };
}

/** v3's down, a tap: pointer down then up at the same place. */
const tap = (x: number, y: number, under: Under = null, options: Options = {}) => [down(x, y, under, NOTHING, options), up(x, y, options)];

describe('one Pointer Events path', () => {
  // v3: "%s tap creates one waypoint even if a compatibility click follows". One path serves mouse, touch and pen:
  // the type no longer reaches the machine. The waypoint's place is gesture.test.ts's; the click is chat E's.
  it('a tap is one tap, with capture asked once for its pointer and released once', () => {
    const { of, state } = run(tap(320, 240));
    expect(of('tap')).toEqual([{ kind: 'tap', at: { x: 320, y: 240 }, under: null, modifiers: NONE }]);
    expect(of('capture')).toEqual([{ kind: 'capture', pointerId: 7 }]);
    expect(of('release')).toEqual([{ kind: 'release', pointerId: 7 }]);
    expect(of('finish')).toHaveLength(1);
    expect(state).toBe(IDLE);
  });

  // v3: "%s movement of %spx resolves as %s" (the table at :157–162).
  it.each([
    [3, false],
    [3.01, true],
  ])('movement of %spx on a point resolves as a drag: %s', (distance, isDrag) => {
    const { of } = run([down(200, 160, pointAt('anchor')), move(200 + distance, 160), up(200 + distance, 160)]);
    expect(of('drag-move')).toHaveLength(isDrag ? 1 : 0);
    expect(of('drag-start')).toHaveLength(isDrag ? 1 : 0);
    expect(of('tap')).toHaveLength(isDrag ? 0 : 1);
    expect(of('finish')).toHaveLength(1);
    expect(of('cancel')).toHaveLength(0);
  });

  it('the threshold is 3 CSS pixels by Math.hypot, diagonally too', () => {
    expect(DRAG_THRESHOLD).toBe(3);
    // 1.8 and 2.4 make exactly 3; one more hundredth either way passes it.
    expect(run([down(0, 0, pointAt('a')), move(1.8, 2.4)]).state.phase).toBe('pressed');
    expect(run([down(0, 0, pointAt('a')), move(1.81, 2.4)]).state.phase).toBe('dragging');
    expect(run([down(0, 0, pointAt('a')), move(-1.81, -2.4)]).state.phase).toBe('dragging');
  });

  // v3: "capture keeps an outside drag alive through one pointerup".
  it('capture keeps an outside drag alive through one up; a second up does nothing', () => {
    const first = run([down(200, 160, pointAt('anchor')), move(1200, 900), up(1200, 900)]);
    expect(first.of('capture')).toEqual([{ kind: 'capture', pointerId: 7 }]);
    expect(first.of('drag-move')).toEqual([{ kind: 'drag-move', from: { x: 200, y: 160 }, to: { x: 1200, y: 900 } }]);
    expect(first.of('finish')).toHaveLength(1);
    expect(first.of('release')).toEqual([{ kind: 'release', pointerId: 7 }]);
    const again = step(first.state, up(200, 160));
    expect(again).toEqual({ state: IDLE, effects: [] });
  });

  // v3: "modifier taps retain one canonical action and never begin a drag". What each tap does (toggle, delete, a
  // major or minor waypoint) is the tool's: chat E's. Here: each is one tap carrying its modifiers, and none drags.
  it.each([
    ['meta', { meta: true }],
    ['shift', { shift: true }],
    ['alt', { alt: true }],
  ])('a %s tap on a point is one tap carrying it, and past the threshold it never drags', (_name, held) => {
    const tapped = run(tap(200, 160, pointAt('anchor'), { modifiers: held }));
    expect(tapped.of('tap')).toEqual([{ kind: 'tap', at: { x: 200, y: 160 }, under: pointAt('anchor'), modifiers: { ...NONE, ...held } }]);
    const pressed = run([down(200, 160, pointAt('anchor'), NOTHING, { modifiers: held }), move(260, 200, { modifiers: held })]);
    expect(pressed.state.phase).toBe('moved');
    const ended = run([up(260, 200, { modifiers: held })], pressed.state);
    expect([...pressed.effects, ...ended.effects].map((each) => each.kind)).toEqual(['capture', 'finish', 'release']);
  });

  it.each([
    ['alt', { alt: true }],
    ['meta', { meta: true }],
  ])('a %s tap on nothing is one tap carrying it', (_name, held) => {
    expect(run(tap(300, 240, null, { modifiers: held })).of('tap')).toEqual([
      { kind: 'tap', at: { x: 300, y: 240 }, under: null, modifiers: { ...NONE, ...held } },
    ]);
  });

  it('a press on nothing past the threshold is "moved": its up gives no tap and no drag', () => {
    const { of, effects } = run([down(100, 100), move(120, 100), move(100, 100), up(100, 100)]);
    expect(effects.map((each) => each.kind)).toEqual(['capture', 'finish', 'release']);
    expect(of('tap')).toHaveLength(0);
  });

  it('a press on a line taps as a tap, and past the threshold is as a press on nothing', () => {
    const line: Under = { kind: 'line', route: 'r', id: 'ab' };
    expect(run(tap(50, 50, line)).of('tap')).toEqual([{ kind: 'tap', at: { x: 50, y: 50 }, under: line, modifiers: NONE }]);
    const dragged = run([down(50, 50, line), move(80, 50), up(80, 50)]);
    expect(dragged.effects.map((each) => each.kind)).toEqual(['capture', 'finish', 'release']);
  });

  it('the tap takes the up’s modifiers and the down’s place when the up comes back to it', () => {
    const { of } = run([down(10, 10, pointAt('a')), move(12, 10), up(10, 10, { modifiers: { shift: true } })]);
    expect(of('tap')).toEqual([{ kind: 'tap', at: { x: 10, y: 10 }, under: pointAt('a'), modifiers: { ...NONE, shift: true } }]);
  });
});

describe('pointer ownership and terminal events', () => {
  // v3: "non-primary contacts and non-primary buttons are ignored".
  it('non-primary contacts and buttons other than the main one are ignored', () => {
    const { effects, state } = run([
      ...tap(200, 160, null, { pointerId: 8, primary: false }),
      ...tap(200, 160, null, { pointerId: 9, button: 2 }),
      ...tap(200, 160, null, { pointerId: 10, button: 1 }),
    ]);
    expect(effects).toEqual([]);
    expect(state).toBe(IDLE);
  });

  // v3: "only the owning pointer can move or finish a gesture".
  it('only the owning pointer can move or finish a gesture', () => {
    const others = run([down(200, 160, pointAt('anchor'), NOTHING, { pointerId: 11 }), move(260, 160, { pointerId: 12 }), up(260, 160, { pointerId: 12 })]);
    expect(others.effects).toEqual([{ kind: 'capture', pointerId: 11 }]);
    expect(others.state.phase).toBe('pressed');
    const owner = run([move(260, 160, { pointerId: 11 }), up(260, 160, { pointerId: 11 })], others.state);
    expect(owner.of('drag-start')).toHaveLength(1);
    expect(owner.of('finish')).toHaveLength(1);
    expect(owner.of('release')).toEqual([{ kind: 'release', pointerId: 11 }]);
  });

  it('a second pointer’s down, cancel and lost capture are ignored while one owns the gesture', () => {
    const owned = run([down(0, 0, pointAt('a'), NOTHING, { pointerId: 1 }), move(10, 0, { pointerId: 1 })]);
    const others = run(
      [down(5, 5, pointAt('b'), NOTHING, { pointerId: 2 }), cancel({ pointerId: 2 }), lost({ pointerId: 2 }), up(5, 5, { pointerId: 2 })],
      owned.state,
    );
    expect(others.effects).toEqual([]);
    expect(others.state).toBe(owned.state);
  });

  // v3: "pointercancel followed by lost capture cancels once and never commits".
  it('a cancel followed by a lost capture cancels once and never finishes', () => {
    const { of } = run([down(200, 160, pointAt('anchor')), move(240, 160), cancel(), lost(), cancel()]);
    expect(of('cancel')).toHaveLength(1);
    expect(of('finish')).toHaveLength(0);
    expect(of('tap')).toHaveLength(0);
    expect(of('release')).toEqual([{ kind: 'release', pointerId: 7 }]);
  });

  // v3: "unexpected lost capture cancels once; normal release then lost capture does not".
  it('an unexpected lost capture cancels once, releasing nothing; a lost capture after an up does nothing', () => {
    const first = run([down(200, 160, pointAt('anchor')), move(240, 160), lost(), lost()]);
    expect(first.of('cancel')).toHaveLength(1);
    expect(first.of('finish')).toHaveLength(0);
    expect(first.of('release')).toHaveLength(0);
    const second = run([down(200, 160, pointAt('anchor')), move(240, 160), up(240, 160), lost()]);
    expect(second.of('finish')).toHaveLength(1);
    expect(second.of('cancel')).toHaveLength(0);
  });

  it('a blur ends a press or a drag with one cancel and one release, and does nothing when idle', () => {
    for (const inputs of [[down(0, 0, pointAt('a'))], [down(0, 0, pointAt('a')), move(9, 0)], [down(0, 0), move(9, 0)]]) {
      const { effects, state } = run([...inputs, BLUR, BLUR]);
      expect(effects.filter((each) => each.kind === 'cancel' || each.kind === 'release')).toEqual([
        { kind: 'cancel' },
        { kind: 'release', pointerId: 7 },
      ]);
      expect(state).toBe(IDLE);
    }
    expect(step(IDLE, BLUR)).toEqual({ state: IDLE, effects: [] });
  });

  it('an up the last move did not deliver takes that motion first: a drag that ends at once', () => {
    const { effects } = run([down(200, 160, pointAt('anchor')), up(204, 160)]);
    expect(effects).toEqual([
      { kind: 'capture', pointerId: 7 },
      { kind: 'drag-start', route: 'r', grabbed: 'anchor', group: ['anchor'], from: { x: 200, y: 160 } },
      { kind: 'drag-move', from: { x: 200, y: 160 }, to: { x: 204, y: 160 } },
      { kind: 'finish' },
      { kind: 'release', pointerId: 7 },
    ]);
  });

  it('an up at the place the last move delivered does not replay it', () => {
    const { of } = run([down(200, 160, pointAt('anchor')), move(260, 160), up(260, 160)]);
    expect(of('drag-move')).toHaveLength(1);
  });
});

describe('multi-selection group drag', () => {
  const pair: Picked = { route: 'r', points: ['a', 'b'] };

  // v3: "tap collapses a group while drag preserves it and promotes the grabbed member". The collapse is a tap's
  // meaning for a tool (chat E's); the machine's half: a tap on a member is a tap, and a drag moves the group with the
  // grabbed member last (selection.ts: the last is the one picked last).
  it('a tap on a group’s member is a tap; a drag preserves the group and promotes the grabbed member', () => {
    const tapped = run([down(200, 160, pointAt('a'), pair), up(200, 160)]);
    expect(tapped.of('tap')).toHaveLength(1);
    expect(tapped.of('drag-start')).toHaveLength(0);
    const dragged = run([down(200, 160, pointAt('a'), pair), move(240, 200), up(240, 200)]);
    expect(dragged.of('drag-start')).toEqual([{ kind: 'drag-start', route: 'r', grabbed: 'a', group: ['b', 'a'], from: { x: 200, y: 160 } }]);
  });

  it('the group is the grabbed point alone when it is not selected, the selection has one point, or another route', () => {
    const groupOf = (selection: Picked) => run([down(0, 0, pointAt('a'), selection), move(9, 0)]).of('drag-start')[0]?.group;
    expect(groupOf({ route: 'r', points: ['b', 'c'] })).toEqual(['a']);
    expect(groupOf({ route: 'r', points: ['a'] })).toEqual(['a']);
    expect(groupOf({ route: 'other', points: ['a', 'b'] })).toEqual(['a']);
    expect(groupOf({ route: 'r', points: ['a', 'b', 'c'] })).toEqual(['b', 'c', 'a']);
  });

  // v3: "one move carries immutable group-start snapshots and one aggregate end". The snapshots' places are
  // gesture.test.ts's (through the store); here: one move, one end, and the second up and lost capture do nothing.
  it('one move gives one drag-move from the down, and one end; a second up and a lost capture do nothing', () => {
    const { of } = run([down(200, 160, pointAt('a'), pair), move(300, 240), up(300, 240), up(300, 240), lost()]);
    expect(of('drag-move')).toEqual([{ kind: 'drag-move', from: { x: 200, y: 160 }, to: { x: 300, y: 240 } }]);
    expect(of('finish')).toHaveLength(1);
    expect(of('cancel')).toHaveLength(0);
  });

  // v3: "window pointerup completes a drag after capture is released outside the canvas", by its meaning: an up of the
  // owning pointer ends the drag wherever it lands, taking its own place first.
  it('an up of the owning pointer completes a drag wherever it lands', () => {
    const { of, state } = run([down(200, 160, pointAt('anchor')), move(260, 200), up(280, 220)]);
    expect(of('drag-move').at(-1)).toEqual({ kind: 'drag-move', from: { x: 200, y: 160 }, to: { x: 280, y: 220 } });
    expect(of('finish')).toHaveLength(1);
    expect(of('cancel')).toHaveLength(0);
    expect(state).toBe(IDLE);
  });

  it('every move of a drag reports the whole movement from the down, never a step', () => {
    const { of } = run([down(0, 0, pointAt('a')), move(5, 0), move(7, 1), move(7, 1)]);
    expect(of('drag-move').map((each) => each.to)).toEqual([{ x: 5, y: 0 }, { x: 7, y: 1 }, { x: 7, y: 1 }]);
    expect(of('drag-move').every((each) => each.from.x === 0 && each.from.y === 0)).toBe(true);
  });
});

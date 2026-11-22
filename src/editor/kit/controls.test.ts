// CORE-05, stage 4: the kit's claim, point by point, on a hand-made setting (as announce.test.ts has a hand-made
// region). The same logic on the real store, through the shell's fitting, is in src/editor/shell/settings.test.ts.
import { describe, expect, it } from 'vitest';
import { RETIRED_WORDS } from '../../adapters/io/fixtures';
import {
  AWAITED_AT_MOST,
  createNumberField,
  createSlider,
  NOT_A_NUMBER,
  parseNumber,
  sliderKeyMove,
  type Result,
  type Setting,
  type SliderKey,
} from './controls';

interface Handmade extends Setting {
  held: number | undefined;
  /** Every call made on the setting and its edits, in order, each edit numbered from 1. */
  readonly log: string[];
  /** Words to refuse the next begin with, or null to take it. */
  refuseBegin: string | null;
  /** Values a set refuses. */
  readonly refuseSet: Set<number>;
  /** How many edits are open: begun and not yet committed or cancelled. */
  open(): number;
}

/** A setting held in a variable: a set shows at once, a cancel puts back, a commit keeps. */
function handmade(held: number | undefined = 5): Handmade {
  let edits = 0;
  let open = 0;
  const setting: Handmade = {
    held,
    log: [],
    refuseBegin: null,
    refuseSet: new Set(),
    open: () => open,
    read: () => setting.held,
    subscribe: () => () => undefined,
    begin: () => {
      if (setting.refuseBegin !== null) {
        setting.log.push('begin refused');
        return { ok: false, why: setting.refuseBegin };
      }
      const n = (edits += 1);
      const found = setting.held;
      let ended = false;
      open += 1;
      setting.log.push(`begin ${String(n)}`);
      const end = (word: string): Result => {
        setting.log.push(`${ended ? 'late ' : ''}${word} ${String(n)}`);
        if (ended) return { ok: false, why: 'ended already' };
        ended = true;
        open -= 1;
        return { ok: true, changed: setting.held !== found };
      };
      return {
        ok: true,
        edit: {
          set: (value) => {
            setting.log.push(`${ended ? 'late ' : ''}set ${String(n)} ${String(value)}`);
            if (ended) return { ok: false, why: 'ended already' };
            if (setting.refuseSet.has(value)) return { ok: false, why: `not ${String(value)}` };
            const changed = setting.held !== value;
            setting.held = value;
            return { ok: true, changed };
          },
          commit: () => end('commit'),
          cancel: () => {
            const result = end('cancel');
            setting.held = found;
            return result;
          },
        },
      };
    },
  };
  return setting;
}

describe('point 1: what a control shows is the value held, read each time', () => {
  it('a slider and a field show a change made elsewhere with no call to bring them into step (DEF-20.1)', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    const field = createNumberField(setting);
    expect([slider.shown(), field.shown().text]).toEqual([5, '5']);
    setting.held = 12;
    expect([slider.shown(), field.shown().text]).toEqual([12, '12']);
    setting.held = undefined;
    expect([slider.shown(), field.shown()]).toEqual([undefined, { text: '', typing: false, problem: null }]);
    expect(setting.log).toEqual([]);
  });

  it('a field writes the value held with the format it is given', () => {
    const setting = handmade(2.25);
    expect(createNumberField(setting, (value) => value.toFixed(1)).shown().text).toBe('2.3');
  });
});

describe('point 2: text typed is kept until committed or given up (DEF-97)', () => {
  it('keeps the text as typed while the value held changes elsewhere', () => {
    const setting = handmade(5);
    const field = createNumberField(setting);
    field.type(' 17.');
    setting.held = 9;
    expect(field.shown()).toEqual({ text: ' 17.', typing: true, problem: null });
    setting.held = undefined;
    expect(field.shown().text).toBe(' 17.');
    expect(setting.log).toEqual([]);
  });

  it('a commit that is not a number keeps the text, says why, and begins nothing', () => {
    const setting = handmade(5);
    const field = createNumberField(setting);
    for (const text of ['', '  ', 'abc', '1e3', '0x10', '1.2.3', '12px', '-', 'Infinity']) {
      field.type(text);
      expect(field.commit(), text).toEqual({ ok: false, why: NOT_A_NUMBER });
      expect(field.shown(), text).toEqual({ text, typing: true, problem: NOT_A_NUMBER });
    }
    expect(setting.log).toEqual([]);
    expect(setting.held).toBe(5);
  });

  it('a refused begin or set keeps the text and says why; a refused set is cancelled', () => {
    const setting = handmade(5);
    const field = createNumberField(setting);
    field.type('8');
    setting.refuseBegin = 'busy';
    expect(field.commit()).toEqual({ ok: false, why: 'busy' });
    expect(field.shown()).toEqual({ text: '8', typing: true, problem: 'busy' });
    setting.refuseBegin = null;
    setting.refuseSet.add(8);
    expect(field.commit()).toEqual({ ok: false, why: 'not 8' });
    expect(field.shown()).toEqual({ text: '8', typing: true, problem: 'not 8' });
    expect(setting.log).toEqual(['begin refused', 'begin 1', 'set 1 8', 'cancel 1']);
    expect(setting.held).toBe(5);
    field.type('8 ');
    expect(field.shown().problem).toBeNull();
  });

  it('a commit taken is one edit, and the field shows the value held again', () => {
    const setting = handmade(5);
    const field = createNumberField(setting, (value) => `${String(value)} px`);
    field.type('-0.5');
    expect(field.commit()).toEqual({ ok: true, changed: true });
    expect(setting.log).toEqual(['begin 1', 'set 1 -0.5', 'commit 1']);
    expect(field.shown()).toEqual({ text: '-0.5 px', typing: false, problem: null });
  });

  it('text that means the value held commits nothing and shows the value held', () => {
    const setting = handmade(5);
    const field = createNumberField(setting);
    field.type(' 5.00 ');
    expect(field.commit()).toEqual({ ok: true, changed: false });
    expect(field.shown()).toEqual({ text: '5', typing: false, problem: null });
    expect(setting.log).toEqual([]);
  });

  it('Escape gives the text up; a commit or Escape with nothing typed does nothing', () => {
    const setting = handmade(5);
    const field = createNumberField(setting);
    expect(field.commit()).toEqual({ ok: true, changed: false });
    field.type('x');
    field.commit();
    expect(field.escape()).toEqual({ ok: true, changed: false });
    expect(field.shown()).toEqual({ text: '5', typing: false, problem: null });
    expect(field.escape()).toEqual({ ok: true, changed: false });
    expect(setting.log).toEqual([]);
  });

  it('reads figures only', () => {
    expect(['12', '+3', '-0.5', '.5', '5.', ' 7 '].map(parseNumber)).toEqual([12, 3, -0.5, 0.5, 5, 7]);
    expect(['', '.', '1,5', '1 000', 'NaN'].map(parseNumber)).toEqual([null, null, null, null, null]);
  });
});

describe('point 3: a drag is one edit; a nudge is an edit of one', () => {
  it('a start, five moves and an end are one begin, five sets and one commit, each set shown at once', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    expect(slider.start()).toEqual({ ok: true, changed: false });
    for (const value of [6, 7, 8, 9, 10]) {
      slider.move(value);
      expect(slider.shown()).toBe(value);
    }
    expect(slider.dragging()).toBe(true);
    expect(slider.end()).toEqual({ ok: true, changed: true });
    expect(slider.dragging()).toBe(false);
    expect(setting.log).toEqual(['begin 1', 'set 1 6', 'set 1 7', 'set 1 8', 'set 1 9', 'set 1 10', 'commit 1']);
  });

  it('a drag given up is cancelled, and the value held is as before', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    slider.start();
    slider.move(9);
    expect(slider.giveUp()).toEqual({ ok: true, changed: true });
    expect(slider.shown()).toBe(5);
    expect(setting.log).toEqual(['begin 1', 'set 1 9', 'cancel 1']);
  });

  it('a refused move leaves the drag open at its last value', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    setting.refuseSet.add(50);
    slider.start();
    slider.move(7);
    expect(slider.move(50)).toEqual({ ok: false, why: 'not 50' });
    expect([slider.shown(), slider.dragging()]).toEqual([7, true]);
    slider.end();
    expect(setting.log).toEqual(['begin 1', 'set 1 7', 'set 1 50', 'commit 1']);
  });

  it('a nudge is begun, set and committed; during a drag it is one more position of it; refused, it is cancelled', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    expect(slider.nudge(6)).toEqual({ ok: true, changed: true });
    slider.start();
    slider.nudge(7);
    slider.end();
    setting.refuseSet.add(99);
    expect(slider.nudge(99)).toEqual({ ok: false, why: 'not 99' });
    expect(setting.log).toEqual([
      'begin 1', 'set 1 6', 'commit 1',
      'begin 2', 'set 2 7', 'commit 2',
      'begin 3', 'set 3 99', 'cancel 3',
    ]);
    expect(setting.held).toBe(7);
  });
});

describe('point 4: a refused begin changes nothing, and every edit begun ends once', () => {
  it('a refused start says why; the moves and the end that follow touch nothing', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    setting.refuseBegin = 'busy';
    expect(slider.start()).toEqual({ ok: false, why: 'busy' });
    setting.refuseBegin = null;
    expect([slider.move(9), slider.end(), slider.giveUp()]).toEqual([
      { ok: true, changed: false },
      { ok: true, changed: false },
      { ok: true, changed: false },
    ]);
    expect([slider.shown(), slider.dragging()]).toEqual([5, false]);
    expect(setting.log).toEqual(['begin refused']);
  });

  it('a move with no start, two starts, two ends and an end after a give-up touch no edit not begun', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    slider.move(9);
    slider.start();
    slider.start();
    slider.move(6);
    slider.end();
    slider.end();
    slider.start();
    slider.giveUp();
    slider.end();
    slider.move(4);
    expect(setting.log).toEqual(['begin 1', 'set 1 6', 'commit 1', 'begin 2', 'cancel 2']);
    expect(setting.open()).toBe(0);
  });

  it('in every order of up to four events, each edit begun ends in exactly one commit or cancel', () => {
    type Event = (slider: ReturnType<typeof createSlider>) => Result;
    const events: Record<string, Event> = {
      start: (slider) => slider.start(),
      move: (slider) => slider.move(8),
      end: (slider) => slider.end(),
      giveUp: (slider) => slider.giveUp(),
      nudge: (slider) => slider.nudge(3),
    };
    const names = Object.keys(events);
    let orders: string[][] = [[]];
    for (let length = 1; length <= 4; length += 1) orders = [...orders, ...orders.filter((o) => o.length === length - 1).flatMap((o) => names.map((name) => [...o, name]))];
    for (const refuseBegin of [false, true]) {
      for (const order of orders) {
        const setting = handmade(5);
        setting.refuseSet.add(8);
        if (refuseBegin) setting.refuseBegin = 'busy';
        const slider = createSlider(setting);
        for (const name of order) events[name]?.(slider);
        slider.giveUp();
        const label = `${order.join(', ')}${refuseBegin ? ' (begin refused)' : ''}`;
        expect(setting.open(), label).toBe(0);
        const begun = setting.log.filter((line) => /^begin \d/.test(line)).map((line) => line.slice('begin '.length));
        for (const n of begun) expect(setting.log.filter((line) => line === `commit ${n}` || line === `cancel ${n}`), label).toHaveLength(1);
        expect(setting.log.filter((line) => line.startsWith('late ')), label).toEqual([]);
        expect(slider.shown(), label).toBe(setting.held);
      }
    }
    expect(orders.length).toBe(1 + 5 + 25 + 125 + 625);
  });

  it('a field never leaves an edit open, whatever it is refused', () => {
    const setting = handmade(5);
    const field = createNumberField(setting);
    setting.refuseSet.add(7);
    for (const text of ['7', '6', 'x', '7', '5']) {
      field.type(text);
      field.commit();
      expect(setting.open(), text).toBe(0);
    }
  });
});

describe('a slider read through a widget that reports only where its thumb stands', () => {
  it('the echo of the position held begins nothing and makes no step, with no press, during one, and while another change is in progress', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    expect(slider.report(5)).toEqual({ ok: true, changed: false });
    setting.refuseBegin = 'Another change is in progress.';
    expect(slider.report(5)).toEqual({ ok: true, changed: false });
    setting.refuseBegin = null;
    slider.press();
    slider.report(7);
    expect(slider.report(7)).toEqual({ ok: true, changed: false });
    slider.release();
    expect(setting.log).toEqual(['begin 1', 'set 1 7', 'commit 1']);
  });

  it('with no press, a report is a key’s nudge: an edit of one', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    expect(slider.report(6)).toEqual({ ok: true, changed: true });
    expect([setting.held, setting.log, setting.open()]).toEqual([6, ['begin 1', 'set 1 6', 'commit 1'], 0]);
  });

  it('a press, its reports and the release are one drag: one edit, committed once', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    slider.press();
    for (const at of [6, 8, 9]) slider.report(at);
    expect([slider.pressed(), slider.dragging()]).toEqual([true, true]);
    slider.release();
    expect([setting.held, slider.pressed(), setting.log]).toEqual([
      9,
      false,
      ['begin 1', 'set 1 6', 'set 1 8', 'set 1 9', 'commit 1'],
    ]);
  });

  it('given up mid-drag (Escape, a touch cancelled), the reports and the release that follow change nothing', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    slider.press();
    slider.report(8);
    slider.giveUp();
    expect([setting.held, slider.pressed()]).toEqual([5, true]);
    expect(slider.report(9)).toEqual({ ok: true, changed: false });
    expect(slider.report(10)).toEqual({ ok: true, changed: false });
    expect(slider.release()).toEqual({ ok: true, changed: false });
    expect([setting.held, setting.open(), setting.log]).toEqual([5, 0, ['begin 1', 'set 1 8', 'cancel 1']]);
    expect(slider.report(6)).toEqual({ ok: true, changed: true });
  });

  it('a press refused changes nothing, nor do its reports, and the release ends the press', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    setting.refuseBegin = 'Another change is in progress.';
    expect(slider.press()).toEqual({ ok: false, why: 'Another change is in progress.' });
    expect(slider.report(9)).toEqual({ ok: true, changed: false });
    slider.release();
    expect([setting.held, slider.pressed(), setting.log]).toEqual([5, false, ['begin refused']]);
  });

  it('a second press while one is down, given up or refused, begins nothing until the release', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    slider.press();
    slider.report(8);
    slider.giveUp();
    expect(slider.press()).toEqual({ ok: true, changed: false });
    slider.report(9);
    slider.release();
    expect([setting.held, setting.log]).toEqual([5, ['begin 1', 'set 1 8', 'cancel 1']]);
    setting.refuseBegin = 'busy';
    slider.press();
    setting.refuseBegin = null;
    slider.press();
    slider.report(9);
    slider.release();
    expect([setting.held, setting.log.slice(3)]).toEqual([5, ['begin refused']]);
    slider.press();
    slider.report(9);
    slider.release();
    expect([setting.held, setting.open()]).toEqual([9, 0]);
  });

  it('in every order of up to five presses, reports, releases and give-ups, a press begins at most one edit, and each edit ends exactly once', () => {
    type Event = (slider: ReturnType<typeof createSlider>) => Result;
    const events: Record<string, Event> = {
      press: (slider) => slider.press(),
      report: (slider) => slider.report(7),
      refused: (slider) => slider.report(8),
      release: (slider) => slider.release(),
      giveUp: (slider) => slider.giveUp(),
    };
    const names = Object.keys(events);
    let orders: string[][] = [[]];
    for (let length = 1; length <= 5; length += 1) orders = [...orders, ...orders.filter((o) => o.length === length - 1).flatMap((o) => names.map((name) => [...o, name]))];
    const begins = (log: readonly string[]) => log.filter((line) => line.startsWith('begin')).length;
    for (const refuseBegin of [false, true]) {
      for (const order of orders) {
        const setting = handmade(5);
        setting.refuseSet.add(8);
        if (refuseBegin) setting.refuseBegin = 'busy';
        const slider = createSlider(setting);
        const label = `${order.join(', ')}${refuseBegin ? ' (begin refused)' : ''}`;
        let pressedAt: number | null = null;
        for (const name of order) {
          if (name === 'press' && pressedAt === null) pressedAt = begins(setting.log);
          events[name]?.(slider);
          if (name === 'release' && pressedAt !== null) {
            expect(begins(setting.log) - pressedAt, label).toBeLessThanOrEqual(1);
            pressedAt = null;
          }
        }
        if (pressedAt !== null) expect(begins(setting.log) - pressedAt, label).toBeLessThanOrEqual(1);
        slider.giveUp();
        slider.release();
        expect(setting.open(), label).toBe(0);
        const begun = setting.log.filter((line) => /^begin \d/.test(line)).map((line) => line.slice('begin '.length));
        for (const n of begun) expect(setting.log.filter((line) => line === `commit ${n}` || line === `cancel ${n}`), label).toHaveLength(1);
        expect(setting.log.filter((line) => line.startsWith('late ')), label).toEqual([]);
        expect(slider.pressed(), label).toBe(false);
      }
    }
    expect(orders.length).toBe(1 + 5 + 25 + 125 + 625 + 3125);
  });

  it('on a scale, the thumb stands at the position, a report is read as its value, and the readout is the value held exactly', () => {
    const setting = handmade(5);
    const slider = createSlider(setting, { toPosition: (value) => value * 10, toValue: (at) => at / 10 + 0.01 });
    expect(slider.position()).toBe(50);
    expect([slider.readout(50), slider.readout(70)]).toEqual([5, 7.01]);
    expect(slider.report(50)).toEqual({ ok: true, changed: false });
    slider.report(70);
    expect([setting.held, slider.position()]).toEqual([7.01, 70.1]);
  });

  it('nothing held: no position, and a readout is the value the position stands for', () => {
    const setting = handmade(5);
    const slider = createSlider(setting);
    setting.held = undefined;
    expect(slider.position()).toBeUndefined();
    expect(slider.readout(3)).toBe(3);
  });
});

describe("point 3: a widget's late echo of a position it was handed (brief 79)", () => {
  // The order the page showed (PROBE-79): End off the slider hands 1000, Home hands 0, and only then does Carbon report
  // 1000, the echo of the first, while 0 is held.
  it('End then Home with the first echo late: the echo begins nothing, Home stands, and the second echo is nothing', () => {
    const setting = handmade(0);
    const slider = createSlider(setting);
    slider.drawn(0);
    setting.held = 1000;
    slider.handed(1000);
    setting.held = 0;
    slider.handed(0);
    expect(slider.report(1000)).toEqual({ ok: true, changed: false });
    expect([setting.held, setting.log]).toEqual([0, []]);
    expect(slider.report(0)).toEqual({ ok: true, changed: false });
    expect([setting.held, setting.log, slider.awaiting(), slider.thumb()]).toEqual([0, [], false, 0]);
  });

  it('the same with the pointer down: the late echo is no position of the drag', () => {
    const setting = handmade(0);
    const slider = createSlider(setting);
    slider.drawn(0);
    slider.press();
    setting.held = 1000;
    slider.handed(1000);
    setting.held = 0;
    slider.handed(0);
    expect(slider.report(1000)).toEqual({ ok: true, changed: false });
    expect(slider.report(0)).toEqual({ ok: true, changed: false });
    slider.release();
    expect([setting.held, setting.log]).toEqual([0, ['begin 1', 'commit 1']]);
  });

  it('a position handed where the thumb already stands is not awaited: right, left onto the old place, right again, each taken', () => {
    const setting = handmade(50);
    const slider = createSlider(setting);
    slider.drawn(50);
    for (const at of [51, 50, 51]) {
      expect(slider.report(at), String(at)).toEqual({ ok: true, changed: true });
      slider.handed(at);
      expect(slider.awaiting(), String(at)).toBe(false);
    }
    expect([setting.held, setting.log.filter((l) => l.startsWith('commit')).length]).toEqual([51, 3]);
  });

  it('an echo that skips older handed positions clears them: a later report of one is the user’s', () => {
    const setting = handmade(0);
    const slider = createSlider(setting);
    slider.drawn(0);
    for (const at of [10, 20, 30]) {
      setting.held = at;
      slider.handed(at);
    }
    expect(slider.report(30)).toEqual({ ok: true, changed: false });
    expect(slider.awaiting()).toBe(false);
    expect(slider.report(10)).toEqual({ ok: true, changed: true });
    expect(setting.held).toBe(10);
  });

  it(`at most ${String(AWAITED_AT_MOST)} positions are awaited, the oldest let go first`, () => {
    const setting = handmade(0);
    const slider = createSlider(setting);
    slider.drawn(0);
    for (let at = 1; at <= AWAITED_AT_MOST + 1; at++) {
      setting.held = at;
      slider.handed(at);
    }
    expect(slider.report(1)).toEqual({ ok: true, changed: true });
    expect(setting.held).toBe(1);
    expect(slider.report(2)).toEqual({ ok: true, changed: false });
    expect(setting.held).toBe(1);
  });

  it('a widget drawn again from what is held awaits nothing', () => {
    const setting = handmade(0);
    const slider = createSlider(setting);
    expect(slider.thumb()).toBeUndefined();
    slider.drawn(0);
    setting.held = 1000;
    slider.handed(1000);
    setting.held = 0;
    slider.handed(0);
    expect(slider.awaiting()).toBe(true);
    slider.drawn(0);
    expect([slider.awaiting(), slider.thumb()]).toEqual([false, 0]);
    expect(slider.report(1000)).toEqual({ ok: true, changed: true });
    expect(setting.held).toBe(1000);
  });
});

describe('the words', () => {
  it('a field shows plain words, none of them retired', () => {
    expect(NOT_A_NUMBER).not.toMatch(RETIRED_WORDS);
  });

  it('a field says, word for word, what a number is when the text is not one (D181)', () => {
    expect(NOT_A_NUMBER).toBe('Enter a number in figures, such as 12 or 0.5.');
    const field = createNumberField(handmade(5));
    field.type('12px');
    expect(field.commit()).toEqual({ ok: false, why: 'Enter a number in figures, such as 12 or 0.5.' });
    expect(field.shown().problem).toBe('Enter a number in figures, such as 12 or 0.5.');
  });
});

describe("point 5: a slider's own Home, End, Page Up and Page Down (D193)", () => {
  const key = (name: string, held: Partial<SliderKey> = {}): SliderKey => ({
    key: name,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    ...held,
  });
  /** The timeline's range: thousandths of the length. */
  const TIMELINE = { min: 0, max: 1000, step: 1 };
  const to = (name: string, at: number, range = TIMELINE, pressed = false) =>
    sliderKeyMove(key(name), at, range, pressed);

  it('Home goes to the start, End to the end, Page Up and Page Down by a tenth of the range', () => {
    expect([to('Home', 400), to('End', 400), to('PageUp', 400), to('PageDown', 400)]).toEqual([
      { taken: true, to: 0 },
      { taken: true, to: 1000 },
      { taken: true, to: 500 },
      { taken: true, to: 300 },
    ]);
    expect(to('PageUp', 5, { min: -50, max: 50, step: 1 })).toEqual({ taken: true, to: 15 });
  });

  it('a tenth is whole steps, never fewer than one', () => {
    // 100 / 10 is 3⅓ steps of 3: three steps, 9.
    expect(to('PageUp', 50, { min: 0, max: 100, step: 3 })).toEqual({ taken: true, to: 59 });
    // 100 / 10 is 1⅔ steps of 6: rounded up, two steps, 12 (a floor would give one, 6).
    expect(to('PageUp', 0, { min: 0, max: 100, step: 6 })).toEqual({ taken: true, to: 12 });
    expect(to('PageDown', 50, { min: 0, max: 100, step: 6 })).toEqual({ taken: true, to: 38 });
    // 4 / 10 is 0.4 of a step: one step.
    expect(to('PageUp', 2, { min: 0, max: 4, step: 1 })).toEqual({ taken: true, to: 3 });
    expect(to('PageDown', 2, { min: 0, max: 4, step: 1 })).toEqual({ taken: true, to: 1 });
  });

  it('the result is kept inside the range', () => {
    expect(to('PageUp', 950)).toEqual({ taken: true, to: 1000 });
    expect(to('PageDown', 30)).toEqual({ taken: true, to: 0 });
    expect(to('PageDown', -45, { min: -50, max: 50, step: 1 })).toEqual({ taken: true, to: -50 });
  });

  it('a key that would not move the thumb is still the slider\'s, and moves nothing', () => {
    expect([to('Home', 0), to('End', 1000), to('PageUp', 1000), to('PageDown', 0)]).toEqual(
      Array(4).fill({ taken: true, to: null }),
    );
  });

  it('while a press is down the four keys move nothing, and are still the slider\'s', () => {
    for (const name of ['Home', 'End', 'PageUp', 'PageDown']) {
      expect(to(name, 400, TIMELINE, true)).toEqual({ taken: true, to: null });
    }
  });

  it('with Control, Alt or Meta held the key is not the slider\'s; Shift changes nothing', () => {
    for (const held of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
      expect(sliderKeyMove(key('End', held), 400, TIMELINE, false)).toEqual({ taken: false });
    }
    const shifted = { ...key('PageUp'), shiftKey: true };
    expect(sliderKeyMove(shifted, 400, TIMELINE, false)).toEqual({ taken: true, to: 500 });
  });

  it('any other key is not the slider\'s', () => {
    for (const name of ['ArrowRight', 'ArrowUp', 'Escape', ' ', 'k', 'Enter']) {
      expect(to(name, 400)).toEqual({ taken: false });
    }
  });

  it('a held key repeats: each press moves on from where the last left it; Home held moves once', () => {
    const at = [0];
    for (let n = 0; n < 3; n += 1) {
      const move = to('PageUp', at[at.length - 1] ?? 0);
      if (move.taken && move.to !== null) at.push(move.to);
    }
    expect(at).toEqual([0, 100, 200, 300]);
    expect([to('Home', 300), to('Home', 0)]).toEqual([
      { taken: true, to: 0 },
      { taken: true, to: null },
    ]);
  });
});

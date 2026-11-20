// CORE-05, stage 3: the announcement queue, v3's announcementQueue.js ported (DEF-45). One test or more for each
// behaviour its header states, written from the header. The region is a plain object of the shape the queue writes,
// whose setter for markup throws; the timer is the test's own, run by hand a hold at a time: no test waits or reads a
// clock, and a second timer booked while one is pending fails the test (one timer at a time).
import { describe, expect, it } from 'vitest';
import { createAnnouncementQueue, HOLD_MS, MAX_WAITING, type Announce, type Priority } from './announce';

function rig() {
  const due: (() => void)[] = [];
  /** Every text written to the region, in turn, the clears included. */
  const written: string[] = [];
  let live: Priority | null = null;
  let text = '';
  const region = {
    setAttribute: (_name: 'aria-live', value: Priority) => {
      live = value;
    },
    get textContent(): string {
      return text;
    },
    set textContent(value: string | null) {
      text = value ?? '';
      written.push(text);
    },
    set innerHTML(_markup: string) {
      throw new Error('a message parsed as markup');
    },
  };
  const later = (callback: () => void, ms: number) => {
    expect(ms).toBe(HOLD_MS);
    expect(due).toHaveLength(0);
    due.push(callback);
  };
  const queue = createAnnouncementQueue(region, later);
  const announce: Announce = queue.announce;
  /** One hold passes. */
  const tick = () => {
    const call = due.shift();
    if (call === undefined) throw new Error('no hold is running');
    call();
  };
  return {
    announce,
    withdraw: queue.withdraw,
    tick,
    text: () => text,
    live: () => live,
    timers: () => due.length,
    written: () => [...written],
    /** Holds pass until the region is idle; gives every message written, in turn, and how many holds it took. */
    drain: () => {
      let holds = 0;
      while (due.length > 0 && holds < 100) {
        tick();
        holds += 1;
      }
      return { heard: written.filter((each) => each !== ''), holds };
    },
  };
}

describe('the announcement queue', () => {
  it('writes a message announced while the region is idle at once, polite unless asked otherwise', () => {
    const polite = rig();
    polite.announce('Project saved');
    expect(polite.text()).toBe('Project saved');
    expect(polite.live()).toBe('polite');
    const assertive = rig();
    assertive.announce('Cannot open that file', 'assertive');
    expect(assertive.text()).toBe('Cannot open that file');
    expect(assertive.live()).toBe('assertive');
  });

  it('makes one announced while another shows wait, and each keeps the region for one hold', () => {
    const { announce, tick, text } = rig();
    announce('First');
    announce('Second');
    expect(text()).toBe('First');
    tick();
    expect(text()).toBe('Second');
    tick();
    expect(text()).toBe('');
  });

  it('clears the region and makes it polite only once nothing waits, so a repeated message reads as a change', () => {
    const { announce, tick, text, live, written } = rig();
    announce('Playing');
    announce('Stopped', 'assertive');
    tick();
    expect([text(), live()]).toEqual(['Stopped', 'assertive']);
    tick();
    expect([text(), live()]).toEqual(['', 'polite']);
    announce('Stopped', 'assertive');
    expect(written()).toEqual(['Playing', 'Stopped', '', 'Stopped']);
  });

  it('keeps one timer at a time, so no clear lands on a later message', () => {
    const { announce, tick, text, timers } = rig();
    announce('One');
    announce('Two');
    announce('Three');
    expect(timers()).toBe(1);
    tick();
    expect(text()).toBe('Two');
    expect(timers()).toBe(1);
    tick();
    expect(text()).toBe('Three');
    tick();
    expect(text()).toBe('');
    expect(timers()).toBe(0);
  });

  it('lets only routine messages give way to the cap: an essential or assertive one never does', () => {
    const { announce, drain } = rig();
    announce('Showing');
    for (const n of [1, 2, 3]) announce(`Essential ${String(n)}`, 'polite', { essential: true });
    for (const n of [1, 2, 3]) announce(`Assertive ${String(n)}`, 'assertive');
    for (const n of [1, 2, 3, 4, 5]) announce(`Routine ${String(n)}`);
    expect(MAX_WAITING).toBe(3);
    expect(drain().heard).toEqual([
      'Showing', 'Assertive 1', 'Assertive 2', 'Assertive 3', 'Essential 1', 'Essential 2', 'Essential 3',
      'Routine 3', 'Routine 4', 'Routine 5',
    ]);
  });

  it('puts an assertive message ahead of the polite ones waiting, never cutting short the one showing; the region is assertive only while it shows one', () => {
    const { announce, tick, text, live } = rig();
    announce('Polite 1');
    announce('Polite 2');
    announce('Assertive 1', 'assertive');
    announce('Assertive 2', 'assertive');
    expect(text()).toBe('Polite 1');
    const seen: [string, Priority | null][] = [];
    for (let n = 0; n < 4; n += 1) {
      tick();
      seen.push([text(), live()]);
    }
    expect(seen).toEqual([
      ['Assertive 1', 'assertive'], ['Assertive 2', 'assertive'], ['Polite 2', 'polite'], ['', 'polite'],
    ]);
  });

  it('merges a message identical to the one it would follow: the one showing keeps its hold', () => {
    const showing = rig();
    showing.announce('Saved');
    showing.announce('Saved');
    expect(showing.timers()).toBe(1);
    expect(showing.drain()).toEqual({ heard: ['Saved'], holds: 1 });
    const waiting = rig();
    waiting.announce('Showing');
    waiting.announce('Saved');
    waiting.announce('Saved');
    expect(waiting.drain().heard).toEqual(['Showing', 'Saved']);
  });

  it('gives the merged message the stronger protection: a routine one an essential request merges into never gives way', () => {
    const { announce, drain } = rig();
    announce('Showing');
    announce('Recovered');
    announce('Recovered', 'polite', { essential: true });
    for (const n of [1, 2, 3, 4]) announce(`Routine ${String(n)}`);
    expect(drain().heard).toEqual(['Showing', 'Recovered', 'Routine 2', 'Routine 3', 'Routine 4']);
  });

  it('makes a waiting copy an assertive request merges into assertive, and moves it ahead of the polite ones waiting', () => {
    const { announce, tick, text, live } = rig();
    announce('Showing');
    announce('Polite');
    announce('Export failed');
    announce('Export failed', 'assertive');
    tick();
    expect([text(), live()]).toEqual(['Export failed', 'assertive']);
    tick();
    expect([text(), live()]).toEqual(['Polite', 'polite']);
    tick();
    expect(text()).toBe('');
  });

  it('merges a must-hear message into its text waiting anywhere; a routine one only into the one it would follow', () => {
    const mustHear = rig();
    mustHear.announce('Showing');
    mustHear.announce('Some images were left out', 'polite', { essential: true });
    mustHear.announce('Routine');
    mustHear.announce('Some images were left out', 'polite', { essential: true });
    mustHear.announce('Some images were left out', 'assertive');
    expect(mustHear.drain().heard).toEqual(['Showing', 'Some images were left out', 'Routine']);
    const routine = rig();
    routine.announce('Showing');
    routine.announce('Grid on');
    routine.announce('Snap on');
    routine.announce('Grid on');
    expect(routine.drain().heard).toEqual(['Showing', 'Grid on', 'Snap on', 'Grid on']);
  });

  it('does not take the message showing for such a copy unless it is the one followed', () => {
    const after = rig();
    after.announce('Recovered', 'polite', { essential: true });
    after.announce('Routine');
    after.announce('Recovered', 'polite', { essential: true });
    expect(after.drain().heard).toEqual(['Recovered', 'Routine', 'Recovered']);
    const followed = rig();
    followed.announce('Recovered', 'polite', { essential: true });
    followed.announce('Recovered', 'polite', { essential: true });
    expect(followed.drain().heard).toEqual(['Recovered']);
  });

  it('keeps what waits bounded however long input goes on, and clears within a hold each for the one showing, those waiting and the tips', () => {
    const { announce, drain } = rig();
    announce('Showing');
    for (let n = 0; n < 20; n += 1) {
      announce(`Toggle ${String(n)}`);
      announce('Recovered', 'polite', { essential: true });
      announce('Export failed', 'assertive');
      announce('Press question mark for help', 'polite', { whenIdle: true });
    }
    const { heard, holds } = drain();
    expect(heard).toEqual([
      'Showing', 'Export failed', 'Recovered', 'Toggle 17', 'Toggle 18', 'Toggle 19', 'Press question mark for help',
    ]);
    expect(holds).toBe(1 + (2 + MAX_WAITING) + 1);
  });

  it('holds a tip until nothing else shows or waits: it never displaces a message, does not count towards the cap, and what comes while it waits goes ahead', () => {
    const { announce, tick, drain } = rig();
    announce('Showing');
    announce('A tip', 'polite', { whenIdle: true });
    announce('A tip', 'polite', { whenIdle: true });
    for (const n of [1, 2, 3]) announce(`Routine ${String(n)}`);
    tick();
    announce('Late', 'assertive');
    expect(drain().heard).toEqual(['Showing', 'Routine 1', 'Late', 'Routine 2', 'Routine 3', 'A tip']);
    const idle = rig();
    idle.announce('A tip', 'polite', { whenIdle: true });
    expect(idle.text()).toBe('A tip');
    idle.announce('A tip', 'polite', { whenIdle: true });
    expect(idle.drain().heard).toEqual(['A tip']);
  });

  it('withdraws every message still waiting under a key; the one showing keeps its hold, unkeyed ones and tips stay', () => {
    const { announce, withdraw, text, drain } = rig();
    const exporting = {};
    announce('Exporting, 10 percent', 'polite', { key: exporting });
    announce('Exporting, 20 percent', 'assertive', { key: exporting });
    announce('Saved');
    announce('Exporting, 30 percent', 'polite', { key: exporting });
    announce('A tip', 'polite', { whenIdle: true, key: exporting });
    withdraw(exporting);
    withdraw(undefined);
    expect(text()).toBe('Exporting, 10 percent');
    expect(drain().heard).toEqual(['Exporting, 10 percent', 'Saved', 'A tip']);
  });

  it('does not withdraw one that another request merged into: it is that request’s too', () => {
    const { announce, withdraw, drain } = rig();
    const exporting = {};
    announce('Showing');
    announce('Export finished', 'polite', { key: exporting });
    announce('Export finished');
    withdraw(exporting);
    expect(drain().heard).toEqual(['Showing', 'Export finished']);
  });

  it('ignores a blank or whitespace-only message', () => {
    const { announce, text, timers, drain } = rig();
    announce('');
    announce(' \n\t ', 'assertive');
    expect(text()).toBe('');
    expect(timers()).toBe(0);
    announce('Showing');
    announce('   ');
    expect(drain()).toEqual({ heard: ['Showing'], holds: 1 });
  });

  it('writes text as text, never parsed as markup', () => {
    const { announce, text } = rig();
    announce('<b>Route</b> & <img src=x onerror=alert(1)> added');
    expect(text()).toBe('<b>Route</b> & <img src=x onerror=alert(1)> added');
  });
});

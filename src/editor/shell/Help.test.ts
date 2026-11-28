// CORE-05, stage 5: what Help draws (react-dom/server, no page), and the switch's value held for the visit. Help: one
// table for each of the key table's groups, a row for each action with its words and every key help spells; then the
// switch for single-key shortcuts, its state as held, its sentence read from the table; each punctuation key read out by
// its name; no disabled fieldset (UI-06.6).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { holdForVisit } from './held';
import { Help, KEY_NAMES, singleKeysShown, switchHelp } from './Help';
import { helpRows } from './keys';

const nothing = (): void => undefined;
const draw = (on: boolean, mac = true) =>
  renderToStaticMarkup(createElement(Help, { opener: { current: null }, open: true, onClose: nothing, mac, singleKeys: holdForVisit(on) }));
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

describe('Help, as it draws', () => {
  it('is a dialog headed Help with one table for each group, in the table’s order, and a row for each action', () => {
    for (const mac of [true, false]) {
      const html = draw(true, mac);
      expect(html).toMatch(/<h2[^>]*>Help<\/h2>/);
      expect([...html.matchAll(/<caption>([^<]*)<\/caption>/g)].map((m) => m[1])).toEqual(['Playback', 'General', 'Editing']);
      const rows = [...html.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>(.*?)<\/td><\/tr>/g)];
      expect(rows.map((m) => m[1])).toEqual(helpRows(mac).map(({ words }) => words));
      rows.forEach((m, i) => {
        const keys = [...(m[2] ?? '').matchAll(/<kbd[^>]*>([^<]*)<\/kbd>/g)].map((k) => k[1]);
        expect(keys).toEqual(helpRows(mac)[i]?.keys.map(escape));
      });
    }
  });

  it('shows the switch for single-key shortcuts as it is held, on and off, with its sentence', () => {
    for (const on of [true, false]) {
      const html = draw(on);
      expect(html).toMatch(new RegExp(`<button[^>]*id="single-keys"[^>]*role="switch"[^>]*aria-checked="${String(on)}"|<button[^>]*role="switch"[^>]*aria-checked="${String(on)}"[^>]*id="single-keys"`));
      expect(html).toContain('Single-key shortcuts');
      expect(html).toContain(escape(switchHelp(true)));
    }
  });

  it('names in the sentence every key of one character the table has, and nothing else is a single key', () => {
    expect(singleKeysShown(true)).toEqual(['K', 'J', 'L', '<', '>', ',', '.', '?']);
    // The Editing keys (brief 123, ruling AM) are none of one printable character without a command key: the switch leaves them on.
    expect(singleKeysShown(false)).toEqual(['K', 'J', 'L', '<', '>', ',', '.', '?']);
    expect(switchHelp(true)).toBe(
      'Turned off, K, J, L, <, >, comma, full stop and ? do nothing. Space, Home, End, Delete, Backspace, Open project, Undo, Redo, ' +
        'Duplicate and Select all keep working.',
    );
  });

  it('reads each punctuation key out by its name, the key as seen hidden from a screen reader, and every other key as it is', () => {
    expect(KEY_NAMES).toEqual({ ',': 'comma', '.': 'full stop', '<': 'less than', '>': 'greater than', '?': 'question mark' });
    for (const mac of [true, false]) {
      const html = draw(true, mac);
      for (const key of helpRows(mac).flatMap(({ keys }) => keys)) {
        const name = KEY_NAMES[key];
        if (name === undefined) expect(html).toContain(`<kbd>${escape(key)}</kbd>`);
        else expect(html).toContain(`<kbd aria-hidden="true">${escape(key)}</kbd><span class="cds--visually-hidden">${name}</span>`);
      }
    }
  });

  it('draws no disabled fieldset (UI-06.6)', () => {
    for (const on of [true, false]) expect(draw(on)).not.toMatch(/<fieldset[^>]*disabled/);
  });
});

describe('a value held for the visit', () => {
  it('begins at its first value, tells each listener of a change once, and nothing for the same value or after stopping', () => {
    const held = holdForVisit(true);
    const heard: boolean[] = [];
    const stop = held.subscribe(() => heard.push(held.read()));
    expect(held.read()).toBe(true);
    held.set(false);
    held.set(false);
    held.set(true);
    stop();
    held.set(false);
    expect(heard).toEqual([false, true]);
    expect(held.read()).toBe(false);
  });
});

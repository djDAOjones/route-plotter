// CORE-05, stage 3: the key table. One table read by dispatch and by help; v3's live keys; no browser chord taken
// (DEF-63); one press, at most one action, and none for a press already taken (DEF-13.1, the table's half); the words
// help shows held to the glossary.
import { describe, expect, it } from 'vitest';
import { RETIRED_WORDS } from '../../adapters/io/fixtures';
import { actionFor, helpRows, KEYS, matches, type KeyPress } from './keys';

const UP = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false };
const press = (key: string, held: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({ ...UP, ...held, key });

const PLATFORMS = [true, false] as const;

/** Every way Ctrl, Cmd, Alt and Shift may be held, the fifteen with at least one of Ctrl, Cmd or Alt among them. */
const CHORDS = Array.from({ length: 16 }, (_, bits) => ({
  ctrlKey: (bits & 1) !== 0,
  metaKey: (bits & 2) !== 0,
  altKey: (bits & 4) !== 0,
  shiftKey: (bits & 8) !== 0,
}));
const ALL_HELD = [...CHORDS];
const WITH_CTRL_CMD_OR_ALT = CHORDS.filter(({ ctrlKey, metaKey, altKey }) => ctrlKey || metaKey || altKey);

/** Every key the table names, with its upper case for a letter. */
const NAMED_KEYS = [...new Set(KEYS.flatMap(({ keys }) => keys.flatMap((key) => (key.length === 1 ? [key, key.toUpperCase()] : [key]))))];

describe('the key table, as dispatch reads it', () => {
  it('holds v3’s live keys: Space and K, J, L, Home , < and End . >', () => {
    for (const mac of PLATFORMS) {
      const of = (key: string, held: Partial<Omit<KeyPress, 'key'>> = {}) => actionFor(press(key, held), mac);
      expect([' ', 'k'].map((key) => of(key))).toEqual(['playPause', 'playPause']);
      expect(of('j')).toBe('reverse');
      expect(of('l')).toBe('forward');
      expect(['Home', ',', '<'].map((key) => of(key))).toEqual(['skipToStart', 'skipToStart', 'skipToStart']);
      expect(['End', '.', '>'].map((key) => of(key))).toEqual(['skipToEnd', 'skipToEnd', 'skipToEnd']);
      // Shift is not asked of a key with no modifier: `<` and `>` need it, and Caps Lock gives a capital.
      expect(of('<', { shiftKey: true })).toBe('skipToStart');
      expect(of('>', { shiftKey: true })).toBe('skipToEnd');
      expect(['K', 'J', 'L'].map((key) => of(key, { shiftKey: true }))).toEqual(['playPause', 'reverse', 'forward']);
      expect(of(' ', { shiftKey: true })).toBe('playPause');
    }
  });

  it('holds Undo and Redo on v3’s chords: Cmd on a Mac, Ctrl elsewhere, with Z, Shift added for Redo', () => {
    expect(actionFor(press('z', { metaKey: true }), true)).toBe('undo');
    expect(actionFor(press('z', { metaKey: true, shiftKey: true }), true)).toBe('redo');
    expect(actionFor(press('z', { ctrlKey: true }), false)).toBe('undo');
    expect(actionFor(press('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo');
    // The other platform's key, both held, or Alt added, is not the chord.
    expect(actionFor(press('z', { ctrlKey: true }), true)).toBeNull();
    expect(actionFor(press('z', { metaKey: true }), false)).toBeNull();
    for (const mac of PLATFORMS) {
      expect(actionFor(press('z', { ctrlKey: true, metaKey: true }), mac)).toBeNull();
      expect(actionFor(press('z', { ctrlKey: !mac, metaKey: mac, altKey: true }), mac)).toBeNull();
      expect(actionFor(press('z'), mac)).toBeNull();
    }
  });

  it('means nothing for a key the table does not name', () => {
    for (const mac of PLATFORMS) {
      for (const key of ['a', 'Escape', '?', 'Enter', 'Tab', 'ArrowLeft', 'Delete', 'Unidentified', '']) {
        expect(actionFor(press(key), mac), key).toBeNull();
      }
    }
  });
});

describe('DEF-63: no shortcut takes a browser chord such as Ctrl or Cmd with L', () => {
  it('an entry that names no modifier never matches a press with Ctrl, Cmd or Alt held, on either platform', () => {
    const plain = KEYS.filter(({ modifiers }) => modifiers.length === 0);
    expect(plain.length).toBeGreaterThan(0);
    for (const mac of PLATFORMS) {
      for (const { keys } of plain) {
        for (const key of keys.flatMap((name) => (name.length === 1 ? [name, name.toUpperCase()] : [name]))) {
          for (const held of WITH_CTRL_CMD_OR_ALT) {
            expect(actionFor(press(key, held), mac), `${key} ${JSON.stringify(held)} mac=${String(mac)}`).toBeNull();
          }
        }
      }
    }
  });

  it('no entry matches a chord the browser keeps for itself', () => {
    const browserChords: KeyPress[] = [];
    for (const letter of ['l', 't', 'n', 'w', 'r', 'q', 'p', 'f']) {
      for (const shiftKey of [false, true]) {
        const key = shiftKey ? letter.toUpperCase() : letter;
        browserChords.push(press(key, { ctrlKey: true, shiftKey }), press(key, { metaKey: true, shiftKey }));
      }
    }
    for (const key of ['ArrowLeft', 'ArrowRight']) browserChords.push(press(key, { altKey: true }), press(key, { metaKey: true }));
    for (const mac of PLATFORMS) {
      for (const chord of browserChords) expect(actionFor(chord, mac), JSON.stringify(chord)).toBeNull();
    }
  });

  it('Undo’s and Redo’s chords are the only ones the table declares', () => {
    expect(KEYS.filter(({ modifiers }) => modifiers.length > 0).map(({ action }) => action)).toEqual(['undo', 'redo']);
  });
});

describe('DEF-13.1, the table’s half: one press, one effect', () => {
  it('no two entries share a key with the same modifiers', () => {
    const seen = new Set<string>();
    for (const { keys, modifiers } of KEYS) {
      for (const key of keys) {
        const chord = `${[...modifiers].sort().join('+')}|${key.toLowerCase()}`;
        expect(seen.has(chord), chord).toBe(false);
        seen.add(chord);
      }
    }
  });

  it('every press of a key the table names, with anything held, matches at most one entry', () => {
    for (const mac of PLATFORMS) {
      for (const key of NAMED_KEYS) {
        for (const held of ALL_HELD) {
          const one = press(key, held);
          const takers = KEYS.filter((entry) => matches(entry, one, mac)).map(({ action }) => action);
          expect(takers.length, `${key} ${JSON.stringify(held)} mac=${String(mac)}`).toBeLessThanOrEqual(1);
          expect(actionFor(one, mac)).toBe(takers[0] ?? null);
        }
      }
    }
  });

  it('a press already taken means no action, whatever it is', () => {
    for (const mac of PLATFORMS) {
      for (const key of NAMED_KEYS) {
        for (const held of ALL_HELD) {
          expect(actionFor(press(key, { ...held, defaultPrevented: true }), mac), key).toBeNull();
        }
      }
      expect(actionFor(press('z', { metaKey: mac, ctrlKey: !mac }), mac)).toBe('undo');
      expect(actionFor(press('z', { metaKey: mac, ctrlKey: !mac, defaultPrevented: true }), mac)).toBeNull();
    }
  });
});

describe('the key table, as help reads it', () => {
  it('gives one row per entry, in the table’s order, with the entry’s words', () => {
    for (const mac of PLATFORMS) {
      const rows = helpRows(mac);
      expect(rows.map(({ action, group, words }) => ({ action, group, words }))).toEqual(
        KEYS.map(({ action, group, words }) => ({ action, group, words })),
      );
      expect(rows.map(({ keys }) => keys.length)).toEqual(KEYS.map(({ keys }) => keys.length));
    }
  });

  it('spells each key as the machine’s keyboard has it', () => {
    const keysOf = (mac: boolean) => Object.fromEntries(helpRows(mac).map(({ action, keys }) => [action, keys]));
    expect(keysOf(true)).toEqual({
      playPause: ['Space', 'K'],
      reverse: ['J'],
      forward: ['L'],
      skipToStart: ['Home', ',', '<'],
      skipToEnd: ['End', '.', '>'],
      undo: ['Cmd+Z'],
      redo: ['Cmd+Shift+Z'],
    });
    expect(keysOf(false)).toMatchObject({ undo: ['Ctrl+Z'], redo: ['Ctrl+Shift+Z'] });
  });

  it('says that the comma and full stop skip, as they do (D175; v3’s help said "step")', () => {
    const rows = helpRows(true);
    const row = (action: string) => rows.find((candidate) => candidate.action === action);
    expect(row('skipToStart')).toMatchObject({ words: 'Skip to start', keys: ['Home', ',', '<'] });
    expect(row('skipToEnd')).toMatchObject({ words: 'Skip to end', keys: ['End', '.', '>'] });
    expect(actionFor(press(','), true)).toBe('skipToStart');
    expect(actionFor(press('.'), true)).toBe('skipToEnd');
    expect(rows.map(({ words }) => words).join(' ')).not.toMatch(/\bstep\b/i);
  });

  it('and dispatch agree: every key help shows, pressed as shown, means that row’s action', () => {
    for (const mac of PLATFORMS) {
      for (const { action, keys } of helpRows(mac)) {
        for (const shown of keys) {
          const parts = shown === '+' ? ['+'] : shown.split('+');
          const name = parts[parts.length - 1] ?? '';
          const key = name === 'Space' ? ' ' : name.length === 1 ? name.toLowerCase() : name;
          const held = { metaKey: mac && parts.includes('Cmd'), ctrlKey: !mac && parts.includes('Ctrl'), shiftKey: parts.includes('Shift') };
          expect(actionFor(press(key, held), mac), shown).toBe(action);
        }
      }
    }
  });

  it('uses none of the glossary’s retired words', () => {
    for (const { words } of KEYS) expect(words).not.toMatch(RETIRED_WORDS);
  });
});

describe('the table itself', () => {
  it('is frozen, entries and their lists too', () => {
    expect(Object.isFrozen(KEYS)).toBe(true);
    for (const entry of KEYS) {
      expect(Object.isFrozen(entry) && Object.isFrozen(entry.keys) && Object.isFrozen(entry.modifiers)).toBe(true);
    }
  });

  it('names each action once', () => {
    const actions = KEYS.map(({ action }) => action);
    expect(new Set(actions).size).toBe(actions.length);
  });
});

// CORE-05, stage 5: the shell's key dispatch, its claim point by point, on the real store and the real editor's
// transport (a player's transport kept in the store, as bindings.test.ts makes one, recording nothing of its own).
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newScene } from '../../core/model/scene';
import type { Transport } from '../../player/transport/transport';
import { addRoute } from '../store/command';
import { createStore } from '../store/store';
import { createEditorTransport, WORDS } from '../transport/transport';
import { dispatchKey, type FocusKind, type PressPlace } from './dispatch';
import { actionFor, KEYS, type ActionIn, type KeyPress } from './keys';

const UP = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, repeat: false };
const press = (key: string, held: Partial<Omit<KeyPress, 'key'>> = {}): KeyPress => ({ ...UP, ...held, key });
const OPEN: PressPlace = { typing: false, dialogOpen: false, focus: 'other' };
const PLATFORMS = [true, false] as const;
const LENGTH_MS = 10_000;

/** Every way Ctrl, Cmd, Alt and Shift may be held. */
const CHORDS = Array.from({ length: 16 }, (_, bits) => ({
  ctrlKey: (bits & 1) !== 0,
  metaKey: (bits & 2) !== 0,
  altKey: (bits & 4) !== 0,
  shiftKey: (bits & 8) !== 0,
}));

/** The command key held as `mac` has it, and Shift as asked. */
const command = (mac: boolean, shiftKey = false) => ({ metaKey: mac, ctrlKey: !mac, shiftKey });

/** Each entry's every key, pressed as the entry asks on `mac`. */
function tablePresses(mac: boolean): { readonly action: string; readonly press: KeyPress }[] {
  return KEYS.flatMap(({ action, keys, modifiers }) =>
    keys.map((key) => ({
      action,
      press: press(key, modifiers.includes('command') ? command(mac, modifiers.includes('shift')) : {}),
    })),
  );
}

/** A real store on an empty project, the real editor's transport over a player's transport kept in it. */
function rig({ escapeDoes = true, editDoes = true } = {}) {
  let n = 0;
  const project: Project = { scene: newScene(() => `id-${String((n += 1))}`), images: [] };
  const store = createStore({ project, nextId: () => `new-${String((n += 1))}` });
  const keep = (change: Partial<ReturnType<typeof store.playback>>) => store.setPlayback({ ...store.playback(), ...change });
  const player: Transport = {
    play: () => keep({ playing: true }),
    pause: () => keep({ playing: false, speed: 1 }),
    seek: (ms) => keep({ atMs: Math.min(Math.max(ms, 0), LENGTH_MS) }),
    setSpeed: (speed) => keep({ speed }),
    length: () => LENGTH_MS,
  };
  const said: string[] = [];
  // Always something to play here: the refusal is the editor's transport's own (its tests); this holds the dispatch.
  const editor = createEditorTransport({
    transport: player,
    playback: () => store.playback(),
    announce: (words) => said.push(words),
    canPlay: () => true,
    frameRate: () => 25,
  });
  const ran: string[] = [];
  const outcomes: ReturnType<typeof store.undo>[] = [];
  const recorded = (name: ActionIn<'Playback'>) => () => {
    ran.push(name);
    editor[name]();
  };
  const transport = {
    playPause: recorded('playPause'),
    reverse: recorded('reverse'),
    forward: recorded('forward'),
    skipToStart: recorded('skipToStart'),
    skipToEnd: recorded('skipToEnd'),
    stepBack: recorded('stepBack'),
    stepForward: recorded('stepForward'),
  };
  const bound = {
    undo: () => {
      ran.push('undo');
      const outcome = store.undo();
      outcomes.push(outcome);
      return outcome;
    },
    redo: () => {
      ran.push('redo');
      const outcome = store.redo();
      outcomes.push(outcome);
      return outcome;
    },
  };
  const openHelp = () => {
    ran.push('help');
  };
  const openProject = () => {
    ran.push('openProject');
  };
  // The page's Escape (keydown.ts): true when it cancelled a drag or cleared the selection.
  const escape = () => {
    ran.push('escape');
    return escapeDoes;
  };
  // The page's Editing keys (dom.ts's `editKey`): true when there was something to act on; a repeat is recorded as held.
  const edit = (action: ActionIn<'Editing'>, repeat: boolean) => {
    ran.push(repeat ? `${action} held` : action);
    return editDoes;
  };
  const key = (pressed: KeyPress, { mac = true, place = OPEN, singleKeys = true } = {}) =>
    dispatchKey({ press: pressed, mac, place, singleKeys, store: bound, transport, openHelp, openProject, escape, edit });
  return { store, said, ran, outcomes, key };
}

describe('the shell’s key dispatch', () => {
  it('point 1: each key of the table, pressed in the open, runs its one action once and is taken', () => {
    for (const mac of PLATFORMS) {
      for (const { action, press: pressed } of tablePresses(mac)) {
        const { ran, key } = rig();
        expect(key(pressed, { mac }), `${action} by ${JSON.stringify(pressed)}`).toBe(true);
        expect(ran).toEqual([action]);
      }
    }
  });

  it('point 1: a key no entry names, a chord no entry asks for, or a press already taken runs nothing and is not taken', () => {
    const { ran, said, key } = rig();
    const others = [
      // `?` left this list when it became Help's key (stage 5); point 4's tests press it.
      press('a'), press('Tab'), press('Enter'), press('ArrowLeft'),
      press('l', { ctrlKey: true }), press('l', { metaKey: true }), press('k', { altKey: true }), press('z'),
      press(' ', { defaultPrevented: true }), press('Home', { defaultPrevented: true }),
      press('z', { metaKey: true, defaultPrevented: true }),
    ];
    for (const pressed of others) expect(key(pressed), JSON.stringify(pressed)).toBe(false);
    expect(ran).toEqual([]);
    expect(said).toEqual([]);
  });

  it('point 2: in a typing field no key and no chord is taken, and nothing runs, Open project’s chord apart', () => {
    const { ran, said, key } = rig();
    for (const { keys } of KEYS) {
      for (const name of keys) {
        for (const held of CHORDS) {
          for (const mac of PLATFORMS) {
            const pressed = press(name, held);
            if (actionFor(pressed, mac) === 'openProject') continue;
            expect(key(pressed, { mac, place: { ...OPEN, typing: true } })).toBe(false);
          }
        }
      }
    }
    expect(ran).toEqual([]);
    expect(said).toEqual([]);
  });

  it('point 2: while a dialog is open nothing behind it runs, wherever focus is; only Open project’s chord is taken', () => {
    const { ran, said, key } = rig();
    const kinds: readonly FocusKind[] = ['button', 'link', 'menuitem', 'slider', 'other'];
    for (const focus of kinds) {
      for (const mac of PLATFORMS) {
        for (const { action, press: pressed } of tablePresses(mac)) {
          expect(key(pressed, { mac, place: { typing: false, dialogOpen: true, focus } }), action).toBe(action === 'openProject');
        }
      }
    }
    expect(ran).toEqual([]);
    expect(said).toEqual([]);
  });

  it('point 2: a menu item keeps Space and Enter, and also Home and End; the rest still run from it', () => {
    const { ran, key } = rig();
    const place = { ...OPEN, focus: 'menuitem' as const };
    expect(key(press(' '), { place })).toBe(false);
    expect(key(press('Enter'), { place })).toBe(false);
    expect(key(press('Home'), { place })).toBe(false);
    expect(key(press('End'), { place })).toBe(false);
    expect(key(press('k'), { place })).toBe(true);
    expect(key(press('z', { metaKey: true }), { place })).toBe(true);
    expect(ran).toEqual(['playPause', 'undo']);
  });

  it('point 2: a button or a link keeps Space (and Enter); every other key still runs from it', () => {
    for (const focus of ['button', 'link'] as const) {
      const { ran, key } = rig();
      const place = { ...OPEN, focus };
      expect(key(press(' '), { place }), focus).toBe(false);
      expect(key(press(' ', { shiftKey: true }), { place }), focus).toBe(false);
      expect(key(press('Enter'), { place }), focus).toBe(false);
      expect(ran).toEqual([]);
      expect(key(press('k'), { place })).toBe(true);
      expect(key(press('Home'), { place })).toBe(true);
      expect(key(press('End'), { place })).toBe(true);
      expect(key(press('z', { metaKey: true }), { place })).toBe(true);
      expect(ran).toEqual(['playPause', 'skipToStart', 'skipToEnd', 'undo']);
    }
  });

  it('point 2: a slider keeps Home and End (and the arrows, Page Up and Down); Space and the rest still run from it', () => {
    const { ran, key } = rig();
    const place = { ...OPEN, focus: 'slider' as const };
    expect(key(press('Home'), { place })).toBe(false);
    expect(key(press('End'), { place })).toBe(false);
    expect(ran).toEqual([]);
    expect(key(press(' '), { place })).toBe(true);
    expect(key(press(','), { place })).toBe(true);
    expect(key(press('z', { metaKey: true, shiftKey: true }), { place })).toBe(true);
    expect(ran).toEqual(['playPause', 'stepBack', 'redo']);
  });

  it('point 3: a Playback action is the editor’s transport’s function of the same name, saying its own words', () => {
    const { ran, said, key, store } = rig();
    expect(key(press('End'))).toBe(true);
    expect(store.playback().atMs).toBe(LENGTH_MS);
    expect(key(press('Home'))).toBe(true);
    expect(store.playback().atMs).toBe(0);
    expect(key(press(' '))).toBe(true);
    expect(store.playback().playing).toBe(true);
    expect(key(press('k'))).toBe(true);
    expect(key(press('l'))).toBe(true);
    expect(key(press('j'))).toBe(true);
    expect(store.playback().speed).toBe(-1);
    expect(ran).toEqual(['skipToEnd', 'skipToStart', 'playPause', 'playPause', 'forward', 'reverse']);
    expect(said).toEqual([WORDS.skippedToEnd, WORDS.skippedToStart, WORDS.playing, WORDS.paused, WORDS.playing]);
  });

  it('point 3: comma and full stop step one frame back and forward (D205): silent from a pause, a playing scene paused first', () => {
    const { ran, said, key, store } = rig();
    expect(key(press('.'))).toBe(true);
    expect(key(press('.'))).toBe(true);
    expect(store.playback().atMs).toBe(80);
    expect(key(press(','))).toBe(true);
    expect(store.playback().atMs).toBe(40);
    expect(said).toEqual([]);
    expect(key(press(' '))).toBe(true);
    expect(key(press('.'))).toBe(true);
    expect(store.playback()).toMatchObject({ playing: false, atMs: 80, speed: 1 });
    expect(ran).toEqual(['stepForward', 'stepForward', 'stepBack', 'playPause', 'stepForward']);
    expect(said).toEqual([WORDS.playing, WORDS.paused]);
  });

  it('point 3: Undo and Redo are the store’s; a refusal changes nothing and the key is still taken', () => {
    for (const mac of PLATFORMS) {
      const { ran, outcomes, key, store } = rig();
      const before = store.getState();
      expect(key(press('z', command(mac)), { mac })).toBe(true);
      expect(outcomes[0]).toEqual({ ok: false, refusal: { why: 'nothing-to-undo' } });
      expect(store.getState()).toBe(before);
      expect(store.dispatch(addRoute()).ok).toBe(true);
      const added = store.getState();
      expect(key(press('Z', command(mac, true)), { mac })).toBe(true);
      expect(outcomes[1]).toEqual({ ok: false, refusal: { why: 'nothing-to-redo' } });
      expect(store.getState()).toBe(added);
      expect(key(press('z', command(mac)), { mac })).toBe(true);
      expect(store.getState().project).toEqual(before.project);
      expect(key(press('z', command(mac, true)), { mac })).toBe(true);
      expect(store.getState().project).toEqual(added.project);
      expect(ran).toEqual(['undo', 'redo', 'undo', 'redo']);
    }
  });

  it('point 4: with single-key shortcuts off, J, K, L , . < > ? are never taken; Space, Home, End and the chords run', () => {
    for (const mac of PLATFORMS) {
      const { ran, said, key } = rig();
      const off = { mac, singleKeys: false };
      const single = [
        press('j'), press('k'), press('l'), press('J', { shiftKey: true }), press('K', { shiftKey: true }),
        press('L', { shiftKey: true }), press(','), press('.'), press('<', { shiftKey: true }), press('>', { shiftKey: true }),
        press('?', { shiftKey: true }), press('?'),
      ];
      for (const pressed of single) expect(key(pressed, off), JSON.stringify(pressed)).toBe(false);
      expect(ran).toEqual([]);
      expect(said).toEqual([]);
      expect(key(press(' '), off)).toBe(true);
      expect(key(press('Home'), off)).toBe(true);
      expect(key(press('End'), off)).toBe(true);
      expect(key(press('z', command(mac)), off)).toBe(true);
      expect(key(press('z', command(mac, true)), off)).toBe(true);
      // The Editing keys (point 7) are none of one printable character without a command key: the switch leaves them on.
      expect(key(press('Delete'), off)).toBe(true);
      expect(key(press('Backspace'), off)).toBe(true);
      expect(key(press('d', command(mac)), off)).toBe(true);
      expect(key(press('a', command(mac)), off)).toBe(true);
      expect(ran).toEqual(['playPause', 'skipToStart', 'skipToEnd', 'undo', 'redo', 'deleteSelection', 'deleteSelection', 'duplicate', 'selectAll']);
    }
  });

  it('point 4: with single-key shortcuts on, the same keys are taken', () => {
    const { ran, key } = rig();
    for (const name of ['j', 'k', 'l', ',', '.', '<', '>', '?']) expect(key(press(name)), name).toBe(true);
    expect(ran).toEqual(['reverse', 'playPause', 'forward', 'stepBack', 'stepForward', 'skipToStart', 'skipToEnd', 'help']);
  });

  it('point 5: a held key runs its action once and is still taken; Undo, Redo and the frame steps run at each repeat (D189, D205)', () => {
    for (const mac of PLATFORMS) {
      const { ran, said, key, store, outcomes } = rig();
      for (const pressed of [press(' '), press('k'), press('j'), press('l'), press('Home'), press('<'), press('End'), press('?')]) {
        expect(key({ ...pressed, repeat: true }, { mac }), `${pressed.key} held`).toBe(true);
      }
      expect(ran).toEqual([]);
      expect(said).toEqual([]);
      expect(key(press(' '), { mac })).toBe(true);
      expect(key({ ...press(' '), repeat: true }, { mac })).toBe(true);
      expect(key({ ...press(' '), repeat: true }, { mac })).toBe(true);
      expect(store.playback().playing).toBe(true);
      expect(ran).toEqual(['playPause']);
      const routes = store.getState().project.scene.routes.length;
      expect(store.dispatch(addRoute()).ok).toBe(true);
      expect(store.dispatch(addRoute()).ok).toBe(true);
      const undo = { ...press('z', command(mac)), repeat: true };
      expect(key(undo, { mac })).toBe(true);
      expect(key(undo, { mac })).toBe(true);
      expect(key({ ...press('z', command(mac, true)), repeat: true }, { mac })).toBe(true);
      expect(ran).toEqual(['playPause', 'undo', 'undo', 'redo']);
      expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
      expect(store.getState().project.scene.routes).toHaveLength(routes + 1);
      const at = store.playback().atMs;
      for (const name of ['.', '.', '.', ',']) expect(key({ ...press(name), repeat: true }, { mac }), `${name} held`).toBe(true);
      expect(ran.slice(4)).toEqual(['stepForward', 'stepForward', 'stepForward', 'stepBack']);
      expect(store.playback().atMs).toBe(Math.floor(at / 40) * 40 + 80);
    }
  });

  it('point 5: a held key is never taken where its first press would not be: typing, a dialog, a kept key, switched off', () => {
    const { ran, key } = rig();
    const held = (name: string) => ({ ...press(name), repeat: true });
    expect(key(held(' '), { place: { ...OPEN, typing: true } })).toBe(false);
    expect(key(held(' '), { place: { ...OPEN, dialogOpen: true } })).toBe(false);
    expect(key(held(' '), { place: { ...OPEN, focus: 'button' } })).toBe(false);
    expect(key(held('Home'), { place: { ...OPEN, focus: 'slider' } })).toBe(false);
    expect(key(held('k'), { singleKeys: false })).toBe(false);
    expect(key(held('x'))).toBe(false);
    expect(key({ ...held(' '), defaultPrevented: true })).toBe(false);
    expect(ran).toEqual([]);
  });
});

describe('the Editing keys’ one path (point 7; CORE-06, brief 123, ruling AN)', () => {
  const editPresses = (mac: boolean) => [
    { action: 'deleteSelection', press: press('Delete') },
    { action: 'deleteSelection', press: press('Backspace') },
    { action: 'duplicate', press: press('d', command(mac)) },
    { action: 'selectAll', press: press('a', command(mac)) },
  ];

  it('calls the page’s edit once with its action and is taken when there was something to act on', () => {
    for (const mac of PLATFORMS) {
      for (const { action, press: pressed } of editPresses(mac)) {
        const { ran, key } = rig();
        expect(key(pressed, { mac }), action).toBe(true);
        expect(ran).toEqual([action]);
      }
    }
  });

  it('with nothing to act on is not taken (left to the browser), its first press or a held one', () => {
    for (const mac of PLATFORMS) {
      for (const { action, press: pressed } of editPresses(mac)) {
        const { ran, key } = rig({ editDoes: false });
        expect(key(pressed, { mac }), action).toBe(false);
        expect(key({ ...pressed, repeat: true }, { mac }), `${action} held`).toBe(false);
        expect(ran).toEqual([action, `${action} held`]);
      }
    }
  });

  it('a held key is passed on as a repeat (the page acts no more) and is taken under the same condition', () => {
    for (const mac of PLATFORMS) {
      for (const { action, press: pressed } of editPresses(mac)) {
        const { ran, key } = rig();
        expect(key({ ...pressed, repeat: true }, { mac }), action).toBe(true);
        expect(ran).toEqual([`${action} held`]);
      }
    }
  });

  it('is never called in typed text (Backspace and Cmd or Ctrl+A stay the field’s), in a dialog, or for a press already taken', () => {
    for (const mac of PLATFORMS) {
      const { ran, key } = rig();
      for (const { press: pressed } of editPresses(mac)) {
        expect(key(pressed, { mac, place: { ...OPEN, typing: true } })).toBe(false);
        expect(key(pressed, { mac, place: { ...OPEN, dialogOpen: true } })).toBe(false);
        expect(key({ ...pressed, defaultPrevented: true }, { mac })).toBe(false);
      }
      expect(ran).toEqual([]);
    }
  });

  it('is called from a focused button, link, menu item or slider: none of them keeps these keys', () => {
    for (const focus of ['button', 'link', 'menuitem', 'slider'] as const) {
      const { ran, key } = rig();
      for (const { press: pressed } of editPresses(true)) expect(key(pressed, { place: { ...OPEN, focus } }), focus).toBe(true);
      expect(ran).toEqual(['deleteSelection', 'deleteSelection', 'duplicate', 'selectAll']);
    }
  });
});

// D207: Cmd or Ctrl+O is the editor's wherever it is pressed and is always taken, so the browser's own "Open File" never
// opens over the editor; it opens the chooser from every kind of place, a typing field included, but not while a dialog
// is open. What a test here cannot show: whether Chrome hands a real Cmd or Ctrl+O to the page at all.
describe('Escape’s one path (point 6; CORE-06, brief 115, ruling U)', () => {
  it('calls the page’s Escape once and is taken when it did something (a drag cancelled or the selection cleared)', () => {
    for (const mac of PLATFORMS) {
      const { ran, key } = rig();
      expect(key(press('Escape'), { mac })).toBe(true);
      expect(ran).toEqual(['escape']);
    }
  });

  it('with nothing to do is not taken, its first press or a held one, with single-key shortcuts on or off', () => {
    const { ran, key } = rig({ escapeDoes: false });
    expect(key(press('Escape'))).toBe(false);
    expect(key(press('Escape', { repeat: true }))).toBe(false);
    expect(key(press('Escape'), { singleKeys: false })).toBe(false);
    expect(ran).toEqual(['escape', 'escape', 'escape']);
  });

  it('is never called in typed text, in a dialog, for a press already taken, or with Ctrl, Cmd or Alt held', () => {
    const { ran, key } = rig();
    expect(key(press('Escape'), { place: { ...OPEN, typing: true } })).toBe(false);
    expect(key(press('Escape'), { place: { ...OPEN, dialogOpen: true } })).toBe(false);
    expect(key(press('Escape', { defaultPrevented: true }))).toBe(false);
    for (const held of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) expect(key(press('Escape', held)), JSON.stringify(held)).toBe(false);
    expect(ran).toEqual([]);
  });

  it('works with single-key shortcuts off: Escape is not one printable character', () => {
    const { ran, key } = rig();
    expect(key(press('Escape'), { singleKeys: false })).toBe(true);
    expect(ran).toEqual(['escape']);
  });
});

describe('Open project’s chord (D207)', () => {
  const kinds: readonly FocusKind[] = ['button', 'link', 'menuitem', 'slider', 'other'];
  const chord = (mac: boolean, held: Partial<Omit<KeyPress, 'key'>> = {}) => press('o', { ...command(mac), ...held });

  it('opens the chooser from every kind of place, a typing field included, and is taken', () => {
    for (const mac of PLATFORMS) {
      for (const focus of kinds) {
        for (const typing of [false, true]) {
          const { ran, said, key } = rig();
          expect(key(chord(mac), { mac, place: { typing, dialogOpen: false, focus } })).toBe(true);
          expect(ran).toEqual(['openProject']);
          expect(said).toEqual([]);
        }
      }
    }
  });

  it('while a dialog is open it is taken and runs nothing', () => {
    for (const mac of PLATFORMS) {
      for (const focus of kinds) {
        const { ran, key } = rig();
        expect(key(chord(mac), { mac, place: { typing: true, dialogOpen: true, focus } })).toBe(true);
        expect(ran).toEqual([]);
      }
    }
  });

  it('the other machine’s chord, Shift or Alt held, or a press already taken: no match, not taken', () => {
    for (const mac of PLATFORMS) {
      const { ran, key } = rig();
      const misses = [
        press('o', command(!mac)), chord(mac, { shiftKey: true }), chord(mac, { altKey: true }),
        chord(mac, { defaultPrevented: true }), press('o'),
      ];
      for (const pressed of misses) expect(key(pressed, { mac }), JSON.stringify(pressed)).toBe(false);
      expect(ran).toEqual([]);
    }
  });

  it('works with single-key shortcuts off, and a held chord opens it once', () => {
    for (const mac of PLATFORMS) {
      const { ran, key } = rig();
      expect(key(chord(mac), { mac, singleKeys: false })).toBe(true);
      expect(key(chord(mac, { repeat: true }), { mac })).toBe(true);
      expect(ran).toEqual(['openProject']);
    }
  });
});

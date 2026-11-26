// CORE-05, stage 3: the key table's actions and the functions the shell will bind them to meet by name. Each playback
// action the table lists is a function of the editor's transport, and the transport has none the table lacks but
// `scrub`, which the play bar's slider calls and no key does; Undo and Redo are the store's; Help (`?`), Open
// project (Cmd or Ctrl+O, D207) and Escape (CORE-06, brief 115: a point's drag cancelled, or the selection cleared)
// are the page's, handed to the dispatch, and are the three General actions the store does not answer. So neither side can gain
// one the other lacks without failing here: at run time, and in the type check, which reads the table's own rows.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newScene } from '../../core/model/scene';
import type { Transport } from '../../player/transport/transport';
import { createStore, type Store } from '../store/store';
import { createEditorTransport, type EditorTransport } from '../transport/transport';
import { KEYS, type ActionIn } from './keys';

/** The actions the store answers: the table's General rows that name one of the store's own members. */
type StoreAction = Extract<ActionIn<'General'>, keyof Store>;
/**
 * The General rows the store has no member for, worked out from the store's real keys, must be exactly Help, Open
 * project and Escape: any taken from the table, a fourth page action added, or the store gaining one of them, each fails the
 * type check here.
 */
type PageOnly = Exclude<ActionIn<'General'>, keyof Store>;
type PageActions = 'help' | 'openProject' | 'escape';
const pageAlone: [PageOnly] extends [PageActions] ? ([PageActions] extends [PageOnly] ? true : never) : never = true;

/**
 * Read from the table's own rows, not a list beside it: the editor's transport has a function for every Playback row,
 * and only `scrub` besides. A row added or taken away, or a function, fails the type check here.
 */
type Bound = ActionIn<'Playback'> | 'scrub';
const sameNames: [keyof EditorTransport] extends [Bound] ? ([Bound] extends [keyof EditorTransport] ? true : never) : never = true;

const nothing = (): void => undefined;
const idle: Transport = { play: nothing, pause: nothing, seek: nothing, setSpeed: nothing, length: () => 0 };

describe('the key table and the functions the shell binds it to', () => {
  it('every playback action is the editor’s transport’s function of the same name, and it has no other but scrub', () => {
    const editor = createEditorTransport({ transport: idle, playback: () => ({ playing: false, atMs: 0, speed: 1 }), announce: nothing, canPlay: () => true });
    const playback = KEYS.filter(({ group }) => group === 'Playback').map(({ action }) => action);
    expect(sameNames).toBe(true);
    expect(Object.keys(editor).sort()).toEqual([...playback, 'scrub'].sort());
    const bound = new Map<string, unknown>(Object.entries(editor));
    for (const action of playback) expect(typeof bound.get(action), action).toBe('function');
  });

  it('every other action but Help, Open project and Escape is the store’s function of the same name: Undo and Redo', () => {
    let n = 0;
    const project: Project = { scene: newScene(() => `id-${String((n += 1))}`), images: [] };
    const store = createStore({ project, nextId: () => `new-${String((n += 1))}` });
    const others = KEYS.filter(({ group }) => group !== 'Playback').map(({ action }) => action);
    const answered: readonly StoreAction[] = ['undo', 'redo'];
    expect(pageAlone).toBe(true);
    expect(others).toEqual(['openProject', ...answered, 'help', 'escape']);
    expect('help' in store).toBe(false);
    expect('openProject' in store).toBe(false);
    expect('escape' in store).toBe(false);
    for (const action of answered) expect(typeof store[action], action).toBe('function');
  });
});

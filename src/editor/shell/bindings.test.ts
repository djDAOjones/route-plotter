// CORE-05, stage 3: the key table's actions and the functions the shell will bind them to meet by name. Each playback
// action the table lists is a function of the editor's transport, and the transport has none the table lacks but
// `scrub`, which the play bar's slider calls and no key does; Undo and Redo are the store's; Help (`?`) is the page's,
// handed to the dispatch, and is the one General action the store does not answer. So neither side can gain
// one the other lacks without failing here: at run time, and in the type check, which reads the table's own rows.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import { newScene } from '../../core/model/scene';
import type { Transport } from '../../player/transport/transport';
import { createStore } from '../store/store';
import { createEditorTransport, type EditorTransport } from '../transport/transport';
import { KEYS, type ActionIn } from './keys';

/** The actions the store answers: the table's General rows but Help, which the page opens. */
type StoreAction = Exclude<ActionIn<'General'>, 'help'>;
/** Help is the one General row the store has no function for; a second such row fails the type check here. */
const helpAlone: [Exclude<ActionIn<'General'>, StoreAction>] extends ['help'] ? true : never = true;

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
    const editor = createEditorTransport({ transport: idle, playback: () => ({ playing: false, atMs: 0, speed: 1 }), announce: nothing });
    const playback = KEYS.filter(({ group }) => group === 'Playback').map(({ action }) => action);
    expect(sameNames).toBe(true);
    expect(Object.keys(editor).sort()).toEqual([...playback, 'scrub'].sort());
    const bound = new Map<string, unknown>(Object.entries(editor));
    for (const action of playback) expect(typeof bound.get(action), action).toBe('function');
  });

  it('every other action but Help is the store’s function of the same name: Undo and Redo', () => {
    let n = 0;
    const project: Project = { scene: newScene(() => `id-${String((n += 1))}`), images: [] };
    const store = createStore({ project, nextId: () => `new-${String((n += 1))}` });
    const others = KEYS.filter(({ group }) => group !== 'Playback').map(({ action }) => action);
    const answered: readonly StoreAction[] = ['undo', 'redo'];
    expect(helpAlone).toBe(true);
    expect(others).toEqual([...answered, 'help']);
    expect('help' in store).toBe(false);
    for (const action of answered) expect(typeof store[action], action).toBe('function');
  });
});

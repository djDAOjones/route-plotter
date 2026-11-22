// CORE-05, stage 6: Open's rule (brief 73's rulings 1 to 5), point by point of openLogic.ts's claim, on a real store,
// the player's transport and the editor's transport put together as the session puts them, one frame source run by
// hand for both, and a queue that records what is said. A file's bytes are made by io's own Save; its one image is a
// PNG header built here, which a decoder made here decodes, at once or when the test settles it. Nothing waits or
// reads a clock: a test awaits only promises it settles itself or that io's reading settles.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import type { Decode } from '../../adapters/io/images';
import { openProject } from '../../adapters/io/open';
import { saveProject } from '../../adapters/io/save';
import { WORDS as IO_WORDS } from '../../adapters/io/words';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { AT_START, createTransport, FIRST_FRAME_MS, heldPlayback, type FrameSource } from '../../player/transport/transport';
import { setSceneSetting } from '../store/command';
import { createStore } from '../store/store';
import { createEditorTransport, hasSomethingToPlay, WORDS } from '../transport/transport';
import { createOpener, OPEN_WORDS, type OpenerOptions } from './openLogic';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));
const be32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];

/** The smallest PNG io's header reader accepts: the signature and a whole IHDR chunk, at the size asked for. */
const png = (width: number, height: number) =>
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('IHDR'), ...be32(width), ...be32(height), 8, 6, 0, 0, 0, 0, 0, 0, 0]);

/** The size a PNG header here declares. */
const sizeOfPng = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

/** A decoder that decodes at once: a sound image decodes to the size its header declares. */
const atOnce: Decode = (bytes) => Promise.resolve(sizeOfPng(bytes));

/** A decoder the test settles by hand: `settle(n)` decodes the n-th image asked for; `asked(n)` waits for n asks. */
function byHand() {
  const pending: (() => void)[] = [];
  const waiting: { readonly count: number; readonly call: () => void }[] = [];
  const decode: Decode = (bytes: Uint8Array) =>
    new Promise((resolve) => {
      pending.push(() => {
        resolve(sizeOfPng(bytes));
      });
      for (const wait of waiting.filter(({ count }) => count <= pending.length)) wait.call();
    });
  return {
    decode,
    asked: (count: number) =>
      new Promise<void>((resolve) => {
        if (pending.length >= count) resolve();
        else waiting.push({ count, call: resolve });
      }),
    settle: (n: number) => {
      pending[n]?.();
    },
  };
}

/** One route of `stops` stops joined by lines, the lead starting at the first, held `holdMs` at the start; one image. */
function routeOf(stops: number, holdMs: number, prefix: string): Project {
  const nextId = counter(prefix);
  const points = Array.from({ length: stops }, (_, i) => newPoint(nextId, { x: 0.1 + i * 0.2, y: 0.5, kind: 'stop' as const }));
  const lines = points.slice(1).map((point, i) => newLine(nextId, (points[i] ?? point).id, point.id));
  const route = { ...newRoute(nextId), points, lines, leadStart: points[0]?.id ?? null };
  const scene = newScene(nextId);
  const settings = { ...scene.settings, clock: { ...scene.settings.clock, holdAtStartMs: holdMs } };
  return { scene: { ...scene, settings, routes: [route] }, images: [{ id: `${prefix}-image`, type: 'image/png', bytes: png(64, 48) }] };
}

/** An empty scene with no image: nothing to play. */
const empty = (): Project => ({ scene: newScene(counter('empty')), images: [] });

/** The project's file, made by io's own Save. */
async function fileOf(project: Project): Promise<Uint8Array> {
  const saved = await saveProject(project, atOnce);
  if (!saved.ok) throw new Error(saved.refusal.message);
  return saved.bytes;
}

/** A frame source a test runs by hand: `run` calls the frames booked now, at the time it is given. */
function handMade() {
  let next = 0;
  const booked = new Map<number, (timeMs: number) => void>();
  const source: FrameSource<number> = {
    request: (callback) => {
      next += 1;
      booked.set(next, callback);
      return next;
    },
    cancel: (handle) => {
      booked.delete(handle);
    },
  };
  return {
    source,
    booked: () => booked.size,
    run(timeMs: number) {
      const due = [...booked.values()];
      booked.clear();
      for (const callback of due) callback(timeMs);
    },
  };
}

/** The store, both transports, a queue that records and the opener, as the session will make them. */
function sessionOf(project: Project, opener: Partial<Pick<OpenerOptions, 'decode' | 'openProject'>> = {}) {
  const store = createStore({ project, nextId: counter('new') });
  const frames = handMade();
  const said: string[] = [];
  const announce = (message: string) => {
    said.push(message);
  };
  const player = createTransport({
    frames: frames.source,
    holder: store,
    inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
    report: (error) => {
      throw error;
    },
    ended: () => {
      announce(WORDS.complete);
    },
  });
  const editor = createEditorTransport({
    transport: player,
    playback: () => store.playback(),
    announce,
    canPlay: () => hasSomethingToPlay(store.getState().project.scene),
  });
  const opens = { store: 0 };
  const counted = {
    open: (next: Project) => {
      opens.store += 1;
      return store.open(next);
    },
  };
  const made = createOpener({ store: counted, announce, decode: opener.decode ?? atOnce, ...(opener.openProject ? { openProject: opener.openProject } : {}) });
  const tellings = { count: 0 };
  made.subscribe(() => {
    tellings.count += 1;
  });
  return { store, frames, said, player, editor, opener: made, opens, tellings };
}

/** The length a fresh player gives `project`'s scene: what the opened scene's length must be. */
function lengthOf(project: Project): number {
  return createTransport({
    frames: handMade().source,
    holder: heldPlayback((error) => {
      throw error;
    }),
    inputs: () => ({ scene: project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
    report: (error) => {
      throw error;
    },
  }).length();
}

const NOT_A_FILE = Uint8Array.of(1, 2, 3, 4);

describe('point 1: bytes are opened through openProject and nothing else, then into the store', () => {
  it('hands openProject the bytes and the decoder; on a project, the store opens it, once', async () => {
    const bytes = await fileOf(routeOf(2, 0, 'a'));
    const calls: { bytes: Uint8Array; decode: Decode }[] = [];
    const { store, opener, opens } = sessionOf(empty(), {
      openProject: (given, decode) => {
        calls.push({ bytes: given, decode });
        return openProject(given, decode);
      },
    });
    expect(await opener.open(bytes)).toEqual({ kind: 'opened' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.bytes).toBe(bytes);
    expect(calls[0]?.decode).toBe(atOnce);
    expect(opens.store).toBe(1);
    expect(store.getState().project.scene).toEqual(routeOf(2, 0, 'a').scene);
  });

  it('by default it is io’s own Open', async () => {
    const { store, opener } = sessionOf(empty());
    expect(await opener.open(await fileOf(routeOf(3, 0, 'b')))).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(store.getState().project.images).toHaveLength(1);
  });
});

describe('point 2 (ruling 3b): a refusal changes nothing, is given back and held, and is not said', () => {
  it('leaves the store’s state the same object, a playing playing and every step; holds io’s refusal as it stands', async () => {
    const { store, frames, said, editor, opener, opens, tellings } = sessionOf(routeOf(2, 0, 'a'));
    expect(store.dispatch(setSceneSetting('clock', 'holdAtStartMs', 300)).ok).toBe(true);
    editor.playPause();
    frames.run(1000);
    const before = store.getState();
    expect(before.playback.playing).toBe(true);
    expect(before.undo).not.toBeNull();
    const result = await opener.open(NOT_A_FILE);
    const io = await openProject(NOT_A_FILE, atOnce);
    expect(io.ok).toBe(false);
    if (result.kind !== 'refused' || io.ok) throw new Error('refused expected');
    expect(result.refusal).toEqual(io.refusal);
    expect(result.refusal.message).toMatch(/Nothing was opened\.$/);
    expect(opens.store).toBe(0);
    expect(store.getState()).toBe(before);
    expect(frames.booked()).toBe(1);
    frames.run(1016);
    expect(store.playback().playing).toBe(true);
    expect(store.getState().undo).toBe(before.undo);
    expect(opener.read().refusal).toBe(result.refusal);
    expect(opener.read().opening).toBe(false);
    expect(tellings.count).toBe(2);
    expect(said).toEqual([WORDS.playing]);
  });

  it('a new open asked for clears the refusal held at once, with one telling', async () => {
    const { opener, tellings } = sessionOf(empty());
    await opener.open(NOT_A_FILE);
    expect(opener.read().refusal).not.toBeNull();
    const file = await fileOf(routeOf(2, 0, 'a'));
    const told = tellings.count;
    const next = opener.open(file);
    expect(opener.read()).toEqual({ opening: true, refusal: null });
    expect(tellings.count).toBe(told + 1);
    expect(await next).toEqual({ kind: 'opened' });
    expect(opener.read().refusal).toBeNull();
  });
});

describe('point 3 (ruling 3c): the store’s own refusal or throw changes nothing and comes back in io’s words', () => {
  /** A project the store’s declarations refuse: a hold at start below 0. */
  function refusedByStore(): Project {
    const scene = newScene(counter('bad'));
    return { scene: { ...scene, settings: { ...scene.settings, clock: { ...scene.settings.clock, holdAtStartMs: -5 } } }, images: [] };
  }

  it('a project the store refuses: its problems under `scene`, in WORDS.openedInvalid; nothing changes or is said', async () => {
    const { store, said, opener, opens } = sessionOf(routeOf(2, 0, 'a'), {
      openProject: () => Promise.resolve({ ok: true, project: refusedByStore() }),
    });
    const before = store.getState();
    const result = await opener.open(NOT_A_FILE);
    if (result.kind !== 'refused' || result.refusal.reason !== 'invalid') throw new Error('invalid expected');
    expect(opens.store).toBe(1);
    expect(result.refusal.problems.length).toBeGreaterThan(0);
    for (const { path } of result.refusal.problems) expect(path).toMatch(/^scene(\.|$)/);
    expect(result.refusal.problems.some(({ path }) => path.includes('holdAtStartMs'))).toBe(true);
    expect(result.refusal.message).toBe(IO_WORDS.openedInvalid(result.refusal.problems));
    expect(store.getState()).toBe(before);
    expect(opener.read().refusal).toBe(result.refusal);
    expect(said).toEqual([]);
  });

  it('a project the store throws on: one problem for the whole, no error escapes, nothing changes', async () => {
    const scene = { ...newScene(counter('odd')) };
    Object.setPrototypeOf(scene, { inherited: true });
    const notPlain: Project = { scene, images: [] };
    expect(() => createStore({ project: empty(), nextId: counter('x') }).open(notPlain)).toThrow(TypeError);
    const { store, said, opener } = sessionOf(routeOf(2, 0, 'a'), {
      openProject: () => Promise.resolve({ ok: true, project: notPlain }),
    });
    const before = store.getState();
    const result = await opener.open(NOT_A_FILE);
    if (result.kind !== 'refused' || result.refusal.reason !== 'invalid') throw new Error('invalid expected');
    expect(result.refusal.problems).toHaveLength(1);
    expect(result.refusal.message).toBe(IO_WORDS.openedInvalid(result.refusal.problems));
    expect(store.getState()).toBe(before);
    expect(said).toEqual([]);
  });

  it('a stand-in Open that throws is given back as io’s catch-all', async () => {
    const { store, opener } = sessionOf(empty(), { openProject: () => Promise.reject(new Error('boom')) });
    const before = store.getState();
    const result = await opener.open(NOT_A_FILE);
    expect(result).toEqual({
      kind: 'refused',
      refusal: { reason: 'unsafe', message: IO_WORDS.openedUnsafe('it is damaged: part of it could not be unpacked') },
    });
    expect(store.getState()).toBe(before);
  });
});

describe('point 4 (ruling 3d, DEF-67): the open is announced once, and nothing says "Animation paused"', () => {
  it('play, then open: the playing’s words, then the open’s, no more; the frame booked is met and books no more', async () => {
    const { store, frames, said, editor, opener } = sessionOf(routeOf(2, 0, 'a'));
    editor.playPause();
    frames.run(1000);
    frames.run(1016);
    expect(store.playback().playing).toBe(true);
    expect(frames.booked()).toBe(1);
    expect(await opener.open(await fileOf(routeOf(3, 500, 'b')))).toEqual({ kind: 'opened' });
    expect(store.playback()).toEqual(AT_START);
    expect(frames.booked()).toBe(1);
    frames.run(1032);
    expect(frames.booked()).toBe(0);
    expect(store.playback()).toEqual(AT_START);
    expect(said).toEqual([WORDS.playing, OPEN_WORDS.opened]);
    expect(said).not.toContain(WORDS.paused);
  });

  it('open with nothing playing: the open’s words alone, and no frame booked', async () => {
    const { frames, said, opener } = sessionOf(routeOf(2, 0, 'a'));
    await opener.open(await fileOf(routeOf(3, 0, 'b')));
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(frames.booked()).toBe(0);
  });

  it('the words are "Project opened"', () => {
    expect(OPEN_WORDS.opened).toBe('Project opened');
    expect(Object.isFrozen(OPEN_WORDS)).toBe(true);
  });
});

describe('point 5 (ruling 3e, criterion 3’s open half): an opened project plays at once with its timing built', () => {
  it('from 0, at normal speed, its length the opened scene’s, with no step between the open and Play', async () => {
    const opened = routeOf(3, 700, 'b');
    const { store, frames, said, player, editor, opener } = sessionOf(routeOf(2, 0, 'a'));
    const old = player.length();
    expect(lengthOf(opened)).not.toBe(old);
    expect(await opener.open(await fileOf(opened))).toEqual({ kind: 'opened' });
    expect(store.playback()).toEqual(AT_START);
    expect(frames.booked()).toBe(0);
    editor.playPause();
    expect(store.playback().playing).toBe(true);
    expect(player.length()).toBe(lengthOf(opened));
    frames.run(5000);
    expect(store.playback()).toEqual({ playing: true, atMs: FIRST_FRAME_MS, speed: 1 });
    expect(said).toEqual([OPEN_WORDS.opened, WORDS.playing]);
  });

  it('from an empty page, where Play is off, the opened project plays', async () => {
    const opened = routeOf(2, 0, 'a');
    const { store, said, editor, opener } = sessionOf(empty());
    editor.playPause();
    expect(said).toEqual([WORDS.nothingToPlay]);
    await opener.open(await fileOf(opened));
    editor.playPause();
    expect(store.playback().playing).toBe(true);
    expect(said).toEqual([WORDS.nothingToPlay, OPEN_WORDS.opened, WORDS.playing]);
  });
});

describe('point 6 (ruling 3f): only the latest open asked for reaches the store', () => {
  it('the later settling first: the earlier, settling after, changes nothing, says nothing and is told superseded', async () => {
    const decoder = byHand();
    const [fileA, fileB] = await Promise.all([fileOf(routeOf(2, 0, 'a')), fileOf(routeOf(3, 0, 'b'))]);
    const { store, said, opener, opens } = sessionOf(empty(), { decode: decoder.decode });
    const a = opener.open(fileA);
    await decoder.asked(1);
    const b = opener.open(fileB);
    await decoder.asked(2);
    decoder.settle(1);
    expect(await b).toEqual({ kind: 'opened' });
    const afterB = store.getState();
    expect(afterB.project.scene).toEqual(routeOf(3, 0, 'b').scene);
    decoder.settle(0);
    expect(await a).toEqual({ kind: 'superseded' });
    expect(store.getState()).toBe(afterB);
    expect(opens.store).toBe(1);
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(opener.read()).toEqual({ opening: false, refusal: null });
  });

  it('the earlier settling first: it changes nothing and says nothing; the later then opens', async () => {
    const decoder = byHand();
    const [fileA, fileB] = await Promise.all([fileOf(routeOf(2, 0, 'a')), fileOf(routeOf(3, 0, 'b'))]);
    const { store, said, opener, opens } = sessionOf(empty(), { decode: decoder.decode });
    const before = store.getState();
    const a = opener.open(fileA);
    await decoder.asked(1);
    const b = opener.open(fileB);
    await decoder.asked(2);
    decoder.settle(0);
    expect(await a).toEqual({ kind: 'superseded' });
    expect(store.getState()).toBe(before);
    expect(said).toEqual([]);
    expect(opener.read().opening).toBe(true);
    decoder.settle(1);
    expect(await b).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(opens.store).toBe(1);
    expect(said).toEqual([OPEN_WORDS.opened]);
  });

  it('an earlier open refused after a later was asked for holds no refusal', async () => {
    const decoder = byHand();
    const file = await fileOf(routeOf(2, 0, 'a'));
    const { opener } = sessionOf(empty(), { decode: decoder.decode });
    const a = opener.open(NOT_A_FILE);
    const b = opener.open(file);
    expect(await a).toEqual({ kind: 'superseded' });
    expect(opener.read()).toEqual({ opening: true, refusal: null });
    await decoder.asked(1);
    decoder.settle(0);
    expect(await b).toEqual({ kind: 'opened' });
  });
});

describe('point 7: whether an open is under way is held, with a telling when it changes', () => {
  it('true from the ask until the latest settles; one telling each way; nothing said for it', async () => {
    const decoder = byHand();
    const file = await fileOf(routeOf(2, 0, 'a'));
    const { said, opener, tellings } = sessionOf(empty(), { decode: decoder.decode });
    expect(opener.read().opening).toBe(false);
    const a = opener.open(file);
    expect(opener.read().opening).toBe(true);
    expect(tellings.count).toBe(1);
    await decoder.asked(1);
    expect(said).toEqual([]);
    decoder.settle(0);
    await a;
    expect(opener.read().opening).toBe(false);
    expect(tellings.count).toBe(2);
  });
});

describe('point 8: it keeps nothing of a file between opens but the refusal', () => {
  it('its state holds `opening` and `refusal` only, frozen, the same object until one changes', async () => {
    const { opener } = sessionOf(empty());
    const first = opener.read();
    expect(Object.keys(first).sort()).toEqual(['opening', 'refusal']);
    expect(Object.isFrozen(first)).toBe(true);
    expect(opener.read()).toBe(first);
    await opener.open(await fileOf(routeOf(2, 0, 'a')));
    expect(opener.read()).toEqual({ opening: false, refusal: null });
    await opener.open(NOT_A_FILE);
    const refused = opener.read();
    expect(Object.keys(refused).sort()).toEqual(['opening', 'refusal']);
    expect(Object.isFrozen(refused)).toBe(true);
    expect(opener.read()).toBe(refused);
  });

  it('the project opened is not held by the opener: changing it after changes nothing in the store', async () => {
    const project = routeOf(2, 0, 'a');
    const { store, opener } = sessionOf(empty(), { openProject: () => Promise.resolve({ ok: true, project }) });
    await opener.open(NOT_A_FILE);
    const held = store.getState();
    (project.scene.routes as unknown[]).length = 0;
    (project.images[0]?.bytes ?? new Uint8Array(1)).fill(0);
    expect(store.getState()).toBe(held);
    expect(held.project.scene.routes).toHaveLength(1);
    expect(held.project.images[0]?.bytes[0]).toBe(0x89);
  });
});

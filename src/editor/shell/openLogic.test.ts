// CORE-05, stage 6: Open's rule (brief 73's rulings 1 to 5), point by point of openLogic.ts's claim, on a real store,
// the player's transport and the editor's transport put together as the session puts them, one frame source run by
// hand for both, and a queue that records what is said. A file's bytes are made by io's own Save; its one image is a
// PNG header built here, which a decoder made here decodes, at once or when the test settles it. Nothing waits or
// reads a clock: a test awaits only promises it settles itself or that io's reading settles.
import { describe, expect, it } from 'vitest';
import type { Project } from '../../adapters/io/format';
import type { Decode } from '../../adapters/io/images';
import { openProject, type Opened } from '../../adapters/io/open';
import { saveProject } from '../../adapters/io/save';
import { ARCHIVE_LIMITS } from '../../adapters/io/limits';
import { WORDS as IO_WORDS } from '../../adapters/io/words';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { createTransport, FIRST_FRAME_MS, heldPlayback, type FrameSource } from '../../player/transport/transport';
import { setSceneSetting } from '../store/command';
import { createFrameInputs } from './previewLogic';
import { createStore } from '../store/store';
import { createEditorTransport, hasSomethingToPlay, WORDS } from '../transport/transport';
import { createOpener, OPEN_WORDS, type OpenerOptions } from './openLogic';
import { createReplaceAsker } from './ReplaceQuestion';

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

/** A stand-in for the player's transport that records each seek: an opener's only use of it (point 5). */
function recordingPlayer(lengthMs = 4321) {
  const seeks: number[] = [];
  const player = {
    seek: (ms: number) => {
      seeks.push(ms);
    },
    length: () => lengthMs,
  };
  return { player, seeks };
}

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
function sessionOf(
  project: Project,
  opener: Partial<Pick<OpenerOptions, 'decode' | 'openProject' | 'confirmReplace'>> = {},
  /** Called after each saying is recorded: a test may ask for an open there, or throw. */
  onSay: (message: string) => void = () => undefined,
  /** The page's own inputs (`createFrameInputs`), whose picture size is read from the background's header; by default
   *  a fixed size and no picture. */
  sized = false,
) {
  const store = createStore({ project, nextId: counter('new') });
  const frames = handMade();
  const said: string[] = [];
  const announce = (message: string) => {
    said.push(message);
    onSay(message);
  };
  const page = createFrameInputs({ store });
  const player = createTransport({
    frames: frames.source,
    holder: store,
    inputs: sized
      ? page.inputs
      : () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
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
    changed: () => store.changed(),
  };
  const made = createOpener({
    store: counted, announce, player, decode: opener.decode ?? atOnce,
    ...(opener.openProject ? { openProject: opener.openProject } : {}),
    ...(opener.confirmReplace ? { confirmReplace: opener.confirmReplace } : {}),
  });
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

/** The refusal given for a store's throw, or a store refusal with no problems: one problem for the whole project. */
const WHOLE_PROBLEMS = [{ path: '', rule: 'type' as const, expected: 'a project the editor can hold', received: 'one it could not take' }];
const WHOLE_PROJECT = { reason: 'invalid', message: IO_WORDS.openedInvalid(WHOLE_PROBLEMS), problems: WHOLE_PROBLEMS };

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
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: null });
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
    const problems = [
      { path: 'scene.settings.clock.holdAtStartMs', rule: 'range' as const, expected: 'a whole number from 0 to 10000 milliseconds', received: '-5' },
    ];
    expect(result.refusal).toEqual({ reason: 'invalid', message: IO_WORDS.openedInvalid(problems), problems });
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
    expect(result).toEqual({ kind: 'refused', refusal: WHOLE_PROJECT });
    if (result.kind !== 'refused') throw new Error('refused expected');
    expect(opener.read().refusal).toBe(result.refusal);
    expect(store.getState()).toBe(before);
    expect(said).toEqual([]);
  });

  it('a stand-in store refusing with no problems gives the same whole-project refusal', async () => {
    const { player, seeks } = recordingPlayer();
    const opener = createOpener({
      store: { open: () => ({ ok: false, refusal: { why: 'gesture-open' } }) },
      announce: () => undefined,
      player,
      decode: atOnce,
      openProject: () => Promise.resolve({ ok: true, project: routeOf(2, 0, 'a') }),
    });
    expect(await opener.open(NOT_A_FILE)).toEqual({ kind: 'refused', refusal: WHOLE_PROJECT });
    expect(opener.read().refusal).toEqual(WHOLE_PROJECT);
    expect(seeks).toEqual([]);
  });

  it('a store problem at the scene itself (path \'\') comes back at `scene`', async () => {
    const problem = { path: '', rule: 'type' as const, expected: 'a scene', received: 'something else' };
    const opener = createOpener({
      store: { open: () => ({ ok: false, refusal: { why: 'invalid', problems: [problem] } }) },
      announce: () => undefined,
      player: recordingPlayer().player,
      decode: atOnce,
      openProject: () => Promise.resolve({ ok: true, project: routeOf(2, 0, 'a') }),
    });
    const problems = [{ ...problem, path: 'scene' }];
    expect(await opener.open(NOT_A_FILE)).toEqual({
      kind: 'refused',
      refusal: { reason: 'invalid', message: IO_WORDS.openedInvalid(problems), problems },
    });
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
  it('play, then open: the playing’s words, then the open’s, no more; paused at the end, the frame booked let go', async () => {
    const opened = routeOf(3, 500, 'b');
    const { store, frames, said, editor, opener } = sessionOf(routeOf(2, 0, 'a'));
    editor.playPause();
    frames.run(1000);
    frames.run(1016);
    expect(store.playback().playing).toBe(true);
    expect(frames.booked()).toBe(1);
    expect(await opener.open(await fileOf(opened))).toEqual({ kind: 'opened' });
    const end = { playing: false, atMs: lengthOf(opened), speed: 1 };
    expect(store.playback()).toEqual(end);
    expect(frames.booked()).toBe(0);
    frames.run(1032);
    expect(frames.booked()).toBe(0);
    expect(store.playback()).toEqual(end);
    expect(said).toEqual([WORDS.playing, OPEN_WORDS.opened]);
    expect(said).not.toContain(WORDS.paused);
    expect(said).not.toContain(WORDS.skippedToEnd);
    expect(said).not.toContain(WORDS.complete);
  });

  it('open with nothing playing: the open’s words alone, and no frame booked', async () => {
    const { frames, said, opener } = sessionOf(routeOf(2, 0, 'a'));
    await opener.open(await fileOf(routeOf(3, 0, 'b')));
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(frames.booked()).toBe(0);
  });

  it('the seek is made before the open’s words, and is the player’s own: nothing is said for it', async () => {
    const opened = routeOf(3, 0, 'b');
    const seen: unknown[] = [];
    const { store, said, opener } = sessionOf(routeOf(2, 0, 'a'), {}, () => {
      seen.push(store.playback());
    });
    await opener.open(await fileOf(opened));
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(seen).toEqual([{ playing: false, atMs: lengthOf(opened), speed: 1 }]);
  });

  it('the words are "Project opened"', () => {
    expect(OPEN_WORDS.opened).toBe('Project opened');
    expect(Object.isFrozen(OPEN_WORDS)).toBe(true);
  });
});

describe('point 5 (ruling 3e, criterion 3’s open half): an opened project plays at once with its timing built', () => {
  it('paused at the end, then from 0, at normal speed, its length the opened scene’s, with no step between the open and Play', async () => {
    const opened = routeOf(3, 700, 'b');
    const { store, frames, said, player, editor, opener } = sessionOf(routeOf(2, 0, 'a'));
    const old = player.length();
    expect(lengthOf(opened)).not.toBe(old);
    expect(await opener.open(await fileOf(opened))).toEqual({ kind: 'opened' });
    expect(store.playback()).toEqual({ playing: false, atMs: lengthOf(opened), speed: 1 });
    expect(lengthOf(opened)).toBeGreaterThan(FIRST_FRAME_MS);
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

describe('point 5 (D251, brief 127): an open the store takes, and only such an open, waits paused at the play length', () => {
  it('a speed set before the open is put back to normal; the end is the play length, Hold at end included', async () => {
    const opened = routeOf(3, 0, 'b');
    const { clock } = opened.scene.settings;
    const held = { ...opened, scene: { ...opened.scene, settings: { ...opened.scene.settings, clock: { ...clock, holdAtEndMs: clock.holdAtEndMs + 1500 } } } };
    const { store, player, opener } = sessionOf(routeOf(2, 0, 'a'));
    player.setSpeed(-2);
    expect(store.playback().speed).toBe(-2);
    await opener.open(await fileOf(held));
    expect(lengthOf(held)).toBe(lengthOf(opened) + 1500);
    expect(store.playback()).toEqual({ playing: false, atMs: lengthOf(held), speed: 1 });
  });

  it('a refused open moves nothing: a position scrubbed to stays, a playing plays on', async () => {
    const { store, frames, editor, opener } = sessionOf(routeOf(3, 0, 'a'));
    editor.scrub(250);
    expect(await opener.open(NOT_A_FILE)).toMatchObject({ kind: 'refused' });
    expect(store.playback()).toEqual({ playing: false, atMs: 250, speed: 1 });
    editor.playPause();
    frames.run(1000);
    const playing = store.playback();
    expect(await opener.open(NOT_A_FILE)).toMatchObject({ kind: 'refused' });
    expect(store.playback()).toBe(playing);
    expect(frames.booked()).toBe(1);
  });

  it('a superseded open moves nothing: the playhead waits at the later open’s end, not its own', async () => {
    const decoder = byHand();
    const [projectA, projectB] = [routeOf(3, 900, 'a'), routeOf(2, 0, 'b')];
    expect(lengthOf(projectA)).not.toBe(lengthOf(projectB));
    const [fileA, fileB] = await Promise.all([fileOf(projectA), fileOf(projectB)]);
    const { store, opener } = sessionOf(empty(), { decode: decoder.decode });
    const a = opener.open(fileA);
    await decoder.asked(1);
    const b = opener.open(fileB);
    await decoder.asked(2);
    decoder.settle(1);
    expect(await b).toEqual({ kind: 'opened' });
    const atB = store.playback();
    expect(atB).toEqual({ playing: false, atMs: lengthOf(projectB), speed: 1 });
    decoder.settle(0);
    expect(await a).toEqual({ kind: 'superseded' });
    expect(store.playback()).toBe(atB);
  });

  it('the length is the final one: built from the opened scene and its picture’s size, never one read before the open', async () => {
    // The same upright route, unpictured on the page before (measured as a square); opened with a tall picture, whose
    // header's size changes the length (a line's length is measured in image widths, so an upright line on a tall
    // picture is longer). A seek made with a length read before the open lands short.
    const flat = routeOf(3, 0, 'b');
    const [route] = flat.scene.routes;
    if (route === undefined) throw new Error('no route');
    const upright = { ...route, points: route.points.map((point, i) => ({ ...point, x: 0.5, y: 0.1 + i * 0.4 })) };
    const opened: Project = { ...flat, scene: { ...flat.scene, routes: [upright] } };
    const pictured: Project = { ...opened, images: [{ id: 'b-image', type: 'image/png', bytes: png(64, 2000) }] };
    const before: Project = { ...opened, images: [] };
    const { store, player, opener } = sessionOf(before, {}, () => undefined, true);
    const old = player.length();
    expect(await opener.open(await fileOf(pictured))).toEqual({ kind: 'opened' });
    const final = player.length();
    expect(final).toBeGreaterThan(old);
    expect(store.playback()).toEqual({ playing: false, atMs: final, speed: 1 });
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
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
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
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: null });
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
  it('its state holds `opening`, `refusal` and `name` only, frozen, the same object until one changes', async () => {
    const { opener } = sessionOf(empty());
    const first = opener.read();
    expect(Object.keys(first).sort()).toEqual(['name', 'opening', 'refusal']);
    expect(Object.isFrozen(first)).toBe(true);
    expect(opener.read()).toBe(first);
    await opener.open(await fileOf(routeOf(2, 0, 'a')));
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
    await opener.open(NOT_A_FILE);
    const refused = opener.read();
    expect(Object.keys(refused).sort()).toEqual(['name', 'opening', 'refusal']);
    expect(Object.isFrozen(refused)).toBe(true);
    expect(opener.read()).toBe(refused);
  });

  it('the store keeps its own copy of the project opened: changing the one handed in changes nothing there', async () => {
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

describe('point 6 and ruling A: an open asked for during another’s completion', () => {
  /** A's file, B's file and a session where both are decoded by hand (A's image first, then B's). */
  async function twoOpens(onSay?: (message: string) => void) {
    const decoder = byHand();
    const [fileA, fileB] = await Promise.all([fileOf(routeOf(2, 0, 'a')), fileOf(routeOf(3, 0, 'b'))]);
    const session = sessionOf(empty(), { decode: decoder.decode }, onSay);
    return { decoder, fileA, fileB, ...session };
  }

  /** After A is opened with B asked for during its completion: B is held as under way, then opens in turn. */
  async function thenB(run: Awaited<ReturnType<typeof twoOpens>>, b: () => Promise<unknown> | null) {
    const { decoder, store, said, opener } = run;
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: null });
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(store.getState().project.scene).toEqual(routeOf(2, 0, 'a').scene);
    await decoder.asked(2);
    decoder.settle(1);
    expect(await b()).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(said).toEqual([OPEN_WORDS.opened, OPEN_WORDS.opened]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
  }

  it('B asked for by a store subscriber during A’s store.open: A is opened, B is under way, then B opens', async () => {
    const run = await twoOpens();
    let b: Promise<unknown> | null = null;
    run.store.subscribe(() => {
      b ??= run.opener.open(run.fileB);
    });
    const a = run.opener.open(run.fileA);
    await run.decoder.asked(1);
    run.decoder.settle(0);
    expect(await a).toEqual({ kind: 'opened' });
    expect(b).not.toBeNull();
    await thenB(run, () => b);
  });

  it('B asked for from inside announce: A is opened, B is under way, then B opens', async () => {
    let ask: (() => void) | null = null;
    const run = await twoOpens(() => {
      const once = ask;
      ask = null;
      once?.();
    });
    let b: Promise<unknown> | null = null;
    ask = () => {
      b = run.opener.open(run.fileB);
    };
    const a = run.opener.open(run.fileA);
    await run.decoder.asked(1);
    run.decoder.settle(0);
    expect(await a).toEqual({ kind: 'opened' });
    expect(b).not.toBeNull();
    await thenB(run, () => b);
  });

  it('A refused by the store after B was asked for during its store.open: A’s caller is told why; B’s state is held', async () => {
    const decoder = byHand();
    const fileB = await fileOf(routeOf(3, 0, 'b'));
    const later: { b: Promise<unknown> | null } = { b: null };
    const real = createStore({ project: empty(), nextId: counter('s') });
    const refusing = {
      open: (next: Project) => {
        later.b ??= opener.open(fileB);
        return real.open(next);
      },
    };
    const project = routeOf(2, 0, 'a');
    const bad = { ...project, scene: { ...project.scene, settings: { ...project.scene.settings, clock: { ...project.scene.settings.clock, holdAtStartMs: -5 } } } };
    let first = true;
    const { player, seeks } = recordingPlayer();
    const opener = createOpener({
      store: refusing,
      announce: () => undefined,
      player,
      decode: decoder.decode,
      openProject: (bytes, decode) => {
        if (first) {
          first = false;
          return Promise.resolve({ ok: true, project: bad });
        }
        return openProject(bytes, decode);
      },
    });
    const a = await opener.open(NOT_A_FILE);
    expect(a).toMatchObject({ kind: 'refused', refusal: { reason: 'invalid' } });
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: null });
    expect(seeks).toEqual([]);
    await decoder.asked(1);
    decoder.settle(0);
    expect(await later.b).toEqual({ kind: 'opened' });
    expect(seeks).toEqual([4321]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
  });
});

describe('ruling B: a throwing announce', () => {
  it('the open is still opened, `opening` goes false, the promise resolves, and a second open works', async () => {
    let throws = true;
    const { store, said, opener } = sessionOf(empty(), {}, () => {
      if (throws) {
        throws = false;
        throw new Error('queue broke');
      }
    });
    expect(await opener.open(await fileOf(routeOf(2, 0, 'a')))).toEqual({ kind: 'opened' });
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
    expect(store.getState().project.scene).toEqual(routeOf(2, 0, 'a').scene);
    expect(await opener.open(await fileOf(routeOf(3, 0, 'b')))).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(said).toEqual([OPEN_WORDS.opened, OPEN_WORDS.opened]);
  });
});

describe('ruling C: a throwing listener', () => {
  it('the others are still told each time, and open neither stops nor rejects', async () => {
    const { opener } = sessionOf(empty());
    opener.subscribe(() => {
      if (opener.read().opening) throw new Error('listener broke');
    });
    const seen: boolean[] = [];
    opener.subscribe(() => {
      seen.push(opener.read().opening);
    });
    expect(await opener.open(await fileOf(routeOf(2, 0, 'a')))).toEqual({ kind: 'opened' });
    expect(seen).toEqual([true, false]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
  });
});

/** A file whose read gives `bytes` at once, counting its reads; `size` is the bytes' unless one is given. */
function fileOfBytes(name: string, bytes: Uint8Array, size = bytes.byteLength) {
  const reads = { count: 0 };
  const file = {
    name,
    size,
    arrayBuffer: () => {
      reads.count += 1;
      return Promise.resolve(bytes.slice().buffer);
    },
  };
  return { file, reads };
}

/** A file whose read the test settles by hand (`give`) or fails (`fail`). */
function fileByHand(name: string, bytes: Uint8Array) {
  let give: () => void = () => undefined;
  let fail: () => void = () => undefined;
  const file = {
    name,
    size: bytes.byteLength,
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((resolve, reject) => {
        give = () => {
          resolve(bytes.slice().buffer);
        };
        fail = () => {
          reject(new Error('NotReadableError'));
        };
      }),
  };
  return { file, give: () => { give(); }, fail: () => { fail(); } };
}

/** An io Open that counts the bytes handed to it and is io's own. */
function countingOpen() {
  const handed: Uint8Array[] = [];
  return {
    handed,
    openProject: (bytes: Uint8Array, decode: Decode) => {
      handed.push(bytes);
      return openProject(bytes, decode);
    },
  };
}

describe('openFile: one ask, as open; once read, open’s own path', () => {
  it('a file read whole opens as its bytes do: the store takes it, "Project opened" is said, the state is at rest', async () => {
    const io = countingOpen();
    const bytes = await fileOf(routeOf(2, 0, 'a'));
    const { file, reads } = fileOfBytes('walk.zip', bytes);
    const { store, said, opener, opens, tellings } = sessionOf(empty(), { openProject: io.openProject });
    expect(await opener.openFile(file)).toEqual({ kind: 'opened' });
    expect(reads.count).toBe(1);
    expect(io.handed).toHaveLength(1);
    expect([...(io.handed[0] ?? [])]).toEqual([...bytes]);
    expect(opens.store).toBe(1);
    expect(store.getState().project.scene).toEqual(routeOf(2, 0, 'a').scene);
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
    expect(tellings.count).toBe(2);
  });

  it('a file io refuses: io’s refusal as it stands, held with the file’s name; nothing changes or is said', async () => {
    const { store, said, opener, opens } = sessionOf(routeOf(2, 0, 'a'));
    const before = store.getState();
    const result = await opener.openFile(fileOfBytes('notes.zip', NOT_A_FILE).file);
    const io = await openProject(NOT_A_FILE, atOnce);
    if (result.kind !== 'refused' || io.ok) throw new Error('refused expected');
    expect(result.refusal).toEqual(io.refusal);
    expect(opener.read()).toEqual({ opening: false, refusal: result.refusal, name: 'notes.zip' });
    expect(store.getState()).toBe(before);
    expect(opens.store).toBe(0);
    expect(said).toEqual([]);
  });
});

describe('point 9: a file too large is never read', () => {
  it('over 50 MB: arrayBuffer is not called; io’s own refusal for that size, the same as io gives 50 MB and one byte', async () => {
    const io = countingOpen();
    const { file, reads } = fileOfBytes('huge.zip', NOT_A_FILE, ARCHIVE_LIMITS.zipBytes + 1);
    const { store, said, opener, opens } = sessionOf(routeOf(2, 0, 'a'), { openProject: io.openProject });
    const before = store.getState();
    const result = await opener.openFile(file);
    expect(reads.count).toBe(0);
    expect(io.handed).toHaveLength(0);
    const ioOwn = await openProject(new Uint8Array(ARCHIVE_LIMITS.zipBytes + 1), atOnce);
    if (result.kind !== 'refused' || ioOwn.ok) throw new Error('refused expected');
    expect(result.refusal).toEqual(ioOwn.refusal);
    expect(result.refusal).toEqual({ reason: 'too-large', message: IO_WORDS.openedTooLarge('a project file holds at most 50 MB') });
    expect(opener.read()).toEqual({ opening: false, refusal: result.refusal, name: 'huge.zip' });
    expect(store.getState()).toBe(before);
    expect(opens.store).toBe(0);
    expect(said).toEqual([]);
  });

  it('at exactly 50 MB the file is read and opened', async () => {
    const { file, reads } = fileOfBytes('edge.zip', await fileOf(routeOf(2, 0, 'a')), ARCHIVE_LIMITS.zipBytes);
    const { opener } = sessionOf(empty());
    expect(await opener.openFile(file)).toEqual({ kind: 'opened' });
    expect(reads.count).toBe(1);
  });
});

describe('point 10: a file that cannot be read', () => {
  const unreadable = { reason: 'unsafe', message: IO_WORDS.openedUnreadable };

  it('says the file could not be read and to choose it again, not that the project is unsafe (STACK-08)', () => {
    expect(unreadable.message).toBe(
      'This file could not be read: it may have been moved, or the browser may no longer have access to it. Choose ' +
        'it again from where it is now. Nothing was opened.',
    );
  });

  it('a read that rejects: nothing changes, refused in io’s words, held with the name', async () => {
    const io = countingOpen();
    const { store, said, opener, opens } = sessionOf(routeOf(2, 0, 'a'), { openProject: io.openProject });
    const before = store.getState();
    const by = fileByHand('moved.zip', NOT_A_FILE);
    const asked = opener.openFile(by.file);
    by.fail();
    expect(await asked).toEqual({ kind: 'refused', refusal: unreadable });
    expect(opener.read()).toEqual({ opening: false, refusal: unreadable, name: 'moved.zip' });
    expect(io.handed).toHaveLength(0);
    expect(store.getState()).toBe(before);
    expect(opens.store).toBe(0);
    expect(said).toEqual([]);
  });

  it('a read that throws at once is refused the same, and openFile does not reject', async () => {
    const { opener } = sessionOf(empty());
    const file = {
      name: 'gone.zip',
      size: 10,
      arrayBuffer: (): Promise<ArrayBuffer> => {
        throw new Error('NotFoundError');
      },
    };
    expect(await opener.openFile(file)).toEqual({ kind: 'refused', refusal: unreadable });
  });
});

describe('point 11: the latest ask wins across the read too', () => {
  it('a later open asked while a file is read opens; the file, read after, is superseded and never unpacked', async () => {
    const io = countingOpen();
    const fileB = await fileOf(routeOf(3, 0, 'b'));
    const { store, said, opener, opens } = sessionOf(empty(), { openProject: io.openProject });
    const by = fileByHand('a.zip', await fileOf(routeOf(2, 0, 'a')));
    const a = opener.openFile(by.file);
    expect(await opener.open(fileB)).toEqual({ kind: 'opened' });
    const afterB = store.getState();
    by.give();
    expect(await a).toEqual({ kind: 'superseded' });
    expect(io.handed).toHaveLength(1);
    expect(store.getState()).toBe(afterB);
    expect(afterB.project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(opens.store).toBe(1);
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
  });

  it('the earlier file read first: superseded, nothing changes; the later file then opens, its name held meanwhile', async () => {
    const io = countingOpen();
    const { store, said, opener, opens } = sessionOf(empty(), { openProject: io.openProject });
    const before = store.getState();
    const byA = fileByHand('a.zip', await fileOf(routeOf(2, 0, 'a')));
    const byB = fileByHand('b.zip', await fileOf(routeOf(3, 0, 'b')));
    const a = opener.openFile(byA.file);
    const b = opener.openFile(byB.file);
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: 'b.zip' });
    byA.give();
    expect(await a).toEqual({ kind: 'superseded' });
    expect(store.getState()).toBe(before);
    expect(io.handed).toHaveLength(0);
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: 'b.zip' });
    byB.give();
    expect(await b).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(opens.store).toBe(1);
    expect(said).toEqual([OPEN_WORDS.opened]);
  });

  it('an earlier file whose read fails after a later was asked for holds no refusal', async () => {
    const { opener } = sessionOf(empty());
    const byA = fileByHand('a.zip', NOT_A_FILE);
    const byB = fileByHand('b.zip', await fileOf(routeOf(2, 0, 'a')));
    const a = opener.openFile(byA.file);
    const b = opener.openFile(byB.file);
    byA.fail();
    expect(await a).toEqual({ kind: 'superseded' });
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: 'b.zip' });
    byB.give();
    expect(await b).toEqual({ kind: 'opened' });
  });
});

describe('point 12: the name, and the dismissal', () => {
  it('the name is held while the file is read and with its refusal, as it came; null at rest and for open(bytes)', async () => {
    const { opener } = sessionOf(empty());
    expect(opener.read().name).toBeNull();
    const odd = '<b>walk</b> & "co".zip';
    const by = fileByHand(odd, NOT_A_FILE);
    const asked = opener.openFile(by.file);
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: odd });
    by.give();
    await asked;
    expect(opener.read().name).toBe(odd);
    expect(opener.read().refusal).not.toBeNull();
    await opener.open(NOT_A_FILE);
    expect(opener.read().name).toBeNull();
    expect(opener.read().refusal).not.toBeNull();
  });

  it('dismiss clears a refusal held and its name, with one telling', async () => {
    const { opener, tellings } = sessionOf(empty());
    await opener.openFile(fileOfBytes('notes.zip', NOT_A_FILE).file);
    const told = tellings.count;
    opener.dismiss();
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
    expect(tellings.count).toBe(told + 1);
    opener.dismiss();
    expect(tellings.count).toBe(told + 1);
  });

  it('dismiss at rest, and while an open is under way, does nothing and tells nobody', async () => {
    const { opener, tellings } = sessionOf(empty());
    const rest = opener.read();
    opener.dismiss();
    expect(opener.read()).toBe(rest);
    expect(tellings.count).toBe(0);
    const by = fileByHand('slow.zip', await fileOf(routeOf(2, 0, 'a')));
    const asked = opener.openFile(by.file);
    const under = opener.read();
    const told = tellings.count;
    opener.dismiss();
    expect(opener.read()).toBe(under);
    expect(tellings.count).toBe(told);
    by.give();
    expect(await asked).toEqual({ kind: 'opened' });
  });
});

describe('point 11 (Codex on 0075a60): an ask made by a listener told of another ask’s start', () => {
  /** A session whose listener asks for B once, while it is told that A (named `aName`) is opening. */
  async function askedInside(ask: (opener: ReturnType<typeof sessionOf>['opener'], fileB: Uint8Array) => Promise<unknown>) {
    const io = countingOpen();
    const [fileA, fileB] = await Promise.all([fileOf(routeOf(2, 0, 'a')), fileOf(routeOf(3, 0, 'b'))]);
    const session = sessionOf(empty(), { openProject: io.openProject });
    let b: Promise<unknown> | null = null;
    let once = false;
    session.opener.subscribe(() => {
      // Set before asking: B's own start tells this listener again, inside the ask.
      if (!once && session.opener.read().opening) {
        once = true;
        b = ask(session.opener, fileB);
      }
    });
    return { io, fileA, fileB, later: () => b, ...session };
  }

  it('openFile: A is superseded and its bytes never reach openProject; B alone opens, said once', async () => {
    const run = await askedInside((opener, fileB) => opener.openFile(fileOfBytes('b.zip', fileB).file));
    const a = await run.opener.openFile(fileOfBytes('a.zip', run.fileA).file);
    expect(a).toEqual({ kind: 'superseded' });
    expect(await run.later()).toEqual({ kind: 'opened' });
    expect(run.io.handed).toHaveLength(1);
    expect([...(run.io.handed[0] ?? [])]).toEqual([...run.fileB]);
    expect(run.opens.store).toBe(1);
    expect(run.store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(run.said).toEqual([OPEN_WORDS.opened]);
    expect(run.opener.read()).toEqual({ opening: false, refusal: null, name: null });
  });

  it('open(bytes): A is superseded (its bytes are handed to io, as open reads at once, but never reach the store); B alone opens, said once', async () => {
    const run = await askedInside((opener, fileB) => opener.open(fileB));
    const a = await run.opener.open(run.fileA);
    expect(a).toEqual({ kind: 'superseded' });
    expect(await run.later()).toEqual({ kind: 'opened' });
    expect(run.io.handed).toHaveLength(2);
    expect(run.opens.store).toBe(1);
    expect(run.store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(run.said).toEqual([OPEN_WORDS.opened]);
    expect(run.opener.read()).toEqual({ opening: false, refusal: null, name: null });
  });
});

describe('point 13 (PRS2, brief 94): the opener counts the projects the store has taken', () => {
  it('one more for each open the store takes, counted before "Project opened" is said; io’s refusal counts nothing', async () => {
    let next: Opened = { ok: true, project: routeOf(2, 0, 'a') };
    const countWhenSaid: number[] = [];
    const run = sessionOf(empty(), { openProject: () => Promise.resolve(next) }, () => {
      countWhenSaid.push(run.opener.opened());
    });
    expect(run.opener.opened()).toBe(0);
    expect(await run.opener.open(NOT_A_FILE)).toEqual({ kind: 'opened' });
    expect(run.opener.opened()).toBe(1);
    expect(countWhenSaid).toEqual([1]);
    next = { ok: false, refusal: { reason: 'not-a-project', message: 'not one' } };
    expect((await run.opener.open(NOT_A_FILE)).kind).toBe('refused');
    expect(run.opener.opened()).toBe(1);
    next = { ok: true, project: routeOf(3, 0, 'b') };
    await run.opener.open(NOT_A_FILE);
    expect(run.opener.opened()).toBe(2);
  });

  it('the store’s own refusal or throw counts nothing', async () => {
    for (const open of [() => ({ ok: false as const, refusal: { why: 'gesture-open' as const } }), () => { throw new Error('boom'); }]) {
      const { player, seeks } = recordingPlayer();
      const opener = createOpener({
        store: { open },
        announce: () => undefined,
        player,
        decode: atOnce,
        openProject: () => Promise.resolve({ ok: true, project: routeOf(2, 0, 'a') }),
      });
      expect((await opener.open(NOT_A_FILE)).kind).toBe('refused');
      expect(opener.opened()).toBe(0);
      expect(seeks).toEqual([]);
    }
  });

  it('a superseded open counts nothing; the later one counts one', async () => {
    const pending: ((opened: Opened) => void)[] = [];
    const run = sessionOf(empty(), {
      openProject: () =>
        new Promise<Opened>((resolve) => {
          pending.push(resolve);
        }),
    });
    const a = run.opener.open(NOT_A_FILE);
    const b = run.opener.open(NOT_A_FILE);
    await Promise.resolve();
    pending[1]?.({ ok: true, project: routeOf(3, 0, 'b') });
    pending[0]?.({ ok: true, project: routeOf(2, 0, 'a') });
    expect(await a).toEqual({ kind: 'superseded' });
    expect(await b).toEqual({ kind: 'opened' });
    expect(run.opener.opened()).toBe(1);
  });
});

describe('D276 (a), brief 144: the opener asks before a chosen project replaces a changed route', () => {
  /** A question that records each name it is asked about and answers `answer`. */
  function asking(answer: boolean | (() => Promise<boolean>)) {
    const asked: string[] = [];
    const confirmReplace = (name: string): Promise<boolean> => {
      asked.push(name);
      return typeof answer === 'boolean' ? Promise.resolve(answer) : answer();
    };
    return { asked, confirmReplace };
  }

  /** A session over a route of two stops, changed by one step. */
  function changedSession(confirmReplace?: (name: string) => Promise<boolean>) {
    const run = sessionOf(routeOf(2, 0, 'a'), confirmReplace ? { confirmReplace } : {});
    expect(run.store.dispatch(setSceneSetting('clock', 'holdAtStartMs', 300)).ok).toBe(true);
    expect(run.store.changed()).toBe(true);
    return run;
  }

  it('the words, for the page', () => {
    expect(OPEN_WORDS.replaceTitle).toBe('Replace your route?');
    expect(OPEN_WORDS.replaceText('walk.zip')).toBe('Replace your route with walk.zip? What you have drawn is not saved and will be lost.');
    expect(OPEN_WORDS.replace).toBe('Replace');
    expect(OPEN_WORDS.keep).toBe('Keep my route');
    expect(OPEN_WORDS.cancelled).toBe('Open cancelled');
  });

  it('an unchanged route never asks: the file opens as today', async () => {
    const question = asking(false);
    const { store, opener, said } = sessionOf(routeOf(2, 0, 'a'), { confirmReplace: question.confirmReplace });
    expect(await opener.openFile(fileOfBytes('walk.zip', await fileOf(routeOf(3, 0, 'b'))).file)).toEqual({ kind: 'opened' });
    expect(question.asked).toEqual([]);
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(said).toEqual([OPEN_WORDS.opened]);
  });

  it('a changed route asks, by the file’s name, once the file is a project; "true" opens as today', async () => {
    const question = asking(true);
    const { store, opener, said, opens } = changedSession(question.confirmReplace);
    expect(await opener.openFile(fileOfBytes('walk.zip', await fileOf(routeOf(3, 0, 'b'))).file)).toEqual({ kind: 'opened' });
    expect(question.asked).toEqual(['walk.zip']);
    expect(opens.store).toBe(1);
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(store.changed()).toBe(false);
    expect(said).toEqual([OPEN_WORDS.opened]);
    expect(opener.opened()).toBe(1);
  });

  it('"false" changes nothing: project, history, selection, transport and play state as before; "Open cancelled" is said', async () => {
    const question = asking(false);
    const { store, opener, said, opens, player } = changedSession(question.confirmReplace);
    const routeId = store.getState().project.scene.routes[0]?.id ?? '';
    store.select({ route: routeId, points: [] });
    const lengthBefore = player.length();
    const before = store.getState();
    const result = await opener.openFile(fileOfBytes('walk.zip', await fileOf(routeOf(3, 0, 'b'))).file);
    expect(result).toEqual({ kind: 'cancelled' });
    expect(question.asked).toEqual(['walk.zip']);
    expect(opens.store).toBe(0);
    expect(store.getState()).toBe(before);
    expect(store.getState().undo).toBe(before.undo);
    expect(store.playback()).toBe(before.playback);
    expect(player.length()).toBe(lengthBefore);
    expect(store.changed()).toBe(true);
    expect(said).toEqual([OPEN_WORDS.cancelled]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
    expect(opener.opened()).toBe(0);
  });

  it('a question that fails keeps the route, as "false" does', async () => {
    const question = asking(() => Promise.reject(new Error('the dialog failed')));
    const { store, opener, said } = changedSession(question.confirmReplace);
    const before = store.getState();
    expect(await opener.open(await fileOf(routeOf(3, 0, 'b')))).toEqual({ kind: 'cancelled' });
    expect(question.asked).toEqual(['the file']);
    expect(store.getState()).toBe(before);
    expect(said).toEqual([OPEN_WORDS.cancelled]);
  });

  it('a file that is not a project, too large or unreadable is refused as today and never asks', async () => {
    const question = asking(true);
    const { store, opener, said } = changedSession(question.confirmReplace);
    const before = store.getState();
    expect((await opener.openFile(fileOfBytes('notes.zip', NOT_A_FILE).file)).kind).toBe('refused');
    expect((await opener.openFile(fileOfBytes('huge.zip', NOT_A_FILE, ARCHIVE_LIMITS.zipBytes + 1).file)).kind).toBe('refused');
    const unreadable = { name: 'gone.zip', size: 4, arrayBuffer: () => Promise.reject(new Error('moved')) };
    expect((await opener.openFile(unreadable)).kind).toBe('refused');
    expect((await opener.open(NOT_A_FILE)).kind).toBe('refused');
    expect(question.asked).toEqual([]);
    expect(store.getState()).toBe(before);
    expect(said).toEqual([]);
  });

  it('with no question given, a changed route is replaced as today', async () => {
    const { store, opener, said } = changedSession();
    expect(await opener.openFile(fileOfBytes('walk.zip', await fileOf(routeOf(3, 0, 'b'))).file)).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(3, 0, 'b').scene);
    expect(said).toEqual([OPEN_WORDS.opened]);
  });

  it('a second Open while the question waits supersedes the first: the first never opens, whatever its answer; the second asks for itself', async () => {
    const answers: ((answer: boolean) => void)[] = [];
    const question = asking(() => new Promise<boolean>((resolve) => { answers.push(resolve); }));
    const { store, opener, said, opens } = changedSession(question.confirmReplace);
    const first = opener.openFile(fileOfBytes('one.zip', await fileOf(routeOf(3, 0, 'b'))).file);
    while (answers.length < 1) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: 'one.zip' });
    const second = opener.openFile(fileOfBytes('two.zip', await fileOf(routeOf(4, 0, 'c'))).file);
    while (answers.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    expect(question.asked).toEqual(['one.zip', 'two.zip']);
    answers[0]?.(true);
    expect(await first).toEqual({ kind: 'superseded' });
    expect(opens.store).toBe(0);
    expect(opener.read()).toEqual({ opening: true, refusal: null, name: 'two.zip' });
    answers[1]?.(true);
    expect(await second).toEqual({ kind: 'opened' });
    expect(opens.store).toBe(1);
    expect(store.getState().project.scene).toEqual(routeOf(4, 0, 'c').scene);
    expect(said).toEqual([OPEN_WORDS.opened]);
  });

  it('a superseded first answered "false" says nothing; the later answer stands', async () => {
    const answers: ((answer: boolean) => void)[] = [];
    const question = asking(() => new Promise<boolean>((resolve) => { answers.push(resolve); }));
    const { opener, said } = changedSession(question.confirmReplace);
    const first = opener.open(await fileOf(routeOf(3, 0, 'b')));
    while (answers.length < 1) await new Promise((resolve) => setTimeout(resolve, 0));
    const second = opener.open(await fileOf(routeOf(4, 0, 'c')));
    while (answers.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    answers[0]?.(false);
    expect(await first).toEqual({ kind: 'superseded' });
    expect(said).toEqual([]);
    answers[1]?.(false);
    expect(await second).toEqual({ kind: 'cancelled' });
    expect(said).toEqual([OPEN_WORDS.cancelled]);
    expect(opener.read()).toEqual({ opening: false, refusal: null, name: null });
  });

  it('with the page’s asker, a second Open while asking leaves one question: the older kept, only the latest opens (brief 145, JC 2)', async () => {
    const asker = createReplaceAsker();
    const { store, opener, said } = changedSession(asker.ask);
    const before = store.getState().project;
    const until = async (done: () => boolean) => {
      for (let i = 0; i < 500 && !done(); i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
      expect(done()).toBe(true);
    };
    const first = opener.openFile(fileOfBytes('one.zip', await fileOf(routeOf(3, 0, 'b'))).file);
    await until(() => asker.read()?.name === 'one.zip');
    const second = opener.openFile(fileOfBytes('two.zip', await fileOf(routeOf(4, 0, 'c'))).file);
    await until(() => asker.read()?.name === 'two.zip');
    expect(await first).toEqual({ kind: 'superseded' });
    expect(store.getState().project).toBe(before);
    expect(said).toEqual([]);
    asker.answer(true);
    expect(await second).toEqual({ kind: 'opened' });
    expect(store.getState().project.scene).toEqual(routeOf(4, 0, 'c').scene);
    expect(said).toEqual([OPEN_WORDS.opened]);
  });
});

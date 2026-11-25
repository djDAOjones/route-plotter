// CORE-05, stage 6 (brief 75's ruling 7, brief 76): the accessibility journeys' project file, as a golden. The journeys
// open a real project on the page and cannot call io's Save from the browser's run, so the file they zip is kept here:
// `goldens/two-stops.project.json` is exactly the `project.json` io's Save writes for the scene built below (one route,
// two stops joined by a line, the lead starting at the first, no image; ids from a counter). With no image the scene
// measures as a square on the page, today and under the preview, so its length there is its true length.
//
// Proved here: Save's ZIP is unpacked and its `project.json` compared byte for byte with the golden; then the golden,
// zipped by this test with JSZip alone (as the run zips it), opens through io's `openProject` into a store and plays
// from 0, its length the one pinned below (the journeys play it). A missing golden fails, and so does a stale one.
// A plain run, here or in CI, never writes it: the writer is reached only under UPDATE_GOLDENS=1. To regenerate it on
// purpose, after a change meant to change what Save writes, run
//   UPDATE_GOLDENS=1 npx vitest run src/editor/shell/openGolden.test.ts --update
// and then read its diff, line by line, before committing it: a golden is only as good as that reading.
import JSZip from 'jszip/dist/jszip.min.js';
import { describe, expect, it } from 'vitest';
import { PROJECT_FILE_NAME, type Project } from '../../adapters/io/format';
import type { Decode } from '../../adapters/io/images';
import { openProject } from '../../adapters/io/open';
import { saveProject } from '../../adapters/io/save';
import { newLine, newPoint, newRoute, newScene, type IdSource } from '../../core/model/scene';
import { createTransport, type FrameSource } from '../../player/transport/transport';
import { createStore } from '../store/store';

const UPDATE = import.meta.env.UPDATE_GOLDENS === '1';
const GOLDENS = import.meta.glob<string>('./goldens/*.project.json', { query: '?raw', import: 'default', eager: true });
const PATH = './goldens/two-stops.project.json';

/** The scene's length, in ms, as the player measures it: the journeys play it for about a second. */
const LENGTH_MS = 6000;

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** One route, two stops joined by a line, the lead starting at the first; no image. */
function twoStops(): Project {
  const nextId = counter('golden');
  const first = newPoint(nextId, { x: 0.25, y: 0.5, kind: 'stop' });
  const second = newPoint(nextId, { x: 0.75, y: 0.5, kind: 'stop' });
  const route = { ...newRoute(nextId), points: [first, second], lines: [newLine(nextId, first.id, second.id)], leadStart: first.id };
  const scene = newScene(nextId);
  return { scene: { ...scene, routes: [route] }, images: [] };
}

/** No image is held, so nothing is decoded. */
const noImage: Decode = () => Promise.resolve(null);

const utf8 = (text: string) => new TextEncoder().encode(text);

/** What io's Save writes as project.json for the scene, as text (Save encodes it once, as UTF-8). */
async function savedJson(): Promise<Uint8Array> {
  const saved = await saveProject(twoStops(), noImage);
  if (!saved.ok) throw new Error(saved.refusal.message);
  const zip = await JSZip.loadAsync(saved.bytes);
  const entry = zip.file(PROJECT_FILE_NAME);
  if (entry === null) throw new Error(`Save wrote no ${PROJECT_FILE_NAME}`);
  return entry.async('uint8array');
}

/** A frame source a test runs by hand. */
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
    run(timeMs: number) {
      const due = [...booked.values()];
      booked.clear();
      for (const callback of due) callback(timeMs);
    },
  };
}

describe('the journeys’ project file', () => {
  it('is exactly the project.json io’s Save writes, byte for byte', async () => {
    const written = new TextDecoder('utf-8', { fatal: true }).decode(await savedJson());
    if (UPDATE) {
      await expect(written).toMatchFileSnapshot(PATH);
      return;
    }
    const golden = GOLDENS[PATH];
    expect(golden, `${PATH} is missing: a golden is written only on purpose (this file's heading says how)`).toBeDefined();
    expect(
      utf8(golden ?? ''),
      `${PATH} is not what Save writes now: if Save was meant to change, regenerate it as this file's heading says`,
    ).toEqual(utf8(written));
  });

  it('is the only golden here', () => {
    expect(Object.keys(GOLDENS)).toEqual(UPDATE ? Object.keys(GOLDENS) : [PATH]);
  });

  it('zipped with JSZip alone, opens through io’s Open into a store and plays from 0, its length pinned', async () => {
    const golden = GOLDENS[PATH];
    expect(golden).toBeDefined();
    const zip = new JSZip();
    zip.file(PROJECT_FILE_NAME, utf8(golden ?? ''), { binary: true, createFolders: false });
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const opened = await openProject(bytes, noImage);
    if (!opened.ok) throw new Error(opened.refusal.message);
    expect(opened.project).toEqual(twoStops());
    const store = createStore({ project: { scene: newScene(counter('empty')), images: [] }, nextId: counter('new') });
    expect(store.open(opened.project).ok).toBe(true);
    const frames = handMade();
    const player = createTransport({
      frames: frames.source,
      holder: store,
      inputs: () => ({ scene: store.getState().project.scene, seed: 1, size: { width: 1920, height: 1080 }, image: null }),
      report: (error) => {
        throw error;
      },
    });
    expect(player.length()).toBe(LENGTH_MS);
    expect(store.playback()).toMatchObject({ playing: false, atMs: 0 });
    player.play();
    frames.run(1000);
    frames.run(1500);
    expect(store.playback().playing).toBe(true);
    expect(store.playback().atMs).toBeGreaterThan(0);
  });
});

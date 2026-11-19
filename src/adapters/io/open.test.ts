// CORE-03: Open, stage by stage. A file opens whole or is refused at the first stage it fails, and a refused file leaves
// nothing behind (DEF-51, inverted from v3/tests/projectRollback.test.js:14–15).
import JSZip from 'jszip/dist/jszip.min.js';
import { describe, expect, it } from 'vitest';
import { newPoint, newScene } from '../../core/model/scene';
import { jpeg, png, webpLossy } from './fixtures';
import { FORMAT_VERSION } from './format';
import type { Project } from './format';
import { ARCHIVE_LIMITS, IMAGE_LIMITS } from './limits';
import { openProject } from './open';
import type { Opened } from './open';
import { saveProject } from './save';

function project(): Project {
  let next = 0;
  const nextId = () => `id${++next}`;
  const scene = newScene(nextId);
  const route = scene.routes[0];
  if (route === undefined) throw new Error('newScene gave no route');
  route.points.push(newPoint(nextId, { x: 0.25, y: 0.5, kind: 'stop' }), newPoint(nextId, { x: 0.75, y: 0.5, kind: 'stop' }));
  route.leadStart = route.points[0]?.id ?? null;
  return {
    scene,
    images: [
      { id: 'map', type: 'image/png', bytes: png(4, 3) },
      { id: 'photo', type: 'image/jpeg', bytes: jpeg(3, 4) },
      { id: 'tile', type: 'image/webp', bytes: webpLossy(2, 2) },
    ],
  };
}

async function saved(value: Project): Promise<Uint8Array> {
  const result = await saveProject(value);
  if (!result.ok) throw new Error(result.refusal.message);
  return result.bytes;
}

const text = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

/** A ZIP holding exactly these files, as a hand-made or damaged project might. */
async function zipOf(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data, { binary: true, createFolders: false });
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** project.json as Save writes it for `project()`, as plain data to change. */
async function savedFile(): Promise<Record<string, unknown>> {
  const zip = await JSZip.loadAsync(await saved(project()));
  const json = await zip.file('project.json')?.async('uint8array');
  if (json === undefined) throw new Error('no project.json');
  const value: unknown = JSON.parse(new TextDecoder().decode(json));
  if (!isRecord(value)) throw new Error('project.json is not an object');
  return value;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const reasonOf = (opened: Opened) => (opened.ok ? 'opened' : opened.refusal.reason);

describe('Open', () => {
  it('opens what Save wrote: the same scene and the same image bytes', async () => {
    const original = project();
    const opened = await openProject(await saved(original));
    expect(opened).toEqual({ ok: true, project: original });
  });

  it('refuses at each stage, by its reason', async () => {
    const file = await savedFile();
    const images = { 'images/1.png': png(4, 3), 'images/2.jpg': jpeg(3, 4), 'images/3.webp': webpLossy(2, 2) };
    const cases: [string, Uint8Array, string][] = [
      ['not a ZIP', text(file), 'not-a-project'],
      ['an unsafe name', await zipOf({ '../project.json': text(file) }), 'unsafe'],
      ['no project.json', await zipOf({ 'other.json': text(file) }), 'not-a-project'],
      ['project.json over 2 MB', await zipOf({ 'project.json': new Uint8Array(ARCHIVE_LIMITS.projectJsonBytes + 1) }), 'too-large'],
      ['project.json not JSON', await zipOf({ 'project.json': new TextEncoder().encode('{') }), 'not-a-project'],
      ['a forbidden key', await zipOf({ 'project.json': new TextEncoder().encode('{"__proto__":{}}') }), 'unsafe'],
      ['a v3 project', await zipOf({ 'project.json': text({ coordVersion: 9, waypoints: [] }), 'background.png': png(1, 1) }), 'v3'],
      ['a newer preview', await zipOf({ 'project.json': text({ ...file, version: FORMAT_VERSION + 1 }), ...images }), 'other-preview'],
      ['an unknown field', await zipOf({ 'project.json': text({ ...file, extra: true }), ...images }), 'unknown'],
      ['an invalid field', await zipOf({ 'project.json': text({ ...file, images: 'none' }), ...images }), 'invalid'],
      ['a file the project does not name', await zipOf({ 'project.json': text(file), ...images, 'notes.txt': png(1, 1) }), 'unknown'],
      ['a missing image', await zipOf({ 'project.json': text(file), 'images/1.png': png(4, 3), 'images/2.jpg': jpeg(3, 4) }), 'invalid'],
      ['an image of the wrong type', await zipOf({ 'project.json': text(file), ...images, 'images/1.png': jpeg(4, 3) }), 'invalid'],
      ['an image over 8,192 pixels wide', await zipOf({ 'project.json': text(file), ...images, 'images/1.png': png(9000, 1) }), 'invalid'],
      ['a damaged deflate stream', await damagedDeflate(), 'unsafe'],
    ];
    for (const [name, bytes, reason] of cases) expect(reasonOf(await openProject(bytes)), name).toBe(reason);
  });

  it('lists the files the project does not name, every one, never dropping them', async () => {
    const file = await savedFile();
    const opened = await openProject(
      await zipOf({ 'project.json': text({ ...file, images: [] }), 'images/1.png': png(1, 1), 'notes.txt': png(1, 1) }),
    );
    expect(opened).toMatchObject({ ok: false, refusal: { reason: 'unknown', files: ['images/1.png', 'notes.txt'] } });
  });

  it('refuses an image that unpacks past 16 MB, reading no further', async () => {
    const file = await savedFile();
    const big = new Uint8Array(IMAGE_LIMITS.bytes + 1);
    big.set(png(1, 1));
    const opened = await openProject(
      await zipOf({ 'project.json': text({ ...file, images: [{ id: 'big', type: 'image/png' }] }), 'images/1.png': big }),
    );
    expect(opened).toMatchObject({ ok: false, refusal: { reason: 'too-large' } });
  });

  it('leaves nothing behind when it refuses: what it opened before and the bytes it was given are unchanged (DEF-51)', async () => {
    const bytes = await saved(project());
    const first = await openProject(bytes);
    if (!first.ok) throw new Error(first.refusal.message);
    const snapshot = structuredClone(first.project);
    const file = await savedFile();
    const images = { 'images/1.png': png(4, 3), 'images/2.jpg': jpeg(3, 4) };
    const refused = [
      await zipOf({ '../x': png(1, 1) }),
      await zipOf({ 'project.json': text({ ...file, extra: 1 }) }),
      await zipOf({ 'project.json': text(file), ...images, 'images/3.webp': png(2, 2) }),
      await zipOf({ 'project.json': text(file), ...images, 'images/3.webp': webpLossy(9000, 2) }),
    ];
    for (const candidate of refused) {
      const copy = candidate.slice();
      const opened = await openProject(candidate);
      expect(opened.ok).toBe(false);
      expect('project' in opened).toBe(false);
      expect(candidate).toEqual(copy);
    }
    expect(first.project).toEqual(snapshot);
    const again = await openProject(bytes);
    expect(again).toEqual(first);
    if (!again.ok) throw new Error(again.refusal.message);
    expect(again.project.scene).not.toBe(first.project.scene);
    expect(again.project.images[0]?.bytes).not.toBe(first.project.images[0]?.bytes);
    expect(again.project.images[0]?.bytes.buffer).not.toBe(bytes.buffer);
  });
});

/** A saved project whose project.json's deflated bytes are overwritten, so inflating it fails part-way. */
async function damagedDeflate(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('project.json', text({ padding: 'x'.repeat(5000) }), { binary: true, createFolders: false });
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const damaged = bytes.slice();
  damaged.fill(0xff, 40, 60);
  return damaged;
}

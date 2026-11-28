// CORE-03: Open, stage by stage. A file opens whole or is refused at the first stage it fails, and a refused file leaves
// nothing behind (DEF-51, inverted from v3/tests/projectRollback.test.js:14–15).
import JSZip from 'jszip/dist/jszip.min.js';
import { describe, expect, it } from 'vitest';
import { newPoint, newScene } from '../../core/model/scene';
import { RETIRED_WORDS, decodeHeader, jpeg, png, webpLossy } from './fixtures';
import { FORMAT_VERSION } from './format';
import type { Project } from './format';
import type { Decode } from './images';
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
  const result = await saveProject(value, decodeHeader);
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

/** The reason a file was refused, or 'opened'; every refusal's words are held to the glossary on the way. */
const reasonOf = (opened: Opened) => {
  if (opened.ok) return 'opened';
  expect(opened.refusal.message).not.toMatch(RETIRED_WORDS);
  return opened.refusal.reason;
};

describe('Open', () => {
  it('opens what Save wrote: the same scene and the same image bytes', async () => {
    const original = project();
    const opened = await openProject(await saved(original), decodeHeader);
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
    for (const [name, bytes, reason] of cases) expect(reasonOf(await openProject(bytes, decodeHeader)), name).toBe(reason);
  });

  it('lists the files the project does not name, every one, never dropping them', async () => {
    const file = await savedFile();
    const opened = await openProject(
      await zipOf({ 'project.json': text({ ...file, images: [] }), 'images/1.png': png(1, 1), 'notes.txt': png(1, 1) }),
      decodeHeader,
    );
    expect(opened).toMatchObject({ ok: false, refusal: { reason: 'unknown', files: ['images/1.png', 'notes.txt'] } });
  });

  it('refuses an image that unpacks past 16 MB, reading no further', async () => {
    const file = await savedFile();
    const big = new Uint8Array(IMAGE_LIMITS.bytes + 1);
    big.set(png(1, 1));
    const opened = await openProject(
      await zipOf({ 'project.json': text({ ...file, images: [{ id: 'big', type: 'image/png' }] }), 'images/1.png': big }),
      decodeHeader,
    );
    expect(opened).toMatchObject({ ok: false, refusal: { reason: 'too-large' } });
  });

  it('refuses an image the decoder cannot show, and returns no project (the decode guard)', async () => {
    const bytes = await saved(project());
    const refuseJpeg: Decode = (image, type) => (type === 'image/jpeg' ? Promise.resolve(null) : decodeHeader(image, type));
    const opened = await openProject(bytes, refuseJpeg);
    expect(opened).toMatchObject({
      ok: false,
      refusal: { reason: 'invalid', problems: [{ path: 'images[1]', rule: 'type', expected: 'a JPEG image that can be shown', received: 'a damaged image' }] },
    });
    expect('project' in opened).toBe(false);
    const larger = await openProject(bytes, (image, type) => decodeHeader(image, type).then((size) => size && { ...size, width: size.width + 1 }));
    expect(larger).toMatchObject({ ok: false, refusal: { reason: 'invalid' } });
    const throws = await openProject(bytes, () => Promise.reject(new Error('the decoder failed')));
    expect(throws).toMatchObject({ ok: false, refusal: { reason: 'invalid' } });
  });

  it('leaves nothing behind when it refuses: what it opened before and the bytes it was given are unchanged (DEF-51)', async () => {
    const bytes = await saved(project());
    const first = await openProject(bytes, decodeHeader);
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
      const opened = await openProject(candidate, decodeHeader);
      expect(opened.ok).toBe(false);
      expect('project' in opened).toBe(false);
      expect(candidate).toEqual(copy);
    }
    expect(first.project).toEqual(snapshot);
    const again = await openProject(bytes, decodeHeader);
    expect(again).toEqual(first);
    if (!again.ok) throw new Error(again.refusal.message);
    expect(again.project.scene).not.toBe(first.project.scene);
    expect(again.project.images[0]?.bytes).not.toBe(first.project.images[0]?.bytes);
    expect(again.project.images[0]?.bytes.buffer).not.toBe(bytes.buffer);
  });
});

describe('the refusals by name, with the words each shows (brief 17, proof 4)', () => {
  const images = { 'images/1.png': png(4, 3), 'images/2.jpg': jpeg(3, 4), 'images/3.webp': webpLossy(2, 2) };

  /** The refusal for these bytes: no project with it, the bytes unchanged (DEF-51), the words free of retired ones. */
  async function refusal(bytes: Uint8Array) {
    const copy = bytes.slice();
    const opened = await openProject(bytes, decodeHeader);
    if (opened.ok) throw new Error('the file opened');
    expect('project' in opened).toBe(false);
    expect(bytes).toEqual(copy);
    expect(opened.refusal.message).not.toMatch(RETIRED_WORDS);
    return opened.refusal;
  }

  it('a v3 file is refused, naming v3 and where to open it (Q14)', async () => {
    const v3 = await zipOf({
      'project.json': text({ coordVersion: 2, waypoints: [{ imgX: 0.25, imgY: 0.5 }], styles: {}, animationState: { duration: 5000 } }),
      'background.png': png(4, 3),
    });
    expect(await refusal(v3)).toEqual({
      reason: 'v3',
      message: 'This project was saved by Route Plotter v3, which Route Plotter v4 does not open. Open it in Route Plotter v3. Nothing was opened.',
    });
  });

  it('an older and a newer v4 save format are refused alike, saying another preview made the file (PLAN-7)', async () => {
    const file = await savedFile();
    for (const version of [FORMAT_VERSION - 1, FORMAT_VERSION + 1]) {
      expect(await refusal(await zipOf({ 'project.json': text({ ...file, version }), ...images })), `version ${version}`).toEqual({
        reason: 'other-preview',
        version: String(version),
        message: `This file was saved by another preview of Route Plotter v4 (save format ${version}); this preview opens save format ${FORMAT_VERSION} only. Choose a project saved by this preview. Nothing was opened.`,
      });
    }
  });

  it('an unknown feature is refused, listing it by its id', async () => {
    const file = await savedFile();
    if (!isRecord(file.scene)) throw new Error('no scene');
    const scene = { ...file.scene, features: { crowd: { count: 30 } } };
    expect(await refusal(await zipOf({ 'project.json': text({ ...file, scene }), ...images }))).toEqual({
      reason: 'unknown',
      features: ['crowd'],
      fields: [],
      files: [],
      message: 'This file holds what this preview of Route Plotter does not know (features: crowd). Choose a project saved by this preview. Nothing was opened.',
    });
  });

  it('an unknown field is refused, listing it by its place, never kept or dropped silently (INTAKE.13)', async () => {
    const file = structuredClone(await savedFile());
    const routes = isRecord(file.scene) ? file.scene.routes : undefined;
    const route: unknown = Array.isArray(routes) ? routes[0] : undefined;
    if (!isRecord(route)) throw new Error('no route');
    route.glow = true;
    expect(await refusal(await zipOf({ 'project.json': text(file), ...images }))).toEqual({
      reason: 'unknown',
      features: [],
      fields: ['scene.routes[0].glow'],
      files: [],
      message: 'This file holds what this preview of Route Plotter does not know (settings: scene.routes[0].glow). Choose a project saved by this preview. Nothing was opened.',
    });
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

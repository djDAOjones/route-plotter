import JSZip from 'jszip/dist/jszip.min.js';
import { describe, expect, it } from 'vitest';
import { newPoint, newScene } from '../../core/model/scene';
import type { Scene } from '../../core/model/scene';
import { FORMAT_VERSION } from './format';
import type { Project } from './format';
import { saveProject } from './save';
import { SAVE_NOTICE } from './words';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 4, 5, 6]);

function ids(): () => string {
  let next = 0;
  return () => `id${++next}`;
}

/** A scene of one route whose points carry these labels. */
function sceneWithLabels(...labels: string[]): Scene {
  const nextId = ids();
  const scene = newScene(nextId);
  const route = scene.routes[0];
  if (route === undefined) throw new Error('newScene gave no route');
  route.points.push(...labels.map((label) => ({ ...newPoint(nextId, { x: 0.5, y: 0.5, kind: 'stop' }), label })));
  route.leadStart = route.points[0]?.id ?? null;
  return scene;
}

async function saved(project: Project): Promise<Uint8Array> {
  const result = await saveProject(project);
  if (!result.ok) throw new Error(result.refusal.message);
  return result.bytes;
}

/** project.json's text and the ZIP's entry names, read back with JSZip itself. */
async function readBack(bytes: Uint8Array): Promise<{ text: string; names: string[] }> {
  const zip = await JSZip.loadAsync(bytes);
  const json = await zip.file('project.json')?.async('uint8array');
  if (json === undefined) throw new Error('no project.json');
  return { text: new TextDecoder('utf-8', { fatal: true }).decode(json), names: Object.keys(zip.files).sort() };
}

describe('the save format', () => {
  it('saves a ZIP holding project.json and each image, named by its place and type', async () => {
    const images = [
      { id: 'map', type: 'image/png', bytes: PNG },
      { id: 'photo', type: 'image/jpeg', bytes: JPEG },
    ] as const;
    const { names } = await readBack(await saved({ scene: sceneWithLabels(), images }));
    expect(names).toEqual(['images/1.png', 'images/2.jpg', 'project.json']);
    const zip = await JSZip.loadAsync(await saved({ scene: sceneWithLabels(), images }));
    expect(await zip.file('images/2.jpg')?.async('uint8array')).toEqual(JPEG);
  });

  it('starts project.json with v4’s format mark and its version', async () => {
    const { text } = await readBack(await saved({ scene: sceneWithLabels(), images: [] }));
    expect(text.startsWith(`{"app":"route-plotter","format":"v4","version":${FORMAT_VERSION},"scene":{`)).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ images: [] });
  });

  it('writes the scene’s declared fields and nothing else', async () => {
    const scene = sceneWithLabels('Market');
    const { text } = await readBack(await saved({ scene, images: [{ id: 'map', type: 'image/png', bytes: PNG }] }));
    expect(JSON.parse(text)).toEqual({
      app: 'route-plotter',
      format: 'v4',
      version: FORMAT_VERSION,
      scene,
      images: [{ id: 'map', type: 'image/png' }],
    });
  });

  it('saves one project to the same bytes every time', async () => {
    const project = { scene: sceneWithLabels('a', 'b'), images: [{ id: 'map', type: 'image/png', bytes: PNG }] } as const;
    expect(await saved(project)).toEqual(await saved(project));
  });

  it('refuses a project the schema does not allow, naming where, and writes nothing', async () => {
    const scene = sceneWithLabels('x');
    const extra = { ...scene, notes: 'kept?' };
    const result = await saveProject({ scene: extra, images: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal.reason).toBe('invalid');
    expect(result.refusal.message).toContain('scene.notes: expected no such field');
    expect(result.refusal.message).toMatch(/Nothing was saved\.$/);
  });

  it('refuses a project whose project.json would pass v3’s 2 MB limit', async () => {
    const scene = sceneWithLabels(...Array.from({ length: 11 }, () => '🙂'.repeat(50_000)));
    const result = await saveProject({ scene, images: [] });
    expect(result.ok ? 'saved' : result.refusal.reason).toBe('too-large');
  });

  it('exports the Save notice the editor shows wherever it offers Save (PLAN-7)', () => {
    expect(SAVE_NOTICE).toBe(
      'This is a preview of Route Plotter v4. A file saved in this preview may not open in a later preview.',
    );
  });
});

// DEF-101: v3 wrote project.json as a string that JSZip cuts into 16,384-unit chunks, so an emoji across a chunk's
// edge was split. The table is v3's (v3/tests/archiveText.test.js:17–18): the emoji's offset after a run of 'a', and
// whether v3's guard refused it. v4 writes bytes encoded once, so every row survives, by every save path (one today).
const DEF_101 = [
  [0, true],
  [16382, true],
  [16383, false],
  [16384, true],
  [32766, true],
  [32767, false],
  [32768, true],
  [65535, false],
] as const;

describe('DEF-101: an emoji across each 16,384-unit boundary survives Save', () => {
  it.each(DEF_101)('a label with 🙂 at offset %i (v3 safe: %s) saves and reads back whole', async (offset) => {
    const label = `${'a'.repeat(offset)}🙂`;
    const { text } = await readBack(await saved({ scene: sceneWithLabels(label), images: [] }));
    expect(JSON.parse(text)).toMatchObject({ scene: { routes: [{ points: [{ label }] }] } });
  });

  it.each([1, 2, 3, 4])('🙂 straddling unit %i × 16,384 of project.json’s own text saves whole', async (k) => {
    const probe = (await readBack(await saved({ scene: sceneWithLabels(''), images: [] }))).text;
    const before = probe.indexOf('"label":""') + '"label":"'.length;
    const label = `${'a'.repeat(k * 16_384 - 1 - before)}🙂`;
    const { text } = await readBack(await saved({ scene: sceneWithLabels(label), images: [] }));
    expect(text.charCodeAt(k * 16_384 - 1)).toBe(0xd83d);
    expect(JSON.parse(text)).toMatchObject({ scene: { routes: [{ points: [{ label }] }] } });
  });
});

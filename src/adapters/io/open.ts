// CORE-03: Open (the plan's §13 and §15). A file passes every stage in turn, or is refused at the first it fails, with
// the words to show: the ZIP's own guard (preflight.ts); jszip's reading, which must name the same files the guard
// counted; project.json, read within its limit, as strict UTF-8 plain data (json.ts); the kind of file and the
// declaration's judgement (classify.ts); the ZIP's files against the declared images, so a file the project does not
// name is listed, never silently dropped (INTAKE.13); each image read within its limit, admitted and decoded by the
// caller's decoder (images.ts).
// Every object it returns is built here, after every stage passed: nothing it is given changes, and it keeps nothing
// between calls, so a refused file leaves no trace (DEF-51, inverted from v3/tests/projectRollback.test.js:14–15,
// where a failed load left the candidate's caches behind).
import JSZip from 'jszip/dist/jszip.min.js';
import { judge, classify } from './classify';
import { imageEntryName, PROJECT_FILE_NAME } from './format';
import type { ImageType, Project } from './format';
import { admitImages } from './images';
import type { Decode } from './images';
import { parseProjectJson } from './json';
import { ARCHIVE_LIMITS, IMAGE_LIMITS } from './limits';
import { newBudget, preflight, readEntry } from './preflight';
import { WORDS } from './words';
import type { Problem, Refusal } from './words';

export type Opened = { readonly ok: true; readonly project: Project } | { readonly ok: false; readonly refusal: Refusal };

const refused = (refusal: Refusal): Opened => ({ ok: false, refusal });
const unsafe = (why: string) => refused({ reason: 'unsafe', message: WORDS.openedUnsafe(why) });
const tooLarge = (what: string) => refused({ reason: 'too-large', message: WORDS.openedTooLarge(what) });
const MB = (bytes: number) => `${bytes / (1024 * 1024)} MB`;

async function stages(bytes: Uint8Array, decode: Decode): Promise<Opened> {
  const checked = preflight(bytes);
  if (!checked.ok) return refused(checked.refusal);
  const names = new Set(checked.entries.map(({ name }) => name));

  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
  const read = Object.values(zip.files);
  if (read.length !== names.size || read.some((entry) => !names.has(entry.unsafeOriginalName ?? entry.name))) {
    return unsafe('the files it holds do not match its table of contents');
  }

  const budget = newBudget();
  const json = zip.file(PROJECT_FILE_NAME);
  if (json === null || json.dir) return refused({ reason: 'not-a-project', message: WORDS.openedNotAProject });
  const jsonBytes = await readEntry(json, ARCHIVE_LIMITS.projectJsonBytes, budget);
  if (jsonBytes === null) return tooLarge(`its routes and settings take more than ${MB(ARCHIVE_LIMITS.projectJsonBytes)}`);
  const parsed = parseProjectJson(jsonBytes);
  if (!parsed.ok) return refused(parsed.refusal);
  const kind = classify(parsed.value);
  if (kind !== null) return refused(kind);
  const judged = judge(parsed.value);
  if (!judged.ok) return refused(judged.refusal);

  const declared = judged.file.images.map(({ id, type }, index) => ({ id, type, name: imageEntryName(index, type), index }));
  const expected = new Set([PROJECT_FILE_NAME, ...declared.map(({ name }) => name)]);
  const files = checked.entries.map(({ name }) => name).filter((name) => !expected.has(name));
  if (files.length > 0) {
    return refused({ reason: 'unknown', message: WORDS.openedUnknown({ features: [], fields: [], files }), features: [], fields: [], files });
  }
  const missing: Problem[] = declared
    .filter(({ name }) => !names.has(name))
    .map(({ index, name }) => ({ path: `images[${index}]`, rule: 'missing', expected: `its file ${name}`, received: 'nothing' }));
  if (missing.length > 0) return refused({ reason: 'invalid', message: WORDS.openedInvalid(missing), problems: missing });

  const images: { id: string; type: ImageType; bytes: Uint8Array }[] = [];
  for (const { id, type, name, index } of declared) {
    const entry = zip.file(name);
    if (entry === null) return unsafe('the files it holds do not match its table of contents');
    const imageBytes = await readEntry(entry, IMAGE_LIMITS.bytes, budget);
    if (imageBytes === null) return tooLarge(`image ${index + 1} is over ${MB(IMAGE_LIMITS.bytes)}, or its files come to more than ${MB(ARCHIVE_LIMITS.inflatedBytes)} once unpacked`);
    images.push({ id, type, bytes: imageBytes });
  }
  const admitted = await admitImages(images, decode);
  if (!admitted.ok) {
    return 'tooLarge' in admitted
      ? tooLarge(admitted.tooLarge)
      : refused({ reason: 'invalid', message: WORDS.openedInvalid(admitted.problems), problems: admitted.problems });
  }
  return { ok: true, project: { scene: judged.file.scene, images } };
}

/**
 * A project file's bytes opened: the project, or why the file was refused, with the words to show. Never throws:
 * whatever jszip, the bytes or the decoder do, the answer is a project whole or a refusal, never part of one. `decode`
 * decodes each image as the page will (images.ts): the shell passes one built on the browser's decoder.
 */
export async function openProject(bytes: Uint8Array, decode: Decode): Promise<Opened> {
  try {
    return await stages(bytes, decode);
  } catch {
    return unsafe('it is damaged: part of it could not be unpacked');
  }
}

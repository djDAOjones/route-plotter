// CORE-03: Save (the plan's §13). project.json is the declaration's own checked copy, so only declared fields are
// written and a project the schema does not allow is refused, never written. It goes into the ZIP as UTF-8 bytes
// encoded once, never a string JSZip cuts in 16,384-unit chunks, which could split an emoji across a chunk (DEF-101).
// Its images pass the same admission Open applies, decoding included (images.ts), so Save never writes a file Open
// would refuse.
import JSZip from 'jszip/dist/jszip.min.js';
import { check } from '../../core/schema/check';
import { FORMAT_VERSION, PROJECT_FILE, PROJECT_FILE_NAME, imageEntryName } from './format';
import type { Project } from './format';
import { admitImages } from './images';
import type { Decode } from './images';
import { ARCHIVE_LIMITS } from './limits';
import { WORDS } from './words';
import type { Refusal } from './words';

export type Saved = { readonly ok: true; readonly bytes: Uint8Array } | { readonly ok: false; readonly refusal: Refusal };

/** Every entry's date, so that one project always saves to the same bytes (CROWD-08.7: open then save is stable). */
const SAVED_AT = new Date(Date.UTC(2026, 0, 1));

const megabytes = (bytes: number) => `${Math.ceil(bytes / (1024 * 1024))} MB`;

/**
 * The project as a ZIP's bytes, or why it cannot be saved. Nothing it is given changes. `decode` decodes each image as
 * the page will (images.ts): the shell passes one built on the browser's decoder.
 */
export async function saveProject(project: Project, decode: Decode): Promise<Saved> {
  const file = {
    app: 'route-plotter',
    format: 'v4',
    version: FORMAT_VERSION,
    scene: project.scene,
    images: project.images.map(({ id, type }) => ({ id, type })),
  };
  const checked = check(PROJECT_FILE, file);
  if (!checked.ok) {
    return { ok: false, refusal: { reason: 'invalid', message: WORDS.savedInvalid(checked.problems), problems: checked.problems } };
  }
  const admitted = await admitImages(project.images, decode);
  if (!admitted.ok) {
    return {
      ok: false,
      refusal: 'tooLarge' in admitted
        ? { reason: 'too-large', message: WORDS.savedTooLarge(admitted.tooLarge) }
        : { reason: 'invalid', message: WORDS.savedInvalid(admitted.problems), problems: admitted.problems },
    };
  }
  const json = new TextEncoder().encode(JSON.stringify(checked.value));
  if (json.byteLength > ARCHIVE_LIMITS.projectJsonBytes) {
    const what = `its routes and settings need ${megabytes(json.byteLength)}, and a file holds at most ${megabytes(ARCHIVE_LIMITS.projectJsonBytes)}`;
    return { ok: false, refusal: { reason: 'too-large', message: WORDS.savedTooLarge(what) } };
  }
  const zip = new JSZip();
  zip.file(PROJECT_FILE_NAME, json, { binary: true, createFolders: false, date: SAVED_AT });
  project.images.forEach((image, index) => {
    zip.file(imageEntryName(index, image.type), image.bytes, { binary: true, createFolders: false, date: SAVED_AT });
  });
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  if (bytes.byteLength > ARCHIVE_LIMITS.zipBytes) {
    const what = `it needs ${megabytes(bytes.byteLength)}, and a file holds at most ${megabytes(ARCHIVE_LIMITS.zipBytes)}`;
    return { ok: false, refusal: { reason: 'too-large', message: WORDS.savedTooLarge(what) } };
  }
  return { ok: true, bytes };
}

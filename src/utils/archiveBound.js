import { assertArchiveTextSafe } from './archiveText.js';

const imageBytesFailure = () => new Error('Project image bytes cannot be checked. Replace the image, then try again.');
const roomFailure = () => new Error('Project edits need guaranteed room in the saved ZIP. '
  + 'Use a smaller background or fewer custom images, then try again.');
const utf8Bytes = text => new TextEncoder().encode(text).length;

function safeInteger(number) {
  if (!Number.isSafeInteger(number) || number < 0) throw roomFailure();
  return number;
}
function add(...numbers) {
  return numbers.reduce((sum, n) => safeInteger(sum + safeInteger(n)), 0);
}

/**
 * Conservative default raw-DEFLATE bound, with ceilings and wrapper allowance.
 * The browser JSZip distribution/configuration proof is pinned in the tests.
 */
export function deflateByteBound(bytes) {
  safeInteger(bytes);
  return add(bytes, Math.ceil(bytes / 4096), Math.ceil(bytes / 16384), Math.ceil(bytes / 33554432), 13);
}

/** Decode size without trusting asset.size or an inspector's floored estimate. */
export function strictBase64Bytes(text) {
  if (typeof text !== 'string' || !text.length || text.length % 4 !== 0) throw imageBytesFailure();
  let padding = 0;
  if (text.endsWith('=')) padding++;
  if (text.endsWith('==')) padding++;
  for (let index = 0; index < text.length - padding; index++) {
    const code = text.charCodeAt(index);
    if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122)
        || (code >= 48 && code <= 57) || code === 43 || code === 47)) throw imageBytesFailure();
  }
  return safeInteger(3 * (text.length / 4) - padding);
}

/** Full ZIP: every file/folder, both path copies and EOCD. Equality is admitted. */
export function assertArchiveEntriesFit(entries, limit) {
  safeInteger(limit);
  let bound = 22;
  for (const { path, bytes } of entries) {
    bound = add(bound, deflateByteBound(bytes), 512, safeInteger(2 * utf8Bytes(path)));
  }
  if (bound > limit) throw roomFailure();
  return bound;
}

export function assertPreparedArchiveFits(prepared, limit) {
  assertArchiveTextSafe(prepared.projectJSON);
  const entries = [{ path: 'assets/', bytes: 0 }, { path: 'project.json', bytes: utf8Bytes(prepared.projectJSON) }];
  for (const image of prepared.images) {
    entries.push({ path: `assets/${image.filename}`, bytes: strictBase64Bytes(image.base64Data) });
  }
  if (prepared.background) {
    entries.push({ path: prepared.background.filename, bytes: strictBase64Bytes(prepared.background.base64Data) });
  }
  return assertArchiveEntriesFit(entries, limit);
}

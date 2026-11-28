// CORE-05, stage 6 (brief 76, ruling 1): the browser's decoder, which io's Open and Save are handed (`Decode`,
// src/adapters/io/images.ts). A page file: it names a browser global, `createImageBitmap`, so no Node test imports it;
// io's tests hand in their own. The plan keeps a decoder helper in the shell, not in the adapters (PLAN-49).
// Its claim: a copy of the bytes (`slice`: a plain ArrayBuffer, as a Blob takes), as a Blob of the type io names, is
// decoded by the browser's own decoder; the size it decoded to is given back and the bitmap closed at once; when the
// browser cannot decode them (it throws or rejects), null. It keeps nothing: no bitmap, no bytes. Proved on the page
// (tests/a11y/project.mjs, brief 77): an-image-that-decodes opens a project holding a real PNG the page's canvas made,
// and an-image-that-does-not-decode refuses one whose image is a PNG header alone, its size readable by io, so that
// only this decoder can refuse it; a decoder giving null for all fails the first, one trusting the header the second.
import type { Decode } from '../../adapters/io/images';

/** io's decoder in the browser: the size an image decodes to, or null when the browser cannot; it keeps nothing. */
export const decode: Decode = async (bytes, type) => {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type }));
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
};

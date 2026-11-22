// CORE-05, stage 6 (brief 76, ruling 1): the browser's decoder, which io's Open and Save are handed (`Decode`,
// src/adapters/io/images.ts). A page file: it names a browser global, `createImageBitmap`, so no Node test imports it;
// io's tests hand in their own. The plan keeps a decoder helper in the shell, not in the adapters (PLAN-49).
// Its claim: a copy of the bytes (`slice`: a plain ArrayBuffer, as a Blob takes), as a Blob of the type io names, is
// decoded by the browser's own decoder; the size it decoded to is given back and the bitmap closed at once; when the
// browser cannot decode them (it throws or rejects), null. It keeps nothing: no bitmap, no bytes. That an image which
// decodes opens and one which does not is refused, on the page, is the next chat's journeys' to prove (brief 77): on
// the page today, not yet proved.
import type { Decode } from '../../adapters/io/images';

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

// CORE-05, stage 6 (brief 84, ruling 3): the browser's loader of the background's picture, which the preview's
// pictures are handed (`LoadPicture`, previewLogic.ts). A page file beside decode.ts: it names a browser global,
// `createImageBitmap`, so no Node test imports it; previewLogic's tests hand in their own.
// Its claim: a copy of the bytes (`slice`: a plain ArrayBuffer, as a Blob takes), as a Blob of the type io names, is
// decoded by the browser's own decoder and given back as the bitmap to draw and the call that closes it; when the
// browser cannot decode them (it throws or rejects), null. It keeps nothing itself: the pictures hold the bitmap and
// close it. Proved on the page (tests/a11y/project.mjs, the-preview-shows-the-picture): a project with a picture of
// one plain colour shows that colour on the canvas; a loader giving null fails it.
import type { LoadPicture } from './previewLogic';

/** The background picture's loader in the browser: the bitmap and the call that closes it, or null if undecodable. */
export const loadPicture: LoadPicture = async (bytes, type) => {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type }));
    return {
      source: bitmap,
      close: () => {
        bitmap.close();
      },
    };
  } catch {
    return null;
  }
};

// CORE-03: image admission, the same for Save and Open, so Save never writes what Open would refuse (the plan's §15).
// Ported from frozen v3: the three types and their magic bytes (v3/src/models/ImageAsset.js:5–12, :279–298), so a
// file is judged by what it holds, never by its name or declared type alone, and SVG, which can carry script, never
// passes (v3/tests/projectLimits.test.js:327); each image's bytes, width, height and pixels; and the project's
// totals (v3/src/services/ImageAssetService.js:24–32). v3 measured an image by decoding it in the page; v4 reads the
// size its header declares, so admission needs no page and runs in Node's tests. The header is not trusted to match
// the pixels: the renderer that draws an image (CORE-04) still decodes it under the browser's own limits.
import type { ImageType } from './format';
import { IMAGE_LIMITS } from './limits';
import type { Problem } from './words';

const NAMES: Readonly<Record<ImageType, string>> = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP' };

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const starts = (bytes: Uint8Array, at: number, expected: readonly number[]) =>
  bytes.length >= at + expected.length && expected.every((byte, index) => bytes[at + index] === byte);

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));

/** The type an image's bytes hold, by their magic bytes alone, or null. */
export function typeOf(bytes: Uint8Array): ImageType | null {
  if (starts(bytes, 0, PNG)) return 'image/png';
  if (starts(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts(bytes, 0, ascii('RIFF')) && starts(bytes, 8, ascii('WEBP'))) return 'image/webp';
  return null;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** PNG: the IHDR chunk, which must come first. */
function pngSize(bytes: Uint8Array): Size | null {
  if (bytes.length < 24 || !starts(bytes, 12, ascii('IHDR'))) return null;
  return { width: view(bytes).getUint32(16), height: view(bytes).getUint32(20) };
}

/** JPEG: the first start-of-frame segment before the scan; markers C4, C8 and CC are not frames. */
function jpegSize(bytes: Uint8Array): Size | null {
  const data = view(bytes);
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = data.getUint16(at + 2);
    if (length < 2) return null;
    const frame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (frame) return at + 9 <= bytes.length ? { width: data.getUint16(at + 7), height: data.getUint16(at + 5) } : null;
    at += 2 + length;
  }
  return null;
}

/** WebP: the first chunk, lossy (VP8), lossless (VP8L) or extended (VP8X). */
function webpSize(bytes: Uint8Array): Size | null {
  const data = view(bytes);
  if (starts(bytes, 12, ascii('VP8 ')) && starts(bytes, 23, [0x9d, 0x01, 0x2a]) && bytes.length >= 30) {
    return { width: data.getUint16(26, true) & 0x3fff, height: data.getUint16(28, true) & 0x3fff };
  }
  if (starts(bytes, 12, ascii('VP8L')) && bytes[20] === 0x2f && bytes.length >= 25) {
    const bits = data.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (starts(bytes, 12, ascii('VP8X')) && bytes.length >= 30) {
    const u24 = (at: number) => data.getUint16(at, true) + ((bytes[at + 2] ?? 0) << 16);
    return { width: u24(24) + 1, height: u24(27) + 1 };
  }
  return null;
}

/** The width and height an image's header declares, or null when it cannot be read. */
export function sizeOf(bytes: Uint8Array, type: ImageType): Size | null {
  if (type === 'image/png') return pngSize(bytes);
  if (type === 'image/jpeg') return jpegSize(bytes);
  return webpSize(bytes);
}

/** What admission found: nothing, a size over a limit in bytes (words for the author), or problems by place. */
export type Admission =
  | { readonly ok: true }
  | { readonly ok: false; readonly tooLarge: string }
  | { readonly ok: false; readonly problems: readonly Problem[] };

const MB = (bytes: number) => `${bytes / (1024 * 1024)} MB`;
const count = (value: number) => value.toLocaleString('en-GB');

/** The project's images, judged one by one and then together. Reads only the bytes it is given. */
export function admitImages(images: readonly { readonly type: ImageType; readonly bytes: Uint8Array }[]): Admission {
  const problems: Problem[] = [];
  let bytes = 0;
  let pixels = 0;
  for (const [index, image] of images.entries()) {
    const path = `images[${index}]`;
    const name = NAMES[image.type];
    if (image.bytes.byteLength > IMAGE_LIMITS.bytes) {
      return { ok: false, tooLarge: `image ${index + 1} is over ${MB(IMAGE_LIMITS.bytes)}` };
    }
    bytes += image.bytes.byteLength;
    if (bytes > IMAGE_LIMITS.totalBytes) return { ok: false, tooLarge: `its images come to more than ${MB(IMAGE_LIMITS.totalBytes)}` };
    const found = typeOf(image.bytes);
    if (found !== image.type) {
      problems.push({ path, rule: 'type', expected: `a ${name} image`, received: found === null ? 'something else' : `a ${NAMES[found]} image` });
      continue;
    }
    const size = sizeOf(image.bytes, image.type);
    if (size === null) {
      problems.push({ path, rule: 'type', expected: `a ${name} image whose size can be read`, received: 'a damaged image' });
      continue;
    }
    const { width, height } = size;
    const within = (side: number) => side >= 1 && side <= IMAGE_LIMITS.dimension;
    if (!within(width) || !within(height) || width * height > IMAGE_LIMITS.pixels) {
      problems.push({
        path,
        rule: 'range',
        expected: `an image from 1 to ${count(IMAGE_LIMITS.dimension)} pixels wide and high, ${count(IMAGE_LIMITS.pixels)} pixels at most`,
        received: `${count(width)} × ${count(height)} pixels`,
      });
      continue;
    }
    pixels += width * height;
  }
  if (pixels > IMAGE_LIMITS.totalPixels) {
    problems.push({
      path: 'images',
      rule: 'total',
      expected: `${count(IMAGE_LIMITS.totalPixels)} pixels at most in all images`,
      received: `${count(pixels)} pixels`,
    });
  }
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

// CORE-03: image admission, for Save and Open alike (v3/src/models/ImageAsset.js:5–12, :279–298;
// v3/tests/projectLimits.test.js:327 for SVG). The images are headers built by hand: admission reads no more.
import { describe, expect, it } from 'vitest';
import { decodeHeader, jpeg, png, webpExtended, webpLossless, webpLossy } from './fixtures';
import { admitImages, sizeOf, typeOf } from './images';
import type { Decode } from './images';
import { IMAGE_LIMITS } from './limits';

const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

describe('an image judged by its bytes', () => {
  it('knows each type by its magic bytes, and SVG as none', () => {
    expect(typeOf(png(1, 1))).toBe('image/png');
    expect(typeOf(jpeg(1, 1))).toBe('image/jpeg');
    expect(typeOf(webpLossy(1, 1))).toBe('image/webp');
    expect(typeOf(SVG)).toBeNull();
    expect(typeOf(new Uint8Array(0))).toBeNull();
  });

  it('reads the size each header declares', () => {
    expect(sizeOf(png(640, 480), 'image/png')).toEqual({ width: 640, height: 480 });
    expect(sizeOf(jpeg(800, 600), 'image/jpeg')).toEqual({ width: 800, height: 600 });
    expect(sizeOf(webpLossy(320, 200), 'image/webp')).toEqual({ width: 320, height: 200 });
    expect(sizeOf(webpLossless(8192, 3), 'image/webp')).toEqual({ width: 8192, height: 3 });
    expect(sizeOf(webpExtended(10000, 5), 'image/webp')).toEqual({ width: 10000, height: 5 });
  });

  it('cannot read a cut header', () => {
    expect(sizeOf(png(1, 1).slice(0, 20), 'image/png')).toBeNull();
    expect(sizeOf(jpeg(1, 1).slice(0, 30), 'image/jpeg')).toBeNull();
    expect(sizeOf(webpLossy(1, 1).slice(0, 26), 'image/webp')).toBeNull();
  });
});

describe('admission, for Save and Open alike', () => {
  it('admits sound images of each type', async () => {
    expect(await admitImages([
      { type: 'image/png', bytes: png(2, 2) },
      { type: 'image/jpeg', bytes: jpeg(2, 2) },
      { type: 'image/webp', bytes: webpLossy(2, 2) },
    ], decodeHeader)).toEqual({ ok: true });
  });

  it('refuses bytes that are not the declared type, SVG among them', async () => {
    expect(await admitImages([{ type: 'image/png', bytes: jpeg(1, 1) }, { type: 'image/png', bytes: SVG }], decodeHeader)).toEqual({
      ok: false,
      problems: [
        { path: 'images[0]', rule: 'type', expected: 'a PNG image', received: 'a JPEG image' },
        { path: 'images[1]', rule: 'type', expected: 'a PNG image', received: 'something else' },
      ],
    });
  });

  it('refuses a header it cannot read', async () => {
    expect(await admitImages([{ type: 'image/png', bytes: png(1, 1).slice(0, 20) }], decodeHeader)).toMatchObject({ ok: false, problems: [{ path: 'images[0]', rule: 'type' }] });
  });

  it('refuses a side of 0 or over 8,192 pixels, and over 24 million pixels in one image', async () => {
    for (const [width, height] of [[0, 1], [IMAGE_LIMITS.dimension + 1, 1], [5000, 5000]] as const) {
      expect(await admitImages([{ type: 'image/png', bytes: png(width, height) }], decodeHeader), `${width} × ${height}`).toMatchObject({
        ok: false,
        problems: [{ path: 'images[0]', rule: 'range' }],
      });
    }
    expect(await admitImages([{ type: 'image/png', bytes: png(IMAGE_LIMITS.dimension, 2929) }], decodeHeader)).toEqual({ ok: true });
  });

  it('refuses over 48 million pixels in all images', async () => {
    const image = { type: 'image/png' as const, bytes: png(4000, 4000) };
    expect(await admitImages([image, image, image], decodeHeader)).toEqual({ ok: true });
    expect(await admitImages([image, image, image, image], decodeHeader)).toMatchObject({ ok: false, problems: [{ path: 'images', rule: 'total' }] });
  });

  it('refuses one image over 16 MB and images over 40 MB in all, as too large', async () => {
    const big = new Uint8Array(IMAGE_LIMITS.bytes + 1);
    big.set(png(1, 1));
    expect(await admitImages([{ type: 'image/png', bytes: big }], decodeHeader)).toEqual({ ok: false, tooLarge: 'image 1 is over 16 MB' });
    const large = new Uint8Array(15 * 1024 * 1024);
    large.set(png(1, 1));
    const image = { type: 'image/png' as const, bytes: large };
    expect(await admitImages([image, image, image], decodeHeader)).toEqual({ ok: false, tooLarge: 'its images come to more than 40 MB' });
  });
});

/** Change one byte of a copy. */
const withByte = (bytes: Uint8Array, at: number, value: number) => {
  const copy = bytes.slice();
  copy[at] = value;
  return copy;
};

describe('a header read whole and within its own lengths (Codex, stage 2)', () => {
  it('PNG: refuses an IHDR cut short, missing its check value, or declaring other than 13 bytes', () => {
    expect(sizeOf(png(1, 1), 'image/png')).toEqual({ width: 1, height: 1 });
    expect(sizeOf(png(1, 1).slice(0, 24), 'image/png')).toBeNull();
    expect(sizeOf(png(1, 1).slice(0, 32), 'image/png')).toBeNull();
    expect(sizeOf(withByte(png(1, 1), 11, 12), 'image/png')).toBeNull();
    expect(sizeOf(withByte(png(1, 1), 11, 14), 'image/png')).toBeNull();
  });

  it('PNG: Codex’s reproduction, a 24-byte file ending after the size, is refused', async () => {
    expect(await admitImages([{ type: 'image/png', bytes: png(1, 1).slice(0, 24) }], decodeHeader)).toMatchObject({ ok: false, problems: [{ path: 'images[0]', rule: 'type' }] });
  });

  // jpeg(): APP0 at 2, DHT at 20, the frame (C2) at 25 with its length at 27–28 and its component count at 34.
  it('JPEG: refuses a frame shorter or longer than its components make it, or with 0 or 5 components', () => {
    expect(sizeOf(jpeg(3, 2), 'image/jpeg')).toEqual({ width: 3, height: 2 });
    for (const length of [2, 10, 12]) expect(sizeOf(withByte(jpeg(3, 2), 28, length), 'image/jpeg'), `length ${length}`).toBeNull();
    for (const components of [0, 5]) expect(sizeOf(withByte(jpeg(3, 2), 34, components), 'image/jpeg'), `${components} components`).toBeNull();
  });

  it('JPEG: refuses a segment that runs past the end of the bytes', () => {
    expect(sizeOf(withByte(jpeg(3, 2), 4, 0xff), 'image/jpeg')).toBeNull();
    expect(sizeOf(jpeg(3, 2).slice(0, 35), 'image/jpeg')).toBeNull();
  });

  it('JPEG: Codex’s reproduction, a frame declaring 2 bytes, is refused', async () => {
    expect(await admitImages([{ type: 'image/jpeg', bytes: withByte(jpeg(1, 1), 28, 2) }], decodeHeader)).toMatchObject({ ok: false, problems: [{ path: 'images[0]', rule: 'type' }] });
  });

  // RIFF's size at 4–7, the first chunk's size at 16–19.
  it('WebP: refuses a RIFF that runs past the bytes, or a chunk that runs past the RIFF', () => {
    expect(sizeOf(withByte(webpLossy(2, 2), 4, 23), 'image/webp')).toBeNull();
    expect(sizeOf(withByte(webpLossy(2, 2), 16, 11), 'image/webp')).toBeNull();
    expect(sizeOf(withByte(webpLossy(2, 2), 4, 21), 'image/webp')).toBeNull();
  });

  it('WebP: refuses a chunk shorter than its own header needs', () => {
    expect(sizeOf(withByte(webpLossy(2, 2), 16, 9), 'image/webp')).toBeNull();
    expect(sizeOf(withByte(webpLossless(2, 2), 16, 4), 'image/webp')).toBeNull();
    expect(sizeOf(withByte(webpExtended(2, 2), 16, 9), 'image/webp')).toBeNull();
  });

  it('WebP: Codex’s reproduction, a VP8X chunk declaring zero bytes before size-like bytes, is refused', async () => {
    expect(await admitImages([{ type: 'image/webp', bytes: withByte(webpExtended(2, 2), 16, 0) }], decodeHeader)).toMatchObject({ ok: false, problems: [{ path: 'images[0]', rule: 'type' }] });
  });
});

describe('the decode guard: each image must decode, to the size its header declares', () => {
  const images = [
    { type: 'image/png' as const, bytes: png(4, 3) },
    { type: 'image/jpeg' as const, bytes: jpeg(3, 4) },
  ];

  it('admits images that decode to their declared size', async () => {
    expect(await admitImages(images, decodeHeader)).toEqual({ ok: true });
  });

  it('refuses an image that does not decode, decodes to another size, or whose decoder throws', async () => {
    const refusal = { ok: false, problems: [{ path: 'images[1]', rule: 'type', expected: 'a JPEG image that can be shown', received: 'a damaged image' }] };
    const none: Decode = (bytes, type) => (type === 'image/jpeg' ? Promise.resolve(null) : decodeHeader(bytes, type));
    const taller: Decode = (bytes, type) => decodeHeader(bytes, type).then((size) => (size && type === 'image/jpeg' ? { ...size, height: size.height + 1 } : size));
    const throws: Decode = (bytes, type) => (type === 'image/jpeg' ? Promise.reject(new Error('no')) : decodeHeader(bytes, type));
    for (const decode of [none, taller, throws]) expect(await admitImages(images, decode)).toEqual(refusal);
  });

  it('never hands the decoder an image its header refuses', async () => {
    let calls = 0;
    const counted: Decode = (bytes, type) => {
      calls += 1;
      return decodeHeader(bytes, type);
    };
    expect(await admitImages([...images, { type: 'image/png', bytes: png(9000, 1) }], counted)).toMatchObject({ ok: false });
    expect(calls).toBe(0);
  });

  it('gives the decoder a copy, so nothing it does changes the image', async () => {
    const bytes = png(4, 3);
    const spoils: Decode = (given, type) => {
      const size = sizeOf(given, type);
      given.fill(0);
      return Promise.resolve(size);
    };
    expect(await admitImages([{ type: 'image/png', bytes }], spoils)).toEqual({ ok: true });
    expect(bytes).toEqual(png(4, 3));
  });

  it('gives the decoder a copy in a new buffer even when the image’s own slice shares storage, as a Node Buffer’s does', async () => {
    class Sharing extends Uint8Array {
      override slice(start?: number, end?: number): Sharing {
        return new Sharing(this.buffer, this.byteOffset + (start ?? 0), (end ?? this.length) - (start ?? 0));
      }
    }
    const bytes = new Sharing(png(4, 3));
    let given: Uint8Array | undefined;
    const spoils: Decode = (copy, type) => {
      given = copy;
      const size = sizeOf(copy, type);
      copy.fill(0);
      return Promise.resolve(size);
    };
    expect(await admitImages([{ type: 'image/png', bytes }], spoils)).toEqual({ ok: true });
    expect(given?.buffer).not.toBe(bytes.buffer);
    expect(Uint8Array.from(bytes)).toEqual(png(4, 3));
  });
});

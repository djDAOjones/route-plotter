// CORE-03: image admission, for Save and Open alike (v3/src/models/ImageAsset.js:5–12, :279–298;
// v3/tests/projectLimits.test.js:327 for SVG). The images are headers built by hand: admission reads no more.
import { describe, expect, it } from 'vitest';
import { jpeg, png, webpExtended, webpLossless, webpLossy } from './fixtures';
import { admitImages, sizeOf, typeOf } from './images';
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
  it('admits sound images of each type', () => {
    expect(admitImages([
      { type: 'image/png', bytes: png(2, 2) },
      { type: 'image/jpeg', bytes: jpeg(2, 2) },
      { type: 'image/webp', bytes: webpLossy(2, 2) },
    ])).toEqual({ ok: true });
  });

  it('refuses bytes that are not the declared type, SVG among them', () => {
    expect(admitImages([{ type: 'image/png', bytes: jpeg(1, 1) }, { type: 'image/png', bytes: SVG }])).toEqual({
      ok: false,
      problems: [
        { path: 'images[0]', rule: 'type', expected: 'a PNG image', received: 'a JPEG image' },
        { path: 'images[1]', rule: 'type', expected: 'a PNG image', received: 'something else' },
      ],
    });
  });

  it('refuses a header it cannot read', () => {
    expect(admitImages([{ type: 'image/png', bytes: png(1, 1).slice(0, 20) }])).toMatchObject({ ok: false, problems: [{ path: 'images[0]', rule: 'type' }] });
  });

  it('refuses a side of 0 or over 8,192 pixels, and over 24 million pixels in one image', () => {
    for (const [width, height] of [[0, 1], [IMAGE_LIMITS.dimension + 1, 1], [5000, 5000]] as const) {
      expect(admitImages([{ type: 'image/png', bytes: png(width, height) }]), `${width} × ${height}`).toMatchObject({
        ok: false,
        problems: [{ path: 'images[0]', rule: 'range' }],
      });
    }
    expect(admitImages([{ type: 'image/png', bytes: png(IMAGE_LIMITS.dimension, 2929) }])).toEqual({ ok: true });
  });

  it('refuses over 48 million pixels in all images', () => {
    const image = { type: 'image/png' as const, bytes: png(4000, 4000) };
    expect(admitImages([image, image, image])).toEqual({ ok: true });
    expect(admitImages([image, image, image, image])).toMatchObject({ ok: false, problems: [{ path: 'images', rule: 'total' }] });
  });

  it('refuses one image over 16 MB and images over 40 MB in all, as too large', () => {
    const big = new Uint8Array(IMAGE_LIMITS.bytes + 1);
    big.set(png(1, 1));
    expect(admitImages([{ type: 'image/png', bytes: big }])).toEqual({ ok: false, tooLarge: 'image 1 is over 16 MB' });
    const large = new Uint8Array(15 * 1024 * 1024);
    large.set(png(1, 1));
    const image = { type: 'image/png' as const, bytes: large };
    expect(admitImages([image, image, image])).toEqual({ ok: false, tooLarge: 'its images come to more than 40 MB' });
  });
});

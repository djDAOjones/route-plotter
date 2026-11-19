// CORE-03: image headers built by hand, for io's tests only: admission reads a header and no more, so a test image
// needs no encoder. Each builds the smallest bytes its type's header reader accepts, at the size asked for.
import { sizeOf } from './images';
import type { Decode } from './images';

/** The decoder io's tests pass to Save and Open: a sound image decodes to the size its header declares. */
export const decodeHeader: Decode = (bytes, type) => Promise.resolve(sizeOf(bytes, type));

const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0));
const be32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const be16 = (value: number) => [(value >>> 8) & 255, value & 255];
const le16 = (value: number) => [value & 255, (value >>> 8) & 255];
const le24 = (value: number) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255];
const le32 = (value: number) => [...le16(value & 0xffff), ...le16(value >>> 16)];

export const png = (width: number, height: number) =>
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('IHDR'), ...be32(width), ...be32(height), 8, 6, 0, 0, 0, 0, 0, 0, 0]);

export const jpeg = (width: number, height: number) =>
  Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc4, 0, 3, 0, 0xff, 0xc2, 0, 11, 8, ...be16(height), ...be16(width), 1, 1, 0x11, 0, 0xff, 0xd9]);

const riff = (chunk: number[]) => [...ascii('RIFF'), ...le32(chunk.length + 4), ...ascii('WEBP'), ...chunk];
export const webpLossy = (width: number, height: number) =>
  Uint8Array.from(riff([...ascii('VP8 '), ...le32(10), 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)]));
export const webpLossless = (width: number, height: number) =>
  Uint8Array.from(riff([...ascii('VP8L'), ...le32(5), 0x2f, ...le32((width - 1) | ((height - 1) << 14))]));
export const webpExtended = (width: number, height: number) =>
  Uint8Array.from(riff([...ascii('VP8X'), ...le32(10), 0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]));

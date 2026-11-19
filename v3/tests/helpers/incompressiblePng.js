import { crc32 } from 'node:zlib';

// A complete1x1 PNG with an optional private ancillary chunk. All chunks have valid CRCs;
// a browser decodes the original IDAT while the private bytes exercise real ZIP compression.
const base = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64');
export function incompressiblePng(size, seed) {
  const length = Math.max(0, size - base.length - 12);
  const chunk = Buffer.allocUnsafe(length + 12);
  chunk.writeUInt32BE(length, 0); chunk.write('rpLa', 4, 'ascii');
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    chunk[i + 8] = state & 255;
  }
  chunk.writeUInt32BE(crc32(chunk.subarray(4, length + 8)), length + 8);
  return `data:image/png;base64,${Buffer.concat([base.subarray(0, 33), chunk, base.subarray(33)]).toString('base64')}`;
}

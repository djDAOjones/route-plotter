import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertArchiveTextSafe } from '../src/utils/archiveText.js';

// Production resolves JSZip's browser distribution, whose string chunking and
// independent UTF-8 encoder this boundary proof depends on. A dependency update
// must review the actual browser implementation, not just its Node pako version.
test('the ZIP text proof is bound to the reviewed browser distribution', () => {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../node_modules/jszip/dist/jszip.min.js');
  expect(createHash('sha256').update(readFileSync(path)).digest('hex'))
    .toBe('acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e');
});

test.each([[0, true], [16382, true], [16383, false], [16384, true], [32766, true],
  [32767, false], [32768, true], [65535, false]])('pair at UTF-16 offset %s safe=%s', (offset, safe) => {
  const check = () => assertArchiveTextSafe('a'.repeat(offset) + '🙂Z');
  if (safe) expect(check).not.toThrow();
  else expect(check).toThrow('Project text cannot be saved intact');
});

test.each(['\uD800', '\uDC00', 'abc\uD800end', 'abc\uDC00'])('raw lone surrogate refuses (%j)', value => {
  expect(() => assertArchiveTextSafe(value)).toThrow('Shorten a label or rename an image');
});

test('well-formed JSON escapes preserve lone surrogates and pass at every chunk boundary', () => {
  for (const offset of [16381, 16383, 32767]) {
    const value = { pad: 'a'.repeat(offset), text: '\uD800\uDC00\uD800x\uDC00' };
    const json = JSON.stringify(value);
    // These fixtures retain a valid pair off the seam while testing escaped lone surrogates.
    expect(json.indexOf('𐀀') % 16384).not.toBe(16383);
    expect(() => assertArchiveTextSafe(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(value);
  }
});

test('multibyte BMP text can cross chunks without losing text', () => {
  const json = JSON.stringify({ text: '漢字é'.repeat(6000) });
  expect(() => assertArchiveTextSafe(json)).not.toThrow();
  expect(JSON.parse(json).text).toBe('漢字é'.repeat(6000));
});

test.each([null, undefined, {}])('non-string prepared text refuses (%j)', value => {
  expect(() => assertArchiveTextSafe(value)).toThrow('Project text cannot be saved intact');
});

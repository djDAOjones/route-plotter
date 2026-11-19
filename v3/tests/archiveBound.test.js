import { expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ImageAssetService, SIZE_LIMITS } from '../src/services/ImageAssetService.js';
import { deflateByteBound, strictBase64Bytes, assertArchiveEntriesFit, assertPreparedArchiveFits } from '../src/utils/archiveBound.js';

const require = createRequire(import.meta.url);
const BrowserZip = require('jszip/dist/jszip.min.js');
const prepared = extra => ({ projectJSON: '{"text":"漢é"}', images: [], background: null, ...extra });

test('raw DEFLATE bound uses safe full integers and the reviewed browser distribution', () => {
  expect(createHash('sha256').update(readFileSync(require.resolve('jszip/dist/jszip.min.js'))).digest('hex'))
    .toBe('acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e');
  for (const n of [0, 1, 4095, 4096, 4097, 16383, 16384, 16385, 33554431, 33554432, 33554433, 52428800]) {
    const big = BigInt(n), expected = big + (big + 4095n) / 4096n + (big + 16383n) / 16384n
      + (big + 33554431n) / 33554432n + 13n;
    expect(deflateByteBound(n)).toBe(Number(expected));
  }
  for (const n of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER, '1']) expect(() => deflateByteBound(n)).toThrow();
});

test.each([['AA==', 1], ['AAA=', 2], ['AAAA', 3], ['////', 3], ['a0+/AA==', 4]])('strict bytes for %s are %s', (text, count) => {
  expect(strictBase64Bytes(text)).toBe(count);
});
test.each(['', 'A', 'AAA', 'A===', 'AA==AA==', 'AAA=\n', 'AA A', '....', '=AAA', '🙂===', null, undefined])(
  'malformed base64 refuses instead of flooring its decoded length: %j', text => {
    expect(() => strictBase64Bytes(text)).toThrow(/image.*bytes/i);
  });

test('prepared UTF8 text, both filename copies, assets folder, every binary and EOCD are included', () => {
  const p = prepared({ images: [{ filename: 'a.png', base64Data: 'AAAA' }, { filename: 'b.png', base64Data: 'AA==' }],
    background: { filename: 'background.png', base64Data: 'AAA=' } });
  const entries = [['assets/', 0], ['project.json', new TextEncoder().encode(p.projectJSON).length],
    ['assets/a.png', 3], ['assets/b.png', 1], ['background.png', 2]];
  const oracle = 22 + entries.reduce((sum, [path, n]) => sum + deflateByteBound(n) + 512 + 2 * new TextEncoder().encode(path).length, 0);
  expect(assertPreparedArchiveFits(p, oracle)).toBe(oracle);
  expect(() => assertPreparedArchiveFits(p, oracle - 1)).toThrow(/guaranteed room.*smaller background.*fewer custom images/i);
  expect(() => assertPreparedArchiveFits(prepared({ projectJSON: 'x'.repeat(16383) + '🙂' }), 1e9))
    .toThrow('Shorten a label or rename an image');
});

test('exact 50MiB bound admits; one byte over refuses; unsafe sums never become a pass', () => {
  const cap = 52428800;
  let lo = 0, hi = cap;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const total = deflateByteBound(mid) + 512 + 2 + 22;
    if (total <= cap) lo = mid; else hi = mid - 1;
  }
  let total;
  expect(() => { total = assertArchiveEntriesFit([{ path: 'a', bytes: lo }], cap); }).not.toThrow();
  expect(total).toBe(cap);
  const entries = [{ path: 'a', bytes: lo }];
  expect(assertArchiveEntriesFit(entries, total)).toBe(total);
  expect(() => assertArchiveEntriesFit(entries, total - 1)).toThrow(/guaranteed room/i);
  expect(SIZE_LIMITS.ZIP_MAX).toBe(cap);
  expect(() => assertArchiveEntriesFit([{ path: 'a', bytes: Number.MAX_SAFE_INTEGER }], cap)).toThrow();
  expect(() => assertArchiveEntriesFit([{ path: 'a', bytes: 1 }], NaN)).toThrow();
});

test.each([0, 1, 4096, 16384, 131073, 1048576])('bound exceeds actual browser-default adversarial ZIP (%s binary bytes)', async n => {
  const data = Buffer.alloc(n); let state = 123456;
  for (let i = 0; i < n; i++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; data[i] = state & 255; }
  const p = prepared({ images: n ? [{ filename: 'a.png', base64Data: data.toString('base64') }] : [] });
  const bound = assertPreparedArchiveFits(p, SIZE_LIMITS.ZIP_MAX);
  const zip = new BrowserZip(), folder = zip.folder('assets');
  for (const image of p.images) folder.file(image.filename, image.base64Data, { base64: true });
  zip.file('project.json', p.projectJSON);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  expect(bytes.byteLength).toBeLessThanOrEqual(bound);
  const opened = await BrowserZip.loadAsync(bytes);
  expect(await opened.file('project.json').async('string')).toBe(p.projectJSON);
  if (n) expect(Buffer.from(await opened.file('assets/a.png').async('uint8array'))).toEqual(data);
});

test('the action-specific service proves exact prepared data; the ordinary exporter remains independently usable', async () => {
  const service = new ImageAssetService(), p = prepared();
  const prepare = vi.spyOn(service, 'prepareArchive').mockReturnValue(p);
  const facts = service.assertArchiveFitsByBound({ target: true }, 'retained-bg');
  expect(prepare).toHaveBeenCalledWith({ target: true }, 'retained-bg');
  expect(facts.projectJSON).toBe(p.projectJSON); expect(facts.boundBytes).toBeGreaterThan(0);
  expect((await service.exportZip({ target: true }, 'retained-bg')).size).toBeLessThanOrEqual(facts.boundBytes);
});

// CORE-03: the ZIP guard's tests, ported from v3/tests/projectLimits.test.js:41–160 (the fixtures) and :213–339 (the
// archive tests), with the names v4 refuses besides `..` and `\`.
import JSZip from 'jszip/dist/jszip.min.js';
import { describe, expect, it, vi } from 'vitest';
import { ARCHIVE_LIMITS } from './limits';
import { newBudget, preflight, readEntry } from './preflight';

function findEnd(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) {
      return offset;
    }
  }
  throw new Error('the fixture has no end record');
}

function joined(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function setUint64(view: DataView, offset: number, value: number | bigint): void {
  const big = BigInt(value);
  view.setUint32(offset, Number(big & 0xffffffffn), true);
  view.setUint32(offset + 4, Number(big >> 32n), true);
}

const viewOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

async function zipOf(files: Record<string, string | Uint8Array>, compression: 'STORE' | 'DEFLATE' = 'STORE') {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) {
    zip.file(name, typeof data === 'string' ? new TextEncoder().encode(data) : data, { binary: true, createFolders: false });
  }
  return zip.generateAsync({ type: 'uint8array', compression });
}

const single = () => zipOf({ 'project.json': '{"app":"route-plotter"}' });

/** The one table record repeated `physical` times, the end record claiming `declared`. */
function duplicateDirectory(bytes: Uint8Array, physical: number, declared = physical): Uint8Array {
  const end = findEnd(bytes);
  const view = viewOf(bytes);
  const offset = view.getUint32(end + 16, true);
  const record = bytes.slice(offset, offset + view.getUint32(end + 12, true));
  const directory = new Uint8Array(record.length * physical);
  for (let index = 0; index < physical; index += 1) directory.set(record, index * record.length);
  const endRecord = bytes.slice(end);
  const endView = viewOf(endRecord);
  endView.setUint16(8, declared, true);
  endView.setUint16(10, declared, true);
  endView.setUint32(12, directory.length, true);
  return joined(bytes.slice(0, offset), directory, endRecord);
}

/** A second table and end record hidden in the real end record's comment, one byte too long to end the file. */
function hideDirectoryInComment(bytes: Uint8Array, physical: number): Uint8Array {
  const end = findEnd(bytes);
  const view = viewOf(bytes);
  const offset = view.getUint32(end + 16, true);
  const record = bytes.slice(offset, offset + view.getUint32(end + 12, true));
  const directory = new Uint8Array(record.length * physical);
  for (let index = 0; index < physical; index += 1) directory.set(record, index * record.length);
  const fake = bytes.slice(end, end + 22);
  const fakeView = viewOf(fake);
  fakeView.setUint16(8, physical, true);
  fakeView.setUint16(10, physical, true);
  fakeView.setUint32(12, directory.length, true);
  fakeView.setUint32(16, bytes.length, true);
  fakeView.setUint16(20, 0, true);
  const archive = bytes.slice();
  viewOf(archive).setUint16(end + 20, directory.length + fake.length + 1, true);
  return joined(archive, directory, fake, new Uint8Array([0]));
}

function toLargeFileFormat(bytes: Uint8Array): Uint8Array {
  const end = findEnd(bytes);
  const view = viewOf(bytes);
  const entries = view.getUint16(end + 10, true);
  const size = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  const record = new Uint8Array(56);
  const recordView = viewOf(record);
  recordView.setUint32(0, 0x06064b50, true);
  setUint64(recordView, 4, 44);
  recordView.setUint16(12, 45, true);
  recordView.setUint16(14, 45, true);
  setUint64(recordView, 24, entries);
  setUint64(recordView, 32, entries);
  setUint64(recordView, 40, size);
  setUint64(recordView, 48, offset);
  const locator = new Uint8Array(20);
  const locatorView = viewOf(locator);
  locatorView.setUint32(0, 0x07064b50, true);
  setUint64(locatorView, 8, end);
  locatorView.setUint32(16, 1, true);
  const classic = bytes.slice(end);
  const classicView = viewOf(classic);
  classicView.setUint16(8, 0xffff, true);
  classicView.setUint16(10, 0xffff, true);
  classicView.setUint32(12, 0xffffffff, true);
  classicView.setUint32(16, 0xffffffff, true);
  return joined(bytes.slice(0, end), record, locator, classic);
}

const refusedFor = (bytes: Uint8Array) => {
  const result = preflight(bytes);
  if (result.ok) throw new Error('the file was not refused');
  return result.refusal;
};

describe('the ZIP guard before jszip reads the file (v3 preflightProjectZip)', () => {
  it('refuses an empty file as not a project, and a file over 50 MB before reading it', () => {
    expect(refusedFor(new Uint8Array(0)).reason).toBe('not-a-project');
    const big = refusedFor(new Uint8Array(ARCHIVE_LIMITS.zipBytes + 1));
    expect(big.reason).toBe('too-large');
    expect(big.message).toMatch(/50 MB/);
  });

  it('refuses bytes with no end record as not a project', () => {
    expect(refusedFor(new TextEncoder().encode('{"app":"route-plotter"}')).reason).toBe('not-a-project');
  });

  it('accepts a ZIP as jszip writes it, listing each name and declared size', async () => {
    const result = preflight(await zipOf({ 'project.json': '{}', 'images/1.png': new Uint8Array(10) }));
    expect(result).toEqual({
      ok: true,
      entries: [
        { name: 'project.json', declaredBytes: 2 },
        { name: 'images/1.png', declaredBytes: 10 },
      ],
    });
  });

  it('refuses more than 256 entries', async () => {
    const files: Record<string, string> = { 'project.json': '{}' };
    for (let index = 0; index < ARCHIVE_LIMITS.entries; index += 1) files[`extra-${index}.txt`] = 'x';
    const refusal = refusedFor(await zipOf(files));
    expect(refusal.reason).toBe('too-large');
    expect(refusal.message).toMatch(/more than 256 files/);
  });

  it('refuses a table that repeats one name, however many it claims, and one hidden in a comment', async () => {
    const base = await single();
    const tooMany = refusedFor(duplicateDirectory(base, ARCHIVE_LIMITS.entries + 1));
    expect(tooMany.reason).toBe('too-large');
    const underclaimed = refusedFor(duplicateDirectory(base, ARCHIVE_LIMITS.entries + 1, 1));
    expect(underclaimed.message).toMatch(/names the file "project.json" twice/);
    expect(refusedFor(duplicateDirectory(base, 2)).message).toMatch(/twice/);
    const hidden = refusedFor(hideDirectoryInComment(base, ARCHIVE_LIMITS.entries + 1));
    expect(hidden.reason).toBe('unsafe');
    expect(hidden.message).toMatch(/does not end where the file ends/);
  });

  it('refuses a table that claims fewer files than it holds', async () => {
    const two = await zipOf({ 'project.json': '{}', 'images/1.png': new Uint8Array(1) });
    const end = findEnd(two);
    const claimed = two.slice();
    viewOf(claimed).setUint16(end + 8, 1, true);
    viewOf(claimed).setUint16(end + 10, 1, true);
    expect(refusedFor(claimed).message).toMatch(/does not count its own files/);
  });

  it('accepts sound large-file (ZIP64) records and refuses a cut or wrong end record', async () => {
    const base = await single();
    const large = toLargeFileFormat(base);
    expect(preflight(large)).toEqual({ ok: true, entries: [{ name: 'project.json', declaredBytes: 23 }] });
    expect((await JSZip.loadAsync(large)).file('project.json')).not.toBeNull();
    expect(refusedFor(base.slice(0, -1)).message).toMatch(/ends part-way through its table of contents/);
    const wrong = large.slice();
    setUint64(viewOf(wrong), findEnd(wrong) - 20 + 8, wrong.length + 1);
    expect(refusedFor(wrong).message).toMatch(/large-file end record is missing/);
    const disagreeing = large.slice();
    viewOf(disagreeing).setUint16(findEnd(disagreeing) + 10, 2, true);
    expect(refusedFor(disagreeing).message).toMatch(/disagree/);
  });

  it('refuses names that could reach outside the project', async () => {
    const unsafe = ['../project.json', 'images\\1.png', '/project.json', 'C:project.json', 'a\u0000b', 'a/../../b'];
    for (const name of unsafe) {
      const refusal = refusedFor(await zipOf({ [name]: '{}' }));
      expect(refusal.reason, name).toBe('unsafe');
      expect(refusal.message, name).toMatch(/could reach outside the project/);
    }
  });

  it('refuses an entry that declares more than 64 MB once unpacked, or the large-file size mark', async () => {
    const base = await single();
    const end = findEnd(base);
    const offset = viewOf(base).getUint32(end + 16, true);
    const huge = base.slice();
    viewOf(huge).setUint32(offset + 24, ARCHIVE_LIMITS.inflatedBytes + 1, true);
    expect(refusedFor(huge).message).toMatch(/"project.json" is over 64 MB once unpacked/);
    const marked = base.slice();
    viewOf(marked).setUint32(offset + 24, 0xffffffff, true);
    expect(refusedFor(marked).reason).toBe('too-large');
  });

  it('refuses an encrypted entry and one compressed in a way jszip does not read', async () => {
    const base = await single();
    const offset = viewOf(base).getUint32(findEnd(base) + 16, true);
    const encrypted = base.slice();
    viewOf(encrypted).setUint16(offset + 8, 1, true);
    expect(refusedFor(encrypted).message).toMatch(/encrypted/);
    const bzip = base.slice();
    viewOf(bzip).setUint16(offset + 10, 12, true);
    expect(refusedFor(bzip).message).toMatch(/compressed in a way/);
  });

  it('never calls jszip while it refuses', async () => {
    const load = vi.spyOn(JSZip, 'loadAsync');
    try {
      const base = await single();
      refusedFor(duplicateDirectory(base, 2));
      refusedFor(hideDirectoryInComment(base, 3));
      refusedFor(await zipOf({ '../project.json': '{}' }));
      expect(load).not.toHaveBeenCalled();
    } finally {
      load.mockRestore();
    }
  });
});

describe('reading one entry within its limit and the shared budget (v3 readEntryBytes)', () => {
  it('reads an entry whole, into a new array', async () => {
    const zip = await JSZip.loadAsync(await zipOf({ 'a.bin': new Uint8Array([1, 2, 3]) }));
    const entry = zip.file('a.bin');
    if (entry === null) throw new Error('no entry');
    const budget = newBudget();
    expect(await readEntry(entry, 3, budget)).toEqual(new Uint8Array([1, 2, 3]));
    expect(budget.left).toBe(ARCHIVE_LIMITS.inflatedBytes - 3);
  });

  it('stops a small deflated entry that unpacks past its own limit, or past the budget', async () => {
    const zip = await JSZip.loadAsync(await zipOf({ 'a.bin': new Uint8Array(3 * 1024 * 1024) }, 'DEFLATE'));
    const entry = zip.file('a.bin');
    if (entry === null) throw new Error('no entry');
    expect(await readEntry(entry, ARCHIVE_LIMITS.projectJsonBytes, newBudget())).toBeNull();
    expect(await readEntry(entry, ARCHIVE_LIMITS.inflatedBytes, { left: 1024 * 1024 })).toBeNull();
  });
});

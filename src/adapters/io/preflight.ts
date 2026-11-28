// CORE-03: the ZIP's own guard, before jszip reads it (the plan's §15, file safety), ported from frozen v3's
// `preflightProjectZip` (v3/src/services/ImageAssetService.js:39–232) and its import checks (:735–761). The file's
// bytes are read raw: its last end record, which must end the file exactly; the large-file (ZIP64) records, which
// must agree with it; and every record of its table of contents, counted, so a table that names one file twice or
// claims fewer files than it holds is refused before jszip, which keys files by name, could fold them together.
// Then each file's name and declared size. Reading an entry is bounded too (`readEntry`, v3's `readEntryBytes`,
// :248–286): it stops at its own limit and at the budget all entries share, however small the compressed file.
import type { ZipEntry } from 'jszip/dist/jszip.min.js';
import { ARCHIVE_LIMITS } from './limits';
import { WORDS } from './words';
import type { Refusal } from './words';

const SIGNATURE = Object.freeze({ directory: 0x02014b50, end: 0x06054b50, end64: 0x06064b50, locator64: 0x07064b50 });
const END_BYTES = 22;
const DIRECTORY_BYTES = 46;
const ALL16 = 0xffff;
const ALL32 = 0xffffffff;
/** The compression methods jszip reads: stored and deflated. */
const METHODS: readonly number[] = [0, 8];

/** A file the ZIP's table of contents names, with the size it declares once inflated. */
interface Entry {
  readonly name: string;
  readonly declaredBytes: number;
}

export type Preflight =
  | { readonly ok: true; readonly entries: readonly Entry[] }
  | { readonly ok: false; readonly refusal: Refusal };

/** Thrown inside this module only, and always caught by `preflight`. */
class Stop extends Error {
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

const damaged = (why: string) => new Stop({ reason: 'unsafe', message: WORDS.openedUnsafe(why) });
const tooLarge = (what: string) => new Stop({ reason: 'too-large', message: WORDS.openedTooLarge(what) });
const tooMany = () => tooLarge(`it holds more than ${ARCHIVE_LIMITS.entries} files`);
const MB = (bytes: number) => `${bytes / (1024 * 1024)} MB`;

function uint64(view: DataView, offset: number): bigint {
  return (BigInt(view.getUint32(offset + 4, true)) << 32n) | BigInt(view.getUint32(offset, true));
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw damaged('its large-file records are damaged');
  return Number(value);
}

/** The last end record, as jszip finds it, which must end the file exactly (v3 :83–104). */
function findEnd(bytes: Uint8Array, view: DataView): number {
  for (let offset = bytes.length - 4; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) !== SIGNATURE.end) continue;
    if (offset + END_BYTES > bytes.length) throw damaged('it ends part-way through its table of contents');
    if (offset + END_BYTES + view.getUint16(offset + 20, true) !== bytes.length) {
      throw damaged('its table of contents does not end where the file ends');
    }
    return offset;
  }
  throw new Stop({ reason: 'not-a-project', message: WORDS.openedNotAProject });
}

interface Directory {
  readonly declared: bigint;
  readonly size: number;
  readonly offset: number;
  /** Where the table of contents must end: the end record, or the large-file end record before it. */
  readonly boundary: number;
}

/** The large-file (ZIP64) end record and its locator, which must agree with the classic record (v3 :106–159). */
function readLargeFileEnd(view: DataView, end: number): Directory {
  const locator = end - 20;
  if (locator < 0 || view.getUint32(locator, true) !== SIGNATURE.locator64) {
    throw damaged('its large-file end record is missing');
  }
  if (view.getUint32(locator + 4, true) !== 0 || view.getUint32(locator + 16, true) !== 1) {
    throw damaged('it is split across several files');
  }
  const record = safeNumber(uint64(view, locator + 8));
  if (record + 56 > locator || view.getUint32(record, true) !== SIGNATURE.end64) {
    throw damaged('its large-file end record is missing');
  }
  if (record + 12 + safeNumber(uint64(view, record + 4)) !== locator) {
    throw damaged('its large-file end record has the wrong size');
  }
  const onDisk = uint64(view, record + 24);
  const total = uint64(view, record + 32);
  if (view.getUint32(record + 16, true) !== 0 || view.getUint32(record + 20, true) !== 0 || onDisk !== total) {
    throw damaged('it is split across several files');
  }
  if (total > BigInt(ARCHIVE_LIMITS.entries)) throw tooMany();
  const size = uint64(view, record + 40);
  const offset = uint64(view, record + 48);
  const agrees = (classic: number, all: number, large: bigint) => classic === all || BigInt(classic) === large;
  if (
    !agrees(view.getUint16(end + 8, true), ALL16, onDisk) ||
    !agrees(view.getUint16(end + 10, true), ALL16, total) ||
    !agrees(view.getUint32(end + 12, true), ALL32, size) ||
    !agrees(view.getUint32(end + 16, true), ALL32, offset)
  ) {
    throw damaged('its large-file records disagree with its table of contents');
  }
  return { declared: total, size: safeNumber(size), offset: safeNumber(offset), boundary: record };
}

function readDirectory(view: DataView, end: number): Directory {
  const classic = {
    disk: view.getUint16(end + 4, true),
    directoryDisk: view.getUint16(end + 6, true),
    onDisk: view.getUint16(end + 8, true),
    total: view.getUint16(end + 10, true),
    size: view.getUint32(end + 12, true),
    offset: view.getUint32(end + 16, true),
  };
  const large = [classic.disk, classic.directoryDisk, classic.onDisk, classic.total].includes(ALL16) ||
    classic.size === ALL32 || classic.offset === ALL32;
  if (large) return readLargeFileEnd(view, end);
  if (classic.disk !== 0 || classic.directoryDisk !== 0 || classic.onDisk !== classic.total) {
    throw damaged('it is split across several files');
  }
  if (classic.total > ARCHIVE_LIMITS.entries) throw tooMany();
  return { declared: BigInt(classic.total), size: classic.size, offset: classic.offset, boundary: end };
}

/** A name that could reach outside the project, or that no file system holds safely. */
function unsafeName(name: string): boolean {
  return (
    name === '' ||
    name.includes('\\') ||
    [...name].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f) ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    name.split('/').includes('..')
  );
}

/** Every record of the table of contents, walked raw and counted (v3 :161–194), with its name and declared size. */
function readEntries(bytes: Uint8Array, view: DataView, directory: Directory): Entry[] {
  const { offset, size, boundary, declared } = directory;
  if (offset + size > boundary || boundary > bytes.length) throw damaged('its table of contents is damaged');
  // jszip accepts bytes put before the ZIP and moves every offset by them; the table is read where jszip reads it.
  const start = boundary - size;
  const names = new TextDecoder('utf-8');
  const entries: Entry[] = [];
  const seen = new Set<string>();
  let inflated = 0;
  for (let cursor = start; cursor < boundary; ) {
    if (boundary - cursor < DIRECTORY_BYTES || view.getUint32(cursor, true) !== SIGNATURE.directory) {
      throw damaged('its table of contents is damaged');
    }
    const nameLength = view.getUint16(cursor + 28, true);
    const length = DIRECTORY_BYTES + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (length > boundary - cursor) throw damaged('its table of contents is damaged');
    if (entries.length === ARCHIVE_LIMITS.entries) throw tooMany();
    const name = names.decode(bytes.subarray(cursor + DIRECTORY_BYTES, cursor + DIRECTORY_BYTES + nameLength));
    if (unsafeName(name)) throw damaged(`it names a file in a way that could reach outside the project (${JSON.stringify(name)})`);
    if (seen.has(name)) throw damaged(`it names the file ${JSON.stringify(name)} twice`);
    if ((view.getUint16(cursor + 8, true) & 1) !== 0) throw damaged('it is encrypted');
    if (!METHODS.includes(view.getUint16(cursor + 10, true))) throw damaged('it is compressed in a way Route Plotter does not read');
    const declaredBytes = view.getUint32(cursor + 24, true);
    // A size of 0xffffffff points to a large-file field: no file Route Plotter opens is that large.
    if (declaredBytes === ALL32 || declaredBytes > ARCHIVE_LIMITS.inflatedBytes) {
      throw tooLarge(`${JSON.stringify(name)} is over ${MB(ARCHIVE_LIMITS.inflatedBytes)} once unpacked`);
    }
    inflated += declaredBytes;
    if (inflated > ARCHIVE_LIMITS.inflatedBytes) {
      throw tooLarge(`its files come to more than ${MB(ARCHIVE_LIMITS.inflatedBytes)} once unpacked`);
    }
    seen.add(name);
    entries.push({ name, declaredBytes });
    cursor += length;
  }
  if (BigInt(entries.length) !== declared) throw damaged('its table of contents does not count its own files');
  return entries;
}

/** The ZIP's structure, its names and its declared sizes, checked raw before jszip reads a byte. Never throws. */
export function preflight(bytes: Uint8Array): Preflight {
  try {
    if (bytes.byteLength === 0) throw new Stop({ reason: 'not-a-project', message: WORDS.openedNotAProject });
    if (bytes.byteLength > ARCHIVE_LIMITS.zipBytes) throw tooLarge(`a project file holds at most ${MB(ARCHIVE_LIMITS.zipBytes)}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { ok: true, entries: readEntries(bytes, view, readDirectory(view, findEnd(bytes, view))) };
  } catch (stopped) {
    if (stopped instanceof Stop) return { ok: false, refusal: stopped.refusal };
    return { ok: false, refusal: { reason: 'unsafe', message: WORDS.openedUnsafe('its table of contents is damaged') } };
  }
}

/** What all the entries read from one file may inflate to, together (v3's MAX_DECOMPRESSED_BYTES budget). */
export interface Budget {
  left: number;
}

/**
 * A fresh budget for one file: every entry read from that file draws on it, so many small entries cannot together
 * inflate past the limit.
 */
export const newBudget = (): Budget => ({ left: ARCHIVE_LIMITS.inflatedBytes });

/**
 * One entry's bytes, inflated a chunk at a time and stopped as soon as it passes `max` or the shared budget, so a
 * small file cannot unpack into a large one (v3 :248–286). `null` when it passed; the bytes are a new array, never a
 * view of the file or of jszip's buffers.
 */
export function readEntry(entry: ZipEntry, max: number, budget: Budget): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let settled = false;
    const stream = entry.internalStream('uint8array');
    stream.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > max || chunk.length > budget.left) {
        settled = true;
        stream.pause();
        resolve(null);
        return;
      }
      budget.left -= chunk.length;
      chunks.push(chunk);
    });
    stream.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    });
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, at);
        at += chunk.length;
      }
      resolve(bytes);
    });
    stream.resume();
  });
}

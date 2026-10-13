/**
 * RecoveryImageStore — the images browser recovery keeps (DEF-98).
 *
 * Browser recovery was model-only: its record kept the route and dropped
 * every image, so a restored session opened on a blank canvas. The record
 * (`routePlotter_autosave`, 4 MiB of `localStorage`) cannot hold a 16 MB
 * background, so the images go into one IndexedDB object store, each entry
 * keyed by the SHA-256 of its bytes (`sha256-<hex>`), and the record names
 * them (its `recoveryImages` manifest, `src/app/recoveryImages.js`). An entry
 * holds the key, the MIME type, the dimensions, the byte length and the
 * bytes; it holds no name: a name belongs to the manifest's reference, since
 * the same bytes may be one file in one role and another file elsewhere.
 *
 * Every operation resolves to a result (`{ ok, reason }`) and never throws
 * to its caller: a store that fails costs recovery its images, which are then
 * warned of by name, never the app its start or its save.
 *
 * Who may write, and when an entry may go. Every tab of the app shares the
 * store and the one recovery record. While an image is in a tab's live
 * project, or that tab is storing or reading it, the tab pins it: it holds a
 * shared Web Lock of that image's own (`STORAGE.RECOVERY_IMAGES_LOCK:<key>`).
 * An entry is deleted only under that lock taken exclusive, so only while no
 * tab pins it, and only when no record names it (the recovery record, a kept
 * or a held one). What a pin has seen stored (`isStoredNow`) stays stored
 * while the pin is held, so a record written at any moment, the `pagehide`
 * flush's included, names an image only while it is pinned and seen stored.
 * Garbage collection and Clear All are the one sweep, so the same barrier
 * covers both (Codex, code review round 1, 1 and 9). With no Web Locks (a
 * browser without them, or a test's jsdom), the store coordinates its own tab
 * only, and so never deletes: a leaked entry is better than a lost one (Codex,
 * brief round 2, 13).
 *
 * Kept out of the exported player: nothing under `src/player` imports it.
 *
 * @module services/RecoveryImageStore
 */

import { STORAGE } from '../config/constants.js';
import { IMAGE_LIMITS } from '../models/ImageAsset.js';
import { PROJECT_ARCHIVE_LIMITS } from './ImageAssetService.js';

/**
 * What browser recovery keeps, no more than a project file holds
 * (`IMAGE_LIMITS`, `PROJECT_ARCHIVE_LIMITS`): per image, its bytes,
 * dimensions and decoded pixels; the background on its own budget, as a
 * project file keeps it; the custom images in all, by count, bytes and
 * decoded pixels. README's Auto-save section states them.
 */
export const RECOVERY_IMAGE_LIMITS = Object.freeze({
  MAX_BYTES: IMAGE_LIMITS.MAX_BYTES,
  MAX_DIMENSION: IMAGE_LIMITS.MAX_DIMENSION,
  MAX_PIXELS: IMAGE_LIMITS.MAX_PIXELS,
  MAX_BACKGROUND_BYTES: PROJECT_ARCHIVE_LIMITS.MAX_BACKGROUND_BYTES,
  MAX_ASSETS: PROJECT_ARCHIVE_LIMITS.MAX_ASSETS,
  MAX_ASSET_BYTES_TOTAL: PROJECT_ARCHIVE_LIMITS.MAX_ASSET_BYTES_TOTAL,
  MAX_IMAGE_PIXELS_TOTAL: PROJECT_ARCHIVE_LIMITS.MAX_IMAGE_PIXELS_TOTAL,
});

const KEY_PREFIX = 'sha256-';
const OBJECT_STORE = 'images';

/**
 * Why an operation failed, in the words the warnings use
 * (`src/app/recoveryImages.js`).
 */
export const RECOVERY_REASONS = Object.freeze({
  TOO_LARGE: 'too-large',
  OVER_TOTAL: 'over-total',
  REFUSED: 'refused',
  PENDING: 'pending',
  MISSING: 'missing',
  UNREADABLE: 'unreadable',
  UNAVAILABLE: 'unavailable',
  LEGACY: 'legacy',
  CANCELLED: 'cancelled',
});

/** The bytes a base64 data URL carries. */
export function dataURLToBytes(dataURL) {
  const binary = atob(String(dataURL).slice(String(dataURL).indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** A base64 data URL of `bytes`, of the given MIME type. */
export function bytesToDataURL(bytes, mimeType) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    binary += String.fromCharCode(...view.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/** The SHA-256 of `bytes`, as lower-case hex, from the browser's WebCrypto. */
export async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function asArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes;
  if (ArrayBuffer.isView(bytes)) return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return null;
}

/**
 * The IndexedDB backend: one database, one object store. Each operation
 * resolves when its transaction completes (a put is stored only then) and
 * rejects when it errs or aborts; a database that cannot be opened rejects
 * with `recoveryReason: 'unavailable'`.
 * @param {{ name?: string, factory?: IDBFactory }} [options]
 * @returns {Object|null} null where the browser has no IndexedDB
 */
export function createIndexedDBBackend({ name = STORAGE.RECOVERY_IMAGES_DB, factory = globalThis.indexedDB } = {}) {
  if (!factory || typeof factory.open !== 'function') return null;
  let opening = null;
  const unavailable = error => Object.assign(error instanceof Error ? error : new Error(String(error)),
    { recoveryReason: RECOVERY_REASONS.UNAVAILABLE });
  const open = () => {
    opening ??= new Promise((resolve, reject) => {
      let request;
      try {
        request = factory.open(name, 1);
      } catch (error) {
        reject(unavailable(error));
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OBJECT_STORE)) db.createObjectStore(OBJECT_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab deleting or upgrading the database closes this
        // connection; the next operation opens it again.
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(unavailable(request.error || new Error('IndexedDB could not be opened')));
      request.onblocked = () => reject(unavailable(new Error('IndexedDB is blocked')));
    }).catch(error => {
      opening = null;
      throw error;
    });
    return opening;
  };
  const run = (mode, work, durability) => open().then(db => new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = durability
        ? db.transaction(OBJECT_STORE, mode, { durability })
        : db.transaction(OBJECT_STORE, mode);
    } catch (error) {
      reject(error);
      return;
    }
    let result;
    let request;
    try {
      request = work(transaction.objectStore(OBJECT_STORE));
    } catch (error) {
      try { transaction.abort(); } catch { /* already finished */ }
      reject(error);
      return;
    }
    if (request) request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('IndexedDB request failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  }));
  return {
    // Strict durability: the record names an entry only once it is on disk.
    put: record => run('readwrite', store => store.put(record), 'strict').then(() => undefined),
    get: key => run('readonly', store => store.get(key)),
    delete: key => run('readwrite', store => store.delete(key)).then(() => undefined),
    has: key => run('readonly', store => store.getKey(key)).then(found => found !== undefined),
    keys: () => run('readonly', store => store.getAllKeys()).then(keys => (keys || []).map(String)),
  };
}

/**
 * An in-memory backend with the IndexedDB backend's shape, for tests: one
 * instance shared across boots stands for the browser's store. It can be made
 * to fail an operation, to lose or corrupt an entry, and to hold operations
 * until released, so a test controls every interleaving; `log` records each
 * operation as it lands.
 * @returns {Object}
 */
export function createMemoryRecoveryBackend() {
  const entries = new Map();
  const failures = new Map();
  const paused = new Map();
  const log = [];
  const gate = async (operation) => {
    const pause = paused.get(operation);
    if (pause) await pause.promise;
  };
  const fail = (operation, argument) => {
    const rule = failures.get(operation);
    if (!rule) return;
    const error = rule(argument);
    if (error) throw error;
  };
  const clone = record => ({ ...record, bytes: asArrayBuffer(record.bytes)?.slice(0) ?? record.bytes });
  return {
    entries,
    log,
    /**
     * Fail each `operation` for which `rule(argument)` returns an error.
     * @param {'put'|'get'|'has'|'delete'|'keys'} operation
     * @param {Function|null} rule - Return an Error to fail; null removes the rule
     */
    failWhen(operation, rule) {
      if (rule) failures.set(operation, rule);
      else failures.delete(operation);
    },
    /**
     * Hold every `operation` from now until the returned function is called.
     * @returns {Function} Release
     */
    pause(operation) {
      let release;
      const promise = new Promise(resolve => { release = resolve; });
      paused.set(operation, { promise });
      return () => {
        if (paused.get(operation)?.promise === promise) paused.delete(operation);
        release();
      };
    },
    /** Lose an entry, as a browser clearing its storage would. */
    lose(key) {
      entries.delete(key);
    },
    async put(record) {
      await gate('put');
      fail('put', record);
      entries.set(record.key, clone(record));
      log.push(`put ${record.key}`);
    },
    async get(key) {
      await gate('get');
      fail('get', key);
      log.push(`get ${key}`);
      const record = entries.get(key);
      return record ? clone(record) : undefined;
    },
    async delete(key) {
      await gate('delete');
      fail('delete', key);
      entries.delete(key);
      log.push(`delete ${key}`);
    },
    async has(key) {
      await gate('has');
      fail('has', key);
      log.push(`has ${key}`);
      return entries.has(key);
    },
    async keys() {
      await gate('keys');
      fail('keys');
      log.push('keys');
      return [...entries.keys()];
    },
  };
}

/**
 * A lock manager with the Web Locks API's semantics for what this store uses
 * (`request` with `mode` and `ifAvailable`, and `query`): requests for a name
 * are granted in the order made, shared ones together, an exclusive one alone,
 * and a lock is released when its callback's promise settles. It coordinates
 * only the code that shares the instance: the store's fallback where the
 * browser has no Web Locks (this tab alone), and in tests one instance shared
 * by two apps stands for two tabs.
 * @returns {{ request: Function, query: Function }}
 */
export function createLocalLockManager() {
  const queues = new Map();
  let serial = 0;
  const queueOf = name => {
    if (!queues.has(name)) queues.set(name, { held: [], pending: [] });
    return queues.get(name);
  };
  const grantable = (queue, entry) => {
    if (entry.mode === 'exclusive') return queue.held.length === 0 && queue.pending[0] === entry;
    if (queue.held.some(each => each.mode === 'exclusive')) return false;
    // Granted in order: a shared request waits behind an exclusive one asked for first.
    const ahead = queue.pending.slice(0, queue.pending.indexOf(entry));
    return !ahead.some(each => each.mode === 'exclusive');
  };
  const run = (queue, entry) => {
    queue.pending.splice(queue.pending.indexOf(entry), 1);
    queue.held.push(entry);
    let outcome;
    try {
      outcome = Promise.resolve(entry.callback({ name: entry.name, mode: entry.mode }));
    } catch (error) {
      outcome = Promise.reject(error);
    }
    // Released first, then settled, as the browser does: whoever waits on the
    // request finds the lock free.
    const release = () => {
      queue.held.splice(queue.held.indexOf(entry), 1);
      pump(queue);
    };
    outcome.then(value => {
      release();
      entry.resolve(value);
    }, error => {
      release();
      entry.reject(error);
    });
  };
  const pump = queue => {
    for (const entry of [...queue.pending]) {
      if (grantable(queue, entry)) run(queue, entry);
    }
  };
  return {
    request(name, options, callback) {
      const settings = typeof options === 'function' ? {} : (options || {});
      const handler = typeof options === 'function' ? options : callback;
      const mode = settings.mode === 'shared' ? 'shared' : 'exclusive';
      const queue = queueOf(name);
      return new Promise((resolve, reject) => {
        const entry = { name, mode, callback: handler, resolve, reject, clientId: `local-${serial += 1}` };
        queue.pending.push(entry);
        if (settings.ifAvailable && !grantable(queue, entry)) {
          queue.pending.splice(queue.pending.indexOf(entry), 1);
          Promise.resolve().then(() => handler(null)).then(resolve, reject);
          return;
        }
        // Granted from a task of its own, as the browser grants a lock.
        Promise.resolve().then(() => pump(queue));
      });
    },
    async query() {
      const held = [];
      const pending = [];
      for (const [name, queue] of queues) {
        for (const entry of queue.held) held.push({ name, mode: entry.mode, clientId: entry.clientId });
        for (const entry of queue.pending) pending.push({ name, mode: entry.mode, clientId: entry.clientId });
      }
      return { held, pending };
    },
  };
}

/**
 * One image pinned by this tab: a shared Web Lock of its own, held while any
 * handle to it is (its place in the live project, a put, a read). While it is
 * held no tab can delete the entry, so what this pin has seen stored
 * (`present`) stays stored. The last handle released ends it, once what was
 * issued under it has settled.
 * @private
 */
class Pin {
  constructor(store, key) {
    this.store = store;
    this.key = key;
    this.count = 0;
    /** Whether the entry is in the store, as seen under this pin: null until looked. */
    this.present = null;
    /** The look or the put under way, a promise. */
    this.storing = null;
    /** Backend operations issued under it, until they settle. */
    this.inflight = new Set();
    this.isGranted = false;
    this.ending = false;
    this.ended = false;
    this._end = null;
    /** Told when the pin ends or is taken again: a sweep waiting on it. */
    this._watchers = [];
    /** Settles once the lock is let go (or was never taken). */
    this.lockSettled = Promise.resolve();
    this.granted = new Promise(resolve => {
      let request;
      try {
        request = store.locks.request(`${STORAGE.RECOVERY_IMAGES_LOCK}:${key}`, { mode: 'shared' }, () => {
          this.isGranted = true;
          resolve(true);
          return new Promise(end => { this._end = end; });
        });
      } catch (error) {
        this._uncoordinated(error, resolve);
        return;
      }
      this.lockSettled = Promise.resolve(request).catch(error => this._uncoordinated(error, resolve));
    });
  }

  /**
   * The lock could not be taken: the pin works for this tab alone, as with no
   * Web Locks (no deletion relies on it: a sweep needs the lock).
   * @private
   */
  _uncoordinated(error, resolve) {
    if (this.isGranted) return;
    console.warn('Browser recovery could not take its storage lock:', error);
    this.isGranted = true;
    resolve(false);
  }

  /** Settles once the pin has ended, or is held again. */
  settled() {
    if (this.ended || (this.count > 0 && !this.ending)) return Promise.resolve();
    return new Promise(resolve => this._watchers.push(resolve));
  }

  /** @private */
  _notify() {
    for (const resolve of this._watchers.splice(0)) resolve();
  }

  /** Track a backend operation so the pin ends only once it has settled. */
  track(promise) {
    this.inflight.add(promise);
    promise.then(() => this.inflight.delete(promise), () => this.inflight.delete(promise));
    return promise;
  }
}

/**
 * The store. One per app: `src/app/recoveryImages.js` drives it.
 */
export class RecoveryImageStore {
  /**
   * @param {Object} [options]
   * @param {Object|null} [options.backend] - The IndexedDB backend by default; null for none
   * @param {Object} [options.locks] - A Web Locks manager; the browser's, else this tab's own
   * @param {boolean} [options.crossWriter] - Whether `locks` reaches every writer sharing the
   *   backend (every tab); only then is an entry ever deleted
   * @param {Function} [options.digest] - bytes → Promise<hex>; WebCrypto's SHA-256 by default
   * @param {Object} [options.limits] - What recovery keeps; `RECOVERY_IMAGE_LIMITS` by default
   */
  constructor({
    backend = createIndexedDBBackend(),
    locks,
    crossWriter,
    digest = globalThis.crypto?.subtle ? sha256Hex : null,
    limits = RECOVERY_IMAGE_LIMITS,
  } = {}) {
    const browserLocks = globalThis.navigator?.locks;
    this.backend = backend ?? null;
    this.locks = locks ?? browserLocks ?? createLocalLockManager();
    this.crossWriter = crossWriter ?? Boolean(!locks && browserLocks);
    this.digest = typeof digest === 'function' ? digest : null;
    this.limits = Object.freeze({ ...RECOVERY_IMAGE_LIMITS, ...(limits || {}) });
    /** Each data URL's key, once hashed: a content hash, so a deletion leaves it true. */
    this._keys = new Map();
    this._hashing = new Map();
    /** This tab's pins, by key. */
    this._pins = new Map();
    /** Every put and read under way, so a clear can wait for them. */
    this._operations = new Set();
    /** Every sweep under way: a clear waits for each before its own. */
    this._sweeps = new Set();
  }

  /** Whether images can be kept at all: a backend and a digest. */
  get available() {
    return Boolean(this.backend && this.digest);
  }

  /** The key of a data URL already hashed, or null. */
  cachedKey(dataURL) {
    return this._keys.get(dataURL) ?? null;
  }

  /** Forget the keys of every data URL not in `dataURLs` (images no longer live). */
  forgetKeysExcept(dataURLs) {
    const keep = new Set(dataURLs);
    for (const dataURL of this._keys.keys()) {
      if (!keep.has(dataURL)) this._keys.delete(dataURL);
    }
  }

  /**
   * The key of a data URL's bytes.
   * @param {string} dataURL
   * @returns {Promise<{ok: boolean, key?: string, reason?: string}>}
   */
  async keyFor(dataURL) {
    const cached = this._keys.get(dataURL);
    if (cached) return { ok: true, key: cached };
    if (!this.digest) return { ok: false, reason: RECOVERY_REASONS.UNAVAILABLE };
    let hashing = this._hashing.get(dataURL);
    if (!hashing) {
      hashing = (async () => `${KEY_PREFIX}${await this.digest(dataURLToBytes(dataURL))}`)();
      this._hashing.set(dataURL, hashing);
    }
    try {
      const key = await hashing;
      this._keys.set(dataURL, key);
      return { ok: true, key };
    } catch (error) {
      console.warn('Browser recovery could not identify an image:', error);
      return { ok: false, reason: RECOVERY_REASONS.UNREADABLE };
    } finally {
      this._hashing.delete(dataURL);
    }
  }

  /**
   * Pin an image: no tab can delete it while a handle is held. Handles are
   * counted; each is released once.
   * @param {string} key
   * @returns {{key: string, release: Function}|null} null with no store
   */
  pin(key) {
    if (!this.available || typeof key !== 'string') return null;
    let pin = this._pins.get(key);
    if (!pin || pin.ended || pin.ending) {
      pin = new Pin(this, key);
      this._pins.set(key, pin);
    }
    pin.count += 1;
    if (pin.count === 1) pin._notify();
    let released = false;
    return {
      key,
      release: () => {
        if (released) return;
        released = true;
        pin.count -= 1;
        // A microtask later, so a handle let go and taken again in the same
        // turn (a revision superseded by the next) keeps the lock.
        if (pin.count <= 0) Promise.resolve().then(() => this._endIfIdle(pin));
      },
    };
  }

  /**
   * Whether `key` is stored, as a pin of this tab has seen it and still holds
   * it: no tab can delete it meanwhile.
   * @returns {boolean}
   */
  isStoredNow(key) {
    const pin = key ? this._pins.get(key) : null;
    return Boolean(pin && !pin.ended && !pin.ending && pin.count > 0 && pin.isGranted && pin.present === true);
  }

  /**
   * Make sure an image is in the store, pinned: looked for under its pin, and
   * put if it is not there. Stored only once its transaction has completed.
   * The caller keeps the returned handle while it relies on the image, and
   * releases it after.
   * @param {{dataURL: string, mimeType: string, width: number, height: number}} image
   * @returns {Promise<{ok: boolean, key?: string, reason?: string, pin: Object|null}>}
   */
  ensureStored(image) {
    // Pinned at once where the key is known, so a handle given up in this
    // same turn hands the lock over rather than letting it go.
    const cached = this.cachedKey(image.dataURL);
    const early = cached ? this.pin(cached) : null;
    const operation = (async () => {
      const keyed = cached ? { ok: true, key: cached } : await this.keyFor(image.dataURL);
      if (!keyed.ok) return { ...keyed, pin: null };
      const handle = early ?? this.pin(keyed.key);
      if (!handle) return { ok: false, key: keyed.key, reason: RECOVERY_REASONS.UNAVAILABLE, pin: null };
      const pin = this._pins.get(keyed.key);
      await pin.granted;
      if (pin.present === true) return { ok: true, key: keyed.key, pin: handle };
      pin.storing ??= this._store(pin, image).finally(() => { pin.storing = null; });
      const result = await pin.storing;
      return { ...result, pin: handle };
    })();
    return this._track(operation);
  }

  /** @private */
  async _store(pin, image) {
    const { key } = pin;
    try {
      const present = await pin.track(this.backend.has(key));
      if (!present) {
        const bytes = dataURLToBytes(image.dataURL);
        await pin.track(this.backend.put({
          key,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          byteLength: bytes.byteLength,
          bytes: bytes.buffer,
        }));
      }
      pin.present = true;
      return { ok: true, key };
    } catch (error) {
      console.warn('Browser recovery could not store an image:', error);
      return { ok: false, key, reason: error?.recoveryReason ?? RECOVERY_REASONS.REFUSED };
    }
  }

  /**
   * Read one entry, pinned, checking it is what its key says: the bytes'
   * length as stored and their digest the key. The caller validates the
   * image itself (`ImageAsset`) and releases the handle once the image is
   * pinned as live.
   * @returns {Promise<{ok: boolean, record?: Object, reason?: string, pin: Object|null}>}
   */
  read(key) {
    const operation = (async () => {
      const handle = this.pin(key);
      if (!handle) return { ok: false, reason: RECOVERY_REASONS.UNAVAILABLE, pin: null };
      const pin = this._pins.get(key);
      await pin.granted;
      const fail = reason => {
        handle.release();
        return { ok: false, reason, pin: null };
      };
      let record;
      try {
        record = await pin.track(this.backend.get(key));
      } catch (error) {
        console.warn('Browser recovery could not read an image:', error);
        return fail(error?.recoveryReason === RECOVERY_REASONS.UNAVAILABLE
          ? RECOVERY_REASONS.MISSING : RECOVERY_REASONS.UNREADABLE);
      }
      if (!record) {
        pin.present = false;
        return fail(RECOVERY_REASONS.MISSING);
      }
      try {
        const buffer = asArrayBuffer(record.bytes);
        if (!buffer || record.key !== key || typeof record.mimeType !== 'string' ||
            Number(record.byteLength) !== buffer.byteLength) {
          return fail(RECOVERY_REASONS.UNREADABLE);
        }
        const digest = `${KEY_PREFIX}${await this.digest(buffer)}`;
        if (digest !== key) return fail(RECOVERY_REASONS.UNREADABLE);
        const dataURL = bytesToDataURL(buffer, record.mimeType);
        this._keys.set(dataURL, key);
        pin.present = true;
        return {
          ok: true,
          pin: handle,
          record: {
            key,
            mimeType: record.mimeType,
            width: Number(record.width),
            height: Number(record.height),
            byteLength: buffer.byteLength,
            dataURL,
          },
        };
      } catch (error) {
        console.warn('Browser recovery could not read an image:', error);
        return fail(RECOVERY_REASONS.UNREADABLE);
      }
    })();
    return this._track(operation);
  }

  /** @private Track a put or read until it settles. */
  _track(operation) {
    this._operations.add(operation);
    operation.finally(() => this._operations.delete(operation));
    return operation;
  }

  /**
   * An operation of the caller's own that a clear must wait for, as it waits
   * for a put or a read: a restore, from its first read until it has let go
   * of every pin it took (Codex, code review round 2, 3).
   * @returns {{end: Function}} Call once it has let go
   */
  beginOperation() {
    let end;
    const operation = new Promise(resolve => { end = resolve; });
    this._track(operation);
    let ended = false;
    return {
      end: () => {
        if (ended) return;
        ended = true;
        end();
      },
    };
  }

  /**
   * Delete every entry no tab pins and no record names: the one sweep that
   * garbage collection and Clear All share. Only where the lock reaches every
   * writer (`crossWriter`). Each entry goes only under its own lock taken
   * exclusive, if that is free at once (no tab pins it), and only if
   * `isProtected(key)`, asked again under that lock, says no record names
   * it; null there (a record that cannot be read or understood) stops the
   * sweep. An entry this tab still pins is left.
   * @param {(key: string) => (boolean|null)} isProtected
   * @returns {Promise<{ok: boolean, deleted: string[], skipped?: string}>}
   */
  sweep(isProtected) {
    if (!this.available || !this.crossWriter) {
      return Promise.resolve({ ok: false, deleted: [], skipped: 'uncoordinated' });
    }
    const sweeping = (async () => {
      const deleted = [];
      let keys;
      try {
        keys = await this.backend.keys();
      } catch (error) {
        console.warn('Browser recovery could not tidy its images:', error);
        return { ok: false, deleted, skipped: 'failed' };
      }
      for (const key of keys) {
        const own = this._pins.get(key);
        if (own && !own.ended) {
          // Relied on here; or let go, and its lock not yet: wait for that.
          if (own.count > 0 && !own.ending) continue;
          await own.settled();
        }
        const again = this._pins.get(key);
        if (again && !again.ended && !again.ending && again.count > 0) continue;
        const before = isProtected(key);
        if (before === null) return { ok: false, deleted, skipped: 'unknown' };
        if (before) continue;
        let outcome;
        try {
          outcome = await this.locks.request(`${STORAGE.RECOVERY_IMAGES_LOCK}:${key}`,
            { mode: 'exclusive', ifAvailable: true }, async lock => {
              if (!lock) return 'pinned';
              const verdict = isProtected(key);
              if (verdict === null) return 'unknown';
              if (verdict) return 'named';
              await this.backend.delete(key);
              return 'deleted';
            });
        } catch (error) {
          console.warn('Browser recovery could not tidy its images:', error);
          return { ok: false, deleted, skipped: 'failed' };
        }
        if (outcome === 'unknown') return { ok: false, deleted, skipped: 'unknown' };
        if (outcome === 'deleted') deleted.push(key);
      }
      return { ok: true, deleted };
    })();
    this._sweeps.add(sweeping);
    sweeping.finally(() => this._sweeps.delete(sweeping));
    return sweeping;
  }

  /** Garbage collection: the sweep. */
  collectGarbage(isProtected) {
    return this.sweep(isProtected);
  }

  /**
   * Clear All's part: once every put, read and restore this tab has under
   * way has settled and let go of its pins (the project being cleared let go
   * of its images first), and every sweep of this tab's already issued has
   * finished its deletions (Codex, code review round 2, 2), the sweep, with
   * the records that remain to protect what they name. So what it reports is
   * so when it reports it. An image another tab still shows stays: it is
   * that tab's live project's.
   * @param {(key: string) => (boolean|null)} isProtected
   * @returns {Promise<{ok: boolean, deleted: string[], skipped?: string}>}
   */
  async clear(isProtected) {
    if (!this.backend) return { ok: true, deleted: [] };
    while (this._operations.size > 0 || this._sweeps.size > 0) {
      await Promise.allSettled([...this._operations, ...this._sweeps]);
      // What those operations' callers let go of is let go a microtask later.
      await Promise.resolve();
    }
    return this.sweep(isProtected);
  }

  /** Whether a sweep is under way. */
  get sweeping() {
    return this._sweeps.size > 0;
  }

  /** Settles once no put, read, restore or sweep of this tab's is under way. */
  async idle() {
    for (let round = 0; round < 20; round += 1) {
      const waits = [...this._operations, ...this._sweeps];
      if (waits.length === 0) return;
      await Promise.allSettled(waits);
    }
  }

  /** @private End a pin no handle keeps, once what it issued has settled. */
  async _endIfIdle(pin) {
    if (pin.ended || pin.ending || pin.count > 0) return;
    while (pin.inflight.size > 0) await Promise.allSettled([...pin.inflight]);
    if (pin.storing) await pin.storing.catch(() => {});
    if (pin.ended || pin.ending || pin.count > 0) return;
    await pin.granted;
    if (pin.ended || pin.ending || pin.count > 0) return;
    // Ending: no handle joins it now (`pin` makes a new one), and a sweep
    // waits until its lock is free.
    pin.ending = true;
    pin._end?.();
    await pin.lockSettled;
    pin.ended = true;
    if (this._pins.get(pin.key) === pin) this._pins.delete(pin.key);
    pin._notify();
  }
}

/**
 * How the app's store is made. A test sets its own before it boots the app
 * (an in-memory backend shared across boots, a lock manager shared by two
 * apps, an injected digest or lower limits), and puts the default back after.
 * @type {(() => RecoveryImageStore)|null}
 */
let storeFactory = null;

/**
 * Make the store for an app: the test's, if one is set, else the browser's.
 * @returns {RecoveryImageStore}
 */
export function createRecoveryImageStore() {
  return storeFactory ? storeFactory() : new RecoveryImageStore();
}

/**
 * Set how the next apps make their store; null for the default.
 * @param {(() => RecoveryImageStore)|null} factory
 */
export function setRecoveryImageStoreFactory(factory) {
  storeFactory = typeof factory === 'function' ? factory : null;
}

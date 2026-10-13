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
 * store and the one recovery record, and an entry no record names is deleted
 * only under an exclusive Web Lock (`STORAGE.RECOVERY_IMAGES_LOCK`). Every
 * put and read holds the same lock shared, through a hold that lasts while a
 * publication needs it, so no deletion, and no Clear All, can run in any tab
 * while another tab is storing or relying on an entry. What a hold has seen
 * stored (`verified`) is trusted only while that hold lasts. With no Web
 * Locks (a browser without them, or a test's jsdom), the store coordinates
 * its own tab only, and so never deletes an unreferenced entry: a leaked
 * entry is better than a lost one (Codex, brief round 2, 13).
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

/**
 * How long a hold takes new publications before it is renewed: a tab editing
 * without pause never keeps another tab's Clear All waiting longer than this
 * and its own debounce.
 */
export const RECOVERY_HOLD_MAX_AGE_MS = 5000;

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
    keys: () => run('readonly', store => store.getAllKeys()).then(keys => (keys || []).map(String)),
    clear: () => run('readwrite', store => store.clear(), 'strict').then(() => undefined),
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
     * @param {'put'|'get'|'delete'|'keys'|'clear'} operation
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
    async keys() {
      await gate('keys');
      fail('keys');
      log.push('keys');
      return [...entries.keys()];
    },
    async clear() {
      await gate('clear');
      fail('clear');
      entries.clear();
      log.push('clear');
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
    outcome.then(entry.resolve, entry.reject).finally(() => {
      queue.held.splice(queue.held.indexOf(entry), 1);
      pump(queue);
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
 * One shared hold of the store's lock: while it lasts no deletion and no
 * clear can run in any tab, so what it has seen stored stays stored. Leases
 * keep it; the last released ends it, once its operations have drained.
 * @private
 */
class Hold {
  constructor(store) {
    this.store = store;
    this.users = 0;
    this.createdAt = store._now();
    /** Keys this hold has seen stored, by its own put or its own listing. */
    this.verified = new Set();
    /** The store's keys as this hold first listed them, a promise. */
    this.present = null;
    /** Puts under way, by key. */
    this.storing = new Map();
    /** Every backend operation issued under this hold, until it settles. */
    this.inflight = new Set();
    /** No new lease joins it. */
    this.closing = false;
    /** A clear was asked for: nothing it saw is trusted, nothing more is put. */
    this.invalidated = false;
    this.ended = false;
    this.isGranted = false;
    this._end = null;
    this.granted = new Promise(resolve => {
      let request;
      try {
        request = store.locks.request(STORAGE.RECOVERY_IMAGES_LOCK, { mode: 'shared' }, () => {
          this.isGranted = true;
          resolve(true);
          return new Promise(end => { this._end = end; });
        });
      } catch (error) {
        this._uncoordinated(error, resolve);
        return;
      }
      Promise.resolve(request).catch(error => this._uncoordinated(error, resolve));
    });
  }

  /**
   * The lock could not be taken: the hold works for this tab alone, as with
   * no Web Locks (no deletion relies on it: `collectGarbage` needs the lock).
   * @private
   */
  _uncoordinated(error, resolve) {
    if (this.isGranted) return;
    console.warn('Browser recovery could not take its storage lock:', error);
    this.isGranted = true;
    resolve(false);
  }

  /** Track a backend operation so the hold ends only once it has settled. */
  track(promise) {
    this.inflight.add(promise);
    promise.then(() => this.inflight.delete(promise), () => this.inflight.delete(promise));
    return promise;
  }

  /** Whether what it has seen stored may be trusted now. */
  get trusted() {
    return this.isGranted && !this.invalidated && !this.ended;
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
   *   backend (every tab); only then are unreferenced entries ever deleted
   * @param {Function} [options.digest] - bytes → Promise<hex>; WebCrypto's SHA-256 by default
   * @param {Object} [options.limits] - What recovery keeps; `RECOVERY_IMAGE_LIMITS` by default
   * @param {number} [options.holdMaxAgeMs]
   * @param {Function} [options.now]
   */
  constructor({
    backend = createIndexedDBBackend(),
    locks,
    crossWriter,
    digest = globalThis.crypto?.subtle ? sha256Hex : null,
    limits = RECOVERY_IMAGE_LIMITS,
    holdMaxAgeMs = RECOVERY_HOLD_MAX_AGE_MS,
    now = () => Date.now(),
  } = {}) {
    const browserLocks = globalThis.navigator?.locks;
    this.backend = backend ?? null;
    this.locks = locks ?? browserLocks ?? createLocalLockManager();
    this.crossWriter = crossWriter ?? Boolean(!locks && browserLocks);
    this.digest = typeof digest === 'function' ? digest : null;
    this.limits = Object.freeze({ ...RECOVERY_IMAGE_LIMITS, ...(limits || {}) });
    this.holdMaxAgeMs = holdMaxAgeMs;
    this._now = now;
    /** Each data URL's key, once hashed: a content hash, so a clear leaves it true. */
    this._keys = new Map();
    this._hashing = new Map();
    this._hold = null;
    this._holds = new Set();
    this._generation = 0;
    this._clearing = null;
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
   * A lease on a shared hold of the store's lock, for one publication or
   * restore: it joins the current hold while that is young, else opens one.
   * @returns {{hold: Hold, release: Function}|null} null with no store
   */
  lease() {
    if (!this.available) return null;
    let hold = this._hold;
    if (!hold || hold.closing || this._now() - hold.createdAt > this.holdMaxAgeMs) {
      if (hold) hold.closing = true;
      hold = new Hold(this);
      this._hold = hold;
      this._holds.add(hold);
    }
    hold.users += 1;
    let released = false;
    return {
      hold,
      release: () => {
        if (released) return;
        released = true;
        hold.users -= 1;
        // A microtask later, so a publication superseded in the same turn
        // hands its hold to the one that replaces it.
        if (hold.users <= 0) Promise.resolve().then(() => this._endIfIdle(hold));
      },
    };
  }

  /**
   * Whether `key` is stored, as `lease`'s hold has seen and still vouches for.
   * @returns {boolean}
   */
  verified(lease, key) {
    return Boolean(lease && key && lease.hold.trusted && lease.hold.verified.has(key));
  }

  /**
   * Make sure an image is in the store under `lease`: listed already, or put.
   * Stored only once its transaction has completed.
   * @param {{hold: Hold}} lease
   * @param {{dataURL: string, mimeType: string, width: number, height: number}} image
   * @returns {Promise<{ok: boolean, key?: string, reason?: string}>}
   */
  async ensureStored(lease, image) {
    if (!lease) return { ok: false, reason: RECOVERY_REASONS.UNAVAILABLE };
    const { hold } = lease;
    const keyed = await this.keyFor(image.dataURL);
    if (!keyed.ok) return keyed;
    const { key } = keyed;
    await hold.granted;
    if (hold.invalidated || hold.ended) return { ok: false, key, reason: RECOVERY_REASONS.CANCELLED };
    if (hold.verified.has(key)) return { ok: true, key };
    let storing = hold.storing.get(key);
    if (!storing) {
      storing = this._store(hold, key, image);
      hold.storing.set(key, storing);
      storing.finally(() => hold.storing.delete(key));
    }
    return storing;
  }

  /** @private */
  async _store(hold, key, image) {
    try {
      const present = await this._present(hold);
      if (hold.invalidated) return { ok: false, key, reason: RECOVERY_REASONS.CANCELLED };
      if (!present.has(key)) {
        const bytes = dataURLToBytes(image.dataURL);
        await hold.track(this.backend.put({
          key,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          byteLength: bytes.byteLength,
          bytes: bytes.buffer,
        }));
        present.add(key);
      }
      // A clear asked for meanwhile removes it once this hold ends.
      if (hold.invalidated) return { ok: false, key, reason: RECOVERY_REASONS.CANCELLED };
      hold.verified.add(key);
      return { ok: true, key };
    } catch (error) {
      console.warn('Browser recovery could not store an image:', error);
      return { ok: false, key, reason: error?.recoveryReason ?? RECOVERY_REASONS.REFUSED };
    }
  }

  /** @private The store's keys as `hold` first listed them. */
  _present(hold) {
    hold.present ??= hold.track(this.backend.keys()).then(keys => new Set(keys));
    return hold.present;
  }

  /**
   * Read one entry under `lease`, checking it is what its key says: the
   * bytes' length as stored and their digest the key. The caller validates
   * the image itself (`ImageAsset`).
   * @returns {Promise<{ok: boolean, record?: Object, reason?: string}>}
   */
  async read(lease, key) {
    if (!lease) return { ok: false, reason: RECOVERY_REASONS.UNAVAILABLE };
    const { hold } = lease;
    await hold.granted;
    if (hold.invalidated) return { ok: false, reason: RECOVERY_REASONS.CANCELLED };
    let record;
    try {
      record = await hold.track(this.backend.get(key));
    } catch (error) {
      console.warn('Browser recovery could not read an image:', error);
      return { ok: false, reason: error?.recoveryReason === RECOVERY_REASONS.UNAVAILABLE
        ? RECOVERY_REASONS.MISSING : RECOVERY_REASONS.UNREADABLE };
    }
    if (!record) return { ok: false, reason: RECOVERY_REASONS.MISSING };
    try {
      const buffer = asArrayBuffer(record.bytes);
      if (!buffer || record.key !== key || typeof record.mimeType !== 'string' ||
          Number(record.byteLength) !== buffer.byteLength) {
        return { ok: false, reason: RECOVERY_REASONS.UNREADABLE };
      }
      const digest = `${KEY_PREFIX}${await this.digest(buffer)}`;
      if (digest !== key) return { ok: false, reason: RECOVERY_REASONS.UNREADABLE };
      const dataURL = bytesToDataURL(buffer, record.mimeType);
      this._keys.set(dataURL, key);
      if (hold.trusted) hold.verified.add(key);
      return {
        ok: true,
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
      return { ok: false, reason: RECOVERY_REASONS.UNREADABLE };
    }
  }

  /**
   * Clear All's part: remove every entry, after every write already issued
   * and before any write asked for after this call. Every hold is
   * invalidated at once, so nothing more is put under it and nothing it saw
   * is trusted; its writes already issued drain, it ends, and the exclusive
   * lock is granted only then, in every tab; a hold opened after this call
   * waits for the clear.
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  clear() {
    if (!this.backend) return Promise.resolve({ ok: true });
    this._generation += 1;
    for (const hold of this._holds) {
      hold.invalidated = true;
      hold.closing = true;
      Promise.resolve().then(() => this._endIfIdle(hold));
    }
    this._hold = null;
    const clearing = (async () => {
      try {
        await this.locks.request(STORAGE.RECOVERY_IMAGES_LOCK, { mode: 'exclusive' }, () => this.backend.clear());
        return { ok: true };
      } catch (error) {
        console.error('Browser recovery could not remove its images:', error);
        return { ok: false, reason: RECOVERY_REASONS.REFUSED };
      }
    })();
    this._clearing = clearing;
    clearing.finally(() => {
      if (this._clearing === clearing) this._clearing = null;
    });
    return clearing;
  }

  /** Whether a clear is still under way. */
  get clearing() {
    return this._clearing !== null;
  }

  /**
   * Delete every entry no record protects. Only where the lock reaches every
   * writer (`crossWriter`), and only while no hold exists anywhere (the lock
   * taken exclusive, if available at once): so no tab is storing an entry or
   * relying on one it has seen. `isProtected(key)` is asked again just before
   * each deletion; it answers true, false, or null when a record that may
   * protect it cannot be read or understood, and then nothing more is deleted.
   * @param {(key: string) => (boolean|null)} isProtected
   * @returns {Promise<{ok: boolean, deleted: string[], skipped?: string}>}
   */
  async collectGarbage(isProtected) {
    if (!this.available || !this.crossWriter) return { ok: false, deleted: [], skipped: 'uncoordinated' };
    const generation = this._generation;
    try {
      return await this.locks.request(STORAGE.RECOVERY_IMAGES_LOCK, { mode: 'exclusive', ifAvailable: true },
        async lock => {
          if (!lock) return { ok: false, deleted: [], skipped: 'busy' };
          const deleted = [];
          const keys = await this.backend.keys();
          for (const key of keys) {
            if (generation !== this._generation) return { ok: false, deleted, skipped: 'cleared' };
            const verdict = isProtected(key);
            if (verdict === null) return { ok: false, deleted, skipped: 'unknown' };
            if (verdict) continue;
            await this.backend.delete(key);
            deleted.push(key);
          }
          return { ok: true, deleted };
        });
    } catch (error) {
      console.warn('Browser recovery could not tidy its images:', error);
      return { ok: false, deleted: [], skipped: 'failed' };
    }
  }

  /** @private End a hold no lease keeps, once what it issued has settled. */
  async _endIfIdle(hold) {
    if (hold.ended || (hold.users > 0 && !hold.invalidated)) return;
    hold.closing = true;
    if (this._hold === hold) this._hold = null;
    while (hold.inflight.size > 0) await Promise.allSettled([...hold.inflight]);
    if (hold.ended || (hold.users > 0 && !hold.invalidated)) return;
    await hold.granted;
    if (hold.ended) return;
    hold.ended = true;
    this._holds.delete(hold);
    hold._end?.();
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

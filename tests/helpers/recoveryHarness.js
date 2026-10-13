/**
 * The browser around browser recovery's images (DEF-98), for tests.
 *
 * jsdom has no IndexedDB and no Web Locks, so the app's image store is made
 * from parts a test owns and shares across boots: an in-memory backend that
 * stands for the browser's IndexedDB (one per test, so a second boot finds
 * what the first stored), one lock manager standing for the browser's Web
 * Locks (two apps sharing it are two tabs), Node's SHA-256 as the digest, and
 * the limits the test chooses. `localStorage` is a stateful map. The app is
 * booted with these through the store factory before its start-up, whose
 * restore reads the store; the factory is put back at once.
 *
 * What only a real browser can show stays with the lead's Chromium check:
 * IndexedDB transactions, the quota, `pagehide` and Web Locks themselves.
 */

import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { bootApp, retireApp, tipSeen } from './bootApp.js';
import {
  RecoveryImageStore,
  createLocalLockManager,
  createMemoryRecoveryBackend,
  setRecoveryImageStoreFactory,
} from '../../src/services/RecoveryImageStore.js';
import { recoveryImagesIdle } from '../../src/app/recoveryImages.js';

/** Node's SHA-256, hex: the digest every test store uses (jsdom's WebCrypto is Node's too). */
export async function nodeDigest(bytes) {
  return createHash('sha256').update(Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes))
    .digest('hex');
}

/**
 * The shared parts: one backend, one lock manager, one `localStorage`.
 * @param {{limits?: Object, crossWriter?: boolean}} [options]
 */
export function recoveryEnvironment({ limits = undefined, crossWriter = true } = {}) {
  const backend = createMemoryRecoveryBackend();
  const locks = createLocalLockManager();
  const storage = useStatefulStorage();
  return {
    backend,
    locks,
    storage,
    limits,
    makeStore(overrides = {}) {
      return new RecoveryImageStore({ backend, locks, crossWriter, digest: nodeDigest, limits: this.limits, ...overrides });
    },
  };
}

/**
 * `localStorage` as a map the test can read, with `length` and `key` as the
 * browser has them, and the start's tip seen.
 * @returns {Map<string, string>}
 */
export function useStatefulStorage() {
  // The start's tip and welcome seen: each would take the slot or focus mid-test.
  const store = new Map([['routePlotter_previewTipDismissed', 'true'], ['routePlotter_splashShown', 'true']]);
  localStorage.getItem.mockImplementation(tipSeen(key => (store.has(key) ? store.get(key) : null)));
  localStorage.setItem.mockImplementation((key, value) => { store.set(key, String(value)); });
  localStorage.removeItem.mockImplementation(key => { store.delete(key); });
  Object.defineProperty(localStorage, 'length', { configurable: true, get: () => store.size });
  localStorage.key = index => [...store.keys()][index] ?? null;
  return store;
}

/** Put `localStorage` back as the setup has it. */
export function releaseStatefulStorage() {
  localStorage.getItem.mockImplementation(() => null);
  localStorage.setItem.mockImplementation(() => {});
  localStorage.removeItem.mockImplementation(() => {});
  delete localStorage.length;
  delete localStorage.key;
}

/**
 * Boot an app whose image store is made from `environment`'s parts.
 * @param {Object} environment - From `recoveryEnvironment`
 * @param {Object} [storeOverrides] - Passed to the store (a digest, lower limits)
 */
export async function bootWithRecovery(environment, storeOverrides = {}) {
  setRecoveryImageStoreFactory(() => environment.makeStore(storeOverrides));
  try {
    const app = await bootApp();
    await app.ready;
    return app;
  } finally {
    setRecoveryImageStoreFactory(null);
  }
}

/**
 * Write the app's recovery record as its debounce would, once its images
 * are stored, and wait for what follows it (the store's tidy).
 */
export async function writeRecovery(app) {
  await recoveryImagesIdle(app);
  app.storageService.flushAutoSave();
  await recoveryImagesIdle(app);
}

/** Retire an app once its recovery work has settled: a reload. */
export async function closeApp(app) {
  await recoveryImagesIdle(app);
  app.storageService.cancelAutoSave();
  retireApp(app);
}

/** The recovery record as written, parsed. */
export function recoveryRecord(storage) {
  const text = storage.get('routePlotter_autosave');
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Image fixtures

function base64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function uint32(value) {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

/**
 * A PNG data URL of the given dimensions and at least `bytes` long: the
 * signature, an IHDR carrying the dimensions, a filler chunk carrying `tag`
 * (so each fixture's bytes, and so its key, are its own), and IEND. Only
 * `decodeByHeader` decodes it to those dimensions.
 */
export function pngDataURL({ width = 4, height = 3, tag = 'fixture', bytes = 0 } = {}) {
  const tagBytes = [...Buffer.from(String(tag))];
  const header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    ...uint32(13), ...Buffer.from('IHDR'), ...uint32(width), ...uint32(height), 8, 6, 0, 0, 0, 0, 0, 0, 0];
  const fixed = header.length + 12 + tagBytes.length + 12;
  const filler = Math.max(0, bytes - fixed);
  const text = [...uint32(tagBytes.length + filler), ...Buffer.from('tEXt'), ...tagBytes,
    ...new Array(filler).fill(0x20), 0, 0, 0, 0];
  const end = [...uint32(0), ...Buffer.from('IEND'), 0xAE, 0x42, 0x60, 0x82];
  return `data:image/png;base64,${base64([...header, ...text, ...end])}`;
}

/** A JPEG data URL: its signature and `tag`. */
export function jpegDataURL(tag = 'jpeg') {
  return `data:image/jpeg;base64,${base64([0xFF, 0xD8, 0xFF, 0xE0, ...Buffer.from(String(tag)), 0xFF, 0xD9])}`;
}

/** A WebP data URL: its RIFF and WEBP signature and `tag`. */
export function webpDataURL(tag = 'webp') {
  const body = [...Buffer.from('WEBPVP8 '), ...Buffer.from(String(tag))];
  return `data:image/webp;base64,${base64([...Buffer.from('RIFF'), ...uint32(body.length).reverse(), ...body])}`;
}

/** A File of a data URL's bytes, as a picker hands one over. */
export function fileOf(dataURL, name) {
  const [, mimeType, payload] = /^data:([^;]+);base64,(.*)$/.exec(dataURL);
  return new File([Buffer.from(payload, 'base64')], name, { type: mimeType });
}

/**
 * Decode images as their headers say: a PNG to its IHDR's dimensions, a
 * JPEG or WebP to 100 × 100 as the setup's decoder has it, anything else
 * fails to load. The setup's decoder makes every image 100 × 100, which a
 * test of dimensions or of corruption cannot use.
 */
export function decodeByHeader() {
  class HeaderImage {
    constructor() {
      this.width = 0;
      this.height = 0;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
    }

    set src(value) {
      this._src = value;
      setTimeout(() => {
        const match = /^data:([^;]+);base64,(.*)$/.exec(String(value));
        const bytes = match ? Buffer.from(match[2], 'base64') : Buffer.alloc(0);
        let size = null;
        if (bytes.length >= 24 && bytes[0] === 0x89 && bytes.toString('latin1', 12, 16) === 'IHDR') {
          size = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
        } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
          size = [100, 100];
        } else if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
          size = [100, 100];
        }
        if (!size) {
          this.onerror?.(new Error('undecodable'));
          return;
        }
        [this.width, this.height] = size;
        [this.naturalWidth, this.naturalHeight] = size;
        this.onload?.();
      }, 0);
    }

    get src() {
      return this._src;
    }
  }
  vi.stubGlobal('Image', HeaderImage);
}

/**
 * DEF-98 — the image store browser recovery keeps its images in
 * (`src/services/RecoveryImageStore.js`), on its own: the lock manager that
 * stands in for Web Locks, what is stored and when, the order of a clear
 * among the writes around it, and when an unreferenced entry may go.
 */

import { describe, expect, test } from 'vitest';
import {
  RecoveryImageStore,
  createIndexedDBBackend,
  createLocalLockManager,
  createMemoryRecoveryBackend,
  dataURLToBytes,
} from '../src/services/RecoveryImageStore.js';
import { allowConsole } from './helpers/consoleGuard.js';
import { nodeDigest, pngDataURL } from './helpers/recoveryHarness.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function image(tag, size = {}) {
  const dataURL = pngDataURL({ tag, ...size });
  return { dataURL, mimeType: 'image/png', width: size.width ?? 4, height: size.height ?? 3 };
}

function storeWith(options = {}) {
  const backend = options.backend ?? createMemoryRecoveryBackend();
  const locks = options.locks ?? createLocalLockManager();
  const store = new RecoveryImageStore({ backend, locks, crossWriter: true, digest: nodeDigest, ...options });
  return { store, backend, locks };
}

describe('the lock manager stands in for Web Locks (DEF-98)', () => {
  test('shared locks are held together; an exclusive one waits for them, and a shared one asked for after it waits for it', async () => {
    const locks = createLocalLockManager();
    const order = [];
    let endFirst;
    let endSecond;
    const first = locks.request('l', { mode: 'shared' }, () => {
      order.push('shared 1');
      return new Promise(resolve => { endFirst = resolve; });
    });
    const second = locks.request('l', { mode: 'shared' }, () => {
      order.push('shared 2');
      return new Promise(resolve => { endSecond = resolve; });
    });
    const exclusive = locks.request('l', { mode: 'exclusive' }, () => { order.push('exclusive'); });
    const late = locks.request('l', { mode: 'shared' }, () => { order.push('shared 3'); });
    await tick();
    expect(order).toEqual(['shared 1', 'shared 2']);
    const { held, pending } = await locks.query();
    expect(held.map(lock => lock.mode)).toEqual(['shared', 'shared']);
    expect(pending.map(lock => lock.mode)).toEqual(['exclusive', 'shared']);

    endFirst();
    await tick();
    expect(order).toEqual(['shared 1', 'shared 2']);
    endSecond();
    await Promise.all([first, second, exclusive, late]);
    expect(order).toEqual(['shared 1', 'shared 2', 'exclusive', 'shared 3']);
  });

  test('ifAvailable is granted only at once, else handed null', async () => {
    const locks = createLocalLockManager();
    let end;
    locks.request('l', { mode: 'shared' }, () => new Promise(resolve => { end = resolve; }));
    await tick();
    expect(await locks.request('l', { mode: 'exclusive', ifAvailable: true }, lock => lock)).toBeNull();
    end();
    await tick();
    expect(await locks.request('l', { mode: 'exclusive', ifAvailable: true }, lock => lock?.mode)).toBe('exclusive');
  });
});

describe('the image store (DEF-98)', () => {
  test('without IndexedDB there is no backend, and the store says it cannot keep images', () => {
    expect(createIndexedDBBackend({ factory: undefined })).toBeNull();
    const store = new RecoveryImageStore({ backend: null, digest: nodeDigest });
    expect(store.available).toBe(false);
    expect(store.pin('sha256-x')).toBeNull();
  });

  test('an entry is keyed by the SHA-256 of its bytes, and holds its type, dimensions, length and bytes, no name', async () => {
    const { store, backend } = storeWith();
    const fixture = image('keyed', { width: 7, height: 5 });
    const result = await store.ensureStored(fixture);
    result.pin.release();

    expect(result.ok).toBe(true);
    expect(result.key).toBe(`sha256-${await nodeDigest(dataURLToBytes(fixture.dataURL))}`);
    const entry = backend.entries.get(result.key);
    expect(Object.keys(entry).sort()).toEqual(['byteLength', 'bytes', 'height', 'key', 'mimeType', 'width']);
    expect(entry).toMatchObject({ mimeType: 'image/png', width: 7, height: 5 });
    expect(entry.byteLength).toBe(dataURLToBytes(fixture.dataURL).byteLength);
  });

  test('an image is stored only once its put has completed, and only while it is pinned', async () => {
    const { store, backend } = storeWith();
    const fixture = image('slow');
    const releasePut = backend.pause('put');
    const storing = store.ensureStored(fixture);
    const { key } = await store.keyFor(fixture.dataURL);
    await tick();
    expect(store.isStoredNow(key)).toBe(false);
    releasePut();
    const result = await storing;
    expect(result.ok).toBe(true);
    expect(store.isStoredNow(key)).toBe(true);
    result.pin.release();
    await tick();
    await tick();
    // Let go, it is no longer this tab's to vouch for.
    expect(store.isStoredNow(key)).toBe(false);
  });

  test('a refused put resolves to a reason and never throws', async () => {
    allowConsole(/could not store an image/);
    const { store, backend } = storeWith();
    backend.failWhen('put', () => new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    await expect(store.ensureStored(image('refused'))).resolves.toMatchObject({ ok: false, reason: 'refused' });
  });

  test('a clear waits for the puts issued before it, then deletes what no record names and no tab pins', async () => {
    const { store, backend } = storeWith();
    const releasePut = backend.pause('put');
    const first = store.ensureStored(image('before'));
    await tick();
    const clearing = first.then(result => {
      // The project being cleared lets go of its image as its put lands.
      result.pin.release();
      return result;
    });
    const cleared = store.clear(() => false);
    await tick();
    releasePut();
    const [firstResult, outcome] = await Promise.all([clearing, cleared]);
    expect(firstResult.ok).toBe(true);
    expect(outcome).toEqual({ ok: true, deleted: [firstResult.key] });
    expect(backend.log).toEqual([`has ${firstResult.key}`, `put ${firstResult.key}`, 'keys', `delete ${firstResult.key}`]);
    // A put asked for after the clear lands, and stays.
    const second = await store.ensureStored(image('after'));
    expect(second.ok).toBe(true);
    expect([...backend.entries.keys()]).toEqual([second.key]);
  });

  test('a clear that fails says so', async () => {
    allowConsole(/could not tidy its images/);
    const { store, backend } = storeWith();
    const stored = await store.ensureStored(image('stays'));
    stored.pin.release();
    backend.failWhen('delete', () => new Error('disk gone'));
    await expect(store.clear(() => false)).resolves.toMatchObject({ ok: false, skipped: 'failed' });
    backend.failWhen('delete', null);
    backend.failWhen('keys', () => new Error('disk gone'));
    await expect(store.clear(() => false)).resolves.toMatchObject({ ok: false, skipped: 'failed' });
    expect(backend.entries.has(stored.key)).toBe(true);
  });

  test('an image a tab pins is deleted by no tab, and one no tab pins only where the lock reaches every writer', async () => {
    const backend = createMemoryRecoveryBackend();
    const locks = createLocalLockManager();
    const tabA = new RecoveryImageStore({ backend, locks, crossWriter: true, digest: nodeDigest });
    const kept = await tabA.ensureStored(image('kept'));
    const orphan = await tabA.ensureStored(image('orphan'));
    orphan.pin.release();
    await tick();
    await tick();

    // Tab B sees tab A's pin on the image A still shows, and leaves it.
    const tabB = new RecoveryImageStore({ backend, locks, crossWriter: true, digest: nodeDigest });
    const asked = [];
    const result = await tabB.collectGarbage(key => {
      asked.push(key);
      return false;
    });
    expect(result).toEqual({ ok: true, deleted: [orphan.key] });
    expect([...backend.entries.keys()]).toEqual([kept.key]);
    // Where the lock reaches only this tab, nothing is ever deleted.
    kept.pin.release();
    await tick();
    await tick();
    const alone = new RecoveryImageStore({ backend, crossWriter: false, digest: nodeDigest });
    expect(await alone.collectGarbage(() => false)).toMatchObject({ ok: false, skipped: 'uncoordinated' });
    expect([...backend.entries.keys()]).toEqual([kept.key]);
  });

  test('a record that names an entry protects it, asked again under the entry\'s own lock; one that cannot be understood stops every deletion', async () => {
    const { store, backend } = storeWith();
    const one = await store.ensureStored(image('one'));
    const two = await store.ensureStored(image('two'));
    one.pin.release();
    two.pin.release();
    await tick();
    await tick();
    expect(await store.collectGarbage(() => null)).toMatchObject({ ok: false, skipped: 'unknown', deleted: [] });
    expect(backend.entries.size).toBe(2);
    // Named when asked under the lock, though not before it: left.
    const asked = new Map();
    const result = await store.collectGarbage(key => {
      asked.set(key, (asked.get(key) || 0) + 1);
      return key === one.key && asked.get(key) > 1;
    });
    expect(result.deleted).toEqual([two.key]);
    expect([...backend.entries.keys()]).toEqual([one.key]);
  });

  test('a read checks the entry is what its key says: its byte length and its digest', async () => {
    allowConsole(/could not read an image/);
    const { store, backend } = storeWith();
    const good = await store.ensureStored(image('good'));
    const lengthWrong = await store.ensureStored(image('length'));
    const digestWrong = await store.ensureStored(image('digest'));
    backend.entries.get(lengthWrong.key).byteLength += 1;
    new Uint8Array(backend.entries.get(digestWrong.key).bytes)[30] ^= 0xFF;

    const read = await store.read(good.key);
    expect(read.record).toMatchObject({ mimeType: 'image/png', width: 4, height: 3 });
    read.pin.release();
    expect(await store.read(lengthWrong.key)).toMatchObject({ ok: false, reason: 'unreadable' });
    expect(await store.read(digestWrong.key)).toMatchObject({ ok: false, reason: 'unreadable' });
    expect(await store.read(`sha256-${'0'.repeat(64)}`)).toMatchObject({ ok: false, reason: 'missing' });
    backend.failWhen('get', () => new Error('read failed'));
    expect(await store.read(good.key)).toMatchObject({ ok: false, reason: 'unreadable' });
  });
});

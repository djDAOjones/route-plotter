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
    expect(store.lease()).toBeNull();
  });

  test('an entry is keyed by the SHA-256 of its bytes, and holds its type, dimensions, length and bytes, no name', async () => {
    const { store, backend } = storeWith();
    const fixture = image('keyed', { width: 7, height: 5 });
    const lease = store.lease();
    const result = await store.ensureStored(lease, fixture);
    lease.release();

    expect(result.ok).toBe(true);
    expect(result.key).toBe(`sha256-${await nodeDigest(dataURLToBytes(fixture.dataURL))}`);
    const entry = backend.entries.get(result.key);
    expect(Object.keys(entry).sort()).toEqual(['byteLength', 'bytes', 'height', 'key', 'mimeType', 'width']);
    expect(entry).toMatchObject({ mimeType: 'image/png', width: 7, height: 5 });
    expect(entry.byteLength).toBe(dataURLToBytes(fixture.dataURL).byteLength);
  });

  test('an image is stored only once its put has completed', async () => {
    const { store, backend } = storeWith();
    const fixture = image('slow');
    const releasePut = backend.pause('put');
    const lease = store.lease();
    const storing = store.ensureStored(lease, fixture);
    const { key } = await store.keyFor(fixture.dataURL);
    await tick();
    expect(store.verified(lease, key)).toBe(false);
    releasePut();
    expect((await storing).ok).toBe(true);
    expect(store.verified(lease, key)).toBe(true);
    lease.release();
  });

  test('a refused put resolves to a reason and never throws', async () => {
    allowConsole(/could not store an image/);
    const { store, backend } = storeWith();
    backend.failWhen('put', () => new DOMException('The quota has been exceeded.', 'QuotaExceededError'));
    const lease = store.lease();
    await expect(store.ensureStored(lease, image('refused'))).resolves.toMatchObject({ ok: false, reason: 'refused' });
    lease.release();
  });

  test('a clear is ordered after the puts issued before it and before those asked for after it; nothing it removes is trusted', async () => {
    const { store, backend } = storeWith();
    const releasePut = backend.pause('put');
    const before = store.lease();
    const first = store.ensureStored(before, image('before'));
    await tick();
    const clearing = store.clear();
    const after = store.lease();
    const second = store.ensureStored(after, image('after'));
    await tick();
    releasePut();
    const [firstResult, cleared, secondResult] = await Promise.all([first, clearing, second]);
    before.release();
    after.release();

    expect(firstResult).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(cleared).toEqual({ ok: true });
    expect(secondResult.ok).toBe(true);
    expect(backend.log).toEqual([
      'keys', `put ${firstResult.key}`, 'clear', 'keys', `put ${secondResult.key}`,
    ]);
    expect([...backend.entries.keys()]).toEqual([secondResult.key]);
  });

  test('a clear that fails says so', async () => {
    allowConsole(/could not remove its images/);
    const { store, backend } = storeWith();
    backend.failWhen('clear', () => new Error('disk gone'));
    await expect(store.clear()).resolves.toMatchObject({ ok: false });
  });

  test('an unreferenced entry is deleted only where the lock reaches every writer, and only while no hold exists', async () => {
    const backend = createMemoryRecoveryBackend();
    const locks = createLocalLockManager();
    const writer = new RecoveryImageStore({ backend, locks, crossWriter: true, digest: nodeDigest });
    const lease = writer.lease();
    const kept = await writer.ensureStored(lease, image('kept'));
    const orphan = await writer.ensureStored(lease, image('orphan'));

    // A tab of its own sees the store's lock: no deletion while a hold lasts.
    const other = new RecoveryImageStore({ backend, locks, crossWriter: true, digest: nodeDigest });
    expect(await other.collectGarbage(() => false)).toMatchObject({ ok: false, skipped: 'busy' });
    // Where the lock reaches only this tab, nothing is ever deleted.
    const alone = new RecoveryImageStore({ backend, crossWriter: false, digest: nodeDigest });
    expect(await alone.collectGarbage(() => false)).toMatchObject({ ok: false, skipped: 'uncoordinated' });

    lease.release();
    await tick();
    await tick();
    const asked = [];
    const result = await other.collectGarbage(key => {
      asked.push(key);
      return key === kept.key;
    });
    expect(result).toEqual({ ok: true, deleted: [orphan.key] });
    expect(asked.sort()).toEqual([kept.key, orphan.key].sort());
    expect([...backend.entries.keys()]).toEqual([kept.key]);
  });

  test('a record that cannot be read or understood stops every deletion', async () => {
    const { store, backend } = storeWith();
    const lease = store.lease();
    await store.ensureStored(lease, image('one'));
    await store.ensureStored(lease, image('two'));
    lease.release();
    await tick();
    await tick();
    expect(await store.collectGarbage(() => null)).toMatchObject({ ok: false, skipped: 'unknown', deleted: [] });
    expect(backend.entries.size).toBe(2);
  });

  test('a read checks the entry is what its key says: its byte length and its digest', async () => {
    allowConsole(/could not read an image/);
    const { store, backend } = storeWith();
    const lease = store.lease();
    const good = await store.ensureStored(lease, image('good'));
    const lengthWrong = await store.ensureStored(lease, image('length'));
    const digestWrong = await store.ensureStored(lease, image('digest'));
    backend.entries.get(lengthWrong.key).byteLength += 1;
    new Uint8Array(backend.entries.get(digestWrong.key).bytes)[30] ^= 0xFF;

    expect((await store.read(lease, good.key)).record).toMatchObject({ mimeType: 'image/png', width: 4, height: 3 });
    expect(await store.read(lease, lengthWrong.key)).toMatchObject({ ok: false, reason: 'unreadable' });
    expect(await store.read(lease, digestWrong.key)).toMatchObject({ ok: false, reason: 'unreadable' });
    expect(await store.read(lease, `sha256-${'0'.repeat(64)}`)).toMatchObject({ ok: false, reason: 'missing' });
    backend.failWhen('get', () => new Error('read failed'));
    expect(await store.read(lease, good.key)).toMatchObject({ ok: false, reason: 'unreadable' });
    lease.release();
  });
});

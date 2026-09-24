import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from './db';
import { DEFAULT_DOC_ID, LEGACY_DOC_KEY, LEGACY_UPDATED_KEY, migrateFromLocalStorage } from './migrate';

function memoryStorage(init: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    }
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.closeDb();
  globalThis.indexedDB = new IDBFactory();
});

describe('migrateFromLocalStorage', () => {
  it('does nothing without a legacy document', async () => {
    expect(await migrateFromLocalStorage(memoryStorage())).toBe('nothing-to-migrate');
    expect(await db.getDocument(DEFAULT_DOC_ID)).toBeUndefined();
  });

  it('moves the legacy document into IndexedDB and removes the key', async () => {
    const storage = memoryStorage({ [LEGACY_DOC_KEY]: '<p>Manuskript</p>' });
    expect(await migrateFromLocalStorage(storage)).toBe('migrated');
    expect((await db.getDocument(DEFAULT_DOC_ID))?.html).toBe('<p>Manuskript</p>');
    expect(storage.getItem(LEGACY_DOC_KEY)).toBeNull();
  });

  it('is a no-op the second time', async () => {
    const storage = memoryStorage({ [LEGACY_DOC_KEY]: '<p>x</p>' });
    await migrateFromLocalStorage(storage);
    const before = await db.getDocumentMeta(DEFAULT_DOC_ID);
    expect(await migrateFromLocalStorage(storage)).toBe('nothing-to-migrate');
    expect(await db.getDocumentMeta(DEFAULT_DOC_ID)).toEqual(before);
  });

  it('keeps localStorage and discards the unverified copy when the read-back differs', async () => {
    const storage = memoryStorage({ [LEGACY_DOC_KEY]: '<p>original</p>' });
    vi.spyOn(db, 'getDocument').mockResolvedValue({ id: DEFAULT_DOC_ID, html: '<p>corrupted</p>' });
    expect(await migrateFromLocalStorage(storage)).toBe('failed');
    expect(storage.getItem(LEGACY_DOC_KEY)).toBe('<p>original</p>');
    vi.restoreAllMocks();
    expect(await db.getDocument(DEFAULT_DOC_ID)).toBeUndefined();
  });

  it('keeps localStorage when the IndexedDB write fails', async () => {
    const storage = memoryStorage({ [LEGACY_DOC_KEY]: '<p>original</p>' });
    vi.spyOn(db, 'putDocument').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    expect(await migrateFromLocalStorage(storage)).toBe('failed');
    expect(storage.getItem(LEGACY_DOC_KEY)).toBe('<p>original</p>');
  });

  it('leaves an older legacy copy alone when IndexedDB already has the document', async () => {
    await db.putDocument({ id: DEFAULT_DOC_ID, title: 'Untitled', titleManual: false, createdAt: 1, updatedAt: 500 }, '<p>idb</p>');
    const storage = memoryStorage({ [LEGACY_DOC_KEY]: '<p>stale</p>' });
    expect(await migrateFromLocalStorage(storage)).toBe('already-migrated');
    expect((await db.getDocument(DEFAULT_DOC_ID))?.html).toBe('<p>idb</p>');
    expect(storage.getItem(LEGACY_DOC_KEY)).toBe('<p>stale</p>');
  });

  it('takes a newer copy written by a localStorage-fallback session', async () => {
    await db.putDocument({ id: DEFAULT_DOC_ID, title: 'Untitled', titleManual: false, createdAt: 1, updatedAt: 500 }, '<p>idb</p>');
    const storage = memoryStorage({ [LEGACY_DOC_KEY]: '<p>newer</p>', [LEGACY_UPDATED_KEY]: '900' });
    expect(await migrateFromLocalStorage(storage)).toBe('migrated');
    expect((await db.getDocument(DEFAULT_DOC_ID))?.html).toBe('<p>newer</p>');
    expect((await db.getDocumentMeta(DEFAULT_DOC_ID))?.createdAt).toBe(1);
    expect(storage.getItem(LEGACY_DOC_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_UPDATED_KEY)).toBeNull();
  });
});

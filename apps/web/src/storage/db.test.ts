import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, deleteDocument, getDocument, getDocumentMeta, isAvailable, listDocumentMeta, putDocument, type DocMeta } from './db';

function meta(id: string, updatedAt: number): DocMeta {
  return { id, title: id, titleManual: false, createdAt: 1, updatedAt };
}

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
});

describe('db', () => {
  it('reports IndexedDB as available', async () => {
    expect(await isAvailable()).toBe(true);
  });

  it('round-trips content and metadata', async () => {
    await putDocument(meta('a', 10), '<p>Hallo</p>');
    expect(await getDocument('a')).toEqual({ id: 'a', html: '<p>Hallo</p>' });
    expect(await getDocumentMeta('a')).toEqual(meta('a', 10));
  });

  it('stores content far past the 5 MB localStorage ceiling', async () => {
    const big = `<p><img src="data:image/png;base64,${'A'.repeat(12 * 1024 * 1024)}"></p>`;
    await putDocument(meta('big', 1), big);
    expect((await getDocument('big'))?.html.length).toBe(big.length);
  });

  it('lists metadata most recently updated first', async () => {
    await putDocument(meta('old', 1), '');
    await putDocument(meta('new', 3), '');
    await putDocument(meta('mid', 2), '');
    expect((await listDocumentMeta()).map((m) => m.id)).toEqual(['new', 'mid', 'old']);
  });

  it('deletes from both stores', async () => {
    await putDocument(meta('a', 1), '<p>x</p>');
    await deleteDocument('a');
    expect(await getDocument('a')).toBeUndefined();
    expect(await getDocumentMeta('a')).toBeUndefined();
  });

  it('writes content and metadata atomically', async () => {
    await putDocument(meta('a', 1), '<p>before</p>');
    // A function can't be structured-cloned: the metadata put throws after the
    // content put was already queued. Neither may land.
    const broken = { ...meta('a', 2), bad: () => {} } as unknown as DocMeta;
    await expect(putDocument(broken, '<p>after</p>')).rejects.toThrow();
    expect(await getDocument('a')).toEqual({ id: 'a', html: '<p>before</p>' });
    expect((await getDocumentMeta('a'))?.updatedAt).toBe(1);
  });
});

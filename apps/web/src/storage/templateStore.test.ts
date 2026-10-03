import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { blobSrc, extractBlobIds } from './blobRefs';
import { closeDb, deleteDocument, getBlob, getDocument, listBlobIds, listTemplates, openDb, putBlobs, putDocument, templateBlobOwner } from './db';
import { deleteOwnTemplate, htmlForDocument, loadOwnTemplates, ownTemplates, renameOwnTemplate, saveOwnTemplate } from './templateStore';

const meta = (id: string) => ({ id, title: id, titleManual: false, createdAt: 1, updatedAt: 1 });
const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => ((r.onsuccess = () => res(r.result)), (r.onerror = () => rej(r.error))));

beforeEach(async () => {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
  ownTemplates.set([]);
});

describe('database version 2', () => {
  it('upgrades a version-1 database with data in it, keeping documents and images', async () => {
    // Exactly what version 1 created, filled like a real user's database.
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('glossly', 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('documents', { keyPath: 'id' });
        db.createObjectStore('documentMeta', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        db.createObjectStore('blobs', { keyPath: 'id' }).createIndex('by-doc', 'docId');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = v1.transaction(['documents', 'documentMeta', 'blobs'], 'readwrite');
    tx.objectStore('documents').put({ id: 'd1', html: '<p>Roman</p>' });
    tx.objectStore('documentMeta').put(meta('d1'));
    tx.objectStore('blobs').put({ id: 'b1', docId: 'd1', blob: new Blob(['png']) });
    await new Promise((r) => (tx.oncomplete = r));
    v1.close();

    const db = await openDb();
    expect(db.version).toBe(2);
    for (const store of ['blobs', 'documentMeta', 'documents', 'templates']) expect(db.objectStoreNames.contains(store)).toBe(true);
    expect(await getDocument('d1')).toEqual({ id: 'd1', html: '<p>Roman</p>' });
    expect(await listBlobIds('d1')).toEqual(['b1']);
    expect(await req(db.transaction('documentMeta').objectStore('documentMeta').get('d1'))).toEqual(meta('d1'));
    expect(await listTemplates()).toEqual([]);
  });
});

describe('own templates', () => {
  async function docWithImage() {
    await putDocument(meta('source'), `<p>Gerüst</p><img src="${blobSrc('img1')}">`);
    await putBlobs([{ id: 'img1', docId: 'source', blob: new Blob(['bytes']) }]);
    return `<p>Gerüst</p><img src="${blobSrc('img1')}">`;
  }

  it('keeps its images when the source document is deleted', async () => {
    const template = await saveOwnTemplate('Wochenbericht', await docWithImage());
    const [copy] = extractBlobIds(template.html);
    expect(copy).not.toBe('img1');
    expect((await getBlob(copy))?.docId).toBe(templateBlobOwner(template.id));

    await deleteDocument('source');
    expect(await getBlob('img1')).toBeUndefined();
    expect(await getBlob(copy)).toBeDefined();
  });

  it('gives a document made from it image copies that document owns', async () => {
    const template = await saveOwnTemplate('Wochenbericht', await docWithImage());
    const html = await htmlForDocument(template, 'new-doc');
    const [own] = extractBlobIds(html);
    expect((await getBlob(own))?.docId).toBe('new-doc');

    // Deleting the template leaves the document's images alone.
    await deleteOwnTemplate(template.id);
    expect(await listBlobIds(templateBlobOwner(template.id))).toEqual([]);
    expect(await getBlob(own)).toBeDefined();
  });

  it('lists newest first, renames, deletes, and survives a reload', async () => {
    const a = await saveOwnTemplate('  Erste  ', '<p>a</p>');
    const b = await saveOwnTemplate('', '<p>b</p>');
    expect(get(ownTemplates).map((t) => t.name)).toEqual(['Untitled template', 'Erste']);

    await renameOwnTemplate(a.id, 'Protokoll');
    await renameOwnTemplate(b.id, '   '); // blank keeps the old name
    await closeDb();
    ownTemplates.set([]);
    await loadOwnTemplates();
    expect(get(ownTemplates).map((t) => t.name).sort()).toEqual(['Protokoll', 'Untitled template']);

    await deleteOwnTemplate(a.id);
    expect((await listTemplates()).map((t) => t.id)).toEqual([b.id]);
  });
});

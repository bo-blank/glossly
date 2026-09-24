import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let db: typeof import('./db');
let images: typeof import('./imageStore');

beforeEach(async () => {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  db = await import('./db');
  images = await import('./imageStore');
});

const png = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
const img = (src: string) => `<p>t</p><img src="${src}">`;

describe('imageStore', () => {
  it('stores an inserted image as a blob and returns a reference', async () => {
    const src = await images.storeImage('doc', png());
    expect(src).toMatch(/^glossly-blob:/);
    const id = src.slice('glossly-blob:'.length);
    expect((await db.getBlob(id))?.docId).toBe('doc');
    expect(images.objectUrlFor(id)).toMatch(/^blob:/);
  });

  it('collects blobs the saved HTML no longer references', async () => {
    const keep = await images.storeImage('doc', png());
    const drop = await images.storeImage('doc', png());
    await images.collectImageGarbage('doc', img(keep));
    expect(await db.listBlobIds('doc')).toEqual([keep.slice(13)]);
    expect(drop).not.toBe(keep);
  });

  it('writes a collected blob back when undo brings the image back', async () => {
    const src = await images.storeImage('doc', png());
    await images.collectImageGarbage('doc', '<p>image deleted</p>');
    expect(await db.listBlobIds('doc')).toEqual([]);
    await images.restoreMissingImages('doc', img(src)); // the save after Ctrl+Z
    expect(await db.listBlobIds('doc')).toEqual([src.slice(13)]);
  });

  it('does not take over an image pasted from another document', async () => {
    const src = await images.storeImage('a', png());
    await images.restoreMissingImages('b', img(src));
    expect((await db.getBlob(src.slice(13)))?.docId).toBe('a');
    await images.collectImageGarbage('b', '<p></p>');
    expect(await db.getBlob(src.slice(13))).toBeDefined();
  });

  it('hands shared images to another document before a delete', async () => {
    const shared = await images.storeImage('a', png());
    const own = await images.storeImage('a', png());
    const html: Record<string, string> = { b: img(shared) };
    await images.handOverSharedImages('a', ['b'], async (id) => html[id] ?? '');
    await db.deleteDocument('a');
    expect((await db.getBlob(shared.slice(13)))?.docId).toBe('b');
    expect(await db.getBlob(own.slice(13))).toBeUndefined();
  });

  it('converts base64 images to blobs and rewrites the HTML', async () => {
    const url = 'data:image/png;base64,iVBORw0KGgo=';
    const html = `<p>x</p><img src="${url}"><img src="data:image/png;base64,***">`;
    const out = await images.convertDataUrlImages('doc', html);
    expect(out).not.toContain(url);
    expect(out).toContain('src="data:image/png;base64,***"'); // malformed: left alone
    const [id] = await db.listBlobIds('doc');
    expect(out).toContain(`glossly-blob:${id}`);
    expect((await db.getBlob(id))?.blob.size).toBe(8);
  });

  it('releases object URLs of images the next document does not use', async () => {
    const a = (await images.storeImage('doc', png())).slice(13);
    const b = (await images.storeImage('doc', png())).slice(13);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    images.releaseImagesExcept(new Set([b]));
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(images.objectUrlFor(a)).toBeUndefined();
    expect(images.objectUrlFor(b)).toBeDefined();
  });
});

// Thin promise wrapper over raw IndexedDB. Content and metadata live in
// separate stores so a document list never has to load every manuscript.

const DB_NAME = 'glossly';
const DB_VERSION = 2;

export interface DocMeta {
  id: string;
  title: string;
  titleManual: boolean;
  createdAt: number;
  updatedAt: number;
  file?: FileLink;
  /** Words suggestions must keep (Phase 4 WP4). Lives here, not in the Markdown file. */
  protectedTerms?: string[];
  /** The template the document started from, for its structure guide (Phase 4 WP5). */
  template?: TemplateOrigin;
}

export interface TemplateOrigin {
  id: string;
  language: 'de' | 'en';
  /** The writer closed the structure guide; it stays closed for this document. */
  guideClosed?: boolean;
}

/** A document opened from or saved to disk. The handle survives structured clone, not JSON. */
export interface FileLink {
  handle: FileSystemFileHandle;
  name: string;
  /** The file's lastModified right after Glossly last read or wrote it. */
  modified: number;
  /** The document's updatedAt at that moment — anything later is not on disk yet. */
  syncedAt: number;
}

export interface DocRecord {
  id: string;
  html: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    // Each step only adds what its version introduced, so an existing
    // database keeps its data and a new one runs through every step.
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('documents', { keyPath: 'id' });
        const meta = db.createObjectStore('documentMeta', { keyPath: 'id' });
        meta.createIndex('by-updated', 'updatedAt');
        const blobs = db.createObjectStore('blobs', { keyPath: 'id' });
        blobs.createIndex('by-doc', 'docId');
      }
      if (event.oldVersion < 2) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
  });
  // A failed open must not be cached, or one transient error disables storage
  // for the rest of the session.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** Closes the cached connection. Tests use it to delete the database between runs. */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const pending = dbPromise;
  dbPromise = null;
  try {
    (await pending).close();
  } catch {
    // never opened — nothing to close
  }
}

export async function isAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

export async function getDocument(id: string): Promise<DocRecord | undefined> {
  const db = await openDb();
  return promisify(db.transaction('documents').objectStore('documents').get(id));
}

export async function getDocumentMeta(id: string): Promise<DocMeta | undefined> {
  const db = await openDb();
  return promisify(db.transaction('documentMeta').objectStore('documentMeta').get(id));
}

// `file` is written by putFileLink alone: an autosave or rename working from an
// older copy of the metadata must not drop a link made in the meantime.
function putMetaKeepingFile(store: IDBObjectStore, meta: DocMeta) {
  const request = store.get(meta.id);
  request.onsuccess = () => {
    const { file: _stale, ...rest } = meta;
    const file = (request.result as DocMeta | undefined)?.file;
    store.put(file ? { ...rest, file } : rest);
  };
}

/** Writes content and metadata in one transaction, so they can never diverge. */
export async function putDocument(meta: DocMeta, html: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['documents', 'documentMeta'], 'readwrite');
  const done = transactionDone(tx);
  try {
    tx.objectStore('documents').put({ id: meta.id, html } satisfies DocRecord);
    putMetaKeepingFile(tx.objectStore('documentMeta'), meta);
  } catch (err) {
    // put() can throw synchronously (e.g. DataCloneError). The first put is
    // already queued and would commit on its own — abort to keep both stores in step.
    done.catch(() => {});
    tx.abort();
    throw err;
  }
  return done;
}

/** Metadata only — a rename must not rewrite the manuscript. */
export async function putDocumentMeta(meta: DocMeta): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('documentMeta', 'readwrite');
  putMetaKeepingFile(tx.objectStore('documentMeta'), meta);
  return transactionDone(tx);
}

/** Sets or clears a document's file link, leaving the rest of its metadata alone. */
export async function putFileLink(id: string, file: FileLink | undefined): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('documentMeta', 'readwrite');
  const store = tx.objectStore('documentMeta');
  const request = store.get(id);
  request.onsuccess = () => {
    const current = request.result as DocMeta | undefined;
    if (!current) return;
    const { file: _old, ...rest } = current;
    store.put(file ? { ...rest, file } : rest);
  };
  return transactionDone(tx);
}

/** Removes the document, its metadata and all its images in one transaction. */
export async function deleteDocument(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['documents', 'documentMeta', 'blobs'], 'readwrite');
  tx.objectStore('documents').delete(id);
  tx.objectStore('documentMeta').delete(id);
  const cursor = tx.objectStore('blobs').index('by-doc').openKeyCursor(IDBKeyRange.only(id));
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (!c) return;
    tx.objectStore('blobs').delete(c.primaryKey);
    c.continue();
  };
  return transactionDone(tx);
}

export interface BlobRecord {
  id: string;
  docId: string;
  blob: Blob;
}

export async function putBlobs(records: BlobRecord[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDb();
  const tx = db.transaction('blobs', 'readwrite');
  const done = transactionDone(tx);
  try {
    for (const r of records) tx.objectStore('blobs').put(r);
  } catch (err) {
    done.catch(() => {});
    tx.abort();
    throw err;
  }
  return done;
}

export async function getBlob(id: string): Promise<BlobRecord | undefined> {
  const db = await openDb();
  return promisify(db.transaction('blobs').objectStore('blobs').get(id));
}

export async function listBlobIds(docId: string): Promise<string[]> {
  const db = await openDb();
  const index = db.transaction('blobs').objectStore('blobs').index('by-doc');
  return (await promisify(index.getAllKeys(IDBKeyRange.only(docId)))) as string[];
}

export async function deleteBlobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction('blobs', 'readwrite');
  for (const id of ids) tx.objectStore('blobs').delete(id);
  return transactionDone(tx);
}

/** A document the writer saved as a template (Phase 4 WP6). Its images are blobs owned by `templateBlobOwner(id)`. */
export interface TemplateRecord {
  id: string;
  name: string;
  html: string;
  createdAt: number;
}

/** The blob owner for a template's images — never a document id, so no document's cleanup touches them. */
export function templateBlobOwner(id: string): string {
  return `template:${id}`;
}

export async function putTemplate(record: TemplateRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('templates', 'readwrite');
  tx.objectStore('templates').put(record);
  return transactionDone(tx);
}

/** Newest first. */
export async function listTemplates(): Promise<TemplateRecord[]> {
  const db = await openDb();
  const all = await promisify(db.transaction('templates').objectStore('templates').getAll() as IDBRequest<TemplateRecord[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** Removes the template and its images in one transaction. */
export async function deleteTemplate(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['templates', 'blobs'], 'readwrite');
  tx.objectStore('templates').delete(id);
  const cursor = tx.objectStore('blobs').index('by-doc').openKeyCursor(IDBKeyRange.only(templateBlobOwner(id)));
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (!c) return;
    tx.objectStore('blobs').delete(c.primaryKey);
    c.continue();
  };
  return transactionDone(tx);
}

/** All document metadata, most recently updated first. */
export async function listDocumentMeta(): Promise<DocMeta[]> {
  const db = await openDb();
  const index = db.transaction('documentMeta').objectStore('documentMeta').index('by-updated');
  const ascending = await promisify(index.getAll() as IDBRequest<DocMeta[]>);
  return ascending.reverse();
}

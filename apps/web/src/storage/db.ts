// Thin promise wrapper over raw IndexedDB. Content and metadata live in
// separate stores so a document list never has to load every manuscript.

const DB_NAME = 'glossly';
const DB_VERSION = 1;

export interface DocMeta {
  id: string;
  title: string;
  titleManual: boolean;
  createdAt: number;
  updatedAt: number;
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
    request.onupgradeneeded = () => {
      const db = request.result;
      // All three stores in version 1: `blobs` stays empty until WP3, but an
      // empty store costs nothing and avoids a version bump later.
      db.createObjectStore('documents', { keyPath: 'id' });
      const meta = db.createObjectStore('documentMeta', { keyPath: 'id' });
      meta.createIndex('by-updated', 'updatedAt');
      const blobs = db.createObjectStore('blobs', { keyPath: 'id' });
      blobs.createIndex('by-doc', 'docId');
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

/** Writes content and metadata in one transaction, so they can never diverge. */
export async function putDocument(meta: DocMeta, html: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['documents', 'documentMeta'], 'readwrite');
  const done = transactionDone(tx);
  try {
    tx.objectStore('documents').put({ id: meta.id, html } satisfies DocRecord);
    tx.objectStore('documentMeta').put(meta);
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
  tx.objectStore('documentMeta').put(meta);
  return transactionDone(tx);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['documents', 'documentMeta'], 'readwrite');
  tx.objectStore('documents').delete(id);
  tx.objectStore('documentMeta').delete(id);
  return transactionDone(tx);
}

/** All document metadata, most recently updated first. */
export async function listDocumentMeta(): Promise<DocMeta[]> {
  const db = await openDb();
  const index = db.transaction('documentMeta').objectStore('documentMeta').index('by-updated');
  const ascending = await promisify(index.getAll() as IDBRequest<DocMeta[]>);
  return ascending.reverse();
}

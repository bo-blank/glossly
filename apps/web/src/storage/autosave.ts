import { getDocument, getDocumentMeta, isAvailable, putDocument, type DocMeta } from './db';
import { DEFAULT_DOC_ID, LEGACY_DOC_KEY, LEGACY_UPDATED_KEY, migrateFromLocalStorage, newMeta } from './migrate';

export type Backend = 'indexeddb' | 'localStorage';

export interface LoadedDocument {
  html: string | null; // null = nothing saved yet, show the default document
  backend: Backend;
}

// Kept from load so autosave preserves createdAt and (from WP2 on) the title.
let currentMeta: DocMeta | null = null;

function readLocal(): string | null {
  try {
    return localStorage.getItem(LEGACY_DOC_KEY);
  } catch {
    return null;
  }
}

/**
 * Picks the backend for this session and reads the document. IndexedDB when it
 * opens and the legacy document migrated cleanly; otherwise the pre-Phase-2
 * localStorage path, unchanged.
 */
export async function loadDocument(): Promise<LoadedDocument> {
  if (!(await isAvailable())) return { html: readLocal(), backend: 'localStorage' };
  if ((await migrateFromLocalStorage()) === 'failed') return { html: readLocal(), backend: 'localStorage' };

  try {
    const [record, meta] = await Promise.all([getDocument(DEFAULT_DOC_ID), getDocumentMeta(DEFAULT_DOC_ID)]);
    currentMeta = meta ?? null;
    return { html: record?.html ?? null, backend: 'indexeddb' };
  } catch {
    return { html: readLocal(), backend: 'localStorage' };
  }
}

/** Throws when the write fails (quota, blocked storage) so the caller can warn. */
export async function saveDocument(backend: Backend, html: string): Promise<void> {
  const now = Date.now();
  if (backend === 'localStorage') {
    localStorage.setItem(LEGACY_DOC_KEY, html);
    localStorage.setItem(LEGACY_UPDATED_KEY, String(now));
    return;
  }
  const meta = { ...(currentMeta ?? newMeta(DEFAULT_DOC_ID, now)), updatedAt: now };
  await putDocument(meta, html);
  currentMeta = meta;
}

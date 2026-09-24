import { deleteDocument, getDocument, getDocumentMeta, putDocument, type DocMeta } from './db';
import { deriveTitle } from './title';

export const LEGACY_DOC_KEY = 'glossly-document';
// Written by the localStorage fallback on every save, so a session that ran
// without IndexedDB can be told apart from the stale pre-migration copy.
export const LEGACY_UPDATED_KEY = 'glossly-document-updated';
export const DEFAULT_DOC_ID = 'default';

export type MigrationResult =
  | 'nothing-to-migrate' // no legacy document in localStorage
  | 'already-migrated' // IndexedDB holds a copy at least as new as localStorage's
  | 'migrated'
  | 'failed'; // IndexedDB copy could not be verified — localStorage kept, stay on fallback

export function newMeta(id: string, now = Date.now()): DocMeta {
  return { id, title: 'Untitled', titleManual: false, createdAt: now, updatedAt: now };
}

/**
 * Moves the localStorage manuscript into IndexedDB.
 * Order is write-new → read-back-and-verify → delete-old: the localStorage copy
 * is only removed once the IndexedDB copy has been re-read and matches exactly.
 *
 * If IndexedDB already has a default document, localStorage only wins when the
 * fallback path stamped it as newer (a session that ran without IndexedDB).
 * Otherwise it is left untouched — never delete a copy you did not just verify.
 */
export async function migrateFromLocalStorage(storage: Storage = localStorage): Promise<MigrationResult> {
  const legacy = storage.getItem(LEGACY_DOC_KEY);
  if (legacy === null) return 'nothing-to-migrate';
  const legacyUpdated = Number(storage.getItem(LEGACY_UPDATED_KEY)) || 0;

  let wrote = false;
  try {
    const existing = await getDocumentMeta(DEFAULT_DOC_ID);
    if (existing && legacyUpdated <= existing.updatedAt) return 'already-migrated';

    const now = Date.now();
    const base = existing ?? newMeta(DEFAULT_DOC_ID, now);
    const meta = {
      ...base,
      title: base.titleManual ? base.title : deriveTitle(legacy),
      updatedAt: existing ? Math.max(now, legacyUpdated) : now
    };
    await putDocument(meta, legacy);
    wrote = true;
    const readBack = await getDocument(DEFAULT_DOC_ID);
    if (readBack?.html !== legacy) throw new Error('read-back mismatch');
  } catch {
    // An unverified copy must not become the source of truth on the next load.
    // Removing it is safe: localStorage still holds the same-or-newer content.
    if (wrote) await deleteDocument(DEFAULT_DOC_ID).catch(() => {});
    return 'failed';
  }

  storage.removeItem(LEGACY_DOC_KEY);
  storage.removeItem(LEGACY_UPDATED_KEY);
  return 'migrated';
}

import { deleteBlobs, getBlob, listBlobIds, putBlobs } from './db';
import { blobSrc, dataUrlToBlob, extractBlobIds, findDataUrls, missingIds, orphanIds, replaceSrc } from './blobRefs';

// Every image the open document has shown this session, with its bytes and a
// view-only object URL. Keeping the bytes is what makes garbage collection
// undo-safe: delete an image, autosave collects its blob, Ctrl+Z brings the
// node back — and the next save writes the blob again from here.
interface Entry {
  blob: Blob;
  url: string;
}
const entries = new Map<string, Entry>();

function register(id: string, blob: Blob): string {
  const existing = entries.get(id);
  if (existing) return existing.url;
  const url = URL.createObjectURL(blob);
  entries.set(id, { blob, url });
  return url;
}

/** Object URL for the view, if already loaded. Never persist it — it is dead on the next page load. */
export function objectUrlFor(id: string): string | undefined {
  return entries.get(id)?.url;
}

export async function loadObjectUrl(id: string): Promise<string | undefined> {
  const cached = objectUrlFor(id);
  if (cached) return cached;
  const record = await getBlob(id).catch(() => undefined);
  return record ? register(id, record.blob) : undefined;
}

/** Loads every image a document references, so it renders without a flicker. */
export async function preloadImages(html: string): Promise<void> {
  await Promise.all([...extractBlobIds(html)].map((id) => loadObjectUrl(id)));
}

/** Stores an inserted image and returns the `glossly-blob:` src to put in the document. */
export async function storeImage(docId: string, blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await putBlobs([{ id, docId, blob }]);
  register(id, blob);
  return blobSrc(id);
}

/**
 * Revokes object URLs the new document doesn't use. Call once the next document
 * has rendered — revoking in the same tick as the content swap blanks images
 * mid-render. Without this, every switch leaks the full image set.
 */
export function releaseImagesExcept(keep: Set<string>): void {
  for (const [id, entry] of entries) {
    if (keep.has(id)) continue;
    URL.revokeObjectURL(entry.url);
    entries.delete(id);
  }
}

export function releaseAllImages(): void {
  releaseImagesExcept(new Set());
}

/**
 * Before a save: re-store any referenced image whose blob is gone (collected,
 * then brought back by undo). Only ids that exist nowhere in the store are
 * written — an image pasted from another document keeps that document's blob.
 */
export async function restoreMissingImages(docId: string, html: string): Promise<void> {
  const referenced = extractBlobIds(html);
  if (referenced.size === 0) return;
  const candidates = missingIds(await listBlobIds(docId), referenced);
  const absent = [];
  for (const id of candidates) {
    const entry = entries.get(id);
    if (entry && !(await getBlob(id))) absent.push({ id, docId, blob: entry.blob });
  }
  await putBlobs(absent);
}

/** After a save completes: delete this document's blobs its HTML no longer references. */
export async function collectImageGarbage(docId: string, html: string): Promise<void> {
  await deleteBlobs(orphanIds(await listBlobIds(docId), extractBlobIds(html)));
}

/**
 * One-time conversion of base64 images (documents from before WP3) to blobs.
 * Each blob is written and read back before its src is rewritten; a data URL
 * that fails either step stays as it is. Returns the HTML unchanged if nothing
 * converted.
 */
export async function convertDataUrlImages(docId: string, html: string): Promise<string> {
  let result = html;
  for (const dataUrl of findDataUrls(html)) {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) continue;
    const id = crypto.randomUUID();
    try {
      await putBlobs([{ id, docId, blob }]);
      const readBack = await getBlob(id);
      if (readBack?.blob.size !== blob.size) {
        await deleteBlobs([id]);
        continue;
      }
    } catch {
      continue;
    }
    register(id, blob);
    result = replaceSrc(result, dataUrl, blobSrc(id));
  }
  return result;
}

/**
 * Before a document is deleted: its blobs that other documents still reference
 * (an image copied across) are re-owned by the first of them, so the delete
 * cascade doesn't take them along.
 */
export async function handOverSharedImages(
  docId: string,
  otherDocIds: string[],
  readHtml: (docId: string) => Promise<string>
): Promise<void> {
  const own = new Set(await listBlobIds(docId));
  if (own.size === 0) return;
  const handovers = [];
  for (const other of otherDocIds) {
    for (const id of extractBlobIds(await readHtml(other))) {
      if (!own.has(id)) continue;
      own.delete(id);
      const record = await getBlob(id);
      if (record) handovers.push({ ...record, docId: other });
    }
    if (own.size === 0) break;
  }
  await putBlobs(handovers);
}

// Pure helpers for images stored as blobs. The document HTML references an
// image as `glossly-blob:<id>`; the bytes live in the `blobs` object store.

export const BLOB_PREFIX = 'glossly-blob:';

export function blobSrc(id: string): string {
  return `${BLOB_PREFIX}${id}`;
}

export function blobIdFromSrc(src: string | null | undefined): string | null {
  return src?.startsWith(BLOB_PREFIX) ? src.slice(BLOB_PREFIX.length) : null;
}

/** Every blob id an HTML string references, without duplicates. */
export function extractBlobIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/src="glossly-blob:([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

/** Blobs that are stored but no longer referenced: safe to delete. */
export function orphanIds(stored: Iterable<string>, referenced: Set<string>): string[] {
  return [...stored].filter((id) => !referenced.has(id));
}

/** Referenced but not stored — e.g. an image brought back by undo after its blob was collected. */
export function missingIds(stored: Iterable<string>, referenced: Set<string>): string[] {
  const have = new Set(stored);
  return [...referenced].filter((id) => !have.has(id));
}

/** The distinct `data:` image URLs used as img src in an HTML string. */
export function findDataUrls(html: string): string[] {
  return [...new Set([...html.matchAll(/src="(data:image\/[^"]+)"/g)].map((m) => m[1]))];
}

/** `null` for anything that isn't a well-formed base64 data URL. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([\w.+-]+\/[\w.+-]+)?(?:;[\w-]+=[^;,]*)*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) return null;
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] ?? 'application/octet-stream' });
}

/** Replaces every `src="<from>"` with `src="<to>"`. Plain string replace: data URLs contain regex metacharacters. */
export function replaceSrc(html: string, from: string, to: string): string {
  return html.split(`src="${from}"`).join(`src="${to}"`);
}

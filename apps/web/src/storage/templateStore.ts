import { writable } from 'svelte/store';
import { blobSrc, extractBlobIds, replaceSrc } from './blobRefs';
import { deleteTemplate, getBlob, listTemplates, putBlobs, putTemplate, templateBlobOwner, type TemplateRecord } from './db';

export type OwnTemplate = TemplateRecord;

export const NAME_MAX = 60;

/** The writer's own templates, newest first. Empty until loaded, and without IndexedDB. */
export const ownTemplates = writable<OwnTemplate[]>([]);

export async function loadOwnTemplates(): Promise<void> {
  ownTemplates.set(await listTemplates());
}

/**
 * Copies every image the HTML references to blobs owned by `owner` and points
 * the HTML at the copies. Images are owned per document and deleted with it,
 * so a template that merely referenced its source document's images would
 * lose them — and so would a document made from the template.
 */
async function withOwnImages(html: string, owner: string): Promise<string> {
  let out = html;
  for (const id of extractBlobIds(html)) {
    const record = await getBlob(id);
    if (!record) continue; // nothing to copy; the editor already shows it as missing
    const copy = crypto.randomUUID();
    await putBlobs([{ id: copy, docId: owner, blob: record.blob }]);
    out = replaceSrc(out, blobSrc(id), blobSrc(copy));
  }
  return out;
}

/** Saves already plain HTML (see editor/templateFormatting) as a template with its own image copies. */
export async function saveOwnTemplate(name: string, html: string): Promise<OwnTemplate> {
  const id = crypto.randomUUID();
  const record: OwnTemplate = {
    id,
    name: name.trim().slice(0, NAME_MAX) || 'Untitled template',
    html: await withOwnImages(html, templateBlobOwner(id)),
    createdAt: Date.now()
  };
  await putTemplate(record);
  ownTemplates.update((list) => [record, ...list]);
  return record;
}

/** The template's HTML for the document `docId`, with image copies that document owns. */
export function htmlForDocument(template: OwnTemplate, docId: string): Promise<string> {
  return withOwnImages(template.html, docId);
}

export async function renameOwnTemplate(id: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, NAME_MAX);
  let updated: OwnTemplate | undefined;
  ownTemplates.update((list) => list.map((t) => (t.id === id && trimmed ? (updated = { ...t, name: trimmed }) : t)));
  if (updated) await putTemplate(updated);
}

export async function deleteOwnTemplate(id: string): Promise<void> {
  await deleteTemplate(id);
  ownTemplates.update((list) => list.filter((t) => t.id !== id));
}

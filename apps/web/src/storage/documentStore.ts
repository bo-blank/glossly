import { get, writable } from 'svelte/store';
import {
  deleteDocument,
  getDocument,
  isAvailable,
  listDocumentMeta,
  putDocument,
  putDocumentMeta,
  type DocMeta
} from './db';
import { DEFAULT_DOC_ID, LEGACY_DOC_KEY, LEGACY_UPDATED_KEY, migrateFromLocalStorage, newMeta } from './migrate';
import { deriveTitle, TITLE_MAX } from './title';
import {
  collectImageGarbage,
  convertDataUrlImages,
  handOverSharedImages,
  preloadImages,
  restoreMissingImages
} from './imageStore';

export { deriveTitle };

export type Backend = 'indexeddb' | 'localStorage';

export const ACTIVE_DOC_KEY = 'glossly-active-document';
export const BLANK_HTML = '<p></p>';

export interface DocumentState {
  backend: Backend;
  documents: DocMeta[]; // most recently updated first
  activeId: string;
}

export const documentStore = writable<DocumentState>({ backend: 'localStorage', documents: [], activeId: DEFAULT_DOC_ID });

/**
 * What the store needs from the editor. Registered by Editor.svelte on mount,
 * so the header menu can switch documents without reaching into the editor.
 */
export interface EditorBridge {
  /** Save the active document now if it has unsaved edits. Throws on failure. */
  flush(): Promise<void>;
  /** Drop a pending autosave without writing it (the document is being deleted). */
  cancelPendingSave(): void;
  /** Replace the editor with a fresh one showing `html` — fresh, so undo history can't cross documents. */
  show(id: string, html: string): void;
}

let bridge: EditorBridge | null = null;
export function registerEditor(b: EditorBridge | null) {
  bridge = b;
}

// ---------------------------------------------------------------- helpers

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_DOC_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string) {
  try {
    localStorage.setItem(ACTIVE_DOC_KEY, id);
  } catch {
    // Losing this only means the next start opens the most recent document instead.
  }
}

function readLocal(): string | null {
  try {
    return localStorage.getItem(LEGACY_DOC_KEY);
  } catch {
    return null;
  }
}

function sortByUpdated(docs: DocMeta[]): DocMeta[] {
  return [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
}

function upsert(docs: DocMeta[], meta: DocMeta): DocMeta[] {
  return sortByUpdated([...docs.filter((d) => d.id !== meta.id), meta]);
}

function setActive(id: string) {
  documentStore.update((s) => ({ ...s, activeId: id }));
  writeActiveId(id);
}

// A save already in flight when its document is deleted must not put it back in the list.
const deletedIds = new Set<string>();

// Menu operations run one at a time: two quick clicks must not interleave a
// flush/load pair. Autosaves are not queued — flush() calls them from inside.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.catch(() => {});
  return run;
}

function newId(): string {
  return crypto.randomUUID();
}

async function createRecord(html: string, id = newId()): Promise<DocMeta> {
  const meta = { ...newMeta(id), title: deriveTitle(html) };
  await putDocument(meta, html);
  documentStore.update((s) => ({ ...s, documents: upsert(s.documents, meta) }));
  return meta;
}

// Documents saved before titles existed (the WP1 migration) carry a placeholder.
// Fix it on open, without touching updatedAt — nothing was edited.
async function refreshAutoTitle(meta: DocMeta, html: string) {
  const title = deriveTitle(html);
  if (meta.titleManual || meta.title === title) return;
  const updated = { ...meta, title };
  await putDocumentMeta(updated);
  documentStore.update((s) => ({ ...s, documents: s.documents.map((d) => (d.id === meta.id ? updated : d)) }));
}

/**
 * Converts base64 images to blobs once (documents from before WP3 would
 * otherwise stay huge forever) and preloads every image for display.
 * If saving the converted HTML fails, the original is shown — it still works.
 */
async function prepareForDisplay(id: string, html: string): Promise<string> {
  let shown = html;
  const converted = await convertDataUrlImages(id, html);
  if (converted !== html) {
    try {
      // Current metadata, not a caller's copy: the title may just have been refreshed.
      const meta = get(documentStore).documents.find((d) => d.id === id) ?? newMeta(id);
      await putDocument(meta, converted);
      if ((await getDocument(id))?.html === converted) shown = converted;
    } catch {
      // keep showing the original data URLs
    }
  }
  await preloadImages(shown);
  return shown;
}

// ---------------------------------------------------------------- lifecycle

/**
 * Picks the backend and returns the HTML to open with. IndexedDB when it opens
 * and the legacy document migrated cleanly; otherwise the pre-Phase-2
 * single-document localStorage path, unchanged.
 */
export async function initDocuments(defaultHtml: string): Promise<{ id: string; html: string }> {
  const fallback = () => {
    documentStore.set({ backend: 'localStorage', documents: [], activeId: DEFAULT_DOC_ID });
    return { id: DEFAULT_DOC_ID, html: readLocal() ?? defaultHtml };
  };
  if (!(await isAvailable())) return fallback();
  if ((await migrateFromLocalStorage()) === 'failed') return fallback();

  try {
    const documents = await listDocumentMeta();
    documentStore.set({ backend: 'indexeddb', documents, activeId: DEFAULT_DOC_ID });
    const stored = readActiveId();
    const active = documents.find((d) => d.id === stored) ?? documents[0];
    if (active) {
      const record = await getDocument(active.id);
      if (record) {
        await refreshAutoTitle(active, record.html);
        const html = await prepareForDisplay(active.id, record.html);
        setActive(active.id);
        return { id: active.id, html };
      }
    }
    const created = await createRecord(defaultHtml, documents.length === 0 ? DEFAULT_DOC_ID : newId());
    setActive(created.id);
    return { id: created.id, html: defaultHtml };
  } catch {
    return fallback();
  }
}

/**
 * Autosave. Takes the id the editor was showing when the edit happened, not the
 * current active id — a save still pending across a switch must land in the
 * document it came from. Throws when the write fails (quota, blocked storage).
 */
export async function saveDocument(id: string, html: string): Promise<void> {
  const state = get(documentStore);
  const now = Date.now();
  if (state.backend === 'localStorage') {
    localStorage.setItem(LEGACY_DOC_KEY, html);
    localStorage.setItem(LEGACY_UPDATED_KEY, String(now));
    return;
  }
  if (deletedIds.has(id)) return;
  await restoreMissingImages(id, html);
  const current = state.documents.find((d) => d.id === id) ?? newMeta(id, now);
  const meta = {
    ...current,
    // A name the writer chose survives every autosave.
    title: current.titleManual ? current.title : deriveTitle(html),
    updatedAt: now
  };
  await putDocument(meta, html);
  if (deletedIds.has(id)) return;
  documentStore.update((s) => ({ ...s, documents: upsert(s.documents, meta) }));
  // After the save, never during: a failed collection only leaves garbage behind.
  await collectImageGarbage(id, html).catch(() => {});
}

// ---------------------------------------------------------------- operations

async function open(id: string): Promise<void> {
  const record = await getDocument(id);
  if (!record) throw new Error(`Document ${id} not found`);
  const html = await prepareForDisplay(id, record.html);
  setActive(id);
  bridge?.show(id, html);
}

/** Saves the outgoing document first — otherwise the last <500 ms of typing is lost on every switch. */
export function switchDocument(id: string): Promise<void> {
  return serial(async () => {
    if (id === get(documentStore).activeId) return;
    await bridge?.flush();
    await open(id);
  });
}

export function createDocument(html: string): Promise<void> {
  return serial(async () => {
    await bridge?.flush();
    const meta = await createRecord(html);
    setActive(meta.id);
    bridge?.show(meta.id, html);
  });
}

/** An empty name hands the title back to automatic derivation. */
export function renameDocument(id: string, title: string): Promise<void> {
  return serial(() => rename(id, title));
}

async function rename(id: string, title: string): Promise<void> {
  const current = get(documentStore).documents.find((d) => d.id === id);
  if (!current) return;
  const trimmed = title.trim().slice(0, TITLE_MAX);
  let meta: DocMeta;
  if (trimmed) {
    meta = { ...current, title: trimmed, titleManual: true };
  } else {
    const record = await getDocument(id);
    meta = { ...current, title: deriveTitle(record?.html ?? ''), titleManual: false };
  }
  await putDocumentMeta(meta);
  // Keep the list position: a rename is not an edit, so updatedAt stays.
  documentStore.update((s) => ({ ...s, documents: s.documents.map((d) => (d.id === id ? meta : d)) }));
}

/** Deleting the active document lands on the most recent remaining one, or a fresh blank one. */
export function removeDocument(id: string): Promise<void> {
  return serial(() => remove(id));
}

async function remove(id: string): Promise<void> {
  const wasActive = get(documentStore).activeId === id;
  // A pending autosave would write the deleted document straight back.
  if (wasActive) bridge?.cancelPendingSave();
  deletedIds.add(id);
  // An image pasted into another document still points at this one's blob.
  const others = get(documentStore).documents.filter((d) => d.id !== id);
  await handOverSharedImages(id, others.map((d) => d.id), async (docId) => (await getDocument(docId))?.html ?? '');
  await deleteDocument(id);
  documentStore.update((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) }));
  if (!wasActive) return;

  const next = get(documentStore).documents[0];
  if (next) {
    await open(next.id);
  } else {
    const meta = await createRecord(BLANK_HTML);
    setActive(meta.id);
    bridge?.show(meta.id, BLANK_HTML);
  }
}

// ---------------------------------------------------------------- display

export function relativeTime(then: number, now = Date.now()): string {
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString();
}

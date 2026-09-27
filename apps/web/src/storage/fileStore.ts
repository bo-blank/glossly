import { get, writable } from 'svelte/store';
import { editorStore } from '../stores/noteStore';
import { editorToMarkdown, markdownFileName, markdownToHtml } from '../editor/markdownFiles';
import type { DocMeta } from './db';
import { createDocument, documentStore, flushActive, linkFile, replaceFromFile, switchDocument } from './documentStore';
import { diskState, needsChoice, supportsFileAccess } from './fileSync';

// Save to real files (WP5). IndexedDB stays the autosave and crash-recovery
// layer; the file on disk is written on Ctrl+S, and in the background once
// the writer has granted write permission in this session.

export interface FileConflict {
  id: string;
  name: string;
  /** Glossly also has edits the file lacks — whichever side loses, its changes are gone. */
  localChanged: boolean;
}

export interface FileStatus {
  conflict: FileConflict | null;
  /** Documents whose file changed outside Glossly: no background writes until the writer chooses. */
  blocked: string[];
  error: string;
}

export const fileStatus = writable<FileStatus>({ conflict: null, blocked: [], error: '' });

export const fileAccessSupported = supportsFileAccess();

const SAVE_TYPES: FilePickerAcceptType[] = [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }];
const OPEN_TYPES: FilePickerAcceptType[] = [
  { description: 'Markdown or text', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } }
];
// Lets the browser remember the last folder for Glossly's pickers.
const PICKER_ID = 'glossly-documents';
const BACKGROUND_SYNC_MS = 2000;
const READWRITE: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };

// Disk operations run one at a time: a background write must not interleave
// with Ctrl+S or a conflict resolution on the same file.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.catch(() => {});
  return run;
}

function isNamed(err: unknown, name: string): boolean {
  return err instanceof DOMException && err.name === name;
}

function findDoc(id: string): DocMeta | undefined {
  return get(documentStore).documents.find((d) => d.id === id);
}

function activeDoc(): DocMeta | undefined {
  return findDoc(get(documentStore).activeId);
}

function setBlocked(id: string, blocked: boolean) {
  fileStatus.update((s) => {
    const others = s.blocked.filter((b) => b !== id);
    return { ...s, blocked: blocked ? [...others, id] : others };
  });
}

function ask(id: string, name: string, localChanged: boolean) {
  setBlocked(id, true);
  fileStatus.update((s) => ({ ...s, conflict: { id, name, localChanged } }));
}

export function reportFileError(message: string) {
  fileStatus.update((s) => ({ ...s, error: message }));
}

/** requestPermission needs a user gesture — background callers pass `ask: false`. */
async function hasWritePermission(handle: FileSystemFileHandle, ask: boolean): Promise<boolean> {
  if ((await handle.queryPermission(READWRITE)) === 'granted') return true;
  return ask && (await handle.requestPermission(READWRITE)) === 'granted';
}

/** Writes the open editor's content. The file is only replaced on close(), so a failed write leaves it intact. */
async function writeFile(id: string, handle: FileSystemFileHandle): Promise<void> {
  const editor = get(editorStore).editor;
  const meta = findDoc(id);
  if (!editor || !meta || get(documentStore).activeId !== id) return;
  // Taken before serializing: edits typed while the write runs count as not on disk yet.
  const syncedAt = meta.updatedAt;
  const markdown = await editorToMarkdown(editor);
  const writable = await handle.createWritable();
  try {
    await writable.write(markdown);
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => {});
    throw err;
  }
  const file = await handle.getFile();
  await linkFile(id, { handle, name: file.name, modified: file.lastModified, syncedAt });
  setBlocked(id, false);
  reportFileError('');
}

async function pickSaveTarget(title: string): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker({ suggestedName: markdownFileName(title), types: SAVE_TYPES, id: PICKER_ID });
  } catch (err) {
    if (isNamed(err, 'AbortError')) return null;
    throw err;
  }
}

/**
 * Ctrl+S. The first save of a document asks where to put it; later saves write
 * to the same file, after checking it was not changed outside Glossly.
 * Permission and picker come before anything is awaited — both need the key
 * press's user activation, which expires.
 */
export function saveToDisk(): Promise<void> {
  return serial(async () => {
    const meta = activeDoc();
    if (!meta) return;
    let handle = meta.file?.handle;
    if (handle && !(await hasWritePermission(handle, true))) {
      throw new Error(`Glossly was not allowed to write to ${meta.file!.name}.`);
    }
    if (!handle) {
      handle = (await pickSaveTarget(meta.title)) ?? undefined;
      if (!handle) return;
      await flushActive();
      await writeFile(meta.id, handle);
      return;
    }

    await flushActive();
    const current = findDoc(meta.id);
    if (!current?.file) return;
    let file: File;
    try {
      file = await handle.getFile();
    } catch (err) {
      // Moved or deleted outside Glossly: save it somewhere new instead.
      if (!isNamed(err, 'NotFoundError')) throw err;
      const target = await pickSaveTarget(current.title);
      if (target) await writeFile(current.id, target);
      return;
    }
    const state = diskState(current.file, current.updatedAt, file.lastModified);
    if (needsChoice(state)) {
      ask(current.id, current.file.name, state === 'both-changed');
      return;
    }
    await writeFile(current.id, handle);
  });
}

/** Opens a Markdown file as a new document — or switches to it if it is already open. */
export function openFile(): Promise<void> {
  return serial(async () => {
    let handle: FileSystemFileHandle;
    try {
      [handle] = await window.showOpenFilePicker({ types: OPEN_TYPES, id: PICKER_ID });
    } catch (err) {
      if (isNamed(err, 'AbortError')) return;
      throw err;
    }
    for (const doc of get(documentStore).documents) {
      if (doc.file && (await doc.file.handle.isSameEntry(handle))) {
        // The switch runs the on-open check below.
        await switchDocument(doc.id);
        return;
      }
    }
    const editor = get(editorStore).editor;
    if (!editor) return;
    const file = await handle.getFile();
    const html = markdownToHtml(await file.text(), editor);
    await createDocument(html, { handle, name: file.name, modified: file.lastModified });
  });
}

/** The writer's answer to the conflict dialog. 'later' keeps background writes off for that file. */
export function resolveConflict(choice: 'file' | 'glossly' | 'later'): Promise<void> {
  const conflict = get(fileStatus).conflict;
  fileStatus.update((s) => ({ ...s, conflict: null }));
  if (!conflict || choice === 'later') return Promise.resolve();
  return serial(async () => {
    const meta = findDoc(conflict.id);
    if (!meta?.file) return;
    const { handle } = meta.file;
    if (choice === 'glossly') {
      await flushActive();
      await writeFile(meta.id, handle);
      return;
    }
    const editor = get(editorStore).editor;
    if (!editor) return;
    const file = await handle.getFile();
    const html = markdownToHtml(await file.text(), editor);
    await replaceFromFile(meta.id, html, { handle, name: file.name, modified: file.lastModified });
    setBlocked(meta.id, false);
    reportFileError('');
  });
}

/** When a file-backed document opens, look for outside edits — only if permission is already there. */
async function checkOnOpen(id: string): Promise<void> {
  const meta = findDoc(id);
  if (!meta?.file || !(await hasWritePermission(meta.file.handle, false))) return;
  let file: File;
  try {
    file = await meta.file.handle.getFile();
  } catch {
    return; // missing file — the next Ctrl+S offers to save it elsewhere
  }
  const current = findDoc(id);
  if (!current?.file || get(documentStore).activeId !== id) return;
  const state = diskState(current.file, current.updatedAt, file.lastModified);
  if (needsChoice(state)) ask(id, current.file.name, state === 'both-changed');
}

/** Runs the on-open check whenever the active document changes. Returns the unsubscribe. */
export function watchActiveFile(): () => void {
  if (!fileAccessSupported) return () => {};
  let last: string | null = null;
  return documentStore.subscribe((s) => {
    if (s.backend !== 'indexeddb' || s.activeId === last) return;
    last = s.activeId;
    const id = s.activeId;
    // A dialog about the document just left behind no longer applies.
    fileStatus.update((f) => ({ ...f, conflict: f.conflict?.id === id ? f.conflict : null, error: '' }));
    void serial(() => checkOnOpen(id)).catch(() => {});
  });
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * After an autosave: write the file too, if the writer already granted write
 * permission. Never prompts and never opens the dialog mid-typing — an outside
 * edit only blocks further writes until the next Ctrl+S asks.
 */
export function scheduleDiskSync(id: string): void {
  if (!fileAccessSupported || !findDoc(id)?.file) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    serial(() => syncQuietly(id)).catch(() => {
      reportFileError(`Could not write ${findDoc(id)?.file?.name ?? 'the file'} — press Ctrl+S to retry.`);
    });
  }, BACKGROUND_SYNC_MS);
}

async function syncQuietly(id: string): Promise<void> {
  const meta = findDoc(id);
  if (!meta?.file || get(fileStatus).blocked.includes(id) || get(documentStore).activeId !== id) return;
  if (!(await hasWritePermission(meta.file.handle, false))) return;
  const file = await meta.file.handle.getFile();
  const current = findDoc(id);
  if (!current?.file) return;
  const state = diskState(current.file, current.updatedAt, file.lastModified);
  if (needsChoice(state)) setBlocked(id, true);
  else if (state === 'local-newer') await writeFile(id, current.file.handle);
}

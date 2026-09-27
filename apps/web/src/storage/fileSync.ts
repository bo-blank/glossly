import type { FileLink } from './db';

/**
 * The File System Access API is Chromium-only (and switched off in Brave by
 * default). Without it, Markdown download and import are the whole feature.
 */
export function supportsFileAccess(scope: object = globalThis): boolean {
  const s = scope as { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
  return typeof s.showOpenFilePicker === 'function' && typeof s.showSaveFilePicker === 'function';
}

export type DiskState =
  | 'in-sync' // nothing to do
  | 'local-newer' // Glossly has edits the file lacks — safe to write
  | 'file-newer' // changed outside Glossly — writing would destroy that edit
  | 'both-changed';

/**
 * Compares both sides against the last sync, not against each other: updatedAt
 * moves with every autosave, so "file newer than the document" would miss an
 * outside edit as soon as the writer typed anything. Any change of the file's
 * timestamp counts — a restored backup can carry an older one.
 */
export function diskState(file: FileLink, updatedAt: number, fileModified: number): DiskState {
  const fileChanged = fileModified !== file.modified;
  const localChanged = updatedAt > file.syncedAt;
  if (fileChanged) return localChanged ? 'both-changed' : 'file-newer';
  return localChanged ? 'local-newer' : 'in-sync';
}

/** Whether the writer has to pick a side before anything is written or loaded. */
export function needsChoice(state: DiskState): boolean {
  return state === 'file-newer' || state === 'both-changed';
}

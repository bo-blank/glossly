import { describe, expect, it } from 'vitest';
import type { FileLink } from './db';
import { diskState, needsChoice, supportsFileAccess } from './fileSync';

const link: FileLink = { handle: {} as FileSystemFileHandle, name: 'a.md', modified: 5_000, syncedAt: 100 };

describe('supportsFileAccess', () => {
  it('needs both pickers', () => {
    const fn = () => {};
    expect(supportsFileAccess({ showOpenFilePicker: fn, showSaveFilePicker: fn })).toBe(true);
    expect(supportsFileAccess({ showOpenFilePicker: fn })).toBe(false);
    expect(supportsFileAccess({})).toBe(false);
  });

  it('is false in Node, like in Firefox', () => {
    expect(supportsFileAccess()).toBe(false);
  });
});

describe('diskState', () => {
  it('is in sync when neither side moved', () => {
    expect(diskState(link, 100, 5_000)).toBe('in-sync');
  });

  it('lets local edits be written', () => {
    expect(diskState(link, 200, 5_000)).toBe('local-newer');
  });

  it('notices an outside edit even when the document was edited later', () => {
    // The file changed at 6000, the writer kept typing until 9000: comparing
    // the two timestamps directly would call this "local is newer" and overwrite it.
    expect(diskState(link, 9_000, 6_000)).toBe('both-changed');
  });

  it('notices an outside edit when Glossly has none', () => {
    expect(diskState(link, 100, 6_000)).toBe('file-newer');
  });

  it('treats an older timestamp as a change too', () => {
    expect(diskState(link, 100, 4_000)).toBe('file-newer');
  });

  it('asks only when the file changed', () => {
    expect(needsChoice('in-sync')).toBe(false);
    expect(needsChoice('local-newer')).toBe(false);
    expect(needsChoice('file-newer')).toBe(true);
    expect(needsChoice('both-changed')).toBe(true);
  });
});

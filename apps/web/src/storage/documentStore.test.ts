import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Store = typeof import('./documentStore');
let ds: Store;
let db: typeof import('./db');
let clock = 1_000;
let shown: { id: string; html: string }[];
let flushes: number;

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    }
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  globalThis.indexedDB = new IDBFactory();
  vi.stubGlobal('localStorage', memoryStorage());
  clock = 1_000;
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1_000));
  ds = await import('./documentStore');
  db = await import('./db');
  shown = [];
  flushes = 0;
  ds.registerEditor({
    flush: async () => {
      flushes++;
    },
    cancelPendingSave: () => {},
    show: (id, html) => void shown.push({ id, html })
  });
});

const state = () => get(ds.documentStore);
const ids = () => state().documents.map((d) => d.id);

describe('deriveTitle', () => {
  it('prefers the first heading, even after a paragraph', () => {
    expect(ds.deriveTitle('<p>Intro text</p><h2>Kapitel 1</h2>')).toBe('Kapitel 1');
  });

  it('falls back to the first non-empty block', () => {
    expect(ds.deriveTitle('<p></p><ul><li><p>Erster Punkt</p></li></ul>')).toBe('Erster Punkt');
  });

  it('is "Untitled" without text', () => {
    expect(ds.deriveTitle('<p></p>')).toBe('Untitled');
    expect(ds.deriveTitle('')).toBe('Untitled');
  });

  it('strips markup and decodes entities', () => {
    expect(ds.deriveTitle('<h1>Tom &amp; <em>Jerry</em>&nbsp;&lt;3</h1>')).toBe('Tom & Jerry <3');
  });

  it('trims to 60 characters', () => {
    const title = ds.deriveTitle(`<p>${'Wort '.repeat(30)}</p>`);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('documents', () => {
  it('creates the default document on first start and remembers it as active', async () => {
    const opened = await ds.initDocuments('<h2>Start anywhere</h2>');
    expect(opened).toEqual({ id: 'default', html: '<h2>Start anywhere</h2>' });
    expect(state().documents[0]).toMatchObject({ id: 'default', title: 'Start anywhere' });
    expect(localStorage.getItem(ds.ACTIVE_DOC_KEY)).toBe('default');
  });

  it('reopens the remembered active document', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.createDocument('<p>zweites</p>');
    const second = state().activeId;
    vi.resetModules();
    const fresh: Store = await import('./documentStore');
    expect(await fresh.initDocuments('<p>unused</p>')).toEqual({ id: second, html: '<p>zweites</p>' });
  });

  it('re-derives the title on autosave but keeps a manual name', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.saveDocument('default', '<h1>Neuer Titel</h1>');
    expect(state().documents[0].title).toBe('Neuer Titel');
    await ds.renameDocument('default', 'Mein Roman');
    await ds.saveDocument('default', '<h1>Ganz anders</h1>');
    expect(state().documents[0]).toMatchObject({ title: 'Mein Roman', titleManual: true });
    expect((await db.getDocumentMeta('default'))?.title).toBe('Mein Roman');
  });

  it('hands the title back to derivation when renamed to empty', async () => {
    await ds.initDocuments('<h1>Automatisch</h1>');
    await ds.renameDocument('default', 'Manuell');
    await ds.renameDocument('default', '   ');
    expect(state().documents[0]).toMatchObject({ title: 'Automatisch', titleManual: false });
  });

  it('orders the list by last update', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.createDocument('<p>b</p>');
    const b = state().activeId;
    await ds.saveDocument('default', '<p>a edited</p>');
    expect(ids()).toEqual(['default', b]);
  });

  it('flushes the outgoing document before switching, and stays put if that fails', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.createDocument('<p>b</p>');
    const b = state().activeId;
    flushes = 0;
    await ds.switchDocument('default');
    expect(flushes).toBe(1);
    expect(shown.at(-1)).toEqual({ id: 'default', html: '<p>a</p>' });

    ds.registerEditor({ flush: () => Promise.reject(new Error('quota')), cancelPendingSave: () => {}, show: () => {} });
    await expect(ds.switchDocument(b)).rejects.toThrow('quota');
    expect(state().activeId).toBe('default');
  });

  it('deleting the active document opens the most recently updated remaining one', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.createDocument('<p>b</p>');
    await ds.createDocument('<p>c</p>');
    const [c, b] = ids();
    await ds.saveDocument(b, '<p>b edited</p>'); // b is now the most recent
    await ds.switchDocument(c);
    await ds.removeDocument(c);
    expect(state().activeId).toBe(b);
    expect(shown.at(-1)).toEqual({ id: b, html: '<p>b edited</p>' });
    expect(await db.getDocument(c)).toBeUndefined();
  });

  it('deleting the last document leaves a fresh blank one, never a dangling id', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.removeDocument('default');
    expect(state().documents).toHaveLength(1);
    const fresh = state().documents[0];
    expect(state().activeId).toBe(fresh.id);
    expect(fresh.id).not.toBe('default');
    expect(shown.at(-1)).toEqual({ id: fresh.id, html: ds.BLANK_HTML });
    expect(localStorage.getItem(ds.ACTIVE_DOC_KEY)).toBe(fresh.id);
  });

  it('a late autosave cannot bring a deleted document back', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.createDocument('<p>b</p>');
    const b = state().activeId;
    await ds.removeDocument(b);
    await ds.saveDocument(b, '<p>late</p>');
    expect(ids()).not.toContain(b);
    expect(await db.getDocument(b)).toBeUndefined();
  });

  it('never loses the pending save of the document being switched away from', async () => {
    await ds.initDocuments('<p>a</p>');
    await ds.createDocument('<p>b</p>');
    const b = state().activeId;
    // The editor captured id b for this edit; the save only lands after the switch.
    await ds.switchDocument('default');
    await ds.saveDocument(b, '<p>b, last keystrokes</p>');
    expect((await db.getDocument(b))?.html).toBe('<p>b, last keystrokes</p>');
    expect((await db.getDocument('default'))?.html).toBe('<p>a</p>');
  });
});

describe('fallback', () => {
  it('stays single-document on localStorage when IndexedDB is unavailable', async () => {
    // @ts-expect-error simulate a browser without IndexedDB
    delete globalThis.indexedDB;
    localStorage.setItem('glossly-document', '<p>alt</p>');
    expect(await ds.initDocuments('<p>default</p>')).toEqual({ id: 'default', html: '<p>alt</p>' });
    expect(state().backend).toBe('localStorage');
    await ds.saveDocument('default', '<p>neu</p>');
    expect(localStorage.getItem('glossly-document')).toBe('<p>neu</p>');
  });
});

describe('relativeTime', () => {
  it('reads naturally', () => {
    const now = 10 * 24 * 3_600_000;
    expect(ds.relativeTime(now - 10_000, now)).toBe('just now');
    expect(ds.relativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(ds.relativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(ds.relativeTime(now - 24 * 3_600_000, now)).toBe('yesterday');
  });
});

describe('placeholder titles from WP1', () => {
  it('are replaced on open without changing updatedAt', async () => {
    await db.putDocument({ id: 'default', title: 'Untitled', titleManual: false, createdAt: 1, updatedAt: 5 }, '<h1>Echter Titel</h1>');
    await ds.initDocuments('<p>unused</p>');
    expect(state().documents[0]).toMatchObject({ title: 'Echter Titel', updatedAt: 5 });
    expect((await db.getDocumentMeta('default'))?.title).toBe('Echter Titel');
  });
});

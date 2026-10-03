import { getSchema } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { MAX_CONTEXT_CHARS } from '@glossly/shared';
import { fromMarkdown } from '../editor/markdown';
import { schemaExtensions } from '../editor/schemaExtensions';
import { detectAddress, extractContext, CONTEXT_BUDGET } from './contextExtraction';

const schema = getSchema(schemaExtensions);
const doc = (md: string) => fromMarkdown(md, schema);

/** Document range of the `nth` occurrence of `text` (which must sit inside one text node). */
function find(d: PMNode, text: string, nth = 0): { from: number; to: number } {
  const hits: number[] = [];
  d.descendants((node, pos) => {
    if (!node.isText) return;
    let at = node.text!.indexOf(text);
    while (at >= 0) {
      hits.push(pos + at);
      at = node.text!.indexOf(text, at + 1);
    }
  });
  if (hits[nth] === undefined) throw new Error(`"${text}" #${nth} not found`);
  return { from: hits[nth], to: hits[nth] + text.length };
}

function context(md: string, selection: string, { title = '', budget = 4000, nth = 0 } = {}) {
  const d = doc(md);
  const { from, to } = find(d, selection, nth);
  return extractContext(d, from, to, title, budget);
}

describe('extractContext', () => {
  it('cuts the passage at the selection, so the prompt can mark it', () => {
    const c = context('Der Zug hielt. Sie stieg langsam aus und sah sich um.', 'stieg langsam aus');
    expect(c.before).toBe('Der Zug hielt. Sie ');
    expect(c.after).toBe(' und sah sich um.');
  });

  it('tells two occurrences of the same words apart', () => {
    const md = 'Es regnete. Dann regnete es wieder.';
    expect(context(md, 'regnete', { nth: 0 }).before).toBe('Es ');
    expect(context(md, 'regnete', { nth: 1 }).before).toBe('Es regnete. Dann ');
  });

  it('fills nearest blocks first, alternating before and after', () => {
    const md = ['eins', 'zwei', 'drei', 'MITTE', 'vier', 'fünf', 'sechs'].join('\n\n');
    // Own block empty on both sides; each neighbour costs 4–5 chars + 2 for the separator.
    const c = context(md, 'MITTE', { budget: 14 });
    expect(c.before).toBe('drei\n\n');
    expect(c.after).toBe('\n\nvier');
    const wide = context(md, 'MITTE');
    expect(wide.before).toBe('eins\n\nzwei\n\ndrei\n\n');
    expect(wide.after).toBe('\n\nvier\n\nfünf\n\nsechs');
  });

  it('keeps blocks whole and stops a side at the first block that does not fit', () => {
    const md = ['kurz', 'ein sehr langer Absatz, der nicht mehr passt', 'MITTE', 'danach'].join('\n\n');
    const c = context(md, 'MITTE', { budget: 30 });
    expect(c.before).toBe('');
    expect(c.after).toBe('\n\ndanach');
  });

  it('trims an oversized own block around the selection, at word boundaries', () => {
    const words = (prefix: string) => Array.from({ length: 200 }, (_, k) => `${prefix}${k}`).join(' ');
    const md = `${words('vor')} ZIEL ${words('nach')}`;
    const c = context(md, 'ZIEL', { budget: 1000 });
    expect(c.before.startsWith('…vor')).toBe(true);
    expect(c.before.endsWith('vor199 ')).toBe(true);
    expect(c.after.startsWith(' nach0')).toBe(true);
    expect(c.after.endsWith('…')).toBe(true);
    expect(c.after).toMatch(/nach\d+…$/);
    expect(c.before.length + c.after.length).toBeLessThanOrEqual(600);
  });

  it('gives the unused share of a short side to the other', () => {
    const long = Array.from({ length: 300 }, (_, k) => `w${k}`).join(' ');
    const c = context(`${long} ZIEL.`, 'ZIEL', { budget: 1000 });
    expect(c.after).toBe('.');
    expect(c.before.length).toBeGreaterThan(550);
  });

  describe('heading path', () => {
    const md = [
      '# Mein Roman',
      '## Kapitel 1',
      'Anfang.',
      '## Kapitel 2',
      '### Der Bahnhof',
      'Der Zug hielt.',
      '### Die Stadt',
      'Sie ging los.'
    ].join('\n\n');

    it('lists the enclosing headings, a later one replacing its sibling', () => {
      expect(context(md, 'Der Zug hielt').headingPath).toEqual(['Mein Roman', 'Kapitel 2', 'Der Bahnhof']);
      expect(context(md, 'Sie ging los').headingPath).toEqual(['Mein Roman', 'Kapitel 2', 'Die Stadt']);
    });

    it('leaves out the title when it is the top heading', () => {
      expect(context(md, 'Sie ging los', { title: 'Mein Roman' }).headingPath).toEqual(['Kapitel 2', 'Die Stadt']);
    });

    it('does not repeat path headings in the passage, but keeps other ones', () => {
      const c = context(md, 'Sie ging los');
      expect(c.before).not.toContain('Kapitel 2');
      expect(c.before).not.toContain('Die Stadt');
      expect(c.before).toContain('Der Bahnhof');
    });

    it('handles a deeper heading without its parent level', () => {
      expect(context('# Titel\n\n### Tief\n\nText hier.', 'Text').headingPath).toEqual(['Titel', 'Tief']);
    });
  });

  it('treats a list as one block and keeps its items apart', () => {
    const c = context('Davor.\n\n- erster Punkt\n- zweiter Punkt\n\nDanach.', 'zweiter');
    expect(c.before).toBe('Davor.\n\nerster Punkt\n');
    expect(c.after).toBe(' Punkt\n\nDanach.');
  });

  it('works inside a blockquote', () => {
    const c = context('Davor.\n\n> Ein Zitat mit Worten.\n\nDanach.', 'Zitat');
    expect(c.before).toBe('Davor.\n\nEin ');
    expect(c.after).toBe(' mit Worten.\n\nDanach.');
  });

  it('marks a new block when the selection starts one', () => {
    const c = context('Erster Absatz.\n\nZweiter Absatz.', 'Zweiter');
    expect(c.before).toBe('Erster Absatz.\n\n');
  });

  it('counts title and headings against the budget', () => {
    const md = ['# Überschrift', 'aaaa', 'MITTE'].join('\n\n');
    expect(context(md, 'MITTE', { budget: 30 }).before).toBe('aaaa\n\n');
    expect(context(md, 'MITTE', { budget: 30, title: 'x'.repeat(20) }).before).toBe('');
  });
});

describe('detectAddress', () => {
  const address = (md: string, selection: string) => context(md, selection).address;

  it('reads the selection\'s own block first — dialogue in a novel mixes both', () => {
    const md = ['„Du musst das nicht machen", sagte Jonas.', 'Der Fährmann nickte. „Ich dachte, Sie haben noch nichts Warmes."', 'Sie ging hinaus.'].join('\n\n');
    expect(address(md, 'musst')).toBe('du');
    expect(address(md, 'nickte')).toBe('Sie');
  });

  it('falls back to the document when the own block has no address', () => {
    const md = ['Räume deinen Schreibtisch leer.', 'Nimm deinen Laptop mit.', 'Wer sie nicht einlöst, verliert sie.'].join('\n\n');
    expect(address(md, 'einlöst')).toBe('du');
  });

  it('gives no hint when the document mixes both forms', () => {
    const md = ['Du musst gehen, sagte er.', 'Du kannst bleiben.', 'Kommen Sie mit, sagte sie. Ich bitte Sie.', 'Die Nacht war kalt.'].join('\n\n');
    expect(address(md, 'Nacht')).toBeUndefined();
  });

  it('needs more than one form in the document', () => {
    expect(address('Kannst du kommen?\n\nDie Nacht war kalt.', 'Nacht')).toBeUndefined();
  });

  it('does not take sentence-initial or lowercase "sie" for formal address', () => {
    const md = ['Sie stieg aus. Sie ging los.', 'Ihr Koffer war schwer, und sie trug ihn.', 'Die Nacht war kalt.'].join('\n\n');
    expect(address(md, 'Nacht')).toBeUndefined();
  });

  it('counts formal address mid-sentence and after a quote', () => {
    const md = ['Wir danken Ihnen für Ihre Nachricht.', 'Bitte senden Sie uns die Unterlagen.', 'Die Frist endet im Mai.'].join('\n\n');
    expect(address(md, 'Frist')).toBe('Sie');
    expect(detectAddress(doc('„Sie sind spät dran."'), '„Sie sind spät dran."')).toBeUndefined();
  });

  it('is left out of an English document', () => {
    expect(address('Please let me know. I would like to discuss it with you.', 'discuss')).toBeUndefined();
  });
});

describe('CONTEXT_BUDGET', () => {
  it('fits what the server accepts, with room for title and headings', () => {
    expect(CONTEXT_BUDGET).toBeLessThanOrEqual(MAX_CONTEXT_CHARS / 2);
  });
});

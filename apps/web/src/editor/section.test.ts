import { getSchema } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from './markdown';
import { emptyParagraphPos } from './emptyPlaceholder';
import { hasSectionMarkup, regroupSections } from './section';
import { schemaExtensions } from './schemaExtensions';

const schema = getSchema(schemaExtensions);

/** Each block as the text of its children, so a test reads like the split it expects. */
const split = (doc: PMNode) => {
  const out: string[][] = [];
  doc.forEach((section) => {
    const parts: string[] = [];
    section.forEach((n) => void parts.push(n.textContent));
    out.push(parts);
  });
  return out;
};
const splitOf = (md: string) => split(fromMarkdown(md, schema));

describe('rule A — splitting content that has no blocks yet', () => {
  it('keeps a document without headings in one block', () => {
    expect(splitOf('eins\n\nzwei\n\n- drei')).toEqual([['eins', 'zwei', 'drei']]);
  });

  it('opens a block at every H2', () => {
    expect(splitOf('Intro\n\n## A\n\neins\n\n## B\n\nzwei')).toEqual([['Intro'], ['A', 'eins'], ['B', 'zwei']]);
  });

  it('does not split before a document that starts with a heading', () => {
    expect(splitOf('## A\n\neins')).toEqual([['A', 'eins']]);
  });

  it('keeps a title and the chapter heading under it together', () => {
    expect(splitOf('# Titel\n\n## Kapitel 1\n\nText\n\n## Kapitel 2\n\nmehr')).toEqual([
      ['Titel', 'Kapitel 1', 'Text'],
      ['Kapitel 2', 'mehr']
    ]);
  });

  it('opens a block at H1 too, but not at H3 and below', () => {
    expect(splitOf('a\n\n# Teil\n\nb\n\n### Unter\n\nc\n\n#### Tief\n\nd')).toEqual([
      ['a'],
      ['Teil', 'b', 'Unter', 'c', 'Tief', 'd']
    ]);
  });

  it('keeps lists, quotes, code and images inside the block they follow', () => {
    const md = '## A\n\n- x\n\n> Zitat\n\n```\ncode\n```\n\n![Bild](x.png)\n\n## B\n\nende';
    const doc = fromMarkdown(md, schema);
    expect(doc.childCount).toBe(2);
    const types: string[] = [];
    doc.firstChild!.forEach((n) => void types.push(n.type.name));
    expect(types).toEqual(['heading', 'bulletList', 'blockquote', 'codeBlock', 'image']);
  });

  it('gives an empty document one block holding an empty paragraph', () => {
    const doc = fromMarkdown('', schema);
    expect(doc.childCount).toBe(1);
    expect(doc.firstChild!.firstChild!.type.name).toBe('paragraph');
  });

  it('never changes the text', () => {
    const md = '# T\n\nIntro *kursiv*\n\n## A\n\n1. eins\n2. zwei\n\n## B\n\n> q\n\nEnde';
    const doc = fromMarkdown(md, schema);
    expect(toMarkdown(doc)).toBe(md);
    expect(doc.textContent).toBe('TIntro kursivAeinszweiBqEnde');
  });

  it('is idempotent', () => {
    const doc = fromMarkdown('a\n\n## B\n\nb\n\n## C\n\nc', schema);
    expect(regroupSections(doc).eq(doc)).toBe(true);
  });

  it('starts every block unnamed', () => {
    fromMarkdown('a\n\n## B\n\nb', schema).forEach((s) => expect(s.attrs.name).toBe(''));
  });
});

describe('hasSectionMarkup', () => {
  it('recognises saved blocks, named or not', () => {
    expect(hasSectionMarkup('<section data-block=""><p>x</p></section>')).toBe(true);
    expect(hasSectionMarkup('<section data-block="Einstieg"><p>x</p></section>')).toBe(true);
  });

  it('reads HTML from before Phase 5 as unsplit', () => {
    expect(hasSectionMarkup('<h2>Start</h2><p>x</p>')).toBe(false);
    expect(hasSectionMarkup('<section><p>pasted</p></section>')).toBe(false);
    expect(hasSectionMarkup('<p>data-block in text</p>')).toBe(false);
  });
});

describe('emptyParagraphPos', () => {
  it('finds the paragraph of a cleared document', () => {
    expect(emptyParagraphPos(fromMarkdown('', schema))).toBe(1);
  });

  it('ignores a document with text, a second block or an empty heading', () => {
    expect(emptyParagraphPos(fromMarkdown('a', schema))).toBeNull();
    expect(emptyParagraphPos(schema.node('doc', null, [schema.node('section', null, [schema.node('heading', { level: 2 })])]))).toBeNull();
    const empty = () => schema.node('section', null, [schema.node('paragraph')]);
    expect(emptyParagraphPos(schema.node('doc', null, [empty(), empty()]))).toBeNull();
  });
});

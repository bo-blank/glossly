import { getSchema } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { blockPreview, gapAt, gapToIndex, groupByBlock } from './blockDnd';
import { schemaExtensions } from './schemaExtensions';

const schema = getSchema(schemaExtensions);
const sec = (name: string, ...children: PMNode[]) => schema.node('section', { name }, children);
const p = (text: string) => schema.node('paragraph', null, text ? schema.text(text) : undefined);
const h = (text: string) => schema.node('heading', { level: 2 }, schema.text(text));

/** Table-of-contents items as the extension reports them: one per heading, at its position. */
function tocItems(doc: PMNode) {
  const items: { pos: number; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') items.push({ pos, text: node.textContent });
  });
  return items;
}

describe('groupByBlock', () => {
  const doc = schema.node('doc', null, [
    sec('', h('Titel'), p('a'), h('Unter'), p('b')),
    sec('', p('Ein Block ganz ohne Überschrift hier')),
    sec('Schluss', p('Gruß')),
    sec('', h('Erste Zeile'), p('c'))
  ]);
  const groups = groupByBlock(doc, tocItems(doc));

  it('puts each heading under its block, a block with two headings keeps both', () => {
    expect(groups.map((g) => g.headings.map((i) => i.text))).toEqual([['Titel', 'Unter'], [], [], ['Erste Zeile']]);
    expect(groups.map((g) => g.index)).toEqual([0, 1, 2, 3]);
  });

  it('labels a block without headings by its name, else its first words (decision E)', () => {
    expect(groups[1].label).toBe('Ein Block ganz ohne …');
    expect(groups[2].label).toBe('Schluss');
  });

  it('ignores items whose position no longer exists', () => {
    expect(groupByBlock(doc, [{ pos: 10_000 }]).every((g) => g.headings.length === 0)).toBe(true);
  });
});

describe('blockPreview', () => {
  it('keeps short blocks whole and names an empty one', () => {
    expect(blockPreview(sec('', p('Kurz und gut')))).toBe('Kurz und gut');
    expect(blockPreview(sec('', p('')))).toBe('Empty block');
  });

  it('does not glue words across paragraphs', () => {
    expect(blockPreview(sec('', p('eins'), p('zwei')))).toBe('eins zwei');
  });
});

describe('gapAt / gapToIndex', () => {
  const extents = [
    { top: 0, bottom: 20 },
    { top: 30, bottom: 70 },
    { top: 80, bottom: 100 }
  ];

  it('finds the gap nearest the pointer', () => {
    expect(gapAt(5, extents)).toBe(0);
    expect(gapAt(15, extents)).toBe(1);
    expect(gapAt(60, extents)).toBe(2);
    expect(gapAt(95, extents)).toBe(3);
  });

  it('turns a gap into the index after the move; the gaps around the block are no-ops', () => {
    expect(gapToIndex(2, 0)).toBe(0);
    expect(gapToIndex(0, 3)).toBe(2);
    expect(gapToIndex(1, 1)).toBe(1);
    expect(gapToIndex(1, 2)).toBe(1);
  });
});

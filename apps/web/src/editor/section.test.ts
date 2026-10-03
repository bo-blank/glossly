import { getSchema } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from './markdown';
import { emptyParagraphPos } from './emptyPlaceholder';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { hasSectionMarkup, joinSectionBackward, joinSectionForward, regroupSections, renameSection, splitSection } from './section';
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

/** A state with the cursor at `|` in the text (searched across the whole document). */
function stateAt(doc: PMNode, marker: string, nth = 0): EditorState {
  let at = -1;
  let seen = 0;
  doc.descendants((n, pos) => {
    if (at >= 0 || !n.isText) return;
    let i = n.text!.indexOf(marker);
    while (i >= 0) {
      if (seen++ === nth) {
        at = pos + i;
        return;
      }
      i = n.text!.indexOf(marker, i + 1);
    }
  });
  if (at < 0) throw new Error(`${marker} not found`);
  const state = EditorState.create({ doc });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, at)));
}

function run(command: Command, state: EditorState): EditorState | null {
  let next: EditorState | null = null;
  const ok = command(state, (tr) => void (next = state.apply(tr)));
  return ok ? next : null;
}

const named = (doc: PMNode) => {
  const out: string[] = [];
  doc.forEach((s) => void out.push(`${s.attrs.name}|${split(schema.node('doc', null, [s]))[0].join(' / ')}`));
  return out;
};
const sec = (name: string, ...children: PMNode[]) => schema.node('section', { name }, children);
const p = (text: string) => schema.node('paragraph', null, text ? schema.text(text) : undefined);
const docOf = (...sections: PMNode[]) => schema.node('doc', null, sections);

describe('splitSection (Mod+Shift+Enter)', () => {
  it('splits a paragraph and its block at the cursor', () => {
    const doc = docOf(sec('A', p('eins'), p('vorher nachher'), p('drei')));
    const next = run(splitSection, stateAt(doc, 'nachher'))!;
    expect(named(next.doc)).toEqual(['A|eins / vorher ', '|nachher / drei']);
    expect(next.selection.$from.index(0)).toBe(1);
  });

  it('splits before a paragraph when the cursor is at its start, without an empty paragraph', () => {
    const doc = docOf(sec('', p('eins'), p('zwei')));
    expect(named(run(splitSection, stateAt(doc, 'zwei'))!.doc)).toEqual(['|eins', '|zwei']);
  });

  it('starts an empty paragraph in the new block at the end of a paragraph', () => {
    const doc = docOf(sec('', p('eins'), p('zwei')));
    const state = stateAt(doc, 'zwei');
    const end = state.apply(state.tr.setSelection(TextSelection.create(state.doc, state.selection.from + 4)));
    expect(named(run(splitSection, end)!.doc)).toEqual(['|eins / zwei', '|']);
  });

  it('does nothing at the start of a block', () => {
    expect(run(splitSection, stateAt(docOf(sec('', p('eins'))), 'eins'))).toBeNull();
  });

  it('splits before a whole list when the cursor is inside it', () => {
    const doc = fromMarkdown('eins\n\n- a\n- b', schema);
    expect(named(run(splitSection, stateAt(doc, 'b'))!.doc)).toEqual(['|eins', '|ab']);
  });

  it('leaves the text alone', () => {
    const doc = docOf(sec('', p('eins zwei drei')));
    expect(run(splitSection, stateAt(doc, 'zwei'))!.doc.textContent).toBe(doc.textContent);
  });
});

describe('joinSectionBackward / joinSectionForward', () => {
  const two = () => docOf(sec('Erster', p('eins'), p('ende')), sec('Zweiter', p('zwei'), p('mehr')));

  it('Backspace at the very start of a block merges it into the one before, paragraphs apart', () => {
    const next = run(joinSectionBackward, stateAt(two(), 'zwei'))!;
    expect(named(next.doc)).toEqual(['Erster|eins / ende / zwei / mehr']);
  });

  it('keeps the second name when the first block had none', () => {
    const doc = docOf(sec('', p('eins')), sec('Zweiter', p('zwei')));
    expect(named(run(joinSectionBackward, stateAt(doc, 'zwei'))!.doc)).toEqual(['Zweiter|eins / zwei']);
  });

  it('leaves Backspace alone elsewhere: mid-block, mid-paragraph, first block', () => {
    expect(run(joinSectionBackward, stateAt(two(), 'mehr'))).toBeNull();
    expect(run(joinSectionBackward, stateAt(two(), 'wei'))).toBeNull();
    expect(run(joinSectionBackward, stateAt(two(), 'eins'))).toBeNull();
  });

  it('Delete at the very end of a block merges the next one into it', () => {
    const state = stateAt(two(), 'ende');
    const end = state.apply(state.tr.setSelection(TextSelection.create(state.doc, state.selection.from + 4)));
    expect(named(run(joinSectionForward, end)!.doc)).toEqual(['Erster|eins / ende / zwei / mehr']);
  });

  it('leaves Delete alone at the end of the last block', () => {
    const state = stateAt(two(), 'mehr');
    const end = state.apply(state.tr.setSelection(TextSelection.create(state.doc, state.selection.from + 4)));
    expect(run(joinSectionForward, end)).toBeNull();
  });

  it('treats the start of a list at the top of a block as the block start', () => {
    const doc = docOf(sec('', p('eins')), schema.node('section', null, fromMarkdown('- a\n- b', schema).firstChild!.content));
    expect(named(run(joinSectionBackward, stateAt(doc, 'a'))!.doc)).toEqual(['|eins / ab']);
  });
});

describe('renameSection', () => {
  it('names, renames and unnames a block, cleaned', () => {
    const state = EditorState.create({ doc: docOf(sec('', p('x')), sec('B', p('y'))) });
    const second = state.doc.firstChild!.nodeSize;
    const a = run(renameSection(0, '  Ein   Name '), state)!;
    expect(a.doc.firstChild!.attrs.name).toBe('Ein Name');
    expect(run(renameSection(second, ''), a)!.doc.child(1).attrs.name).toBe('');
  });

  it('does nothing for an unchanged name or a position that is no block', () => {
    const state = EditorState.create({ doc: docOf(sec('A', p('x'))) });
    expect(run(renameSection(0, 'A'), state)).toBeNull();
    expect(run(renameSection(1, 'B'), state)).toBeNull();
  });
});

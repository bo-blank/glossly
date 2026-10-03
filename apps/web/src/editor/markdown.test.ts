import { getSchema } from '@tiptap/core';
import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from './markdown';
import { schemaExtensions } from './schemaExtensions';

const schema = getSchema(schemaExtensions);
const roundTrip = (md: string) => toMarkdown(fromMarkdown(md, schema));
/** The parsed blocks' contents as one section, for tests about the nodes rather than the block split. */
const body = (md: string) => {
  const nodes: PMNode[] = [];
  fromMarkdown(md, schema).forEach((section) => section.forEach((n) => void nodes.push(n)));
  return schema.nodes.section.create(null, nodes);
};

describe('markdown round trip', () => {
  it.each([
    ['headings', '# Titel\n\n## Kapitel\n\n###### Tief'],
    ['bullet list', '- eins\n- zwei\n- drei'],
    ['ordered list', '1. eins\n2. zwei'],
    ['ordered list with start', '3. drei\n4. vier'],
    ['blockquote', '> Zitat\n>\n> zweiter Absatz'],
    ['code block with language', '```ts\nconst x = 1;\n```'],
    ['code block without language', '```\nplain\n```'],
    ['image with alt text', '![Ein Foto](glossly-blob:abc)'],
    ['link', '[Glossly](https://example.com)'],
    ['link with a title', '[Glossly](https://example.com "Startseite")'],
    ['inline marks', '**fett** *kursiv* ~~durch~~ `code`'],
    ['horizontal rule', 'oben\n\n---\n\nunten'],
    ['nested lists', '- eins\n  - eins a\n  - eins b\n- zwei\n  1. nummeriert']
  ])('%s', (_, md) => {
    expect(roundTrip(md)).toBe(md);
  });

  it('turns GFM task items into a task list and back', () => {
    const md = '- [ ] offen\n- [x] erledigt';
    const doc = body(md);
    expect(doc.firstChild?.type.name).toBe('taskList');
    expect(doc.firstChild?.child(1).attrs.checked).toBe(true);
    expect(roundTrip(md)).toBe(md);
  });

  it('keeps a list with only some checkbox-looking items a bullet list', () => {
    const doc = body('- [ ] offen\n- normal');
    expect(doc.firstChild?.type.name).toBe('bulletList');
  });
});

describe('lossy marks', () => {
  it('degrade to their text instead of throwing', () => {
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            { type: 'text', text: 'markiert', marks: [{ type: 'highlight', attrs: { color: '#ff0' } }] },
            { type: 'text', text: ' unter', marks: [{ type: 'underline' }] },
            { type: 'text', text: ' H' },
            { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
            { type: 'text', text: 'O x' },
            { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
            { type: 'text', text: ' rot', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] }
          ]
        }
      ]
    });
    expect(toMarkdown(doc)).toBe('markiert unter H2O x2 rot');
  });
});

describe('images', () => {
  it('lets the exporter swap a stored reference for embeddable data', () => {
    const doc = fromMarkdown('![Foto](glossly-blob:abc)', schema);
    const md = toMarkdown(doc, (src) => (src === 'glossly-blob:abc' ? 'data:image/png;base64,AAAA' : src));
    expect(md).toBe('![Foto](data:image/png;base64,AAAA)');
  });
});

describe('images inside text', () => {
  const types = (md: string) => {
    const out: string[] = [];
    body(md).forEach((n) => void out.push(n.type.name));
    return out;
  };

  it('splits the paragraph around an image, keeping the words', () => {
    expect(types('vorher ![Foto](x.png) nachher')).toEqual(['paragraph', 'image', 'paragraph']);
    expect(toMarkdown(fromMarkdown('vorher ![Foto](x.png) nachher', schema))).toBe('vorher\n\n![Foto](x.png)\n\nnachher');
  });

  it('keeps a list item valid when it starts with an image', () => {
    const doc = body('- ![Foto](x.png)\n- Text');
    const item = doc.firstChild!.firstChild!;
    expect(item.firstChild!.type.name).toBe('paragraph');
    expect(item.child(1).type.name).toBe('image');
  });
});

describe('raw HTML', () => {
  it('drops HTML comments', () => {
    const doc = body('# markdown-it <!-- omit in toc -->\n\n<!-- note -->\n\ntext');
    expect(doc.firstChild?.textContent).toBe('markdown-it');
    expect(doc.childCount).toBe(2);
  });

  it('keeps other HTML as literal text, never as markup', () => {
    const doc = body('<details><summary>Mehr</summary></details>\n\nein <b>fett</b> wort');
    expect(doc.firstChild?.textContent).toBe('<details><summary>Mehr</summary></details>');
    expect(doc.child(1).textContent).toBe('ein <b>fett</b> wort');
    let marked = false;
    doc.descendants((n) => void (n.marks.length && (marked = true)));
    expect(marked).toBe(false);
  });
});

describe('importing a README written elsewhere', () => {
  it('lands headings, lists, code fences and links as real nodes', () => {
    const readme = [
      '# Project',
      '',
      'Some *intro* with a [link](https://example.com).',
      '',
      '## Install',
      '',
      '```bash',
      'npm install',
      '```',
      '',
      '* star bullet',
      '* another',
      '',
      '1) paren list',
      '2) second'
    ].join('\n');
    const doc = body(readme);
    const types: string[] = [];
    doc.forEach((n) => void types.push(n.type.name));
    expect(types).toEqual(['heading', 'paragraph', 'heading', 'codeBlock', 'bulletList', 'orderedList']);
    expect(doc.child(3).attrs.language).toBe('bash');
    let linked = false;
    doc.descendants((n) => {
      if (n.marks.some((m) => m.type.name === 'link' && m.attrs.href === 'https://example.com')) linked = true;
    });
    expect(linked).toBe(true);
  });
});

describe('block markers', () => {
  const sec = (name: string, ...texts: string[]) =>
    schema.node('section', { name }, texts.map((t) => (t.startsWith('## ') ? schema.node('heading', { level: 2 }, schema.text(t.slice(3))) : schema.node('paragraph', null, schema.text(t)))));
  const docOf = (...sections: PMNode[]) => schema.node('doc', null, sections);
  const names = (md: string) => {
    const out: string[] = [];
    fromMarkdown(md, schema).forEach((s) => void out.push(`${s.attrs.name}:${s.childCount}`));
    return out;
  };

  it('writes no markers when the blocks follow from the headings', () => {
    expect(toMarkdown(docOf(sec('', 'Intro'), sec('', '## A', 'eins')))).toBe('Intro\n\n## A\n\neins');
  });

  it('writes a marker before every block once one is named', () => {
    const md = toMarkdown(docOf(sec('Einstieg', 'Intro'), sec('', '## A', 'eins')));
    expect(md).toBe('<!-- block: Einstieg -->\n\nIntro\n\n<!-- block -->\n\n## A\n\neins');
  });

  it('writes markers for a split the headings do not explain', () => {
    expect(toMarkdown(docOf(sec('', 'eins'), sec('', 'zwei')))).toBe('<!-- block -->\n\neins\n\n<!-- block -->\n\nzwei');
  });

  it('round-trips names and splits', () => {
    const doc = docOf(sec('Einstieg', 'Intro'), sec('', 'mehr'), sec('These', '## A', 'eins'));
    expect(fromMarkdown(toMarkdown(doc), schema).eq(doc)).toBe(true);
  });

  it('reads markers as block borders, not as text', () => {
    expect(names('<!-- block: Eins -->\n\na\n\nb\n\n<!-- block: Zwei -->\n\nc')).toEqual(['Eins:2', 'Zwei:1']);
    expect(fromMarkdown('<!-- block -->\n\na', schema).textContent).toBe('a');
  });

  it('puts text before the first marker into an unnamed block of its own', () => {
    expect(names('vorher\n\n<!-- block: X -->\n\nnachher')).toEqual([':1', 'X:1']);
  });

  it('makes no empty block from two markers in a row', () => {
    expect(names('<!-- block: A -->\n<!-- block: B -->\n\ntext')).toEqual(['B:1']);
  });

  it('accepts a marker with the text right under it and loose spacing', () => {
    expect(names('<!--block:  Ein  Name  -->\ntext\n\n<!-- block-->\nmehr')).toEqual(['Ein Name:1', ':1']);
  });

  it('leaves a marker inside a code fence or a quote alone', () => {
    const fenced = '```\n<!-- block: X -->\n```';
    expect(names(fenced)).toEqual([':1']);
    expect(roundTrip(fenced)).toBe(fenced);
    expect(names('> <!-- block: X -->\n> zitiert')).toEqual([':1']);
  });

  it('keeps headings-only splitting for files without markers', () => {
    expect(names('a\n\n## B\n\nb')).toEqual([':1', ':2']);
  });

  it('never lets a name end the comment early', () => {
    const md = toMarkdown(docOf(sec('a --> b', 'x')));
    expect(md.split('\n')[0]).toBe('<!-- block: a — b -->');
    expect(fromMarkdown(md, schema).firstChild!.attrs.name).toBe('a — b');
  });

  it('shortens a name to one line of at most 60 characters', () => {
    const long = 'x'.repeat(80);
    expect(fromMarkdown(`<!-- block: ${long} -->\n\na`, schema).firstChild!.attrs.name).toHaveLength(60);
    expect(names('<!-- block: zwei\nZeilen -->\n\na')).toEqual(['zwei Zeilen:1']);
  });

  it('still drops other HTML comments', () => {
    expect(fromMarkdown('<!-- note -->\n\ntext', schema).textContent).toBe('text');
  });
});

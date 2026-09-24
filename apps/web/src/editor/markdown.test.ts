import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from './markdown';
import { schemaExtensions } from './schemaExtensions';

const schema = getSchema(schemaExtensions);
const roundTrip = (md: string) => toMarkdown(fromMarkdown(md, schema));

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
    const doc = fromMarkdown(md, schema);
    expect(doc.firstChild?.type.name).toBe('taskList');
    expect(doc.firstChild?.child(1).attrs.checked).toBe(true);
    expect(toMarkdown(doc)).toBe(md);
  });

  it('keeps a list with only some checkbox-looking items a bullet list', () => {
    const doc = fromMarkdown('- [ ] offen\n- normal', schema);
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
    fromMarkdown(md, schema).forEach((n) => void out.push(n.type.name));
    return out;
  };

  it('splits the paragraph around an image, keeping the words', () => {
    expect(types('vorher ![Foto](x.png) nachher')).toEqual(['paragraph', 'image', 'paragraph']);
    expect(toMarkdown(fromMarkdown('vorher ![Foto](x.png) nachher', schema))).toBe('vorher\n\n![Foto](x.png)\n\nnachher');
  });

  it('keeps a list item valid when it starts with an image', () => {
    const doc = fromMarkdown('- ![Foto](x.png)\n- Text', schema);
    const item = doc.firstChild!.firstChild!;
    expect(item.firstChild!.type.name).toBe('paragraph');
    expect(item.child(1).type.name).toBe('image');
  });
});

describe('raw HTML', () => {
  it('drops HTML comments', () => {
    const doc = fromMarkdown('# markdown-it <!-- omit in toc -->\n\n<!-- note -->\n\ntext', schema);
    expect(doc.firstChild?.textContent).toBe('markdown-it');
    expect(doc.childCount).toBe(2);
  });

  it('keeps other HTML as literal text, never as markup', () => {
    const doc = fromMarkdown('<details><summary>Mehr</summary></details>\n\nein <b>fett</b> wort', schema);
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
    const doc = fromMarkdown(readme, schema);
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

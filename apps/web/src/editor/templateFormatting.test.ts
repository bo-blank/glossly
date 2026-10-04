import { describe, expect, it } from 'vitest';
import { plainTemplateContent } from './templateFormatting';

describe('plainTemplateContent', () => {
  it('keeps bold, italic, links and code, drops every other mark', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            { type: 'text', text: 'fett', marks: [{ type: 'bold' }, { type: 'highlight', attrs: { color: '#ff0' } }] },
            { type: 'text', text: ' bunt', marks: [{ type: 'textStyle', attrs: { color: 'red' } }, { type: 'underline' }] },
            { type: 'text', text: ' link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }, { type: 'strike' }] },
            { type: 'text', text: 'x', marks: [{ type: 'subscript' }, { type: 'superscript' }] }
          ]
        }
      ]
    };
    expect(plainTemplateContent(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {},
          content: [
            { type: 'text', text: 'fett', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' bunt' },
            { type: 'text', text: ' link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
            { type: 'text', text: 'x' }
          ]
        }
      ]
    });
  });

  it('drops list colours and unchecks to-dos, keeps headings, images and code blocks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, textAlign: 'right' }, content: [{ type: 'text', text: 'Titel' }] },
        { type: 'bulletList', content: [{ type: 'listItem', attrs: { color: 'blue' }, content: [{ type: 'paragraph' }] }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' }] }] },
        { type: 'image', attrs: { src: 'glossly-blob:abc', alt: 'Foto' } },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'x', marks: [] }] }
      ]
    };
    const out = plainTemplateContent(doc).content!;
    expect(out[0].attrs).toEqual({ level: 2 });
    expect(out[1].content![0].attrs).toEqual({});
    expect(out[2].content![0].attrs).toEqual({ checked: false });
    expect(out[3].attrs).toEqual({ src: 'glossly-blob:abc', alt: 'Foto' });
    expect(out[4]).toEqual({ type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'x' }] });
  });

  it('does not change its input', () => {
    const doc = { type: 'doc', content: [{ type: 'text', text: 'a', marks: [{ type: 'underline' }] }] };
    plainTemplateContent(doc);
    expect(doc.content[0].marks).toEqual([{ type: 'underline' }]);
  });

  it('keeps the blocks and their names', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'section', attrs: { name: 'Einstieg' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
        { type: 'section', attrs: { name: '' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] }
      ]
    };
    expect(plainTemplateContent(doc)).toEqual(doc);
  });
});

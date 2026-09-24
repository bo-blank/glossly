import { describe, expect, it } from 'vitest';
import { STARTER_TEMPLATES, isDocumentDisposable } from './templates';

// Tiptap silently drops nodes no loaded extension claims, so a template written
// with an unsupported tag would lose content with no error anywhere.
const SUPPORTED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'strong',
  'em',
  's',
  'u',
  'br',
  'a',
  'img',
  'mark'
]);

function tagsIn(html: string): string[] {
  return [...html.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase());
}

describe('STARTER_TEMPLATES', () => {
  it('has unique ids', () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('labels every template', () => {
    for (const template of STARTER_TEMPLATES) {
      expect(template.name.length, template.id).toBeGreaterThan(0);
      expect(template.blurb.length, template.id).toBeGreaterThan(0);
    }
  });

  it('only uses tags the editor can parse', () => {
    for (const template of STARTER_TEMPLATES) {
      for (const tag of tagsIn(template.content)) {
        expect(SUPPORTED_TAGS.has(tag), `${template.id} uses <${tag}>`).toBe(true);
      }
    }
  });

  it('ships a blank option and prose for the rest', () => {
    const blank = STARTER_TEMPLATES.find((t) => t.id === 'blank');
    expect(blank).toBeDefined();
    expect(blank!.content.replace(/<[^>]*>/g, '').trim()).toBe('');

    for (const template of STARTER_TEMPLATES.filter((t) => t.id !== 'blank')) {
      const text = template.content.replace(/<[^>]*>/g, ' ').trim();
      expect(text.split(/\s+/).length, template.id).toBeGreaterThan(40);
    }
  });
});

describe('isDocumentDisposable', () => {
  it('treats an empty or whitespace-only document as disposable', () => {
    expect(isDocumentDisposable('')).toBe(true);
    expect(isDocumentDisposable('\n  \n')).toBe(true);
  });

  it('protects a document with any writing in it', () => {
    expect(isDocumentDisposable('a')).toBe(false);
  });
});

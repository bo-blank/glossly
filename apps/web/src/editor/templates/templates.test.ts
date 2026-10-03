import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { schemaExtensions } from '../schemaExtensions';
import { detectAddress } from '../../note/contextExtraction';
import { DE } from './de';
import { EN } from './en';
import { BLANK_TEMPLATE_ID, TEMPLATE_GROUPS, defaultTemplateLanguage, findTemplate, isDocumentDisposable } from './index';

const ALL = [...EN, ...DE];
const schema = getSchema(schemaExtensions);
const plain = (html: string) => html.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// Enough for the address count, which reads the text only; the real HTML is
// parsed by the editor in the browser check.
const docOf = (html: string) => schema.node('doc', null, [schema.node('paragraph', null, schema.text(plain(html) || ' '))]);

// Tiptap silently drops nodes no loaded extension claims, so a template written
// with an unsupported tag would lose content with no error anywhere.
const SUPPORTED_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'strong', 'em', 's', 'u', 'br', 'a', 'img', 'mark']);
const tagsIn = (html: string) => [...html.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase());

describe('templates', () => {
  it('exist in both languages with the same ids, in the same order', () => {
    expect(DE.map((t) => t.id)).toEqual(EN.map((t) => t.id));
    expect(new Set(EN.map((t) => t.id)).size).toBe(EN.length);
  });

  it('put every template but the blank page in exactly one picker group', () => {
    const grouped = TEMPLATE_GROUPS.flatMap((g) => g.ids);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped, BLANK_TEMPLATE_ID].sort()).toEqual(EN.map((t) => t.id).sort());
  });

  it.each(ALL.map((t) => [t.name, t]))('%s is labelled, uses only tags the editor parses, and has no [slots]', (_name, t) => {
    expect(t.name.length).toBeGreaterThan(0);
    expect(t.blurb.length).toBeGreaterThan(0);
    for (const tag of tagsIn(t.content)) expect(SUPPORTED_TAGS.has(tag), `${t.id} uses <${tag}>`).toBe(true);
    expect(t.content).not.toMatch(/\[[^\]]*\]/);
  });

  it('ships a blank page and real prose for the rest', () => {
    for (const t of ALL) {
      const words = plain(t.content).split(/\s+/).filter(Boolean).length;
      if (t.id === BLANK_TEMPLATE_ID) expect(words).toBe(0);
      else expect(words, `${t.id}`).toBeGreaterThan(40);
    }
  });

  it('has guide notes for every template but the blank page, as many in each language', () => {
    for (const en of EN) {
      const de = DE.find((t) => t.id === en.id)!;
      expect(de.guide).toHaveLength(en.guide.length);
      expect(en.guide.length > 0).toBe(en.id !== BLANK_TEMPLATE_ID);
      for (const note of [...en.guide, ...de.guide]) {
        expect(note.section.length).toBeGreaterThan(0);
        expect(note.hint.length).toBeLessThanOrEqual(140); // a margin note, not a lecture
      }
    }
  });

  it.each([
    ['cover-letter', 'Sie'],
    ['business-email', 'Sie'],
    ['linkedin-post', 'du'],
    ['video-script', 'du'],
    ['scene', 'du'],
    ['blog-article', undefined],
    ['essay', undefined],
    ['meeting-notes', undefined]
  ] as const)('German %s reads as %s to the address detection', (id, form) => {
    expect(detectAddress(docOf(findTemplate('de', id)!.content), '')).toBe(form);
  });
});

describe('defaultTemplateLanguage', () => {
  it.each([
    [['de-DE', 'en'], 'de'],
    [['de'], 'de'],
    [['en-US', 'de'], 'en'],
    [['fr'], 'en'],
    [[], 'en']
  ] as const)('%j → %s', (languages, expected) => {
    expect(defaultTemplateLanguage(languages)).toBe(expected);
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

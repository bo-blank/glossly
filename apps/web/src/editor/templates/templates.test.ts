import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { schemaExtensions } from '../schemaExtensions';
import { scoreSentence, splitSentences } from '../../utils/readability';
import { detectAddress } from '../../note/contextExtraction';
import { DE } from './de';
import { EN } from './en';
import { BLANK_TEMPLATE_ID, TEMPLATE_GROUPS, defaultTemplateLanguage, findTemplate, isDocumentDisposable } from './index';

const ALL = [...EN, ...DE];
const schema = getSchema(schemaExtensions);
const plain = (html: string) => html.replace(/<br>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// Enough for the address count, which reads the text only; the real HTML is
// parsed by the editor in the browser check.
const docOf = (html: string) =>
  schema.node('doc', null, [schema.node('section', null, [schema.node('paragraph', null, schema.text(plain(html) || ' '))])]);

// Tiptap silently drops nodes no loaded extension claims, so a template written
// with an unsupported tag would lose content with no error anywhere.
// Plain structure only: no highlights, colours, underline or strikethrough —
// a template is a starting draft, not a formatted document.
const ALLOWED_TAGS = new Set(['section', 'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'br']);
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

  it.each(ALL.map((t) => [t.name, t]))('%s is labelled, plainly formatted, and has no [slots]', (_name, t) => {
    expect(t.name.length).toBeGreaterThan(0);
    expect(t.blurb.length).toBeGreaterThan(0);
    for (const tag of tagsIn(t.content)) expect(ALLOWED_TAGS.has(tag), `${t.id} uses <${tag}>`).toBe(true);
    expect(t.content).not.toMatch(/\sstyle=|data-color|data-highlight/);
    expect(t.content).not.toMatch(/\[[^\]]*\]/);
  });

  // The readability highlighter marks long sentences yellow and very long ones
  // red. A template should arrive calm and show what the highlighter asks for.
  it.each(ALL.map((t) => [t.name, t]))('%s has no red and at most two yellow sentences', (_name, t) => {
    const blocks = [...t.content.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => plain(m[2])).filter(Boolean);
    const tiers = blocks.flatMap((b) => splitSentences(b).map((s) => scoreSentence(s.text)?.tier));
    expect(tiers.filter((x) => x === 'hard')).toHaveLength(0);
    expect(tiers.filter((x) => x === 'standard').length).toBeLessThanOrEqual(2);
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

  // Phase 5 decision D: a template starts as named blocks that match its guide.
  const blockNames = (html: string) => [...html.matchAll(/<section data-block="([^"]*)"/g)].map((m) => m[1]);

  it('starts every template as one named block per guide section, in guide order', () => {
    for (const t of ALL) {
      const expected = t.guide.filter((note) => !note.general).map((note) => note.section);
      expect(blockNames(t.content), `${t.id}`).toEqual(expected);
    }
  });

  it('leaves no content outside a block', () => {
    for (const t of ALL.filter((t) => t.id !== BLANK_TEMPLATE_ID)) {
      const outside = t.content.replace(/<section\b[\s\S]*?<\/section>/g, '').trim();
      expect(outside, `${t.id}`).toBe('');
    }
  });

  it('keeps general notes (no block of their own) the same in both languages', () => {
    for (const en of EN) {
      const de = DE.find((t) => t.id === en.id)!;
      expect(de.guide.map((n) => !!n.general)).toEqual(en.guide.map((n) => !!n.general));
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

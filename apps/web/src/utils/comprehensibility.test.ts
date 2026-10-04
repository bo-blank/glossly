import { describe, expect, it } from 'vitest';
import { DE } from '../editor/templates/de';
import { textTypeFor } from '../editor/templates';
import { amstad, comprehensibilityIndex, lix, measure, TARGETS } from './comprehensibility';
import { ACADEMIC_DE, PLAIN_DE, PRESS_DE } from './comprehensibility.fixtures';

// What editor.getText() gives: one line per block.
const text = (html: string) =>
  html.replace(/<\/(p|h[1-6]|li|blockquote)>/g, '\n').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();
const index = (t: string) => comprehensibilityIndex(measure(t, 'de'));

describe('comprehensibility index (German, 0–20)', () => {
  // The anchors are ours (the HIX's are not published); these pin them to the
  // Hohenheim figures: dissertations 0–5, municipal press releases around 9
  // (mean of 30 real ones: 9.17), tabloid / easy-language text 15–20.
  it('puts academic prose at the bottom', () => {
    expect(index(ACADEMIC_DE)).toBeLessThanOrEqual(5);
  });

  it('puts a typical press release near the measured mean of 9', () => {
    expect(index(PRESS_DE)).toBeGreaterThanOrEqual(7);
    expect(index(PRESS_DE)).toBeLessThanOrEqual(11);
  });

  it('puts easy-language news at the top', () => {
    expect(index(PLAIN_DE)).toBeGreaterThanOrEqual(18);
  });

  it('stays within 0–20', () => {
    for (const t of [ACADEMIC_DE, PRESS_DE, PLAIN_DE, '']) {
      const value = index(t);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it('lets every German template reach the target of its text type', () => {
    for (const t of DE.filter((t) => t.id !== 'blank')) {
      const type = textTypeFor({ template: { id: t.id } });
      expect(index(text(t.content)), `${t.id} (${type})`).toBeGreaterThanOrEqual(TARGETS.de[type]);
    }
  });
});

describe('formulas', () => {
  it('computes Amstad and LIX from the features', () => {
    const f = measure('Der Bus fährt heute. Er kommt bald.', 'de');
    // 7 words, 2 sentences; syllables: der bus fährt heu-te er kommt bald = 8
    expect(f.sentenceLength).toBe(3.5);
    expect(amstad(f)).toBeCloseTo(180 - 3.5 - 58.5 * (8 / 7));
    expect(lix(f)).toBeCloseTo(3.5 + 0);
  });
});

describe('textTypeFor', () => {
  it('holds short-form publishing to the web standard, the rest to the specialist one', () => {
    expect(textTypeFor({ template: { id: 'linkedin-post' } })).toBe('web');
    expect(textTypeFor({ template: { id: 'blog-article' } })).toBe('web');
    expect(textTypeFor({ template: { id: 'cover-letter' } })).toBe('fach');
    expect(textTypeFor(undefined)).toBe('fach');
    expect(textTypeFor({ template: { id: 'linkedin-post' }, textType: 'fach' })).toBe('fach');
  });
});

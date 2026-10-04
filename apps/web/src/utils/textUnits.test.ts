import { describe, expect, it } from 'vitest';
import { countSyllables, isPassive, splitClauses, splitSentences } from './textUnits';
import {
  DE_PASSIVE,
  DE_SYLLABLES,
  DE_SYLLABLES_HELD_OUT,
  EN_PASSIVE,
  EN_SYLLABLES,
  EN_SYLLABLES_HELD_OUT,
  SENTENCES
} from './textUnits.cases';

// Heuristics, so the bar is a hit rate on hand-counted words, not perfection.
// The held-out lists were written after the rules were tuned: they are the
// honest figure (2026-10-04: German 39/40, English 36/40). The old counter,
// with English rules for everything, got 14/25 German and 11/20 English.
const hits = (list: [string, number][], language: 'de' | 'en') =>
  list.filter(([word, n]) => countSyllables(word, language) === n).length / list.length;

describe('countSyllables', () => {
  it('counts German syllables: a final -e is spoken, diphthongs are one', () => {
    expect(countSyllables('Seite', 'de')).toBe(2);
    expect(countSyllables('heute', 'de')).toBe(2);
    expect(countSyllables('Präsentation', 'de')).toBe(4);
    expect(hits(DE_SYLLABLES, 'de')).toBeGreaterThanOrEqual(0.95);
    expect(hits(DE_SYLLABLES_HELD_OUT, 'de')).toBeGreaterThanOrEqual(0.95);
  });

  it('counts English syllables: silent -e and -ed, but "sim-ple" and "want-ed"', () => {
    expect(countSyllables('simple', 'en')).toBe(2);
    expect(countSyllables('jumped', 'en')).toBe(1);
    expect(countSyllables('wanted', 'en')).toBe(2);
    expect(hits(EN_SYLLABLES, 'en')).toBeGreaterThanOrEqual(0.95);
    expect(hits(EN_SYLLABLES_HELD_OUT, 'en')).toBeGreaterThanOrEqual(0.85);
  });
});

describe('splitSentences', () => {
  it.each(SENTENCES)('%j has %i sentence(s)', (text, n) => {
    expect(splitSentences(text)).toHaveLength(n);
  });

  it('keeps the offsets exact, for the highlighting', () => {
    const text = 'Am 14. Oktober tagte die Runde. Dr. Krüger kam z. B. später.';
    for (const span of splitSentences(text)) expect(text.slice(span.start, span.end)).toBe(span.text);
    expect(splitSentences(text).map((s) => s.text)).toEqual(['Am 14. Oktober tagte die Runde.', 'Dr. Krüger kam z. B. später.']);
  });
});

describe('splitClauses', () => {
  it('splits at commas, colons, semicolons, brackets and spaced dashes', () => {
    expect(splitClauses('Er kam, sah – und ging; dann: Ruhe (endlich).')).toHaveLength(6);
    expect(splitClauses('Ein einziger Satzteil ohne Zeichen.')).toHaveLength(1);
  });
});

describe('isPassive', () => {
  // Errs towards missing a passive rather than flagging an active sentence.
  it.each(DE_PASSIVE)('German: %s → %s', (sentence, passive) => {
    expect(isPassive(sentence, 'de')).toBe(passive);
  });

  it.each(EN_PASSIVE)('English: %s → %s', (sentence, passive) => {
    expect(isPassive(sentence, 'en')).toBe(passive);
  });
});

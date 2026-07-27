import { describe, expect, it } from 'vitest';
import {
  computeReadability,
  countSentences,
  countSyllables,
  countWords,
  labelForFleschScore,
  splitSentences,
  tierForSentenceLength
} from './readability';

describe('countWords', () => {
  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
  });

  it('counts whitespace-separated words', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('  padded   with   extra   spaces  ')).toBe(4);
  });
});

describe('countSentences', () => {
  it('returns 0 for empty text', () => {
    expect(countSentences('')).toBe(0);
  });

  it('counts terminator-delimited sentences', () => {
    expect(countSentences('One. Two! Three?')).toBe(3);
  });

  it('treats text without a terminator as one sentence', () => {
    expect(countSentences('no punctuation here')).toBe(1);
  });

  it('does not double-count clustered terminators', () => {
    expect(countSentences('Really?! Yes.')).toBe(2);
  });
});

describe('countSyllables', () => {
  it('counts short words as one syllable', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('a')).toBe(1);
  });

  it('counts vowel groups', () => {
    expect(countSyllables('window')).toBe(2);
    expect(countSyllables('elephant')).toBe(3);
  });

  it('keeps German umlauts as vowels', () => {
    // Regression: stripping to a-z turned "über" into "ber" (1 syllable).
    expect(countSyllables('über')).toBe(2);
  });

  it('never returns less than one syllable', () => {
    expect(countSyllables('rhythm')).toBeGreaterThanOrEqual(1);
  });
});

describe('splitSentences', () => {
  it('returns spans with correct offsets', () => {
    const spans = splitSentences('One two. Three four!');
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ text: 'One two.', start: 0 });
    expect(spans[1].text).toBe('Three four!');
    expect(spans[1].start).toBe(9);
  });

  it('includes a trailing fragment without terminator', () => {
    const spans = splitSentences('Done. still typing');
    expect(spans).toHaveLength(2);
    expect(spans[1].text).toBe('still typing');
  });

  it('returns nothing for empty text', () => {
    expect(splitSentences('')).toEqual([]);
  });
});

describe('tierForSentenceLength', () => {
  it('leaves short sentences unmarked', () => {
    expect(tierForSentenceLength(14)).toBeNull();
  });

  it('marks medium sentences as standard', () => {
    expect(tierForSentenceLength(15)).toBe('standard');
    expect(tierForSentenceLength(24)).toBe('standard');
  });

  it('marks long sentences as hard', () => {
    expect(tierForSentenceLength(25)).toBe('hard');
  });
});

describe('labelForFleschScore', () => {
  it('maps scores to the documented bands', () => {
    expect(labelForFleschScore(95)).toBe('Very Easy');
    expect(labelForFleschScore(65)).toBe('Standard');
    expect(labelForFleschScore(10)).toBe('Very Confusing');
  });
});

describe('computeReadability', () => {
  it('handles empty documents without dividing by zero', () => {
    const result = computeReadability('');
    expect(result.words).toBe(0);
    expect(result.fleschReadingEase).toBeNull();
    expect(result.readabilityLabel).toBe('Not enough text');
  });

  it('computes plausible scores for simple prose', () => {
    const result = computeReadability('The cat sat on the mat. The dog ran to the park.');
    expect(result.words).toBe(12);
    expect(result.sentences).toBe(2);
    expect(result.fleschReadingEase).toBeGreaterThan(80);
    expect(result.readingTimeMinutes).toBeCloseTo(12 / 200);
  });

  it('prefers precomputed counts when provided', () => {
    const result = computeReadability('one two three', { words: 99, characters: 500 });
    expect(result.words).toBe(99);
    expect(result.characters).toBe(500);
  });
});

import { describe, expect, it } from 'vitest';
import {
  computeReadability,
  countSyllables,
  countWords,
  labelForFleschScore,
  splitSentences,
  scoreSentence,
  tierForSentenceLength
} from './readability';

describe('countWords', () => {
  it('does not count dashes, middots or lone quote marks as words', () => {
    expect(countWords('Die Arbeit wurde kleiner – und damit endlich abschließbar.')).toBe(8);
    expect(countWords('Lena — Tom · „ Mara “')).toBe(3);
    expect(countWords('Seit 2026 – mit v2.0')).toBe(4);
  });

  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
  });

  it('counts whitespace-separated words', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('  padded   with   extra   spaces  ')).toBe(4);
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
    expect(countSyllables('über', 'de')).toBe(2);
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
    // A lowercase word after a period continues the sentence ("ca. drei"), so
    // the fragment here starts with a capital.
    const spans = splitSentences('Done. Still typing');
    expect(spans).toHaveLength(2);
    expect(spans[1].text).toBe('Still typing');
  });

  it('returns nothing for empty text', () => {
    expect(splitSentences('')).toEqual([]);
  });
});

describe('tierForSentenceLength', () => {
  it('leaves sentences under 20 words unmarked', () => {
    expect(tierForSentenceLength(15)).toBeNull();
    expect(tierForSentenceLength(19)).toBeNull();
  });

  it('marks 20 to 29 words as standard', () => {
    expect(tierForSentenceLength(20)).toBe('standard');
    expect(tierForSentenceLength(29)).toBe('standard');
  });

  it('marks 30 words and more as hard', () => {
    expect(tierForSentenceLength(30)).toBe('hard');
  });

  it('does not let a dash tip a sentence over the limit', () => {
    const nineteen = 'Eins zwei drei vier fünf sechs sieben acht neun zehn – elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn.';
    expect(scoreSentence(nineteen)).toBeNull();
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
  const long = (sentence: string, times: number) => Array(times).fill(sentence).join(' ');

  it('handles empty documents without dividing by zero', () => {
    const result = computeReadability('');
    expect(result.words).toBe(0);
    expect(result.score).toBeNull();
    expect(result.sentenceLength).toBe(0);
  });

  it('gives no score below 50 words, but counts the barriers', () => {
    const result = computeReadability('Das Budget wurde gestern beschlossen. Der Rest kommt morgen.');
    expect(result.score).toBeNull();
    expect(result.barriers.passive.count).toBe(1);
  });

  it('scores German text on the 0–20 index and English text with Flesch', () => {
    const de = computeReadability(long('Der Bus fährt ab Montag öfter und das ist gut für die Stadt.', 6));
    expect(de.language).toBe('de');
    expect(de.score).toBeGreaterThan(14);
    expect(de.score).toBeLessThanOrEqual(20);
    const en = computeReadability(long('The cat sat on the mat and the dog ran to the park.', 6));
    expect(en.language).toBe('en');
    expect(en.score).toBeGreaterThan(80);
  });

  it('falls back to the given language when the text does not say', () => {
    expect(computeReadability('Workshops Budget', { fallbackLanguage: 'de' }).language).toBe('de');
    expect(computeReadability('Workshops Budget').language).toBe('en');
  });

  it('reads German slower than English', () => {
    expect(computeReadability('und der die das ist', { words: 180 }).readingTimeMinutes).toBeCloseTo(1);
    expect(computeReadability('the and is not we', { words: 230 }).readingTimeMinutes).toBeCloseTo(1);
  });

  it('ends a sentence at a line break, so headings do not merge into the next sentence', () => {
    const result = computeReadability('Die Hauptidee\nEine Seite ohne Zuständige zieht nicht um.');
    expect(result.sentences).toBe(2);
  });

  it('prefers precomputed counts when provided', () => {
    const result = computeReadability('one two three', { words: 99, characters: 500 });
    expect(result.words).toBe(99);
    expect(result.characters).toBe(500);
  });
});

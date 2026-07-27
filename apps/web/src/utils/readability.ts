// utils/readability.ts
export interface ReadabilityResult {
  words: number;
  characters: number;
  sentences: number;
  syllables: number;
  readingTimeMinutes: number;
  fleschReadingEase: number | null;
  fleschKincaidGrade: number | null;
  readabilityLabel: string;
}

const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[.!?]+(?:\s|$)/g);
  return matches ? matches.length : 1;
}

export function countSyllables(word: string): number {
  // Keep umlauts/ß - stripping them to plain a-z was deleting whole vowel
  // sounds (e.g. "über" -> "ber"), badly undercounting non-English words.
  const cleaned = word.toLowerCase().replace(/[^a-zäöüß]/g, '');
  if (cleaned.length <= 3) return 1;
  const stripped = cleaned.replace(/(?:[^laeiouyäöü]es|ed|e)$/, '');
  const groups = stripped.match(/[aeiouyäöü]{1,2}/g);
  return groups ? Math.max(1, groups.length) : 1;
}

function totalSyllables(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.reduce((sum, word) => sum + countSyllables(word), 0);
}

export function estimateReadingTimeMinutes(words: number, wordsPerMinute = WORDS_PER_MINUTE): number {
  return words / wordsPerMinute;
}

export function fleschReadingEase(words: number, sentences: number, syllables: number): number {
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export function fleschKincaidGrade(words: number, sentences: number, syllables: number): number {
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

export function labelForFleschScore(score: number): string {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Confusing';
}

export type ReadabilityTier = 'standard' | 'hard';

export interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

export function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const re = /[^.!?]*[.!?]+(?:\s+|$)|[^.!?]+$/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const trimmedEnd = match[0].replace(/\s+$/, '');
    if (trimmedEnd.trim().length > 0) {
      const start = match.index;
      spans.push({ text: trimmedEnd, start, end: start + trimmedEnd.length });
    }
    if (match.index === re.lastIndex) re.lastIndex += 1;
  }
  return spans;
}

// Sentence-length thresholds (Hemingway-style) instead of per-sentence Flesch:
// the Flesch formula's word/sentence and syllable/word averages aren't
// statistically meaningful on a single short sentence, and its constants are
// calibrated for English, so it misreads any other language (e.g. German's
// naturally higher syllables-per-word). Raw word count is a much more stable,
// language-agnostic proxy for how hard a sentence is to follow.
const STANDARD_WORD_THRESHOLD = 14;
const HARD_WORD_THRESHOLD = 25;

export function tierForSentenceLength(wordCount: number): ReadabilityTier | null {
  if (wordCount >= HARD_WORD_THRESHOLD) return 'hard';
  if (wordCount > STANDARD_WORD_THRESHOLD) return 'standard';
  return null;
}

export function scoreSentence(text: string): { words: number; tier: ReadabilityTier } | null {
  const words = countWords(text);
  const tier = tierForSentenceLength(words);
  return tier ? { words, tier } : null;
}

export function computeReadability(
  text: string,
  precomputed?: { words?: number; characters?: number }
): ReadabilityResult {
  const words = precomputed?.words ?? countWords(text);
  const characters = precomputed?.characters ?? text.length;

  if (words === 0) {
    return {
      words: 0,
      characters,
      sentences: 0,
      syllables: 0,
      readingTimeMinutes: 0,
      fleschReadingEase: null,
      fleschKincaidGrade: null,
      readabilityLabel: 'Not enough text'
    };
  }

  const sentences = countSentences(text);
  const syllables = totalSyllables(text);
  const fre = fleschReadingEase(words, sentences, syllables);
  const fkGrade = fleschKincaidGrade(words, sentences, syllables);

  return {
    words,
    characters,
    sentences,
    syllables,
    readingTimeMinutes: estimateReadingTimeMinutes(words),
    fleschReadingEase: fre,
    fleschKincaidGrade: fkGrade,
    readabilityLabel: labelForFleschScore(fre)
  };
}

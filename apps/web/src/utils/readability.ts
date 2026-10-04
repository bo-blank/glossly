// utils/readability.ts
// What the dashboard and the live highlighting need from the text. The
// measuring itself lives in textUnits.ts (sentences, syllables, passive) and
// comprehensibility.ts (formulas, index, limits).
import { detectLanguage } from '@glossly/shared';
import { comprehensibilityIndex, fleschEnglish, measure, MIN_WORDS_FOR_SCORE } from './comprehensibility';
import { isWord, type TextLanguage } from './textUnits';

export { splitSentences, countSyllables, type SentenceSpan, type TextLanguage } from './textUnits';

export interface ReadabilityResult {
  words: number;
  characters: number;
  sentences: number;
  readingTimeMinutes: number;
  /** Detected from the text; the fallback when the text does not say. */
  language: TextLanguage;
  /** Mean sentence length in words. */
  sentenceLength: number;
  /**
   * German: the comprehensibility index, 0–20. English: Flesch Reading Ease,
   * 0–100. Null below MIN_WORDS_FOR_SCORE, where averages say nothing.
   */
  score: number | null;
  barriers: {
    longSentences: { count: number; share: number };
    longWords: { share: number };
    passive: { count: number; share: number };
  };
}

// Silent reading, words per minute (Trauzettel-Klosinski et al. 2012):
// German texts read slower than English ones, mostly for their longer words.
const WORDS_PER_MINUTE: Record<TextLanguage, number> = { de: 180, en: 230 };

/**
 * Tokens with at least one letter or digit. A free-standing dash ("–", "—"),
 * "·" or a lone quote mark is punctuation, not a word: counted, it pushed a
 * 14-word sentence with a dash into the yellow tier.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(isWord).length;
}

export function estimateReadingTimeMinutes(words: number, language: TextLanguage = 'en'): number {
  return words / WORDS_PER_MINUTE[language];
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

// Sentence-length thresholds for the live highlighting, one sentence at a
// time: formulas need averages over many sentences to mean anything.
//
// The limits judge one sentence, not an average. dpa puts the upper end of the
// desirable at about 20 words; Reiners' scale calls 19-25 "understandable" and
// longer "hard" — and Hohenheim counts sentences over 20 words as long. The
// first version marked from 15 words (an API figure for the *average*
// sentence), which turned ordinary prose yellow.
export const STANDARD_MIN_WORDS = 20;
export const HARD_MIN_WORDS = 30;

export function tierForSentenceLength(wordCount: number): ReadabilityTier | null {
  if (wordCount >= HARD_MIN_WORDS) return 'hard';
  if (wordCount >= STANDARD_MIN_WORDS) return 'standard';
  return null;
}

export function scoreSentence(text: string): { words: number; tier: ReadabilityTier } | null {
  const words = countWords(text);
  const tier = tierForSentenceLength(words);
  return tier ? { words, tier } : null;
}

const LANGUAGE: Record<'German' | 'English', TextLanguage> = { German: 'de', English: 'en' };

/**
 * The text as `editor.getText()` gives it: blocks separated by line breaks,
 * which end a sentence (headings, list items). Word and character counts can
 * come from the editor so every counter agrees.
 */
export function computeReadability(
  text: string,
  options: { words?: number; characters?: number; fallbackLanguage?: TextLanguage } = {}
): ReadabilityResult {
  const detected = detectLanguage(text);
  const language = detected ? LANGUAGE[detected] : (options.fallbackLanguage ?? 'en');
  const f = measure(text, language);
  const words = options.words ?? f.words;
  return {
    words,
    characters: options.characters ?? text.length,
    sentences: f.sentences,
    readingTimeMinutes: estimateReadingTimeMinutes(words, language),
    language,
    sentenceLength: f.sentenceLength,
    score: f.words < MIN_WORDS_FOR_SCORE ? null : language === 'de' ? comprehensibilityIndex(f) : fleschEnglish(f),
    barriers: {
      longSentences: { count: f.longSentenceCount, share: f.longSentences },
      longWords: { share: f.longWords },
      passive: { count: f.passiveCount, share: f.passive }
    }
  };
}

export const EMPTY_READABILITY: ReadabilityResult = computeReadability('');

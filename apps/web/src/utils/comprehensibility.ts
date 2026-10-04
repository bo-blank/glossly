// utils/comprehensibility.ts
// How easy a text is to understand, from countable features only.
//
// German: a 0–20 index built like the Hohenheimer Verständlichkeitsindex
// (HIX): four readability formulas validated for German plus six text
// features, each scaled to 0–10; the formulas' mean plus the features' mean.
// The HIX's own scaling is not published, so the anchors below are ours —
// this is NOT the HIX and must not be called that. Anchors: 0 is where
// academic prose sits, 10 where easy-language news sits, from the formulas'
// literature (Amstad 1978, Bamberger & Vanecek 1984, Björnsson 1968).
// Calibrated so a typical municipal-utility press release lands near 9 —
// the mean HIX of 30 real ones in Hohenheim's 2020 Stadtwerke study was
// 9.17 (range 3.2–14.7). comprehensibility.test.ts holds the checks.
//
// English: Flesch Reading Ease, with English syllables.
//
// For both: the barriers the Hohenheim studies name, with their published
// limits for specialist texts and web texts.

import { countSyllables, isPassive, lettersOf, splitClauses, splitSentences, wordsOf, type TextLanguage } from './textUnits';

export type TextType = 'fach' | 'web';

export interface TextFeatures {
  words: number;
  sentences: number;
  /** Mean sentence length in words. */
  sentenceLength: number;
  /** Mean clause length in words. */
  clauseLength: number;
  /** Mean word length in letters. */
  wordLength: number;
  syllablesPerWord: number;
  /** Shares in percent. */
  wordsOverSixLetters: number;
  wordsThreePlusSyllables: number;
  wordsOneSyllable: number;
  clausesOverTwelveWords: number;
  /** Sentences over 20 words — a Hohenheim barrier. */
  longSentences: number;
  longSentenceCount: number;
  /** Words over 16 letters — a Hohenheim barrier. */
  longWords: number;
  /** Sentences in the passive voice — a Hohenheim barrier. */
  passive: number;
  passiveCount: number;
  /** Words of three or more syllables, absolute (for SMOG). */
  polysyllables: number;
}

const pct = (part: number, whole: number) => (whole ? (100 * part) / whole : 0);

export function measure(text: string, language: TextLanguage): TextFeatures {
  const sentences = splitSentences(text).map((s) => s.text);
  const words = sentences.flatMap(wordsOf);
  const clauses = sentences.flatMap(splitClauses);
  const letters = words.map((w) => lettersOf(w).length);
  const syllables = words.map((w) => countSyllables(w, language));
  const sentenceWords = sentences.map((s) => wordsOf(s).length);
  const long = sentenceWords.filter((n) => n > 20).length;
  const passive = sentences.filter((s) => isPassive(s, language)).length;
  const n = words.length;
  return {
    words: n,
    sentences: sentences.length,
    sentenceLength: sentences.length ? n / sentences.length : 0,
    clauseLength: clauses.length ? clauses.reduce((sum, c) => sum + wordsOf(c).length, 0) / clauses.length : 0,
    wordLength: n ? letters.reduce((a, b) => a + b, 0) / n : 0,
    syllablesPerWord: n ? syllables.reduce((a, b) => a + b, 0) / n : 0,
    wordsOverSixLetters: pct(letters.filter((l) => l > 6).length, n),
    wordsThreePlusSyllables: pct(syllables.filter((s) => s >= 3).length, n),
    wordsOneSyllable: pct(syllables.filter((s) => s === 1).length, n),
    clausesOverTwelveWords: pct(clauses.filter((c) => wordsOf(c).length > 12).length, clauses.length),
    longSentences: pct(long, sentences.length),
    longSentenceCount: long,
    longWords: pct(letters.filter((l) => l > 16).length, n),
    passive: pct(passive, sentences.length),
    passiveCount: passive,
    polysyllables: syllables.filter((s) => s >= 3).length
  };
}

// The four formulas validated for German.
export const amstad = (f: TextFeatures) => 180 - f.sentenceLength - 58.5 * f.syllablesPerWord;
/** 1. neue Wiener Sachtextformel: a school grade, 4 (easy) to 15 (very hard). */
export const wienerSachtext = (f: TextFeatures) =>
  0.1935 * f.wordsThreePlusSyllables + 0.1672 * f.sentenceLength + 0.1297 * f.wordsOverSixLetters - 0.0327 * f.wordsOneSyllable - 0.875;
/** SMOG, German version: polysyllables per 30 sentences. */
export const smogDe = (f: TextFeatures) => Math.sqrt((f.polysyllables * 30) / Math.max(1, f.sentences)) - 2;
/** LIX: under 30 very easy, 40 fiction, 50 non-fiction, over 60 specialist literature. */
export const lix = (f: TextFeatures) => f.sentenceLength + f.wordsOverSixLetters;

export const fleschEnglish = (f: TextFeatures) => 206.835 - 1.015 * f.sentenceLength - 84.6 * f.syllablesPerWord;

/** [value scoring 0, value scoring 10]; linear in between, clamped outside. */
type Anchor = readonly [zero: number, ten: number];

export const ANCHORS = {
  formulas: {
    amstad: [-20, 90],
    wienerSachtext: [20, 2],
    smogDe: [19, 2],
    lix: [85, 20]
  },
  features: {
    sentenceLength: [32, 7],
    clauseLength: [18, 4],
    wordLength: [8.5, 4.5],
    wordsOverSixLetters: [60, 10],
    clausesOverTwelveWords: [60, 0],
    longSentences: [80, 0]
  }
} as const satisfies Record<string, Record<string, Anchor>>;

const scale = (value: number, [zero, ten]: Anchor) => Math.max(0, Math.min(10, (10 * (value - zero)) / (ten - zero)));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The German index, 0 (academic prose) to 20 (written for everyone). */
export function comprehensibilityIndex(f: TextFeatures): number {
  const a = ANCHORS.formulas;
  const formulas = mean([
    scale(amstad(f), a.amstad),
    scale(wienerSachtext(f), a.wienerSachtext),
    scale(smogDe(f), a.smogDe),
    scale(lix(f), a.lix)
  ]);
  const b = ANCHORS.features;
  const features = mean([
    scale(f.sentenceLength, b.sentenceLength),
    scale(f.clauseLength, b.clauseLength),
    scale(f.wordLength, b.wordLength),
    scale(f.wordsOverSixLetters, b.wordsOverSixLetters),
    scale(f.clausesOverTwelveWords, b.clausesOverTwelveWords),
    scale(f.longSentences, b.longSentences)
  ]);
  return formulas + features;
}

/**
 * What a text should reach. German: Hohenheim's published targets (press
 * texts at least 12, product/web texts at least 16). English: the usual
 * plain-language band for Flesch (ours, not Hohenheim's).
 */
export const TARGETS: Record<TextLanguage, Record<TextType, number>> = {
  de: { fach: 12, web: 16 },
  en: { fach: 60, web: 70 }
};

/** Hohenheim's limits for the barriers, in percent. */
export const BARRIER_LIMITS: Record<TextType, { longSentences: number; longWords: number; passive: number }> = {
  fach: { longSentences: 10, longWords: 8, passive: 15 },
  web: { longSentences: 0, longWords: 4, passive: 5 }
};

/** Below this the formulas' averages say nothing; the barriers still count. */
export const MIN_WORDS_FOR_SCORE = 50;

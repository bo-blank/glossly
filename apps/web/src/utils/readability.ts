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
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) return 1;
  const stripped = cleaned.replace(/(?:[^laeiouy]es|ed|e)$/, '');
  const groups = stripped.match(/[aeiouy]{1,2}/g);
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

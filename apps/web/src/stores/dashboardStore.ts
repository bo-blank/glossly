// stores/dashboardStore.ts
import { writable } from 'svelte/store';
import type { ReadabilityResult } from '../utils/readability';

export const dashboardStore = writable<ReadabilityResult>({
  words: 0,
  characters: 0,
  sentences: 0,
  syllables: 0,
  readingTimeMinutes: 0,
  fleschReadingEase: null,
  fleschKincaidGrade: null,
  readabilityLabel: 'Not enough text'
});

export interface AiLikenessState {
  status: 'idle' | 'loading' | 'success' | 'error';
  score: number | null;
  label: string | null;
  rationale: string | null;
  error: string | null;
  analyzedWordCount: number | null;
}

export const aiLikenessStore = writable<AiLikenessState>({
  status: 'idle',
  score: null,
  label: null,
  rationale: null,
  error: null,
  analyzedWordCount: null
});

// stores/dashboardStore.ts
import { writable } from 'svelte/store';
import { EMPTY_READABILITY, type ReadabilityResult } from '../utils/readability';

export const dashboardStore = writable<ReadabilityResult>(EMPTY_READABILITY);

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

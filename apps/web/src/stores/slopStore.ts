// stores/slopStore.ts
import { writable } from 'svelte/store';
import type { SlopFinding } from '../utils/slop';
import type { TextLanguage } from '../utils/textUnits';

export interface SlopState {
  /** The treatment plan is open: findings are computed and marked in the text. */
  open: boolean;
  findings: SlopFinding[];
  language: TextLanguage;
}

export const slopStore = writable<SlopState>({ open: false, findings: [], language: 'de' });

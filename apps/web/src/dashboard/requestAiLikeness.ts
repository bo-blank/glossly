import { get } from 'svelte/store';
import { aiLikenessStore } from '../stores/dashboardStore';
import { settingsStore } from '../stores/settingsStore';
import { fetchAiLikeness, SuggestRequestError } from '../providers/client';

let activeController: AbortController | undefined;

/**
 * Triggered by the dashboard's "Analyze" button click — no debounce, always re-runs on demand.
 * `wordCount` must come from the same source as `dashboardStore.words` (Tiptap's
 * `characterCount.words()`), not a separate recount — otherwise the staleness comparison in
 * Dashboard.svelte flags a freshly-analyzed, unedited document as stale.
 */
export async function analyzeAiLikeness(text: string, wordCount: number) {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  aiLikenessStore.set({
    status: 'loading',
    score: null,
    label: null,
    rationale: null,
    error: null,
    analyzedWordCount: null
  });

  try {
    const settings = get(settingsStore);
    const result = await fetchAiLikeness({ settings, text, signal: controller.signal });
    if (controller.signal.aborted) return;
    aiLikenessStore.set({
      status: 'success',
      score: result.score,
      label: result.label,
      rationale: result.rationale,
      error: null,
      analyzedWordCount: wordCount
    });
  } catch (err) {
    if (controller.signal.aborted) return; // superseded by a newer click — discard silently
    const message = err instanceof SuggestRequestError ? err.message : 'Could not reach the model — try again.';
    aiLikenessStore.set({
      status: 'error',
      score: null,
      label: null,
      rationale: null,
      error: message,
      analyzedWordCount: null
    });
  }
}

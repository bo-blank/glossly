import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../providers/client', () => ({
  SuggestRequestError: class extends Error {},
  fetchSuggestionsStream: vi.fn()
}));

import { fetchSuggestionsStream } from '../providers/client';
import { noteStore } from '../stores/noteStore';
import { settingsStore } from '../stores/settingsStore';
import { onSelectionChange, requestWithModifier } from './requestSuggestions';
import { clear as clearHistory, forPhrase } from './suggestionHistory';
import { clear as clearCache } from './suggestionCache';

const fetchMock = vi.mocked(fetchSuggestionsStream);

function selection(selectedText: string, from: number) {
  return { selectedText, context: { title: '', headingPath: [], before: 'Er ', after: ' nach Hause.' }, from, to: from + selectedText.length, screenPos: null };
}

let round = 0;
beforeEach(() => {
  vi.useFakeTimers();
  clearHistory();
  clearCache();
  round = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => {
    round++;
    return [`r${round}a`, `r${round}b`, `r${round}c`];
  });
});
afterEach(() => vi.useRealTimers());

async function select(text: string, from: number) {
  onSelectionChange(selection(text, from));
  await vi.advanceTimersByTimeAsync(250);
}

describe('requestSuggestions history', () => {
  it('remembers a phrase across visits and feeds it all to "New suggestions"', async () => {
    await select('ging langsam', 3);
    requestWithModifier('tighter');
    await vi.runAllTimersAsync();
    requestWithModifier('vivid');
    await vi.runAllTimersAsync();

    await select('etwas anderes', 40);
    await select('ging langsam', 3);
    // Coming back re-shows the default round from the cache, which moves it to the front.
    expect(forPhrase('ging langsam').map((e) => e.label)).toEqual([
      'Suggestions', 'Suggestions', 'Suggestions',
      'More vivid', 'More vivid', 'More vivid',
      'Tighter', 'Tighter', 'Tighter'
    ]);

    requestWithModifier('more');
    await vi.runAllTimersAsync();
    const body = fetchMock.mock.calls.at(-1)![0];
    expect(body.modifier).toBe('more');
    expect(body.previousSuggestions).toEqual(['r1a', 'r1b', 'r1c', 'r3a', 'r3b', 'r3c', 'r2a', 'r2b', 'r2c']);
    expect(get(noteStore).suggestions).toEqual(['r5a', 'r5b', 'r5c']);
  });

  it('keeps each phrase\'s history to itself', async () => {
    await select('ging langsam', 3);
    requestWithModifier('more');
    await vi.runAllTimersAsync();
    expect(fetchMock.mock.calls.at(-1)![0].previousSuggestions).toEqual(['r1a', 'r1b', 'r1c']);

    await select('ganz neu hier', 60);
    requestWithModifier('more');
    await vi.runAllTimersAsync();
    expect(fetchMock.mock.calls.at(-1)![0].previousSuggestions).toEqual(['r3a', 'r3b', 'r3c']);
  });
});

describe('requestSuggestions tuning', () => {
  afterEach(() => settingsStore.update((s) => ({ ...s, modifierTuning: {} })));

  it('sends a chip\'s tuning, and refetches when it changes', async () => {
    settingsStore.update((s) => ({ ...s, modifierTuning: { plain: { temperature: 0.2, instruction: 'Change as little as possible.' } } }));
    await select('ging langsam', 3);
    requestWithModifier('plain');
    await vi.runAllTimersAsync();
    expect(fetchMock.mock.calls.at(-1)![0]).toMatchObject({ modifier: 'plain', temperature: 0.2, instructionOverride: 'Change as little as possible.' });

    settingsStore.update((s) => ({ ...s, modifierTuning: { plain: { temperature: 1.3 } } }));
    requestWithModifier('plain');
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.at(-1)![0]).toMatchObject({ temperature: 1.3, instructionOverride: undefined });
  });

  it('never tunes the default request or "New suggestions"', async () => {
    settingsStore.update((s) => ({ ...s, modifierTuning: { more: { temperature: 1.5 } } }));
    await select('ging langsam', 3);
    requestWithModifier('more');
    await vi.runAllTimersAsync();
    for (const [body] of fetchMock.mock.calls) {
      expect(body.temperature).toBeUndefined();
      expect(body.instructionOverride).toBeUndefined();
    }
  });
});

describe('requestSuggestions load status', () => {
  it('shows the server-reported wait until the first suggestion arrives', async () => {
    const seen: unknown[] = [];
    fetchMock.mockImplementation(async ({ onStatus, onSuggestion }) => {
      onStatus?.({ state: 'busy', model: 'qwen38-27b' });
      seen.push(get(noteStore).loadStatus);
      await vi.advanceTimersByTimeAsync(5000);
      onStatus?.({ state: 'loading', model: 'gemma4-e2b-qat' });
      seen.push(get(noteStore).loadStatus);
      onSuggestion(0, 'a');
      seen.push(get(noteStore).loadStatus);
      return ['a', 'b', 'c'];
    });
    await select('ging langsam', 3);
    await vi.runAllTimersAsync();

    const [busy, loading, afterFirst] = seen as { state: string; since: number }[];
    expect(busy).toMatchObject({ state: 'busy', model: 'qwen38-27b' });
    // The clock runs from the request, not from each status change.
    expect(loading).toMatchObject({ state: 'loading', since: busy.since });
    expect(afterFirst).toBeUndefined();
    expect(get(noteStore).loadStatus).toBeUndefined();
  });
});

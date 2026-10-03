import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../providers/client', () => ({
  SuggestRequestError: class extends Error {},
  fetchSuggestionsStream: vi.fn()
}));

import { fetchSuggestionsStream } from '../providers/client';
import { noteStore } from '../stores/noteStore';
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

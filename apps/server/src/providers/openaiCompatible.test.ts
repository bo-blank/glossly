import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_THINKING, openAICompatibleProvider } from './openaiCompatible';
import type { SuggestionRequest } from './types';

function input(extra: Partial<SuggestionRequest> = {}): SuggestionRequest {
  return {
    selectedText: 'grab lunch',
    context: { title: '', headingPath: [], before: 'We should ', after: ' soon.' },
    model: 'gemma4-e2b-qat',
    baseUrl: 'http://127.0.0.1:8080/v1',
    timeout: 5000,
    signal: new AbortController().signal,
    ...extra
  };
}

function mockUpstream() {
  const content = JSON.stringify({ suggestions: ['have lunch', 'eat together', 'meet for lunch'] });
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return () => JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
}

afterEach(() => vi.unstubAllGlobals());

describe('upstream request body', () => {
  it('defaults to temperature 0.8 and always sends NO_THINKING', async () => {
    const body = mockUpstream();
    await openAICompatibleProvider.getSuggestions(input());
    expect(body()).toMatchObject({ temperature: 0.8, ...NO_THINKING });
    expect(body()).not.toHaveProperty('enable_thinking');
    expect(body()).not.toHaveProperty('reasoning_effort');
  });

  it('passes a tuned temperature and instruction through, next to NO_THINKING', async () => {
    const body = mockUpstream();
    await openAICompatibleProvider.getSuggestions(input({ modifier: 'plain', temperature: 0.2, instructionOverride: 'Change as little as possible.' }));
    expect(body()).toMatchObject({ temperature: 0.2, ...NO_THINKING });
    expect(body().messages[1].content).toContain('Style instruction: Change as little as possible.');
  });

  it('accepts temperature 0 rather than falling back to the default', async () => {
    const body = mockUpstream();
    await openAICompatibleProvider.getSuggestions(input({ temperature: 0 }));
    expect(body().temperature).toBe(0);
  });
});

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

function sse(content: string): Response {
  const chunk = (delta: object, extra: object = {}) => `data: ${JSON.stringify({ id: 'chatcmpl-1', choices: [{ index: 0, delta, ...extra }] })}\n\n`;
  return new Response(chunk({ content }) + chunk({}, { finish_reason: 'stop' }) + 'data: [DONE]\n\n', {
    headers: { 'content-type': 'text/event-stream' }
  });
}

function mockUpstream(content = JSON.stringify({ suggestions: ['have lunch', 'eat together', 'meet for lunch'] })) {
  const fetchMock = vi.fn(async () => sse(content));
  vi.stubGlobal('fetch', fetchMock);
  return () => JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
}

afterEach(() => vi.unstubAllGlobals());

describe('upstream request body', () => {
  it('defaults to temperature 0.8 and always sends NO_THINKING', async () => {
    const body = mockUpstream();
    expect(await openAICompatibleProvider.getSuggestions(input())).toEqual(['have lunch', 'eat together', 'meet for lunch']);
    // Streamed upstream even for a one-piece answer: only a stream tells a model swap from a hang.
    expect(body()).toMatchObject({ temperature: 0.8, stream: true, ...NO_THINKING });
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

describe('AI-likeness upstream request', () => {
  it('streams with NO_THINKING and parses the assembled answer', async () => {
    const body = mockUpstream(JSON.stringify({ score: 72, label: 'Likely AI', rationale: 'Even rhythm.' }));
    const result = await openAICompatibleProvider.getAiLikeness({
      text: 'x'.repeat(200),
      model: 'gemma4-e2b-qat',
      baseUrl: 'http://127.0.0.1:8080/v1',
      timeout: 5000,
      signal: new AbortController().signal
    });
    expect(result).toMatchObject({ score: 72, rationale: 'Even rhythm.' });
    expect(body()).toMatchObject({ temperature: 0.3, stream: true, ...NO_THINKING });
    expect(body()).not.toHaveProperty('enable_thinking');
  });
});

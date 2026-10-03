import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyRunning, probeLoadState } from './llamaSwap';

const E2B = 'gemma4-e2b-qat';

describe('classifyRunning', () => {
  it('reports loading while our model starts', () => {
    expect(classifyRunning([{ model: E2B, state: 'starting' }], E2B)).toEqual({ state: 'loading', model: E2B });
  });

  it('reports the other model while it still answers and ours waits its turn', () => {
    expect(classifyRunning([{ model: 'qwen38-27b', state: 'ready' }], E2B)).toEqual({ state: 'busy', model: 'qwen38-27b' });
  });

  it('reports loading once the other model is on its way out, or nothing runs', () => {
    expect(classifyRunning([{ model: 'qwen38-27b', state: 'stopping' }], E2B)).toEqual({ state: 'loading', model: E2B });
    expect(classifyRunning([], E2B)).toEqual({ state: 'loading', model: E2B });
  });

  it('only says waiting when our model is already loaded', () => {
    expect(classifyRunning([{ model: E2B, state: 'ready' }, { model: 'gemma4-12b-qat-mtp', state: 'ready' }], E2B)).toEqual({ state: 'waiting' });
  });
});

describe('probeLoadState', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks /running at the endpoint origin', async () => {
    const fetchMock = vi.fn(async () => Response.json({ running: [{ model: E2B, state: 'starting', cmd: '…' }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await probeLoadState('http://127.0.0.1:8080/v1', E2B, new AbortController().signal)).toEqual({ state: 'loading', model: E2B });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('http://127.0.0.1:8080/running');
  });

  it.each([
    ['a 404', () => new Response('not found', { status: 404 })],
    ['non-JSON', () => new Response('<html>')],
    ['another shape', () => Response.json({ models: [] })]
  ])('is null for %s (not llama-swap)', async (_name, answer) => {
    vi.stubGlobal('fetch', vi.fn(async () => answer()));
    expect(await probeLoadState('http://127.0.0.1:11434/v1', E2B, new AbortController().signal)).toBeNull();
  });

  it('is null when the server does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await probeLoadState('http://127.0.0.1:1/v1', E2B, new AbortController().signal)).toBeNull();
  });
});

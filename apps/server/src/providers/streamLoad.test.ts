import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { openAICompatibleProvider } from './openaiCompatible';
import type { StreamTiming, SuggestionRequest, SuggestionStreamEvent } from './types';

// A real local upstream: the stream's timers and fetch run for real, with
// timings shortened from seconds to tens of milliseconds.
const TIMING: StreamTiming = { loadTimeoutMs: 2000, statusDelayMs: 50, statusPollMs: 40 };
const MODEL = 'gemma4-e2b-qat';
const SUGGESTIONS = '{"suggestions":["ging heim","lief nach Hause","schlenderte heim"]}';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const real = (delta: object, extra: object = {}) => `data: ${JSON.stringify({ id: 'chatcmpl-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta, ...extra }] })}\n\n`;
const injected = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: text } }] })}\n\n`;

interface Upstream {
  /** Runs per chat request; write SSE to res. */
  chat: (res: http.ServerResponse) => Promise<void>;
  running?: () => object;
}

let server: http.Server | undefined;
afterEach(() => server?.close());

async function start(upstream: Upstream): Promise<string> {
  server = http.createServer(async (req, res) => {
    if (req.url === '/running') {
      if (!upstream.running) return void res.writeHead(404).end();
      return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(upstream.running()));
    }
    req.resume();
    await upstream.chat(res);
    res.end();
  });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1`;
}

async function stream(baseUrl: string, timeout = 300) {
  const events: SuggestionStreamEvent[] = [];
  const input: SuggestionRequest = {
    selectedText: 'ging langsam nach Hause',
    context: '',
    model: MODEL,
    baseUrl,
    timeout,
    signal: new AbortController().signal
  };
  const result = await openAICompatibleProvider.streamSuggestions(input, (e) => events.push(e), TIMING).catch((err: Error) => err);
  return { result, statuses: events.filter((e) => e.type === 'status').map((e) => (e as { status: unknown }).status) };
}

function answer(res: http.ServerResponse) {
  res.write(real({ content: SUGGESTIONS }));
  res.write(real({}, { finish_reason: 'stop' }));
  res.write('data: [DONE]\n\n');
}

describe('streamed request while the model loads', () => {
  it('waits past the idle timeout for the first byte, and says it is waiting', async () => {
    const url = await start({
      chat: async (res) => {
        await sleep(600); // twice the 300 ms idle timeout, before any header
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        answer(res);
      }
    });
    const { result, statuses } = await stream(url);
    expect(result).toEqual(['ging heim', 'lief nach Hause', 'schlenderte heim']);
    expect(statuses).toEqual([{ state: 'waiting' }]); // no /running: not llama-swap
  });

  it('follows llama-swap from busy to loading', async () => {
    const t0 = Date.now();
    const url = await start({
      running: () => ({
        running: Date.now() - t0 < 250 ? [{ model: 'qwen38-27b', state: 'ready' }] : [{ model: MODEL, state: 'starting' }]
      }),
      chat: async (res) => {
        await sleep(500);
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        answer(res);
      }
    });
    const { result, statuses } = await stream(url);
    expect(result).toHaveLength(3);
    expect(statuses).toEqual([
      { state: 'busy', model: 'qwen38-27b' },
      { state: 'loading', model: MODEL }
    ]);
  });

  it('still fails fast on a stall after the model started answering', async () => {
    const url = await start({
      chat: async (res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(real({ content: '{"sugg' }));
        await sleep(900); // three idle timeouts
      }
    });
    const started = Date.now();
    const { result } = await stream(url);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('The local model took too long to respond.');
    expect(Date.now() - started).toBeLessThan(800);
  });

  it('gives up after the load timeout with a message that says so', async () => {
    const url = await start({ chat: () => sleep(2600) });
    const { result } = await stream(url);
    expect((result as Error).message).toBe('The model server did not start answering within 2 seconds.');
  });
});

describe('llama-swap sendLoadingState', () => {
  it('does not take the injected loading text for the model starting', async () => {
    const url = await start({
      chat: async (res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(injected('llama-swap loading model: gemma4-e2b-qat\n'));
        await sleep(450); // longer than the idle timeout: still within the load phase
        res.write(injected('Done! (2.27s)\n'));
        await sleep(450);
        answer(res);
      }
    });
    const { result } = await stream(url);
    expect(result).toHaveLength(3);
  });

  it('does not blame reasoning for an empty answer when only llama-swap wrote reasoning_content', async () => {
    const url = await start({
      chat: async (res) => {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write(injected('llama-swap loading model\n'));
        res.write(real({ content: '' }, { finish_reason: 'length' }));
      }
    });
    const { result } = await stream(url);
    expect((result as Error).message).toBe('The model hit its token limit before finishing its answer.');
  });
});

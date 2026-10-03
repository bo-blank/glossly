import type {
  AiLikenessRequestBody,
  AiLikenessResult,
  ApiError,
  ModelTarget,
  ModifierDefaults,
  SuggestionContext,
  SuggestRequestBody,
  SuggestResponse,
  SuggestStreamEvents
} from '@glossly/shared';
import type { Settings } from '../stores/settingsStore';

export type { AiLikenessResult } from '@glossly/shared';

export interface SuggestParams
  extends Pick<SuggestRequestBody, 'selectedText' | 'modifier' | 'modifierInstruction' | 'instructionOverride' | 'temperature' | 'mode' | 'previousSuggestions'> {
  settings: Settings;
  context: SuggestionContext;
  signal: AbortSignal;
}

function modelTarget(settings: Settings): ModelTarget {
  return {
    provider: settings.provider,
    model: settings.model,
    baseUrl: settings.endpointUrl,
    apiKey: settings.apiKey || undefined,
    timeout: settings.timeout
  };
}

function suggestBody({ settings, signal: _signal, ...request }: SuggestParams, stream?: true): SuggestRequestBody {
  return { ...modelTarget(settings), ...request, stream };
}

/** An error response's body, or null when it is not JSON. */
async function errorBody(response: Response): Promise<Partial<ApiError> | null> {
  return response.json().catch(() => null);
}

export class SuggestRequestError extends Error {
  kind: string;

  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
  }
}

export async function fetchSuggestions(params: SuggestParams): Promise<string[]> {
  const response = await fetch('/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(suggestBody(params)),
    signal: params.signal
  });

  if (!response.ok) {
    const body = await errorBody(response);
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'The request failed.');
  }

  return ((await response.json()) as SuggestResponse).suggestions;
}

export interface SuggestStreamParams extends SuggestParams {
  onSuggestion: (index: number, text: string) => void;
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
  }
  return dataLines.length ? { event, data: dataLines.join('\n') } : null;
}

/**
 * Streams `/api/suggest` (SSE). A response whose Content-Type isn't
 * text/event-stream is a pre-stream validation failure (bad selectedText/provider/
 * baseUrl/model) and is parsed as plain JSON, same as `fetchSuggestions`.
 */
export async function fetchSuggestionsStream({ onSuggestion, ...params }: SuggestStreamParams): Promise<string[]> {
  const response = await fetch('/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(suggestBody(params, true)),
    signal: params.signal
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const body = await errorBody(response);
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'The request failed.');
  }
  if (!response.body) {
    throw new SuggestRequestError('bad_response', 'The server did not return a stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalSuggestions: string[] | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let frameEnd: number;
    while ((frameEnd = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === 'suggestion') {
        const data = JSON.parse(parsed.data) as SuggestStreamEvents['suggestion'];
        onSuggestion(data.index, data.text);
      } else if (parsed.event === 'done') {
        finalSuggestions = (JSON.parse(parsed.data) as SuggestStreamEvents['done']).suggestions;
      } else if (parsed.event === 'error') {
        const data = JSON.parse(parsed.data) as SuggestStreamEvents['error'];
        throw new SuggestRequestError(data.error, data.message);
      }
    }
  }

  if (!finalSuggestions) {
    throw new SuggestRequestError('bad_response', 'The stream ended without a result.');
  }
  return finalSuggestions;
}

export interface AiLikenessParams {
  settings: Settings;
  text: string;
  signal: AbortSignal;
}

export async function fetchAiLikeness({ settings, text, signal }: AiLikenessParams): Promise<AiLikenessResult> {
  const response = await fetch('/api/ai-likeness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...modelTarget(settings), text } satisfies AiLikenessRequestBody),
    signal
  });

  if (!response.ok) {
    const body = await errorBody(response);
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'The request failed.');
  }

  return (await response.json()) as AiLikenessResult;
}

export async function fetchModifierDefaults(): Promise<ModifierDefaults> {
  const response = await fetch('/api/modifiers');
  if (!response.ok) throw new Error(`The proxy responded with ${response.status}.`);
  return response.json();
}

export async function fetchModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  // POST so the API key travels in the body, not in a logged query string.
  const response = await fetch('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl, apiKey: apiKey || undefined })
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'Failed to load models.');
  }

  return body.models as string[];
}

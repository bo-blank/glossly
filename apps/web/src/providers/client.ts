import type { Settings } from '../stores/settingsStore';

export interface SuggestParams {
  settings: Settings;
  selectedText: string;
  context: string;
  modifier?: string;
  modifierInstruction?: string;
  previousSuggestions?: string[];
  signal: AbortSignal;
}

export class SuggestRequestError extends Error {
  kind: string;

  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
  }
}

export async function fetchSuggestions({
  settings,
  selectedText,
  context,
  modifier,
  modifierInstruction,
  previousSuggestions,
  signal
}: SuggestParams): Promise<string[]> {
  const response = await fetch('/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.endpointUrl,
      apiKey: settings.apiKey || undefined,
      timeout: settings.timeout,
      selectedText,
      context,
      modifier,
      modifierInstruction,
      previousSuggestions
    }),
    signal
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'The request failed.');
  }

  return body.suggestions as string[];
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
export async function fetchSuggestionsStream({
  settings,
  selectedText,
  context,
  modifier,
  modifierInstruction,
  previousSuggestions,
  signal,
  onSuggestion
}: SuggestStreamParams): Promise<string[]> {
  const response = await fetch('/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.endpointUrl,
      apiKey: settings.apiKey || undefined,
      timeout: settings.timeout,
      selectedText,
      context,
      modifier,
      modifierInstruction,
      previousSuggestions,
      stream: true
    }),
    signal
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const body = await response.json().catch(() => null);
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
        const data = JSON.parse(parsed.data) as { index: number; text: string };
        onSuggestion(data.index, data.text);
      } else if (parsed.event === 'done') {
        finalSuggestions = (JSON.parse(parsed.data) as { suggestions: string[] }).suggestions;
      } else if (parsed.event === 'error') {
        const data = JSON.parse(parsed.data) as { error: string; message: string };
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

export interface AiLikenessResult {
  score: number;
  label: string;
  rationale: string;
}

export async function fetchAiLikeness({ settings, text, signal }: AiLikenessParams): Promise<AiLikenessResult> {
  const response = await fetch('/api/ai-likeness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.endpointUrl,
      apiKey: settings.apiKey || undefined,
      timeout: settings.timeout,
      text
    }),
    signal
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'The request failed.');
  }

  return body as AiLikenessResult;
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

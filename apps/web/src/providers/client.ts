import type { Settings } from '../stores/settingsStore';

export interface SuggestParams {
  settings: Settings;
  selectedText: string;
  context: string;
  modifier?: string;
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

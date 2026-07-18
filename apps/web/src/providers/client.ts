import type { Settings } from '../stores/settingsStore';

export interface SuggestParams {
  settings: Settings;
  selectedText: string;
  context: string;
  modifier?: string;
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
      selectedText,
      context,
      modifier
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
  const params = new URLSearchParams({ baseUrl });
  if (apiKey) params.set('apiKey', apiKey);

  const response = await fetch(`/api/models?${params.toString()}`);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new SuggestRequestError(body?.error ?? 'bad_response', body?.message ?? 'Failed to load models.');
  }

  return body.models as string[];
}

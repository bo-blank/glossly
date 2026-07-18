import { AI_LIKENESS_JSON_SCHEMA, AI_LIKENESS_LABELS, buildAiLikenessMessages, buildMessages, SUGGESTIONS_JSON_SCHEMA } from './prompt';
import { AiLikenessRequest, AiLikenessResult, LLMProvider, SuggestError, SuggestionRequest } from './types';

function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function parseSuggestions(raw: string): string[] {
  const cleaned = extractJsonPayload(stripReasoning(raw));
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new SuggestError('bad_response', 'Model did not return valid JSON.');
  }

  const suggestions = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { suggestions?: unknown })?.suggestions)
      ? (parsed as { suggestions: unknown[] }).suggestions
      : null;

  if (!suggestions || !suggestions.every((s) => typeof s === 'string')) {
    throw new SuggestError('bad_response', 'Model response was not an array of 3 strings.');
  }

  return suggestions as string[];
}

function parseAiLikeness(raw: string): AiLikenessResult {
  const cleaned = extractJsonPayload(stripReasoning(raw));
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new SuggestError('bad_response', 'Model did not return valid JSON.');
  }

  const obj = parsed as { score?: unknown; label?: unknown; rationale?: unknown };
  if (typeof obj?.score !== 'number' || typeof obj?.rationale !== 'string') {
    throw new SuggestError('bad_response', 'Model response was missing a score or rationale.');
  }

  const score = Math.max(0, Math.min(100, obj.score));
  const label = AI_LIKENESS_LABELS.includes(obj.label as (typeof AI_LIKENESS_LABELS)[number])
    ? (obj.label as string)
    : 'Mixed / uncertain';

  return { score, label, rationale: obj.rationale };
}

export const openAICompatibleProvider: LLMProvider = {
  id: 'openai-compatible',
  label: 'OpenAI-compatible (local)',

  async getSuggestions(input: SuggestionRequest): Promise<string[]> {
    const { selectedText, context, modifier, model, baseUrl, apiKey, timeout, signal } = input;

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);
    signal.addEventListener('abort', () => timeoutController.abort());

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: buildMessages(selectedText, context, modifier),
          response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
          temperature: 0.8
        }),
        signal: timeoutController.signal
      });
    } catch (err) {
      if (timeoutController.signal.aborted && !signal.aborted) {
        throw new SuggestError('timeout', 'The local model took too long to respond.');
      }
      if (signal.aborted) {
        throw err; // superseded request — let the caller treat this as an abort, not a failure
      }
      throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new SuggestError('bad_response', `Local model server responded with ${response.status}.`);
    }

    const body = await response.json();
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (!content) {
      throw new SuggestError('bad_response', 'Local model server returned an empty response.');
    }

    return parseSuggestions(content);
  },

  async getAiLikeness(input: AiLikenessRequest): Promise<AiLikenessResult> {
    const { text, model, baseUrl, apiKey, timeout, signal } = input;

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeout);
    signal.addEventListener('abort', () => timeoutController.abort());

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: buildAiLikenessMessages(text),
          response_format: { type: 'json_schema', json_schema: AI_LIKENESS_JSON_SCHEMA },
          temperature: 0.3
        }),
        signal: timeoutController.signal
      });
    } catch (err) {
      if (timeoutController.signal.aborted && !signal.aborted) {
        throw new SuggestError('timeout', 'The local model took too long to respond.');
      }
      if (signal.aborted) {
        throw err; // superseded request — let the caller treat this as an abort, not a failure
      }
      throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new SuggestError('bad_response', `Local model server responded with ${response.status}.`);
    }

    const body = await response.json();
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (!content) {
      throw new SuggestError('bad_response', 'Local model server returned an empty response.');
    }

    return parseAiLikeness(content);
  }
};

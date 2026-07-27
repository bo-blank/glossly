import { AI_LIKENESS_JSON_SCHEMA, AI_LIKENESS_LABELS, buildAiLikenessMessages, buildMessages, SUGGESTIONS_JSON_SCHEMA } from './prompt';
import { extractSuggestions } from './streamParse';
import {
  AiLikenessRequest,
  AiLikenessResult,
  LLMProvider,
  SuggestError,
  SuggestionRequest,
  SuggestionStreamEvent
} from './types';

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

  // Small local models don't always respect minItems/maxItems — trim overshoot,
  // but treat an empty list as a failure rather than rendering an empty note.
  const nonEmpty = cleanSuggestions(suggestions as string[]);
  if (nonEmpty.length === 0) {
    throw new SuggestError('bad_response', 'Model returned no usable suggestions.');
  }

  return nonEmpty.slice(0, 3);
}

function cleanSuggestions(raw: string[]): string[] {
  return raw.map((s) => s.trim()).filter(Boolean);
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
    const { selectedText, context, modifier, previousSuggestions, model, baseUrl, apiKey, timeout, signal } = input;

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
          messages: buildMessages(selectedText, context, modifier, previousSuggestions),
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

  async streamSuggestions(input: SuggestionRequest, emit: (event: SuggestionStreamEvent) => void): Promise<string[]> {
    const { selectedText, context, modifier, previousSuggestions, model, baseUrl, apiKey, timeout, signal } = input;

    const timeoutController = new AbortController();
    // Idle timeout: every chunk received off the wire proves the upstream is still
    // alive and pushes the deadline back out, so a slow-but-steady stream isn't killed —
    // only a stall (no bytes for `timeout` ms) trips it.
    let timer = setTimeout(() => timeoutController.abort(), timeout);
    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => timeoutController.abort(), timeout);
    };
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
          messages: buildMessages(selectedText, context, modifier, previousSuggestions),
          response_format: { type: 'json_schema', json_schema: SUGGESTIONS_JSON_SCHEMA },
          temperature: 0.8,
          stream: true
        }),
        signal: timeoutController.signal
      });
    } catch (err) {
      clearTimeout(timer);
      if (timeoutController.signal.aborted && !signal.aborted) {
        throw new SuggestError('timeout', 'The local model took too long to respond.');
      }
      if (signal.aborted) {
        throw err; // superseded request — let the caller treat this as an abort, not a failure
      }
      throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
    }

    if (!response.ok) {
      clearTimeout(timer);
      throw new SuggestError('bad_response', `Local model server responded with ${response.status}.`);
    }
    if (!response.body) {
      clearTimeout(timer);
      throw new SuggestError('bad_response', 'Local model server returned an empty stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let lineRemainder = '';
    let contentBuffer = '';
    let emittedCount = 0;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let next: ReadableStreamReadResult<Uint8Array>;
        try {
          next = await reader.read();
        } catch (err) {
          if (timeoutController.signal.aborted && !signal.aborted) {
            throw new SuggestError('timeout', 'The local model took too long to respond.');
          }
          if (signal.aborted) throw err;
          throw new SuggestError('connection_refused', `Could not reach ${baseUrl}. Is the local server running?`);
        }
        if (next.done) break;
        resetIdleTimer();

        lineRemainder += decoder.decode(next.value, { stream: true });
        const lines = lineRemainder.split('\n');
        lineRemainder = lines.pop() ?? '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data:')) continue;
          const data = trimmedLine.slice('data:'.length).trim();
          if (data === '[DONE]') continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue; // stray keepalive or partial frame — ignore
          }

          const delta = (parsed as { choices?: { delta?: { content?: unknown } }[] })?.choices?.[0]?.delta;
          if (typeof delta?.content !== 'string') continue;

          contentBuffer += delta.content;
          const cleaned = cleanSuggestions(extractSuggestions(contentBuffer).suggestions);
          while (emittedCount < cleaned.length && emittedCount < 3) {
            emit({ type: 'suggestion', index: emittedCount, text: cleaned[emittedCount] });
            emittedCount++;
          }
        }
      }
    } finally {
      clearTimeout(timer);
    }

    const finalSuggestions = cleanSuggestions(extractSuggestions(contentBuffer).suggestions);
    if (finalSuggestions.length === 0) {
      throw new SuggestError('bad_response', 'Model returned no usable suggestions.');
    }
    return finalSuggestions.slice(0, 3);
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
